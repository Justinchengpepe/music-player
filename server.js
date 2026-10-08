const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const netease = require('NeteaseCloudMusicApi');

// 网易云登录 Cookie（扫码登录后存这里，用于解锁完整播放）
const COOKIE_FILE = path.join(__dirname, '.netease_cookie');
let neteaseCookie = '';
let neteaseProfile = null;
try { neteaseCookie = fs.readFileSync(COOKIE_FILE, 'utf8').trim() || ''; } catch(e) { neteaseCookie = ''; }

// Load MusicKit config
let mkConfig = { teamId: '', keyId: '', privateKey: '' };
try { mkConfig = JSON.parse(fs.readFileSync('musickit.json', 'utf8')); } catch(e) {}

const STATIC_PORT = process.env.PORT || 8088;
const PROXY = process.env.NETEASE_PROXY || undefined;
const MIME = { '.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav' };

// ── 官方录音室专辑清单（手动维护，按发行顺序）──
const CURATED = {
  '37520': ['The College Dropout','Late Registration','Graduation','808s & Heartbreak','My Beautiful Dark Twisted Fantasy','Watch The Throne','Yeezus','The Life of Pablo','ye','KIDS SEE GHOSTS','JESUS IS KING','Donda','Vultures 1','Vultures 2','BULLY - DELUXE'],
  '53283': ['Thank Me Later','Take Care','Nothing Was the Same','Views','More Life','Scorpion','Certified Lover Boy','Honestly, Nevermind','Her Loss','For All The Dogs','$ome $exy $ongs 4 U'],
  '44708': ['Goblin','Wolf','Cherry Bomb','Flower Boy','IGOR','CALL ME IF YOU GET LOST','CHROMAKOPIA'],
  '33727': ['Nostalgia, Ultra','channel ORANGE','Endless','Blonde'],
  '1021293': ["Pilgrim's Paradise",'Freudian','Case Study 01','NEVER ENOUGH','Son Of Spergy'],
  '737012': ['Days Before Rodeo','Rodeo','Birds In The Trap Sing McKnight','ASTROWORLD','UTOPIA'],
  '37995': ['Section.80','good kid, m.A.A.d city','To Pimp a Butterfly','untitled unmastered.','DAMN.','Mr. Morale & The Big Steppers','GNX'],
  '90075': ['Coastal Grooves','Cupid Deluxe','Freetown Sound','Negro Swan','Essex Honey'],
  '29100': ['LIVE.LOVE.A$AP','LONG.LIVE.A$AP','AT.LONG.LAST.A$AP','TESTING',"Don't Be Dumb"],
  '12062134': ['Issa Album','i am > i was','SAVAGE MODE II','american dream','WHAT HAPPENED TO THE STREETS?'],
  '14253161': ['Heaven Or Hell','Life of a DON','Love Sick','HARDSTONE PSYCHO','OCTANE'],
  '36910': ['2014 Forest Hills Drive','The Off-Season','Might Delete Later','The Fall-Off'],
  '33794': ['Pluto x Baby Pluto','I NEVER LIKED YOU',"WE DON'T TRUST YOU","WE STILL DON'T TRUST YOU",'The Real Me'],
  '12505561': ['My Turn','The Voice of the Heroes',"It's Only Me",'WHAM'],
  '976120': ["WE DON'T TRUST YOU","WE STILL DON'T TRUST YOU"],
  '28690073': ['2 Alivë','Lyfë','AftërLyfe','2093','LYFESTYLE'],
  '12068095': ['Playboi Carti','Die Lit','Whole Lotta Red','MUSIC'],
  '30929': ['Camp','Because the Internet','"Awaken, My Love!"','3.15.20','Atavista'],
  '39884': ['Watching Movies with the Sound Off','GO:OD AM','The Divine Feminine','Swimming','Circles','Balloonerism'],
  '33329': ['Doris','Some Rap Songs','FEET OF CLAY','SICK!','Voir Dire'],
  '13643289': ['LP!','OFFLINE!','SCARING THE HOES','I LAY DOWN MY LIFE FOR YOU'],
  '776980': ['Imperial','TA13OO','ZUU','UNLOCKED','Melt My Eyez See Your Future','KING OF THE MISCHIEVOUS SOUTH'],
  '37535': ["Passion, Pain & Demon Slayin'",'Man On The Moon III: The Chosen','Entergalactic','INSANO','Free'],
  '185858': ['Starboy','After Hours','Dawn FM','Hurry Up Tomorrow'],
  '905232': ['Z','Ctrl','SOS'],
  '1120022': ['T R A P S O U L','True to Self','A N N I V E R S A R Y','Bryson Tiller','Solace & The Vices'],
  '32396647': ['TAKE TIME',"When It's All Said And Done... Take Time",'Give Or Take','BELOVED'],
  '12062113': ['Sonder Son','WASTELAND','Larger Than Life','Icon'],
  '13806114': ['Last Day Of Summer','Over It','Still Over It','Finally Over It'],
  '12107900': ['H.E.R.','I Used To Know Her','Back of My Mind']
};

// 艺人名 + iTunes artist ID（用于封面查询）
const ARTIST_META = {
  '37520': { name: 'Kanye West', itunesId: 2715720 },
  '53283': { name: 'Drake', itunesId: 271256 },
  '44708': { name: 'Tyler The Creator', itunesId: 420368335 },
  '33727': { name: 'Frank Ocean', itunesId: 442122051 },
  '1021293': { name: 'Daniel Caesar', itunesId: 1019899019 },
  '737012': { name: 'Travis Scott', itunesId: 549236696 },
  '37995': { name: 'Kendrick Lamar', itunesId: 368183298 },
  '90075': { name: 'Blood Orange', itunesId: 440698865 },
  '29100': { name: 'ASAP Rocky', itunesId: 481488005 },
  '12062134': { name: '21 Savage', itunesId: 894820464 },
  '14253161': { name: 'Don Toliver', itunesId: 1237012992 },
  '36910': { name: 'J. Cole', itunesId: 73705833 },
  '33794': { name: 'Future', itunesId: 128050210 },
  '12505561': { name: 'Lil Baby', itunesId: 1276656483 },
  '976120': { name: 'Metro Boomin', itunesId: 670534462 },
  '28690073': { name: 'Yeat', itunesId: 1318094493 },
  '12068095': { name: 'Playboi Carti', itunesId: 982372505 },
  '30929': { name: 'Childish Gambino', itunesId: 466842536 },
  '39884': { name: 'Mac Miller', itunesId: 419944559 },
  '33329': { name: 'Earl Sweatshirt', itunesId: 445693504 },
  '13643289': { name: 'JPEGMAFIA', itunesId: 1130088441 },
  '776980': { name: 'Denzel Curry', itunesId: 631440154 },
  '37535': { name: 'Kid Cudi', itunesId: 273058501 },
  '185858': { name: 'The Weeknd', itunesId: 479756766 },
  '905232': { name: 'SZA', itunesId: 605800394 },
  '1120022': { name: 'Bryson Tiller', itunesId: 642591128 },
  '32396647': { name: 'Giveon', itunesId: 1070668868 },
  '12062113': { name: 'Brent Faiyaz', itunesId: 960127446 },
  '13806114': { name: 'Summer Walker', itunesId: 990402287 },
  '12107900': { name: 'H.E.R.', itunesId: 123049323 }
};

// 归一化专辑名（去括号、去 deluxe/bonus/版本后缀、去非字母数字）
function normName(name){
  return String(name).toLowerCase()
    .replace(/\(.*?\)/g,'')
    .replace(/\[.*?\]/g,'')
    .replace(/\s*[-–]\s*(deluxe|bonus|softback|intl|international|version|edition|explicit|clean|expanded|reissue).*$/,'')
    .replace(/\s*\+\s*$/,'')
    .replace(/[^a-z0-9]/g,'');
}

// 判断是否带 deluxe/bonus/版本 等再版标记
function hasVariantMarker(name){
  const n = String(name).toLowerCase();
  return /deluxe|bonus|softback|intl|international|edition|explicit|clean|expanded|reissue|version|remix|remaster|chopped|choppednslop|slop|instrumental|sped|nightcore|slowed|mixtape|live|acoustic|reprise/.test(n) || n.includes('+');
}

async function fetchArtistAlbums(id){
  let all = [];
  for (let off = 0; off < 250; off += 50){
    const r = await netease.artist_album({ id, limit: 50, offset: off , proxy: PROXY });
    const a = r.body && r.body.hotAlbums || [];
    if (!a.length) break;
    all = all.concat(a);
  }
  return all;
}

async function matchCuratedAlbums(id){
  const curated = CURATED[id] || [];
  const all = await fetchArtistAlbums(id);
  const normed = new Map(); // key -> [albums]
  for (const al of all){
    const key = normName(al.name);
    if (!normed.has(key)) normed.set(key, []);
    normed.get(key).push(al);
  }
  const result = [];
  for (const c of curated){
    const key = normName(c);
    const wantMarker = hasVariantMarker(c);
    const cands = normed.get(key) || [];
    let hit = null;
    if (wantMarker) {
      hit = cands.find(al => hasVariantMarker(al.name)) || cands[0];
    } else {
      const plain = cands.filter(al => !hasVariantMarker(al.name));
      hit = plain[0] || cands[0];
    }
    if (hit) { result.push(hit); continue; }
    // 兜底：直接搜索
    try {
      const sr = await netease.cloudsearch({ keywords: c, type: 10, limit: 3 , proxy: PROXY });
      const albums = sr.body && sr.body.result && sr.body.result.albums || [];
      const found = albums.find(a => normName(a.name) === key || normName(a.name).startsWith(key));
      if (found) result.push(found);
    } catch(e) {}
  }
  return result;
}

// 用 lookup 端点一次性拉取该艺人所有专辑（含封面）
async function fetchITunesAlbumMap(artistId){
  const map = new Map();
  try {
    const r = await fetch('https://itunes.apple.com/lookup?id=' + artistId + '&entity=album&limit=200');
    const d = await r.json();
    for (const al of (d.results || [])){
      if (al.wrapperType !== 'collection') continue;
      const key = normName(al.collectionName || '');
      if (!key) continue;
      const existing = map.get(key);
      if (!existing || (hasVariantMarker(existing.collectionName) && !hasVariantMarker(al.collectionName))){
        map.set(key, al);
      }
    }
  } catch(e) {}
  return map;
}

async function getArtistAlbumsWithCovers(id){
  const albums = await matchCuratedAlbums(id);
  const meta = ARTIST_META[id];
  const itunesMap = meta && meta.itunesId ? await fetchITunesAlbumMap(meta.itunesId) : new Map();
  return albums.map(al => {
    const key = normName(al.name);
    const it = itunesMap.get(key);
    const coverUrl = (it && it.artworkUrl100) ? it.artworkUrl100.replace('100x100bb','600x600bb') : (al.picUrl ? al.picUrl.replace(/^http:/,'https:') : null);
    return Object.assign({}, al, { coverUrl });
  });
}

// ── API handlers ──
async function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${STATIC_PORT}`);
  const route = url.pathname;

  // MusicKit token
  if (route === '/api/musickit/token') {
    if (!mkConfig.teamId || mkConfig.teamId === 'YOUR_TEAM_ID') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Configure musickit.json' }));
      return;
    }
    try {
      const token = jwt.sign({}, mkConfig.privateKey, {
        algorithm: 'ES256', expiresIn: '180d',
        issuer: mkConfig.teamId,
        header: { alg: 'ES256', kid: mkConfig.keyId }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Artist albums (curated official discography + iTunes covers)
  if (route === '/api/artist/albums') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const albums = await getArtistAlbumsWithCovers(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hotAlbums: albums }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  // Album detail
  if (route === '/api/album') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const result = await netease.album({ id , proxy: PROXY });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  // Song URL
  if (route === '/api/song/url') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const result = await netease.song_url({ id, br: neteaseCookie ? 999000 : 320000, cookie: neteaseCookie || undefined , proxy: PROXY });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  // Lyrics
  if (route === '/api/lyric') {
    const id = url.searchParams.get('id');
    if (!id) { res.writeHead(400); res.end('Missing id'); return; }
    try {
      const result = await netease.lyric({ id , proxy: PROXY });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  // QR login — 获取登录二维码
  if (route === '/api/login/qr/key') {
    try {
      const keyRes = await netease.login_qr_key({ proxy: PROXY });
      const key = keyRes.body && keyRes.body.data && keyRes.body.data.unikey;
      if (!key) { res.writeHead(500); res.end(JSON.stringify({ code: -1 })); return; }
      const qrRes = await netease.login_qr_create({ key, qrimg: true , proxy: PROXY });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ key, qrimg: qrRes.body && qrRes.body.data && qrRes.body.data.qrimg }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  // QR login — 轮询扫码状态
  if (route === '/api/login/qr/check') {
    const key = url.searchParams.get('key');
    if (!key) { res.writeHead(400); res.end('Missing key'); return; }
    try {
      const r = await netease.login_qr_check({ key , proxy: PROXY });
      const code = r.body && r.body.code;
      if (code === 803) {
        neteaseCookie = r.body.cookie || '';
        // 持久化 cookie（重启不丢）
        try { fs.writeFileSync(COOKIE_FILE, neteaseCookie); } catch(e) {}
        // 登录成功后拉取用户信息
        try {
          const st = await netease.login_status({ cookie: neteaseCookie , proxy: PROXY });
          neteaseProfile = (st.body && st.body.data && st.body.data.profile) || null;
        } catch(e) { neteaseProfile = null; }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: code || -1, message: r.body && r.body.message }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  // 登录状态
  if (route === '/api/login/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ loggedIn: !!neteaseCookie, nickname: neteaseProfile && neteaseProfile.nickname }));
    return;
  }

  // Search
  if (route === '/api/search') {
    const keywords = url.searchParams.get('keywords');
    const type = url.searchParams.get('type') || '1';
    if (!keywords) { res.writeHead(400); res.end('Missing keywords'); return; }
    try {
      const result = await netease.cloudsearch({ keywords, type: Number(type), limit: 20 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, message: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// ── Server ──
const server = http.createServer((req, res) => {
  // API routes
  if (req.url.startsWith('/api/')) {
    handleAPI(req, res).catch(e => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: -1, message: e.message }));
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(__dirname, req.url === '/' ? 'ye.html' : req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(__dirname, 'ye.html');

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(STATIC_PORT, () => {
  console.log('Server: http://localhost:' + STATIC_PORT);
});
