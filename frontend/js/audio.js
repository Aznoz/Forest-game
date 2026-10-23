// Zvuk celý syntetizovaný přes WebAudio – žádné zvukové soubory. Atmosféra: vítr, cvrčci, skřípání dřeva, sova, vrána.
export class Sound {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.muted = false;
    this.heartTimer = null;
    this.eventTimer = null;
  }

  /** Musí se zavolat po kliknutí uživatele (pravidlo prohlížečů). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 5;
      this.master.connect(comp); comp.connect(c.destination);
      this.out = c.createGain(); this.out.gain.value = 1; this.out.connect(this.master);

      // šum
      const nl = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, nl, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nl; i++) d[i] = Math.random() * 2 - 1;

      // dozvuk (umělá odezva lesa / prázdné místnosti)
      const rl = Math.floor(c.sampleRate * 2.4);
      const rb = c.createBuffer(2, rl, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const rd = rb.getChannelData(ch);
        for (let i = 0; i < rl; i++) rd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6);
      }
      this.reverb = c.createConvolver(); this.reverb.buffer = rb;
      const rg = c.createGain(); rg.gain.value = 0.55;
      this.reverb.connect(rg); rg.connect(this.master);

      this.startAmbient();
    } catch (err) { console.warn('audio init', err); this.ctx = null; }
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  // ------------------------------------------------------------------ stavební kameny
  _env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(freq, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const { type = 'sine', gain = 0.2, to = null, at = 0, attack = 0.005, wet = 0, dest = this.out } = o;
    const t = c.currentTime + at;
    const osc = c.createOscillator(); osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
    const g = c.createGain(); this._env(g, t, attack, gain, dur);
    osc.connect(g); g.connect(dest);
    if (wet) { const s = c.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.reverb); }
    osc.start(t); osc.stop(t + attack + dur + 0.06);
  }

  noise(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const { type = 'lowpass', f = 1000, to = null, q = 0.7, gain = 0.3, at = 0, attack = 0.003, wet = 0, dest = this.out } = o;
    const t = c.currentTime + at;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + attack + dur);
    const g = c.createGain(); this._env(g, t, attack, gain, dur);
    src.connect(fl); fl.connect(g); g.connect(dest);
    if (wet) { const s = c.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.reverb); }
    src.start(t, Math.random()); src.stop(t + attack + dur + 0.06);
  }

  // ------------------------------------------------------------------ atmosféra
  startAmbient() {
    const c = this.ctx;
    // vítr
    const wind = c.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.55;
    const wg = c.createGain(); wg.gain.value = 0.16;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = c.createGain(); lfoG.gain.value = 0.07; lfo.connect(lfoG); lfoG.connect(wg.gain);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.05;
    const lfo2G = c.createGain(); lfo2G.gain.value = 160; lfo2.connect(lfo2G); lfo2G.connect(wf.frequency);
    wind.connect(wf); wf.connect(wg); wg.connect(this.out);
    wind.start(); lfo.start(); lfo2.start();

    // hluboký hukot
    const dr = c.createGain(); dr.gain.value = 0.055;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
    [[55, 'sine'], [55.8, 'sine'], [110.4, 'triangle']].forEach(([f, t]) => {
      const o = c.createOscillator(); o.type = t; o.frequency.value = f; o.connect(lp); o.start();
    });
    lp.connect(dr); dr.connect(this.out);

    // cvrčci (velmi potichu)
    const cr = c.createOscillator(); cr.type = 'sine'; cr.frequency.value = 4300;
    const cg = c.createGain(); cg.gain.value = 0;
    const gate = c.createOscillator(); gate.type = 'square'; gate.frequency.value = 13;
    const gateG = c.createGain(); gateG.gain.value = 0.0035; gate.connect(gateG); gateG.connect(cg.gain);
    const slow = c.createOscillator(); slow.frequency.value = 0.18;
    const slowG = c.createGain(); slowG.gain.value = 0.0025; slow.connect(slowG); slowG.connect(cg.gain);
    cr.connect(cg); cg.connect(this.out);
    cr.start(); gate.start(); slow.start();

    // náhodné zvuky lesa
    const schedule = () => {
      this.eventTimer = setTimeout(() => {
        const r = Math.random();
        if (r < 0.4) this.play('creak', { quiet: true });
        else if (r < 0.65) this.play('owl');
        else if (r < 0.8) this.play('twig');
        else if (r < 0.9) this.play('caw', { quiet: true });
        schedule();
      }, 7000 + Math.random() * 11000);
    };
    schedule();
  }

  heartbeat(on, bpm = 70) {
    clearInterval(this.heartTimer); this.heartTimer = null;
    if (!on || !this.ctx) return;
    const beat = () => this.play('heart');
    beat();
    this.heartTimer = setInterval(beat, 60000 / bpm);
  }

  // ------------------------------------------------------------------ efekty
  play(name, o = {}) {
    if (!this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    try { (this.fx[name] || (() => {})).call(this, o); } catch (err) { console.warn('sfx', name, err); }
  }

  get fx() {
    return {
      click() { // cvak prázdné komory
        this.noise(0.03, { type: 'highpass', f: 2600, gain: 0.5, q: 0.8 });
        this.tone(1900, 0.03, { type: 'square', gain: 0.07 });
        this.tone(420, 0.09, { gain: 0.14, to: 180, at: 0.02 });
        this.noise(0.04, { type: 'bandpass', f: 3400, gain: 0.25, at: 0.09, q: 3 });
      },
      cock() { // natažení kohoutku
        [0, 0.09, 0.19].forEach((at, i) => {
          this.noise(0.03, { type: 'bandpass', f: 2200 + i * 500, gain: 0.35, q: 4, at });
          this.tone(300 + i * 80, 0.05, { type: 'square', gain: 0.05, at });
        });
      },
      shot() {
        this.noise(0.05, { type: 'highpass', f: 1800, gain: 1.0 });
        this.noise(0.55, { type: 'lowpass', f: 3200, to: 160, gain: 1.0, wet: 0.5 });
        this.tone(150, 0.45, { gain: 0.9, to: 38, wet: 0.2 });
        this.tone(3300, 0.9, { gain: 0.03, at: 0.05 });
      },
      ratchet() {
        for (let i = 0; i < 6; i++) this.noise(0.02, { type: 'bandpass', f: 2800, gain: 0.25, q: 5, at: i * 0.045 });
      },
      spin() {
        let t = 0;
        for (let i = 0; i < 28; i++) {
          this.noise(0.018, { type: 'bandpass', f: 2400 + (i % 2) * 400, gain: 0.22, q: 5, at: t });
          t += 0.03 + i * 0.0045;
        }
        this.tone(220, 0.9, { type: 'triangle', gain: 0.05, to: 80 });
      },
      bullet() { this.tone(2900, 0.05, { gain: 0.07 }); this.noise(0.02, { type: 'highpass', f: 4500, gain: 0.15 }); },
      insert() { this.noise(0.025, { type: 'bandpass', f: 1800, gain: 0.3, q: 4 }); this.tone(180, 0.06, { gain: 0.14, to: 90 }); },
      card() {
        this.noise(0.28, { type: 'bandpass', f: 700, to: 2600, q: 0.8, gain: 0.22 });
        this.noise(0.03, { type: 'highpass', f: 3500, gain: 0.2, at: 0.27 });
      },
      deal() { this.noise(0.12, { type: 'bandpass', f: 1500, to: 3000, q: 1, gain: 0.14 }); },
      snuff() { this.noise(0.5, { type: 'highpass', f: 1800, to: 700, gain: 0.2, attack: 0.02 }); this.tone(130, 0.3, { gain: 0.06 }); },
      heal() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.9, { gain: 0.09, at: i * 0.13, wet: 0.4 })); },
      hurt() { this.tone(75, 0.35, { gain: 0.7, to: 40 }); this.noise(0.22, { type: 'lowpass', f: 500, to: 120, gain: 0.5 }); },
      voodoo() {
        this.tone(220, 1.2, { type: 'sawtooth', gain: 0.05, to: 207, wet: 0.4, attack: 0.1 });
        this.tone(233, 1.2, { type: 'sawtooth', gain: 0.05, to: 247, wet: 0.4, attack: 0.1 });
        this.noise(1.1, { type: 'bandpass', f: 1500, to: 900, q: 6, gain: 0.07, attack: 0.2 });
        [0.5, 0.75, 1.0].forEach((at) => this.noise(0.04, { type: 'highpass', f: 4000, gain: 0.3, at }));
      },
      curse() {
        this.tone(72, 1.5, { type: 'sawtooth', gain: 0.22, to: 46, wet: 0.5, attack: 0.15 });
        this.tone(76, 1.5, { type: 'sawtooth', gain: 0.18, to: 52, wet: 0.5, attack: 0.15 });
        this.noise(1.2, { type: 'lowpass', f: 400, to: 90, gain: 0.25, attack: 0.1 });
      },
      eject() {
        this.tone(2400, 0.5, { gain: 0.1, wet: 0.3 });
        this.tone(3100, 0.3, { gain: 0.05, at: 0.35 });
        this.noise(0.04, { type: 'highpass', f: 3000, gain: 0.3 });
        this.noise(0.05, { type: 'highpass', f: 3000, gain: 0.2, at: 0.5 });
      },
      invert() {
        this.noise(0.8, { type: 'bandpass', f: 300, to: 3000, q: 1.2, gain: 0.2, attack: 0.3 });
        this.tone(220, 0.8, { gain: 0.1, to: 880, attack: 0.1, wet: 0.3 });
        this.tone(880, 0.5, { gain: 0.08, to: 110, at: 0.8, wet: 0.3 });
      },
      holy() {
        [1318, 1760, 2093, 2637].forEach((f, i) => this.tone(f, 1.3, { gain: 0.045, at: i * 0.07, wet: 0.7 }));
        this.tone(900, 0.2, { gain: 0.1, to: 300, at: 0.5 });
      },
      amulet() { this.noise(0.12, { type: 'bandpass', f: 900, gain: 0.5, q: 2 }); this.tone(330, 0.5, { gain: 0.18, to: 160, wet: 0.3 }); },
      amuletBreak() {
        this.noise(0.18, { type: 'bandpass', f: 1400, gain: 0.7, q: 1.5 });
        this.tone(260, 0.5, { gain: 0.3, to: 90, wet: 0.4 });
        for (let i = 0; i < 5; i++) this.noise(0.03, { type: 'highpass', f: 3500, gain: 0.2, at: 0.1 + i * 0.07 });
      },
      pact() {
        [110, 116.5, 164.8].forEach((f) => this.tone(f, 1.8, { type: 'sawtooth', gain: 0.07, wet: 0.5, attack: 0.2 }));
        this.noise(1.4, { type: 'highpass', f: 5000, gain: 0.08, attack: 0.2 });
      },
      steal() { this.fx.caw.call(this, {}); this.noise(0.5, { type: 'bandpass', f: 1800, to: 700, q: 1, gain: 0.12, at: 0.2 }); },
      peek() { this.noise(0.7, { type: 'bandpass', f: 3000, to: 5200, q: 3, gain: 0.08, attack: 0.15 }); this.tone(880, 0.8, { gain: 0.05, wet: 0.5, attack: 0.1 }); },
      mark() { this.tone(196, 0.9, { gain: 0.14, wet: 0.5 }); this.noise(0.06, { type: 'bandpass', f: 1200, gain: 0.2, q: 3 }); },
      turn() { this.tone(196, 1.1, { gain: 0.12, wet: 0.5 }); this.tone(392, 0.7, { gain: 0.04, wet: 0.5 }); },
      myturn() { this.tone(130.8, 1.6, { gain: 0.26, wet: 0.6 }); this.tone(261.6, 1.1, { gain: 0.1, wet: 0.6 }); this.tone(392, 0.8, { gain: 0.04, wet: 0.6, at: 0.1 }); },
      skip() { this.tone(160, 0.7, { type: 'triangle', gain: 0.14, to: 100 }); this.noise(0.3, { type: 'bandpass', f: 600, gain: 0.12 }); },
      dir() { this.noise(0.6, { type: 'bandpass', f: 500, to: 2200, q: 1, gain: 0.15, attack: 0.2 }); this.tone(300, 0.5, { gain: 0.08, to: 150 }); },
      death() {
        this.tone(140, 2.2, { gain: 0.35, to: 32, wet: 0.5, attack: 0.05 });
        this.noise(1.6, { type: 'lowpass', f: 800, to: 60, gain: 0.3, wet: 0.4 });
      },
      win() { [196, 246.9, 293.7, 392].forEach((f, i) => { this.tone(f, 2.5, { gain: 0.1, at: i * 0.35, wet: 0.7, attack: 0.05 }); this.tone(f * 2, 1.6, { gain: 0.03, at: i * 0.35, wet: 0.7 }); }); },
      lose() { [392, 349.2, 311.1, 261.6, 196].forEach((f, i) => this.tone(f, 1.6, { gain: 0.09, at: i * 0.45, wet: 0.7, type: 'triangle' })); },
      heart() { this.tone(62, 0.16, { gain: 0.55, to: 42 }); this.tone(58, 0.2, { gain: 0.4, to: 40, at: 0.17 }); },
      creak(o) {
        const g = o.quiet ? 0.05 : 0.12;
        this.tone(140 + Math.random() * 60, 0.9, { type: 'sawtooth', gain: g, to: 90 + Math.random() * 120, attack: 0.15, wet: 0.5 });
        this.noise(0.8, { type: 'bandpass', f: 500, to: 380, q: 9, gain: g * 0.8, attack: 0.15, wet: 0.3 });
      },
      owl() {
        [0, 0.55].forEach((at) => this.tone(340, 0.42, { gain: 0.07, to: 295, attack: 0.08, at, wet: 0.7 }));
        this.noise(0.9, { type: 'bandpass', f: 700, q: 4, gain: 0.015, attack: 0.1 });
      },
      twig() { this.noise(0.03, { type: 'bandpass', f: 2200, gain: 0.35, q: 3 }); this.noise(0.03, { type: 'bandpass', f: 1600, gain: 0.25, q: 3, at: 0.07 }); },
      caw(o) {
        const g = o.quiet ? 0.07 : 0.14;
        [0, 0.28, 0.54].forEach((at, i) => {
          if (i === 2 && Math.random() < 0.5) return;
          this.tone(820 - i * 70, 0.17, { type: 'sawtooth', gain: g, to: 520, at, wet: 0.5, attack: 0.02 });
          this.noise(0.15, { type: 'bandpass', f: 1300, q: 2, gain: g * 0.6, at });
        });
      },
      thunder() {
        this.noise(3.6, { type: 'lowpass', f: 260, to: 55, gain: 0.55, attack: 0.5, wet: 0.7 });
        this.tone(48, 3, { gain: 0.35, to: 30, attack: 0.4, wet: 0.5 });
      },
    };
  }
}
