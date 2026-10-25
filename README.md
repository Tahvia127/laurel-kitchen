# Laurel — wood-fired neighborhood kitchen

A complete restaurant site: menu, online ordering, reservations, private events,
catering, rewards, gift cards and everything a real place has to answer before
someone calls. Four pages, no framework, no build step beyond `node build.mjs`.

**Status:** demo. Laurel is a fictional restaurant. Every phone number, email and
price is made up, nothing takes a payment, and a notice says so on every page.
**Built by:** Framework Studio.

**Live:** https://tahvia127.github.io/laurel-kitchen/

---

## What this one proves

**The owner can run it.** The menu, the hours, the prices, the fees, the FAQ and
the event packages all live in two JSON files, edited through a CMS at `/admin`.
A price changed there changes the menu page, the order page, the cart, the tax
line and the checkout total in one commit. Nobody has to call a developer to
raise the price of a pizza.

**It takes orders.** Not a link to a third-party app, an actual cart:

- Pickup or delivery, with the lead time and the fee each one carries
- Scheduled times built from the opening hours, so you can never order for a
  closed Monday
- Modifier groups per dish, including required choices with no default, optional
  extras with prices, and a note to the kitchen
- A bag that survives moving between pages, because it lives in `localStorage`
- Promo code, tip presets, delivery minimum, tax, and a catering nudge over $150
- Checkout that validates name, phone, email and address before it will accept
  anything, then prints an order number

**It answers the questions.** Hours that say *open now* or *opens at 4pm* from
the visitor's own clock. Address, phone and hours in the footer of every page.
Transit, parking, accessibility and dogs. Allergens. Eight FAQs. A map.

## The pages

| Page | What it carries |
|---|---|
| `index.html` | Hero with live open/closed, three ways to order, featured dishes, menu preview, story, rewards club, reviews and press, events teaser, photo strip, hours, map, reservation form, gift cards, FAQ, newsletter |
| `menu.html` | All 44 dishes in 9 sections, searchable, filterable by diet, every one addable to an order |
| `order.html` | The ordering flow: pickup or delivery, time, modifiers, cart, tip, promo, checkout |
| `events.html` | Three private event packages, catering trays, inquiry form, event FAQ |

## How it works

```
data/site.json   ─┐
data/menu.json   ─┤─> build.mjs ─> index.html, menu.html, order.html, events.html
assets/img/*     ─┘                assets/js/site.js runs the rest in the browser
```

`build.mjs` has zero dependencies and refuses to write a broken site. It fails
the build on a duplicate dish id, a price that is not a number, an option group
a dish points at that does not exist, a diet tag missing from the legend, a
missing photo, opening hours that are not `HH:MM`, or a featured dish with no
image.

```bash
node build.mjs          # render the four pages
python3 -m http.server  # look at them
```

## Editing it

`/admin` is [Decap CMS](https://decapcms.org). The owner signs in with GitHub and
gets labelled forms for both data files: dishes with prices and photos, choice
groups, opening hours with a closed toggle, delivery fees, the FAQ, event
packages, review quotes. Saving commits to `main`; the Action in
`.github/workflows/build.yml` reruns the build and commits the rendered pages.

To try the CMS locally: `npx decap-server` then open `/admin`.

## Ordering maths

Everything comes from `data/site.json` → `ordering`:

```
discount = subtotal × promo%        (only with a valid code)
fee      = delivery ? deliveryFee : 0
tax      = (subtotal − discount + fee) × taxRate
tip      = (subtotal − discount) × tip%
total    = subtotal − discount + fee + tax + tip
```

Tax is not charged on the tip. Delivery below the minimum blocks checkout and
says how much more is needed.

## Design notes

- **Type:** Fraunces for display with its soft and wonk axes on, Outfit for
  everything else, Caveat for one handwritten line.
- **Colour:** sand `#F3E3C8` under tomato `#D63C19`, marigold `#FFC53D`, basil
  `#1C7A4B` and grape `#5634A8`. Every text pairing clears WCAG AA; tomato and
  grape were both darkened from their first draft because white on them sat at
  4.2 and 3.98.
- **Movement:** a marquee, a drifting photo strip, a bobbing pizza sticker,
  cards that lift. All of it stops under `prefers-reduced-motion`.
- **The map** is six OpenStreetMap tiles and a CSS pin. No Google bill, no API
  key, no JavaScript, and it renders where an embedded map needs WebGL.
- **Mobile** keeps a sticky order bar at the bottom of every page except the
  order page itself, and the nav links wrap under the brand rather than hiding
  behind a hamburger.

## Repository layout

```
data/site.json       Hours, contact, fees, story, rewards, events, FAQ, SEO.
data/menu.json       Sections, dishes, prices, diet tags, modifier groups.
admin/               Decap CMS config. The handover.
assets/css           One stylesheet.
assets/js/site.js    Status, cart, modifiers, filters, checkout, forms.
assets/img           29 WebP photos.
build.mjs            Renders the pages. No dependencies.
*.html               Generated. Do not edit by hand.
```

Photos from [Pexels](https://www.pexels.com), free to use.
