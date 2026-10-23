// Simulace tisíců partií botů + fuzz test neplatných akcí. Spuštění: node test/sim.js
import { Game, eventsFor, viewFromSnap } from '../game.js';
import { decide } from '../bot.js';
import { CARD_TYPES, CAP, HAND_MAX } from '../cards.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;
const fail = (msg) => { failures++; if (failures < 15) console.error('  ✗', msg); };

function checkInvariants(g, where) {
  const s = g.snapshot();
  for (const p of s.players) {
    if (p.hp < 0 || p.hp > p.maxHp) fail(`${where}: hp mimo rozsah ${p.id}=${p.hp}`);
    if (p.hand.length > HAND_MAX) fail(`${where}: ruka ${p.hand.length}`);
    if (!p.alive && (p.hand.length || p.skip || p.cursed || p.amulet || p.saw || p.dbl)) fail(`${where}: mrtvý hráč má stavy`);
    if (p.alive && p.hp === 0) fail(`${where}: živý s 0 hp`);
    const ids = new Set(p.hand.map((c) => c.id));
    if (ids.size !== p.hand.length) fail(`${where}: duplicitní id karet`);
  }
  if (s.chambers.length > CAP) fail(`${where}: moc komor ${s.chambers.length}`);
  if (s.pub.live < 0 || s.pub.blank < 0) fail(`${where}: záporné počty`);
  const allIds = s.players.flatMap((p) => p.hand.map((c) => c.id));
  if (new Set(allIds).size !== allIds.length) fail(`${where}: karta ve dvou rukou`);
  if (s.phase === 'playing') {
    const cur = s.players.find((p) => p.id === s.turn);
    if (!cur || !cur.alive) fail(`${where}: na tahu mrtvý/nikdo`);
    if (s.chambers.length === 0) fail(`${where}: hra běží s prázdným válcem`);
    if (s.players.filter((p) => p.alive).length < 2) fail(`${where}: hra běží s <2 živými`);
  }
}

function checkEvents(events, g, where) {
  for (const ev of events) {
    if (!ev.snap) fail(`${where}: event bez snapshotu`);
    if (typeof ev.dur !== 'number') fail(`${where}: event ${ev.e} bez dur`);
  }
  for (const p of g.players) {
    const mine = eventsFor(events, p.id);
    const others = eventsFor(events, 'nobody');
    mine.forEach((ev, i) => {
      if (!ev.s || ev.s.you !== p.id) fail(`${where}: view bez you`);
      // tajné informace nesmí unikat
      if ((ev.e === 'peek' || ev.e === 'invert') && events[i].privTo !== p.id && ('vals' in ev || 'val' in ev)) fail(`${where}: únik tajné informace`);
    });
    others.forEach((ev) => {
      if ('vals' in ev || 'val' in ev) fail(`${where}: únik tajné informace cizímu pozorovateli`);
      if (ev.s.cyl.known.some((k) => k != null)) fail(`${where}: cizí pozorovatel zná komory`);
    });
  }
}

// ---------- 1) simulace botů ----------
const N = 3000;
let steps = 0, maxSteps = 0, totalLoads = 0;
const cardUse = Object.fromEntries(CARD_TYPES.map((t) => [t, 0]));
const winnersBySeat = [0, 0, 0, 0];
let botErrors = 0;

for (let n = 0; n < N; n++) {
  const count = 2 + (n % 3);
  const defs = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'Bot' + i, bot: true }));
  const g = new Game(defs, { lives: 2 + (n % 5), durScale: 0 });
  const startEvents = g.start();
  checkEvents(startEvents, g, `game ${n} start`);
  checkInvariants(g, `game ${n} start`);
  let local = 0;
  while (g.phase === 'playing' && local < 4000) {
    const cur = g.cur();
    const act = decide(g.view(cur.id));
    const res = act.t === 'use' ? g.use(cur.id, act.card, act.target) : g.shoot(cur.id, act.target);
    if (!res.ok) {
      botErrors++;
      if (botErrors < 6) console.error('  bot navrhl neplatný tah:', JSON.stringify(act), res.err);
      break;
    }
    if (act.t === 'use') {
      const ev = res.events.find((e) => e.e === 'use');
      cardUse[ev.card.type]++;
    }
    checkEvents(res.events, g, `game ${n} step ${local}`);
    checkInvariants(g, `game ${n} step ${local}`);
    local++; steps++;
  }
  if (g.phase !== 'over') fail(`game ${n}: hra neskončila (${local} kroků)`);
  else {
    if (!g.winner) fail(`game ${n}: bez vítěze`);
    winnersBySeat[g.players.findIndex((p) => p.id === g.winner)]++;
  }
  totalLoads += g.loadNo;
  maxSteps = Math.max(maxSteps, local);
}

console.log(`Simulace: ${N} her, průměr ${(steps / N).toFixed(1)} akcí/hru, max ${maxSteps}, průměr ${(totalLoads / N).toFixed(1)} nabití/hru`);
console.log('Použité karty:', JSON.stringify(cardUse));
console.log('Výhry podle místa:', winnersBySeat.join(' / '));
const unused = CARD_TYPES.filter((t) => cardUse[t] === 0);
if (unused.length) fail('boti nikdy nepoužili: ' + unused.join(', '));
if (botErrors) fail(`boti navrhli ${botErrors}× neplatný tah`);

// ---------- 2) fuzz: náhodné (i neplatné) akce ----------
let fuzzGames = 0, rejected = 0, accepted = 0;
for (let n = 0; n < 600; n++) {
  const count = 2 + (n % 3);
  const defs = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'F' + i, bot: true }));
  const g = new Game(defs, { lives: 1 + (n % 6), durScale: 0 });
  g.start();
  let guard = 0;
  while (g.phase === 'playing' && guard++ < 6000) {
    const ids = g.players.map((p) => p.id).concat(['ghost']);
    const who = Math.random() < 0.7 ? g.cur().id : ids[Math.floor(Math.random() * ids.length)];
    const actor = g.byId(who) || g.cur();
    let res;
    if (Math.random() < 0.45) {
      const cardIds = actor.hand.map((c) => c.id).concat([9999, -1]);
      res = g.use(who, cardIds[Math.floor(Math.random() * cardIds.length)], ids[Math.floor(Math.random() * ids.length)]);
    } else {
      res = g.shoot(who, ids[Math.floor(Math.random() * ids.length)]);
    }
    if (res.ok) accepted++; else rejected++;
    checkInvariants(g, `fuzz ${n}`);
  }
  if (g.phase !== 'over') fail(`fuzz ${n}: hra neskončila`);
  fuzzGames++;
}
console.log(`Fuzz: ${fuzzGames} her, ${accepted} přijatých a ${rejected} odmítnutých akcí`);

// ---------- 3) cílené testy pravidel ----------
function fresh(count = 3, lives = 4) {
  const defs = Array.from({ length: count }, (_, i) => ({ id: 'p' + i, name: 'T' + i }));
  const g = new Game(defs, { lives, durScale: 0 });
  g.start();
  g.turn = 0;
  return g;
}
const give = (g, pid, type) => { const c = { id: g.nextCardId++, type }; g.byId(pid).hand.push(c); return c; };
const setChambers = (g, arr) => { g.chambers = arr.map((l) => ({ live: l, seen: new Map() })); g.pub = { live: arr.filter(Boolean).length, blank: arr.filter((x) => !x).length, uncertain: false }; g.history = []; };
const expect = (cond, msg) => { if (!cond) fail('pravidla: ' + msg); };

{ // slepý do sebe = další tah
  const g = fresh(); setChambers(g, [false, true, false, true, false, false]);
  const r = g.shoot('p0', 'p0');
  expect(r.ok && g.cur().id === 'p0' && r.events.some((e) => e.e === 'turn' && e.extra), 'slepý náboj do sebe má dát další tah');
}
{ // ostrý do sebe = -1 život, tah dál
  const g = fresh(); setChambers(g, [true, false, false, false, false, false]);
  g.shoot('p0', 'p0');
  expect(g.byId('p0').hp === 3 && g.cur().id === 'p1', 'ostrý do sebe ubírá život a končí tah');
}
{ // do soupeře vždy končí tah, i když je slepý
  const g = fresh(); setChambers(g, [false, true, false, false, false, false]);
  g.shoot('p0', 'p1');
  expect(g.byId('p1').hp === 4 && g.cur().id === 'p1', 'slepý do soupeře končí tah');
}
{ // pila = dvojité zranění; dvojitá rána = dva náboje
  const g = fresh(); setChambers(g, [true, true, false, false, false, false]);
  const s = give(g, 'p0', 'saw'), d = give(g, 'p0', 'double');
  expect(g.use('p0', s.id).ok && g.use('p0', d.id).ok, 'použití pily a dvojité rány');
  g.shoot('p0', 'p1');
  expect(g.byId('p1').hp === 4 - 4 + 0 || g.byId('p1').alive === false, 'pila + dvojitá rána = 4 zranění (4 životy → smrt)');
}
{ // amulet blokuje zásah
  const g = fresh(); setChambers(g, [true, false, false, false, false, false]);
  g.byId('p1').amulet = true;
  g.shoot('p0', 'p1');
  expect(g.byId('p1').hp === 4 && !g.byId('p1').amulet, 'amulet zablokuje zásah a rozpadne se');
}
{ // voodoo přeskočí hráče
  const g = fresh(3); setChambers(g, [false, false, false, false, false, true]);
  const v = give(g, 'p0', 'voodoo');
  g.use('p0', v.id, 'p1');
  const r = g.shoot('p0', 'p2');
  expect(g.cur().id === 'p2' && r.events.some((e) => e.e === 'skip' && e.p === 'p1'), 'voodoo má přeskočit p1');
}
{ // kletba nutí střílet do sebe
  const g = fresh(); g.byId('p0').cursed = true; setChambers(g, [false, false, false, false, false, true]);
  expect(!g.shoot('p0', 'p1').ok, 'prokletý nesmí střílet na jiné');
  expect(g.shoot('p0', 'p0').ok && !g.byId('p0').cursed, 'prokletý smí do sebe a kletba se spotřebuje');
}
{ // eject, cross, skull, tajnost informací
  const g = fresh(); setChambers(g, [true, false, false, false, false, false]);
  const e = give(g, 'p0', 'skull'); const x = give(g, 'p0', 'cross');
  g.use('p0', e.id);
  expect(g.view('p0').cyl.known[0] === true && g.view('p0').cyl.known[1] === false, 'lebka ukáže dva náboje');
  expect(g.view('p1').cyl.known[0] === null, 'cizí hráč nic nevidí');
  g.use('p0', x.id);
  expect(g.chambers[0].live === false && g.view('p0').cyl.known[0] === false, 'kříž obrátí náboj a vidoucí to ví');
}
{ // nabití po posledním náboji + rozdání karet
  const g = fresh(); setChambers(g, [false]);
  const before = g.loadNo;
  g.shoot('p0', 'p0');
  expect(g.loadNo === before + 1 && g.chambers.length === CAP, 'po posledním náboji se válec znovu nabije');
}
{ // pakt, zlodějka, bylina nelze při plném zdraví
  const g = fresh(); setChambers(g, [false, false, false, false, false, true]);
  const h = give(g, 'p0', 'herb');
  expect(!g.use('p0', h.id).ok, 'bylina při plných životech se nesmí použít');
  const t = give(g, 'p1', 'eye');
  const th = give(g, 'p0', 'thief');
  expect(g.use('p0', th.id, 'p1').ok, 'zlodějka');
}
{ // smrt a konec hry
  const g = fresh(2, 1); setChambers(g, [true, false, false, false, false, false]);
  const r = g.shoot('p0', 'p1');
  expect(g.phase === 'over' && g.winner === 'p0' && r.events.some((e) => e.e === 'over'), 'smrt posledního soupeře ukončí hru');
}

// ---------- 4) shoda ID karet server ↔ frontend ----------
const clientCards = path.resolve(here, '../../frontend/js/cards.js');
if (fs.existsSync(clientCards)) {
  const mod = await import(pathToFileURL(clientCards).href);
  const a = [...CARD_TYPES].sort().join(',');
  const b = Object.keys(mod.CARDS).sort().join(',');
  if (a !== b) fail(`ID karet server≠frontend:\n   server:  ${a}\n   frontend: ${b}`);
  else console.log(`Shoda karet server/frontend: ${CARD_TYPES.length} karet ✓`);
}

if (failures) { console.error(`\n${failures} selhání`); process.exit(1); }
console.log('\nVšechny testy logiky prošly ✓');
