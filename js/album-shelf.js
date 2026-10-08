import * as THREE from 'three';

// ── Layout ──
const ALBUM_SIZE = { w: 1.8, h: 1.8 };
const SHELF_START_Y = 3.0;
const SHELF_Y_SPACING = 0.68;
const SHELF_X_STAGGER = 0.18;
const SHELF_Z_SPREAD = 0.12;
const DEG2RAD = Math.PI / 180;

// ── Interaction ──
const HOVER_PULL_Z = 1.6;
const HOVER_SCALE_BUMP = 1.07;
const LERP_IDLE = 7.0;
const LERP_TRANSITION = 3.5;

// ── Camera ──
const CAM_IDLE = new THREE.Vector3(0, 0.7, 7.5);
const CAM_SELECTED = new THREE.Vector3(-1.2, 0.2, 5.8);
const SELECTED_POS = new THREE.Vector3(-2.6, 0.2, 1.2);
const SELECTED_SCALE = 1.9;

// ── Colors ──
const PLACEHOLDER_COLORS = [
  '#c49060', '#d4a853', '#e74c8a', '#9b8ec4', '#c0392b',
  '#e0e0e0', '#e67e22', '#2ecc71', '#1a1a1a'
];

export class AlbumShelf {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.app = null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();

    this.mouseNDC = new THREE.Vector2(-999, -999);
    this.isPointerDown = false;
    this._pointerMoved = false;
    this._pointerStart = new THREE.Vector2();

    this.albums = [];
    this.hoveredIndex = -1;
    this.selectedIndex = -1;
    this.viewState = 'IDLE'; // IDLE | TRANS_TO_ALBUM | ALBUM_SELECTED | TRANS_TO_IDLE
    this.transitionProgress = 0;

    this.clock = new THREE.Clock(false);
    this.textureLoader = new THREE.TextureLoader();
    this._placeholderCache = {};
    this._bgTexture = null;

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._onResize = this._onResize.bind(this);

    this._init();
  }

  // ═══════════════════════════════════════════
  //  Init
  // ═══════════════════════════════════════════

  _init() {
    let w = this.containerEl.getBoundingClientRect().width;
    let h = this.containerEl.getBoundingClientRect().height;
    if (w <= 0 || h <= 0) {
      w = window.innerWidth;
      h = window.innerHeight;
    }
    const aspect = w / h;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeeeeee); // bright bg for debugging

    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 50);
    this.camera.position.copy(CAM_IDLE);
    this.camera.lookAt(0, 0.6, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    this.containerEl.appendChild(this.renderer.domElement);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8899cc, 0.2);
    rim.position.set(-2, 1, -1);
    this.scene.add(rim);

    // Test cube — large and bright
    const testGeom = new THREE.BoxGeometry(2, 2, 2);
    const testMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
    const testCube = new THREE.Mesh(testGeom, testMat);
    testCube.position.set(0, 0, 0);
    this.scene.add(testCube);

    // Particles
    this._createParticles();

    // Events
    this.containerEl.addEventListener('pointermove', this._onPointerMove);
    this.containerEl.addEventListener('pointerdown', this._onPointerDown);
    this.containerEl.addEventListener('pointerup', this._onPointerUp);
    this.containerEl.addEventListener('pointerleave', this._onPointerLeave);
    window.addEventListener('resize', this._onResize);
  }

  _createParticles() {
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x998866,
      size: 0.014,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.particles = new THREE.Points(geom, mat);
    this.scene.add(this.particles);
  }

  _createBgGradient() {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 512;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#1a1a2e');
    g.addColorStop(0.5, '#0f1b2d');
    g.addColorStop(1, '#0d1b2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ═══════════════════════════════════════════
  //  Album Creation
  // ═══════════════════════════════════════════

  _createAlbumGroup(album, index) {
    const group = new THREE.Group();
    const { w, h } = ALBUM_SIZE;

    // Cover plane
    const tex = this._getPlaceholder(index, album.color);
    const coverGeom = new THREE.PlaneGeometry(w, h);
    const coverMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.0,
      transparent: true,
      opacity: 1.0
    });
    const cover = new THREE.Mesh(coverGeom, coverMat);
    group.add(cover);

    // Border frame
    const frameGeom = new THREE.EdgesGeometry(coverGeom);
    const frameMat = new THREE.LineBasicMaterial({
      color: 0x333333,
      transparent: true,
      opacity: 0.4
    });
    const frame = new THREE.LineSegments(frameGeom, frameMat);
    group.add(frame);

    // Shadow
    const shadowGeom = new THREE.PlaneGeometry(w * 0.95, h * 0.95);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.position.z = -0.04;
    group.add(shadow);

    return {
      group,
      coverMat,
      coverGeom,
      shadowMat,
      shadow
    };
  }

  _getPlaceholder(index, color) {
    const key = color || PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length];
    if (this._placeholderCache[key]) return this._placeholderCache[key];

    const size = 512;
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Gradient bg
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, key);
    g.addColorStop(0.7, '#1a1a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Vignette
    const v = ctx.createRadialGradient(size/2, size/2, size*0.35, size/2, size/2, size*0.7);
    v.addColorStop(0, 'rgba(255,255,255,0.08)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, size, size);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this._placeholderCache[key] = t;
    return t;
  }

  // ═══════════════════════════════════════════
  //  Album Setup
  // ═══════════════════════════════════════════

  setAlbums(albums) {
    if (!this.scene) {
      // _init hasn't run yet — retry next frame
      requestAnimationFrame(() => this.setAlbums(albums));
      return;
    }
    // Clean up
    for (const a of this.albums) {
      this.scene.remove(a.group);
      a.group.traverse(c => {
        if (c.geometry && c !== a.group) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
    this.albums = [];
    this.selectedIndex = -1;
    this.hoveredIndex = -1;
    this.viewState = 'IDLE';
    this.transitionProgress = 0;

    for (let i = 0; i < albums.length; i++) {
      const parts = this._createAlbumGroup(albums[i], i);
      const rest = this._computeRestPos(i);

      parts.restPos = { ...rest };
      parts.restScale = 1.0;
      parts.restRotY = rest.rotY;
      parts.group.position.set(rest.x, rest.y, rest.z);
      parts.group.rotation.y = rest.rotY;
      parts.group.rotation.x = (Math.random() - 0.5) * 0.03;
      parts.group.rotation.z = (Math.random() - 0.5) * 0.02;

      this.scene.add(parts.group);
      this.albums.push(parts);
    }

    if (albums.length > 0) {
      this._updateTargets(0, 1.0, false);
    }
  }

  _computeRestPos(i) {
    const y = SHELF_START_Y - i * SHELF_Y_SPACING;
    const x = ((i % 2) - 0.5) * SHELF_X_STAGGER * 2;
    const z = ((i % 3) - 1) * SHELF_Z_SPREAD;
    const tiltDir = i % 2 === 0 ? 1 : -1;
    const tiltDeg = 4 + i * 0.6;
    const rotY = tiltDir * tiltDeg * DEG2RAD;
    return { x, y, z, rotY };
  }

  loadTexture(index, url) {
    if (!url || index >= this.albums.length) return;
    this.textureLoader.load(url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      this.albums[index].coverMat.map = tex;
      this.albums[index].coverMat.needsUpdate = true;
    }, undefined, () => { /* fallback: keep placeholder */ });
  }

  // ═══════════════════════════════════════════
  //  Hover
  // ═══════════════════════════════════════════

  _updateHover() {
    if (this.viewState !== 'IDLE') return;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const groups = this.albums.map(a => a.group);
    const hits = this.raycaster.intersectObjects(groups, true);

    let newHov = -1;
    if (hits.length > 0) {
      let obj = hits[0].object;
      for (let i = 0; i < 12 && obj; i++) {
        const idx = this.albums.findIndex(a => a.group === obj);
        if (idx >= 0) { newHov = idx; break; }
        obj = obj.parent;
      }
    }

    if (newHov !== this.hoveredIndex) {
      this.hoveredIndex = newHov;
      this._updateTargets(newHov, 1.0, true);
    }
  }

  _updateTargets(hoveredIdx, _scale, snap) {
    for (let i = 0; i < this.albums.length; i++) {
      const a = this.albums[i];
      const r = a.restPos;
      if (i === hoveredIdx) {
        a.targetPos = new THREE.Vector3(r.x, r.y, r.z + HOVER_PULL_Z);
        a.targetScale = HOVER_SCALE_BUMP;
      } else {
        a.targetPos = new THREE.Vector3(r.x, r.y, r.z);
        a.targetScale = 1.0;
      }
      if (snap) {
        a.group.position.copy(a.targetPos);
        a.group.scale.setScalar(a.targetScale);
      }
    }
  }

  // ═══════════════════════════════════════════
  //  Selection & State Machine
  // ═══════════════════════════════════════════

  selectAlbum(index) {
    if (index < 0 || index >= this.albums.length) return;
    // Cancel any in-progress transition
    if (this.viewState === 'TRANS_TO_IDLE') {
      // Snap non-selected albums back
      for (const a of this.albums) a.group.visible = true;
    }
    this.selectedIndex = index;
    this.viewState = 'TRANS_TO_ALBUM';
    this.transitionProgress = 0;
  }

  deselectAlbum() {
    if (this.viewState === 'ALBUM_SELECTED' || this.viewState === 'TRANS_TO_ALBUM') {
      this.viewState = 'TRANS_TO_IDLE';
      this.transitionProgress = 0;
    }
  }

  isInSelectedState() {
    return this.viewState === 'ALBUM_SELECTED' || this.viewState === 'TRANS_TO_ALBUM';
  }

  getFocusedAlbumIndex() {
    return this.selectedIndex >= 0 ? this.selectedIndex : Math.max(0, this.hoveredIndex);
  }

  // ═══════════════════════════════════════════
  //  Update
  // ═══════════════════════════════════════════

  update(dt) {
    if (dt <= 0 || !this.renderer) return;
    const d = Math.min(dt, 0.1);

    this._updateHover();
    this._updateVisuals(d);
    this._updateStateMachine(d);
    this._updateParticles(d);
    this.renderer.render(this.scene, this.camera);
  }

  _updateVisuals(dt) {
    for (const a of this.albums) {
      if (this.viewState === 'TRANS_TO_ALBUM' || this.viewState === 'TRANS_TO_IDLE') continue;

      if (a.targetPos && this.viewState === 'IDLE') {
        a.group.position.lerp(a.targetPos, LERP_IDLE * dt);
        const s = a.group.scale.x + (a.targetScale - a.group.scale.x) * LERP_IDLE * dt;
        a.group.scale.setScalar(s);
      }
    }
  }

  _updateStateMachine(dt) {
    if (this.viewState === 'IDLE' || this.viewState === 'ALBUM_SELECTED') return;

    this.transitionProgress += LERP_TRANSITION * dt;

    if (this.viewState === 'TRANS_TO_ALBUM') {
      this._doTransitionToAlbum(this.transitionProgress);
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this._doTransitionToAlbum(1.0);
        this.viewState = 'ALBUM_SELECTED';
        if (this.app) this.app.emit('albumSelected', { index: this.selectedIndex });
      } else if (this.transitionProgress >= 0.4 && !this._halfwayEmitted) {
        this._halfwayEmitted = true;
        if (this.app) this.app.emit('albumTransitionHalfway', { index: this.selectedIndex });
      }
    }

    if (this.viewState === 'TRANS_TO_IDLE') {
      this._doTransitionToIdle(this.transitionProgress);
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 0;
        this._doTransitionToIdle(1.0);
        this.viewState = 'IDLE';
        this.selectedIndex = -1;
        this._halfwayEmitted = false;
        this._updateTargets(this.hoveredIndex, 1.0, true);
        if (this.app) this.app.emit('albumDeselected');
      }
    }
  }

  _doTransitionToAlbum(t) {
    const ease = 1 - Math.pow(1 - t, 3); // ease-out
    const sel = this.albums[this.selectedIndex];

    // Camera
    this.camera.position.lerpVectors(CAM_IDLE, CAM_SELECTED, ease);
    this.camera.lookAt(-0.5 + ease * -0.5, 0.6 + ease * -0.3, 0);

    // Selected album
    const rp = sel.restPos;
    sel.group.position.lerpVectors(
      new THREE.Vector3(rp.x, rp.y, rp.z),
      SELECTED_POS,
      ease
    );
    sel.group.scale.setScalar(1.0 + (SELECTED_SCALE - 1.0) * ease);
    sel.group.rotation.y = rp.rotY + (-rp.rotY) * ease;

    // Other albums fade + slide away
    for (let i = 0; i < this.albums.length; i++) {
      if (i === this.selectedIndex) continue;
      const a = this.albums[i];
      const rest = a.restPos;
      a.group.visible = true;
      a.group.position.set(
        rest.x + ease * 4,
        rest.y - ease * 4,
        rest.z + ease * 3
      );
      a.group.scale.setScalar(1.0 - ease * 0.6);
      a.coverMat.opacity = 1.0 - ease;
      a.shadowMat.opacity = 0.18 * (1.0 - ease);
    }
  }

  _doTransitionToIdle(t) {
    const ease = 1 - Math.pow(1 - t, 3);
    const sel = this.albums[this.selectedIndex];

    // Camera
    this.camera.position.lerpVectors(CAM_SELECTED, CAM_IDLE, ease);
    this.camera.lookAt(-0.5 + ease * 0.5, 0.3 + ease * 0.3, 0);

    // Selected album back to rest
    const rp = sel.restPos;
    sel.group.position.lerpVectors(SELECTED_POS, new THREE.Vector3(rp.x, rp.y, rp.z), ease);
    sel.group.scale.setScalar(SELECTED_SCALE + (1.0 - SELECTED_SCALE) * ease);
    sel.group.rotation.y = rp.rotY * ease;

    // Other albums fade back
    for (let i = 0; i < this.albums.length; i++) {
      if (i === this.selectedIndex) continue;
      const a = this.albums[i];
      const rest = a.restPos;
      a.group.visible = true;
      a.group.position.set(
        rest.x + (1.0 - ease) * 4,
        rest.y - (1.0 - ease) * 4,
        rest.z + (1.0 - ease) * 3
      );
      a.group.scale.setScalar(0.4 + ease * 0.6);
      a.coverMat.opacity = ease;
      a.shadowMat.opacity = 0.18 * ease;
    }
  }

  _updateParticles(dt) {
    const pa = this.particles.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const ny = pa.getY(i) + 0.1 * dt;
      pa.setY(i, ny > 5 ? -3 - Math.random() : ny);
    }
    pa.needsUpdate = true;
  }

  // ═══════════════════════════════════════════
  //  Input
  // ═══════════════════════════════════════════

  _onPointerMove(e) {
    const r = this.containerEl.getBoundingClientRect();
    this.mouseNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouseNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    if (this.isPointerDown) {
      if (Math.abs(e.clientX - this._pointerStart.x) > 3 ||
          Math.abs(e.clientY - this._pointerStart.y) > 3) {
        this._pointerMoved = true;
      }
    }
  }

  _onPointerDown(e) {
    this.isPointerDown = true;
    this._pointerMoved = false;
    this._pointerStart.set(e.clientX, e.clientY);
  }

  _onPointerUp() {
    if (this.isPointerDown && !this._pointerMoved) {
      this._handleClick();
    }
    this.isPointerDown = false;
    this._pointerMoved = false;
  }

  _onPointerLeave() {
    this.mouseNDC.set(-999, -999);
    if (this.viewState === 'IDLE') {
      this.hoveredIndex = -1;
      this._updateTargets(-1, 1.0, false);
    }
    this.isPointerDown = false;
  }

  _handleClick() {
    if (this.viewState === 'ALBUM_SELECTED') {
      if (this.hoveredIndex === this.selectedIndex && this.app) {
        this.app.emit('togglePlayPause');
        return;
      }
      this.deselectAlbum();
      return;
    }
    if (this.viewState === 'IDLE' && this.hoveredIndex >= 0) {
      this.selectAlbum(this.hoveredIndex);
    }
  }

  // ═══════════════════════════════════════════
  //  Resize
  // ═══════════════════════════════════════════

  _onResize() { this.resize(); }

  resize() {
    const r = this.containerEl.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
  }
}
