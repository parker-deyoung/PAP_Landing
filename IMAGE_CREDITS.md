# Image credits

One row per image used on the site. The footer "Photography" list in `index.html`
mirrors this file — update both together.

**Verify before launch.** The photographer names and photo IDs below are read from the
original download filenames in `assets/img/_src/`. Open each Unsplash photo page and
confirm the name, the URL, and that the current
[Unsplash License](https://unsplash.com/license) still applies (free for commercial use,
no permission needed, attribution appreciated but not required). Replace anything that
doesn't check out. The markup references images only by path, so a source can be swapped
without touching layout.

| Slot | Files (`assets/img/…`) | Source | License | Attribution string |
|---|---|---|---|---|
| Hero — autumn peak | `hero-autumn-peak-{640,1280}w.{webp,jpg}` | Unsplash, photo `fKzQsB11Tmo` (`_src/saul-flores-fKzQsB11Tmo-unsplash.jpg`) | Unsplash License | Photo by Saúl Flores on Unsplash |
| Social card | `og-cover.jpg` | cropped from the hero image | same as hero | Photo by Saúl Flores on Unsplash |
| Aerial surveys — grazing herd | `surveys-bison-herd-{640,1280}w.{webp,jpg}` | Unsplash, photo `xI_cQ1htD3g` (`_src/andres-haro-xI_cQ1htD3g-unsplash.jpg`) | Unsplash License | Photo by Andres Haro on Unsplash |
| Herd records — mule deer buck | `records-mule-deer-buck-{640,960}w.{webp,jpg}` | Unsplash, photo `kEYtw1_YiHM` (`_src/kush-dwivedi-kEYtw1_YiHM-unsplash.jpg`) | Unsplash License | Photo by Kush Dwivedi on Unsplash |
| Hospitality — bull elk | `hospitality-bull-elk-{640,1280}w.{webp,jpg}` | Unsplash, photo `rtT0Uk8fkR8` (`_src/mathew-schwartz-rtT0Uk8fkR8-unsplash.jpg`) | Unsplash License | Photo by Mathew Schwartz on Unsplash |
| Founder A — Parker DeYoung | `founder-parker-duckhunt-{560,1120}w.{webp,jpg}` | Arches Labs (own photo) | © Arches Labs, all rights reserved | — |
| Footer strip 1 — pronghorn at dusk | `strip-pronghorn-dusk-480w.{webp,jpg}` | Unsplash, photo `_WONpzMHHbA` (`_src/taun-stewart-_WONpzMHHbA-unsplash.jpg`) | Unsplash License | Photo by Taun Stewart on Unsplash |
| Footer strip 2 — snowy peak | `strip-snowy-timp-480w.{webp,jpg}` | Unsplash, photo `pja2EaH4fHo` (`_src/caroline-sterr-pja2EaH4fHo-unsplash.jpg`) | Unsplash License | Photo by Caroline Sterr on Unsplash |
| Footer strip 3 — red maple ridge | `strip-red-maple-ridge-480w.{webp,jpg}` | Unsplash, photo `r3542uvw4_g` (`_src/nils-rasmusson-r3542uvw4_g-unsplash.jpg`) | Unsplash License | Photo by Nils Rasmusson on Unsplash |
| Footer strip 4 — Delicate Arch | `strip-delicate-arch-480w.{webp,jpg}` | Unsplash, photo `7kLufxYoqWk` (`_src/solotravelgoals-7kLufxYoqWk-unsplash.jpg`) | Unsplash License | Photo by solotravelgoals on Unsplash |

Founders B (Parker Piombo) and C (Anton Smolyanyy) currently use
`assets/img/placeholder-founder.svg`. Add `founder-b.jpg` / `founder-c.jpg` to
`assets/img/_src/`, re-run `tools/make-images.sh`, and swap their `<img>` tags for the
same `<picture>` pattern used by Founder A.

## Originals

`assets/img/_src/` holds the full-resolution originals plus lower-case renamed copies the
build script reads. `_src/` is git-ignored — keep your own backup of the originals.
