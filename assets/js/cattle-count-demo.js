/* Arches Labs — cattle page head-count demo (flight + live dashboard).
   The cattle version of survey-demo.js: same map geometry, flight lines, and timing, but
   it counts cows, calves, and bulls by pasture, and the finished count is checked
   against what was turned out. Each group on the map is a bunch of pairs, so a sighting
   lists every kind in it.
   Progressive enhancement only. Without this file the inline SVG and the panel show the
   finished count (every animal marked, final numbers) and every step's text. The panel is
   recounted from the .sd-a markers as each one is found, so the markers in the SVG are
   the only data. STEPS start times must line up with the five <li class="survey__step">.
   Respects prefers-reduced-motion (starts paused on a still frame) and pauses itself
   while the demo is scrolled off-screen. */
(function () {
  "use strict";

  var root = document.querySelector("[data-count]");
  if (!root || !window.requestAnimationFrame) { return; }

  var el = {};
  Array.prototype.forEach.call(root.querySelectorAll("[data-el]"), function (n) {
    el[n.getAttribute("data-el")] = n;
  });
  if (!el.track || typeof el.track.getTotalLength !== "function") { return; }

  var SVGNS = "http://www.w3.org/2000/svg";
  var T = 34;
  var STEPS = [0, 3.6, 6, 13.4, 23.5];
  var KEYS = [2.8, 5.2, 11.15, 17.05, 33]; // still frame per step when paused
  var FLY = [6, 23.5];                    // on the flight lines
  var LANDED = 26.8;
  var BARN = [100, 430];
  var CAM = [536, 72];                    // center of the thermal inset
  var ZOOM = 2;                           // inset shows a 90 x 58 patch, same as the footprint
  var ACRES = 640;
  var LINES = 8;

  // [kind, one, many], in the order the panel and the sightings list them
  var KINDS = [["cow", "cow", "cows"], ["calf", "calf", "calves"], ["bull", "bull", "bulls"]];
  var PASTURES = [["north", "North"], ["creek", "Creek"]];
  var RING = { cow: "#2d6fb7", calf: "#1c9269", bull: "#d0602e", unknown: "#454a3e" };
  var BOX = { cow: "#3987e5", calf: "#199e70", bull: "#d95926", unknown: "#ffd9a0" };
  // thermal blob size [rx, ry]
  var BODY = { cow: [5.6, 3], calf: [3.6, 2], bull: [6.4, 3.4], unknown: [5.2, 2.8] };

  /* --- helpers --- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function ease(p) { return p * p * (3 - 2 * p); }
  // fades in over a→b, out over c→d
  function fade(t, a, b, c, d) { return Math.min(prog(t, a, b), 1 - prog(t, c, d)); }
  function move(n, x, y, extra) {
    n.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")" + (extra || ""));
  }
  function op(n, v) { n.setAttribute("opacity", clamp(v, 0, 1).toFixed(3)); }
  function svg(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) { n.setAttribute(k, attrs[k]); }
    return n;
  }
  function setText(n, s) { if (n && n.textContent !== s) { n.textContent = s; } }
  // demo clock: the loop runs from 5:38 to 6:09 in the morning
  function clock(t, withAmPm) {
    var m = Math.floor(338 + t * 31 / 34);
    var s = Math.floor(m / 60) + ":" + ("0" + (m % 60)).slice(-2);
    return withAmPm ? s + " AM" : s;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function pastureName(p) {
    for (var i = 0; i < PASTURES.length; i++) { if (PASTURES[i][0] === p) { return PASTURES[i][1]; } }
    return "";
  }
  function kindName(k) {
    for (var i = 0; i < KINDS.length; i++) { if (KINDS[i][0] === k) { return KINDS[i][1]; } }
    return "";
  }

  function prep(path) {
    var len = path.getTotalLength();
    path.setAttribute("stroke-dasharray", len.toFixed(1) + " " + len.toFixed(1));
    return len;
  }
  var lenTrack = prep(el.track);
  prep(el.swath);
  var lenOut = prep(el.pathOut);
  var lenHome = prep(el.pathHome);
  var lenArea = el.area.getTotalLength ? el.area.getTotalLength() : 0;
  if (lenArea) { el.area.setAttribute("stroke-dasharray", lenArea.toFixed(1) + " " + lenArea.toFixed(1)); }
  function along(path, len, p) { var pt = path.getPointAtLength(len * p); return [pt.x, pt.y]; }

  /* --- cattle: read from the markers, time each one to when the drone passes over --- */
  var samples = [];
  for (var s = 0; s <= lenTrack; s += 3) {
    var pt = el.track.getPointAtLength(s);
    samples.push([pt.x, pt.y, s / lenTrack]);
  }

  var heatLayer = el.heat;
  var animals = Array.prototype.map.call(root.querySelectorAll(".sd-a"), function (g, i) {
    var m = /translate\(\s*([\d.]+)[ ,]+([\d.]+)/.exec(g.getAttribute("transform")) || [0, 0, 0];
    var x = +m[1], y = +m[2];
    var kind = (/sd-a--(\w+)/.exec(g.getAttribute("class")) || [0, "unknown"])[1];
    var best = Infinity, when = 0;
    samples.forEach(function (p) {
      var d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y);
      if (d < best) { best = d; when = p[2]; }
    });

    var ring = svg("circle", { cx: x, cy: y, r: 5, stroke: RING[kind], opacity: 0 });
    el.rings.appendChild(ring);

    // the same animal as the thermal camera sees it, plus its detection box
    var size = BODY[kind] || BODY.unknown;
    var rx = size[0], ry = size[1];
    var blob = svg("g", {
      transform: "translate(" + x + " " + y + ") rotate(" + ((i * 67) % 180 - 90) + ")",
      opacity: kind === "unknown" ? 0.55 : 1
    });
    blob.appendChild(svg("ellipse", { rx: rx, ry: ry, fill: "url(#cc-heat)" }));
    blob.appendChild(svg("circle", { cx: (rx * 0.95).toFixed(2), r: (ry * 0.6).toFixed(2), fill: "url(#cc-heat)" }));
    var b = rx + 1.4;
    var box = svg("rect", {
      x: (x - b).toFixed(1), y: (y - b).toFixed(1), width: (2 * b).toFixed(1), height: (2 * b).toFixed(1),
      rx: 0.8, fill: "none", stroke: BOX[kind], "stroke-width": 0.45, opacity: 0
    });
    if (kind === "unknown") { box.setAttribute("stroke-dasharray", "1.2 0.8"); }
    heatLayer.appendChild(blob);
    heatLayer.appendChild(box);

    return {
      node: g, ring: ring, box: box, x: x, y: y, kind: kind,
      pasture: g.getAttribute("data-p"), group: g.getAttribute("data-g"),
      at: FLY[0] + (FLY[1] - FLY[0]) * when, state: ""
    };
  });

  // biggest final count sets the scale for the panel's bars
  var finals = {};
  animals.forEach(function (a) { finals[a.kind] = (finals[a.kind] || 0) + 1; });
  var barMax = Math.max.apply(null, KINDS.map(function (k) { return finals[k[0]] || 0; }).concat(1));

  // sightings feed: one line per group, logged once the whole group has been seen
  var groups = {};
  animals.forEach(function (a) {
    var g = groups[a.group] || (groups[a.group] = { pasture: a.pasture, flagged: a.kind === "unknown", counts: {}, at: 0 });
    g.counts[a.kind] = (g.counts[a.kind] || 0) + 1;
    g.at = Math.max(g.at, a.at);
  });
  var feedOrder = Object.keys(groups).map(function (k) { return groups[k]; })
    .sort(function (a, b) { return a.at - b.at; });
  var flaggedText = el["c-unknown"] ? el["c-unknown"].textContent : "";

  function feedText(g) {
    if (g.flagged) { return "Off alone in the timber · flagged for you"; }
    var parts = KINDS.filter(function (k) { return g.counts[k[0]]; })
      .map(function (k) { return plural(g.counts[k[0]], k[1], k[2]); });
    return pastureName(g.pasture) + " · " + parts.join(", ");
  }

  function feedItem(g) {
    var li = document.createElement("li");
    var time = document.createElement("span");
    time.className = "sp-feed__time";
    time.textContent = clock(g.at);
    var sw = document.createElement("span");
    var lead = KINDS.filter(function (k) { return g.counts[k[0]]; })[0];
    sw.className = "sp-sw sp-sw--" + (g.flagged ? "review" : lead[0]);
    if (g.flagged) { sw.textContent = "?"; }
    var text = document.createElement("span");
    text.textContent = feedText(g);
    li.appendChild(time);
    li.appendChild(sw);
    li.appendChild(text);
    return li;
  }

  /* --- drone --- */
  function droneAt(t) {
    if (t < 4.5) { return BARN; }
    if (t < FLY[0]) { var p = prog(t, 4.5, FLY[0]); return along(el.pathOut, lenOut, p * p); }
    if (t < FLY[1]) { return along(el.track, lenTrack, prog(t, FLY[0], FLY[1])); }
    if (t < 26.4) { var q = 1 - prog(t, FLY[1], 26.4); return along(el.pathHome, lenHome, 1 - q * q); }
    return BARN;
  }

  function altitudeAt(t) {
    if (t < 3.8) { return 0; }
    if (t < 4.5) { return ease(prog(t, 3.8, 4.5)); }
    if (t < 26.4) { return 1; }
    return 1 - ease(prog(t, 26.4, 27));
  }

  /* --- steps list: turn each title into a button + progress bar --- */
  var items = Array.prototype.slice.call(root.querySelectorAll(".survey__step"));
  var bars = [];
  var buttons = [];
  items.forEach(function (li, i) {
    var h = li.querySelector(".survey__title");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "survey__step-btn";
    while (h.firstChild) { btn.appendChild(h.firstChild); }
    h.appendChild(btn);
    btn.addEventListener("click", function () { jump(i); });
    var bar = document.createElement("span");
    bar.className = "survey__progress";
    bar.setAttribute("aria-hidden", "true");
    li.insertBefore(bar, li.firstChild);
    bars.push(bar);
    buttons.push(btn);
  });

  /* --- one frame --- */
  var last = { step: -1, counts: -1, feed: 0, cam: "", acres: -1, line: -1 };

  function render(t) {
    var i;
    var d = droneAt(t);
    var cover = prog(t, FLY[0], FLY[1]);
    var line = t < FLY[0] ? 0 : t >= FLY[1] ? LINES : clamp(Math.round((376 - d[1]) / 44) + 1, 1, LINES);

    // 1. the count area draws itself, then the planned lines
    if (lenArea) {
      el.area.setAttribute("stroke-dashoffset", (lenArea * (1 - ease(prog(t, 0.2, 1.8)))).toFixed(1));
    }
    el.area.setAttribute("fill-opacity", (0.3 * prog(t, 1.2, 1.8)).toFixed(3));
    op(el.areaLabel, prog(t, 1.2, 1.8));
    Array.prototype.forEach.call(el.plan.children, function (ln, k) {
      op(ln, prog(t, 1.6 + k * 0.22, 1.85 + k * 0.22));
    });

    // 2. takeoff / landing ring at the barn dock, and the legs to and from the lines
    var dk = t < 15 ? prog(t, 3.8, 5) : prog(t, 26.4, 27.6);
    el.dockRing.setAttribute("r", (12 + 18 * dk).toFixed(1));
    op(el.dockRing, dk > 0 && dk < 1 ? 1 - dk : 0);
    el.pathOut.setAttribute("stroke-dashoffset", (lenOut * (1 - prog(t, 4.5, FLY[0]))).toFixed(1));
    op(el.pathOut, fade(t, 4.5, 4.7, FLY[0], 7));
    el.pathHome.setAttribute("stroke-dashoffset", (lenHome * (1 - prog(t, FLY[1], 26.4))).toFixed(1));
    op(el.pathHome, fade(t, FLY[1], 23.7, 27.4, 28.4));

    // 3. ground covered so far (hidden outright at zero: Chrome leaves faint joins on
    // a fully dashed-off wide stroke)
    var off = (lenTrack * (1 - cover)).toFixed(1);
    el.swath.setAttribute("stroke-dashoffset", off);
    el.track.setAttribute("stroke-dashoffset", off);
    el.swath.style.visibility = el.track.style.visibility = cover > 0 ? "" : "hidden";

    // 4. cattle: hidden until the camera passes over, then a pop and a ring
    animals.forEach(function (a) {
      var since = t - a.at;
      var state = since < 0 ? "hidden" : since > 0.7 ? "shown" : "pop";
      if (state === "pop") {
        var sc = 1 + 0.9 * (1 - ease(prog(since, 0, 0.35)));
        a.node.setAttribute("transform", "translate(" + a.x + " " + a.y + ") scale(" + sc.toFixed(3) + ")");
        a.node.setAttribute("opacity", "1");
        a.ring.setAttribute("r", (5 + 12 * (since / 0.7)).toFixed(1));
        op(a.ring, 1 - since / 0.7);
      } else if (state !== a.state) {
        a.node.setAttribute("transform", "translate(" + a.x + " " + a.y + ")");
        a.node.setAttribute("opacity", state === "hidden" ? "0" : "1");
        a.ring.setAttribute("opacity", "0");
      }
      if (state !== a.state) { a.box.setAttribute("opacity", state === "hidden" ? "0" : "1"); }
      a.state = state;
    });

    // live thermal camera: a zoomed view under the drone, north up
    op(el.cam, fade(t, 5.6, 6, FLY[1], 24));
    el.camWorld.setAttribute("transform",
      "translate(" + CAM[0] + " " + CAM[1] + ") scale(" + ZOOM.toFixed(3) + ") translate(" +
      (-d[0]).toFixed(1) + " " + (-d[1]).toFixed(1) + ")");
    var latest = null;
    animals.forEach(function (a) {
      if (a.at <= t && t - a.at < 1.2 && (!latest || a.at > latest.at)) { latest = a; }
    });
    var cam = !latest ? "SCANNING"
      : latest.kind === "unknown" ? "OFF ALONE · FLAGGED"
      : (kindName(latest.kind) + " · " + pastureName(latest.pasture)).toUpperCase();
    if (cam !== last.cam) { setText(el.camLabel, cam); last.cam = cam; }

    // camera footprint + drone (grows and its shadow drifts as it climbs)
    op(el.foot, fade(t, 5.8, 6.1, FLY[1] - 0.1, FLY[1] + 0.2));
    move(el.foot, d[0], d[1]);
    var alt = altitudeAt(t);
    move(el.drone, d[0], d[1], " scale(" + (0.8 + 0.25 * alt).toFixed(3) + ")");
    el.droneShadow.setAttribute("cx", (2 + 6 * alt).toFixed(1));
    el.droneShadow.setAttribute("cy", (3 + 8 * alt).toFixed(1));
    op(el.droneShadow, 0.2 - 0.08 * alt);

    // 5. landed: saved card, checked against turnout
    var done = t >= LANDED;
    root.classList.toggle("is-done", done);
    root.classList.toggle("is-flying", t >= STEPS[1] && !done);
    el.card.classList.toggle("is-shown", t >= 27.2);

    /* --- the dashboard --- */
    setText(el.clock, clock(t, true));
    setText(el.pill, done ? "Saved" : t >= STEPS[1] ? "Live" : "Planned");

    var status, sub;
    if (t < 2.2) { status = "Planning the flight"; sub = "North and Creek pastures · " + ACRES + " acres"; }
    else if (t < STEPS[1]) { status = "Flight plan ready"; sub = LINES + " lines · thermal camera"; }
    else if (t < FLY[0]) { status = "Taking off"; sub = "Barn dock · " + clock(3.8, true); }
    else if (t < FLY[1]) { status = "Flying line " + line + " of " + LINES; sub = "Thermal camera on · 400 ft"; }
    else if (!done) { status = "Heading back to the barn"; sub = "All " + LINES + " lines flown"; }
    else { status = "Count complete"; sub = "Landed " + clock(LANDED, true) + " · checked against turnout"; }
    setText(el.status, status);
    setText(el.sub, sub);

    var acres = Math.round(cover * ACRES);
    if (acres !== last.acres || line !== last.line) {
      setText(el.coverPct, Math.round(cover * 100) + "%");
      el.coverBar.style.setProperty("--v", cover.toFixed(3));
      setText(el.coverNote, acres + " of " + ACRES + " acres · " +
        (t < FLY[0] ? LINES + " lines planned" : line + " of " + LINES + " lines"));
      last.acres = acres;
      last.line = line;
    }

    // counts, only touched when an animal is found (they're always found in the same
    // order, so how many have been found says which ones)
    var counts = {};
    var found = 0;
    animals.forEach(function (a) {
      if (a.state === "hidden") { return; }
      var c = counts[a.kind] || (counts[a.kind] = { n: 0 });
      c.n++;
      c[a.pasture] = (c[a.pasture] || 0) + 1;
      found++;
    });
    if (found !== last.counts) {
      var total = 0;
      KINDS.forEach(function (k) {
        var c = counts[k[0]] || { n: 0 };
        total += c.n;
        setText(el["n-" + k[0]], String(c.n));
        el["bar-" + k[0]].style.setProperty("--v", (c.n / barMax).toFixed(3));
        setText(el["c-" + k[0]], PASTURES.map(function (p) { return (c[p[0]] || 0) + " in " + p[1]; }).join(" · "));
      });
      setText(el.total, String(total));
      var flagged = (counts.unknown || { n: 0 }).n;
      setText(el["n-unknown"], String(flagged));
      setText(el["c-unknown"], flagged ? flaggedText : "Nothing flagged yet");
      last.counts = found;
    }

    // sightings feed: newest three groups, newest on top
    for (i = 0; i < feedOrder.length && feedOrder[i].at <= t; i++) { /* count finished groups */ }
    var feedKey = i || (t < FLY[0] ? -2 : -1);   // empty feed: before vs after takeoff
    if (feedKey !== last.feed) {
      while (el.feed.firstChild) { el.feed.removeChild(el.feed.firstChild); }
      for (var k = i - 1; k >= Math.max(0, i - 3); k--) { el.feed.appendChild(feedItem(feedOrder[k])); }
      if (!i) {
        var wait = document.createElement("li");
        wait.className = "sp-feed__empty";
        wait.textContent = t < FLY[0] ? "Sightings show up here once the drone is on the lines" : "Looking…";
        el.feed.appendChild(wait);
      }
      last.feed = feedKey;
    }

    // steps
    for (i = STEPS.length - 1; i > 0 && t < STEPS[i]; i--) { /* find current */ }
    if (i !== last.step) {
      items.forEach(function (li, k) {
        li.classList.toggle("is-active", k === i);
        if (k === i) { buttons[k].setAttribute("aria-current", "step"); }
        else { buttons[k].removeAttribute("aria-current"); bars[k].style.transform = "scaleX(0)"; }
      });
      last.step = i;
    }
    var stepEnd = i + 1 < STEPS.length ? STEPS[i + 1] : T;
    bars[i].style.transform = "scaleX(" + prog(t, STEPS[i], stepEnd).toFixed(3) + ")";
  }

  /* --- playback --- */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reduce;
  var onScreen = true;
  var t = reduce ? KEYS[3] : 0;
  var lastNow = 0;
  var raf = 0;

  function frame(now) {
    raf = 0;
    if (!playing || !onScreen) { return; }
    var dt = lastNow ? Math.min((now - lastNow) / 1000, 0.1) : 0;
    lastNow = now;
    t += dt;
    if (t >= T) { t = 0; }
    render(t);
    raf = window.requestAnimationFrame(frame);
  }
  function start() {
    if (!raf && playing && onScreen) { lastNow = 0; raf = window.requestAnimationFrame(frame); }
  }
  function stop() {
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
  }

  function jump(i) {
    // playing: restart from the top of that step; paused: show its still frame
    t = playing ? STEPS[i] : KEYS[i];
    render(t);
  }

  function setPlaying(on) {
    playing = on;
    root.classList.toggle("is-paused", !on);
    if (el.toggle) { el.toggle.textContent = on ? "Pause demo" : "Play demo"; }
    if (on) { start(); } else { stop(); }
  }

  if (el.toggle) {
    el.toggle.hidden = false;
    el.toggle.addEventListener("click", function () { setPlaying(!playing); });
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) { start(); } else { stop(); }
    }, { threshold: 0.15 }).observe(root.querySelector(".survey__window") || root);
  }

  root.classList.add("survey--live");
  render(t);
  setPlaying(playing);
})();
