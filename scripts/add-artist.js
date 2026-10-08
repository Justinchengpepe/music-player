#!/usr/bin/env node
/**
 * 往 artists.json 里加一位歌手。
 *
 *   npm run add-artist "Kendrick Lamar"               搜网易云，自动补全全部字段
 *   npm run add-artist "Kendrick Lamar" --id 37995    直接指定网易云艺人 ID
 *   npm run add-artist "Kendrick Lamar" --dry-run     只看结果，不写文件
 *   npm run add-artist "Kendrick Lamar" --force       已存在时覆盖
 *   npm run add-artist "Kendrick Lamar" --include-singles  连单曲一起列出来
 *   npm run add-artist --list                         列出当前所有艺人
 *
 * 会自动做这几件事：
 *   1. 搜网易云拿到艺人 ID
 *   2. 拉取该艺人全部专辑，排除单曲、deluxe / 现场 / 混音 / 重复版本，按发行时间排序
 *   3. 查 iTunes 拿到 itunesId（用于高清封面）
 *   4. 取网易云头像
 *   5. 推导主题色
 *
 * 写入后专辑清单通常还需要你手工删几张（比如精选集、合作专辑），
 * 直接编辑 artists.json 里的 albums 数组即可。
 */

const fs = require('fs');
const path = require('path');
const { normName, hasVariantMarker, colorFromName } = require('../lib/music');
const { fetchArtistAlbums, resolveItunesArtistId, resolveAvatar, searchArtist } = require('../lib/sources');

const ROOT = path.join(__dirname, '..');
const ARTISTS_FILE = path.join(ROOT, 'artists.json');

function readArtists() {
  const raw = JSON.parse(fs.readFileSync(ARTISTS_FILE, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw && raw.artists;
  if (!Array.isArray(list)) throw new Error('artists.json 里找不到 artists 数组');
  return list;
}

function writeArtists(list) {
  fs.writeFileSync(ARTISTS_FILE, JSON.stringify({ artists: list }, null, 2) + '\n');
}

function usage(code) {
  const text = fs.readFileSync(__filename, 'utf8')
    .split('\n').slice(1, 18).map(l => l.replace(/^ \* ?|^\/\*\*$/g, '')).join('\n');
  (code ? console.error : console.log)(text);
  process.exit(code || 0);
}

function pad(s, n) {
  const w = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
  return String(s) + ' '.repeat(Math.max(0, n - w));
}

function fmtDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toISOString().slice(0, 10); } catch (e) { return ''; }
}

function printList(list) {
  console.log(`artists.json 共 ${list.length} 位艺人\n`);
  list.forEach((a, i) => {
    console.log(`  ${pad(String(i + 1) + '.', 5)}${pad(a.name, 26)}${pad(a.id, 12)}${(a.albums || []).length} 张`);
  });
}

(async () => {
  const argv = process.argv.slice(2);
  const flags = { dry: false, list: false, force: false, help: false, singles: false, id: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') flags.dry = true;
    else if (a === '--list') flags.list = true;
    else if (a === '--force') flags.force = true;
    else if (a === '--include-singles') flags.singles = true;
    else if (a === '--help' || a === '-h') flags.help = true;
    else if (a === '--id') flags.id = argv[++i];
    else rest.push(a);
  }
  const name = rest.join(' ').trim();

  if (flags.help) return usage(0);
  const list = readArtists();
  if (flags.list) return printList(list);
  if (!name) return usage(1);

  const want = normName(name);
  const existIdx = list.findIndex(a => normName(a.name) === want);
  if (existIdx >= 0 && !flags.force) {
    console.log(`「${list[existIdx].name}」已经在 artists.json 里了（id ${list[existIdx].id}）`);
    console.log('想覆盖请加 --force');
    return;
  }

  // ── 1. 定位网易云艺人 ──
  let artist;
  if (flags.id) {
    artist = { id: String(flags.id), name };
    console.log(`✓ 使用指定 ID：${artist.id}`);
  } else {
    process.stdout.write(`搜索网易云：${name} … `);
    const cands = await searchArtist(name);
    const exact = cands.filter(c => normName(c.name) === want);
    if (exact.length >= 1) {
      artist = exact.slice().sort((a, b) => (b.albumSize || 0) - (a.albumSize || 0))[0];
      console.log('命中');
    } else {
      console.log('未命中');
      if (!cands.length) {
        console.error(`✗ 搜不到「${name}」`);
      } else {
        console.error(`✗ 没有完全匹配「${name}」的艺人，候选：`);
        cands.slice(0, 8).forEach(c => console.error(`    ${pad(c.name, 28)}id=${pad(c.id, 12)}专辑 ${c.albumSize || '?'} 张`));
        console.error(`\n确认后指定 ID 重跑：npm run add-artist "${name}" --id ${cands[0].id}`);
      }
      process.exit(1);
    }
  }
  console.log(`  网易云艺人：${artist.name}（id ${artist.id}）`);

  // ── 2. 拉专辑并筛掉再版 / 现场 / 混音 / 重复 ──
  const all = await fetchArtistAlbums(artist.id);
  if (!all.length) {
    console.error('✗ 这位艺人名下没有专辑');
    process.exit(1);
  }
  const seen = new Set();
  const kept = [], dropped = [];
  let singleCount = 0;
  for (const a of all.slice().sort((x, y) => (x.publishTime || 0) - (y.publishTime || 0))) {
    const k = normName(a.name);
    if (!k) continue;
    if (!flags.singles && a.type === 'Single') { singleCount++; continue; }
    if (hasVariantMarker(a.name) || seen.has(k)) { dropped.push(a.name); continue; }
    seen.add(k);
    kept.push(a);
  }
  console.log(`  专辑 ${kept.length} 张（排除了 ${singleCount} 张单曲、${dropped.length} 张再版/现场/重复）`);

  // ── 3. 补全 itunesId 与头像 ──
  const displayName = artist.name || name;
  const [itunesId, avatar] = await Promise.all([
    resolveItunesArtistId(displayName),
    resolveAvatar(artist.id)
  ]);
  console.log(`  iTunes ID：${itunesId || '（没查到，封面会退回网易云图）'}`);
  console.log(`  头像：${avatar ? '已获取' : '（没取到，运行时自动重试）'}`);

  const entry = {
    id: String(artist.id),
    name: displayName,
    albums: kept.map(a => a.name),
    color: colorFromName(displayName),
    itunesId: itunesId,
    avatar: avatar
  };

  // ── 4. 打印结果 ──
  console.log(`\n待写入的专辑清单（按发行时间）：`);
  kept.forEach((a, i) => console.log(`  ${pad(String(i + 1) + '.', 5)}${pad(a.name, 46)}${pad(a.type || '', 8)}${fmtDate(a.publishTime)}`));
  if (dropped.length) {
    console.log(`\n已排除：`);
    dropped.slice(0, 12).forEach(n => console.log(`  - ${n}`));
    if (dropped.length > 12) console.log(`  … 另有 ${dropped.length - 12} 张`);
  }

  if (flags.dry) {
    console.log('\n（--dry-run，未写入任何文件）');
    return;
  }

  if (existIdx >= 0) list[existIdx] = entry; else list.push(entry);
  writeArtists(list);
  console.log(`\n✓ 已写入 artists.json，现在共 ${list.length} 位艺人`);
  console.log('  重启服务后生效：npm start');
  console.log('  想调整专辑清单，直接编辑 artists.json 里的 albums 数组');
})().catch(e => {
  console.error('✗ ' + e.message);
  process.exit(1);
});
