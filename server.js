const http = require('http');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const netease = require('NeteaseCloudMusicApi');
const { normName, hasVariantMarker, colorFromName } = require('./lib/music');
const { fetchArtistAlbums, resolveItunesArtistId, resolveAvatar, fetchITunesAlbumMap } = require('./lib/sources');

// ═══════════════════════════════════════════
//  配置
// ═══════════════════════════════════════════
const PORT = process.env.PORT || 8088;
const PROXY = process.env.NETEASE_PROXY || undefined;

const COOKIE_FILE = path.join(__dirname, '.netease_cookie');
const ARTISTS_FILE = path.join(__dirname, 'artists.json');
const MUSICKIT_FILE = path.join(__dirname, 'musickit.json');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon'
};

// 网易云登录 Cookie（扫码登录后自动写入，用于解锁完整播放）
let neteaseCookie = '';
let neteaseProfile = null;
try { neteaseCookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim(); } catch (e) {}

// Apple MusicKit 配置
let mkConfig = { teamId: '', keyId: '', privateKey: '' };
try { mkConfig = JSON.parse(fs.readFileSync(MUSICKIT_FILE, 'utf8')); } catch (e) {}

// ═══════════════════════════════════════════
//  艺人数据 —— 唯一来源 artists.json
//  加一位歌手只需要改这一个文件：
//    { "id": "网易云艺人ID", "name": "显示名", "albums": ["专辑名", ...] }
//  color / itunesId / avatar 可以不写，会自动补全。
// ═══════════════════════════════════════════
function loadArtists() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(ARTISTS_FILE, 'utf8'));
  } catch (e) {
    console.error('✗ 读取 artists.json 失败：' + e.message);
    process.exit(1);
  }

  const list = Array.isArray(raw) ? raw : raw && raw.artists;
  if (!Array.isArray(list) || !list.length) {
    console.error('✗ artists.json 里找不到 artists 数组');
    process.exit(1);
  }

  const errors = [];
  const seen = new Set();
  list.forEach((a, i) => {
    const at = 'artists[' + i + ']';
    if (!a || typeof a !== 'object') { errors.push(at + ' 不是对象'); return; }
    if (!a.id) { errors.push(at + ' 缺少 id（网易云艺人 ID）'); return; }
    if (!a.name) errors.push(at + ' 缺少 name');
    if (!Array.isArray(a.albums) || !a.albums.length) errors.push(at + '（' + (a.name || '?') + '）的 albums 为空');
    if (seen.has(String(a.id))) errors.push(at + ' 的 id ' + a.id + ' 与前面重复');
    seen.add(String(a.id));
  });

  if (errors.length) {
    console.error('✗ artists.json 校验未通过：');
    errors.forEach(e => console.error('    · ' + e));
    process.exit(1);
  }
  return list;
}

const ARTISTS = loadArtists();
const ARTIST_BY_ID = new Map(ARTISTS.map(a => [String(a.id), a]));

// ═══════════════════════════════════════════
//  自动补全：color / avatar / itunesId
// ═══════════════════════════════════════════

// 主题色 / 专辑名归一化 / 版本标记判断 —— 实现在 lib/music.js，与 add-artist 工具共用

// 补全结果缓存，避免重复请求
const hydrated = new Map();
async function hydrate(a) {
  const id = String(a.id);
  if (hydrated.has(id)) return hydrated.get(id);
  const card = {
    id,
    name: a.name,
    color: a.color || colorFromName(a.name),
    avatar: a.avatar || await resolveAvatar(id),
    itunesId: a.itunesId || await resolveItunesArtistId(a.name),
    albums: a.albums
  };
  hydrated.set(id, card);
  return card;
}

// ═══════════════════════════════════════════
//  专辑匹配（手工清单 × 网易云实际专辑）
// ═══════════════════════════════════════════
// 未匹配上的专辑会打日志，而不是静默丢弃
async function matchCuratedAlbums(artist) {
  const all = await fetchArtistAlbums(artist.id);
  const normed = new Map();
  for (const al of all) {
    const key = normName(al.name);
    if (!normed.has(key)) normed.set(key, []);
    normed.get(key).push(al);
  }

  const albums = [];
  const unmatched = [];
  for (const c of artist.albums) {
    const key = normName(c);
    const wantMarker = hasVariantMarker(c);
    const cands = normed.get(key) || [];
    let hit = null;
    if (wantMarker) {
      hit = cands.find(al => hasVariantMarker(al.name)) || cands[0];
    } else {
      hit = cands.filter(al => !hasVariantMarker(al.name))[0] || cands[0];
    }
    if (!hit) {
      try {
        const sr = await netease.cloudsearch({ keywords: c, type: 10, limit: 3, proxy: PROXY });
        const list = (sr.body && sr.body.result && sr.body.result.albums) || [];
        hit = list.find(a => normName(a.name) === key || normName(a.name).startsWith(key)) || null;
      } catch (e) {}
    }
    if (hit) albums.push(hit); else unmatched.push(c);
  }

  if (unmatched.length) {
    console.warn('⚠ [' + artist.name + '] 有 ' + unmatched.length + ' 张专辑没匹配上：' + unmatched.join(' / '));
  }
  return { albums, unmatched };
}

async function getArtistAlbumsWithCovers(artist) {
  const { albums, unmatched } = await matchCuratedAlbums(artist);
  const itunesId = artist.itunesId || await resolveItunesArtistId(artist.name);
  const itunesMap = itunesId ? await fetchITunesAlbumMap(itunesId) : new Map();
  const withCovers = albums.map(al => {
    const it = itunesMap.get(normName(al.name));
    const coverUrl = (it && it.artworkUrl100)
      ? it.artworkUrl100.replace('100x100bb', '600x600bb')
      : (al.picUrl ? al.picUrl.replace(/^http:/, 'https:') : null);
    return Object.assign({}, al, { coverUrl });
  });
  return { albums: withCovers, unmatched };
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function handleAPI(req, res) {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const route = url.pathname;

  // 艺人列表（前端开场列表用）
  if (route === '/api/artists') {
    try {
      const cards = await Promise.all(ARTISTS.map(hydrate));
      json(res, 200, {
        artists: cards.map(a => ({ id: a.id, name: a.name, color: a.color, avatar: a.avatar }))
      });
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 某位艺人的专辑（手工清单 + iTunes 高清封面）
  if (route === '/api/artist/albums') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    const artist = ARTIST_BY_ID.get(String(id));
    if (!artist) { json(res, 404, { code: -1, message: 'artists.json 里没有 id=' + id + ' 的艺人' }); return; }
    try {
      const card = await hydrate(artist);
      const { albums, unmatched } = await getArtistAlbumsWithCovers(card);
      json(res, 200, { hotAlbums: albums, unmatched });
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 专辑详情
  if (route === '/api/album') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const result = await netease.album({ id, proxy: PROXY });
      json(res, 200, result.body);
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 歌曲播放地址
  if (route === '/api/song/url') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const result = await netease.song_url({
        id,
        br: neteaseCookie ? 999000 : 320000,
        cookie: neteaseCookie || undefined,
        proxy: PROXY
      });
      json(res, 200, result.body);
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 歌词
  if (route === '/api/lyric') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const result = await netease.lyric({ id, proxy: PROXY });
      json(res, 200, result.body);
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 扫码登录 —— 取二维码
  if (route === '/api/login/qr/key') {
    try {
      const keyRes = await netease.login_qr_key({ proxy: PROXY });
      const key = keyRes.body && keyRes.body.data && keyRes.body.data.unikey;
      if (!key) { json(res, 500, { code: -1, message: '获取二维码 key 失败' }); return; }
      const qrRes = await netease.login_qr_create({ key, qrimg: true, proxy: PROXY });
      json(res, 200, { key, qrimg: qrRes.body && qrRes.body.data && qrRes.body.data.qrimg });
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 扫码登录 —— 轮询状态
  if (route === '/api/login/qr/check') {
    const key = url.searchParams.get('key');
    if (!key) { res.writeHead(400); res.end('Missing key'); return; }
    try {
      const r = await netease.login_qr_check({ key, proxy: PROXY });
      const code = r.body && r.body.code;
      if (code === 803) {
        neteaseCookie = r.body.cookie || '';
        try { fs.writeFileSync(COOKIE_FILE, neteaseCookie); } catch (e) {}
        try {
          const st = await netease.login_status({ cookie: neteaseCookie, proxy: PROXY });
          neteaseProfile = (st.body && st.body.data && st.body.data.profile) || null;
        } catch (e) { neteaseProfile = null; }
      }
      json(res, 200, { code: code || -1, message: r.body && r.body.message });
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // 登录状态
  if (route === '/api/login/status') {
    json(res, 200, { loggedIn: !!neteaseCookie, nickname: neteaseProfile && neteaseProfile.nickname });
    return;
  }

  // 搜索
  if (route === '/api/search') {
    const keywords = url.searchParams.get('keywords');
    const type = url.searchParams.get('type') || '1';
    if (!keywords) { res.writeHead(400); res.end('Missing keywords'); return; }
    try {
      const result = await netease.cloudsearch({ keywords, type: Number(type), limit: 20, proxy: PROXY });
      json(res, 200, result.body);
    } catch (e) {
      json(res, 500, { code: -1, message: e.message });
    }
    return;
  }

  // MusicKit Developer Token
  if (route === '/api/musickit/token') {
    if (!mkConfig.teamId || mkConfig.teamId === 'YOUR_TEAM_ID') {
      json(res, 200, { error: 'Configure musickit.json' });
      return;
    }
    try {
      const token = jwt.sign({}, mkConfig.privateKey, {
        algorithm: 'ES256', expiresIn: '180d',
        issuer: mkConfig.teamId,
        header: { alg: 'ES256', kid: mkConfig.keyId }
      });
      json(res, 200, { token });
    } catch (e) {
      json(res, 500, { error: e.message });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ═══════════════════════════════════════════
//  Server
// ═══════════════════════════════════════════
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleAPI(req, res).catch(e => {
      if (!res.headersSent) json(res, 500, { code: -1, message: e.message });
    });
    return;
  }

  let filePath = path.join(__dirname, req.url === '/' ? 'ye.html' : req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(__dirname, 'ye.html');

  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  const albums = ARTISTS.reduce((n, a) => n + a.albums.length, 0);
  console.log('Server: http://localhost:' + PORT);
  console.log('艺人 ' + ARTISTS.length + ' 位 · 专辑 ' + albums + ' 张（来自 artists.json）');
  console.log('网易云登录：' + (neteaseCookie ? '已登录' : '未登录'));
  if (PROXY) console.log('代理：' + PROXY);
});
