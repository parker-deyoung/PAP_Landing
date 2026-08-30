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
JPEG_Q=80
WEBP_Q=72

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
      cwebp -quiet -q "$WEBP_Q" "$jpg" -o "$OUT/${base}-${w}w.webp"
    fi
    echo "  $jpg$( [ "$HAVE_WEBP" -eq 1 ] && echo "  + .webp" )"
  done
}

echo "Processing images from $SRC ..."

# hero + full-bleed section photos: 640 / 1280 / 1920
derive hero-autumn-peak      640 1280 1920
derive surveys-bison-herd    640 1280 1920
derive records-mule-deer-buck 640 1280 1920
derive hospitality-bull-elk  640 1280 1920

# founders: 640 / 1280
derive founder-parker-duckhunt 640 1280
derive founder-b               640 1280
derive founder-c               640 1280

# footer strip: 640 only
derive strip-pronghorn-dusk  640
derive strip-snowy-timp      640
derive strip-red-maple-ridge 640
derive strip-delicate-arch   640

# social share card: 1200x630 crop from the hero source
HERO_SRC="$(find_src hero-autumn-peak)"
if [ -n "$HERO_SRC" ]; then
  sips -s format jpeg -s formatOptions 82 \
       --resampleHeightWidth 630 1200 --cropToHeightWidth 630 1200 \
       "$HERO_SRC" --out "$OUT/og-cover.jpg" >/dev/null
  echo "  $OUT/og-cover.jpg (1200x630)"
fi

echo "Done. Now swap the placeholder <img> tags in index.html for the <picture> blocks."
