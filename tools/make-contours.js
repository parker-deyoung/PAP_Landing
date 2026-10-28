#!/usr/bin/env node
/* Draws assets/img/contours.svg: one still frame of the local AI page's contour map, for
   visitors with JS off. Uses the same code as the live map (assets/js/contours.js), so
   both show the same ground. Re-run after changing that file's SEED, SCALE, or STEP:

     node tools/make-contours.js
*/
"use strict";

var fs = require("fs");
var path = require("path");
var C = require("../assets/js/contours.js");

var W = 1600, H = 1000, CELL = 12;
var cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
var grid = new Float32Array((cols + 1) * (rows + 1));
C.sample(C.makeNoise(C.SEED), grid, cols, rows, CELL, 0);

// collect the pieces, then join them end to end into polylines so the file stays small
var pieces = { minor: [], major: [] };
C.trace(grid, cols, rows, CELL, function (isIndex, x1, y1, x2, y2) {
  pieces[isIndex ? "major" : "minor"].push([x1, y1, x2, y2]);
});

function key(x, y) { return Math.round(x * 10) + "," + Math.round(y * 10); }

function join(segs) {
  var ends = new Map();  // point -> indexes of the pieces that touch it
  segs.forEach(function (s, i) {
    [key(s[0], s[1]), key(s[2], s[3])].forEach(function (k) {
      if (!ends.has(k)) { ends.set(k, []); }
      ends.get(k).push(i);
    });
  });
  var used = new Uint8Array(segs.length);
  var lines = [];
  function grow(pts, atEnd) {
    for (;;) {
      var p = atEnd ? pts[pts.length - 1] : pts[0];
      var next = (ends.get(key(p[0], p[1])) || []).find(function (i) { return !used[i]; });
      if (next === undefined) { return; }
      used[next] = 1;
      var s = segs[next];
      var q = key(s[0], s[1]) === key(p[0], p[1]) ? [s[2], s[3]] : [s[0], s[1]];
      if (atEnd) { pts.push(q); } else { pts.unshift(q); }
    }
  }
  segs.forEach(function (s, i) {
    if (used[i]) { return; }
    used[i] = 1;
    var pts = [[s[0], s[1]], [s[2], s[3]]];
    grow(pts, true);
    grow(pts, false);
    lines.push(pts);
  });
  return lines;
}

// whole-pixel points, written relative after the first so most numbers are one or two digits
function toPath(lines) {
  return lines.map(function (pts) {
    var x = Math.round(pts[0][0]), y = Math.round(pts[0][1]);
    var d = "M" + x + " " + y;
    var rel = [];
    for (var i = 1; i < pts.length; i++) {
      var nx = Math.round(pts[i][0]), ny = Math.round(pts[i][1]);
      if (nx === x && ny === y) { continue; }
      rel.push((nx - x) + " " + (ny - y));
      x = nx; y = ny;
    }
    return rel.length ? d + "l" + rel.join(" ") : "";
  }).join("");
}

// the same colors as canvas.contours in assets/css/local-ai.css
var svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid slice">' +
  '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  '<path stroke="#d6c49e" stroke-opacity="0.2" stroke-width="1" d="' + toPath(join(pieces.minor)) + '"/>' +
  '<path stroke="#d9ae62" stroke-opacity="0.42" stroke-width="1.6" d="' + toPath(join(pieces.major)) + '"/>' +
  "</g></svg>\n";

var out = path.join(__dirname, "..", "assets", "img", "contours.svg");
fs.writeFileSync(out, svg);
console.log("wrote " + path.relative(process.cwd(), out) + " (" + Math.round(svg.length / 1024) + " KB)");
