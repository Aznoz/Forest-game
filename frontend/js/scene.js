// 3D scéna: les v mlze, stůl, hráči, levitující revolver, svíčky = životy.
import * as THREE from 'three';
import * as M from './models.js';

const TAU = Math.PI * 2;
const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t,
  lin: (t) => t,
};
const FOG_COLOR = 0x151a1d;
const lerp = (a, b, t) => a + (b - a) * t;

export class Scene3D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.audio = opts.audio || null;
    this.quality = opts.quality ?? 1;          // 0 = nízká, 1 = normální
    this.brightness = opts.brightness ?? 1;
    this.fast = false;                         // přeskakování animací (karta na pozadí)
    this.tweens = [];
    this.particles = [];
    this.seats = new Map();
    this.myId = null;
    this.turnId = null;
    this.t = 0;
    this.size = { w: 1, h: 1 };
    this.shake = 0;
    this.recoil = 0;
    this.camFocus = new THREE.Vector3(0, 0.95, -0.3);
    this.camFocusTarget = new THREE.Vector3(0, 0.95, -0.3);
    this.camZoom = 1;
    this.camZoomTarget = 1;
    this.camDip = 0;
    this.spectate = false;
    this.orbit = 0;
    this.onFrame = null;
    this.onHurt = null;      // (dmg) => void – zásah do lokálního hráče
    this.onFlash = null;     // () => void – záblesk výstřelu na obrazovce
    this.onLightning = null;
    this.onCaw = null;
    this.nextLightning = 35 + Math.random() * 40;
    this.nextCrow = 20 + Math.random() * 25;

    const r = this.renderer = opts.renderer || new THREE.WebGLRenderer({ canvas, antialias: this.quality > 0, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality > 0 ? 1.75 : 1));
    r.shadowMap.enabled = this.quality > 0;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = this.brightness;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(FOG_COLOR);
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.052);
    this.camera = new THREE.PerspectiveCamera(52, 1.7, 0.1, 220);
    this.world = new THREE.Group();
    scene.add(this.world);

    this.buildEnvironment();
    this.buildLights();
    this.buildWorld();
    this.buildGun();
    this.resize();
    this.last = performance.now();
  }

  // ------------------------------------------------------------------ stavba světa
  buildEnvironment() {
    try {
      const pm = new THREE.PMREMGenerator(this.renderer);
      const env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ color: 0x1c242b, side: THREE.BackSide })));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb070).multiplyScalar(7) }));
      lamp.position.set(0, 22, 0); env.add(lamp);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fb4d8).multiplyScalar(3.5) }));
      moon.position.set(-30, 24, -38); env.add(moon);
      const rt = pm.fromScene(env, 0.04);
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = 0.32;
      pm.dispose();
    } catch (err) { console.warn('env map', err); }
  }

  buildLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0x5d6e82, 0x16110c, 0.42);
    s.add(this.hemi);
    this.moonLight = new THREE.DirectionalLight(0x8ea3c6, 0.55);
    this.moonLight.position.set(-12, 18, -14);
    s.add(this.moonLight);

    this.key = new THREE.SpotLight(0xffc88a, 30, 0, Math.PI / 2.7, 0.75, 2);
    this.key.position.set(0, 3.4, 0.1);
    this.key.target.position.set(0, 1, 0);
    this.key.castShadow = this.quality > 0;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0005;
    this.key.shadow.camera.near = 0.6;
    this.key.shadow.camera.far = 10;
    s.add(this.key, this.key.target);

    this.lamp = new THREE.PointLight(0xff9a4a, 5, 10, 2);
    this.lamp.position.set(0, 3.0, 0);
    s.add(this.lamp);

    this.focus = new THREE.SpotLight(0xffffff, 0, 0, 0.34, 0.85, 2);
    this.focus.position.set(0, 4, 0);
    s.add(this.focus, this.focus.target);

    this.flash = new THREE.DirectionalLight(0xbfd0ff, 0);
    this.flash.position.set(4, 12, 8);
    s.add(this.flash);

    this.fxLight = new THREE.PointLight(0xffffff, 0, 6, 2);
    s.add(this.fxLight);

    this.muzzleLight = new THREE.PointLight(0xffb060, 0, 7, 2);
    s.add(this.muzzleLight);
  }

  buildWorld() {
    const w = this.world;
    const q = this.quality;
    this.textures = {
      flame: M.flameTexture(), glow: M.glowTexture(), smoke: M.smokeTexture(), moon: M.moonTexture(),
    };

    // země s mírnými kopečky mimo mýtinu
    const gGeo = new THREE.PlaneGeometry(180, 180, 60, 60);
    gGeo.rotateX(-Math.PI / 2);
    const pos = gGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const k = Math.min(1, Math.max(0, (d - 6) / 14));
      pos.setY(i, k * (Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.5 + Math.sin(x * 0.11 + z * 0.17) * 0.8));
    }
    gGeo.computeVertexNormals();
    const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ map: M.groundTexture(), roughness: 1, color: 0xbfb8a8 }));
    ground.receiveShadow = true;
    w.add(ground);

    w.add(M.makeForest(q > 0 ? 1 : 0.45));

    this.table = M.makeTable();
    w.add(this.table);

    const lantern = M.makeLantern();
    lantern.position.set(0, 3.0, 0);
    w.add(lantern);
    this.lantern = lantern;

    // měsíc na obloze
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures.moon, fog: false, depthWrite: false, transparent: true }));
    moon.scale.set(34, 34, 1);
    moon.position.set(-26, 30, -78);
    w.add(moon);

    // mlha při zemi
    this.mist = [];
    const mistMat = new THREE.SpriteMaterial({ map: this.textures.glow, color: 0x8b9aa2, transparent: true, opacity: 0.09, depthWrite: false });
    const n = q > 0 ? 16 : 7;
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(mistMat);
      const a = Math.random() * TAU, d = 4 + Math.random() * 20;
      sp.position.set(Math.cos(a) * d, 0.5 + Math.random() * 1.2, Math.sin(a) * d);
      const sc = 9 + Math.random() * 10;
      sp.scale.set(sc, sc * 0.35, 1);
      sp.userData = { a, d, sp: 0.02 + Math.random() * 0.03, y: sp.position.y };
      w.add(sp); this.mist.push(sp);
    }

    // poletující prach / světlušky
    const N = q > 0 ? 260 : 90;
    const arr = new Float32Array(N * 3);
    this.dustVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TAU, d = Math.random() * 7;
      arr[i * 3] = Math.cos(a) * d; arr[i * 3 + 1] = 0.4 + Math.random() * 4; arr[i * 3 + 2] = Math.sin(a) * d;
      this.dustVel[i] = 0.02 + Math.random() * 0.06;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.dust = new THREE.Points(dGeo, new THREE.PointsMaterial({
      size: 0.045, map: this.textures.glow, color: 0xd9b27a, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    w.add(this.dust);

    // kůly s lebkami a vrány
    this.crows = [];
    const stakeCount = q > 0 ? 9 : 5;
    for (let i = 0; i < stakeCount; i++) {
      const a = (i / stakeCount) * TAU + 0.3, d = 6.0 + (i % 3) * 0.9;
      const st = M.makeStake();
      st.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      st.rotation.y = -a + 1.2; st.rotation.z = (Math.random() - 0.5) * 0.12;
      w.add(st);
      if (i % 3 === 0) {
        const crow = M.makeCrow();
        crow.userData.home = new THREE.Vector3(st.position.x, 2.26, st.position.z);
        crow.position.copy(crow.userData.home);
        crow.rotation.y = Math.random() * TAU;
        M.setCrowFolded(crow, true);
        crow.userData.state = 'perched';
        w.add(crow); this.crows.push(crow);
      }
    }

    // létající vrána (občasný efekt)
    this.flyCrow = M.makeCrow();
    this.flyCrow.visible = false;
    w.add(this.flyCrow);

    // textury a materiály sdílené pro hráče
    this.barkMat = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 1, map: M.barkTexture() });
    this.flameMat = new THREE.SpriteMaterial({ map: this.textures.flame, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.glowMat = new THREE.SpriteMaterial({ map: this.textures.glow, color: 0xff9a4a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  buildGun() {
    this.gun = M.makeRevolver();
    this.world.add(this.gun);
    this.gunHome = new THREE.Vector3(0, M.TABLE_Y + 0.18, 0);
    this.gunPos = this.gunHome.clone();
    this.gunQ = new THREE.Quaternion();
    this.gunTarget = { pos: this.gunHome.clone(), look: null, yaw: 0, pitch: -0.1 };
    this.gunQTarget = new THREE.Quaternion();
    this.gun.position.copy(this.gunPos);
    this.tmpObj = new THREE.Object3D();
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.textures.glow, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.flashSprite.scale.set(1.4, 1.4, 1);
    this.world.add(this.flashSprite);
    this.shells = [];   // vizuální náboje při nabíjení
    this.doll = M.makeDoll();
    this.doll.visible = false;
    this.world.add(this.doll);
  }

  // ------------------------------------------------------------------ hráči u stolu
  setSeating(players, myId) {
    for (const s of this.seats.values()) {
      this.world.remove(s.fig.root, s.stool, s.candleGroup);
      this.scene.remove(s.light);
    }
    this.seats.clear();
    this.myId = myId;
    const n = players.length;
    const myIdx = Math.max(0, players.findIndex((p) => p.id === myId));
    players.forEach((p, i) => {
      const rel = (i - myIdx + n) % n;
      const th = (rel * TAU) / n;
      const dir = new THREE.Vector3(-Math.sin(th), 0, Math.cos(th));
      const pos = dir.clone().multiplyScalar(M.SEAT_R);

      const fig = M.makeFigure(p.color);
      fig.root.position.copy(pos);
      fig.root.rotation.y = Math.atan2(-dir.x, -dir.z);
      fig.root.userData.seatId = p.id;
      const stool = M.makeStool(this.barkMat);
      stool.position.copy(pos);
      const local = rel === 0;
      fig.root.visible = !local;
      stool.visible = !local;
      this.world.add(fig.root, stool);

      // svíčky = životy
      const candleGroup = new THREE.Group();
      const tangent = new THREE.Vector3(dir.z, 0, -dir.x);
      const candles = [];
      const maxHp = p.maxHp || 4;
      for (let c = 0; c < maxHp; c++) {
        const cm = M.makeCandle();
        const cpos = dir.clone().multiplyScalar(1.3).addScaledVector(tangent, (c - (maxHp - 1) / 2) * 0.17);
        cm.position.set(cpos.x, M.TABLE_Y, cpos.z);
        candleGroup.add(cm);
        const flame = new THREE.Sprite(this.flameMat);
        flame.position.set(cpos.x, M.TABLE_Y + cm.userData.flameY, cpos.z);
        flame.scale.set(0.085, 0.17, 1);
        const glow = new THREE.Sprite(this.glowMat);
        glow.position.copy(flame.position); glow.position.y += 0.02;
        glow.scale.set(0.5, 0.5, 1);
        candleGroup.add(flame, glow);
        candles.push({ flame, glow, lit: true, ph: Math.random() * 10, base: flame.position.clone() });
      }
      this.world.add(candleGroup);
      const light = new THREE.PointLight(0xff9448, 1.5, 4.2, 2);
      light.position.set(dir.x * 1.3, M.TABLE_Y + 0.4, dir.z * 1.3);
      this.scene.add(light);

      this.seats.set(p.id, {
        id: p.id, rel, dir, pos, fig, stool, candles, candleGroup, light, color: p.color,
        hp: maxHp, maxHp, alive: true, lightLevel: 1,
        head: new THREE.Vector3(pos.x, 1.78, pos.z), raised: 0, raisedTarget: 0, lean: 0, leanTarget: 0, hit: 0,
      });
    });
  }

  seat(id) { return this.seats.get(id); }

  setHp(id, hp, quiet = false) {
    const s = this.seat(id);
    if (!s) return;
    s.hp = hp;
    s.candles.forEach((c, i) => {
      const lit = i < hp;
      if (c.lit && !lit) {
        c.lit = false; c.flame.visible = false; c.glow.visible = false;
        if (!quiet) { this.puff(c.base.x, c.base.y, c.base.z, 3, 0.35); this.audio?.play('snuff'); }
      } else if (!c.lit && lit) {
        c.lit = true; c.flame.visible = true; c.glow.visible = true;
        if (!quiet) this.tween(500, (k) => { c.flame.scale.set(0.085 * k, 0.17 * k, 1); }, ease.out);
      }
    });
  }

  setDead(id, quiet = false) {
    const s = this.seat(id);
    if (!s) return;
    s.alive = false;
    this.setHp(id, 0, true);
    s.fig.eyeMat.color.setHex(0x000000);
    if (quiet) { s.leanTarget = 0.75; s.lean = 0.75; s.raisedTarget = -1; }
    else s.leanTarget = 0.75;
  }

  setTurn(id) { this.turnId = id; }

  // ------------------------------------------------------------------ tweeny
  tween(ms, fn, easeFn = ease.inOut) {
    return new Promise((resolve) => {
      if (this.fast || ms <= 0) { fn(1); resolve(); return; }
      this.tweens.push({ t0: performance.now(), ms, fn, easeFn, resolve });
    });
  }
  wait(ms) { return this.tween(ms, () => {}, ease.lin); }
  flushTweens() {
    const list = this.tweens; this.tweens = [];
    for (const tw of list) { tw.fn(tw.easeFn(1)); tw.resolve(); }
  }
  updateTweens(now) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(tw.easeFn(k));
      if (k >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
  }

  // ------------------------------------------------------------------ částice
  puff(x, y, z, count = 5, size = 0.4, color = 0xcfcfcf, life = 1.8) {
    if (this.fast) return;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.textures.smoke, color, transparent: true, opacity: 0.5, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.position.set(x + (Math.random() - 0.5) * 0.08, y, z + (Math.random() - 0.5) * 0.08);
      sp.scale.setScalar(size * 0.5);
      this.world.add(sp);
      this.particles.push({
        sp, mat, age: 0, life: life * (0.7 + Math.random() * 0.6), size,
        vx: (Math.random() - 0.5) * 0.25, vy: 0.25 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.25, grow: 1.8 + Math.random(), op: 0.5,
      });
    }
  }
  burst(x, y, z, color, count = 10, speed = 1.4, size = 0.09, life = 0.9, gravity = 2.2, additive = false) {
    if (this.fast) return;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.textures.glow, color, transparent: true, opacity: 0.9, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const sp = new THREE.Sprite(mat);
      sp.position.set(x, y, z); sp.scale.setScalar(size);
      this.world.add(sp);
      const a = Math.random() * TAU, e = Math.random() * 1.2;
      this.particles.push({
        sp, mat, age: 0, life: life * (0.6 + Math.random() * 0.6), size, grow: 0.2, op: 0.9, g: gravity,
        vx: Math.cos(a) * Math.cos(e) * speed * Math.random(), vy: Math.sin(e) * speed * (0.4 + Math.random()), vz: Math.sin(a) * Math.cos(e) * speed * Math.random(),
      });
    }
  }
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { this.world.remove(p.sp); p.mat.dispose(); this.particles.splice(i, 1); continue; }
      p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt;
      if (p.g) p.vy -= p.g * dt;
      p.sp.scale.setScalar(p.size * (1 + k * p.grow));
      p.mat.opacity = p.op * (1 - k) * (1 - k);
    }
  }

  // ------------------------------------------------------------------ revolver
  gunWorldMuzzle(out = new THREE.Vector3()) {
    this.gun.userData.muzzle.getWorldPosition(out);
    return out;
  }

  /** Revolver přijede k střelci a zamíří (plynule, přes smoothing v update). */
  aim(shooterId, targetId) {
    const S = this.seat(shooterId), T = this.seat(targetId);
    if (!S || !T) return;
    const self = shooterId === targetId;
    const pos = new THREE.Vector3();
    if (self) pos.set(S.dir.x * 1.35, 1.48, S.dir.z * 1.35);
    else pos.set(S.dir.x * 0.65, M.TABLE_Y + 0.34, S.dir.z * 0.65);
    const look = T.head.clone().add(new THREE.Vector3(0, -0.05, 0));
    this.gunTarget = { pos, look };
  }
  aimPreview(targetId) {
    const T = targetId ? this.seat(targetId) : null;
    if (!T) { this.gunTarget = { pos: this.gunHome.clone(), look: null, yaw: 0, pitch: -0.1 }; return; }
    this.gunTarget = { pos: this.gunHome.clone().add(new THREE.Vector3(0, 0.06, 0)), look: T.head.clone().add(new THREE.Vector3(0, -0.25, 0)) };
  }
  releaseGun() {
    this.gunTarget = { pos: this.gunHome.clone(), look: null, yaw: 0, pitch: -0.1 };
    this.camFocusTarget.set(0, 0.95, -0.3);
    this.camZoomTarget = 1;
  }
  focusCamera(point, zoom = 0.92) {
    this.camFocusTarget.copy(point);
    this.camZoomTarget = zoom;
  }
  cock(ms = 350) {
    const h = this.gun.userData.hammer;
    return this.tween(ms, (k) => { h.rotation.x = lerp(-0.35, -1.0, k); }, ease.out);
  }
  dropHammer() {
    const h = this.gun.userData.hammer;
    return this.tween(70, (k) => { h.rotation.x = lerp(-1.0, -0.2, k); }, ease.in).then(() => { h.rotation.x = -0.35; });
  }
  advanceDrum(count = 1, ms = 220) {
    const d = this.gun.userData.drum;
    const from = d.rotation.z;
    return this.tween(ms, (k) => { d.rotation.z = from + (Math.PI / 3) * count * k; }, ease.out);
  }
  spinDrum(turns = 3, ms = 1500) {
    const d = this.gun.userData.drum;
    const from = d.rotation.z;
    return this.tween(ms, (k) => { d.rotation.z = from + TAU * turns * k; }, ease.out);
  }

  setArms(id, amount) { const s = this.seat(id); if (s) s.raisedTarget = amount; }

  /** Záblesk a zpětný ráz živého výstřelu. */
  muzzleFlash(saw = false) {
    const m = this.gunWorldMuzzle();
    this.muzzleLight.position.copy(m);
    this.muzzleLight.intensity = saw ? 70 : 45;
    this.flashSprite.position.copy(m);
    this.flashSprite.material.opacity = 1;
    this.flashSprite.scale.set(1.5, 1.5, 1);
    this.recoil = 1;
    this.shake = Math.max(this.shake, saw ? 1.4 : 1);
    this.puff(m.x, m.y, m.z, 7, 0.55, 0xb9b9b9, 2.6);
    this.burst(m.x, m.y, m.z, 0xffc070, 8, 3, 0.07, 0.35, 0, true);
    this.onFlash?.();
  }

  /** Jeden náboj: živý = rána, slepý = cvak. */
  async fireRound(live, saw = false) {
    if (live) {
      this.audio?.play('shot');
      this.muzzleFlash(saw);
    } else {
      this.audio?.play('click');
      this.recoil = Math.max(this.recoil, 0.12);
    }
    await this.dropHammer();
    this.advanceDrum(1, 180);
  }

  /** Reakce postavy na zásah. */
  hitReaction(targetId, dmg, killed) {
    const T = this.seat(targetId);
    if (!T) return;
    if (T.rel === 0) {
      this.shake = Math.max(this.shake, 1.6);
      this.onHurt?.(dmg);
      return;
    }
    T.hit = 1;
    this.burst(T.head.x, T.head.y, T.head.z, 0x5a0d09, 14, 1.6, 0.11, 1.1, 3.2, false);
    this.burst(T.head.x, T.head.y, T.head.z, 0x2a0504, 8, 1.0, 0.16, 1.4, 2.6, false);
  }

  amuletBreak(targetId) {
    const T = this.seat(targetId);
    if (!T) return;
    this.burst(T.head.x, T.head.y - 0.2, T.head.z, 0xd8d0b8, 14, 1.8, 0.07, 1.0, 3, false);
    this.pulse(targetId, 0xcfd8e8, 600, 6);
  }

  /** Krátký barevný záblesk světla nad hráčem (nebo nad zbraní, když id == null). */
  pulse(id, color, ms = 700, intensity = 9) {
    const s = id ? this.seat(id) : null;
    const p = s ? new THREE.Vector3(s.pos.x * 0.85, 2.0, s.pos.z * 0.85) : new THREE.Vector3(0, M.TABLE_Y + 0.6, 0);
    this.fxLight.position.copy(p);
    this.fxLight.color.setHex(color);
    return this.tween(ms, (k) => { this.fxLight.intensity = intensity * Math.sin(Math.PI * Math.min(1, k)); }, ease.lin);
  }

  /** Panenka voodoo se vznese nad hráčem a probodne se. */
  async voodooDoll(targetId) {
    const T = this.seat(targetId);
    if (!T) return;
    this.doll.visible = true;
    this.doll.position.set(T.head.x * 0.85, 2.3, T.head.z * 0.85);
    this.pulse(targetId, 0x6ea06a, 1400, 8);
    await this.tween(1300, (k) => {
      this.doll.rotation.y = k * 7;
      this.doll.position.y = 2.1 + Math.sin(k * Math.PI) * 0.35;
      this.doll.scale.setScalar(Math.min(1, k * 4) * (1 - Math.max(0, k - 0.85) * 6.6));
    }, ease.lin);
    this.doll.visible = false;
  }

  /** Vyhozená nábojnice (efekt karty "vytřást komoru"). */
  async ejectShell(live) {
    const b = M.makeBullet(live);
    const m = new THREE.Vector3(); this.gun.getWorldPosition(m);
    b.position.copy(m).add(new THREE.Vector3(0, 0.1, 0));
    this.world.add(b);
    const vx = (Math.random() - 0.5) * 0.9, vz = 0.4 + Math.random() * 0.6;
    await this.tween(1100, (k) => {
      const t = k * 1.1;
      b.position.set(m.x + vx * t, m.y + 0.1 + 1.9 * t - 3.6 * t * t, m.z + vz * t);
      b.rotation.set(k * 14, k * 5, k * 9);
    }, ease.lin);
    this.world.remove(b);
  }

  /** Vrána letí od jednoho hráče k druhému (krádež karty). */
  async crowFlight(fromId, toId) {
    const A = this.seat(fromId), B = this.seat(toId);
    if (!A || !B) return;
    const c = this.flyCrow;
    c.visible = true;
    await this.tween(1300, (k) => {
      const x = lerp(A.pos.x, B.pos.x, k), z = lerp(A.pos.z, B.pos.z, k);
      c.position.set(x, 1.7 + Math.sin(k * Math.PI) * 1.2, z);
      c.lookAt(B.pos.x, 1.7, B.pos.z);
      M.setCrowFolded(c, false, Math.sin(k * 40) * 0.7);
    }, ease.inOut);
    c.visible = false;
  }

  /** Nabíjení: náboje se ukážou (ostré červené, slepé šedé) a zapadnou do válce. */
  async loadBullets(live, blank, cb = {}) {
    for (const s of this.shells) this.world.remove(s);
    this.shells = [];
    const list = [];
    for (let i = 0; i < live; i++) list.push(true);
    for (let i = 0; i < blank; i++) list.push(false);
    const n = list.length;
    const y0 = M.TABLE_Y + 0.95;
    list.forEach((isLive, i) => {
      const b = M.makeBullet(isLive);
      b.position.set((i - (n - 1) / 2) * 0.17, y0, 0.55);
      b.scale.setScalar(0.001);
      this.world.add(b);
      this.shells.push(b);
    });
    // objevení
    for (let i = 0; i < n; i++) {
      const b = this.shells[i];
      this.tween(260, (k) => b.scale.setScalar(Math.max(0.001, 1.7 * k)), ease.out);
      cb.onAppear?.(i, list[i]);
      await this.wait(this.fast ? 0 : 130);
    }
    await this.wait(900);
    // zapadnutí do válce
    const drumPos = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const b = this.shells[i];
      this.gun.userData.drum.getWorldPosition(drumPos);
      const from = b.position.clone();
      cb.onInsert?.(i);
      this.advanceDrum(1, 160);
      await this.tween(190, (k) => {
        b.position.lerpVectors(from, drumPos, k);
        b.scale.setScalar(Math.max(0.001, 1.7 * (1 - k * 0.8)));
      }, ease.in);
      this.world.remove(b);
    }
    this.shells = [];
    this.gun.userData.drum.rotation.z = 0;
    this.recoil = Math.max(this.recoil, 0.25);
  }

  // ------------------------------------------------------------------ pickování myší
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const roots = [];
    for (const s of this.seats.values()) if (s.rel !== 0 && s.alive) roots.push(s.fig.root);
    const hits = ray.intersectObjects(roots, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !(o.userData && o.userData.seatId)) o = o.parent;
    return o ? o.userData.seatId : null;
  }

  /** Souřadnice nad hlavou hráče na obrazovce (pro jmenovky). */
  screenPos(id, yOffset = 2.25) {
    const s = this.seat(id);
    if (!s || s.rel === 0) return null;
    const v = new THREE.Vector3(s.pos.x, yOffset, s.pos.z).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.size.w, y: (-v.y * 0.5 + 0.5) * this.size.h, visible: v.z < 1 && v.z > -1 };
  }

  // ------------------------------------------------------------------ smyčka
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setBrightness(v) { this.brightness = v; this.renderer.toneMappingExposure = v; }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt, now);
      this.renderer.render(this.scene, this.camera);
      this.onFrame?.();
    };
    this.last = performance.now();
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); }

  update(dt, nowMs) {
    this.t += dt;
    const t = this.t;
    this.updateTweens(nowMs);
    this.updateParticles(dt);

    // --- revolver (plynulé dojíždění k cíli + vznášení + zpětný ráz)
    const gt = this.gunTarget;
    const bob = Math.sin(t * 1.3) * 0.018;
    const kPos = 1 - Math.exp(-dt * 4.5);
    const tp = gt.pos;
    this.gunPos.lerp(new THREE.Vector3(tp.x, tp.y + bob, tp.z), kPos);
    this.tmpObj.position.copy(this.gunPos);
    if (gt.look) {
      this.tmpObj.lookAt(gt.look);
    } else {
      // klidová poloha: leží napříč směrem k hráči na tahu a pomalu se pohupuje
      const cur = this.turnId ? this.seat(this.turnId) : null;
      const base = cur ? Math.atan2(cur.dir.x, cur.dir.z) + Math.PI / 2 : 0;
      this.tmpObj.rotation.set(-0.1, base + Math.sin(t * 0.4) * 0.12, 0);
    }
    this.gunQTarget.copy(this.tmpObj.quaternion);
    this.gunQ.slerp(this.gunQTarget, 1 - Math.exp(-dt * 5.5));
    this.recoil *= Math.exp(-dt * 7);
    const kick = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.recoil * 0.4);
    this.gun.quaternion.copy(this.gunQ).multiply(kick);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.gunQ);
    this.gun.position.copy(this.gunPos).addScaledVector(fwd, -this.recoil * 0.13);

    // záblesky doznívají
    this.muzzleLight.intensity *= Math.exp(-dt * 16);
    if (this.flashSprite.material.opacity > 0) {
      this.flashSprite.material.opacity = Math.max(0, this.flashSprite.material.opacity - dt * 6);
      this.flashSprite.scale.multiplyScalar(1 + dt * 4);
    }
    this.flash.intensity *= Math.exp(-dt * 7);

    // --- hráči
    for (const s of this.seats.values()) {
      const isTurn = s.id === this.turnId && s.alive;
      // svíčky
      s.candles.forEach((c) => {
        if (!c.lit) return;
        const f = 1 + 0.12 * Math.sin(t * 9 + c.ph) + 0.08 * Math.sin(t * 17 + c.ph * 2);
        const boost = isTurn ? 1.25 : 1;
        c.flame.scale.set(0.085 * (1 + 0.05 * Math.sin(t * 13 + c.ph)) * boost, 0.17 * f * boost, 1);
        c.flame.position.x = c.base.x + Math.sin(t * 5 + c.ph) * 0.003;
        c.glow.material.opacity = 0.5;
      });
      // světlo svíček slábne s počtem životů
      const lightTarget = s.alive ? 0.25 + 0.4 * s.hp + (isTurn ? 0.5 : 0) : 0;
      s.light.intensity = lerp(s.light.intensity, lightTarget * (1 + 0.1 * Math.sin(t * 7 + s.pos.x)), 1 - Math.exp(-dt * 4));
      // oči
      const eyeK = !s.alive ? 0 : (isTurn ? 1.6 + 0.4 * Math.sin(t * 8) : 0.7 + 0.15 * Math.sin(t * 2 + s.pos.z));
      s.fig.eyeMat.color.setHex(M.PLAYER_COLORS[s.color % 4]).multiplyScalar(eyeK);
      // dýchání, předklon, ruce
      const breathe = Math.sin(t * 1.6 + s.pos.x) * 0.012;
      s.leanTarget = s.alive ? (isTurn ? 0.1 : 0.0) : 0.75;
      s.lean = lerp(s.lean, s.leanTarget, 1 - Math.exp(-dt * (s.alive ? 3 : 2)));
      s.hit = Math.max(0, s.hit - dt * 3);
      s.fig.body.rotation.x = s.lean + breathe - s.hit * 0.35;
      s.fig.head.rotation.x = s.alive ? Math.sin(t * 0.7 + s.pos.z) * 0.03 + s.hit * 0.3 : 0.45;
      s.fig.head.rotation.y = s.alive ? Math.sin(t * 0.5 + s.pos.x * 2) * 0.1 : 0;
      s.raised = lerp(s.raised, s.raisedTarget, 1 - Math.exp(-dt * 5));
      const armRot = lerp(-1.02, -1.5, Math.max(0, s.raised)) + (s.raised < 0 ? s.raised * 0.4 : 0);
      for (const a of s.fig.arms) a.rotation.x = armRot;
    }

    // --- světlo na hráči, který je na tahu
    const cur = this.turnId ? this.seat(this.turnId) : null;
    if (cur && cur.alive && cur.rel !== 0) {
      this.focus.color.setHex(M.PLAYER_COLORS[cur.color % 4]).lerp(new THREE.Color(0xffffff), 0.55);
      this.focus.position.set(cur.dir.x * 1.2, 4.2, cur.dir.z * 1.2);
      this.focus.target.position.copy(cur.head).add(new THREE.Vector3(0, -0.25, 0));
      this.focus.intensity = lerp(this.focus.intensity, 26, 1 - Math.exp(-dt * 3));
    } else this.focus.intensity = lerp(this.focus.intensity, 0, 1 - Math.exp(-dt * 4));

    // --- lucerna se mírně houpe a bliká
    this.lantern.rotation.z = Math.sin(t * 0.7) * 0.02;
    this.lamp.intensity = 5 * (1 + 0.07 * Math.sin(t * 6.3) + 0.05 * Math.sin(t * 11.1));

    // --- mlha, prach
    for (const m of this.mist) {
      m.userData.a += m.userData.sp * dt * 0.1;
      m.position.x = Math.cos(m.userData.a) * m.userData.d;
      m.position.z = Math.sin(m.userData.a) * m.userData.d;
    }
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + this.dustVel[i] * dt;
      if (y > 4.6) y = 0.4;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.5 + i) * 0.04 * dt);
    }
    pos.needsUpdate = true;

    // --- blesk
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = 45 + Math.random() * 70;
      this.lightning();
    }
    // --- vrány
    this.nextCrow -= dt;
    if (this.nextCrow <= 0) {
      this.nextCrow = 25 + Math.random() * 40;
      this.crowTakeoff();
    }
    for (const c of this.crows) {
      if (c.userData.state === 'perched') c.rotation.y += Math.sin(t * 0.3 + c.position.x) * 0.002;
    }

    this.updateCamera(dt, t);
  }

  lightning() {
    if (this.fast) return;
    const seq = [[0, 5], [110, 0.6], [200, 7.5]];
    seq.forEach(([ms, v]) => setTimeout(() => { this.flash.intensity = v; }, ms));
    this.onLightning?.();
  }

  crowTakeoff() {
    if (this.fast) return;
    const c = this.crows.find((x) => x.userData.state === 'perched');
    if (!c) return;
    c.userData.state = 'flying';
    this.onCaw?.();
    const home = c.userData.home.clone();
    const dirOut = new THREE.Vector3(home.x, 0, home.z).normalize();
    const side = new THREE.Vector3(-dirOut.z, 0, dirOut.x);
    const sgn = Math.random() < 0.5 ? -1 : 1;
    this.tween(4200, (k) => {
      M.setCrowFolded(c, false, Math.sin(k * 90) * 0.75);
      c.position.set(
        home.x + dirOut.x * k * 36 + side.x * sgn * k * 14,
        home.y + k * 11 + Math.sin(k * 5) * 0.4,
        home.z + dirOut.z * k * 36 + side.z * sgn * k * 14,
      );
      c.lookAt(c.position.x + dirOut.x, c.position.y + 0.2, c.position.z + dirOut.z);
    }, ease.lin).then(() => {
      c.visible = false;
      setTimeout(() => {
        c.position.copy(home); M.setCrowFolded(c, true); c.visible = true; c.userData.state = 'perched';
      }, 30000);
    });
  }

  updateCamera(dt, t) {
    const cam = this.camera;
    const asp = cam.aspect;
    const baseFov = asp < 1 ? Math.min(74, 52 + (1 - asp) * 40) : 52;
    const tanH = Math.tan((baseFov * Math.PI) / 360) * asp;
    const dist = Math.min(11, Math.max(4.9, 3.3 / tanH));
    const pitch = 0.28 + (asp < 1 ? 0.14 * (1 - asp) : 0);

    this.camFocus.lerp(this.camFocusTarget, 1 - Math.exp(-dt * 2.4));
    this.camZoom = lerp(this.camZoom, this.camZoomTarget, 1 - Math.exp(-dt * 2.4));

    const look = this.camFocus.clone();
    const base = new THREE.Vector3(0, 0.95 + Math.sin(pitch) * dist, -0.3 + Math.cos(pitch) * dist);
    if (this.spectate) {
      this.orbit += dt * 0.07;
      base.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.orbit);
    }
    this.camDip = lerp(this.camDip, this.localDead ? 1 : 0, 1 - Math.exp(-dt * 1.5));
    const sway = new THREE.Vector3(Math.sin(t * 0.31) * 0.05, Math.sin(t * 0.23) * 0.035, Math.cos(t * 0.27) * 0.04);
    this.shake *= Math.exp(-dt * 5);
    const sh = this.shake * 0.05;
    sway.x += (Math.random() - 0.5) * sh; sway.y += (Math.random() - 0.5) * sh; sway.z += (Math.random() - 0.5) * sh;
    cam.position.copy(base).add(sway);
    cam.position.y -= this.camDip * 0.5;
    cam.lookAt(look);
    cam.rotation.z += this.camDip * 0.1 + (Math.random() - 0.5) * sh * 0.3;
    const fov = baseFov * this.camZoom;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }
}
