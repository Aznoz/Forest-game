// Síťová vrstva: WebSocket s automatickým znovupřipojením a "probuzením" Renderu.

export function normalizeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^https:\/\//i.test(u)) u = 'wss://' + u.slice(8);
  else if (/^http:\/\//i.test(u)) u = 'ws://' + u.slice(7);
  else if (!/^wss?:\/\//i.test(u)) u = (/^(localhost|127\.|192\.168\.|10\.)/.test(u) ? 'ws://' : 'wss://') + u;
  return u.replace(/\/+$/, '');
}

export function httpUrl(wsUrl) {
  return wsUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}

export class Net {
  constructor() {
    this.url = '';
    this.ws = null;
    this.handlers = {};
    this.status = 'closed'; // closed | connecting | open
    this.wantOpen = false;
    this.tries = 0;
    this.pingTimer = null;
    this.retryTimer = null;
    this.connectTimer = null;
    this.lastMsg = 0;
  }

  on(type, fn) { this.handlers[type] = fn; return this; }
  emit(type, data) { try { this.handlers[type]?.(data); } catch (e) { console.error('net handler', type, e); } }

  setUrl(u) { this.url = normalizeUrl(u); }

  /** Probudí server (Render na free tarifu usíná) – nevadí, když to selže. */
  async wake(timeoutMs = 70000) {
    if (!this.url) return false;
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetch(httpUrl(this.url) + '/health', { signal: ctl.signal, cache: 'no-store' });
      clearTimeout(to);
      return r.ok;
    } catch { return false; }
  }

  connect() {
    this.wantOpen = true;
    if (this.ws && (this.status === 'open' || this.status === 'connecting')) return;
    if (!this.url) { this.emit('status', { state: 'nourl' }); return; }
    this.status = 'connecting';
    this.emit('status', { state: 'connecting', tries: this.tries });
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { this.status = 'closed'; this.emit('status', { state: 'error' }); this.scheduleRetry(); return; }
    this.ws = ws;
    clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => { if (this.ws === ws && this.status === 'connecting') { try { ws.close(); } catch {} } }, 25000);
    ws.onopen = () => {
      if (this.ws !== ws) return;
      clearTimeout(this.connectTimer);
      this.status = 'open';
      this.tries = 0;
      this.lastMsg = Date.now();
      this.startPing();
      this.emit('status', { state: 'open' });
      this.emit('open');
    };
    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastMsg = Date.now();
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m && m.t) this.emit(m.t, m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      clearTimeout(this.connectTimer);
      const was = this.status;
      this.ws = null;
      this.status = 'closed';
      this.stopPing();
      this.emit('status', { state: 'closed', wasOpen: was === 'open' });
      this.emit('close', { wasOpen: was === 'open' });
      if (this.wantOpen) this.scheduleRetry();
    };
    ws.onerror = () => { /* onclose se postará o zbytek */ };
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.tries++;
    const delay = Math.min(8000, 700 * Math.pow(1.6, Math.min(this.tries, 8)));
    this.emit('status', { state: 'retry', tries: this.tries, delay });
    this.retryTimer = setTimeout(() => { if (this.wantOpen) this.connect(); }, delay);
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.status !== 'open') return;
      if (Date.now() - this.lastMsg > 55000) { try { this.ws.close(); } catch {} return; }
      this.send({ t: 'ping' });
    }, 20000);
  }
  stopPing() { clearInterval(this.pingTimer); this.pingTimer = null; }

  send(obj) {
    if (this.ws && this.status === 'open') { try { this.ws.send(JSON.stringify(obj)); return true; } catch { return false; } }
    return false;
  }

  /** Úplné zavření bez dalšího znovupřipojení. */
  close() {
    this.wantOpen = false;
    clearTimeout(this.retryTimer);
    clearTimeout(this.connectTimer);
    this.stopPing();
    const ws = this.ws;
    this.ws = null;
    this.status = 'closed';
    if (ws) { try { ws.close(); } catch {} }
  }

  /** Spojení nech na pokoji, ale okamžitě se zkus připojit znovu (např. po návratu na kartu). */
  nudge() {
    if (!this.wantOpen) return;
    if (this.status === 'closed') { clearTimeout(this.retryTimer); this.connect(); }
    else if (this.status === 'open' && Date.now() - this.lastMsg > 40000) { try { this.ws.close(); } catch {} }
  }
}
