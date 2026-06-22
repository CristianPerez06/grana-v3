/* ════════════════════════════════════════════════════════════════
   eq-drill.js — "En qué gastaron" interactivo (CONSERVAR del hero actual)
   · Desglose por categoría con barra + monto + %.
   · Drill INLINE: tocás una categoría y se despliegan SUS movimientos
     (sin cambiar de pantalla, sin recargar).
   · Selector ARS/USD: cambia todo el desglose. Bimoneda siempre visible.
   Renderiza dentro de cualquier contenedor [data-eq]. Cada iframe es
   independiente, así que no hay colisión de JS entre variantes.
   Perspectiva Juli: "parte de Caro" = lo que Caro le debe a Juli en ese
   gasto que pagó Juli; "tu parte" = lo que Juli puso de un gasto de Caro.
   ════════════════════════════════════════════════════════════════ */
(function () {
  const DATA = {
    ARS: {
      total: 130373,
      cats: [
        { label: 'Supermercado', color: 'var(--amber)', amount: 48200, movs: [
          { f: '05 jun', t: 'Súper Coto',   pay: 'j', part: 'parte de Caro', p: 9225, tot: 18450 },
          { f: '12 jun', t: 'Verdulería',   pay: 'c', part: 'tu parte',      p: 3600, tot: 7200 },
          { f: '19 jun', t: 'Carnicería',   pay: 'j', part: 'parte de Caro', p: 7100, tot: 14200 },
          { f: '24 jun', t: 'Almacén',      pay: 'c', part: 'tu parte',      p: 4175, tot: 8350 },
        ]},
        { label: 'Comida y salidas', color: 'var(--emerald-deep)', amount: 32500, movs: [
          { f: '09 jun', t: 'Cena Don Julio',     pay: 'j', part: 'parte de Caro', p: 8000, tot: 16000 },
          { f: '16 jun', t: 'Delivery PedidosYa', pay: 'c', part: 'tu parte',      p: 4750, tot: 9500 },
          { f: '22 jun', t: 'Café Full City',     pay: 'j', part: 'parte de Caro', p: 3500, tot: 7000 },
        ]},
        { label: 'Hogar', color: 'var(--slate)', amount: 24800, movs: [
          { f: '02 jun', t: 'Expensas',     pay: 'c', part: 'tu parte',      p: 7000, tot: 14000 },
          { f: '14 jun', t: 'Edenor (luz)', pay: 'c', part: 'tu parte',      p: 3900, tot: 7800 },
          { f: '20 jun', t: 'Deco · Easy',  pay: 'j', part: 'parte de Caro', p: 1500, tot: 3000 },
        ]},
        { label: 'Transporte', color: 'var(--violet)', amount: 14873, movs: [
          { f: '03 jun', t: 'Nafta YPF', pay: 'j', part: 'parte de Caro', p: 4936, tot: 9873 },
          { f: '17 jun', t: 'SUBE x2',   pay: 'c', part: 'tu parte',      p: 2500, tot: 5000 },
        ]},
        { label: 'Salud', color: 'var(--rose)', amount: 10000, movs: [
          { f: '15 jun', t: 'Farmacia', pay: 'c', part: 'tu parte',      p: 3500, tot: 7000 },
          { f: '25 jun', t: 'Óptica',   pay: 'j', part: 'parte de Caro', p: 1500, tot: 3000 },
        ]},
      ],
    },
    USD: {
      total: 84,
      cats: [
        { label: 'Suscripciones', color: 'var(--violet)', amount: 38, movs: [
          { f: '04 jun', t: 'Spotify + Apple', pay: 'j', part: 'parte de Caro', p: 12, tot: 24 },
          { f: '10 jun', t: 'ChatGPT Plus',    pay: 'c', part: 'tu parte',      p: 7,  tot: 14 },
        ]},
        { label: 'Viajes', color: 'var(--slate)', amount: 30, movs: [
          { f: '09 jun', t: 'Hotel Bariloche · seña', pay: 'j', part: 'parte de Caro', p: 15, tot: 30 },
        ]},
        { label: 'Compras online', color: 'var(--amber)', amount: 16, movs: [
          { f: '21 jun', t: 'Amazon', pay: 'c', part: 'tu parte', p: 8, tot: 16 },
        ]},
      ],
    },
  };

  function fmtARS(v) {
    return '$' + v.toLocaleString('es-AR');
  }
  function fmtUSD(v) {
    return 'US$ ' + v.toLocaleString('es-AR');
  }
  const pct = (v, t) => Math.round((v / t) * 100);

  const ICONS = {
    'Supermercado': '<path d="M3 13l2-5.5A2 2 0 017 6h10a2 2 0 012 1.5L21 13v4H3z"/><circle cx="8" cy="18.5" r="1.3"/><circle cx="16" cy="18.5" r="1.3"/>',
    'Comida y salidas': '<path d="M3 11h18"/><path d="M4 11a8 8 0 0016 0"/><path d="M9 7c0-1 1-1.5 0-3"/><path d="M13 7c0-1 1-1.5 0-3"/>',
    'Hogar': '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/>',
    'Transporte': '<path d="M3 13l2-5.5A2 2 0 017 6h10a2 2 0 012 1.5L21 13v5H3z"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/>',
    'Salud': '<path d="M12 5v14M5 12h14"/>',
    'Suscripciones': '<path d="M9 18V6l10-2v10"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    'Viajes': '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    'Compras online': '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 016 0"/>',
  };
  function iconSvg(label) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[label] || '') + '</svg>';
  }

  function chev() {
    return '<span class="eq-chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>';
  }

  function render(host) {
    const cur = host.dataset.cur || 'ARS';
    const fmt = cur === 'ARS' ? fmtARS : fmtUSD;
    const set = DATA[cur];

    // barra apilada (una sola barra segmentada por categoría)
    const stack = '<div class="eq-stack">' + set.cats.map((c) =>
      '<span style="width:' + (c.amount / set.total * 100) + '%;background:' + c.color + '"></span>'
    ).join('') + '</div>';

    const list = '<div class="eq-list">' + set.cats.map((c, i) => {
      const movs = c.movs.map((m) => {
        const payLabel = m.pay === 'j' ? 'Pagó Juli' : 'Pagó Caro';
        return '<div class="mov">'
          + '<div class="ml"><span class="t">' + m.t + '</span>'
          + '<span class="who"><span class="pay"><span class="pd pd-' + m.pay + '"></span>' + payLabel + '</span> · ' + m.f + '</span></div>'
          + '<div class="mr"><div class="part">' + fmt(m.p) + '</div>'
          + '<div class="tot">' + m.part + ' · total ' + fmt(m.tot) + '</div></div>'
          + '</div>';
      }).join('');
      return '<div class="eq-cat" data-i="' + i + '">'
        + '<button class="eq-row drill" aria-expanded="false">'
        + '<span class="eq-ic" style="background:' + c.color + '">' + iconSvg(c.label) + '</span>'
        + '<span class="eq-nm">' + c.label + '</span>'
        + '<span class="eq-amt">' + fmt(c.amount) + '</span>'
        + '<span class="eq-pct">' + pct(c.amount, set.total) + '%</span>'
        + chev()
        + '</button>'
        + '<div class="eq-movs"><div class="eq-movs-in">' + movs + '</div></div>'
        + '</div>';
    }).join('') + '</div>';

    host.innerHTML = stack + list;

    host.querySelectorAll('.eq-cat').forEach((cat) => {
      const btn = cat.querySelector('.eq-row');
      btn.addEventListener('click', () => {
        const open = cat.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  function init() {
    document.querySelectorAll('[data-eq]').forEach((host) => {
      if (!host.dataset.cur) host.dataset.cur = 'ARS';
      render(host);
    });
    // selector ARS/USD: cualquier .eq-seg con data-eq-target apuntando al host
    document.querySelectorAll('[data-eq-seg]').forEach((seg) => {
      seg.querySelectorAll('button').forEach((b) => {
        b.addEventListener('click', () => {
          const cur = b.dataset.cur;
          seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          const sel = seg.dataset.eqSeg;
          document.querySelectorAll(sel || '[data-eq]').forEach((host) => {
            host.dataset.cur = cur;
            render(host);
          });
        });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
