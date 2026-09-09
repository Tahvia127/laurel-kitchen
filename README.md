# Laurel — Neighborhood Kitchen

A restaurant site built so the owner never has to call the developer to change a price.

**Live:** <https://tahvia127.github.io/laurel-kitchen/>
**Built by:** [Framework Studio](https://tahvia127.github.io/framework-studio/)

---

## The problem this solves

The most common reason a small business fires their web person is needing them for every small change. A restaurant changes its menu constantly: prices move, dishes come off, the specials rotate. If that means emailing a developer and waiting two days, the site goes stale and the relationship sours.

Here, the entire menu lives in one file. The owner edits it in a visual editor, hits save, and the site rebuilds itself in about a minute. No developer, no ticket, no invoice.

## How it works

```
data/menu.json ──┐
data/site.json ──┤
                 ├──> build.mjs ──> index.html + menu.html
src/*.template ──┘
```

1. The owner opens `/admin/` and edits the menu in a form. No JSON, no code.
2. Decap CMS commits the change to `data/menu.json`.
3. A GitHub Action runs `build.mjs`, which re-renders the pages.
4. GitHub Pages publishes. Total time: about a minute.

Everything is static HTML at the end. No database, no server, no monthly platform fee.

## Repository layout

```
data/menu.json       Every dish, price and description. The only file that changes often.
data/site.json       Hours, address, phone, intro copy.
src/*.template.html  Page templates with {{TOKEN}} placeholders.
build.mjs            Renders templates + data into the final pages. No dependencies.
admin/               Decap CMS: the visual editor the owner uses.
assets/              Stylesheet and images.
index.html           Generated. Do not edit by hand.
menu.html            Generated. Do not edit by hand.
```

## Running it locally

```bash
node build.mjs        # render the pages
python3 -m http.server 8000
```

To try the editor locally, in a second terminal:

```bash
npx decap-server
```

Then open <http://localhost:8000/admin/>.

## Going live for a real client

Two things need doing per client:

1. **Point the CMS at their repo** — change `backend.repo` in `admin/config.yml`.
2. **Give them a login** — Decap needs a GitHub OAuth app, or Netlify Identity if the site is hosted there. This is the one step that cannot be skipped; without it the `/admin/` page has nothing to authenticate against.

Everything else is already wired.

## Design notes

- **Type:** Cormorant Garamond for headings, letterspaced small caps; Inter for body.
- **Color:** forest `#1C3529`, paper `#FBF8F1`, brass `#8A6626`. All text pairings clear WCAG AA.
- **Motion:** a slow hero drift, staggered scroll reveals, image scale on hover. All disabled under `prefers-reduced-motion`.
- **Menu layout** uses dotted leaders between dish and price, which stays readable when a dish name wraps.
- **SEO:** `Restaurant` JSON-LD with address, phone and a link to the menu.

## Photography

Placeholder photography from [Unsplash](https://unsplash.com), used under the Unsplash License. Replace `assets/img/*.webp` with the client's own photography before launch. Images are WebP, sized to their display slot and lazy-loaded below the fold.
