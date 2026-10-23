// Uživatelské rozhraní (DOM): menu, lobby, HUD, karty v ruce, panel akcí, překryvná okna.
import { CARDS, CATS, CARD_ORDER, cardArt } from './cards.js';
import { PLAYER_COLORS } from './models.js';

const $ = (id) => document.getElementById(id);
export const colorCss = (i) => '#' + PLAYER_COLORS[((i % 4) + 4) % 4].toString(16).padStart(6, '0');

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el[k] = v;
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
  return el;
}

/** Element karty (v ruce, při zahrání, v nápovědě). */
export function cardEl(type, id) {
  const d = CARDS[type];
  const cat = CATS[d.cat];
  return h('div', { class: 'card', 'data-id': id, 'data-type': type, style: `--cc:${cat.color}` },
    h('div', { class: 'c-cat', text: cat.label }),
    h('div', { class: 'c-name', text: d.name }),
    h('div', { class: 'c-art' }, h('img', { src: cardArt(type), alt: '', draggable: 'false' })),
    h('div', { class: 'c-desc', text: d.desc }));
}

const RULES_HTML = `
<ol>
  <li><b>Cíl:</b> zůstat u stolu poslední živý. Každý hráč má svíčky – to jsou jeho životy. Zhasne-li poslední, hráč umírá.</li>
  <li><b>Revolver</b> má 6 komor. Při každém nabití jsou v něm <b>ostré</b> i <b>slepé</b> náboje. Kolik jich je, vidí všichni – <b>v jakém pořadí</b>, to ví jen válec.</li>
  <li><b>Tvůj tah:</b> můžeš zahrát libovolný počet karet a potom <b>musíš vystřelit</b> – na soupeře, nebo sám do sebe.</li>
  <li><b>Sám do sebe:</b> slepý náboj = hraješ znovu. Ostrý náboj = ztrácíš život a tah končí.</li>
  <li><b>Na soupeře:</b> tah končí vždy. Ostrý náboj ho zraní, slepý je jen cvak.</li>
  <li>Když se válec vyprázdní, <b>nabije se znovu</b> a každý živý hráč dostane 2 nové karty (v ruce máš maximálně 6).</li>
  <li>Na tah máš omezený čas. Kdo zmizí nebo mlčí, za toho zahraje autopilot.</li>
  <li><b>Ovládání:</b> klikni na kartu v ruce (zobrazí se její popis a případně cíl), potom ji zahraj. Cíl výstřelu zvolíš tlačítkem dole, nebo kliknutím na postavu u stolu.</li>
</ol>`;

const TAG = {
  skip: ['přeskočí tah', 't-bad'],
  cursed: ['proklet', 't-bad'],
  amulet: ['amulet', 't-good'],
  saw: ['pila', 't-warn'],
  dbl: ['dvojitá rána', 't-warn'],
  auto: ['autopilot', 't-dim'],
  off: ['odpojen', 't-dim'],
};

export class UI {
  /**
   * cb: { onShoot(targetId), onUse(cardId, targetId|null), onAim(id|null), onInspect? }
   */
  constructor(cb = {}) {
    this.cb = cb;
    this.view = null;
    this.locked = false;
    this.selCard = null;
    this.selTarget = null;
    this.shootTarget = null;
    this.aimed = undefined;
    this.handIds = new Set();
    this.platePos = {};
    this.deadline = 0;
    this.lastTurn = null;
    this.toastTimer = null;
    this.el = {
      plates: $('plates'), meBox: $('meBox'), hand: $('hand'), actionbar: $('actionbar'),
      banner: $('banner'), bannerText: $('bannerText'), bannerTime: $('bannerTime'),
      cylSvg: $('cylSvg'), cylCount: $('cylCount'), log: $('log'), announce: $('announce'),
      peek: $('peek'), cardplay: $('cardplay'), hudDir: $('hudDir'), hudCode: $('hudCode'),
    };
    this.buildCodex();
    this.bindOverlays();
    this.timerIv = setInterval(() => this.tick(), 250);
  }

  // ------------------------------------------------------------------ obrazovky
  setScreen(name) { document.body.dataset.screen = name; if (name !== 'game') this.hideAllTransient(); }
  hideAllTransient() { this.el.announce.innerHTML = ''; this.el.peek.innerHTML = ''; this.el.cardplay.innerHTML = ''; }

  setNetStatus(text, cls = '') { const n = $('netStatus'); n.textContent = text || ''; n.className = 'netstatus ' + cls; }

  toast(text, ms = 3200) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  setConn(text) { const c = $('conn'); if (text) { c.textContent = text; c.classList.add('on'); } else c.classList.remove('on'); }

  fatal(html) { const f = $('fatal'); f.innerHTML = html; f.classList.add('on'); }

  // ------------------------------------------------------------------ overlaye
  open(id) { $(id).classList.add('open'); }
  close(id) { $(id).classList.remove('open'); }
  isOpen(id) { return $(id).classList.contains('open'); }
  closeAll() { for (const o of document.querySelectorAll('.overlay.open')) if (o.id !== 'ovOver') o.classList.remove('open'); }

  bindOverlays() {
    for (const ov of document.querySelectorAll('.overlay')) {
      ov.addEventListener('mousedown', (e) => { if (e.target === ov && ov.id !== 'ovOver') ov.classList.remove('open'); });
      for (const b of ov.querySelectorAll('[data-close]')) b.addEventListener('click', () => ov.classList.remove('open'));
    }
    $('ovCard').addEventListener('click', () => this.close('ovCard'));
  }

  buildCodex() {
    $('rulesText').innerHTML = RULES_HTML;
    const box = $('rulesCards');
    box.innerHTML = '';
    for (const type of CARD_ORDER) {
      const d = CARDS[type];
      const cat = CATS[d.cat];
      box.appendChild(h('div', { class: 'cx' },
        h('div', { class: 'art' }, h('img', { src: cardArt(type), alt: '', draggable: 'false' })),
        h('div', null,
          h('div', { class: 'nm', text: d.name }),
          h('span', { class: 'ct', style: `--cc:${cat.color}`, text: cat.label }),
          h('div', { class: 'ds', text: d.desc }),
          d.target ? h('div', { class: 'tg', text: 'Vyžaduje cíl (jiný hráč).' }) : null)));
    }
  }

  inspect(type, note) {
    const box = $('cardInspect');
    box.innerHTML = '';
    box.appendChild(cardEl(type, 0));
    if (note) box.appendChild(h('div', { class: 'note', text: note }));
    const c = box.querySelector('.card');
    c.querySelector('.c-desc').style.display = 'block';
    this.open('ovCard');
  }

  // ------------------------------------------------------------------ lobby
  renderLobby(lobby, you) {
    if (!lobby) return;
    $('lobbyCode').textContent = lobby.code;
    const isHost = lobby.host === you;
    const ul = $('lobbyPlayers');
    ul.innerHTML = '';
    for (const p of lobby.players) {
      ul.appendChild(h('li', { style: `--c:${colorCss(p.color)}` },
        h('span', { class: 'dot' }),
        h('span', { class: 'nm', text: p.name }),
        p.id === you ? h('span', { class: 'tg', text: 'ty' }) : null,
        p.id === lobby.host ? h('span', { class: 'tg host', text: 'host' }) : null,
        p.bot ? h('span', { class: 'tg', text: 'bot' }) : null,
        !p.bot && !p.connected ? h('span', { class: 'tg', text: 'odpojen' }) : null,
        isHost && p.bot ? h('button', { class: 'x', title: 'Odebrat bota', text: '✕', onclick: () => this.cb.onRemoveBot?.(p.id) }) : null,
        isHost && !p.bot && p.id !== you ? h('button', { class: 'x', title: 'Vyhodit hráče', text: '✕', onclick: () => this.cb.onKick?.(p.id) }) : null));
    }
    for (let i = lobby.players.length; i < 4; i++) ul.appendChild(h('li', { class: 'empty' }, h('span', { class: 'dot', style: '--c:#333' }), h('span', { class: 'nm', text: 'volné místo' })));
    $('livesVal').textContent = lobby.settings.lives;
    $('lobbyHost').style.display = isHost ? 'flex' : 'none';
    $('btnAddBot').disabled = lobby.players.length >= 4;
    $('livesMinus').disabled = lobby.settings.lives <= 2;
    $('livesPlus').disabled = lobby.settings.lives >= 6;
    const start = $('btnStart');
    start.style.display = isHost ? 'block' : 'none';
    start.disabled = lobby.players.length < 2;
    $('lobbyWait').textContent = isHost
      ? (lobby.players.length < 2 ? 'Počkej na kamaráda, nebo přidej bota.' : 'Až budete připraveni, zahaj hru.')
      : 'Čekáš, až hostitel zahájí hru…';
  }

  // ------------------------------------------------------------------ hra
  me() { return this.view ? this.view.players.find((p) => p.id === this.view.you) : null; }
  isMyTurn() { const v = this.view; const m = this.me(); return !!(v && m && m.alive && v.phase === 'playing' && v.turn === v.you); }

  startGame(code) {
    this.view = null;
    this.handIds = new Set();
    this.platePos = {};
    this.selCard = this.selTarget = this.shootTarget = null;
    this.aimed = undefined;
    this.locked = false;
    this.el.log.innerHTML = '';
    this.el.hand.innerHTML = '';
    this.el.plates.innerHTML = '';
    this.hideAllTransient();
    this.el.hudCode.textContent = code ? 'KÓD ' + code : '';
    this.close('ovOver');
  }

  setLocked(b) {
    this.locked = b;
    if (this.view) { this.renderHand(); this.renderPlates(); this.renderActionBar(); }
  }

  resetSelection() { this.selCard = this.selTarget = this.shootTarget = null; }

  setView(view) {
    const prevTurn = this.lastTurn;
    this.view = view;
    this.lastTurn = view.turn;
    const me = this.me();
    if (prevTurn !== view.turn) this.resetSelection();
    if (this.selCard && !(me && me.hand.some((c) => c.id === this.selCard))) { this.selCard = null; this.selTarget = null; }
    if (!this.isMyTurn()) this.resetSelection();
    this.renderAll();
  }

  renderAll() {
    this.renderBanner();
    this.renderPlates();
    this.renderMe();
    this.renderCyl();
    this.renderHand();
    this.renderActionBar();
  }

  tagList(p) {
    const keys = [];
    if (p.skip) keys.push('skip');
    if (p.cursed) keys.push('cursed');
    if (p.amulet) keys.push('amulet');
    if (p.saw) keys.push('saw');
    if (p.dbl) keys.push('dbl');
    if (p.connected === false) keys.push('off');
    else if (p.auto && !p.bot) keys.push('auto');
    return keys.map((k) => h('span', { class: 'tag ' + TAG[k][1], text: TAG[k][0] }));
  }

  pips(p) {
    const box = h('div', { class: 'pips' });
    for (let i = 0; i < p.maxHp; i++) box.appendChild(h('span', { class: 'pip ' + (i < p.hp ? 'on' : 'off') }));
    return box;
  }

  renderBanner() {
    const v = this.view;
    const b = this.el.banner;
    if (!v) return;
    this.el.hudDir.textContent = v.dir === 1 ? '↻' : '↺';
    if (v.phase === 'over') { this.el.bannerText.textContent = 'Konec hry'; b.classList.remove('mine'); return; }
    const cur = v.players.find((p) => p.id === v.turn);
    const mine = v.turn === v.you;
    this.el.bannerText.textContent = mine ? 'Tvůj tah' : `Na tahu: ${cur ? cur.name : '?'}${cur && cur.auto && !cur.bot ? ' (autopilot)' : ''}`;
    b.classList.toggle('mine', mine);
  }

  setTimer(ms) { this.deadline = ms > 0 ? Date.now() + ms : 0; this.tick(); }
  tick() {
    const bt = this.el.bannerTime;
    if (!this.view || this.view.phase !== 'playing' || !this.deadline) { if (bt.textContent) bt.textContent = ''; return; }
    const left = Math.max(0, this.deadline - Date.now());
    const s = Math.ceil(left / 1000);
    bt.textContent = s + ' s';
    this.el.banner.classList.toggle('urgent', s <= 10);
  }

  renderPlates() {
    const v = this.view;
    const box = this.el.plates;
    box.innerHTML = '';
    if (!v) return;
    const targets = this.currentTargets();
    const picked = this.currentPick();
    for (const p of v.players) {
      if (p.id === v.you) continue;
      const plate = h('div', { class: 'plate' + (p.alive ? '' : ' dead') + (v.turn === p.id && p.alive && v.phase === 'playing' ? ' turn' : '') + (targets.includes(p.id) ? ' targetable' : '') + (picked === p.id ? ' picked' : ''), 'data-id': p.id, style: `--c:${colorCss(p.color)}` },
        h('div', { class: 'pname', text: p.name }),
        p.alive ? this.pips(p) : h('div', { class: 'pips' }, h('span', { class: 'tag t-dim', text: 'mrtvý' })),
        h('div', { class: 'tags' }, this.tagList(p)));
      if (p.alive && p.hand.length) {
        const mh = h('div', { class: 'minihand' });
        for (const c of p.hand) {
          const d = CARDS[c.type];
          mh.appendChild(h('div', { class: 'mini', style: `--cc:${CATS[d.cat].color}`, title: d.name, onclick: (e) => { e.stopPropagation(); this.inspect(c.type, `${p.name} drží tuto kartu.`); } },
            h('img', { src: cardArt(c.type), alt: '', draggable: 'false' })));
        }
        plate.appendChild(mh);
      }
      plate.addEventListener('click', () => this.pickTarget(p.id));
      const pos = this.platePos[p.id];
      if (pos) { plate.style.left = pos.x + 'px'; plate.style.top = pos.y + 'px'; plate.style.display = pos.visible ? '' : 'none'; } else plate.style.display = 'none';
      box.appendChild(plate);
    }
  }

  /** Voláno každý snímek: připne jmenovky k postavám. */
  updatePlates(scene) {
    if (!this.view) return;
    for (const el of this.el.plates.children) {
      const id = el.dataset.id;
      const p = scene.screenPos(id, 2.3);
      if (!p || !p.visible) { el.style.display = 'none'; this.platePos[id] = { x: 0, y: 0, visible: false }; continue; }
      const old = this.platePos[id];
      if (!old || Math.abs(old.x - p.x) > 0.5 || Math.abs(old.y - p.y) > 0.5 || !old.visible) {
        el.style.left = p.x.toFixed(1) + 'px';
        el.style.top = p.y.toFixed(1) + 'px';
        this.platePos[id] = { x: p.x, y: p.y, visible: true };
      }
      if (el.style.display === 'none') el.style.display = '';
    }
  }

  renderMe() {
    const m = this.me();
    const box = this.el.meBox;
    if (!m) { box.innerHTML = ''; return; }
    box.style.setProperty('--c', colorCss(m.color));
    box.classList.toggle('turn', this.isMyTurn());
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'pname', text: m.name + ' (ty)' }));
    box.appendChild(m.alive ? this.pips(m) : h('div', { class: 'tags' }, h('span', { class: 'tag t-bad', text: 'zemřel jsi' })));
    box.appendChild(h('div', { class: 'tags' }, this.tagList(m)));
  }

  renderCyl() {
    const v = this.view;
    if (!v) return;
    const c = v.cyl;
    const spent = c.spent || [];
    let svg = '<circle cx="80" cy="80" r="74" fill="#12100c" stroke="#5a4e3a" stroke-width="2"/><circle cx="80" cy="80" r="66" fill="none" stroke="#2a241b" stroke-width="1"/>';
    for (let i = 0; i < c.cap; i++) {
      const a = (i * 60 - 90) * Math.PI / 180;
      const x = 80 + Math.cos(a) * 46, y = 80 + Math.sin(a) * 46;
      let fill = '#0a0908', stroke = '#4a4030', mark = '', sw = 1.5;
      if (i < spent.length) {
        if (spent[i]) { fill = '#48100b'; stroke = '#6e2a22'; } else { fill = '#24282b'; stroke = '#3e4449'; }
        mark = `<path d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}" stroke="${spent[i] ? '#a04a3c' : '#6a7378'}" stroke-width="2" opacity=".8"/>`;
      } else {
        const j = i - spent.length;
        const k = c.known ? c.known[j] : null;
        if (k === true) { fill = '#a42a1b'; stroke = '#e0604c'; mark = `<circle cx="${x}" cy="${y}" r="7" fill="#e7a05a"/>`; }
        else if (k === false) { fill = '#6c757b'; stroke = '#aab3b8'; mark = `<circle cx="${x}" cy="${y}" r="7" fill="#c9d0d4"/>`; }
        else mark = `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" fill="#6a604e" font-family="serif">?</text>`;
        if (j === 0) { stroke = '#f0d9a8'; sw = 3; }
      }
      svg += `<circle cx="${x}" cy="${y}" r="17" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>${mark}`;
    }
    svg += '<polygon points="80,2 73,-8 87,-8" fill="#f0d9a8" opacity="0"/>';
    svg += `<circle cx="80" cy="80" r="15" fill="#1a1612" stroke="#5a4e3a" stroke-width="2"/><text x="80" y="86" text-anchor="middle" font-size="17" fill="#cbbf9f" font-family="serif">${c.remaining}</text>`;
    this.el.cylSvg.innerHTML = svg;
    const t = c.uncertain ? '~' : '';
    this.el.cylCount.innerHTML = `<span class="lv">ostré <b>${t}${c.live}</b></span> · <span class="bl">slepé <b>${t}${c.blank}</b></span><br>Nabití č. ${v.loadNo}`;
  }

  renderHand() {
    const m = this.me();
    const box = this.el.hand;
    if (!m) { box.innerHTML = ''; return; }
    const have = new Set(m.hand.map((c) => c.id));
    for (const el of [...box.children]) if (!have.has(+el.dataset.id)) el.remove();
    const myTurn = this.isMyTurn();
    let newIdx = 0;
    const els = [];
    for (const c of m.hand) {
      let el = box.querySelector(`.card[data-id="${c.id}"]`);
      if (!el) {
        el = cardEl(c.type, c.id);
        el.addEventListener('click', () => this.clickCard(+el.dataset.id));
        if (!this.handIds.has(c.id)) { el.classList.add('dealt'); el.style.animationDelay = (newIdx++ * 0.12) + 's'; }
      }
      this.handIds.add(c.id);
      const info = this.view.use[c.id];
      el.classList.toggle('sel', this.selCard === c.id);
      el.classList.toggle('dim', myTurn && info && !info.ok);
      els.push(el);
    }
    els.forEach((el, i) => { if (box.children[i] !== el) box.insertBefore(el, box.children[i] || null); });
  }

  clickCard(id) {
    const m = this.me();
    if (!m) return;
    const card = m.hand.find((c) => c.id === id);
    if (!card) return;
    if (this.isMyTurn() && !this.locked) {
      this.selCard = this.selCard === id ? null : id;
      this.selTarget = null;
      this.renderHand(); this.renderPlates(); this.renderActionBar();
    } else {
      this.inspect(card.type);
    }
  }

  // --- výběr cílů
  shootTargets() {
    const v = this.view, m = this.me();
    if (!v || !m) return [];
    if (m.cursed) return [m.id];
    return v.players.filter((p) => p.alive).map((p) => p.id);
  }

  currentTargets() {
    if (!this.isMyTurn() || this.locked) return [];
    if (this.selCard) {
      const info = this.view.use[this.selCard];
      const def = CARDS[this.me().hand.find((c) => c.id === this.selCard)?.type];
      return info && info.ok && def && def.target ? info.targets.filter((t) => t !== this.view.you) : [];
    }
    return this.shootTargets().filter((t) => t !== this.view.you);
  }

  currentPick() { return this.selCard ? this.selTarget : this.shootTarget; }

  pickTarget(id) {
    if (!id || !this.isMyTurn() || this.locked) return;
    if (this.selCard) {
      const info = this.view.use[this.selCard];
      if (info && info.ok && info.targets.includes(id)) this.selTarget = id;
    } else if (this.shootTargets().includes(id)) {
      this.shootTarget = id;
    }
    this.renderPlates(); this.renderActionBar();
  }

  setAim(id) {
    if (this.aimed === id) return;
    this.aimed = id;
    this.cb.onAim?.(id);
  }

  chip(p, label, selected, onclick) {
    return h('button', { class: 'chip' + (selected ? ' sel' : ''), style: `--c:${colorCss(p.color)}`, onclick },
      h('span', { class: 'cdot' }), label);
  }

  renderActionBar() {
    const v = this.view, m = this.me();
    const bar = this.el.actionbar;
    bar.innerHTML = '';
    if (!this.isMyTurn() || this.locked) { bar.className = 'hidden'; if (!this.isMyTurn()) this.setAim(null); return; }
    bar.className = '';
    const sel = this.selCard ? m.hand.find((c) => c.id === this.selCard) : null;

    if (sel) {
      this.setAim(null);
      const def = CARDS[sel.type];
      const info = v.use[sel.id];
      bar.appendChild(h('div', { class: 'ab-card' },
        h('div', null,
          h('div', { class: 'nm', text: def.name }),
          h('div', { class: 'ds', text: def.desc }),
          info && !info.ok ? h('div', { class: 'why', text: info.why }) : null)));
      if (info && info.ok) {
        if (def.target) {
          bar.appendChild(h('span', { class: 'ab-title', text: 'Cíl:' }));
          for (const t of info.targets) {
            const p = v.players.find((x) => x.id === t);
            bar.appendChild(this.chip(p, p.name, this.selTarget === t, () => { this.selTarget = t; this.renderPlates(); this.renderActionBar(); }));
          }
        }
        const ok = !def.target || !!this.selTarget;
        bar.appendChild(h('button', { class: 'fire', text: 'Zahrát kartu', disabled: ok ? null : true, onclick: () => this.doUse() }));
      }
      bar.appendChild(h('button', { class: 'ghostbtn', text: 'Zrušit', onclick: () => { this.selCard = null; this.selTarget = null; this.renderHand(); this.renderPlates(); this.renderActionBar(); } }));
      return;
    }

    const targets = this.shootTargets();
    if (m.cursed && this.shootTarget !== m.id) this.shootTarget = m.id;
    if (this.shootTarget && !targets.includes(this.shootTarget)) this.shootTarget = null;
    bar.appendChild(h('span', { class: 'ab-title' }, m.cursed ? 'Jsi proklet – ' : '', h('b', { text: 'vyber cíl' }), ' a vystřel:'));
    for (const t of targets) {
      const p = v.players.find((x) => x.id === t);
      bar.appendChild(this.chip(p, t === m.id ? 'Sám do sebe' : p.name, this.shootTarget === t, () => { this.shootTarget = t; this.renderPlates(); this.renderActionBar(); }));
    }
    bar.appendChild(h('button', { class: 'fire', text: m.dbl ? 'Vystřelit ×2' : 'Vystřelit', disabled: this.shootTarget ? null : true, onclick: () => this.doShoot() }));
    this.setAim(this.shootTarget);
  }

  doShoot() {
    if (!this.shootTarget || this.locked) return;
    const t = this.shootTarget;
    this.shootTarget = null;
    this.setLocked(true);
    this.setAim(null);
    this.cb.onShoot?.(t);
  }

  doUse() {
    if (!this.selCard || this.locked) return;
    const def = CARDS[this.me().hand.find((c) => c.id === this.selCard)?.type];
    if (def && def.target && !this.selTarget) return;
    const id = this.selCard, t = def && def.target ? this.selTarget : null;
    this.selCard = this.selTarget = null;
    this.setLocked(true);
    this.setAim(null);
    this.cb.onUse?.(id, t);
  }

  /** Klávesové zkratky: Enter = potvrdit, Esc = zrušit výběr karty. */
  key(k) {
    if (!this.isMyTurn() || this.locked) return false;
    if (k === 'Escape' && this.selCard) { this.selCard = this.selTarget = null; this.renderHand(); this.renderPlates(); this.renderActionBar(); return true; }
    if (k === 'Enter') { if (this.selCard) this.doUse(); else this.doShoot(); return true; }
    return false;
  }

  // ------------------------------------------------------------------ efekty a hlášky
  announce(text, cls = '', big = false, ms = 1700) {
    const a = h('div', { class: 'ann ' + cls + (big ? ' big' : ''), text });
    a.style.animationDuration = (ms / 1000) + 's';
    this.el.announce.innerHTML = '';
    this.el.announce.appendChild(a);
    setTimeout(() => a.remove(), ms + 100);
  }

  cardPlay(type, caption, ms = 1300, fromMe = false) {
    const box = this.el.cardplay;
    box.innerHTML = '';
    const card = cardEl(type, 0);
    card.classList.add('cp');
    card.style.setProperty('--dur', (ms / 1000) + 's');
    card.style.setProperty('--fy', fromMe ? '260px' : '-240px');
    card.querySelector('.c-desc').style.display = 'block';
    const cap = h('div', { class: 'cp-cap', text: caption });
    cap.style.setProperty('--dur', (ms / 1000) + 's');
    box.append(card, cap);
    setTimeout(() => { card.remove(); cap.remove(); }, ms + 100);
  }

  peek(vals, ms = 2200) {
    const box = this.el.peek;
    box.innerHTML = '';
    vals.forEach((live, i) => {
      const d = h('div', { class: 'pk ' + (live ? 'live' : 'blank') },
        h('small', { text: vals.length > 1 ? (i === 0 ? 'nyní' : 'další') : 'v komoře' }),
        h('b', { text: live ? 'OSTRÝ' : 'SLEPÝ' }));
      d.style.animationDuration = (ms / 1000) + 's';
      box.appendChild(d);
      setTimeout(() => d.remove(), ms + 100);
    });
  }

  log(text, cls = '') {
    const l = this.el.log;
    l.insertBefore(h('div', { class: 'll ' + cls, text }), l.firstChild);
    while (l.children.length > 30) l.removeChild(l.lastChild);
  }

  fx(kind) {
    const f = $('fx-flash');
    f.className = '';
    void f.offsetWidth;
    f.className = kind;
  }

  hurt() {
    const f = $('fx-hurt');
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  // ------------------------------------------------------------------ konec hry
  showOver({ win, title, sub, isHost }) {
    const t = $('overTitle');
    t.textContent = title;
    t.className = 'over-title' + (win ? '' : ' lose');
    $('overSub').textContent = sub;
    $('btnAgain').style.display = isHost ? 'block' : 'none';
    $('overWait').textContent = isHost ? '' : 'Hostitel může zahájit další hru.';
    this.open('ovOver');
  }
  hideOver() { this.close('ovOver'); }
}
