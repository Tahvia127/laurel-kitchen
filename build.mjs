/* Laurel — static build.
   Reads data/site.json + data/menu.json, writes index.html and menu.html.
   No dependencies. Run: node build.mjs
*/
import { readFileSync, writeFileSync } from 'node:fs';

const site = JSON.parse(readFileSync('data/site.json', 'utf8'));
const menu = JSON.parse(readFileSync('data/menu.json', 'utf8'));

const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const money = n => '$' + Number(n).toFixed(Number(n) % 1 ? 2 : 0);
const tags = t => (t || []).map(x => `<span class="tag">${esc(x)}</span>`).join('');

const items = menu.sections.flatMap(s => s.items);
const featured = items.filter(i => i.featured).slice(0, 4);

const NAV = `<nav class="nav" id="nav" aria-label="Primary"><div class="shell">
  <a class="logo" href="index.html"><span class="m">${esc(site.name)}</span><span class="s">${esc(site.tagline)}</span></a>
  <ul>
    <li><a href="index.html#menu">Menu</a></li>
    <li><a href="index.html#reserve">Hours</a></li>
    <li><a href="menu.html">Full menu</a></li>
  </ul>
  <a class="btn" href="tel:${site.phone.replace(/[^\d+]/g,'')}">Reserve</a>
</div></nav>`;

const FOOTER = `<footer><div class="shell">
  <span>&copy; ${new Date().getFullYear()} ${esc(site.name)}</span>
  <span>${esc(site.address.line1)}, ${esc(site.address.line2)}</span>
  <span><a href="tel:${site.phone.replace(/[^\d+]/g,'')}">${esc(site.phone)}</a></span>
</div></footer>`;

const demo = site.demo || {};
const DEMOBAR = demo.show ? `<div class="demo-bar" role="note">
  <p>${esc(demo.text)}</p><span class="sep">&middot;</span>
  <a href="${esc(demo.url)}" target="_blank" rel="noopener noreferrer">${esc(demo.linkText)}</a>
</div>` : '';

const DEMOFOOT = demo.show ? `<div class="demo-foot">
  ${esc(demo.text)} <a href="${esc(demo.url)}" target="_blank" rel="noopener noreferrer">${esc(demo.linkText)}</a>
</div>` : '';

const SCRIPT = `<script>
var nav=document.getElementById('nav');
addEventListener('scroll',function(){nav.classList.toggle('solid',scrollY>40)},{passive:true});
nav.classList.toggle('solid',scrollY>40);
if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){
    if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},
    {rootMargin:'0px 0px -8% 0px',threshold:.05});
  document.querySelectorAll('.rv').forEach(function(el){io.observe(el)});
}else{document.querySelectorAll('.rv').forEach(function(el){el.classList.add('in')})}
</script>`;

const FEATURED = featured.map((d, i) => `
      <article class="dish rv" style="--i:${i}">
        ${d.image ? `<div class="im"><img src="assets/img/${esc(d.image)}.webp" alt="${esc(d.name)}" loading="lazy" width="1000" height="1000"></div>` : ''}
        <div class="row"><h3>${esc(d.name)}</h3><span class="dot"></span><span class="pr">${money(d.price)}</span></div>
        <p>${esc(d.description)}</p>
      </article>`).join('');

const GALLERY = ['gallery-1','gallery-2','gallery-3','dish-pizza'].map((g, i) =>
  `<a class="rv" style="--i:${i}" href="menu.html" aria-label="See the menu"><img src="assets/img/${g}.webp" alt="" loading="lazy" width="900" height="900"></a>`).join('');

const HOURS = site.hours.map(h =>
  `<li class="hrs"><span>${esc(h.days)}</span><span>${esc(h.time)}</span></li>`).join('');

const NOTES = (site.notes || []).map(n =>
  `<div class="rv"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div>`).join('');

const MENU = menu.sections.map(sec => `
    <section class="menu-section rv">
      <div class="mhead">
        <h2>${esc(sec.name)}</h2>
        ${sec.blurb ? `<p>${esc(sec.blurb)}</p>` : ''}
      </div>
      <ul class="menu-list">
        ${sec.items.map(i => `<li>
          <div class="row"><span class="nm">${esc(i.name)}${tags(i.tags)}</span><span class="dot"></span><span class="pr">${money(i.price)}</span></div>
          <p class="de">${esc(i.description)}</p>
        </li>`).join('\n        ')}
      </ul>
    </section>`).join('');

const LEGEND = Object.entries(menu.legend || {})
  .map(([k, v]) => `<span class="tag">${esc(k)}</span> ${esc(v)}`).join(' &nbsp; ');

const JSONLD = JSON.stringify({
  '@context':'https://schema.org','@type':'Restaurant',
  name: site.name, description: site.intro,
  telephone: site.phone, email: site.email,
  address:{'@type':'PostalAddress',streetAddress:site.address.line1,addressLocality:site.city},
  servesCuisine:'Seasonal American', priceRange:'$$$', hasMenu:'menu.html'
});

const vars = {
  SITE_NAME: esc(site.name), TAGLINE: esc(site.tagline), TAGLINE_LC: esc(site.tagline.toLowerCase()),
  CITY: esc(site.city), INTRO: esc(site.intro),
  INTRO_SHORT: esc(site.intro.split('. ').slice(0,2).join('. ') + '.'),
  ADDR1: esc(site.address.line1), ADDR2: esc(site.address.line2),
  PHONE: esc(site.phone), PHONE_RAW: site.phone.replace(/[^\d+]/g,''), EMAIL: esc(site.email),
  NAV, FOOTER, SCRIPT, DEMOBAR, DEMOFOOT, FEATURED, GALLERY, HOURS, NOTES, MENU, LEGEND, JSONLD,
  UPDATED: new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
};

const render = (tpl) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) =>
  k in vars ? vars[k] : (console.warn('  ! unknown token', k), m));

writeFileSync('index.html', render(readFileSync('src/index.template.html','utf8')));
writeFileSync('menu.html',  render(readFileSync('src/menu.template.html','utf8')));

console.log(`  built index.html + menu.html`);
console.log(`  ${menu.sections.length} sections, ${items.length} items, ${featured.length} featured`);
