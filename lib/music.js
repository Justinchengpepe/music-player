// 专辑名归一化 / 版本标记判断 / 主题色推导
// server.js 与 scripts/add-artist.js 共用，避免两处各写一遍。

// 归一化专辑名：去括号内容、去 deluxe/bonus 等版本后缀、去所有非字母数字
function normName(name) {
  return String(name).toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*[-–]\s*(deluxe|bonus|softback|intl|international|version|edition|explicit|clean|expanded|reissue).*$/, '')
    .replace(/\s*\+\s*$/, '')
    .replace(/[^a-z0-9]/g, '');
}

// 是否带再版 / 混音 / 现场等标记
function hasVariantMarker(name) {
  const n = String(name).toLowerCase();
  return /deluxe|bonus|softback|intl|international|edition|explicit|clean|expanded|reissue|version|remix|remaster|chopped|slop|instrumental|sped|nightcore|slowed|mixtape|live|acoustic|reprise/.test(n)
    || n.includes('+');
}

// 主题色候选，想固定配色就在 artists.json 里显式写 color
const PALETTE = ['#d4a853', '#4a90d9', '#2ecc71', '#e67e22', '#9b8ec4', '#a83232',
                 '#2c3e50', '#e65a3a', '#7a5ba0', '#4a6b3a', '#8b5bb0', '#c9a227'];

// 由艺人名稳定推导主题色，同名永远同色
function colorFromName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

module.exports = { normName, hasVariantMarker, PALETTE, colorFromName };
