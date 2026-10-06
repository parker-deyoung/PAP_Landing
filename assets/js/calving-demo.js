/* Arches Labs — cattle page night calving-check demo.
   Built on patrol-demo.js (same night map style, dock, thermal sweep, phone cards), told
   for a calving pasture: the drone flies its scheduled 2 AM round, counts the bedded
   herd, finds a heifer off by herself, alerts you, and holds overhead while your pickup
   drives out, then logs the calving and docks.
   Progressive enhancement only. Without this file the SVG shows one static frame (heifer
   tagged, alert sent) and every step's text is visible. STEPS start times must line up
   with the six <li class="patrol__step"> in order. Respects prefers-reduced-motion
   (starts paused on a still frame) and pauses itself while scrolled off-screen. */
(function () {
  "use strict";

  var root = document.querySelector("[data-calving]");
  if (!root || !window.requestAnimationFrame) { return; }

  var el = {};
  Array.prototype.forEach.call(root.querySelectorAll("[data-el]"), function (n) {
    el[n.getAttribute("data-el")] = n;
  });
  if (!el.pathOut || typeof el.pathOut.getTotalLength !== "function") { return; }

  var T = 32;
  var STEPS = [0, 4.6, 9.6, 13.5, 18, 23];
  var KEYS = [2.8, 7.8, 13, 16, 20.5, 31.8]; // still frame per step when paused
  var BARN = [140, 297];
  var SWEEP = [450, 195];                    // where the drone hovers for its thermal pass
  var HEIFER = [548, 214];
  var HOLD = [-26, -34];                     // drone holds up-and-back of the heifer
  var CALF = [-16, 6];                       // calf on the ground beside her
  var CALVED = 23.4;
  var DRIVE = [19, 23];                      // your pickup, barn to the east fence
  var HOME = [26, 29.8];                     // drone leaves her, then lands at the barn
  var HERD = 17;

  var STATUS = [
    [0, "Calving check scheduled", "Every 2 hours · next 2:00 AM"],
    [1.6, "Check starting", "Calving pasture · 2:00 AM"],
    [4.6, "Drone launched", "Barn dock to calving pasture"],
    [9.6, "Thermal pass", null],             // the sub line counts the herd as it goes
    [13.5, "Heifer off by herself", "East fence · up and down"],
    [18, "Alert sent to your phone", "Holding overhead · lights off"],
    [CALVED, "Calf on the ground", "2:31 AM · east fence"],
    [HOME[0], "Returning to barn", "Clip saved to her record"],
    [HOME[1] + 0.7, "Docked and charging", "Next check 4:00 AM"]
  ];

  /* --- helpers --- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function ease(p) { return p * p * (3 - 2 * p); }
  function mix(a, b, p) { return a + (b - a) * p; }
  // fades in over a→b, out over c→d
  function fade(t, a, b, c, d) { return Math.min(prog(t, a, b), 1 - prog(t, c, d)); }
  function move(n, x, y, extra) {
    n.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")" + (extra || ""));
  }
  function op(n, v) { n.setAttribute("opacity", clamp(v, 0, 1).toFixed(3)); }
  function setText(n, s) { if (n.textContent !== s) { n.textContent = s; } }

  var lenOut = el.pathOut.getTotalLength();
  var lenHome = el.pathHome.getTotalLength();
  var lenRoad = el.road.getTotalLength();
  el.pathOut.setAttribute("stroke-dasharray", lenOut.toFixed(1));
  el.pathHome.setAttribute("stroke-dasharray", lenHome.toFixed(1));
  function along(path, len, p) { var pt = path.getPointAtLength(len * p); return [pt.x, pt.y]; }

  // restless until the calf comes: a small shuffle in place
  function heiferAt(t) {
    var r = 1 - prog(t, CALVED - 0.6, CALVED);
    return [HEIFER[0] + Math.sin(t * 1.7) * 3 * r, HEIFER[1] + Math.cos(t * 1.3) * 2 * r];
  }

  function droneAt(t) {
    if (t < 5.6) { return BARN; }
    if (t < 9.6) { return along(el.pathOut, lenOut, ease(prog(t, 5.6, 9.6))); }
    if (t < 13.5) { return [SWEEP[0] + Math.sin(t * 1.3) * 2, SWEEP[1] + Math.cos(t * 1.1) * 2]; }
    if (t < HOME[0]) {
      // a slow circle over her, settling just before it turns for home
      var w = 3 * (1 - prog(t, HOME[0] - 1, HOME[0]));
      var target = [HEIFER[0] + HOLD[0] + Math.sin(t * 0.9) * w, HEIFER[1] + HOLD[1] + Math.cos(t * 0.9) * w];
      if (t >= 15) { return target; }
      var p = ease(prog(t, 13.5, 15));
      return [mix(SWEEP[0], target[0], p), mix(SWEEP[1], target[1], p)];
    }
    if (t < HOME[1]) { return along(el.pathHome, lenHome, ease(prog(t, HOME[0], HOME[1]))); }
    return BARN;
  }

  function altitudeAt(t) {
    if (t < 4.8) { return 0; }
    if (t < 5.6) { return ease(prog(t, 4.8, 5.6)); }
    if (t < HOME[1]) { return 1; }
    return 1 - ease(prog(t, HOME[1], HOME[1] + 0.8));
  }

  /* --- steps list: turn each title into a button + progress bar --- */
  var items = Array.prototype.slice.call(root.querySelectorAll(".patrol__step"));
  var bars = [];
  var buttons = [];
  items.forEach(function (li, i) {
    var h = li.querySelector(".patrol__title");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "patrol__step-btn";
    while (h.firstChild) { btn.appendChild(h.firstChild); }
    h.appendChild(btn);
    btn.addEventListener("click", function () { jump(i); });
    var bar = document.createElement("span");
    bar.className = "patrol__bar";
    bar.setAttribute("aria-hidden", "true");
    li.insertBefore(bar, li.firstChild);
    bars.push(bar);
    buttons.push(btn);
  });

  /* --- one frame --- */
  var lastStep = -1;

  function render(t) {
    var i;

    // 1. the schedule comes due at the barn
    op(el.sched, fade(t, 0.2, 0.6, 4.4, 5));
    var ping = t < 1.6 ? 0 : ((t - 1.6) % 1.2) / 1.2;
    el.schedRing.setAttribute("r", (10 + 18 * ping).toFixed(1));
    op(el.schedRing, t < 1.6 ? 0 : 1 - ping);

    // 2. launch / landing ring at the barn dock, and the flight trails
    var dk = t < 12 ? prog(t, 4.6, 5.8) : prog(t, HOME[1] + 0.2, HOME[1] + 1.4);
    el.dockRing.setAttribute("r", (12 + 18 * dk).toFixed(1));
    op(el.dockRing, dk > 0 && dk < 1 ? 1 - dk : 0);
    el.pathOut.setAttribute("stroke-dashoffset", (lenOut * (1 - ease(prog(t, 5.6, 9.6)))).toFixed(1));
    op(el.pathOut, fade(t, 5.6, 5.8, 13, 14.5));
    el.pathHome.setAttribute("stroke-dashoffset", (lenHome * (1 - ease(prog(t, HOME[0], HOME[1])))).toFixed(1));
    op(el.pathHome, fade(t, HOME[0], HOME[0] + 0.2, HOME[1] + 0.6, HOME[1] + 1.4));

    // 3. thermal view: tint, the bedded herd, the sweep
    var d = droneAt(t);
    op(el.tint, 0.28 * fade(t, 9.4, 10.2, HOME[0], HOME[0] + 1.2));
    op(el.herd, fade(t, 10.2, 10.8, HOME[0] + 0.2, HOME[0] + 1.2));
    op(el.sweep, fade(t, 9.6, 10, 13, 13.6));
    move(el.sweep, d[0], d[1]);
    el.sweepCone.setAttribute("transform", "rotate(" + ((t * 200) % 360).toFixed(1) + ")");

    // 4. the heifer: found by the sweep, flashes on detection, then tagged
    var h = heiferAt(t);
    var flash = t > 10.8 ? 1 + 0.6 * (1 - prog(t, 10.8, 11.6)) : 1;
    move(el.heifer, h[0], h[1], " scale(" + flash.toFixed(3) + ")");
    op(el.heifer, fade(t, 10.8, 11.1, HOME[0] + 0.2, HOME[0] + 1.2));
    var snap = 1 + 0.6 * (1 - ease(prog(t, 13.6, 14.1)));
    move(el.tag, h[0], h[1], " scale(" + snap.toFixed(3) + ")");
    op(el.tag, fade(t, 13.6, 13.9, HOME[0] - 0.2, HOME[0] + 0.2));
    setText(el.tagText, t >= CALVED ? "CALVED · 2:31 AM" : "HEIFER · OFF ALONE");
    el.tether.setAttribute("x1", d[0].toFixed(1));
    el.tether.setAttribute("y1", d[1].toFixed(1));
    el.tether.setAttribute("x2", h[0].toFixed(1));
    el.tether.setAttribute("y2", h[1].toFixed(1));
    op(el.tether, 0.8 * fade(t, 14, 14.4, HOME[0] - 0.2, HOME[0] + 0.2));

    // the calf, while the drone holds over them
    var pop = 1 + 0.8 * (1 - ease(prog(t, CALVED, CALVED + 0.4)));
    move(el.calf, HEIFER[0] + CALF[0], HEIFER[1] + CALF[1], " scale(" + pop.toFixed(3) + ")");
    op(el.calf, fade(t, CALVED, CALVED + 0.2, HOME[0] + 0.2, HOME[0] + 1.2));

    // live thermal camera inset: her, restless, then the calf at her feet
    op(el.inset, fade(t, 14.2, 14.6, HOME[0] - 0.4, HOME[0]));
    var shift = Math.sin(t * 1.7) * 2.5 * (1 - prog(t, CALVED - 0.6, CALVED));
    move(el.insetCow, 520 + shift, 70);
    op(el.insetCalf, prog(t, CALVED, CALVED + 0.4));

    // 5. your pickup drives out from the barn, lights on
    var p = ease(prog(t, DRIVE[0], DRIVE[1]));
    var a = el.road.getPointAtLength(lenRoad * p);
    var b = el.road.getPointAtLength(Math.min(lenRoad, lenRoad * p + 2));
    var c = p >= 1 ? el.road.getPointAtLength(lenRoad - 2) : a;
    var dir = Math.atan2(b.y - c.y, b.x - c.x) * 180 / Math.PI;
    move(el.truck, a.x, a.y, " rotate(" + dir.toFixed(1) + ")");
    op(el.beam, fade(t, DRIVE[0] - 0.4, DRIVE[0], T - 1, T));

    // drone: grows and its shadow drifts as it climbs
    var alt = altitudeAt(t);
    move(el.drone, d[0], d[1], " scale(" + (0.8 + 0.25 * alt).toFixed(3) + ")");
    el.droneShadow.setAttribute("cx", (2 + 6 * alt).toFixed(1));
    el.droneShadow.setAttribute("cy", (3 + 8 * alt).toFixed(1));
    op(el.droneShadow, 0.45 - 0.15 * alt);

    // 6. phone alert, then the saved check
    el.alertCard.classList.toggle("is-shown", t >= 18.2 && t < 23.4);
    el.reportCard.classList.toggle("is-shown", t >= HOME[0] + 0.8);

    // HUD
    for (i = STATUS.length - 1; i > 0 && t < STATUS[i][0]; i--) { /* find current */ }
    setText(el.hudStatus, STATUS[i][1]);
    setText(el.hudSub, STATUS[i][2] !== null ? STATUS[i][2]
      : "Counting · " + Math.round(HERD * prog(t, 10.2, 12.8)) + " bedded, quiet");

    // steps
    for (i = STEPS.length - 1; i > 0 && t < STEPS[i]; i--) { /* find current */ }
    if (i !== lastStep) {
      items.forEach(function (li, k) {
        li.classList.toggle("is-active", k === i);
        if (k === i) { buttons[k].setAttribute("aria-current", "step"); }
        else { buttons[k].removeAttribute("aria-current"); bars[k].style.transform = "scaleX(0)"; }
      });
      lastStep = i;
    }
    var stepEnd = i + 1 < STEPS.length ? STEPS[i + 1] : T;
    bars[i].style.transform = "scaleX(" + prog(t, STEPS[i], stepEnd).toFixed(3) + ")";
  }

  /* --- playback --- */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var playing = !reduce;
  var onScreen = true;
  var t = reduce ? KEYS[3] : 0;
  var last = 0;
  var raf = 0;

  function frame(now) {
    raf = 0;
    if (!playing || !onScreen) { return; }
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    t += dt;
    if (t >= T) { t = 0; }
    render(t);
    raf = window.requestAnimationFrame(frame);
  }
  function start() {
    if (!raf && playing && onScreen) { last = 0; raf = window.requestAnimationFrame(frame); }
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
    }, { threshold: 0.15 }).observe(root.querySelector(".patrol__screen") || root);
  }

  root.classList.add("patrol--live");
  render(t);
  setPlaying(playing);
})();
