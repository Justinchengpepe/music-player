import { AlbumShelf } from './album-shelf.js';
import { Library } from './library.js';

class EventBus {
  constructor() { this._l = {}; }
  on(e, fn) { (this._l[e] ??= []).push(fn); }
  emit(e, d) { (this._l[e] ?? []).forEach(f => f(d)); }
}

class App {
  constructor() {
    this.events = new EventBus();
    this.emit = this.events.emit.bind(this.events);
    this.on = this.events.on.bind(this.events);

    this.library = new Library();
    this.shelf = null;
    this.currentAlbumIndex = -1;
    this.currentTrackNeId = null;
    this._neteaseFrame = null;

    this._onAlbumHalfway = this._onAlbumHalfway.bind(this);
    this._onAlbumSelected = this._onAlbumSelected.bind(this);
    this._onAlbumDeselected = this._onAlbumDeselected.bind(this);
    this._onTogglePlayPause = this._onTogglePlayPause.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._raf = this._raf.bind(this);
    this._debugEl = document.getElementById('error-msg');

    this._init();
  }

  _debug(msg) {
    const el = this._debugEl;
    el.style.display = 'block';
    el.textContent = (el.textContent || '') + msg + '\n';
  }

  _init() {
    document.getElementById('loading-indicator').style.display = 'none';
    this._debug('Init start');
    const container = document.getElementById('three-container');
    this._debug('Container: ' + container.getBoundingClientRect().width + 'x' + container.getBoundingClientRect().height);

    try {
      this.shelf = new AlbumShelf(container);
      this._debug('Shelf created');
    } catch(e) {
      this._debug('Shelf error: ' + e.message);
      return;
    }

    this.shelf.app = this;
    this._neteaseFrame = document.getElementById('netease-frame');

    const albums = this.library.getAllAlbums();
    this._debug('Albums: ' + albums.length);
    this.shelf.setAlbums(albums);
    this._debug('Albums set');

    // Load album textures
    albums.forEach((a, i) => this.shelf.loadTexture(i, a.coverUrl));
    this._debug('Textures loading');

    this.on('albumTransitionHalfway', this._onAlbumHalfway);
    this.on('albumSelected', this._onAlbumSelected);
    this.on('albumDeselected', this._onAlbumDeselected);
    this.on('togglePlayPause', this._onTogglePlayPause);

    document.addEventListener('keydown', this._onKeyDown);

    this._lastTime = performance.now();
    requestAnimationFrame(this._raf);
  }

  // ── Events ──

  _onAlbumHalfway({ index }) {
    const album = this.library.getAlbum(index);
    if (!album) return;
    this._showPanel(album);
  }

  _onAlbumSelected({ index }) {
    this.currentAlbumIndex = index;
    const album = this.library.getAlbum(index);
    if (!album) return;
    this._populateTracks(album);
    document.getElementById('hint').style.opacity = '0';
  }

  _onAlbumDeselected() {
    this.currentAlbumIndex = -1;
    this._hidePanel();
    this._neteaseFrame.src = '';
    this.currentTrackNeId = null;
  }

  _onTogglePlayPause() {
    // NetEase iframe doesn't support programmatic pause — no-op
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.shelf.viewState === 'ALBUM_SELECTED') {
        this.shelf.deselectAlbum();
      }
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.shelf.viewState === 'IDLE') {
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const albums = this.library.getAllAlbums();
        const cur = this.shelf.hoveredIndex;
        const next = Math.max(0, Math.min(albums.length - 1, (cur >= 0 ? cur : 0) + dir));
        this.shelf.mouseNDC.set(0, 0); // fake center
        this.shelf.hoveredIndex = next;
        this.shelf._updateTargets(next, 1.0, false);
      }
    }
  }

  // ── Panel ──

  _showPanel(album) {
    document.getElementById('panel-title').textContent = album.title;
    document.getElementById('panel-year').textContent = album.year;
    document.getElementById('track-panel').classList.add('visible');
  }

  _hidePanel() {
    document.getElementById('track-panel').classList.remove('visible');
  }

  _populateTracks(album) {
    const list = document.getElementById('track-list');
    list.innerHTML = '';

    album.tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = 'track-item' + (track.neId === 0 ? ' unavailable' : '');
      li.innerHTML = `
        <span class="track-num">${i + 1}</span>
        <span class="track-title">${track.title}</span>
        <span class="track-playing-indicator">▶</span>
      `;

      if (track.neId > 0) {
        li.addEventListener('click', () => this._playTrack(track, i, li));
      }

      list.appendChild(li);
    });
  }

  _playTrack(track, _trackIndex, li) {
    if (this.currentTrackNeId === track.neId) return;

    this.currentTrackNeId = track.neId;
    this._neteaseFrame.src =
      `https://music.163.com/outchain/player?type=2&id=${track.neId}&auto=1&height=66`;

    // Highlight
    document.querySelectorAll('.track-item.playing').forEach(el => el.classList.remove('playing'));
    if (li) li.classList.add('playing');
  }

  // ── Loop ──

  _raf(timestamp) {
    const dt = (timestamp - this._lastTime) / 1000;
    this._lastTime = timestamp;
    this.shelf.update(dt);
    requestAnimationFrame(this._raf);
  }
}

try {
  new App();
} catch (e) {
  document.body.innerHTML = `<div style="color:#ff6666;padding:40px;font-family:monospace;">
    <h2>Error</h2><pre>${e.message}\n${e.stack}</pre></div>`;
  console.error(e);
}
