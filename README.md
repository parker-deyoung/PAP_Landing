# Arches Labs — landing page

Static one-page site whose only job is to get ranch owners and managers to book a
30-minute discovery call. No build step, no framework. Plain HTML, one CSS file, one
small progressive-enhancement JS file.

```
index.html              all six sections + footer; config block is at the top of <head>
assets/css/styles.css    all styles
assets/js/enhance.js     optional: link sync, topic tagging, on-page form submit
assets/img/              placeholder SVGs now; real images after tools/make-images.sh
assets/img/_src/         drop original photos here (see tools/make-images.sh header)
tools/make-images.sh     one-time image processing (needs macOS `sips`; `cwebp` optional)
robots.txt  sitemap.xml  .nojekyll
IMAGE_CREDITS.md         one row per image; footer "Photography" list mirrors it
```

## Run locally

Any static server works. From the repo root:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly with `file://` mostly works too, but a server matches
production and lets the form's `fetch` path run.

## Deploy (GitHub Pages)

1. Push to `main`.
2. Repo **Settings → Pages → Build and deployment**: Source = **Deploy from a branch**,
   Branch = **main**, folder = **/ (root)**. Save.
3. Wait for the green check, then load the Pages URL.

`.nojekyll` is included so Pages serves `assets/` untouched. No Actions workflow needed.
Netlify / Vercel / Cloudflare Pages also work with no settings — point them at the repo,
no build command, publish directory = root.

## Fill before going live

Everything below is marked `REPLACE_ME` in the files.

**In `index.html` — config block at the top of `<head>` (change value in the HTML comment,
the `<script id="site-config">`, AND the visible markup where noted):**

| Value | Where | Notes |
|---|---|---|
| `CAL_URL` | `site-config` script + every `a[data-book]` href + booking link in Contact | Cal.com or Calendly 30-min link. Section CTAs append `?topic=…&utm_medium=…`; keep those query params. |
| `FORM_ENDPOINT` | `site-config` script + `<form action="…">` | Formspree / Basin / Netlify Forms / your own handler. Must accept a `POST` of form fields and return 2xx (ideally JSON for the on-page success state). |
| `SITE_URL` | `<link rel="canonical">`, `og:url`, `twitter:url`, `og:image`/`twitter:image` | Also update `robots.txt` and `sitemap.xml` to the same domain. |
| `ANALYTICS_ID` | `site-config` script + commented snippet before `</body>` | Optional. Uncomment the snippet only if you want analytics. |

**Founder bios — section 2 of `index.html`:** replace the three `REPLACE_ME` lines in
`.founder__line` with one real sentence each (names, phone `720-498-7552`, and email
`phdeyoung@gmail.com` are already set).

**Images:**

1. Put originals in `assets/img/_src/` with the names listed at the top of
   `tools/make-images.sh`.
2. Run `bash tools/make-images.sh`.
3. In `index.html`, replace each placeholder `<img …>` with the `<picture>` block in the
   comment directly above it (or, quick version, change the `src` from `…placeholder-*.svg`
   to the matching `…-1280w.jpg`). Swap the four footer-strip `src`s too.
4. Replace `assets/img/og-cover.jpg` (the script regenerates it from the hero source, or
   drop in a hand-made 1200×630).
5. Delete the `assets/img/placeholder-*.svg` files and
   `assets/img/_src/og-cover-placeholder.svg`.
6. Fill in every `REPLACE_ME` row in `IMAGE_CREDITS.md` and the matching lines in the
   footer "Photography" list. Confirm licensing for anything not shot by the team — Utah
   DWR images are **not** automatically public domain.

**Founder photos:** `founder-parker-duckhunt` is Parker DeYoung's marsh photo. `founder-b`
(Parker Piombo) and `founder-c` (Anton Smolyanyy) stay on the placeholder until real
files are added to `_src/` and the script is re-run.

## The research tag (why each section has its own CTA)

Every section's "book" button points at the same `CAL_URL` but with a different
`topic=` and `utm_medium=` (`intro`, `surveys`, `records`, `hospitality`, `contact`,
`header`, `footer`). Your booking tool's UTM/analytics report then tells you which
section drove the conversation. The contact form carries the same signal in its hidden
`topic` field, set from whichever section's "or send us a note" link the visitor used
(defaults to `site-general` with JS off).

## Accessibility / quality

Responsive from 320px. Semantic landmarks, single `h1`, ordered headings, labeled
inputs, visible keyboard focus, `prefers-reduced-motion` respected, AA contrast, Open
Graph + Twitter card tags, SVG + PNG favicons. Works fully with JavaScript disabled —
all links resolve and the form submits natively to `FORM_ENDPOINT`.
