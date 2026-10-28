/* Arches Labs — the drifting contour map behind the local AI page (/local-ai/).

   The ground is a height field made of seeded simplex noise, drawn as contour lines with
   marching squares. Time is the noise's third axis, so hills slowly rise, sink, and
   slide east. Every fifth line is an index contour, drawn heavier, as on a printed topo
   map. The seed is fixed, so every visit opens on the same map.

   Progressive enhancement only: with JS off the page shows one still frame of the same
   map from assets/img/contours.svg, which tools/make-contours.js draws with this file
   (in Node, the bottom of this file exports the drawing code instead of starting).

   The map holds still for prefers-reduced-motion and while the tab is hidden, and the
   "Pause map" button in the hero ([data-contours-toggle]) stops it for anyone. */
(function () {
  "use strict";

  var SEED = 418;
  var SCALE = 560;     // CSS pixels per unit of noise: sets how big the hills are
  var STEP = 0.085;    // height between contour lines
  var INDEX = 5;       // every fifth line is an index contour
  var DRIFT = 5;       // pixels per second the ground slides east
  var MORPH = 0.022;   // how fast it changes shape
  var FPS = 15;        // plenty for motion this slow

  /* --- seeded 3D simplex noise (after Stefan Gustavson's public-domain version) --- */
  var GRAD = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1,
              1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  function makeNoise(seed) {
    var p = new Uint8Array(256), perm = new Uint8Array(512), s = seed >>> 0, i, j, tmp;
    for (i = 0; i < 256; i++) { p[i] = i; }
    for (i = 255; i > 0; i--) {  // shuffle with a small LCG so the same seed gives the same map
      s = (s * 1664525 + 1013904223) >>> 0;
      j = s % (i + 1);
      tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; }

    function corner(x, y, z, h) {
      var t = 0.6 - x * x - y * y - z * z;
      if (t < 0) { return 0; }
      var g = (h % 12) * 3;
      t *= t;
      return t * t * (GRAD[g] * x + GRAD[g + 1] * y + GRAD[g + 2] * z);
    }
    var F3 = 1 / 3, G3 = 1 / 6;
    return function (x, y, z) {
      var s = (x + y + z) * F3;
      var i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      var t = (i + j + k) * G3;
      var x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
      var i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      var ii = i & 255, jj = j & 255, kk = k & 255;
      return 32 * (
        corner(x0, y0, z0, perm[ii + perm[jj + perm[kk]]]) +
        corner(x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3, perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]]) +
        corner(x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3, perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]]) +
        corner(x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3, perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]])
      );
    };
  }

  /* --- the ground --- */
  // height at (x, y) in CSS pixels, t in seconds: broad hills plus smaller knolls, with a
  // little domain warp so ridges bend instead of sitting in round blobs
  function height(n, x, y, t) {
    var u = (x - t * DRIFT) / SCALE, v = y / SCALE, w = t * MORPH;
    var wu = n(u * 0.5 + 31.7, v * 0.5, w * 0.6) * 0.55;
    var wv = n(u * 0.5, v * 0.5 - 12.3, w * 0.6) * 0.55;
    return n(u + wu, v + wv, w) * 0.74 + n(u * 2.3 + 5.1, v * 2.3 - 8.7, w * 1.7) * 0.26;
  }

  // fills h with the ground on a grid of (cols + 1) x (rows + 1) points, cell px apart
  function sample(n, h, cols, rows, cell, t) {
    var o = 0;
    for (var r = 0; r <= rows; r++) {
      for (var c = 0; c <= cols; c++) { h[o++] = height(n, c * cell, r * cell, t); }
    }
  }

  /* --- marching squares ---
     Walks every grid cell; for each contour level that crosses it, calls
     line(isIndex, x1, y1, x2, y2) with the piece of that contour inside the cell.
     Corners: a top-left, b top-right, c bottom-right, d bottom-left.
     Edges: 0 top (a-b), 1 right (b-c), 2 bottom (d-c), 3 left (a-d). */
  var CASES = [
    [], [3, 2], [2, 1], [3, 1], [0, 1], null, [0, 2], [0, 3],
    [0, 3], [0, 2], null, [0, 1], [3, 1], [2, 1], [3, 2], []
  ];
  function trace(h, cols, rows, cell, line) {
    var stride = cols + 1;
    var px = [0, 0, 0, 0], py = [0, 0, 0, 0];
    for (var r = 0; r < rows; r++) {
      var y0 = r * cell, y1 = y0 + cell;
      for (var c = 0; c < cols; c++) {
        var o = r * stride + c;
        var a = h[o], b = h[o + 1], cc = h[o + stride + 1], d = h[o + stride];
        var lo = Math.min(a, b, cc, d), hi = Math.max(a, b, cc, d);
        var k0 = Math.ceil(lo / STEP), k1 = Math.floor(hi / STEP);
        if (k0 > k1) { continue; }
        var x0 = c * cell, x1 = x0 + cell;
        for (var k = k0; k <= k1; k++) {
          var L = k * STEP;
          var idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0);
          if (idx === 0 || idx === 15) { continue; }
          // where the level crosses each edge
          px[0] = x0 + (L - a) / (b - a) * cell; py[0] = y0;
          px[1] = x1; py[1] = y0 + (L - b) / (cc - b) * cell;
          px[2] = x0 + (L - d) / (cc - d) * cell; py[2] = y1;
          px[3] = x0; py[3] = y0 + (L - a) / (d - a) * cell;
          var major = k % INDEX === 0;
          var segs = CASES[idx];
          if (!segs) {
            // saddle: the cell's middle decides which corners join
            var mid = (a + b + cc + d) / 4 > L;
            segs = (idx === 5) === mid ? [0, 3, 2, 1] : [0, 1, 3, 2];
          }
          line(major, px[segs[0]], py[segs[0]], px[segs[1]], py[segs[1]]);
          if (segs.length > 2) { line(major, px[segs[2]], py[segs[2]], px[segs[3]], py[segs[3]]); }
        }
      }
    }
  }

  var api = { SEED: SEED, STEP: STEP, makeNoise: makeNoise, sample: sample, trace: trace };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  /* --- in the page --- */
  var canvas = document.querySelector("canvas.contours");
  if (!canvas || !canvas.getContext || !window.requestAnimationFrame || typeof Path2D !== "function") { return; }
  var ctx = canvas.getContext("2d");
  if (!ctx) { return; }

  var noise = makeNoise(SEED);
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var toggle = document.querySelector("[data-contours-toggle]");
  var w = 0, hgt = 0, dpr = 1, cell = 12, cols = 0, rows = 0, grid = null;
  var minorColor = "", majorColor = "";
  var t = 0, last = 0, since = 0, raf = 0;
  var playing = !reduce;

  function size() {
    var nw = canvas.clientWidth, nh = canvas.clientHeight;
    if (nw === w && nh === hgt) { return false; }
    w = nw; hgt = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    cell = w < 640 ? 14 : 12;
    cols = Math.ceil(w / cell);
    rows = Math.ceil(hgt / cell);
    grid = new Float32Array((cols + 1) * (rows + 1));
    // line colors come from the stylesheet (canvas.contours sets --contour and --contour-index)
    var cs = window.getComputedStyle(canvas);
    minorColor = cs.getPropertyValue("--contour").trim() || "rgba(214, 196, 158, 0.2)";
    majorColor = cs.getPropertyValue("--contour-index").trim() || "rgba(217, 174, 98, 0.42)";
    return true;
  }

  function draw() {
    var minor = new Path2D(), major = new Path2D();
    sample(noise, grid, cols, rows, cell, t);
    trace(grid, cols, rows, cell, function (isIndex, x1, y1, x2, y2) {
      var p = isIndex ? major : minor;
      p.moveTo(x1, y1);
      p.lineTo(x2, y2);
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    ctx.lineCap = "round";
    ctx.strokeStyle = minorColor;
    ctx.lineWidth = 1;
    ctx.stroke(minor);
    ctx.strokeStyle = majorColor;
    ctx.lineWidth = 1.6;
    ctx.stroke(major);
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    var dt = last ? Math.min((now - last) / 1000, 0.25) : 0;
    last = now;
    t += dt;
    since += dt;
    if (since < 1 / FPS) { return; }
    since = 0;
    draw();
  }
  function start() {
    if (!raf && playing && !document.hidden) { last = 0; raf = window.requestAnimationFrame(frame); }
  }
  function stop() {
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
  }
  function setPlaying(on) {
    playing = on;
    if (toggle) {
      toggle.textContent = on ? "Pause map" : "Play map";
      toggle.classList.toggle("is-paused", !on);
      toggle.setAttribute("aria-pressed", on ? "false" : "true");
    }
    if (on) { start(); } else { stop(); }
  }

  size();
  draw();
  canvas.classList.add("is-drawn");  // fades in over the plain ground
  // the hero's "drawn by your own computer" note is only true from here on
  var note = document.querySelector("[data-contours-note]");
  if (note) { note.hidden = false; }

  if (toggle && !reduce) {
    toggle.hidden = false;
    toggle.addEventListener("click", function () { setPlaying(!playing); });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { stop(); } else { start(); }
  });
  window.addEventListener("resize", function () {
    if (size()) { draw(); }
  });
  setPlaying(playing);
})();
