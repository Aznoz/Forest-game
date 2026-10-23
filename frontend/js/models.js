// Procedurální 3D modely a textury (žádné externí soubory – všechno je vytvořené kódem).
import * as THREE from 'three';

export const PLAYER_COLORS = [0xb0533a, 0x7d9a52, 0x5b8aa6, 0xcfa83f]; // rez, mech, špinavá modř, okr
export const TABLE_Y = 1.0;       // výška desky stolu
export const SEAT_R = 2.5;        // vzdálenost hráčů od středu
export const TABLE_R = 1.85;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ textury
export function groundTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#1b1814'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const x = r() * w, y = r() * h, v = r();
      g.fillStyle = v < 0.45 ? `rgba(8,7,5,${0.25 + r() * 0.4})`
        : v < 0.8 ? `rgba(78,66,48,${0.08 + r() * 0.16})`
          : `rgba(48,62,40,${0.08 + r() * 0.14})`;
      g.fillRect(x, y, 1 + r() * 3, 1 + r() * 2);
    }
    for (let i = 0; i < 300; i++) { // suché listí
      g.save();
      g.translate(r() * w, r() * h);
      g.rotate(r() * 6.28);
      g.fillStyle = `rgba(${(70 + r() * 40) | 0},${(48 + r() * 25) | 0},${(22 + r() * 15) | 0},${0.25 + r() * 0.3})`;
      g.beginPath(); g.ellipse(0, 0, 3 + r() * 5, 1.5 + r() * 2.5, 0, 0, 6.28); g.fill();
      g.restore();
    }
  }, { repeat: [28, 28] });
}

export function tableTopTexture() {
  return canvasTexture(1024, 1024, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#33271c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { // prkna
      const y = (i * h) / 9;
      g.fillStyle = `rgba(0,0,0,${0.14 + r() * 0.1})`; g.fillRect(0, y, w, 3);
      for (let k = 0; k < 22; k++) {
        g.strokeStyle = `rgba(${(20 + r() * 30) | 0},${(14 + r() * 20) | 0},${(8 + r() * 10) | 0},${0.15 + r() * 0.25})`;
        g.lineWidth = 1 + r() * 1.5;
        g.beginPath();
        const yy = y + r() * (h / 9);
        g.moveTo(0, yy);
        for (let x = 0; x <= w; x += 64) g.lineTo(x, yy + Math.sin(x * 0.01 + k) * 3);
        g.stroke();
      }
    }
    for (let i = 0; i < 30; i++) { // skvrny
      g.fillStyle = `rgba(10,5,3,${0.08 + r() * 0.12})`;
      g.beginPath(); g.arc(r() * w, r() * h, 10 + r() * 50, 0, 6.28); g.fill();
    }
    // okultní znak
    const cx = w / 2, cy = h / 2;
    g.strokeStyle = 'rgba(125,30,24,0.55)';
    g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, w * 0.4, 0, 6.28); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, w * 0.435, 0, 6.28); g.stroke();
    g.lineWidth = 5; g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = cx + Math.cos(a) * w * 0.4, y = cy + Math.sin(a) * w * 0.4;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 24; i++) { // runy
      const a = (i * Math.PI * 2) / 24, rr = w * 0.418;
      g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(a + Math.PI / 2);
      g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12);
      if (r() < 0.6) { g.moveTo(0, -4); g.lineTo(8, -10); }
      if (r() < 0.5) { g.moveTo(0, 4); g.lineTo(-8, 10); }
      g.stroke(); g.restore();
    }
    for (let i = 0; i < 10; i++) { // šrámy od nožů
      g.strokeStyle = `rgba(0,0,0,${0.25 + r() * 0.2})`; g.lineWidth = 1 + r() * 2;
      g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 120); g.stroke();
    }
  });
}

export function sackTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rng(21);
    g.fillStyle = '#7b6d53'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,200'},${0.04 + r() * 0.06})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,240,200'},${0.04 + r() * 0.06})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(30,20,10,${r() * 0.25})`; g.fillRect(r() * w, r() * h, 2, 2); }
    const cx = w * 0.25, cy = h * 0.5; // střed obličeje (u = 0.25 je "přední" strana koule)
    g.fillStyle = '#050403';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * w * 0.034, cy - h * 0.02, w * 0.018, h * 0.028, 0, 0, 6.28); g.fill(); }
    g.strokeStyle = '#0c0a07'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - w * 0.045, cy + h * 0.1); g.lineTo(cx + w * 0.045, cy + h * 0.1); g.stroke();
    for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.01, cy + h * 0.082); g.lineTo(cx + i * w * 0.01 + 3, cy + h * 0.118); g.stroke(); }
    g.strokeStyle = 'rgba(15,10,5,0.6)'; g.lineWidth = 2; // šev přes hlavu
    g.beginPath(); g.moveTo(cx + w * 0.07, h * 0.2); g.lineTo(cx + w * 0.07, h * 0.8); g.stroke();
    for (let y = h * 0.22; y < h * 0.78; y += 14) { g.beginPath(); g.moveTo(cx + w * 0.06, y); g.lineTo(cx + w * 0.08, y + 6); g.stroke(); }
  });
}

export function barkTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    const r = rng(33);
    g.fillStyle = '#1d1711'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${r() < 0.5 ? '5,4,3' : '70,58,44'},${0.15 + r() * 0.35})`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10, h); g.stroke();
    }
  }, { repeat: [1, 2] });
}

export function flameTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.7, h * 0.45);
    grd.addColorStop(0, 'rgba(255,250,215,1)');
    grd.addColorStop(0.3, 'rgba(255,196,96,0.95)');
    grd.addColorStop(0.7, 'rgba(225,95,25,0.5)');
    grd.addColorStop(1, 'rgba(120,30,0,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.bezierCurveTo(w * 0.98, h * 0.5, w * 0.88, h * 0.97, w / 2, h * 0.97);
    g.bezierCurveTo(w * 0.12, h * 0.97, w * 0.02, h * 0.5, w / 2, 4);
    g.fill();
  });
}

export function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}

export function smokeTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const r = rng(8);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (r() - 0.5) * 40, y = h / 2 + (r() - 0.5) * 40, rad = 18 + r() * 24;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(210,210,210,0.22)'); grd.addColorStop(1, 'rgba(210,210,210,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }
  });
}

export function moonTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const halo = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    halo.addColorStop(0, 'rgba(190,205,230,0.55)'); halo.addColorStop(0.35, 'rgba(120,140,175,0.16)'); halo.addColorStop(1, 'rgba(60,80,120,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9d2de'; g.beginPath(); g.arc(w / 2, h / 2, 34, 0, 6.28); g.fill();
    const r = rng(2);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(110,125,150,${0.2 + r() * 0.25})`; g.beginPath(); g.arc(w / 2 + (r() - 0.5) * 44, h / 2 + (r() - 0.5) * 44, 3 + r() * 7, 0, 6.28); g.fill(); }
  });
}

// ------------------------------------------------------------------ pomocné konstrukce
function limb(a, b, r0, r1, mat, seg = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ revolver
export function makeRevolver() {
  const gun = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4f53, metalness: 0.85, roughness: 0.38 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x25282a, metalness: 0.8, roughness: 0.45 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3d2514, roughness: 0.65, metalness: 0.05 });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.24), steel);
  frame.position.set(0, 0, -0.03); gun.add(frame);

  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.26), steel);
  strap.position.set(0, 0.088, 0.1); gun.add(strap);

  // válec (otáčí se kolem osy z)
  const drumPivot = new THREE.Group();
  drumPivot.position.set(0, 0.018, 0.13);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.14, 24), steel);
  drum.rotation.x = Math.PI / 2;
  drumPivot.add(drum);
  for (let i = 0; i < 6; i++) { // komory
    const a = (i * Math.PI) / 3;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.1425, 10), black);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0);
    drumPivot.add(hole);
    const flute = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, 0.1), darkSteel);
    const fa = a + Math.PI / 6;
    flute.position.set(Math.cos(fa) * 0.084, Math.sin(fa) * 0.084, 0);
    flute.rotation.z = fa;
    drumPivot.add(flute);
  }
  gun.add(drumPivot);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.031, 0.52, 16), darkSteel);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.048, 0.43); gun.add(barrel);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 8), darkSteel);
  rod.rotation.x = Math.PI / 2; rod.position.set(0, -0.004, 0.37); gun.add(rod);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.022, 0.02), darkSteel);
  sight.position.set(0, 0.088, 0.66); gun.add(sight);
  const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0205, 0.005, 12), black);
  muzzleRing.rotation.x = Math.PI / 2; muzzleRing.position.set(0, 0.048, 0.692); gun.add(muzzleRing);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.2, 0.095), wood);
  grip.position.set(0, -0.135, -0.115); grip.rotation.x = 0.38; gun.add(grip);

  const hammerPivot = new THREE.Group();
  hammerPivot.position.set(0, 0.092, -0.14);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.032), steel);
  hammer.position.y = 0.035;
  hammerPivot.add(hammer);
  hammerPivot.rotation.x = -0.35;
  gun.add(hammerPivot);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.02), darkSteel);
  trigger.position.set(0, -0.07, -0.02); trigger.rotation.x = 0.3; gun.add(trigger);
  const guardGeo = new THREE.TorusGeometry(0.05, 0.007, 6, 14, Math.PI);
  guardGeo.rotateY(Math.PI / 2); guardGeo.rotateX(Math.PI);
  const guard = new THREE.Mesh(guardGeo, steel);
  guard.position.set(0, -0.045, 0.0); gun.add(guard);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.048, 0.7);
  gun.add(muzzle);

  gun.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  gun.userData = { drum: drumPivot, hammer: hammerPivot, muzzle, trigger };
  return gun;
}

// ------------------------------------------------------------------ náboj (pro animaci nabíjení)
export function makeBullet(live) {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3c, metalness: 0.8, roughness: 0.35 });
  const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0165, 0.048, 12), brass);
  g.add(casing);
  if (live) {
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.0138, 0.038, 12),
      new THREE.MeshStandardMaterial({ color: 0xa5532c, metalness: 0.6, roughness: 0.4, emissive: 0x5a0d05, emissiveIntensity: 0.9 }),
    );
    tip.position.y = 0.043; g.add(tip);
  } else {
    const wad = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0138, 0.01, 12), new THREE.MeshStandardMaterial({ color: 0x2b2a27, roughness: 1 }));
    wad.position.y = 0.028; g.add(wad);
  }
  g.scale.setScalar(1.7);
  return g;
}

// ------------------------------------------------------------------ svíčka
export function makeCandle() {
  const g = new THREE.Group();
  const wax = new THREE.MeshStandardMaterial({ color: 0xcfc4a0, roughness: 0.85 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.7, metalness: 0.5 });
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.016, 12), iron);
  dish.position.y = 0.008; g.add(dish);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.17, 10), wax);
  body.position.y = 0.1; g.add(body);
  const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.03, 10), wax);
  drip.position.y = 0.03; g.add(drip);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 4), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  wick.position.y = 0.2; g.add(wick);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.flameY = 0.235;
  return g;
}

// ------------------------------------------------------------------ stolička
export function makeStool(barkMat) {
  const g = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.31, 0.52, 10), barkMat);
  log.position.y = 0.26; g.add(log);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x4a3825, roughness: 0.9 }));
  top.position.y = 0.52; g.add(top);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ------------------------------------------------------------------ stůl
export function makeTable() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2c2118, roughness: 0.9 });
  const top = new THREE.MeshStandardMaterial({ map: tableTopTexture(), roughness: 0.82, color: 0xd8d0c4 });
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.14, 56), [wood, top, wood]);
  tableTop.position.y = TABLE_Y - 0.07;
  tableTop.castShadow = true; tableTop.receiveShadow = true;
  g.add(tableTop);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.95, 12), wood);
  trunk.position.y = 0.48; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 5; i++) { // kořeny
    const a = (i * Math.PI * 2) / 5 + 0.3;
    const root = limb(V(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25), V(Math.cos(a) * 1.0, 0.02, Math.sin(a) * 1.0), 0.13, 0.04, wood, 6);
    g.add(root);
  }

  // pytlovina uprostřed
  const cloth = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 40),
    new THREE.MeshStandardMaterial({ map: sackTexture(), color: 0x6a5c46, roughness: 1 }),
  );
  cloth.rotation.x = -Math.PI / 2; cloth.position.y = TABLE_Y + 0.003; cloth.receiveShadow = true;
  g.add(cloth);

  // kosti a lebky na stole
  const bone = new THREE.MeshStandardMaterial({ color: 0xb7ac92, roughness: 0.85 });
  const r = rng(3);
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d = 0.95 + r() * 0.7;
    const p = V(Math.cos(a) * d, TABLE_Y + 0.012, Math.sin(a) * d);
    const bn = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11 + r() * 0.06, 6), bone);
    bn.rotation.z = Math.PI / 2; bn.rotation.y = r() * 3; bn.position.copy(p); bn.castShadow = true;
    g.add(bn);
  }
  return g;
}

// ------------------------------------------------------------------ lucerna na řetězu
export function makeLantern() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.6, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a1405, emissive: 0xff9a3c, emissiveIntensity: 2.2, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), glass);
  g.add(body);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), iron);
    bar.position.set(sx * 0.105, 0, sz * 0.105); g.add(bar);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), iron);
  roof.position.y = 0.2; roof.rotation.y = Math.PI / 4; g.add(roof);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.03, 0.23), iron);
  base.position.y = -0.155; g.add(base);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 8, 4), iron);
  chain.position.y = 4.26; g.add(chain);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 5, 10), iron);
  ring.position.y = 0.28; g.add(ring);
  return g;
}

// ------------------------------------------------------------------ postava u stolu
export function makeFigure(colorIdx) {
  const color = PLAYER_COLORS[colorIdx % 4];
  const kind = colorIdx % 4;
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.55;                 // pivot v bocích (kvůli předklonu / zhroucení)
  root.add(body);

  const cloth = new THREE.MeshStandardMaterial({ color: 0x1b1917, roughness: 1 });
  const scarfMat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xcfc6ae, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });

  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.46, 1.15, 14), cloth);
  robe.position.y = 0.4; body.add(robe);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), cloth);
  shoulders.scale.set(0.36, 0.2, 0.24); shoulders.position.y = 0.92; body.add(shoulders);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 18), scarfMat);
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.0; body.add(scarf);
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.07, 14), scarfMat); // pásek
  sash.position.y = 0.2; body.add(sash);

  const head = new THREE.Group();
  head.position.y = 1.2; body.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color });
  const eyes = [];
  const addEyes = (x, y, z, r = 0.02) => {
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), eyeMat);
      e.position.set(s * x, y, z); head.add(e); eyes.push(e);
    }
  };
  const hood = () => {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.45, 14), cloth);
    h.position.set(0, 0.2, -0.04); h.rotation.x = -0.2; head.add(h);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), cloth);
    back.position.set(0, -0.02, -0.07); head.add(back);
  };

  if (kind === 0) { // pytel na hlavě + klobouk
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ map: sackTexture(), roughness: 1 }));
    sack.scale.set(1, 1.08, 1); head.add(sack);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.025, 20), cloth);
    brim.position.y = 0.16; head.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.175, 0.22, 16), cloth);
    crown.position.y = 0.27; head.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.04, 16), scarfMat);
    band.position.y = 0.2; head.add(band);
    addEyes(0.068, 0.0, 0.192);
  } else if (kind === 1) { // pytel + paroží
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ map: sackTexture(), roughness: 1 }));
    sack.scale.set(1, 1.08, 1); head.add(sack);
    hood();
    for (const s of [-1, 1]) {
      const pts = [V(s * 0.1, 0.17, -0.02), V(s * 0.19, 0.38, -0.04), V(s * 0.25, 0.6, 0), V(s * 0.19, 0.8, 0.03)];
      for (let i = 0; i < pts.length - 1; i++) head.add(limb(pts[i], pts[i + 1], 0.022 - i * 0.004, 0.018 - i * 0.004, bone, 5));
      head.add(limb(pts[1], V(s * 0.36, 0.5, -0.02), 0.015, 0.008, bone, 5));
      head.add(limb(pts[2], V(s * 0.4, 0.78, 0.0), 0.014, 0.006, bone, 5));
      head.add(limb(pts[2], V(s * 0.1, 0.74, 0.05), 0.012, 0.006, bone, 5));
    }
    addEyes(0.068, 0.0, 0.192);
  } else if (kind === 2) { // morový doktor s ptačím zobákem
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), bone);
    head.add(skull);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.36, 10), bone);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.045, 0.3); head.add(beak);
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 12), dark);
      lens.rotation.x = Math.PI / 2; lens.position.set(s * 0.085, 0.045, 0.165); head.add(lens);
    }
    hood();
    addEyes(0.085, 0.045, 0.178, 0.017);
  } else { // lebka
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), bone);
    skull.scale.set(1, 1.1, 1); head.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.065, 0.13), bone);
    jaw.position.set(0, -0.17, 0.07); head.add(jaw);
    for (const s of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.047, 10, 8), dark);
      socket.scale.set(1, 1, 0.55); socket.position.set(s * 0.076, 0.03, 0.15); head.add(socket);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4), dark);
    nose.position.set(0, -0.045, 0.18); nose.rotation.x = Math.PI; head.add(nose);
    hood();
    addEyes(0.076, 0.03, 0.14, 0.016);
  }

  // ruce
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.3, 0.92, 0.02);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.052, 0.8, 8), cloth);
    arm.position.y = -0.4; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 6), bone);
    hand.position.y = -0.82; pivot.add(hand);
    pivot.rotation.x = -1.02;
    pivot.rotation.z = s * -0.06;
    body.add(pivot);
    arms.push(pivot);
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return { root, body, head, arms, eyeMat, eyes, color };
}

// ------------------------------------------------------------------ voodoo panenka (efekt karty)
export function makeDoll() {
  const g = new THREE.Group();
  const sack = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), sack); head.position.y = 0.17; g.add(head);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.17, 8), sack); torso.position.y = 0.04; g.add(torso);
  for (const s of [-1, 1]) {
    g.add(limb(V(s * 0.05, 0.1, 0), V(s * 0.16, 0.04, 0), 0.022, 0.018, sack, 6));
    g.add(limb(V(s * 0.03, -0.04, 0), V(s * 0.05, -0.17, 0), 0.025, 0.02, sack, 6));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), dark); eye.position.set(s * 0.025, 0.185, 0.062); g.add(eye);
  }
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.3 });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xaa1f16 });
  [[0.02, 0.07, 0.06, 0.4], [-0.03, 0.02, 0.06, -0.5], [0.0, 0.14, 0.065, 0.1]].forEach(([x, y, z, tilt]) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 4), pinMat);
    pin.rotation.x = Math.PI / 2; pin.rotation.z = tilt; pin.position.set(x, y, z + 0.03); g.add(pin);
    const head2 = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), redMat);
    head2.position.set(x + Math.sin(tilt) * -0.07, y, z + 0.1); g.add(head2);
  });
  return g;
}

// ------------------------------------------------------------------ vrána
export function makeCrow() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat); body.scale.set(0.1, 0.09, 0.22); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat); head.position.set(0, 0.07, 0.19); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6 }));
  beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.065, 0.28); g.add(beak);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.18), mat); tail.position.set(0, 0.0, -0.24); tail.rotation.x = 0.2; g.add(tail);
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.07, 0.04, 0.02);
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.01, 0.2), mat);
    w.position.x = s * 0.19; pivot.add(w);
    g.add(pivot); wings.push(pivot);
  }
  g.userData.wings = wings;
  return g;
}

export function setCrowFolded(crow, folded, flap = 0) {
  const [l, r] = crow.userData.wings;
  if (folded) {
    l.scale.x = r.scale.x = 0.28; l.rotation.z = -0.35; r.rotation.z = 0.35;
  } else {
    l.scale.x = r.scale.x = 1; l.rotation.z = flap; r.rotation.z = -flap;
  }
}

// ------------------------------------------------------------------ kůl s lebkou
export function makeStake() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xb4a98f, roughness: 0.85 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 2.0, 6), wood);
  pole.position.y = 1.0; g.add(pole);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), bone); skull.position.y = 2.08; skull.scale.set(1, 1.05, 1.1); g.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.09), bone); jaw.position.set(0, 1.97, 0.05); g.add(jaw);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.031, 6, 5), dark); e.position.set(s * 0.05, 2.1, 0.09); g.add(e);
  }
  const rag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 1, side: THREE.DoubleSide }));
  rag.position.set(0.08, 1.62, 0); rag.rotation.y = 0.5; rag.rotation.z = 0.12; g.add(rag);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ------------------------------------------------------------------ les
export function makeForest(quality = 1) {
  const group = new THREE.Group();
  const r = rng(77);
  const bark = new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 1, map: barkTexture() });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();

  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.27, 1, 7, 1);
  trunkGeo.translate(0, 0.5, 0);
  const branchGeo = new THREE.CylinderGeometry(0.01, 0.045, 1, 5, 1);
  branchGeo.translate(0, 0.5, 0);

  const nDead = Math.max(20, Math.round(85 * quality));
  const PER = 7;
  const trunks = new THREE.InstancedMesh(trunkGeo, bark, nDead);
  const branches = new THREE.InstancedMesh(branchGeo, bark, nDead * PER);
  for (let i = 0; i < nDead; i++) {
    const ang = r() * Math.PI * 2, dist = 10.5 + r() * 32;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    const h = 7 + r() * 8, w = 0.7 + r() * 0.9;
    e.set((r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1);
    q.setFromEuler(e); p.set(x, 0, z); s.set(w, h, w);
    m.compose(p, q, s); trunks.setMatrixAt(i, m);
    for (let b = 0; b < PER; b++) {
      const t = 0.3 + r() * 0.65;
      const az = r() * Math.PI * 2, pitch = 0.8 + r() * 0.6;
      const len = (1.6 + r() * 3.2) * (1.15 - t * 0.55);
      e.set(pitch, az, 0, 'YXZ'); q.setFromEuler(e);
      p.set(x, h * t, z); s.set(1, len, 1);
      m.compose(p, q, s); branches.setMatrixAt(i * PER + b, m);
    }
  }
  group.add(trunks, branches);

  // smrky
  const nPine = Math.max(8, Math.round(40 * quality));
  const coneGeo = new THREE.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x0c110e, roughness: 1, flatShading: true });
  const cones = new THREE.InstancedMesh(coneGeo, pineMat, nPine * 4);
  const pTrunks = new THREE.InstancedMesh(trunkGeo, bark, nPine);
  for (let i = 0; i < nPine; i++) {
    const ang = r() * Math.PI * 2, dist = 9 + r() * 30;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    const k = 0.8 + r() * 0.6;
    q.identity(); p.set(x, 0, z); s.set(0.8, 3 * k, 0.8); m.compose(p, q, s); pTrunks.setMatrixAt(i, m);
    for (let l = 0; l < 4; l++) {
      const rad = (3.2 - l * 0.7) * k * (0.85 + r() * 0.3);
      q.setFromEuler(e.set(0, r() * 6, 0));
      p.set(x, (1.6 + l * 2.0) * k, z); s.set(rad, 3.4 * k, rad);
      m.compose(p, q, s); cones.setMatrixAt(i * 4 + l, m);
    }
  }
  group.add(cones, pTrunks);

  // kameny
  const nRock = Math.round(26 * quality) + 4;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x2a2b2a, roughness: 1, flatShading: true }), nRock);
  for (let i = 0; i < nRock; i++) {
    const ang = r() * Math.PI * 2, dist = 5.2 + r() * 14;
    const sc = 0.25 + r() * 0.7;
    q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
    p.set(Math.cos(ang) * dist, sc * 0.15, Math.sin(ang) * dist); s.set(sc, sc * 0.6, sc * 0.9);
    m.compose(p, q, s); rocks.setMatrixAt(i, m);
  }
  group.add(rocks);

  // náhrobky
  const nGrave = 9;
  const graves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.9, 0.13), new THREE.MeshStandardMaterial({ color: 0x31322f, roughness: 1 }), nGrave);
  for (let i = 0; i < nGrave; i++) {
    const ang = r() * Math.PI * 2, dist = 7.5 + r() * 8;
    q.setFromEuler(e.set((r() - 0.5) * 0.3, r() * 6, (r() - 0.5) * 0.35));
    p.set(Math.cos(ang) * dist, 0.32, Math.sin(ang) * dist); s.set(0.8 + r() * 0.5, 0.7 + r() * 0.6, 1);
    m.compose(p, q, s); graves.setMatrixAt(i, m);
  }
  group.add(graves);
  return group;
}
