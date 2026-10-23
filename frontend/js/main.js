// Řadič hry: spojuje síť, 3D scénu, zvuk a rozhraní. Události ze serveru přehrává postupně jako "film".
import { Scene3D } from './scene.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { Net, normalizeUrl } from './net.js';
import { CARDS } from './cards.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d = '') { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* nic */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nic */ } },
};

const DEMO = [
  { id: 'a', color: 0, maxHp: 4 }, { id: 'b', color: 1, maxHp: 4 },
  { id: 'c', color: 2, maxHp: 4 }, { id: 'd', color: 3, maxHp: 4 },
];

class App {
  constructor() {
    this.audio = new Sound();
    this.net = new Net();
    this.settings = {
      name: store.get('pk_name', ''),
      server: store.get('pk_server', '') || (window.PK_CONFIG && window.PK_CONFIG.SERVER_URL) || '',
      vol: Number(store.get('pk_vol', '70')),
      bright: Number(store.get('pk_bright', '100')),
      quality: store.get('pk_quality', '1'),
    };
    // Při spuštění lokálně přes server (localhost / domácí síť) se adresa serveru doplní sama.
    if ((!this.settings.server || /TVOJE-APLIKACE/i.test(this.settings.server)) && /^https?:$/.test(location.protocol) && /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(location.hostname)) {
      this.settings.server = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    }
    this.muted = store.get('pk_mute', '0') === '1';
    this.audio.volume = this.settings.vol / 100;
    this.audio.muted = this.muted;

    this.you = null;
    this.code = null;
    this.lobby = null;
    this.screen = 'menu';
    this.pending = null;       // zpráva, která se odešle po připojení
    this.queue = [];
    this.pumping = false;
    this.latest = null;        // poslední známý autoritativní pohled
    this.deadlineAt = 0;
    this.seatSig = '';
    this.deadSet = new Set();
    this.leaving = false;
    this.epoch = 0;
    this.hbOn = false;
    this.names = {};

    this.ui = new UI({
      onShoot: (t) => this.sendAction({ t: 'shoot', target: t }),
      onUse: (card, t) => this.sendAction({ t: 'use', card, target: t }),
      onAim: (id) => this.scene && this.scene.aimPreview(id),
      onKick: (id) => this.net.send({ t: 'kick', id }),
      onRemoveBot: (id) => this.net.send({ t: 'removeBot', id }),
    });
    this.initScene();
    this.bindMenu();
    this.bindNet();
    this.bindGlobal();
    this.applySettingsToUi();
    this.tryResume();
  }

  // ------------------------------------------------------------------ scéna
  initScene() {
    const canvas = $('gl');
    try {
      this.scene = new Scene3D(canvas, { audio: this.audio, quality: this.settings.quality === '0' ? 0 : 1, brightness: this.settings.bright / 100 });
    } catch (err) {
      console.error(err);
      this.scene = null;
      this.ui.fatal('<div><h2>Nejde spustit 3D grafiku</h2><p>Tvůj prohlížeč nebo zařízení nepodporuje WebGL (nebo je vypnuté).<br>Zkus jiný prohlížeč (Chrome, Firefox, Edge) a zapni hardwarovou akceleraci.</p></div>');
      return;
    }
    const s = this.scene;
    s.onFlash = () => this.ui.fx('shot');
    s.onHurt = () => this.ui.hurt();
    s.onLightning = () => { this.ui.fx('lightning'); setTimeout(() => this.audio.play('thunder'), 500); };
    s.onCaw = () => this.audio.play('caw');
    s.onFrame = () => { if (this.screen === 'game') this.ui.updatePlates(s); };
    this.showDemo();
    s.start();
    window.addEventListener('resize', () => s.resize());
    canvas.addEventListener('click', (e) => { if (this.screen === 'game') this.ui.pickTarget(s.pick(e.clientX, e.clientY)); });
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  showDemo() {
    if (!this.scene) return;
    this.seatSig = '';
    this.deadSet = new Set();
    this.scene.localDead = false;
    this.scene.spectate = false;
    this.scene.setSeating(DEMO, 'a');
    this.scene.setTurn('b');
    this.scene.releaseGun();
  }

  onVisibility() {
    const s = this.scene;
    if (!s) return;
    if (document.hidden) { s.fast = true; s.flushTweens(); } else { s.fast = false; s.flushTweens(); this.net.nudge(); }
  }

  get fast() { return document.hidden; }
  sleep(ms) { return this.fast || ms <= 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)); }

  // ------------------------------------------------------------------ nastavení
  applySettingsToUi() {
    const st = this.settings;
    $('inName').value = st.name;
    $('setVol').value = st.vol;
    $('setBright').value = st.bright;
    $('setQuality').value = st.quality;
    $('setServer').value = st.server;
    $('btnSound').classList.toggle('off', this.muted);
    this.net.setUrl(st.server);
    const m = /[?&]kod=([A-Za-z]{4})/.exec(location.search);
    if (m) $('inCode').value = m[1].toUpperCase();
  }

  saveSettings() {
    const st = this.settings;
    const oldQ = st.quality;
    st.vol = Number($('setVol').value);
    st.bright = Number($('setBright').value);
    st.quality = $('setQuality').value;
    const newServer = $('setServer').value.trim();
    const serverChanged = normalizeUrl(newServer) !== normalizeUrl(st.server);
    st.server = newServer;
    store.set('pk_vol', st.vol); store.set('pk_bright', st.bright); store.set('pk_quality', st.quality); store.set('pk_server', st.server);
    this.audio.setVolume(st.vol / 100);
    if (this.scene) this.scene.setBrightness(st.bright / 100);
    if (serverChanged) { this.net.close(); this.net.setUrl(st.server); }
    this.ui.close('ovSettings');
    this.ui.toast(oldQ !== st.quality ? 'Uloženo. Kvalita grafiky se změní po obnovení stránky (F5).' : 'Nastavení uloženo.');
  }

  // ------------------------------------------------------------------ menu a lobby
  bindMenu() {
    const ui = this.ui;
    $('btnCreate').onclick = () => this.start({ t: 'create' });
    $('btnJoin').onclick = () => {
      const code = $('inCode').value.toUpperCase().replace(/[^A-Z]/g, '');
      if (code.length !== 4) { ui.toast('Kód místnosti má 4 písmena.'); return; }
      this.start({ t: 'join', code });
    };
    $('btnQuick').onclick = () => this.start({ t: 'quick', bots: 2, lives: 4 });
    $('inName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnCreate').click(); });
    $('inCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
    $('inCode').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    for (const id of ['btnRules', 'btnRules2']) $(id).onclick = () => ui.open('ovRules');
    for (const id of ['btnSettings', 'btnSettings2']) $(id).onclick = () => { this.applySettingsToUi(); $('setServerInfo').textContent = ''; ui.open('ovSettings'); };
    $('btnSettingsSave').onclick = () => this.saveSettings();
    $('setVol').oninput = (e) => this.audio.setVolume(Number(e.target.value) / 100);
    $('setBright').oninput = (e) => this.scene && this.scene.setBrightness(Number(e.target.value) / 100);
    $('btnServerTest').onclick = () => this.testServer();
    $('btnSound').onclick = () => {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      store.set('pk_mute', this.muted ? '1' : '0');
      $('btnSound').classList.toggle('off', this.muted);
    };

    $('lobbyCode').onclick = async () => {
      const link = `${location.origin}${location.pathname}?kod=${this.code}`;
      try { await navigator.clipboard.writeText(link); ui.toast('Odkaz do místnosti zkopírován.'); } catch { ui.toast('Kód místnosti: ' + this.code); }
    };
    $('livesMinus').onclick = () => this.net.send({ t: 'settings', lives: (this.lobby ? this.lobby.settings.lives : 4) - 1 });
    $('livesPlus').onclick = () => this.net.send({ t: 'settings', lives: (this.lobby ? this.lobby.settings.lives : 4) + 1 });
    $('btnAddBot').onclick = () => this.net.send({ t: 'addBot' });
    $('btnStart').onclick = () => this.net.send({ t: 'start' });
    $('btnLeaveLobby').onclick = () => this.leave();
    $('btnLeaveGame').onclick = () => { if (confirm('Opravdu odejít ze hry? Ostatní hráči budou pokračovat bez tebe.')) this.leave(); };
    $('btnAgain').onclick = () => this.net.send({ t: 'again' });
    $('btnLeaveOver').onclick = () => this.leave();
  }

  playerName() {
    let n = $('inName').value.trim().slice(0, 14);
    if (!n) n = 'Hráč' + (10 + Math.floor(Math.random() * 90));
    this.settings.name = n;
    store.set('pk_name', n);
    return n;
  }

  /** Spustí akci z menu: připojí se (a případně probudí server) a pak odešle zprávu. */
  async start(msg) {
    this.audio.init();
    if (!this.settings.server || /TVOJE-APLIKACE/i.test(this.settings.server)) {
      this.ui.setNetStatus('Není nastavená adresa serveru. Otevři Nastavení.', 'bad');
      this.ui.toast('Nejdřív nastav adresu herního serveru (Nastavení).');
      return;
    }
    msg.name = this.playerName();
    this.pending = msg;
    this.leaving = false;
    this.net.setUrl(this.settings.server);
    this.setMenuBusy(true);
    if (this.net.status !== 'open') {
      this.ui.setNetStatus('Probouzím server… (první připojení může trvat i minutu)', '');
      await this.net.wake(60000);
      if (this.pending !== msg) return;
      this.net.connect();
    } else this.flushPending();
  }

  setMenuBusy(b) { for (const id of ['btnCreate', 'btnJoin', 'btnQuick']) $(id).disabled = b; }

  flushPending() {
    if (!this.pending) return;
    const m = this.pending;
    this.pending = null;
    this.net.send(m);
  }

  async testServer() {
    const info = $('setServerInfo');
    const url = normalizeUrl($('setServer').value);
    if (!url) { info.textContent = 'Zadej adresu serveru.'; return; }
    info.textContent = 'Zkouším… (Render se může probouzet až minutu)';
    const prev = this.net.url;
    this.net.setUrl(url);
    const ok = await this.net.wake(70000);
    this.net.setUrl(prev);
    info.textContent = ok ? 'Server odpovídá. ✓' : 'Server neodpověděl. Zkontroluj adresu (wss://…onrender.com).';
  }

  tryResume() {
    let s = null;
    try { s = JSON.parse(store.get('pk_session', 'null')); } catch { s = null; }
    if (!s || !s.code || !s.token || !this.settings.server || /TVOJE-APLIKACE/i.test(this.settings.server)) return;
    if (Date.now() - (s.at || 0) > 6 * 3600 * 1000) { store.del('pk_session'); return; }
    this.session = s;
    this.ui.setNetStatus('Obnovuji rozehranou hru…', '');
    this.net.connect();
  }

  saveSession() { store.set('pk_session', JSON.stringify({ code: this.code, token: this.token, at: Date.now() })); }
  clearSession() { store.del('pk_session'); this.session = null; }

  leave() {
    this.leaving = true;
    this.net.send({ t: 'leave' });
    this.clearSession();
    this.toMenu();
    setTimeout(() => this.net.close(), 150);
  }

  toMenu(msg) {
    this.epoch++;
    this.queue.length = 0;
    this.code = null; this.you = null; this.lobby = null; this.token = null;
    this.latest = null;
    this.setScreen('menu');
    this.setMenuBusy(false);
    this.ui.setNetStatus(msg || '', msg ? 'bad' : '');
    this.ui.setConn(null);
  }

  setScreen(name) {
    const was = this.screen;
    this.screen = name;
    this.ui.setScreen(name);
    if (name !== 'game') {
      this.ui.closeAll();
      this.ui.hideOver();
      this.audio.heartbeat(false);
      this.hbOn = false;
      if (was === 'game') this.showDemo();
    }
  }

  // ------------------------------------------------------------------ síť
  bindNet() {
    const net = this.net;
    net.on('status', (s) => {
      if (s.state === 'connecting' && this.screen === 'menu' && this.pending) this.ui.setNetStatus(s.tries > 0 ? `Připojuji… (pokus ${s.tries + 1})` : 'Probouzím server… (první připojení může trvat i minutu)', '');
      if (s.state === 'retry' && !this.session && !this.code && s.tries >= 10) {
        this.net.close();
        this.pending = null;
        this.setMenuBusy(false);
        this.ui.setNetStatus('Server neodpovídá. Zkontroluj adresu v Nastavení.', 'bad');
      }
      if (s.state === 'nourl') this.ui.setNetStatus('Není nastavená adresa serveru.', 'bad');
    });
    net.on('open', () => {
      this.ui.setConn(null);
      if (this.pending) { this.flushPending(); return; }
      const s = this.session || (this.code && this.token ? { code: this.code, token: this.token } : null);
      if (s && !this.leaving) net.send({ t: 'resume', code: s.code, token: s.token });
    });
    net.on('close', () => {
      if (this.leaving) return;
      if (this.screen === 'game' || this.screen === 'lobby') this.ui.setConn('Spojení se serverem se přerušilo. Připojuji znovu…');
    });
    net.on('joined', (m) => {
      this.you = m.you; this.code = m.code; this.token = m.token; this.lobby = m.lobby;
      this.session = { code: m.code, token: m.token };
      this.saveSession();
      this.setMenuBusy(false);
      this.ui.setNetStatus('');
      this.ui.setConn(null);
      if (m.lobby.phase === 'lobby') { this.ui.renderLobby(m.lobby, this.you); this.setScreen('lobby'); }
      // jinak čekáme na "sync" / "update"
    });
    net.on('lobby', (m) => {
      this.lobby = m.lobby;
      if (m.lobby.phase === 'lobby') {
        if (this.screen !== 'lobby') {
          this.epoch++;
          this.queue.length = 0;
          this.setScreen('lobby');
        }
        this.ui.renderLobby(m.lobby, this.you);
      }
      this.updateNames();
    });
    net.on('update', (m) => {
      if (m.lobby) this.lobby = m.lobby;
      this.deadlineAt = Date.now() + (m.tl || 0);
      this.queue.push({ events: m.events });
      this.pump();
    });
    net.on('sync', (m) => {
      if (m.lobby) this.lobby = m.lobby;
      this.deadlineAt = Date.now() + (m.tl || 0);
      this.queue.length = 0;
      this.queue.push({ sync: m.state });
      this.pump();
    });
    net.on('err', (m) => {
      this.ui.toast(m.msg || 'Chyba.');
      if (m.code === 'noroom') {
        this.clearSession();
        this.pending = null;
        if (this.screen !== 'menu') this.toMenu(m.msg);
        else { this.setMenuBusy(false); this.ui.setNetStatus(m.msg || '', 'bad'); }
        return;
      }
      this.setMenuBusy(false);
      if (this.screen === 'menu') this.ui.setNetStatus(m.msg || '', 'bad');
      if (!this.pumping) this.ui.setLocked(false);
    });
    net.on('kicked', () => { this.clearSession(); this.toMenu('Hostitel tě vyhodil z místnosti.'); this.net.close(); });
  }

  sendAction(msg) {
    if (!this.net.send(msg)) { this.ui.toast('Není spojení se serverem.'); this.ui.setLocked(false); }
  }

  // ------------------------------------------------------------------ přehrávání událostí
  updateNames() {
    const src = (this.latest && this.latest.players) || (this.lobby && this.lobby.players) || [];
    for (const p of src) this.names[p.id] = p.name;
  }
  nm(id) { return this.names[id] || '???'; }

  enterGame(view) {
    if (this.screen !== 'game') {
      this.ui.startGame(this.code);
      this.setScreen('game');
      this.ui.close('ovOver');
    }
    const sig = view.you + '|' + view.players.map((p) => `${p.id}:${p.color}:${p.maxHp}`).join(',');
    if (this.scene && sig !== this.seatSig) {
      this.seatSig = sig;
      this.deadSet = new Set();
      this.scene.localDead = false;
      this.scene.spectate = false;
      this.scene.setSeating(view.players, view.you);
      this.syncScene(view, true);
    }
  }

  syncScene(view, quiet) {
    const s = this.scene;
    if (!s) return;
    for (const p of view.players) {
      s.setHp(p.id, p.hp, quiet);
      if (!p.alive && !this.deadSet.has(p.id)) { this.deadSet.add(p.id); s.setDead(p.id, quiet); }
      if (p.alive && this.deadSet.has(p.id)) this.deadSet.delete(p.id);
    }
    const me = view.players.find((p) => p.id === view.you);
    const dead = !!me && !me.alive;
    s.localDead = dead;
    s.spectate = dead && view.phase !== 'over';
    if (view.phase === 'playing') s.setTurn(view.turn);
    const hb = !!me && me.alive && view.phase === 'playing' && me.hp === 1;
    if (hb !== this.hbOn) { this.hbOn = hb; this.audio.heartbeat(hb, 92); }
    if (view.phase === 'over' && this.hbOn) { this.hbOn = false; this.audio.heartbeat(false); }
  }

  /** Pohled bez zadaných karet (aby se nová karta ukázala až při rozdání). */
  withoutCards(view, ids) {
    if (!ids.size) return view;
    return { ...view, players: view.players.map((p) => ({ ...p, hand: p.hand.filter((c) => !ids.has(c.id)) })) };
  }

  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    this.ui.setLocked(true);
    const ep = this.epoch;
    try {
      while (this.queue.length && ep === this.epoch) {
        const item = this.queue.shift();
        if (item.sync) await this.applySync(item.sync);
        else for (const ev of item.events) {
          if (ep !== this.epoch) break;
          if (this.queue.length && this.queue[0].sync) break; // přišla úplná synchronizace – zahoď zbytek
          await this.playEvent(ev);
        }
      }
    } catch (err) {
      console.error('přehrávání událostí', err);
    }
    this.pumping = false;
    // autoritativní stav po dohrání
    if (this.latest && this.screen === 'game') {
      this.syncScene(this.latest, true);
      this.ui.setView(this.latest);
      this.ui.setTimer(Math.max(0, this.deadlineAt - Date.now()));
      if (this.scene) { this.scene.releaseGun(); }
    }
    this.ui.setLocked(false);
  }

  async applySync(state) {
    this.latest = state;
    this.updateNames();
    this.enterGame(state);
    if (this.scene) { this.scene.flushTweens(); this.scene.releaseGun(); }
    this.syncScene(state, true);
    this.ui.setView(state);
    if (state.phase === 'over') this.showOver(state);
  }

  async playEvent(ev) {
    const view = ev.s;
    const t0 = performance.now();
    this.latest = view;
    this.updateNames();
    this.enterGame(view);
    const fn = this['ev_' + ev.e];
    try {
      if (fn) await fn.call(this, ev, view);
      else this.ui.setView(view);
    } catch (err) { console.error('událost', ev.e, err); this.ui.setView(view); }
    // dodrž tempo serveru
    const rest = (ev.dur || 0) - (performance.now() - t0) - 40;
    await this.sleep(rest);
  }

  me() { return this.you; }
  isMe(id) { return id === this.you; }
  who(id) { return this.isMe(id) ? 'Ty' : this.nm(id); }

  // --- jednotlivé události
  async ev_start(ev, v) {
    this.ui.setView(v);
    this.ui.log('Hra začíná. Les naslouchá…', 'sys');
    this.ui.announce('Prokletá komora', '', true, 1500);
    this.audio.play('creak');
  }

  async ev_load(ev, v) {
    const dealt = new Set();
    for (const list of Object.values(ev.deals || {})) for (const c of list) dealt.add(c.id);
    this.ui.setView(this.withoutCards(v, dealt));
    this.syncScene(v, true);
    this.ui.log(`Nabito: ${ev.live}× ostrý, ${ev.blank}× slepý.`, 'sys');
    this.ui.announce(`${ev.live}× ostrý · ${ev.blank}× slepý`, '', false, 2400);
    if (this.scene) {
      this.scene.releaseGun();
      await this.scene.loadBullets(ev.live, ev.blank, {
        onAppear: (i, live) => this.audio.play('bullet', { live }),
        onInsert: () => this.audio.play('insert'),
      });
    }
    this.ui.setView(v);
    if (dealt.size) this.audio.play('deal');
  }

  async ev_turn(ev, v) {
    this.ui.setView(v);
    this.syncScene(v, false);
    if (this.scene) { this.scene.setTurn(ev.p); this.scene.releaseGun(); }
    if (this.isMe(ev.p)) {
      this.audio.play('myturn');
      this.ui.announce(ev.extra ? 'Hraješ znovu' : 'Tvůj tah', '', false, 800);
    } else {
      this.audio.play('turn');
    }
    if (ev.extra) this.ui.log(`${this.who(ev.p)} hraje znovu.`, 'info');
  }

  async ev_skip(ev, v) {
    this.audio.play('skip');
    this.ui.log(`${this.nm(ev.p)} je ochromen a přeskakuje tah.`, 'bad');
    this.ui.announce(`${this.nm(ev.p)} přeskakuje tah`, 'dim', false, 1600);
    if (this.scene) this.scene.pulse(ev.p, 0x6ea06a, 900, 6);
    this.ui.setView(v);
  }

  async ev_use(ev, v) {
    const def = CARDS[ev.card.type];
    this.audio.play('card');
    this.ui.log(`${this.nm(ev.p)} zahrál: ${def.name}${ev.target ? ' → ' + this.nm(ev.target) : ''}.`, 'info');
    this.ui.cardPlay(ev.card.type, `${this.nm(ev.p)} · ${def.name}`, Math.max(600, (ev.dur || 1300) - 100), this.isMe(ev.p));
    this.ui.setView(v);
  }

  async ev_voodoo(ev, v) {
    this.audio.play('voodoo');
    this.ui.log(`${this.nm(ev.t)} přeskočí příští tah.`, 'bad');
    if (this.scene) await this.scene.voodooDoll(ev.t);
    this.ui.announce(`${this.nm(ev.t)} – ochrnutí`, 'bad', false, 1200);
    this.ui.setView(v);
  }

  async ev_mark(ev, v) {
    const m = { dbl: ['Dvojitá rána', 0xc09040], saw: ['Rezavá pila', 0xb0533a], amulet: ['Kostěný amulet', 0xcfd8e8] }[ev.mark];
    this.audio.play(ev.mark === 'amulet' ? 'amulet' : 'mark');
    if (this.scene) this.scene.pulse(ev.p, m[1], 800, 7);
    this.ui.announce(m[0], ev.mark === 'amulet' ? 'good' : 'bad', false, 1100);
    this.ui.log(`${this.nm(ev.p)}: ${m[0]} připraven.`, 'info');
    this.ui.setView(v);
  }

  async ev_peek(ev, v) {
    this.audio.play('peek');
    if (this.scene) this.scene.pulse(ev.p, 0x9db4c6, 900, 6);
    this.ui.setView(v);
    if (ev.vals) {
      this.ui.peek(ev.vals, Math.max(1500, (ev.dur || 1700) - 200));
      this.ui.log('Vidíš: ' + ev.vals.map((x) => (x ? 'OSTRÝ' : 'slepý')).join(', ') + '.', 'good');
    } else {
      this.ui.log(`${this.nm(ev.p)} nahlédl do komory.`, 'info');
      this.ui.announce(`${this.nm(ev.p)} nakukuje do komory`, 'dim', false, 1400);
    }
  }

  async ev_spin(ev, v) {
    this.audio.play('spin');
    this.ui.log(`${this.nm(ev.p)} zatočil válcem. Vědomosti propadají.`, 'info');
    this.ui.announce('Válec se točí', 'dim', false, 1500);
    this.ui.setView(v);
    if (this.scene) await this.scene.spinDrum(3, 1500);
  }

  async ev_eject(ev, v) {
    this.audio.play('eject');
    this.ui.log(`${this.nm(ev.p)} vytřásl ${ev.live ? 'OSTRÝ' : 'slepý'} náboj.`, ev.live ? 'bad' : 'info');
    this.ui.peek([ev.live], 1700);
    if (this.scene) await this.scene.ejectShell(ev.live);
    this.ui.setView(v);
  }

  async ev_invert(ev, v) {
    this.audio.play('invert');
    if (this.scene) this.scene.pulse(ev.p, 0x8b5aa0, 900, 7);
    this.ui.setView(v);
    this.ui.announce('Náboj se obrátil', 'dim', false, 1400);
    if (ev.val != null) {
      this.ui.peek([ev.val], 1500);
      this.ui.log('Obrátil jsi náboj – teď je ' + (ev.val ? 'OSTRÝ' : 'slepý') + '.', 'good');
    } else this.ui.log(`${this.nm(ev.p)} obrátil kříž nad komorou.`, 'info');
  }

  async ev_heal(ev, v) {
    this.audio.play('heal');
    if (this.scene) this.scene.pulse(ev.p, 0x6ea06a, 900, 7);
    if (this.isMe(ev.p)) this.ui.fx('heal');
    this.ui.log(ev.amount ? `${this.nm(ev.p)} se vyléčil.` : `${this.nm(ev.p)} už má plné zdraví.`, 'good');
    this.ui.announce(ev.amount ? '+1 život' : 'Bez účinku', 'good', false, 1100);
    this.ui.setView(v);
    this.syncScene(v, false);
  }

  async ev_amanita(ev, v) {
    this.audio.play(ev.good ? 'heal' : 'hurt');
    if (this.scene) this.scene.pulse(ev.p, ev.good ? 0x6ea06a : 0x8c1c13, 1000, 8);
    this.ui.announce(ev.good ? `Muchomůrka: +${ev.amount}` : `Muchomůrka: −${ev.amount}`, ev.good ? 'good' : 'bad', true, 1700);
    this.ui.log(`${this.nm(ev.p)} snědl muchomůrku: ${ev.good ? '+' : '−'}${ev.amount} život.`, ev.good ? 'good' : 'bad');
    if (!ev.good && this.isMe(ev.p)) this.ui.hurt();
    this.ui.setView(v);
    this.syncScene(v, false);
  }

  async ev_pact(ev, v) {
    this.audio.play('pact');
    if (this.scene) this.scene.pulse(ev.p, 0x8c1c13, 1000, 8);
    this.ui.announce('Krvavý pakt', 'bad', false, 1500);
    this.ui.log(`${this.nm(ev.p)} obětoval život za ${ev.dealt.length} karty.`, 'bad');
    const ids = new Set(ev.dealt.map((c) => c.id));
    this.ui.setView(this.withoutCards(v, ids));
    this.syncScene(v, false);
    await this.sleep(900);
    this.audio.play('deal');
    this.ui.setView(v);
  }

  async ev_steal(ev, v) {
    this.audio.play('steal');
    const def = CARDS[ev.card.type];
    this.ui.log(`${this.nm(ev.p)} ukradl ${this.isMe(ev.p) || this.isMe(ev.t) ? def.name : 'kartu'} hráči ${this.nm(ev.t)}.`, 'bad');
    this.ui.announce('Vrána krade kartu', 'bad', false, 1500);
    if (this.scene) { setTimeout(() => this.audio.play('caw'), 300); await this.scene.crowFlight(ev.t, ev.p); }
    this.ui.setView(v);
  }

  async ev_curse(ev, v) {
    this.audio.play('curse');
    if (this.scene) this.scene.pulse(ev.t, 0x836296, 1200, 8);
    this.ui.announce(`${this.nm(ev.t)} je proklet`, 'bad', false, 1500);
    this.ui.log(`${this.nm(ev.t)} musí příště střílet sám do sebe.`, 'bad');
    this.ui.setView(v);
  }

  async ev_holy(ev, v) {
    this.audio.play('holy');
    if (this.scene) this.scene.pulse(null, 0xcfe0ff, 1200, 8);
    this.ui.announce('Svěcená voda: +1 slepý', 'good', false, 1500);
    this.ui.log(`${this.nm(ev.p)} přidal do válce slepý náboj.`, 'info');
    this.ui.setView(v);
  }

  async ev_dir(ev, v) {
    this.audio.play('dir');
    this.ui.announce('Směr tahů se obrací', 'dim', false, 1400);
    this.ui.log('Kyvadlo obrátilo směr tahů.', 'info');
    this.ui.setView(v);
  }

  async ev_shot(ev, v) {
    const s = this.scene;
    const self = ev.p === ev.t;
    const live = ev.rounds.some(Boolean);
    this.ui.resetSelection();
    this.ui.setView(this.latestPre(v, ev));
    this.ui.log(`${this.nm(ev.p)} míří ${self ? 'sám na sebe' : 'na hráče ' + this.nm(ev.t)}${ev.double ? ' (2 náboje)' : ''}…`, 'sys');
    this.ui.announce(self ? `${this.nm(ev.p)} → sám do sebe` : `${this.nm(ev.p)} → ${this.nm(ev.t)}`, '', false, 1000);
    if (s) {
      s.aim(ev.p, ev.t);
      const T = s.seat(ev.t);
      if (T) s.focusCamera(T.head.clone().multiplyScalar(0.55).setY(1.2), 0.86);
    }
    await this.sleep(550);
    this.audio.play('cock');
    if (s) await s.cock(350);
    this.audio.play('ratchet');
    await this.sleep(650);
    for (let i = 0; i < ev.rounds.length; i++) {
      if (s) await s.fireRound(ev.rounds[i], ev.saw && ev.rounds[i]);
      else this.audio.play(ev.rounds[i] ? 'shot' : 'click');
      if (i + 1 < ev.rounds.length) await this.sleep(420);
    }
    // výsledek
    if (ev.blocked) {
      this.audio.play('amuletBreak');
      if (s) s.amuletBreak(ev.t);
      this.ui.announce('Amulet se rozpadl!', 'good', true, 1700);
      this.ui.log(`${this.nm(ev.t)}: amulet pohltil ránu.`, 'good');
    } else if (ev.dmg > 0) {
      this.audio.play('hurt');
      if (s) s.hitReaction(ev.t, ev.dmg, ev.killed);
      this.ui.announce(`−${ev.dmg}`, 'bad', true, 1700);
      this.ui.log(`${this.nm(ev.t)} dostal zásah (−${ev.dmg}).${ev.saw ? ' Rezavá pila!' : ''}`, 'bad');
    } else {
      this.ui.announce(ev.rounds.length > 1 ? 'Cvak, cvak…' : 'Cvak…', 'dim', true, 1400);
      this.ui.log(ev.rounds.length > 1 ? 'Obě komory byly prázdné.' : 'Prázdná komora.', 'info');
    }
    this.ui.setView(v);
    this.syncScene(v, false);
    await this.sleep(live ? 900 : 500);
    if (s) s.releaseGun();
  }

  /** Při výstřelu zatím zobrazíme stav bez změn životů (ty se projeví až po zásahu). */
  latestPre(v, ev) {
    return {
      ...v,
      cyl: this.ui.view ? this.ui.view.cyl : v.cyl,
      players: v.players.map((p) => {
        const old = this.ui.view && this.ui.view.players.find((x) => x.id === p.id);
        return old ? { ...p, hp: old.hp, alive: old.alive, amulet: old.amulet } : p;
      }),
    };
  }

  async ev_death(ev, v) {
    this.audio.play('death');
    this.ui.announce(`${this.nm(ev.p)} zemřel`, 'bad', true, 2200);
    this.ui.log(`${this.nm(ev.p)} zemřel.`, 'bad');
    if (this.scene) this.scene.setTurn(null);
    this.ui.setView(v);
    this.syncScene(v, false);
    if (this.isMe(ev.p)) this.ui.fx('dark');
  }

  async ev_over(ev, v) {
    this.ui.setView(v);
    this.syncScene(v, true);
    const win = this.isMe(ev.winner);
    this.audio.play(win ? 'win' : 'lose');
    this.ui.log(ev.winner ? `${this.nm(ev.winner)} přežil les.` : 'Nikdo nepřežil.', 'sys');
    this.ui.announce(win ? 'Přežil jsi' : (ev.winner ? `${this.nm(ev.winner)} přežil` : 'Nikdo nepřežil'), win ? 'good' : 'bad', true, 2800);
    await this.sleep(2200);
    this.showOver(v);
  }

  ev_presence(ev, v) {
    this.ui.setView(v);
  }

  showOver(v) {
    if (this.screen !== 'game') return;
    const win = this.isMe(v.winner);
    const me = v.players.find((p) => p.id === v.you);
    this.ui.showOver({
      win,
      title: win ? 'Přežil jsi' : (v.winner ? 'Prohra' : 'Všichni zemřeli'),
      sub: v.winner ? (win ? 'Les tě tentokrát nechal jít.' : `${this.nm(v.winner)} odchází z lesa živý.`) : (me && !me.alive ? 'Les si vzal všechny.' : ''),
      isHost: !!this.lobby && this.lobby.host === this.you,
    });
  }

  // ------------------------------------------------------------------ globální vstupy
  bindGlobal() {
    const unlock = () => { this.audio.init(); };
    window.addEventListener('pointerdown', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') return;
      if (e.key === 'Escape' && document.querySelector('.overlay.open:not(#ovOver)')) { this.ui.closeAll(); return; }
      if (this.screen === 'game' && document.querySelector('.overlay.open')) return;
      if (this.screen === 'game' && this.ui.key(e.key)) e.preventDefault();
    });
    window.addEventListener('online', () => this.net.nudge());
    window.addEventListener('beforeunload', () => { /* session zůstává uložená pro obnovení */ });
  }
}

function boot() {
  try {
    window.__pk = new App();
  } catch (err) {
    console.error(err);
    const f = document.getElementById('fatal');
    f.innerHTML = '<div><h2>Hru se nepodařilo spustit</h2><p>' + String(err && err.message || err) + '</p><p>Otevři stránku přes http(s) – ne přímo ze souboru.</p></div>';
    f.classList.add('on');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
