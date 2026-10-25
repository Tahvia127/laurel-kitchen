/* Laurel — static build. Reads data/, writes index.html, menu.html, order.html, events.html.
   No dependencies. Run: node build.mjs                                                      */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const site = JSON.parse(readFileSync('data/site.json', 'utf8'));
const menu = JSON.parse(readFileSync('data/menu.json', 'utf8'));

/* ---------------------------------------------------------------- helpers */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
const plus = n => (n > 0 ? '+' + money(n) : n < 0 ? '-' + money(-n) : 'No charge');
const tel = site.contact.phone.replace(/[^\d+]/g, '');
const img = n => `assets/img/${n}.webp`;
const t12 = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am', hr = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hr}:${String(m).padStart(2, '0')}${ap}` : `${hr}${ap}`;
};

/* --------------------------------------------------------------- validate */
const errors = [];
const seen = new Set();
const groupIds = new Set(menu.optionGroups.map(g => g.id));
const need = n => { if (!existsSync(`assets/img/${n}.webp`)) errors.push(`missing image assets/img/${n}.webp`); return n; };

Object.keys(menu.legend).forEach(k => { if (!menu.legendShort?.[k]) errors.push(`legendShort is missing "${k}"`); });
menu.optionGroups.forEach(g => {
  if (!['single', 'multi'].includes(g.type)) errors.push(`${g.id}: type must be single or multi`);
  if (!g.choices?.length) errors.push(`${g.id}: needs at least one choice`);
  g.choices.forEach(c => { if (typeof c.price !== 'number') errors.push(`${g.id} / ${c.name}: price must be a number`); });
  if (g.type === 'single' && g.choices.filter(c => c.default).length > 1) errors.push(`${g.id}: only one default`);
});
const items = [];
menu.sections.forEach(s => {
  if (!s.items?.length) errors.push(`section ${s.id}: no items`);
  s.items.forEach(i => {
    if (seen.has(i.id)) errors.push(`duplicate item id "${i.id}"`);
    seen.add(i.id);
    if (typeof i.price !== 'number' || i.price < 0) errors.push(`${i.id}: price must be a positive number`);
    if (!i.description) errors.push(`${i.id}: needs a description`);
    (i.options || []).forEach(o => { if (!groupIds.has(o)) errors.push(`${i.id}: unknown option group "${o}"`); });
    (i.tags || []).forEach(tg => { if (!menu.legend[tg]) errors.push(`${i.id}: tag "${tg}" is not in the legend`); });
    if (i.image) need(i.image);
    items.push({ ...i, section: s.id, sectionName: s.name });
  });
});
site.orderways.forEach(o => need(o.image));
['hero', 'hero-2', 'chef', 'room', 'events-table', 'gallery-1', 'gallery-2', 'gallery-3', 'gallery-4',
  'vibe-friends', 'vibe-pizza', 'vibe-cheers', 'chef-plate', 'room-plants'].forEach(need);
site.hours.days.forEach(d => {
  if (d.closed) return;
  if (!/^\d\d:\d\d$/.test(d.open || '') || !/^\d\d:\d\d$/.test(d.close || '')) errors.push(`${d.day}: open and close must look like 17:30`);
});
const featured = items.filter(i => i.featured);
if (featured.length < 3) errors.push('mark at least three dishes featured:true');
featured.forEach(f => { if (!f.image) errors.push(`${f.id} is featured, so it needs an image`); });
if (errors.length) { console.error('  build failed\n  - ' + errors.join('\n  - ')); process.exit(1); }

/* ------------------------------------------------------------ small parts */
const ICON = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h3l1.6 4.2-2 1.4a12 12 0 0 0 6.8 6.8l1.4-2L21 15v3a3 3 0 0 1-3.2 3A16.8 16.8 0 0 1 3 6.2 3 3 0 0 1 6 3Z"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8h13l-1 12h-11Z"/><path d="M9 8V6.2a3 3 0 0 1 6 0V8"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="m12 3 2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 16.9 6.4 20l1.4-6.2L3 9.5l6.4-.7Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
};
const tagPill = tg => `<span class="tag tag-${tg}" title="${esc(menu.legend[tg])}">${esc(menu.legend[tg])}</span>`;
const stars = n => `<span class="stars" role="img" aria-label="${n} out of 5">${ICON.star.repeat(n)}</span>`;

const hoursRows = site.hours.days.map((d, i) =>
  `<li data-dow="${i}"><span class="hr-day">${esc(d.day)}</span><span class="hr-time">${d.closed ? 'Closed' : `${t12(d.open)} &ndash; ${t12(d.close)}`}</span>${d.note ? `<span class="hr-note">${esc(d.note)}</span>` : ''}</li>`
).join('');

const demo = site.demo || {};
const DEMOBAR = demo.show ? `<div class="demo-bar" role="note"><p>${esc(demo.text)}</p>
  <a href="${esc(demo.url)}" target="_blank" rel="noopener noreferrer">${esc(demo.linkText)}</a></div>` : '';
const DEMOFOOT = demo.show ? `<div class="demo-foot"><p>${esc(demo.text)} Every phone number, email and price here is made up, and nothing on this site takes a payment.</p>
  <a href="${esc(demo.url)}" target="_blank" rel="noopener noreferrer">${esc(demo.linkText)} &rarr;</a></div>` : '';

/* ------------------------------------------------------------------- head */
const head = (page, { title, description }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://tahvia127.github.io/laurel-kitchen/${page === 'index' ? '' : page + '.html'}">
<meta property="og:type" content="restaurant">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${img('hero')}">
<meta name="theme-color" content="#F3E3C8">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23E04A26'/%3E%3Cpath d='M20 44c0-14 8-24 24-26-2 18-10 26-24 26Z' fill='%23FFD166'/%3E%3Cpath d='M20 46c4-8 10-14 18-18' stroke='%23E04A26' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,700&family=Outfit:wght@400;500;600;700&family=Caveat:wght@600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/styles.css">
${page === 'index' ? `<link rel="preload" as="image" href="${img('hero')}" fetchpriority="high">` : ''}
<script type="application/ld+json">${JSONLD}</script>
</head>
<body data-page="${page}">
<a class="skip" href="#main">Skip to content</a>
${DEMOBAR}`;

/* -------------------------------------------------------------------- nav */
const NAVLINKS = [
  ['index.html#menu-preview', 'Menu', 'menu'],
  ['order.html', 'Order', 'order'],
  ['events.html', 'Events', 'events'],
  ['index.html#visit', 'Visit', 'visit'],
];
const nav = page => `
<header class="nav" id="nav">
  <div class="nav-in">
    <a class="brand" href="index.html" aria-label="${esc(site.brand.name)}, home">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48"><path d="M13 36c0-12 7-21 22-23-2 16-9 23-22 23Z"/><path class="stem" d="M13 38c4-8 10-15 18-20"/></svg>
      </span>
      <span class="brand-txt"><b>${esc(site.brand.name)}</b><small>${esc(site.brand.neighborhood)}</small></span>
    </a>
    <nav class="nav-links" aria-label="Primary">
      <ul>${NAVLINKS.map(([href, label, id]) =>
        `<li><a href="${href}"${page === id ? ' aria-current="page"' : ''}>${label}</a></li>`).join('')}</ul>
    </nav>
    <div class="nav-right">
      <span class="status" id="navStatus" aria-live="polite"></span>
      <a class="nav-tel" href="tel:${tel}" aria-label="Call ${esc(site.contact.phone)}">${ICON.phone}<span>${esc(site.contact.phone)}</span></a>
      <a class="btn btn-order" href="order.html">${ICON.bag}<span>${esc('Order online')}</span></a>
      <button class="cart-btn" type="button" id="cartBtn" aria-label="Your order">${ICON.bag}<span class="cart-count" id="cartCount" hidden>0</span></button>
    </div>
  </div>
</header>`;

/* ------------------------------------------------------- shared tail bits */
const cartDrawer = `
<div class="drawer-scrim" id="drawerScrim" hidden></div>
<aside class="drawer" id="cartDrawer" aria-label="Your order" aria-hidden="true">
  <div class="drawer-head">
    <h2>Your order</h2>
    <button class="icon-btn" type="button" data-close-drawer aria-label="Close">&times;</button>
  </div>
  <div class="drawer-body" id="cartLines"></div>
  <div class="drawer-foot" id="cartFoot"></div>
</aside>
<dialog class="modal" id="optModal" aria-labelledby="optTitle"><form method="dialog" id="optForm"></form></dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<a class="mobile-order" href="order.html">${ICON.bag} Order online &middot; pickup in ${site.ordering.pickupMinutes} min</a>`;

const footer = () => `
${DEMOFOOT}
<footer class="foot">
  <div class="shell foot-grid">
    <div class="foot-brand">
      <a class="brand light" href="index.html">
        <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M13 36c0-12 7-21 22-23-2 16-9 23-22 23Z"/><path class="stem" d="M13 38c4-8 10-15 18-20"/></svg></span>
        <span class="brand-txt"><b>${esc(site.brand.name)}</b><small>${esc(site.brand.tagline)}</small></span>
      </a>
      <p class="foot-pitch">${esc(site.brand.shortPitch)}</p>
      <ul class="social">${site.contact.social.map(s =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></li>`).join('')}</ul>
    </div>
    <div class="foot-col">
      <h3>Come in</h3>
      <address>
        <a href="${esc(site.contact.mapLink)}" target="_blank" rel="noopener noreferrer">${esc(site.contact.address.line1)}<br>${esc(site.contact.address.line2)}</a><br>
        <a href="tel:${tel}">${esc(site.contact.phone)}</a><br>
        <a href="mailto:${esc(site.contact.email)}">${esc(site.contact.email)}</a>
      </address>
    </div>
    <div class="foot-col">
      <h3>Hours</h3>
      <ul class="foot-hours">${hoursRows}</ul>
      <p class="fine">${esc(site.hours.kitchenNote)}</p>
    </div>
    <div class="foot-col">
      <h3>More</h3>
      <ul class="foot-links">
        <li><a href="menu.html">Full menu</a></li>
        <li><a href="order.html">Order online</a></li>
        <li><a href="events.html">Private events</a></li>
        <li><a href="events.html#catering">Catering</a></li>
        <li><a href="index.html#gift">Gift cards</a></li>
        <li><a href="index.html#faq">FAQ</a></li>
        <li><a href="mailto:${esc(site.contact.jobsEmail)}">Jobs</a></li>
      </ul>
    </div>
  </div>
  <div class="shell foot-base">
    <p>&copy; <span id="yr">2026</span> ${esc(site.brand.name)} ${esc(site.brand.tagline)}. ${esc(site.contact.address.line1)}, ${esc(site.contact.address.line2)}.</p>
    <p class="fine">Accessibility: ${esc(site.visit.access)}</p>
  </div>
</footer>
${cartDrawer}
<script>window.LK=${JSON.stringify(CLIENT).replace(/</g, '\\u003c')};</script>
<script src="assets/js/site.js"></script>
</body>
</html>`;

/* ------------------------------------------------------------ client data */
const CLIENT = {
  brand: site.brand.name,
  hours: site.hours.days.map(d => ({ day: d.day, label: d.label, closed: !!d.closed, open: d.open || null, close: d.close || null, note: d.note || null })),
  ordering: site.ordering,
  legend: menu.legend,
  groups: menu.optionGroups,
  sections: menu.sections.map(s => ({ id: s.id, name: s.name, blurb: s.blurb || '', availability: s.availability || null,
    items: s.items.map(i => ({ id: i.id, name: i.name, description: i.description, price: i.price, tags: i.tags || [],
      image: i.image || null, options: i.options || [], popular: !!i.popular, featured: !!i.featured })) })),
};

/* -------------------------------------------------------------- JSON-LD */
const JSONLD = JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Restaurant',
  name: site.brand.name, description: site.seo.description, image: img('hero'),
  servesCuisine: site.seo.cuisine, priceRange: site.seo.priceRange,
  telephone: site.contact.phone, email: site.contact.email,
  address: { '@type': 'PostalAddress', streetAddress: site.contact.address.line1, addressLocality: 'Chicago', addressRegion: 'IL', postalCode: '60647', addressCountry: 'US' },
  geo: { '@type': 'GeoCoordinates', latitude: site.seo.geo.lat, longitude: site.seo.geo.lng },
  openingHoursSpecification: site.hours.days.filter(d => !d.closed).map(d => ({
    '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${d.day}`, opens: d.open, closes: d.close })),
  acceptsReservations: true,
  hasMenu: {
    '@type': 'Menu', name: `${site.brand.name} menu`,
    hasMenuSection: menu.sections.map(s => ({
      '@type': 'MenuSection', name: s.name, description: s.blurb || undefined,
      hasMenuItem: s.items.map(i => ({ '@type': 'MenuItem', name: i.name, description: i.description,
        offers: { '@type': 'Offer', price: i.price.toFixed(2), priceCurrency: 'USD' } })) })),
  },
  potentialAction: [
    { '@type': 'OrderAction', target: { '@type': 'EntryPoint', urlTemplate: 'https://tahvia127.github.io/laurel-kitchen/order.html', actionPlatform: ['https://schema.org/DesktopWebPlatform', 'https://schema.org/MobileWebPlatform'] }, deliveryMethod: ['https://schema.org/OnSitePickup', 'https://schema.org/ParcelService'] },
  ],
}).replace(/</g, '\\u003c');


/* --------------------------------------------------- static OSM map */
function mapTiles(zoom = 16, cols = 3, rows = 2) {
  const { lat, lng } = site.seo.geo, n = 2 ** zoom, rad = lat * Math.PI / 180;
  const xf = (lng + 180) / 360 * n;
  const yf = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  const x0 = Math.floor(xf) - Math.floor(cols / 2), y0 = Math.floor(yf) - Math.floor(rows / 2);
  const tiles = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    tiles.push(`<img src="https://tile.openstreetmap.org/${zoom}/${x0 + c}/${y0 + r}.png" alt="" width="256" height="256" loading="lazy">`);
  const px = (xf - x0) * 256, py = (yf - y0) * 256;
  return `<a class="map-tiles" href="${esc(site.contact.mapLink)}" target="_blank" rel="noopener noreferrer"
      aria-label="Open a map of ${esc(site.contact.address.line1)} in a new tab"
      style="--cols:${cols};--rows:${rows}">
      <span class="tiles" aria-hidden="true">${tiles.join('')}</span>
      <span class="map-pin" style="left:${px.toFixed(1)}px;top:${py.toFixed(1)}px" aria-hidden="true">${ICON.pin}</span>
      <span class="map-attr">&copy; <span>OpenStreetMap</span> contributors</span>
    </a>
    <a class="btn btn-ghost sm" href="${esc(site.contact.mapLink)}" target="_blank" rel="noopener noreferrer">Open in maps</a>`;
}

/* ------------------------------------------------------------- components */
const dishCard = (i, cls = '') => `
  <article class="dish ${cls}" data-item="${esc(i.id)}">
    <div class="dish-im">
      <img src="${img(i.image)}" alt="${esc(i.name)}" loading="lazy" width="900" height="900">
      ${i.popular ? '<span class="sticker pop">Most ordered</span>' : ''}
    </div>
    <div class="dish-bd">
      <div class="dish-top"><h3>${esc(i.name)}</h3><span class="price">${money(i.price)}</span></div>
      <p>${esc(i.description)}</p>
      ${(i.tags || []).length ? `<div class="tags">${i.tags.map(tagPill).join('')}</div>` : ''}
      <button class="btn btn-add" type="button" data-add="${esc(i.id)}">Add to order</button>
    </div>
  </article>`;

const menuRow = i => `
  <li class="row" data-item="${esc(i.id)}" data-tags="${(i.tags || []).join(' ')}" data-name="${esc((i.name + ' ' + i.description + ' ' + i.sectionName + ' ' + (i.tags || []).map(t => menu.legend[t]).join(' ')).toLowerCase())}">
    ${i.image ? `<div class="row-im"><img src="${img(i.image)}" alt="${esc(i.name)}" loading="lazy" width="900" height="900"></div>` : ''}
    <div class="row-bd">
      <div class="row-top">
        <h3>${esc(i.name)}${i.popular ? '<span class="chip-pop">Popular</span>' : ''}</h3>
        <span class="dots" aria-hidden="true"></span>
        <span class="price">${money(i.price)}</span>
      </div>
      <p>${esc(i.description)}</p>
      ${(i.tags || []).length ? `<div class="tags">${i.tags.map(tagPill).join('')}</div>` : ''}
    </div>
    <button class="btn btn-add sm" type="button" data-add="${esc(i.id)}">Add</button>
  </li>`;

const faqList = (list, cls = '') => `<div class="faq ${cls}">${list.map((f, n) => `
  <details${n === 0 ? ' open' : ''}><summary>${esc(f.q)}<span class="chev" aria-hidden="true"></span></summary><p>${esc(f.a)}</p></details>`).join('')}</div>`;

/* ------------------------------------------------------------------ pages */
const B = site.brand, O = site.ordering;

const PAGES = {};

/* ============================================================ INDEX ===== */
PAGES.index = head('index', { title: site.seo.title, description: site.seo.description }) + nav('home') + `
<main id="main">

<section class="hero" id="top">
  <div class="hero-in">
    <div class="hero-copy">
      <p class="kicker"><span class="dot"></span>${esc(B.hero.kicker)}</p>
      <h1>${esc(B.hero.lead)}<br><em>${esc(B.hero.leadEm)}</em></h1>
      <p class="lede">${esc(B.hero.sub)}</p>
      <div class="hero-cta">
        <a class="btn btn-big btn-primary" href="order.html">${ICON.bag} Order online</a>
        <a class="btn btn-big btn-ghost" href="#reserve">Book a table</a>
      </div>
      <p class="hero-status" id="heroStatus"></p>
    </div>
    <div class="hero-art">
      <figure class="hero-card tilt-a">
        <img src="${img('hero')}" alt="A table of shared plates and salads from above" width="1100" height="1375" fetchpriority="high">
      </figure>
      <figure class="hero-chip tilt-b">
        <img src="${img('hero-chip')}" alt="A wood-fired white pizza being pulled apart" width="600" height="600" loading="lazy">
      </figure>
      <span class="blob blob-1" aria-hidden="true"></span>
      <span class="blob blob-2" aria-hidden="true"></span>
      <p class="scribble" aria-hidden="true">let&rsquo;s eat</p>
    </div>
  </div>
  <ul class="hero-stickers">${B.hero.stickers.map((s, n) => `<li style="--i:${n}">${esc(s)}</li>`).join('')}</ul>
</section>

<div class="marquee" aria-hidden="true"><div class="marquee-track">${
  Array.from({ length: 2 }, () => B.marquee.map(m => `<span>${esc(m)}</span>`).join('<i>&bull;</i>')).join('<i>&bull;</i>')
}</div></div>

<section class="ways" id="order-ways">
  <div class="shell">
    <header class="sec-head">
      <p class="kicker">Three ways to eat</p>
      <h2>However you want it, <em>it comes from us</em></h2>
      <p class="sec-sub">No third-party apps, no inflated menu prices, no one in the middle. ${esc(O.promo.blurb)}</p>
    </header>
    <div class="way-grid">${site.orderways.map((w, n) => `
      <article class="way rv" style="--i:${n}">
        <div class="way-im"><img src="${img(w.image)}" alt="" loading="lazy" width="1000" height="750"><span class="way-time">${ICON.clock}${esc(w.time)}</span></div>
        <h3>${esc(w.title)}</h3>
        <p>${esc(w.body)}</p>
        <a class="link-arrow" href="${w.id === 'catering' ? 'events.html' : `order.html?mode=${w.id}`}">${esc(w.cta)} ${ICON.arrow}</a>
      </article>`).join('')}
    </div>
  </div>
</section>

<section class="featured" id="featured">
  <div class="shell">
    <header class="sec-head center">
      <p class="kicker">Order these first</p>
      <h2>The ones people <em>come back for</em></h2>
    </header>
    <div class="dish-grid">${featured.slice(0, 6).map(i => dishCard(i, 'rv')).join('')}</div>
    <p class="center-cta"><a class="btn btn-ghost" href="menu.html">See the whole menu ${ICON.arrow}</a></p>
  </div>
</section>

<section class="preview" id="menu-preview">
  <div class="shell">
    <header class="sec-head">
      <p class="kicker">The menu</p>
      <h2>Pizza, pasta, <em>and a lot of sides</em></h2>
      <p class="sec-sub">Prices here are the prices at the table and at checkout. ${esc(menu.allergenNote)}</p>
    </header>
    <div class="prev-grid">${menu.sections.filter(s => !['kids'].includes(s.id)).slice(0, 8).map(s => `
      <a class="prev-card rv" href="menu.html#${esc(s.id)}">
        <h3>${esc(s.name)}</h3>
        <p>${esc(s.blurb)}</p>
        <span class="prev-n">${s.items.length} ${s.items.length === 1 ? 'thing' : 'things'}</span>
      </a>`).join('')}
    </div>
  </div>
</section>

<section class="story" id="story">
  <div class="shell story-grid">
    <div class="story-art">
      <figure class="st-a"><img src="${img('chef')}" alt="A cook finishing a plate on the pass" loading="lazy" width="1000" height="1250"></figure>
      <figure class="st-b"><img src="${img('room')}" alt="The dining room on a busy night" loading="lazy" width="1000" height="1250"></figure>
      <span class="blob blob-3" aria-hidden="true"></span>
    </div>
    <div class="story-copy">
      <p class="kicker">${esc(site.story.kicker)}</p>
      <h2>${esc(site.story.heading)} <em>${esc(site.story.headingEm)}</em></h2>
      ${site.story.body.map(p => `<p>${esc(p)}</p>`).join('')}
      <p class="sig">${esc(site.story.signature)}</p>
      <ul class="facts">${site.story.facts.map(f => `<li><b>${esc(f.n)}</b><span>${esc(f.l)}</span></li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="rewards" id="rewards">
  <div class="shell rw-grid">
    <div class="rw-copy">
      <p class="kicker">${esc(site.rewards.kicker)}</p>
      <h2>${esc(site.rewards.heading)} <em>${esc(site.rewards.headingEm)}</em></h2>
      <p class="lede">${esc(site.rewards.body)}</p>
      <form class="join" id="joinForm" novalidate>
        <label class="sr" for="joinEmail">Email address</label>
        <input id="joinEmail" type="email" placeholder="you@example.com" autocomplete="email" required>
        <button class="btn btn-primary" type="submit">Join ${esc(site.rewards.name)}</button>
        <p class="form-msg" id="joinMsg" aria-live="polite"></p>
      </form>
    </div>
    <ul class="perks">${site.rewards.perks.map((p, n) => `
      <li class="rv" style="--i:${n}"><b>${esc(p.t)}</b><span>${esc(p.d)}</span></li>`).join('')}
    </ul>
  </div>
</section>

<section class="reviews" id="reviews">
  <div class="shell">
    <header class="sec-head center">
      <p class="kicker">${esc(site.reviews.kicker)}</p>
      <h2>${esc(site.reviews.heading)} <em>${esc(site.reviews.headingEm)}</em></h2>
    </header>
    <div class="rev-grid">${site.reviews.items.map((r, n) => `
      <blockquote class="rev rv" style="--i:${n}">
        ${stars(r.stars)}
        <p>${esc(r.quote)}</p>
        <footer><b>${esc(r.name)}</b><span>${esc(r.source)} &middot; ${esc(r.when)}</span></footer>
      </blockquote>`).join('')}
    </div>
    <ul class="press">${site.press.items.map(p => `<li><q>${esc(p.quote)}</q><cite>${esc(p.source)}</cite></li>`).join('')}</ul>
    <p class="fine center">${esc(site.reviews.note)} ${esc(site.press.note)}</p>
  </div>
</section>

<section class="events-teaser" id="events">
  <div class="shell ev-grid">
    <figure class="ev-im"><img src="${img('events-table')}" alt="The back room set for a long table dinner" loading="lazy" width="1500" height="843"></figure>
    <div class="ev-copy">
      <p class="kicker">${esc(site.events.kicker)}</p>
      <h2>${esc(site.events.heading)} <em>${esc(site.events.headingEm)}</em></h2>
      <p class="lede">${esc(site.events.lead)}</p>
      <ul class="ev-list">${site.events.packages.map(p => `<li><b>${esc(p.name)}</b><span>${esc(p.capacity)} &middot; ${esc(p.price)}</span></li>`).join('')}</ul>
      <a class="btn btn-primary" href="events.html">Plan an event</a>
    </div>
  </div>
</section>

<section class="gallery" id="gallery" aria-label="Photos">
  <div class="gal-track">${['gallery-1', 'vibe-friends', 'gallery-3', 'chef-plate', 'gallery-2', 'vibe-pizza', 'gallery-4', 'room-plants', 'vibe-cheers'].map((g, n) => `
    <figure style="--i:${n}"><img src="${img(g)}" alt="" loading="lazy" width="800" height="800"></figure>`).join('')}
  </div>
</section>

<section class="visit" id="visit">
  <div class="shell">
    <header class="sec-head">
      <p class="kicker">${esc(site.visit.kicker)}</p>
      <h2>${esc(site.visit.heading)} <em>${esc(site.visit.headingEm)}</em></h2>
    </header>
    <div class="visit-grid">
      <div class="visit-card">
        <h3>${ICON.clock} Hours</h3>
        <ul class="hours-list" id="hoursList">${hoursRows}</ul>
        <p class="fine">${esc(site.hours.kitchenNote)}</p>
        <p class="hh">${esc(site.hours.happyHour)}</p>
      </div>
      <div class="visit-card">
        <h3>${ICON.pin} Getting here</h3>
        <address><a href="${esc(site.contact.mapLink)}" target="_blank" rel="noopener noreferrer">${esc(site.contact.address.line1)}<br>${esc(site.contact.address.line2)}</a></address>
        <dl class="visit-dl">
          <div><dt>Transit</dt><dd>${esc(site.visit.transit)}</dd></div>
          <div><dt>Parking</dt><dd>${esc(site.visit.parking)}</dd></div>
          <div><dt>Access</dt><dd>${esc(site.visit.access)}</dd></div>
          <div><dt>Dogs</dt><dd>${esc(site.visit.dogs)}</dd></div>
        </dl>
        <p><a class="link-arrow" href="tel:${tel}">Call ${esc(site.contact.phone)} ${ICON.arrow}</a></p>
      </div>
      <div class="visit-map">
        ${mapTiles()}
      </div>
    </div>
  </div>
</section>

<section class="reserve" id="reserve">
  <div class="shell res-grid">
    <div class="res-copy">
      <p class="kicker">Book a table</p>
      <h2>Save a seat, <em>or just walk in</em></h2>
      <p class="lede">${esc(site.reservations.blurb)}</p>
      <p class="fine">${esc(site.reservations.largePartyNote)} We hold booked tables for ${site.reservations.holdMinutes} minutes.</p>
    </div>
    <form class="res-form card" id="resForm" novalidate>
      <div class="field-row">
        <label><span>Date</span><input type="date" id="resDate" required></label>
        <label><span>Time</span><select id="resTime" required></select></label>
        <label><span>Party</span><select id="resParty">${Array.from({ length: site.reservations.maxParty }, (_, n) =>
          `<option value="${n + 1}">${n + 1} ${n ? 'people' : 'person'}</option>`).join('')}</select></label>
      </div>
      <div class="field-row">
        <label><span>Name</span><input id="resName" autocomplete="name" required></label>
        <label><span>Phone</span><input id="resPhone" type="tel" autocomplete="tel" required></label>
      </div>
      <label><span>Anything we should know <i>optional</i></span><input id="resNote" placeholder="Birthday, stroller, allergy, booth if you have one"></label>
      <p class="err" id="resErr" role="alert"></p>
      <button class="btn btn-primary btn-wide" type="submit">Request a table</button>
      <p class="fine">Demo form. On a real site this would hit OpenTable, Resy or Tock. Nothing is booked from this page.</p>
    </form>
  </div>
</section>

<section class="gift" id="gift">
  <div class="shell gift-grid">
    <div class="gift-copy">
      <p class="kicker">Gift cards</p>
      <h2>${esc(site.giftcards.heading)}, <em>any amount</em></h2>
      <p class="lede">${esc(site.giftcards.body)}</p>
      <form class="gift-form" id="giftForm" novalidate>
        <div class="amounts" role="group" aria-label="Amount">${site.giftcards.amounts.map((a, n) =>
          `<label class="amt"><input type="radio" name="gift" value="${a}"${n === 1 ? ' checked' : ''}><span>$${a}</span></label>`).join('')}
          <label class="amt amt-other"><span class="sr">Other amount</span><input type="number" id="giftOther" min="25" max="500" step="5" placeholder="Other"></label>
        </div>
        <label><span>Send to</span><input id="giftEmail" type="email" placeholder="them@example.com" required></label>
        <button class="btn btn-primary" type="submit">Buy a gift card</button>
        <p class="form-msg" id="giftMsg" aria-live="polite"></p>
      </form>
    </div>
    <figure class="gift-card-art" aria-hidden="true">
      <div class="gc">
        <span class="gc-brand">${esc(site.brand.name)}</span>
        <span class="gc-amt" id="gcAmt">$50</span>
        <span class="gc-foot">${esc(site.brand.tagline)}</span>
      </div>
    </figure>
  </div>
</section>

<section class="faq-sec" id="faq">
  <div class="shell faq-grid">
    <header class="sec-head">
      <p class="kicker">Before you ask</p>
      <h2>Questions we get <em>every week</em></h2>
      <p class="sec-sub">Still stuck? Call us. A person picks up.</p>
      <a class="btn btn-ghost" href="tel:${tel}">${ICON.phone} ${esc(site.contact.phone)}</a>
    </header>
    ${faqList(site.faq)}
  </div>
</section>

<section class="news" id="news">
  <div class="shell news-in">
    <div>
      <h2>${esc(site.newsletter.heading)}</h2>
      <p>${esc(site.newsletter.body)}</p>
    </div>
    <form class="news-form" id="newsForm" novalidate>
      <label class="sr" for="newsEmail">Email address</label>
      <input id="newsEmail" type="email" placeholder="you@example.com" autocomplete="email" required>
      <button class="btn btn-primary" type="submit">Sign up</button>
      <p class="form-msg" id="newsMsg" aria-live="polite"></p>
    </form>
  </div>
</section>

</main>` + footer();

/* ============================================================= MENU ===== */
PAGES.menu = head('menu', {
  title: `Menu | ${B.name}, ${B.neighborhood}`,
  description: `The full ${B.name} menu: wood-fired pizza, hand-rolled pasta, big plates, sides, sweets, drinks and weekend brunch. Prices match what you pay at checkout.`,
}) + nav('menu') + `
<main id="main">
<section class="page-head">
  <div class="shell">
    <p class="kicker">Updated ${new Date(menu.updated + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
    <h1>The whole <em>menu</em></h1>
    <p class="lede">Everything we make, with the prices you will actually pay. Add anything straight to an order as you read.</p>
    <div class="head-cta">
      <a class="btn btn-primary" href="order.html">${ICON.bag} Start an order</a>
      <a class="btn btn-ghost" href="tel:${tel}">${ICON.phone} Call us</a>
    </div>
  </div>
</section>

<div class="menu-bar" id="menuBar">
  <div class="shell menu-bar-in">
    <nav class="cats" aria-label="Menu sections">
      <ul>${menu.sections.map(s => `<li><a href="#${esc(s.id)}">${esc(s.name)}</a></li>`).join('')}</ul>
    </nav>
    <div class="menu-tools">
      <label class="search"><span class="sr">Search the menu</span>
        <input type="search" id="menuSearch" placeholder="Search dishes"></label>
      <div class="filters" role="group" aria-label="Filter by diet">
        ${Object.entries(menu.legend).map(([k, v]) =>
          `<label class="filt" title="${esc(v)}"><input type="checkbox" value="${k}"><span>${esc(menu.legendShort[k] || v)}</span></label>`).join('')}
      </div>
    </div>
  </div>
</div>

<p class="no-hits" id="noHits" hidden>Nothing matches that. <button class="linkish" type="button" id="clearFilters">Clear the filters</button></p>

${menu.sections.map(s => `
<section class="msec" id="${esc(s.id)}">
  <div class="shell">
    <header class="msec-head">
      <h2>${esc(s.name)}</h2>
      <p>${esc(s.blurb)}</p>
      ${s.availability ? `<p class="avail">${ICON.clock}${esc(s.availability)}</p>` : ''}
    </header>
    <ul class="rows">${s.items.map(i => menuRow({ ...i, sectionName: s.name })).join('')}</ul>
  </div>
</section>`).join('')}

<section class="legend-sec">
  <div class="shell">
    <h2 class="sr">Menu key</h2>
    <ul class="legend">${Object.entries(menu.legend).map(([k, v]) => `<li>${tagPill(k)}</li>`).join('')}</ul>
    <p class="fine">${esc(menu.allergenNote)}</p>
    <p class="fine">Prices do not include tax or tip. Parties of seven or more are a private event, which we do all the time.</p>
  </div>
</section>
</main>` + footer();

/* ============================================================ ORDER ===== */
PAGES.order = head('order', {
  title: `Order online | ${B.name}, ${B.neighborhood}`,
  description: `Order ${B.name} for pickup in about ${O.pickupMinutes} minutes or delivery in about ${O.deliveryMinutes}. Direct from the restaurant, no third-party markup.`,
}) + nav('order') + `
<main id="main" class="order-main">
<section class="page-head tight">
  <div class="shell">
    <p class="kicker">Straight from the kitchen</p>
    <h1>Order <em>online</em></h1>
    <p class="lede">No app, no service fee, no middleman taking a cut. ${esc(O.promo.blurb)}</p>
  </div>
</section>

<div class="order-wrap shell">
  <div class="order-left">
    <div class="mode card" role="group" aria-label="Pickup or delivery">
      <div class="mode-switch">
        <button type="button" class="mode-opt is-on" data-mode="pickup" aria-pressed="true">
          <b>Pickup</b><span>Ready in about ${O.pickupMinutes} min</span></button>
        <button type="button" class="mode-opt" data-mode="delivery" aria-pressed="false">
          <b>Delivery</b><span>About ${O.deliveryMinutes} min &middot; ${money(O.deliveryFee)}</span></button>
      </div>
      <div class="mode-body">
        <label class="when"><span>When</span>
          <select id="whenSel"></select>
        </label>
        <div class="addr" id="addrWrap" hidden>
          <label><span>Delivery address</span><input id="addrLine" placeholder="Street address, apartment"></label>
          <p class="fine">${esc(O.deliveryRadius)}. ${money(O.deliveryMinimum)} minimum.</p>
        </div>
        <p class="mode-note" id="modeNote"></p>
      </div>
    </div>

    <nav class="cats order-cats" aria-label="Menu sections">
      <ul>${menu.sections.map(s => `<li><a href="#o-${esc(s.id)}">${esc(s.name)}</a></li>`).join('')}</ul>
    </nav>

    ${menu.sections.map(s => `
    <section class="osec" id="o-${esc(s.id)}">
      <header class="osec-head"><h2>${esc(s.name)}</h2>${s.availability ? `<p class="avail">${ICON.clock}${esc(s.availability)}</p>` : ''}</header>
      <ul class="orows">${s.items.map(i => `
        <li class="orow" data-item="${esc(i.id)}">
          ${i.image ? `<div class="orow-im"><img src="${img(i.image)}" alt="${esc(i.name)}" loading="lazy" width="900" height="900"></div>` : ''}
          <div class="orow-bd">
            <h3>${esc(i.name)}</h3>
            <p>${esc(i.description)}</p>
            <span class="price">${money(i.price)}</span>
            ${(i.tags || []).length ? `<div class="tags">${i.tags.map(tagPill).join('')}</div>` : ''}
          </div>
          <button class="btn btn-add sm" type="button" data-add="${esc(i.id)}">Add</button>
        </li>`).join('')}
      </ul>
    </section>`).join('')}
  </div>

  <aside class="order-right">
    <div class="cart card" id="cartPanel">
      <h2>Your order</h2>
      <div id="panelLines"></div>
      <div id="panelFoot"></div>
    </div>
  </aside>
</div>

<section class="checkout" id="checkout">
  <div class="shell">
    <header class="sec-head center">
      <p class="kicker">Last step</p>
      <h2>Where should we <em>send it?</em></h2>
    </header>
    <form class="co-form card" id="coForm" novalidate>
      <div class="field-row">
        <label><span>Name</span><input id="coName" autocomplete="name" required></label>
        <label><span>Phone</span><input id="coPhone" type="tel" autocomplete="tel" required></label>
      </div>
      <div class="field-row">
        <label><span>Email</span><input id="coEmail" type="email" autocomplete="email" required></label>
        <label><span>Promo code <i>optional</i></span><input id="coPromo" placeholder="${esc(O.promo.code)}"></label>
      </div>
      <label><span>Notes for the kitchen <i>optional</i></span><textarea id="coNotes" rows="2" placeholder="Allergies, buzzer code, leave it at the door"></textarea></label>
      <label class="check"><input type="checkbox" id="coJoin" checked><span>Join ${esc(site.rewards.name)} and start earning points on this order</span></label>
      <div class="tip" role="group" aria-label="Tip">
        <span class="tip-label">Tip the crew</span>
        <div class="tip-opts">${O.tipPresets.map(t =>
          `<button type="button" class="tip-opt${t === O.defaultTip ? ' is-on' : ''}" data-tip="${t}">${t}%</button>`).join('')}
          <button type="button" class="tip-opt" data-tip="0">None</button>
        </div>
      </div>
      <div class="co-total" id="coTotal"></div>
      <p class="err" id="coErr" role="alert"></p>
      <button class="btn btn-primary btn-wide btn-big" type="submit" id="coSubmit">Place order</button>
      <p class="fine">Demo checkout. In production this would be Square, Toast, Stripe or ChowNow. No card is collected and no order is sent.</p>
    </form>
    <div class="done card" id="orderDone" hidden></div>
  </div>
</section>
</main>` + footer();

/* =========================================================== EVENTS ===== */
PAGES.events = head('events', {
  title: `Private events & catering | ${B.name}, ${B.neighborhood}`,
  description: `Book the back table, the back room or the whole place at ${B.name} in Logan Square. Catering trays feed eight to ten, with 24 hours notice.`,
}) + nav('events') + `
<main id="main">
<section class="page-head">
  <div class="shell">
    <p class="kicker">${esc(site.events.kicker)}</p>
    <h1>${esc(site.events.heading)} <em>${esc(site.events.headingEm)}</em></h1>
    <p class="lede">${esc(site.events.lead)}</p>
    <div class="head-cta">
      <a class="btn btn-primary" href="#inquiry">Check a date</a>
      <a class="btn btn-ghost" href="#catering">Catering trays</a>
    </div>
  </div>
</section>

<figure class="ev-hero"><img src="${img('events-table')}" alt="The back room set for a long table dinner" width="1500" height="843"></figure>

<section class="packages">
  <div class="shell">
    <header class="sec-head center"><p class="kicker">Three sizes</p><h2>Pick your <em>room</em></h2></header>
    <div class="pkg-grid">${site.events.packages.map((p, n) => `
      <article class="pkg rv${p.featured ? ' pkg-on' : ''}" style="--i:${n}">
        ${p.featured ? '<span class="sticker pop">Most booked</span>' : ''}
        <h3>${esc(p.name)}</h3>
        <p class="pkg-cap">${esc(p.capacity)}</p>
        <p class="pkg-price">${esc(p.price)}</p>
        <ul>${p.includes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <a class="btn btn-ghost" href="#inquiry">Ask about this</a>
      </article>`).join('')}
    </div>
  </div>
</section>

<section class="catering" id="catering">
  <div class="shell cat-grid">
    <div class="cat-copy">
      <p class="kicker">Feed the office</p>
      <h2>${esc(site.events.catering.heading)}</h2>
      <p class="lede">${esc(site.events.catering.body)}</p>
      <figure class="cat-im"><img src="${img('gallery-2')}" alt="Platters and shared plates laid out on a table" loading="lazy" width="800" height="800"></figure>
    </div>
    <ul class="trays">${site.events.catering.items.map(c => `
      <li>
        <div><b>${esc(c.name)}</b><span>${esc(c.d)}</span><small>${esc(c.serves)}</small></div>
        <span class="price">${money(c.price)}</span>
      </li>`).join('')}
    </ul>
  </div>
</section>

<section class="inquiry" id="inquiry">
  <div class="shell inq-grid">
    <div class="inq-copy">
      <p class="kicker">Tell us about it</p>
      <h2>Check a date, <em>get a real answer</em></h2>
      <p class="lede">We reply within one business day with availability and a menu built for your group. No deposit until you say yes.</p>
      <ul class="inq-facts">
        <li><b>24</b><span>Seated in the back room</span></li>
        <li><b>110</b><span>Standing, whole place</span></li>
        <li><b>1 day</b><span>To hear back from us</span></li>
      </ul>
      <p class="fine">${esc(site.events.packages[1].price)} on Fridays and Saturdays. Weeknights are easier on the budget.</p>
    </div>
    <form class="inq-form card" id="inqForm" novalidate>
      <div class="field-row">
        <label><span>Name</span><input id="inqName" autocomplete="name" required></label>
        <label><span>Email</span><input id="inqEmail" type="email" autocomplete="email" required></label>
      </div>
      <div class="field-row">
        <label><span>Date</span><input id="inqDate" type="date" required></label>
        <label><span>Guests</span><input id="inqGuests" type="number" min="7" max="110" value="24" required></label>
        <label><span>Kind of event</span><select id="inqType">
          <option>Birthday</option><option>Rehearsal dinner</option><option>Work dinner or offsite</option>
          <option>Catering drop-off</option><option>Something else</option></select></label>
      </div>
      <label><span>What are you picturing?</span><textarea id="inqNote" rows="3" placeholder="Timing, budget, dietary needs, whether you want the patio"></textarea></label>
      <p class="err" id="inqErr" role="alert"></p>
      <button class="btn btn-primary btn-wide" type="submit">Send the inquiry</button>
      <p class="fine">Demo form. Nothing is sent from this page. In production this would land in ${esc(site.contact.eventsEmail)} and a CRM.</p>
    </form>
  </div>
</section>

<section class="faq-sec">
  <div class="shell faq-grid">
    <header class="sec-head">
      <p class="kicker">Event questions</p>
      <h2>The things people <em>always ask</em></h2>
      <a class="btn btn-ghost" href="mailto:${esc(site.contact.eventsEmail)}">Email ${esc(site.contact.eventsEmail)}</a>
    </header>
    ${faqList(site.events.faq)}
  </div>
</section>
</main>` + footer();

/* ------------------------------------------------------------------ write */
let total = 0;
for (const [name, html] of Object.entries(PAGES)) {
  const left = html.match(/\{\{\w+\}\}/g);
  if (left) { console.error(`  build failed: ${name}.html still has ${[...new Set(left)].join(', ')}`); process.exit(1); }
  writeFileSync(`${name}.html`, html);
  total += html.length;
}
console.log(`  built ${Object.keys(PAGES).length} pages, ${(total / 1024).toFixed(0)}kb of html`);
console.log(`  ${menu.sections.length} sections, ${items.length} dishes, ${featured.length} featured, ${menu.optionGroups.length} option groups`);
