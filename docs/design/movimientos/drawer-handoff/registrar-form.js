/* registrar-form.js — Drawer de carga/edición de movimientos (Grana v3 desktop)
   UX heredada de los forms mobile (v2): monto hero, tabs de tipo, filas, avanzado oculto. */
(function () {
  'use strict';

  // ── Data ───────────────────────────────────────────────────────
  var ACCOUNTS = [
    { id: 'gal-deb',  name: 'Galicia · Débito',     dot: '#3A6B8A', bal: '$2.340.000', kind: 'debito' },
    { id: 'gal-visa', name: 'Galicia Visa',          dot: '#B56A5A', bal: '$234.500',   kind: 'credito',
      sub: 'Consume saldo disponible · próximo resumen 15 jun' },
    { id: 'billetera',name: 'Billetera',             dot: '#8A6E98', bal: '$46.800',    kind: 'efectivo' },
    { id: 'efectivo', name: 'Efectivo',              dot: '#B56A5A', bal: '$18.500',    kind: 'efectivo' },
    { id: 'chanchito',name: 'Chanchito · Viaje 2026',dot: '#10B981', bal: '$640.000',   kind: 'ahorro' },
    { id: 'gal-usd',  name: 'Galicia · Caja USD',    dot: '#2A8F7B', bal: 'US$ 2.180',  kind: 'debito' },
  ];
  var CATS_GASTO = [
    { id: 'super',   name: 'Supermercado',    dot: '#10B981', emoji: '🛒', subs: ['Diario', 'Almacén', 'Limpieza', 'Bebidas'] },
    { id: 'comida',  name: 'Comida y bebida', dot: '#2A8F7B', emoji: '🍷', subs: ['Restaurantes', 'Cafeterías', 'Delivery', 'Mercado'] },
    { id: 'hogar',   name: 'Hogar',           dot: '#C98A3A', emoji: '🛋️', subs: ['Muebles', 'Servicios', 'Mantenimiento'] },
    { id: 'subs',    name: 'Suscripciones',   dot: '#8C7AA0', emoji: '🎧', subs: ['Streaming', 'Software', 'Música'] },
    { id: 'transp',  name: 'Transporte',      dot: '#B56A5A', emoji: '🚌', subs: null },
    { id: 'salud',   name: 'Salud',           dot: '#5E8CA8', emoji: '💊', subs: null },
    { id: 'tecno',   name: 'Tecnología',      dot: '#3A6B8A', emoji: '💻', subs: null },
  ];
  var CATS_INGRESO = [
    { id: 'sueldo',    name: 'Sueldo',     dot: '#10B981', emoji: '💼', subs: null },
    { id: 'freelance', name: 'Freelance',  dot: '#3A6B8A', emoji: '💻', subs: null },
    { id: 'reintegro', name: 'Reintegros', dot: '#2A8F7B', emoji: '↩️', subs: null },
    { id: 'intereses', name: 'Intereses',  dot: '#8C7AA0', emoji: '📈', subs: null },
    { id: 'regalo',    name: 'Regalo',     dot: '#B56A5A', emoji: '🎁', subs: null },
  ];
  var DATES = ['Hoy · mié 28 may', 'Ayer · mar 27 may', 'Sáb 24 may', 'Elegir otra fecha…'];
  var CUOTAS = [1, 2, 3, 6, 9, 12, 18, 24];

  // ── State ──────────────────────────────────────────────────────
  var S = {
    type: 'gasto', currency: 'ARS', sign: '−', mode: 'create',
    fromId: 'gal-deb', toId: 'chanchito',
    catId: 'super', subId: 'Diario', catSuggested: true,
    date: DATES[0], cuotas: 3,
  };
  var catDrill = null; // categoría en la que estamos drilleando dentro del popover

  var $ = function (id) { return document.getElementById(id); };
  var acct = function (id) { return ACCOUNTS.filter(function (a) { return a.id === id; })[0]; };
  function cats() { return S.type === 'ingreso' ? CATS_INGRESO : CATS_GASTO; }
  function cat(id) { var c = cats().filter(function (x) { return x.id === id; })[0]; return c || cats()[0]; }
  function fmt(n) { return (n || 0).toLocaleString('es-AR'); }

  // ── Amount handling ────────────────────────────────────────────
  function amountNumber() {
    var raw = $('ahInput').value.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }
  function formatAmountLive() {
    var el = $('ahInput');
    var v = el.value;
    var hasComma = v.indexOf(',') !== -1;
    var parts = v.split(',');
    var intPart = parts[0].replace(/[^\d]/g, '');
    var decPart = (parts[1] || '').replace(/[^\d]/g, '').slice(0, 2);
    var out = intPart ? Number(intPart).toLocaleString('es-AR') : '';
    if (hasComma) out += ',' + decPart;
    el.value = out;
  }

  // ── Type config ────────────────────────────────────────────────
  function applyType() {
    var t = S.type;
    // tabs
    Array.prototype.forEach.call($('dwTabs').children, function (b) {
      b.classList.toggle('on', b.dataset.type === t);
    });
    // amount color + sign + helper
    var hero = $('amountHero');
    hero.className = 'amount-hero t-' + t;
    $('ahSign').style.display = t === 'ajuste' ? '' : 'none';
    if (t === 'ajuste') $('ahSign').textContent = S.sign;
    var helper = $('ahHelper');
    if (t === 'ingreso') { helper.style.display = ''; helper.className = 'ah-helper'; helper.textContent = '+ Entra a tus cuentas'; }
    else if (t === 'ajuste') { helper.style.display = ''; helper.className = 'ah-helper muted'; helper.textContent = 'Positivo aumenta el saldo · negativo lo reduce'; }
    else { helper.style.display = 'none'; }

    // ajuste extras
    $('signToggle').classList.toggle('show', t === 'ajuste');
    $('ctxBanner').classList.toggle('show', t === 'ajuste');
    $('grpPreview').style.display = t === 'ajuste' ? '' : 'none';

    // rows
    show($('rowTo'), t === 'transferencia');
    show($('rowCat'), t === 'gasto' || t === 'ingreso');
    $('swapBtn').style.display = t === 'transferencia' ? '' : 'none';

    // from label + default account for ajuste
    $('frFromLabel').textContent = t === 'ingreso' ? 'A la cuenta' : (t === 'ajuste' ? 'Cuenta a ajustar' : 'Desde');
    if (t === 'ajuste' && S.fromId !== 'efectivo' && S.mode === 'create') S.fromId = 'efectivo';

    // descripción label/sub
    if (t === 'ajuste') {
      $('frDescLabel').textContent = 'Motivo del ajuste';
      $('frDescInput').placeholder = 'Ej: Había menos efectivo del registrado';
      showSub($('frDescSub'), 'Requerido — ayuda a entender el ajuste después', false);
    } else {
      $('frDescLabel').textContent = 'Descripción';
      $('frDescInput').placeholder = 'Ej: Coto, Café, Alquiler…';
      $('frDescSub').style.display = 'none';
    }

    // category set per type
    if (t === 'ingreso') { S.catId = 'sueldo'; S.subId = null; S.catSuggested = true; }
    else if (t === 'gasto' && S.mode === 'create') { S.catId = 'super'; S.subId = 'Diario'; }

    // toggles visibility
    var anyToggle = (t === 'gasto' || t === 'ingreso' || t === 'transferencia');
    $('grpToggles').style.display = anyToggle ? '' : 'none';
    show($('tgReintegro'), t === 'gasto');
    show($('tgRepetir'), anyToggle);

    // CTA
    var labels = { gasto: 'Registrar gasto', ingreso: 'Registrar ingreso', transferencia: 'Registrar transferencia', ajuste: 'Registrar ajuste' };
    var sub = $('dwSubmit');
    sub.classList.toggle('ink', t !== 'ingreso');
    setSubmitLabel(S.mode === 'edit' ? 'Guardar cambios' : labels[t]);

    renderFrom(); renderTo(); renderCat();
    updateCuotas(); updateAjustePreview();
    normalizeGroups();
  }

  function setSubmitLabel(text) {
    $('dwSubmit').innerHTML = text + (S.mode === 'edit' ? '' : '<kbd>⌘↵</kbd>');
  }
  function show(el, on) { el.style.display = on ? '' : 'none'; }
  function showSub(el, text, warn) { el.style.display = ''; el.textContent = text; el.className = 'fr-sub' + (warn ? ' warn' : ''); }

  // ── Renderers ──────────────────────────────────────────────────
  function renderFrom() {
    var a = acct(S.fromId);
    $('frFromDot').style.background = a.dot;
    $('frFromVal').textContent = a.name;
    $('frFromBal').textContent = a.bal;
    show($('frFromBadge'), a.kind === 'credito');
    if (a.kind === 'credito' && S.type === 'gasto') showSub($('frFromSub'), a.sub, false);
    else $('frFromSub').style.display = 'none';
    // icon swap for credit
    $('frFromIcon').innerHTML = a.kind === 'credito'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2H5a2 2 0 0 0-2 2V7z"/><path d="M3 11h17a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z"/><circle cx="17" cy="15" r="1.2" fill="currentColor" stroke="none"/></svg>';
  }
  function renderTo() {
    var a = acct(S.toId);
    $('frToDot').style.background = a.dot;
    $('frToVal').textContent = a.name;
    $('frToBal').textContent = a.bal;
  }
  function renderCat() {
    var c = cat(S.catId);
    $('frCatDot').style.background = c.dot;
    $('frCatVal').textContent = c.name;
    if (S.subId) { $('frCatSep').style.display = ''; $('frCatSub').style.display = ''; $('frCatSub').textContent = S.subId; }
    else { $('frCatSep').style.display = 'none'; $('frCatSub').style.display = 'none'; }
    $('frCatSuggest').style.display = S.catSuggested ? '' : 'none';
  }

  // ── Cuotas ─────────────────────────────────────────────────────
  function updateCuotas() {
    var isCredit = acct(S.fromId).kind === 'credito';
    var on = S.type === 'gasto' && isCredit;
    $('cuotasCard').classList.toggle('show', on);
    if (!on) return;
    var pills = $('ccPills'); pills.innerHTML = '';
    CUOTAS.forEach(function (n) {
      var d = document.createElement('div');
      d.className = 'cc-pill' + (n === S.cuotas ? ' on' : '');
      d.innerHTML = '<span>' + n + '</span><span class="x">×</span>';
      d.onclick = function () { S.cuotas = n; updateCuotas(); };
      pills.appendChild(d);
    });
    var monto = amountNumber() || 180000;
    var per = monto / S.cuotas;
    $('ccBreak').innerHTML = '<b>' + S.cuotas + '</b> cuotas de <b>$' + fmt(Math.round(per)) +
      '</b> · primera vence <b>15 jun</b>';
  }

  // ── Ajuste preview ─────────────────────────────────────────────
  function updateAjustePreview() {
    if (S.type !== 'ajuste') return;
    var a = acct(S.fromId);
    var cur = parseFloat(a.bal.replace(/[^\d]/g, '')) || 0;
    var delta = amountNumber();
    var after = S.sign === '−' ? cur - delta : cur + delta;
    $('prevBefore').textContent = a.bal + ' →';
    $('prevAfter').textContent = '$' + fmt(after);
  }

  // ── Normalize group borders (first visible row has no top border) ─
  function normalizeGroups() {
    ['grpMain', 'grpToggles'].forEach(function (gid) {
      var g = $(gid); if (!g) return;
      var rows = Array.prototype.filter.call(g.children, function (r) { return r.style.display !== 'none'; });
      Array.prototype.forEach.call(g.children, function (r) { r.style.borderTop = ''; });
      rows.forEach(function (r, i) { if (i === 0) r.style.borderTop = 'none'; });
    });
  }

  // ── Popovers ───────────────────────────────────────────────────
  var pop = $('pop');
  function closePop() { pop.classList.remove('show'); }
  function openPop(anchor, kind) {
    var html = '';
    if (kind === 'account-from' || kind === 'account-to') {
      var selId = kind === 'account-from' ? S.fromId : S.toId;
      html += '<div class="pop-title">' + (kind === 'account-from' ? ($('frFromLabel').textContent) : 'Hacia qué cuenta') + '</div>';
      ACCOUNTS.forEach(function (a) {
        html += '<div class="pop-item' + (a.id === selId ? ' sel' : '') + '" data-id="' + a.id + '">' +
          '<span class="fr-dot" style="background:' + a.dot + '"></span>' +
          '<span class="pop-name">' + a.name + (a.kind === 'credito' ? ' <span class="badge-credito">CRÉDITO</span>' : '') + '</span>' +
          '<span class="pop-bal">' + a.bal + '</span>' +
          '<span class="pop-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span></div>';
      });
    } else if (kind === 'category') {
      var chk = '<span class="pop-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span>';
      if (catDrill) {
        var pc = cat(catDrill);
        html += '<div class="pop-back" data-back="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M15 6l-6 6 6 6"/></svg><span class="pb-emoji">' + pc.emoji + '</span>' + pc.name + '</div>';
        html += '<div class="pop-item' + (S.catId === pc.id && !S.subId ? ' sel' : '') + '" data-id="' + pc.id + '" data-sub="">' +
          '<span class="pop-dot" style="background:' + pc.dot + '"></span><span class="pop-name">Toda la categoría</span>' + chk + '</div>';
        pc.subs.forEach(function (s) {
          html += '<div class="pop-item' + (S.catId === pc.id && S.subId === s ? ' sel' : '') + '" data-id="' + pc.id + '" data-sub="' + s + '">' +
            '<span class="pop-dot" style="background:' + pc.dot + '"></span><span class="pop-name">' + s + '</span>' + chk + '</div>';
        });
      } else {
        html += '<div class="pop-title">Categoría</div>';
        cats().forEach(function (c) {
          var drillable = c.subs && c.subs.length;
          html += '<div class="pop-item' + (c.id === S.catId ? ' sel' : '') + '" data-id="' + c.id + '"' + (drillable ? ' data-drill="1"' : '') + '>' +
            '<span class="pop-emoji">' + c.emoji + '</span>' +
            '<span class="pop-name">' + c.name + '</span>' +
            (drillable ? '<span class="pop-drill">›</span>' : chk) + '</div>';
        });
      }
    } else if (kind === 'date') {
      html += '<div class="pop-title">Fecha</div>';
      DATES.forEach(function (d) {
        html += '<div class="pop-item' + (d === S.date ? ' sel' : '') + '" data-val="' + d + '">' +
          '<span class="pop-name">' + d + '</span>' +
          '<span class="pop-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span></div>';
      });
    }
    pop.innerHTML = html;
    pop.dataset.kind = kind;
    // position
    var r = anchor.getBoundingClientRect();
    pop.style.left = '0px'; pop.style.top = '0px';
    pop.classList.add('show');
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.min(r.left, window.innerWidth - pw - 16);
    var top = r.bottom + 6;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 6);
    pop.style.left = Math.max(12, left) + 'px';
    pop.style.top = top + 'px';
    pop.style.width = Math.max(r.width, 280) + 'px';

    Array.prototype.forEach.call(pop.querySelectorAll('.pop-item'), function (it) {
      it.onclick = function () { pickItem(kind, it); };
    });
    var back = pop.querySelector('.pop-back');
    if (back) back.onclick = function () { catDrill = null; openPop(anchor, 'category'); };
  }
  function pickItem(kind, it) {
    if (kind === 'account-from') { S.fromId = it.dataset.id; if (S.type !== 'ajuste') S.catSuggested = true; }
    else if (kind === 'account-to') { S.toId = it.dataset.id; }
    else if (kind === 'category') {
      if (it.dataset.drill) { catDrill = it.dataset.id; openPop($(pop.dataset.anchor), 'category'); return; }
      S.catId = it.dataset.id; S.subId = it.dataset.sub || null; S.catSuggested = false; catDrill = null;
    }
    else if (kind === 'date') { S.date = it.dataset.val; $('frDateVal').textContent = it.dataset.val.replace('…',''); }
    closePop();
    renderFrom(); renderTo(); renderCat(); updateCuotas(); updateAjustePreview();
  }

  // ── Open / close drawer ────────────────────────────────────────
  function openDrawer() {
    document.body.classList.add('drawer-open');
    $('drawer').setAttribute('aria-hidden', 'false');
    setTimeout(function () { $('ahInput').focus(); }, 360);
  }
  function closeDrawer() {
    document.body.classList.remove('drawer-open');
    $('drawer').setAttribute('aria-hidden', 'true');
    closePop();
  }
  function resetForm() {
    S.mode = 'create'; S.type = 'gasto'; S.currency = 'ARS'; S.sign = '−';
    S.fromId = 'gal-deb'; S.toId = 'chanchito'; S.catId = 'super'; S.catSuggested = true;
    S.date = DATES[0]; S.cuotas = 3;
    $('ahInput').value = ''; $('frDescInput').value = '';
    $('ccyText').textContent = 'ARS';
    $('frDateVal').textContent = S.date;
    ['tgReintegro', 'tgRepetir'].forEach(function (id) { $(id).classList.remove('on'); });
    $('dwEyebrow').textContent = 'Nuevo';
    $('dwTitle').textContent = 'Registrar movimiento';
    $('dwDelete').style.display = 'none';
    $('dwAgain').style.display = '';
    Array.prototype.forEach.call($('signToggle').children, function (o) { o.classList.toggle('on', o.dataset.sign === '−'); });
    applyType();
  }

  function openCreate() { resetForm(); openDrawer(); }

  function openEdit(data) {
    resetForm();
    S.mode = 'edit';
    S.type = data.type || 'gasto';
    if (data.amount) $('ahInput').value = data.amount;
    if (data.desc) $('frDescInput').value = data.desc;
    if (data.catId) { S.catId = data.catId; S.catSuggested = false; }
    if (data.fromId) S.fromId = data.fromId;
    $('dwEyebrow').textContent = 'Editar';
    $('dwTitle').textContent = 'Editar movimiento';
    $('dwDelete').style.display = '';
    $('dwAgain').style.display = 'none';
    applyType();
    openDrawer();
  }

  // ── Parse a list tx-row into edit data ─────────────────────────
  function rowToData(row) {
    var amtEl = row.querySelector('.tx-amt');
    var type = 'gasto';
    if (amtEl.classList.contains('pos')) type = 'ingreso';
    else if (amtEl.classList.contains('neutral')) type = 'transferencia';
    var amtTxt = amtEl.textContent.replace(/[^\d.,]/g, '');
    var title = (row.querySelector('.tx-title') || {}).textContent || '';
    // match category by first word of caption
    var capEl = row.querySelector('.tx-cap');
    var catId = null;
    if (capEl && (type === 'gasto')) {
      var capName = capEl.textContent.split('›')[0].split('·')[0].trim();
      var m = CATS_GASTO.filter(function (c) { return c.name === capName; })[0];
      if (m) catId = m.id;
    }
    return { type: type, amount: amtTxt, desc: title, catId: catId };
  }

  // ── Toast ──────────────────────────────────────────────────────
  var toastTimer;
  function toast(msg) {
    $('toastText').textContent = msg;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.remove('show'); }, 2200);
  }

  function submit(keepOpen) {
    var labels = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', ajuste: 'Ajuste' };
    if (S.mode === 'edit') { toast('Cambios guardados'); closeDrawer(); return; }
    toast(labels[S.type] + ' guardado');
    if (keepOpen) {
      // keep account + date + type, clear amount & description for the next one
      $('ahInput').value = ''; $('frDescInput').value = '';
      S.catSuggested = true; renderCat(); updateCuotas();
      $('ahInput').focus();
    } else {
      closeDrawer();
    }
  }

  // ── Wire up ────────────────────────────────────────────────────
  function init() {
    // openers
    var fab = document.querySelector('.fab');
    if (fab) fab.addEventListener('click', openCreate);
    // header button if exists
    Array.prototype.forEach.call(document.querySelectorAll('.btn-add, .btn-primary'), function (b) {
      if (/registrar movimiento/i.test(b.textContent)) b.addEventListener('click', openCreate);
    });
    // tx rows -> edit
    Array.prototype.forEach.call(document.querySelectorAll('.tx-row'), function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () { openEdit(rowToData(row)); });
    });

    $('dwClose').addEventListener('click', closeDrawer);
    $('scrim').addEventListener('click', closeDrawer);
    $('dwDelete').addEventListener('click', function () { toast('Movimiento eliminado'); closeDrawer(); });
    $('dwSubmit').addEventListener('click', function () { submit(false); });
    $('dwAgain').addEventListener('click', function () { submit(true); });

    // tabs
    Array.prototype.forEach.call($('dwTabs').children, function (b) {
      b.addEventListener('click', function () {
        if (S.mode === 'edit') return; // no cambiar tipo en edición
        S.type = b.dataset.type; applyType(); $('ahInput').focus();
      });
    });

    // currency
    $('ccyPill').addEventListener('click', function () {
      S.currency = S.currency === 'ARS' ? 'USD' : 'ARS';
      $('ccyText').textContent = S.currency;
    });

    // amount input
    $('ahInput').addEventListener('input', function () {
      formatAmountLive(); updateCuotas(); updateAjustePreview();
    });
    $('amountHero').addEventListener('focusin', function () { $('amountHero').classList.add('focus'); });
    $('amountHero').addEventListener('focusout', function () { $('amountHero').classList.remove('focus'); });

    // sign toggle
    Array.prototype.forEach.call($('signToggle').children, function (o) {
      o.addEventListener('click', function () {
        S.sign = o.dataset.sign;
        Array.prototype.forEach.call($('signToggle').children, function (x) { x.classList.toggle('on', x === o); });
        $('ahSign').textContent = S.sign; updateAjustePreview();
      });
    });

    // field rows -> popover
    ['rowFrom', 'rowTo', 'rowCat', 'rowDate'].forEach(function (id) {
      var row = $(id);
      row.addEventListener('click', function (e) {
        if (e.target.closest('.swap-btn')) return;
        e.stopPropagation();
        if (pop.classList.contains('show') && pop.dataset.anchor === id) { closePop(); return; }
        pop.dataset.anchor = id;
        openPop(row, row.dataset.pop);
      });
    });

    // swap accounts
    $('swapBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      var t = S.fromId; S.fromId = S.toId; S.toId = t;
      renderFrom(); renderTo();
    });

    // toggle rows
    ['tgReintegro', 'tgRepetir'].forEach(function (id) {
      $(id).querySelector('.tr-head').addEventListener('click', function () {
        $(id).classList.toggle('on');
      });
    });
    // freq pills
    Array.prototype.forEach.call(document.querySelectorAll('#freqPills .freq-pill'), function (p) {
      p.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('#freqPills .freq-pill'), function (x) { x.classList.toggle('on', x === p); });
      });
    });

    // close pop on outside click / body scroll
    document.addEventListener('click', function (e) {
      if (!pop.contains(e.target)) closePop();
    });
    $('dwBody').addEventListener('scroll', closePop);

    // keyboard
    document.addEventListener('keydown', function (e) {
      if (!document.body.classList.contains('drawer-open')) return;
      if (e.key === 'Escape') { if (pop.classList.contains('show')) closePop(); else closeDrawer(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(false); }
    });

    applyType();

    // Abrir el form al cargar (para review). Quitar esta línea para arrancar en la lista.
    openCreate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
