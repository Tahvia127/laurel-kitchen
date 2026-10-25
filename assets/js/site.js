/* Laurel — one script for every page. Data comes from window.LK, written by build.mjs. */
(function () {
'use strict';
var D = window.LK;
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var page = document.body.dataset.page;
var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
var money = function (n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

/* ------------------------------------------------------------- lookups */
var ITEMS = {}, GROUPS = {};
D.sections.forEach(function (s) { s.items.forEach(function (i) { ITEMS[i.id] = i; }); });
D.groups.forEach(function (g) { GROUPS[g.id] = g; });
var O = D.ordering;

var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

/* ------------------------------------------------------- open or shut? */
function hhmm(s) { var p = s.split(':'); return (+p[0]) * 60 + (+p[1]); }
function fmt(mins) {
  var h = Math.floor(mins / 60) % 24, m = mins % 60, ap = h >= 12 ? 'pm' : 'am', hr = h % 12 === 0 ? 12 : h % 12;
  return hr + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
}
function statusNow(now) {
  var dow = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
  var today = D.hours[dow];
  if (today && !today.closed) {
    var o = hhmm(today.open), c = hhmm(today.close);
    if (mins >= o && mins < c) return { open: true, text: c - mins <= 60 ? 'Closing at ' + fmt(c) : 'Open until ' + fmt(c) };
    if (mins < o) return { open: false, text: 'Opens at ' + fmt(o) + ' today' };
  }
  for (var n = 1; n <= 7; n++) {
    var d = D.hours[(dow + n) % 7];
    if (!d.closed) return { open: false, text: 'Opens ' + (n === 1 ? 'tomorrow' : d.day) + ' at ' + fmt(hhmm(d.open)) };
  }
  return { open: false, text: 'Closed' };
}
function paintStatus() {
  var s = statusNow(new Date());
  var el = $('#navStatus');
  if (el) { el.textContent = s.open ? 'Open now' : 'Closed'; el.classList.toggle('shut', !s.open); el.title = s.text; }
  var hero = $('#heroStatus');
  if (hero) hero.innerHTML = (s.open ? '<b>Open right now.</b> ' : '<b>Closed right now.</b> ') + esc(s.text) +
    ' &middot; <a class="linkish" href="#visit">All hours</a>';
  var dow = new Date().getDay();
  $$('.hours-list li, .foot-hours li').forEach(function (li) { li.classList.toggle('today', +li.dataset.dow === dow); });
}
paintStatus();
setInterval(paintStatus, 60000);

/* ------------------------------------------------------- nav + reveals */
var nav = $('#nav');
addEventListener('scroll', function () { nav.classList.toggle('stuck', scrollY > 10); }, { passive: true });
if ('IntersectionObserver' in window && !still) {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
  $$('.rv').forEach(function (el) { io.observe(el); });
} else { $$('.rv').forEach(function (el) { el.classList.add('in'); }); }

/* ---------------------------------------------------------------- cart */
var KEY = 'laurel-order-v1';
var cart = [];
try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
cart = cart.filter(function (l) { return ITEMS[l.id] && l.qty > 0; });
var state = { mode: 'pickup', when: 'asap', tip: O.defaultTip, promo: false, address: '' };
try { var st = JSON.parse(localStorage.getItem(KEY + '-state')); if (st) Object.assign(state, st); } catch (e) {}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); localStorage.setItem(KEY + '-state', JSON.stringify(state)); } catch (e) {}
}
function unit(line) {
  return line.opts.reduce(function (n, o) { return n + o.price; }, ITEMS[line.id].price);
}
function count() { return cart.reduce(function (n, l) { return n + l.qty; }, 0); }
function subtotal() { return cart.reduce(function (n, l) { return n + unit(l) * l.qty; }, 0); }
function totals() {
  var sub = subtotal();
  var discount = state.promo ? sub * O.promo.percent / 100 : 0;
  var fee = state.mode === 'delivery' && sub > 0 ? O.deliveryFee : 0;
  var taxable = sub - discount + fee;
  var tax = taxable * O.taxRate;
  var tip = (sub - discount) * (state.tip / 100);
  return { sub: sub, discount: discount, fee: fee, tax: tax, tip: tip, total: taxable + tax + tip };
}
function optLabel(line) {
  return line.opts.filter(function (o) { return o.show !== false; }).map(function (o) { return o.choice; }).join(', ');
}

/* ------------------------------------------------------------- toaster */
var toastEl = $('#toast'), toastT;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}

/* --------------------------------------------------------- cart render */
function lineHTML(l, n) {
  var i = ITEMS[l.id], ol = optLabel(l);
  return '<li class="line" data-n="' + n + '">' +
    '<b>' + esc(i.name) + '</b><span class="line-price">' + money(unit(l) * l.qty) + '</span>' +
    (ol ? '<p class="line-opts">' + esc(ol) + '</p>' : '') +
    (l.note ? '<p class="line-note">&ldquo;' + esc(l.note) + '&rdquo;</p>' : '') +
    '<span class="qty"><button type="button" data-step="-1" aria-label="One fewer ' + esc(i.name) + '">&minus;</button>' +
    '<span>' + l.qty + '</span>' +
    '<button type="button" data-step="1" aria-label="One more ' + esc(i.name) + '">+</button></span>' +
    '</li>';
}
function totalsHTML(t) {
  var rows = '<li><span>Subtotal</span><span>' + money(t.sub) + '</span></li>';
  if (t.discount) rows += '<li class="save"><span>' + esc(O.promo.code) + '</span><span>&minus;' + money(t.discount) + '</span></li>';
  if (t.fee) rows += '<li><span>Delivery</span><span>' + money(t.fee) + '</span></li>';
  rows += '<li><span>Tax</span><span>' + money(t.tax) + '</span></li>';
  if (t.tip) rows += '<li><span>Tip ' + state.tip + '%</span><span>' + money(t.tip) + '</span></li>';
  rows += '<li class="grand"><span>Total</span><span>' + money(t.total) + '</span></li>';
  return rows;
}
function renderCart() {
  var t = totals(), n = count(), empty = n === 0;
  var cc = $('#cartCount'), cb = $('#cartBtn');
  if (cc) { cc.textContent = n; cc.hidden = empty; }
  if (cb) cb.classList.toggle('live', !empty);

  var body = empty
    ? '<p class="cart-empty">Nothing in here yet. Add something from the menu and it shows up right away.</p>'
    : '<ul class="lines">' + cart.map(lineHTML).join('') + '</ul>';

  var foot = '';
  if (!empty) {
    var short = state.mode === 'delivery' && t.sub < O.deliveryMinimum;
    foot = (short ? '<p class="min-warn">Delivery starts at ' + money(O.deliveryMinimum) + '. Add ' + money(O.deliveryMinimum - t.sub) + ' more, or switch to pickup.</p>' : '') +
      (t.sub > O.largeOrderThreshold ? '<p class="min-warn">' + esc(O.largeOrderNote) + '</p>' : '') +
      '<ul class="totals">' + totalsHTML(t) + '</ul>' +
      (page === 'order'
        ? '<a class="btn btn-primary btn-wide" href="#checkout" data-close-drawer>Checkout &middot; ' + money(t.total) + '</a>'
        : '<a class="btn btn-primary btn-wide" href="order.html">Go to checkout &middot; ' + money(t.total) + '</a>') +
      '<button class="btn btn-ghost btn-wide sm" type="button" id="clearCart" style="margin-top:.6rem">Empty the bag</button>';
  }
  ['#cartLines', '#panelLines'].forEach(function (sel) { var el = $(sel); if (el) el.innerHTML = body; });
  ['#cartFoot', '#panelFoot'].forEach(function (sel) { var el = $(sel); if (el) el.innerHTML = foot; });
  if (page === 'order') paintCheckout(t);
  save();
}
document.addEventListener('click', function (e) {
  var step = e.target.closest('[data-step]');
  if (step) {
    var n = +step.closest('.line').dataset.n;
    cart[n].qty += +step.dataset.step;
    if (cart[n].qty <= 0) cart.splice(n, 1);
    renderCart();
    return;
  }
  if (e.target.id === 'clearCart') { cart = []; renderCart(); toast('Bag emptied'); }
});

/* -------------------------------------------------------------- drawer */
var drawer = $('#cartDrawer'), scrim = $('#drawerScrim');
function openDrawer(on) {
  if (!drawer) return;
  drawer.classList.toggle('open', on);
  drawer.setAttribute('aria-hidden', String(!on));
  scrim.hidden = !on;
  document.body.classList.toggle('locked', on);
  if (on) { var b = drawer.querySelector('[data-close-drawer]'); if (b) b.focus(); }
}
var cartBtn = $('#cartBtn'); if (cartBtn) cartBtn.addEventListener('click', function () { openDrawer(true); });
if (scrim) scrim.addEventListener('click', function () { openDrawer(false); });
document.addEventListener('click', function (e) { if (e.target.closest('[data-close-drawer]')) openDrawer(false); });
addEventListener('keydown', function (e) { if (e.key === 'Escape') openDrawer(false); });

/* ------------------------------------------------------- options modal */
var modal = $('#optModal'), form = $('#optForm'), pending = null;
function addLine(id, opts, note) {
  var sig = id + '|' + opts.map(function (o) { return o.group + ':' + o.choice; }).join('|') + '|' + (note || '');
  var found = cart.find(function (l) { return l.sig === sig; });
  if (found) found.qty++;
  else cart.push({ id: id, qty: 1, opts: opts, note: note || '', sig: sig });
  renderCart();
  toast(ITEMS[id].name + ' added' + (count() > 1 ? ' · ' + count() + ' in the bag' : ''));
}
function buildModal(item) {
  var groups = item.options.map(function (g) { return GROUPS[g]; });
  form.innerHTML =
    '<div class="opt-head"><div><h2 id="optTitle">' + esc(item.name) + '</h2><p>' + esc(item.description) + '</p></div>' +
    '<span class="price">' + money(item.price) + '</span></div>' +
    '<div class="opt-body">' +
      groups.map(function (g, gi) {
        return '<fieldset class="opt-group" data-group="' + esc(g.id) + '" data-type="' + g.type + '"' + (g.required ? ' data-required="1"' : '') + '>' +
          '<b>' + esc(g.label) + (g.required ? ' <span class="req">required</span>' : g.type === 'multi' ? ' <span>optional</span>' : '') + '</b>' +
          '<div class="opt-list">' + g.choices.map(function (c, ci) {
            var id = 'o' + gi + '_' + ci;
            return '<label class="opt"><input type="' + (g.type === 'multi' ? 'checkbox' : 'radio') + '" name="g' + gi + '" id="' + id + '"' +
              ' value="' + esc(c.name) + '" data-price="' + c.price + '"' + (c.default ? ' checked' : '') + '>' +
              '<span>' + esc(c.name) + '</span><span class="delta">' + (c.price ? (c.price > 0 ? '+' + money(c.price) : '−' + money(-c.price)) : '') + '</span></label>';
          }).join('') + '</div></fieldset>';
      }).join('') +
      '<label class="opt-note"><span style="display:block;font-size:.76rem;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:.4rem">Anything else?</span>' +
      '<input id="optNote" placeholder="No onions, extra napkins, go easy on the chili"></label>' +
    '</div>' +
    '<div class="opt-foot"><button class="btn btn-ghost" type="button" data-cancel>Cancel</button>' +
    '<button class="btn btn-primary" type="button" id="optAdd">Add &middot; <span id="optPrice">' + money(item.price) + '</span></button></div>';
  var price = function () {
    var n = item.price;
    $$('input:checked', form).forEach(function (i) { n += +i.dataset.price || 0; });
    $('#optPrice').textContent = money(n);
  };
  form.addEventListener('change', price);
  $('[data-cancel]', form).addEventListener('click', function () { modal.close(); });
  $('#optAdd').addEventListener('click', function () {
    var opts = [], bad = null;
    $$('.opt-group', form).forEach(function (fs) {
      var picked = $$('input:checked', fs);
      if (fs.dataset.required && !picked.length) { bad = bad || fs; return; }
      picked.forEach(function (i) { opts.push({ group: fs.dataset.group, choice: i.value, price: +i.dataset.price || 0 }); });
    });
    if (bad) { toast('Pick a ' + $('b', bad).firstChild.textContent.trim().toLowerCase()); $('input', bad).focus(); return; }
    addLine(item.id, opts, $('#optNote').value.trim());
    modal.close();
  });
  price();
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-add]');
  if (!b) return;
  var item = ITEMS[b.dataset.add];
  if (!item) return;
  if (item.options && item.options.length && modal) { pending = item; buildModal(item); modal.showModal(); }
  else {
    addLine(item.id, [], '');
    b.classList.add('added');
    var label = b.textContent;
    b.textContent = 'Added';
    setTimeout(function () { b.classList.remove('added'); b.textContent = label; }, 1400);
  }
});
if (modal) modal.addEventListener('close', function () { document.body.classList.remove('locked'); });

/* ----------------------------------------------------------- menu page */
if (page === 'menu') {
  var search = $('#menuSearch'), filts = $$('.filt input'), noHits = $('#noHits');
  function applyMenu() {
    var q = (search.value || '').trim().toLowerCase();
    var on = filts.filter(function (f) { return f.checked; }).map(function (f) { return f.value; });
    var hits = 0;
    $$('.msec').forEach(function (sec) {
      var shown = 0;
      $$('.row', sec).forEach(function (row) {
        var tags = (row.dataset.tags || '').split(' ');
        var okTag = on.every(function (t) { return tags.indexOf(t) > -1 || (t === 'gf' && tags.indexOf('gfo') > -1); });
        var okQ = !q || row.dataset.name.indexOf(q) > -1;
        var ok = okTag && okQ;
        row.hidden = !ok;
        if (ok) shown++;
      });
      sec.hidden = shown === 0;
      hits += shown;
    });
    noHits.hidden = hits > 0;
  }
  search.addEventListener('input', applyMenu);
  filts.forEach(function (f) { f.addEventListener('change', applyMenu); });
  $('#clearFilters').addEventListener('click', function () {
    search.value = ''; filts.forEach(function (f) { f.checked = false; }); applyMenu();
  });
  var links = $$('.menu-bar .cats a');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    $$('.msec').forEach(function (s) { spy.observe(s); });
  }
}

/* ---------------------------------------------------------- order page */
function slots(mode) {
  var lead = mode === 'delivery' ? O.deliveryMinutes : O.pickupMinutes;
  var now = new Date(), out = [{ v: 'asap', t: 'As soon as you can (about ' + lead + ' min)' }];
  for (var day = 0; day < 7; day++) {
    var d = new Date(now.getTime() + day * 864e5), info = D.hours[d.getDay()];
    if (info.closed) continue;
    var open = hhmm(info.open), close = hhmm(info.close) - 30;
    var start = open;
    if (day === 0) {
      var earliest = now.getHours() * 60 + now.getMinutes() + lead + 10;
      start = Math.max(open, Math.ceil(earliest / 15) * 15);
    }
    for (var m = start; m <= close; m += 15) {
      out.push({ v: day + ':' + m, t: (day === 0 ? 'Today' : day === 1 ? 'Tomorrow' : info.day) + ' at ' + fmt(m) });
      if (out.length > 60) break;
    }
    if (out.length > 60) break;
  }
  return out;
}
function paintCheckout(t) {
  var box = $('#coTotal');
  if (box) box.innerHTML = '<ul>' + totalsHTML(t) + '</ul>';
  var note = $('#modeNote');
  if (note) note.textContent = state.mode === 'delivery'
    ? 'About ' + O.deliveryMinutes + ' minutes, ' + money(O.deliveryFee) + ' flat. ' + O.deliveryRadius + '.'
    : 'Pull up out front and we will hand it through the window.';
}
if (page === 'order') {
  var whenSel = $('#whenSel');
  function fillWhen() {
    whenSel.innerHTML = slots(state.mode).map(function (s) { return '<option value="' + s.v + '">' + esc(s.t) + '</option>'; }).join('');
    if (slots(state.mode).some(function (s) { return s.v === state.when; })) whenSel.value = state.when;
    else state.when = whenSel.value;
  }
  function setMode(mode) {
    state.mode = mode;
    $$('.mode-opt').forEach(function (b) {
      var on = b.dataset.mode === mode;
      b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
    });
    $('#addrWrap').hidden = mode !== 'delivery';
    fillWhen(); renderCart();
  }
  $$('.mode-opt').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
  whenSel.addEventListener('change', function () { state.when = whenSel.value; save(); });
  $('#addrLine').addEventListener('input', function (e) { state.address = e.target.value; save(); });
  $('#addrLine').value = state.address || '';
  $$('.tip-opt').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tip = +b.dataset.tip;
      $$('.tip-opt').forEach(function (o) { o.classList.toggle('is-on', o === b); });
      renderCart();
    });
  });
  $('#coPromo').addEventListener('input', function (e) {
    var on = e.target.value.trim().toUpperCase() === O.promo.code;
    if (on !== state.promo) { state.promo = on; renderCart(); if (on) toast(O.promo.percent + '% off, nice'); }
  });
  var params = new URLSearchParams(location.search);
  if (params.get('mode') === 'delivery') state.mode = 'delivery';
  setMode(state.mode);
  $$('.tip-opt').forEach(function (o) { o.classList.toggle('is-on', +o.dataset.tip === state.tip); });

  $('#coForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#coErr'), bad = [];
    var name = $('#coName'), phone = $('#coPhone'), mail = $('#coEmail'), addr = $('#addrLine');
    [name, phone, mail, addr].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (!cart.length) { err.textContent = 'Your bag is empty. Add something first.'; return; }
    if (!name.value.trim()) { bad.push('a name'); name.setAttribute('aria-invalid', 'true'); }
    if (phone.value.replace(/\D/g, '').length < 10) { bad.push('a phone number we can text'); phone.setAttribute('aria-invalid', 'true'); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) { bad.push('an email for the receipt'); mail.setAttribute('aria-invalid', 'true'); }
    if (state.mode === 'delivery') {
      if (addr.value.trim().length < 6) { bad.push('a delivery address'); addr.setAttribute('aria-invalid', 'true'); }
      if (subtotal() < O.deliveryMinimum) { err.textContent = 'Delivery starts at ' + money(O.deliveryMinimum) + '. Add a little more or switch to pickup.'; return; }
    }
    if (bad.length) {
      err.textContent = 'We still need ' + bad.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
      $('[aria-invalid=true]').focus();
      return;
    }
    err.textContent = '';
    var t = totals(), num = 'L' + String(Math.floor(Math.random() * 9000) + 1000);
    var when = $('#whenSel').selectedOptions[0].textContent;
    var done = $('#orderDone');
    done.innerHTML = '<h2>Order in, ' + esc(name.value.trim().split(' ')[0]) + '.</h2>' +
      '<p class="num">' + num + '</p>' +
      '<p>' + (state.mode === 'pickup' ? 'Pickup at ' : 'Delivery to ') +
        esc(state.mode === 'pickup' ? '2418 N Milwaukee Ave' : addr.value.trim()) + ', ' + esc(when.toLowerCase()) + '.</p>' +
      '<ul>' + cart.map(function (l) {
        return '<li><span>' + l.qty + '&times; ' + esc(ITEMS[l.id].name) + '</span><span>' + money(unit(l) * l.qty) + '</span></li>';
      }).join('') + '<li><b>Total</b><b>' + money(t.total) + '</b></li></ul>' +
      ($('#coJoin').checked ? '<p>You are in the ' + esc(D.brand) + ' Club. That is ' + Math.round(t.sub) + ' points.</p>' : '') +
      '<p class="fine">Demo site: no order was placed and no card was charged. On a real site this would print in the kitchen and text you when it is ready.</p>' +
      '<button class="btn btn-ghost" type="button" id="startOver">Start another order</button>';
    done.hidden = false;
    this.hidden = true;
    done.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
    $('#startOver').addEventListener('click', function () {
      cart = []; state.promo = false; renderCart();
      done.hidden = true; $('#coForm').hidden = false; $('#coPromo').value = '';
      scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
    });
    cart = []; renderCart();
  });
}

/* ------------------------------------------------------- simple forms */
var emailOk = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
function simpleForm(formId, inputId, msgId, good) {
  var f = $(formId); if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $(inputId).value.trim(), m = $(msgId);
    var ok = emailOk(v);
    m.textContent = ok ? good : 'That email does not look right yet.';
    m.classList.toggle('bad', !ok);
    if (ok) $(inputId).value = '';
  });
}
simpleForm('#joinForm', '#joinEmail', '#joinMsg', 'You are in. Your free side is waiting. (Demo: nothing was sent.)');
simpleForm('#newsForm', '#newsEmail', '#newsMsg', 'Signed up. See you next month. (Demo: nothing was sent.)');
simpleForm('#giftForm', '#giftEmail', '#giftMsg', 'On its way. (Demo: no card was charged and no email was sent.)');

var gcAmt = $('#gcAmt');
if (gcAmt) {
  var paintGc = function () {
    var picked = $('input[name=gift]:checked'), other = $('#giftOther');
    var v = other && other.value ? other.value : picked ? picked.value : 50;
    gcAmt.textContent = '$' + v;
  };
  $$('input[name=gift]').forEach(function (i) { i.addEventListener('change', function () { $('#giftOther').value = ''; paintGc(); }); });
  $('#giftOther').addEventListener('input', paintGc);
}

/* --------------------------------------------------------- reservation */
var resForm = $('#resForm');
if (resForm) {
  var dateIn = $('#resDate'), timeSel = $('#resTime');
  var today = new Date(), iso = function (d) { return d.toISOString().slice(0, 10); };
  dateIn.min = iso(today);
  dateIn.max = iso(new Date(today.getTime() + 30 * 864e5));
  dateIn.value = iso(today);
  function fillTimes() {
    var d = new Date(dateIn.value + 'T12:00:00');
    var info = D.hours[isNaN(d) ? today.getDay() : d.getDay()];
    if (info.closed) {
      timeSel.innerHTML = '<option value="">Closed on ' + info.day + 's</option>';
      return;
    }
    var out = [], close = hhmm(info.close) - 60;
    for (var m = hhmm(info.open); m <= close; m += 30) out.push('<option>' + fmt(m) + '</option>');
    timeSel.innerHTML = out.join('');
  }
  dateIn.addEventListener('change', fillTimes); fillTimes();
  resForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#resErr'), name = $('#resName'), phone = $('#resPhone'), bad = [];
    [name, phone].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (!timeSel.value) { err.textContent = 'We are closed that day. Pick another date.'; return; }
    if (!name.value.trim()) { bad.push('a name'); name.setAttribute('aria-invalid', 'true'); }
    if (phone.value.replace(/\D/g, '').length < 10) { bad.push('a phone number'); phone.setAttribute('aria-invalid', 'true'); }
    if (bad.length) { err.textContent = 'We need ' + bad.join(' and ') + '.'; $('[aria-invalid=true]').focus(); return; }
    var party = $('#resParty').value;
    resForm.innerHTML = '<div class="sent"><h3>Got it, ' + esc(name.value.trim().split(' ')[0]) + '.</h3>' +
      '<p>Table for ' + party + ', ' + esc(new Date(dateIn.value + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })) +
      ' at ' + esc(timeSel.value) + '. We will text to confirm.</p>' +
      '<p class="fine">Demo form: nothing was booked and no message was sent.</p></div>';
    $('.sent', resForm).setAttribute('tabindex', '-1');
    $('.sent', resForm).focus();
  });
}

/* ------------------------------------------------------ event inquiry */
var inqForm = $('#inqForm');
if (inqForm) {
  var inqDate = $('#inqDate');
  inqDate.min = new Date().toISOString().slice(0, 10);
  inqForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('#inqErr'), name = $('#inqName'), mail = $('#inqEmail'), date = $('#inqDate'), guests = $('#inqGuests'), bad = [];
    [name, mail, date, guests].forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (!name.value.trim()) { bad.push('a name'); name.setAttribute('aria-invalid', 'true'); }
    if (!emailOk(mail.value.trim())) { bad.push('an email'); mail.setAttribute('aria-invalid', 'true'); }
    if (!date.value) { bad.push('a date'); date.setAttribute('aria-invalid', 'true'); }
    if (!(+guests.value >= 7)) { bad.push('a headcount of seven or more'); guests.setAttribute('aria-invalid', 'true'); }
    if (bad.length) {
      err.textContent = 'We need ' + bad.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
      $('[aria-invalid=true]').focus(); return;
    }
    inqForm.innerHTML = '<div class="sent"><h3>Thanks, ' + esc(name.value.trim().split(' ')[0]) + '.</h3>' +
      '<p>We have your date down for ' + esc(guests.value) + ' guests and will come back within one business day with what is open and a menu to match.</p>' +
      '<p class="fine">Demo form: nothing was sent and no date is held.</p></div>';
    $('.sent', inqForm).setAttribute('tabindex', '-1');
    $('.sent', inqForm).focus();
  });
}

renderCart();
})();
