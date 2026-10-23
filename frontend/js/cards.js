// Karty: názvy, popisky a ilustrace (SVG kreslené kódem – žádné obrázky navíc).
// Tento soubor nesmí sahat na DOM (importuje ho i test na serveru).

export const CATS = {
  attack: { label: 'ÚTOK', color: '#9a3022' },
  info:   { label: 'INFORMACE', color: '#62829c' },
  chaos:  { label: 'CHAOS', color: '#a88a3c' },
  heal:   { label: 'LÉČENÍ', color: '#648a48' },
  guard:  { label: 'OCHRANA', color: '#4f8493' },
  curse:  { label: 'KLETBA', color: '#836296' },
  risk:   { label: 'RIZIKO', color: '#8d3c32' },
};

export const CARDS = {
  voodoo:   { name: 'Voodoo panenka',    cat: 'curse',  target: true,  desc: 'Vyber hráče. Jeho příští tah bude zcela přeskočen.' },
  double:   { name: 'Dvojitá rána',      cat: 'attack', desc: 'Tvůj příští výstřel vypálí dva náboje najednou. Počítají se všechny ostré.' },
  saw:      { name: 'Rezavá pila',       cat: 'attack', desc: 'Příští ostrý výstřel způsobí dvojnásobné zranění.' },
  eye:      { name: 'Vraní oko',         cat: 'info',   desc: 'Tajně se podíváš, jaký náboj je právě v komoře.' },
  skull:    { name: 'Věštecká lebka',    cat: 'info',   desc: 'Tajně uvidíš náboj v komoře i ten následující.' },
  spin:     { name: 'Zatočit válec',     cat: 'chaos',  desc: 'Zamíchá zbývající náboje. Všechny dosud získané vědomosti propadají.' },
  eject:    { name: 'Vytřást komoru',    cat: 'chaos',  desc: 'Vyhodí aktuální náboj. Všichni uvidí, jaký byl.' },
  cross:    { name: 'Obrácený kříž',     cat: 'chaos',  desc: 'Obrátí aktuální náboj: ostrý se stane slepým a naopak. Ostatní to nepoznají.' },
  herb:     { name: 'Lesní bylina',      cat: 'heal',   desc: 'Vyléčí 1 život.' },
  amanita:  { name: 'Muchomůrka',        cat: 'risk',   desc: '50 %: +2 životy. 50 %: −1 život. Nejde použít při posledním životě.' },
  amulet:   { name: 'Kostěný amulet',    cat: 'guard',  desc: 'Příští zranění, které utržíš, tě nezraní. Amulet se rozpadne.' },
  pact:     { name: 'Krvavý pakt',       cat: 'risk',   desc: 'Obětuješ 1 život a dobereš 2 nové karty.' },
  thief:    { name: 'Vrána zlodějka',    cat: 'curse',  target: true,  desc: 'Ukradne náhodnou kartu vybranému hráči.' },
  curse:    { name: 'Kletba',            cat: 'curse',  target: true,  desc: 'Vybraný hráč musí svůj příští výstřel namířit sám na sebe.' },
  holy:     { name: 'Svěcená voda',      cat: 'guard',  desc: 'Přidá do válce jeden slepý náboj (jen když válec není plný).' },
  pendulum: { name: 'Zlověstné kyvadlo', cat: 'chaos',  desc: 'Obrátí směr tahů. Má smysl od tří hráčů.' },
};

export const CARD_ORDER = ['eye', 'skull', 'double', 'saw', 'voodoo', 'curse', 'thief', 'herb', 'amanita', 'amulet', 'holy', 'pact', 'eject', 'spin', 'cross', 'pendulum'];

// ------------------------------------------------------------------ ilustrace
const wrap = (inner, a = '#2c2721', b = '#0e0c0a') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140">
<defs>
<radialGradient id="bg" cx="50%" cy="45%" r="78%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/></filter>
</defs>
<rect width="200" height="140" fill="url(#bg)"/>${inner}<rect width="200" height="140" filter="url(#n)" opacity="0.5"/></svg>`;

const bullet = (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})">
<rect x="-13" y="48" width="26" height="62" rx="4" fill="#a98a45"/><rect x="-13" y="48" width="26" height="9" fill="#6d5628"/><rect x="-13" y="100" width="26" height="10" rx="3" fill="#7d6532"/>
<path d="M-13 48 Q-13 14 0 4 Q13 14 13 48 Z" fill="#a85a30"/><path d="M-6 44 Q-6 22 0 12" stroke="#e8b080" stroke-width="2.4" opacity=".5" fill="none"/>
<path d="M7 50 L7 108" stroke="#2a2010" stroke-width="3" opacity=".35"/></g>`;

const ART = {
  voodoo: () => wrap(`
<circle cx="158" cy="28" r="15" fill="#aab4c4" opacity=".28"/>
<ellipse cx="100" cy="132" rx="62" ry="6" fill="#000" opacity=".45"/>
<path d="M56 74 L86 62 M144 74 L114 62" stroke="#8a7a58" stroke-width="11" stroke-linecap="round"/>
<path d="M91 102 L84 128 M109 102 L116 128" stroke="#8a7a58" stroke-width="12" stroke-linecap="round"/>
<path d="M80 62 Q100 54 120 62 L124 102 Q100 110 76 102 Z" fill="#8d7d5a" stroke="#241c10" stroke-width="2"/>
<circle cx="100" cy="42" r="19" fill="#9c8c6a" stroke="#241c10" stroke-width="2"/>
<path d="M90 37l7 7M97 37l-7 7M103 37l7 7M110 37l-7 7" stroke="#0a0806" stroke-width="2.4"/>
<path d="M91 53h18" stroke="#0a0806" stroke-width="2"/><path d="M93 50v6M97 50v6M101 50v6M105 50v6M109 50v6" stroke="#0a0806" stroke-width="1.4"/>
<path d="M100 62 Q88 82 100 102" stroke="#8c1c13" stroke-width="1.8" fill="none" stroke-dasharray="4 3"/>
<g stroke="#cfcfcf" stroke-width="2.2"><path d="M66 84 L96 78"/><path d="M134 92 L104 85"/><path d="M124 70 L108 84"/></g>
<g fill="#b3261c"><circle cx="64" cy="84.5" r="4"/><circle cx="136" cy="92.5" r="4"/><circle cx="126" cy="68.5" r="4"/></g>`),

  double: () => wrap(`
<circle cx="100" cy="64" r="58" fill="#7a1a10" opacity=".32"/>
<ellipse cx="100" cy="132" rx="70" ry="7" fill="#000" opacity=".5"/>
${bullet(64, 18, 0.9)}${bullet(120, 18, 0.9)}
<text x="150" y="40" font-family="Georgia,serif" font-weight="bold" font-size="30" fill="#d3c08a" opacity=".85">×2</text>`),

  saw: () => {
    let teeth = '';
    for (let i = 0; i < 17; i++) {
      const x = 24 + i * 8.4; const y = 93.5 - (x - 20) * (8 / 148);
      teeth += `L${x.toFixed(1)} ${y.toFixed(1)} L${(x + 4.2).toFixed(1)} ${(y + 10).toFixed(1)} L${(x + 8.4).toFixed(1)} ${(y - 0.4).toFixed(1)} `;
    }
    return wrap(`
<ellipse cx="100" cy="128" rx="80" ry="6" fill="#000" opacity=".45"/>
<path d="M20 70 L168 52 L168 86 ${teeth} L20 94 Z" fill="#82786a" stroke="#241f19" stroke-width="2"/>
<path d="M26 74 L164 58" stroke="#b5aa98" stroke-width="2" opacity=".45"/>
<path d="M168 50 L196 46 L196 92 L168 88 Z" fill="#4d3421" stroke="#1d130b" stroke-width="2"/>
<circle cx="180" cy="62" r="3" fill="#9a8a6a"/><circle cx="180" cy="76" r="3" fill="#9a8a6a"/>
<g fill="#8a4a22" opacity=".55"><circle cx="50" cy="78" r="6"/><circle cx="92" cy="72" r="9"/><circle cx="130" cy="68" r="7"/><circle cx="72" cy="85" r="4"/></g>
<path d="M60 104 q-3 12 0 24 M104 100 q-3 14 0 26 M140 98 q-2 10 0 18" stroke="#7a1410" stroke-width="3.5" stroke-linecap="round" fill="none"/>
<circle cx="60" cy="128" r="3" fill="#7a1410"/><circle cx="104" cy="126" r="3" fill="#7a1410"/>`);
  },

  eye: () => {
    let feathers = '';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2; const r1 = 46, r2 = 110;
      const x1 = 100 + Math.cos(a) * r1, y1 = 70 + Math.sin(a) * r1 * 0.7, x2 = 100 + Math.cos(a) * r2, y2 = 70 + Math.sin(a) * r2 * 0.75;
      feathers += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${((x1 + x2) / 2 + 6).toFixed(1)} ${((y1 + y2) / 2 - 5).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#050505" stroke-width="${(3 + (i % 3)).toString()}" opacity=".85" fill="none"/>`;
    }
    return wrap(`${feathers}
<defs><radialGradient id="iris"><stop offset="0" stop-color="#e0b04a"/><stop offset=".65" stop-color="#9a6a1e"/><stop offset="1" stop-color="#3a2408"/></radialGradient></defs>
<path d="M30 70 Q100 8 170 70 Q100 132 30 70 Z" fill="#0b0a09" stroke="#3b3228" stroke-width="3"/>
<circle cx="100" cy="70" r="35" fill="url(#iris)"/>
<ellipse cx="100" cy="70" rx="12" ry="27" fill="#030302"/>
<circle cx="89" cy="56" r="6.5" fill="#f4e8c4" opacity=".9"/><circle cx="112" cy="84" r="3" fill="#f4e8c4" opacity=".5"/>
<path d="M30 70 Q100 8 170 70" stroke="#6a5a44" stroke-width="2" fill="none" opacity=".6"/>`, '#26221c', '#080706');
  },

  skull: () => wrap(`
<circle cx="100" cy="76" r="60" fill="#8fa3b8" opacity=".12"/>
<g transform="translate(0,12)">
<rect x="94" y="-6" width="12" height="26" fill="#d7ceb0"/><path d="M94 -4 q-4 8 -1 16 M106 0 q3 6 0 14" stroke="#b9ae8c" stroke-width="2" fill="none"/>
<path d="M100 -22 Q92 -10 100 -6 Q108 -10 100 -22Z" fill="#ffd27a"/>
<path d="M60 70 Q60 22 100 22 Q140 22 140 70 Q140 90 128 98 L128 116 L72 116 L72 98 Q60 90 60 70 Z" fill="#cfc6ae" stroke="#2a251c" stroke-width="2.5"/>
<ellipse cx="82" cy="72" rx="13.5" ry="15.5" fill="#080706"/><ellipse cx="118" cy="72" rx="13.5" ry="15.5" fill="#080706"/>
<path d="M82 82 Q75 70 82 58 Q89 70 82 82Z" fill="#ffd27a"/><path d="M118 82 Q111 70 118 58 Q125 70 118 82Z" fill="#ffd27a"/>
<path d="M100 88 L93 101 L107 101 Z" fill="#080706"/>
<path d="M80 116v-12M88 116v-12M96 116v-12M104 116v-12M112 116v-12M120 116v-12" stroke="#2a251c" stroke-width="2.4"/>
<path d="M66 50 Q70 36 84 30" stroke="#f1ead4" stroke-width="3" opacity=".4" fill="none"/>
</g>`),

  spin: () => {
    let holes = '';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      const x = Math.cos(a) * 31, y = Math.sin(a) * 31;
      holes += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="#050505" stroke="#7a7e82" stroke-width="2"/>`;
      const fa = a + Math.PI / 6;
      holes += `<path d="M${(Math.cos(fa) * 40).toFixed(1)} ${(Math.sin(fa) * 40).toFixed(1)} L${(Math.cos(fa) * 49).toFixed(1)} ${(Math.sin(fa) * 49).toFixed(1)}" stroke="#202325" stroke-width="5"/>`;
    }
    return wrap(`
<g transform="translate(100,70)">
<circle r="52" fill="#4b4f52" stroke="#16181a" stroke-width="4"/>
<circle r="52" fill="none" stroke="#7d8286" stroke-width="2" opacity=".5" stroke-dasharray="6 5"/>
${holes}
<circle r="12" fill="#2a2d2f" stroke="#111" stroke-width="3"/><circle r="4" fill="#9a9ea2"/>
</g>
<g stroke="#d1bf8a" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9">
<path d="M34 28 A74 74 0 0 1 82 6"/><path d="M166 112 A74 74 0 0 1 118 134"/></g>
<path d="M82 6 l-12 -2 l7 12z" fill="#d1bf8a"/><path d="M118 134 l12 2 l-7 -12z" fill="#d1bf8a"/>`, '#2a2823', '#0b0b0a');
  },

  eject: () => wrap(`
<ellipse cx="100" cy="132" rx="72" ry="6" fill="#000" opacity=".5"/>
<path d="M20 134 Q30 90 62 82 L96 112 Q70 120 66 134 Z" fill="#4b4f52" stroke="#16181a" stroke-width="3"/>
<circle cx="52" cy="118" r="9" fill="#050505"/>
<g transform="translate(128,44) rotate(38)">
<rect x="-10" y="-30" width="20" height="46" rx="3" fill="#a98a45"/><rect x="-10" y="-30" width="20" height="7" fill="#6d5628"/>
<rect x="-10" y="-34" width="20" height="5" fill="#2b2a27"/>
</g>
<path d="M70 100 Q96 40 124 40" stroke="#d1bf8a" stroke-width="3" fill="none" stroke-dasharray="3 6" stroke-linecap="round"/>
<path d="M124 40 l-10 -8 l-2 14 z" fill="#d1bf8a"/>
<g fill="#ffc070"><circle cx="150" cy="30" r="2.6"/><circle cx="158" cy="48" r="2"/><circle cx="142" cy="66" r="2.4"/><circle cx="168" cy="38" r="1.6"/><circle cx="118" cy="20" r="1.8"/></g>
<path d="M80 96 q-6 -14 4 -26 q-2 10 8 14" fill="#8a8a8a" opacity=".45"/>`),

  cross: () => wrap(`
<circle cx="100" cy="72" r="58" fill="#6a1c3a" opacity=".3"/>
<ellipse cx="100" cy="132" rx="50" ry="5" fill="#000" opacity=".5"/>
<rect x="91" y="8" width="18" height="118" fill="#5b4630" stroke="#1f160c" stroke-width="2.5"/>
<rect x="62" y="86" width="76" height="17" fill="#5b4630" stroke="#1f160c" stroke-width="2.5"/>
<path d="M96 14 L98 60 L94 96 M104 30 L102 70 M70 92 L112 94" stroke="#b6442a" stroke-width="2" fill="none" opacity=".85"/>
<path d="M95 12v110M104 12v110" stroke="#2a1d10" stroke-width="1.2" opacity=".6"/>
<path d="M62 96 Q40 100 36 124 M138 96 Q160 100 164 124" stroke="#6f7478" stroke-width="3.5" fill="none" stroke-dasharray="7 4"/>
<g fill="#b6442a" opacity=".8"><circle cx="100" cy="22" r="2.4"/><circle cx="100" cy="112" r="2.4"/></g>`, '#2c2024', '#0a0708'),

  herb: () => wrap(`
<ellipse cx="100" cy="132" rx="64" ry="6" fill="#000" opacity=".45"/>
<path d="M100 130 Q96 90 102 54 Q106 32 100 12" stroke="#3f5a32" stroke-width="4" fill="none"/>
<g fill="#5f8244" stroke="#25361c" stroke-width="1.5">
<path d="M99 110 Q70 108 56 88 Q82 86 99 110Z"/><path d="M101 96 Q132 92 146 70 Q118 70 101 96Z"/>
<path d="M99 78 Q72 74 62 54 Q88 54 99 78Z"/><path d="M102 62 Q128 58 138 38 Q114 40 102 62Z"/>
<path d="M100 40 Q84 34 80 18 Q96 22 100 40Z"/><path d="M101 36 Q116 30 120 14 Q104 18 101 36Z"/></g>
<g stroke="#2b4120" stroke-width="1.3" fill="none"><path d="M99 110 Q76 98 60 90"/><path d="M101 96 Q126 84 142 72"/><path d="M99 78 Q78 68 66 56"/><path d="M102 62 Q124 52 134 40"/></g>
<g fill="#8d2a22" stroke="#3a0d0a" stroke-width="1"><circle cx="112" cy="110" r="5"/><circle cx="122" cy="116" r="4.5"/><circle cx="88" cy="120" r="4"/></g>
<path d="M30 130 q4 -18 8 0 M44 132 q3 -14 7 0 M150 130 q4 -20 9 0 M164 132 q3 -12 6 0" stroke="#33482a" stroke-width="2" fill="none"/>`, '#1f2a1d', '#080b07'),

  amanita: () => wrap(`
<ellipse cx="100" cy="132" rx="66" ry="6" fill="#000" opacity=".45"/>
<path d="M86 74 Q82 116 76 128 L124 128 Q118 116 114 74 Z" fill="#cdc2a3" stroke="#3a3322" stroke-width="2"/>
<ellipse cx="100" cy="82" rx="18" ry="5" fill="#b4a888" stroke="#3a3322" stroke-width="1.5"/>
<path d="M36 78 Q34 18 100 18 Q166 18 164 78 Q100 94 36 78 Z" fill="#8c2b23" stroke="#2e0f0b" stroke-width="2.5"/>
<g fill="#e5dbbf" opacity=".92"><circle cx="70" cy="46" r="8"/><circle cx="104" cy="34" r="9"/><circle cx="134" cy="52" r="7.5"/><circle cx="88" cy="64" r="5.5"/><circle cx="120" cy="72" r="5"/><circle cx="56" cy="68" r="4.5"/><circle cx="148" cy="70" r="4"/></g>
<path d="M44 80 Q100 98 156 80" stroke="#3a1410" stroke-width="2" fill="none" opacity=".7"/>
<path d="M20 130 q4 -22 9 0 M36 132 q3 -16 7 0 M142 130 q4 -24 9 0 M160 132 q4 -14 8 0 M176 130 q3 -18 8 0" stroke="#33482a" stroke-width="2" fill="none"/>`, '#262019', '#0a0807'),

  amulet: () => wrap(`
<circle cx="100" cy="84" r="58" fill="#6f95b8" opacity=".14"/>
<path d="M56 -4 Q100 74 144 -4" stroke="#3a2c1c" stroke-width="5" fill="none"/>
<path d="M56 -4 Q100 74 144 -4" stroke="#6a5438" stroke-width="1.5" fill="none" stroke-dasharray="3 5"/>
<circle cx="100" cy="84" r="40" fill="#241f18" stroke="#d1c8b0" stroke-width="8"/>
<circle cx="100" cy="84" r="46" fill="none" stroke="#86abc9" stroke-width="2.5" opacity=".5"/>
<path d="M100 56 L100 112 M82 70 L100 84 L118 70 M84 100 L100 88 L116 100" stroke="#d1c8b0" stroke-width="4.5" stroke-linecap="round" fill="none"/>
<g stroke="#d1c8b0" stroke-width="5" stroke-linecap="round"><path d="M62 52 L70 60"/><path d="M138 52 L130 60"/><path d="M62 116 L70 108"/><path d="M138 116 L130 108"/></g>
<g fill="#d1c8b0"><circle cx="60" cy="50" r="4"/><circle cx="140" cy="50" r="4"/><circle cx="60" cy="118" r="4"/><circle cx="140" cy="118" r="4"/></g>`, '#232a31', '#07090b'),

  pact: () => wrap(`
<path d="M42 22 L158 16 L160 122 L40 126 Z" fill="#c9b78b" stroke="#463618" stroke-width="2.5"/>
<path d="M46 26 L154 21" stroke="#e0d1a6" stroke-width="2" opacity=".6"/>
<path d="M56 40h88M56 52h82M56 64h88M56 76h64" stroke="#4a3a1e" stroke-width="2.6" stroke-linecap="round"/>
<path d="M58 98 q10 -14 16 0 t16 0 t16 -2" stroke="#8c1c13" stroke-width="3" fill="none"/>
<circle cx="136" cy="102" r="14" fill="#8c1c13" stroke="#4a0d08" stroke-width="2"/><circle cx="136" cy="102" r="8" fill="none" stroke="#5a100a" stroke-width="2"/>
<path d="M70 18 q-3 14 0 26 M112 15 q-3 18 0 34 M138 14 q-2 10 0 18" stroke="#8c1c13" stroke-width="4" stroke-linecap="round" fill="none"/>
<circle cx="70" cy="46" r="4" fill="#8c1c13"/><circle cx="112" cy="51" r="4.4" fill="#8c1c13"/>
<path d="M150 18 Q180 6 192 -2 Q176 14 160 40 Z" fill="#2a2620" stroke="#0e0c0a" stroke-width="1.5"/>`, '#2a211c', '#0a0706'),

  thief: () => wrap(`
<circle cx="150" cy="40" r="30" fill="#c0c9d6" opacity=".22"/>
<path d="M-4 110 Q70 98 204 114" stroke="#2c2117" stroke-width="9" fill="none"/>
<path d="M150 106 q10 -14 22 -16" stroke="#2c2117" stroke-width="4" fill="none"/>
<g transform="translate(78,78) rotate(-8)">
<ellipse cx="0" cy="8" rx="34" ry="21" fill="#080808"/>
<path d="M-30 14 L-62 36 L-26 26 Z" fill="#080808"/>
<path d="M-8 -6 Q18 -26 34 6 Q8 -4 -8 -6Z" fill="#161616"/>
<circle cx="32" cy="-12" r="14" fill="#080808"/>
<path d="M42 -14 L72 -6 L44 -2 Z" fill="#1c1812"/>
<circle cx="35" cy="-16" r="3" fill="#e8dcb0"/><circle cx="35.5" cy="-16" r="1.2" fill="#000"/>
</g>
<g transform="translate(150,70) rotate(24)" fill="none" stroke="#c2a04a" stroke-width="3.4" stroke-linecap="round">
<circle cx="0" cy="0" r="8"/><path d="M0 8 L0 34 M0 26 h8 M0 32 h6"/></g>
<path d="M104 72 L128 66" stroke="#c2a04a" stroke-width="1.4" opacity=".6"/>`, '#232830', '#070809'),

  curse: () => {
    let rays = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r1 = 50 + (i % 2) * 10, r2 = 92 + (i % 3) * 8;
      rays += `<path d="M${(100 + Math.cos(a) * r1).toFixed(1)} ${(76 + Math.sin(a) * r1 * 0.8).toFixed(1)} L${(100 + Math.cos(a) * r2).toFixed(1)} ${(76 + Math.sin(a) * r2 * 0.8).toFixed(1)}" stroke="#6b4a82" stroke-width="2" opacity=".55"/>`;
    }
    return wrap(`
<circle cx="100" cy="76" r="62" fill="#4a2a5c" opacity=".35"/>${rays}
<path d="M100 8 L182 130 L18 130 Z" fill="#0e0a12" fill-opacity=".6" stroke="#8d6aa6" stroke-width="2.6"/>
<path d="M50 80 Q100 38 150 80 Q100 120 50 80Z" fill="#0b0a0d" stroke="#8d6aa6" stroke-width="3"/>
<circle cx="100" cy="80" r="21" fill="#7b4c98"/><ellipse cx="100" cy="80" rx="6" ry="17" fill="#050307"/>
<circle cx="92" cy="72" r="4" fill="#d9c4ec" opacity=".8"/>
<path d="M70 126 q-3 8 0 14 M100 128 q-3 8 0 12 M130 126 q-3 10 0 14" stroke="#08060a" stroke-width="4" stroke-linecap="round" fill="none"/>`, '#251b2c', '#08060a');
  },

  holy: () => wrap(`
<circle cx="100" cy="86" r="62" fill="#9cc2dc" opacity=".16"/>
<ellipse cx="100" cy="132" rx="50" ry="5" fill="#000" opacity=".45"/>
<rect x="88" y="12" width="24" height="18" rx="3" fill="#6b4a2a" stroke="#2a1a0c" stroke-width="2"/>
<path d="M84 30 L116 30 L116 56 Q142 70 142 100 Q142 126 100 126 Q58 126 58 100 Q58 70 84 56 Z" fill="#a9c4d4" fill-opacity=".3" stroke="#d3e1ea" stroke-width="3"/>
<path d="M62 94 Q81 86 100 94 T138 94 L140 106 Q140 122 100 122 Q60 122 60 106Z" fill="#7fa8c2" fill-opacity=".75"/>
<path d="M100 74 v30 M87 87 h26" stroke="#eef5fa" stroke-width="4.5" stroke-linecap="round" opacity=".85"/>
<path d="M68 70 Q66 90 72 108" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>
<g fill="#cfe2ee" opacity=".8"><circle cx="156" cy="50" r="4"/><circle cx="168" cy="72" r="3"/><circle cx="40" cy="60" r="3.4"/><circle cx="30" cy="84" r="2.4"/></g>`, '#1f2a33', '#06090c'),

  pendulum: () => wrap(`
<circle cx="150" cy="38" r="26" fill="#b9c3d2" opacity=".18"/>
<path d="M164 20 A26 26 0 1 0 164 56 A20 20 0 1 1 164 20Z" fill="#c9d2de" opacity=".5"/>
<path d="M54 106 Q100 144 146 106" stroke="#d1bf8a" stroke-width="2.5" fill="none" stroke-dasharray="4 5" opacity=".8"/>
<path d="M146 106 l-12 -3 l6 12z" fill="#d1bf8a"/><path d="M54 106 l12 -3 l-6 12z" fill="#d1bf8a"/>
<g opacity=".28"><path d="M100 4 L62 96" stroke="#9a9ea2" stroke-width="2.5"/><path d="M62 96 L48 112 L62 132 L76 112Z" fill="#4a4f53"/></g>
<g opacity=".28"><path d="M100 4 L138 96" stroke="#9a9ea2" stroke-width="2.5"/><path d="M138 96 L124 112 L138 132 L152 112Z" fill="#4a4f53"/></g>
<path d="M100 4 L100 100" stroke="#b5b8bb" stroke-width="3"/>
<path d="M100 100 L84 118 L100 140 L116 118Z" fill="#555a5e" stroke="#16181a" stroke-width="2.5"/>
<path d="M92 112 L100 106 L108 112" stroke="#8a8f93" stroke-width="2" fill="none"/>
<circle cx="100" cy="6" r="6" fill="#2a2d2f" stroke="#7a7e82" stroke-width="2"/>`, '#2a2923', '#090908'),
};

const cache = {};
/** Ilustrace karty jako data URI (použij v <img src>). */
export function cardArt(type) {
  if (!ART[type]) return '';
  if (!cache[type]) cache[type] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART[type]());
  return cache[type];
}
export function cardSvg(type) { return ART[type] ? ART[type]() : ''; }
