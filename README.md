# Arches Labs — landing page

Static one-page site whose only job is to get ranch owners and managers to book a
30-minute discovery call. No build step, no framework. Plain HTML, one CSS file, one
small progressive-enhancement JS file.

```
index.html              all seven sections + footer; config block is at the top of <head>
assets/css/styles.css    all styles
assets/js/enhance.js     optional: link sync, topic tagging, on-page form submit
assets/js/patrol-demo.js optional: plays the security section's night-patrol demo (inline SVG)
assets/img/              processed WebP + JPEG (via tools/make-images.sh) + favicons
assets/img/_src/         full-res originals (git-ignored); build script reads these
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
| `CAL_URL` | `site-config` script + every `a[data-book]` href + booking link in Contact | **Set:** `https://calendar.app.google/qBJynKzATiRonKVb9` (Google Calendar appointment page). Buttons use the plain link; Google drops any `?topic=`/`utm` params. |
| `FORM_ENDPOINT` | `site-config` script + `<form action="…">` | Formspree / Basin / Netlify Forms / your own handler. Must accept a `POST` of form fields and return 2xx (ideally JSON for the on-page success state). |
| `SITE_URL` | `<link rel="canonical">`, `og:url`, `twitter:url`, `og:image`/`twitter:image` | Also update `robots.txt` and `sitemap.xml` to the same domain. |
| `ANALYTICS_ID` | `site-config` script + commented snippet before `</body>` | Optional. Uncomment the snippet only if you want analytics. |

**Images — mostly done.** Nine photos are placed, processed to responsive WebP + JPEG
(`tools/make-images.sh`), and wired into `index.html`. `og-cover.jpg` is generated from
the hero. Remaining image work:

1. **Verify photo credits.** `IMAGE_CREDITS.md` and the footer "Photography" list name
   each photographer and Unsplash photo ID *as read from the download filenames*. Open
   each Unsplash page, confirm the name/URL, and confirm the Unsplash License still
   applies. Fix anything that's off.
2. **Logo.** `logo-mark` (the arch) and `logo-text` (ARCHES / LABS) are cut from the
   logo art with a transparent background; `logo-arches-labs.png` is the full cutout,
   kept as a master copy and not loaded by the page. The favicons are built from the mark.

To re-process everything (e.g. after swapping a source photo): put the replacement in
`assets/img/_src/` under the name at the top of `tools/make-images.sh`, run the script,
done. `assets/img/_src/` is git-ignored — keep your own backup of the originals.

## The research tag (why each section has its own CTA)

Every section's "book" button carries a `data-topic` (`intro`, `surveys`, `security`,
`records`, `hospitality`, `contact`, `header`, `footer`). Bookings go to a Google Calendar
appointment page, which doesn't record `topic=` or UTM params, so the booking itself
won't say which section sent the visitor; ask on the call. The contact form still
carries the signal in its hidden `topic` field, set from whichever section's "or send us
a note" link the visitor used (defaults to `site-general` with JS off). If you move to
Cal.com or Calendly later, add `?topic=…&utm_medium=…` back to the `data-book` links.

## Accessibility / quality

Responsive from 320px. Semantic landmarks, single `h1`, ordered headings, labeled
inputs, visible keyboard focus, `prefers-reduced-motion` respected, AA contrast, Open
Graph + Twitter card tags, SVG + PNG favicons. Works fully with JavaScript disabled —
all links resolve and the form submits natively to `FORM_ENDPOINT`.
