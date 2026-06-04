/* def3-chrome.js — inyecta sidebar + topbar + barra mobile + bottom-nav comunes */
(function () {
  var ICON = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></svg>',
    cuentas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h13a2 2 0 012 2v2H5a2 2 0 00-2 2V7z"/><path d="M3 11h17a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-7z"/></svg>',
    tarjetas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><line x1="3" y1="11" x2="21" y2="11"/><line x1="7" y1="15" x2="11" y2="15"/></svg>',
    movim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="17" x2="18" y2="17"/></svg>',
    compart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><path d="M16 6.2a3.2 3.2 0 010 6"/><path d="M18 19a5.5 5.5 0 00-3-4.9"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.7 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.7l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-.7-2.7 1.6 1.6 0 010-3.2 1.6 1.6 0 00.7-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-.7 1.6 1.6 0 013.2 0 1.6 1.6 0 002.7.7l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    chL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
  };
  function nav(active) {
    var items = [['inicio','Inicio'],['cuentas','Cuentas'],['tarjetas','Tarjetas'],['movim','Movimientos'],['compart','Compartido']];
    return items.map(function (it) {
      return '<a href="#" class="' + (it[0] === active ? 'active' : '') + '">' + ICON[it[0]] + it[1] + '</a>';
    }).join('');
  }
  var app = document.querySelector('.app');
  if (!app) return;

  // sidebar
  var aside = document.createElement('aside');
  aside.className = 'sidebar';
  aside.innerHTML = '<div class="brand"><span class="word">grana</span><span class="dot"></span></div>' +
    '<nav class="nav">' + nav('inicio') + '</nav>' +
    '<div class="spacer"></div>' +
    '<div class="foot-link">' + ICON.gear + 'Configuración</div>';
  app.insertBefore(aside, app.firstChild);

  // mobile top bar (before main)
  var mbar = document.createElement('header');
  mbar.className = 'mbar';
  mbar.innerHTML = '<span class="word">grana<span class="dt">.</span></span>' +
    '<div class="mb-actions"><button class="eye-btn">' + ICON.eye + '</button><div class="av">CA</div></div>';
  var main = app.querySelector('.main');
  app.insertBefore(mbar, main);

  // topbar into .content (first child)
  var content = app.querySelector('.content');
  if (content) {
    var tb = document.createElement('div');
    tb.className = 'topbar';
    tb.innerHTML =
      '<div class="hello"><h1>Hola, Caro.</h1><div class="date">Miércoles 3 de junio · vas <span class="g">+$504.499</span> este mes.</div></div>' +
      '<div class="top-actions">' +
        '<div class="monthsel"><button class="nav" aria-label="Mes anterior">' + ICON.chL + '</button><span class="lbl tnum">Junio 2026</span><button class="nav" aria-label="Mes siguiente">' + ICON.chR + '</button></div>' +
        '<button class="eye-btn">' + ICON.eye + '</button>' +
        '<button class="btn-primary">' + ICON.plus + 'Nuevo movimiento</button>' +
      '</div>';
    content.insertBefore(tb, content.firstChild);
  }

  // bottom nav (mobile)
  var bnav = document.createElement('nav');
  bnav.className = 'bnav';
  bnav.innerHTML =
    '<a href="#" class="active">' + ICON.inicio + 'Inicio</a>' +
    '<a href="#">' + ICON.cuentas + 'Cuentas</a>' +
    '<a href="#" class="fab-wrap"><span class="fab">' + ICON.plus + '</span></a>' +
    '<a href="#">' + ICON.movim + 'Movim.</a>' +
    '<a href="#">' + ICON.compart + 'Compart.</a>';
  app.appendChild(bnav);
})();
