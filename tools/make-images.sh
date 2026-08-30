#!/usr/bin/env bash
#
# make-images.sh — one-time image processing. NOT part of deploy.
#
# 1. Put the original photos in assets/img/_src/ using these exact names
#    (any of .jpg .jpeg .png is fine):
#
#       hero-autumn-peak          storm clouds over a snowy peak + orange aspen   (landscape)
#       surveys-bison-herd        herd grazing green pasture below a ridge         (landscape)
#       records-mule-deer-buck    mature mule deer buck in tall grass              (portrait)
#       hospitality-bull-elk      bull elk bugling, golden hour                    (landscape)
#       founder-parker-duckhunt   Parker DeYoung in the marsh with a duck          (portrait)
#       founder-b                 (optional) real photo of Parker Piombo           (portrait)
#       founder-c                 (optional) real photo of Anton Smolyanyy         (portrait)
#       strip-pronghorn-dusk      pronghorn on snowy flats at dusk                 (landscape)
#       strip-snowy-timp          snowy alpine peak through evergreens             (landscape)
#       strip-red-maple-ridge     red/green maple hillsides below a peak           (landscape)
#       strip-delicate-arch       Delicate Arch at sunset                          (landscape)
#
# 2. Run:  bash tools/make-images.sh
#
# 3. In index.html, replace each placeholder <img ...> with the <picture> block
#    written in the comment directly above it. (Or, for a quick non-responsive
#    swap, just change the placeholder src from ".svg" to "-1280w.jpg".)
#
# Requires: sips (ships with macOS). Optional: cwebp (brew install webp) for WebP.

set -euo pipefail
cd "$(dirname "$0")/.."

SRC="assets/img/_src"
OUT="assets/img"
# Kept deliberately low: the audience is on rural connections and the whole-page
# budget is ~1 MB. WebP is the primary format (encoded from the original); the JPEG
# is only the fallback for pre-2020 browsers, so it can be pushed harder.
# Bump these only if a specific image looks bad.
JPEG_Q=46
WEBP_Q=56

HAVE_WEBP=0
if command -v cwebp >/dev/null 2>&1; then
  HAVE_WEBP=1
else
  echo "note: cwebp not found — generating JPEG only. For smaller files: brew install webp"
fi

find_src () { # $1 = base name; echoes first matching source file or nothing
  for ext in jpg jpeg png JPG JPEG PNG; do
    [ -f "$SRC/$1.$ext" ] && { echo "$SRC/$1.$ext"; return 0; }
  done
  return 0
}

derive () { # $1 = base name, $2... = target widths
  local base="$1"; shift
  local src; src="$(find_src "$base")"
  if [ -z "$src" ]; then
    echo "skip: $SRC/$base.(jpg|jpeg|png) not found"
    return 0
  fi
  for w in "$@"; do
    local jpg="$OUT/${base}-${w}w.jpg"
    sips -s format jpeg -s formatOptions "$JPEG_Q" --resampleWidth "$w" "$src" --out "$jpg" >/dev/null
    if [ "$HAVE_WEBP" -eq 1 ]; then
      # encode WebP straight from the original so it isn't stacked on JPEG artifacts
      cwebp -quiet -q "$WEBP_Q" -resize "$w" 0 "$src" -o "$OUT/${base}-${w}w.webp"
    fi
    echo "  $jpg$( [ "$HAVE_WEBP" -eq 1 ] && echo "  + .webp" )"
  done
}

echo "Processing images from $SRC ..."

# hero + full-bleed section photos: 640 / 1280 (no larger tier — keeps the budget)
derive hero-autumn-peak       640 1280
derive surveys-bison-herd     640 1280
derive hospitality-bull-elk   640 1280
# mule-deer frame is edge-to-edge fine grass — it does not compress. Cap it smaller.
derive records-mule-deer-buck 640 960

# founders: 560 / 1120 (rendered at most ~1 column wide)
derive founder-parker-duckhunt 560 1120
derive founder-b               560 1120
derive founder-c               560 1120

# footer strip: one small size, decorative + lazy
derive strip-pronghorn-dusk  480
derive strip-snowy-timp      480
derive strip-red-maple-ridge 480
derive strip-delicate-arch   480

# social share card: 1200x630 crop from the hero source
HERO_SRC="$(find_src hero-autumn-peak)"
if [ -n "$HERO_SRC" ]; then
  sips -s format jpeg -s formatOptions 60 \
       --resampleHeightWidth 630 1200 --cropToHeightWidth 630 1200 \
       "$HERO_SRC" --out "$OUT/og-cover.jpg" >/dev/null
  echo "  $OUT/og-cover.jpg (1200x630)"
fi

echo "Done. Now swap the placeholder <img> tags in index.html for the <picture> blocks."
