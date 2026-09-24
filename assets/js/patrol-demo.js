/* Arches Labs — security section patrol demo (section 4).
   Progressive enhancement only. Without this file the inline SVG shows one static
   frame (poacher tagged, alert sent) and every step's text is visible.
   This script plays the SVG on one 30-second loop and keeps the six steps in sync:
   the active step opens, its bar fills, and clicking a step jumps to it.
   STEPS start times must line up with the six <li class="patrol__step"> in order.
   Respects prefers-reduced-motion (starts paused on a still frame) and pauses
   itself while the demo is scrolled off-screen. */
(function () {
  "use strict";

  var root = document.querySelector("[data-patrol]");
  if (!root || !window.requestAnimationFrame) { return; }

  var el = {};
  Array.prototype.forEach.call(root.querySelectorAll("[data-el]"), function (n) {
    el[n.getAttribute("data-el")] = n;
  });
  if (!el.pathOut || typeof el.pathOut.getTotalLength !== "function") { return; }

  var T = 30;
  var STEPS = [0, 4.6, 9.6, 13.5, 18, 23];
  var KEYS = [2.8, 7.8, 12.2, 16, 20.5, 29.8]; // still frame per step when paused
  var BARN = [140, 297];
  var FOLLOW = [-28, -40];                     // drone holds up-and-back of the person

  var STATUS = [
    [0, "Patrol armed", "Geofence active · 11:41 PM"],
    [1.6, "Motion on the east fence", "Trail cam 4 · 11:42 PM"],
    [4.6, "Drone launched", "Barn dock to east pasture"],
    [9.6, "Thermal sweep", "120 ft · thermal camera"],
    [13.5, "Person tagged", "Not on today's guest list"],
    [18, "Alert sent to your phone", "Tracking · holding back"],
    [23.2, "Left the property", "East fence · 11:47 PM"],
    [24.8, "Returning to barn", "Video, photos, track saved"],
    [29.3, "Docked and charging", "Incident report ready"]
  ];

  // Poacher route [time, x, y]. Hidden on the map until the thermal sweep finds them.
  var WALK = [
    [0, 618, 250], [1, 618, 250], [1.8, 582, 246], [4.6, 560, 244], [9.6, 524, 238],
    [13.5, 512, 236], [18, 506, 232], [23, 584, 248], [24.4, 612, 248]
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

  var lenOut = el.pathOut.getTotalLength();
  var lenHome = el.pathHome.getTotalLength();
  el.pathOut.setAttribute("stroke-dasharray", lenOut.toFixed(1));
  el.pathHome.setAttribute("stroke-dasharray", lenHome.toFixed(1));
  function along(path, len, p) { var pt = path.getPointAtLength(len * p); return [pt.x, pt.y]; }

  function walkAt(t) {
    for (var i = 1; i < WALK.length; i++) {
      if (t <= WALK[i][0]) {
        var p = prog(t, WALK[i - 1][0], WALK[i][0]);
        return [mix(WALK[i - 1][1], WALK[i][1], p), mix(WALK[i - 1][2], WALK[i][2], p)];
      }
    }
    var end = WALK[WALK.length - 1];
    return [end[1], end[2]];
  }

  function droneAt(t) {
    if (t < 5.6) { return BARN; }
    if (t < 9.6) { return along(el.pathOut, lenOut, ease(prog(t, 5.6, 9.6))); }
    if (t < 13.5) { return [470 + Math.sin(t * 1.3) * 2, 222 + Math.cos(t * 1.1) * 2]; }
    if (t < 23) {
      var w = walkAt(t);
      var target = [w[0] + FOLLOW[0], w[1] + FOLLOW[1]];
      if (t >= 15) { return target; }
      var p = ease(prog(t, 13.5, 15));
      return [mix(470, target[0], p), mix(222, target[1], p)];
    }
    if (t < 24.8) {
      // hold on the fence line while they get back in the truck
      var a = walkAt(23);
      var q = ease(prog(t, 23, 24));
      return [mix(a[0] + FOLLOW[0], 556, q), mix(a[1] + FOLLOW[1], 206, q)];
    }
    if (t < 28.6) { return along(el.pathHome, lenHome, ease(prog(t, 24.8, 28.6))); }
    return BARN;
  }

  function altitudeAt(t) {
    if (t < 4.8) { return 0; }
    if (t < 5.6) { return ease(prog(t, 4.8, 5.6)); }
    if (t < 28.6) { return 1; }
    return 1 - ease(prog(t, 28.6, 29.4));
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
  var lastStatus = -1;

  function render(t) {
    var i;

    // 1. fence trip + motion ping
    op(el.fenceHit, fade(t, 1.6, 1.9, 4.2, 5) * (0.55 + 0.45 * Math.sin(t * 9)));
    var ping = t < 1.6 ? 0 : ((t - 1.6) % 1.2) / 1.2;
    op(el.ping, fade(t, 1.6, 1.8, 4.4, 5));
    el.pingRing.setAttribute("r", (6 + 20 * ping).toFixed(1));
    op(el.pingRing, 1 - ping);

    // truck pulls up on the county road, then leaves north at the end
    var ty = t < 1 ? mix(470, 244, ease(prog(t, 0, 1)))
      : t < 24.6 ? 244 : mix(244, -40, ease(prog(t, 24.6, 27.2)));
    move(el.truck, 628 - 17 * (ty + 10) / 440, ty, " rotate(2)");

    // 2. launch / landing ring at the barn dock
    var dk = t < 12 ? prog(t, 4.6, 5.8) : prog(t, 28.8, 30);
    el.dockRing.setAttribute("r", (12 + 18 * dk).toFixed(1));
    op(el.dockRing, dk > 0 && dk < 1 ? 1 - dk : 0);

    // flight trails
    el.pathOut.setAttribute("stroke-dashoffset", (lenOut * (1 - ease(prog(t, 5.6, 9.6)))).toFixed(1));
    op(el.pathOut, fade(t, 5.6, 5.8, 13, 14.5));
    el.pathHome.setAttribute("stroke-dashoffset", (lenHome * (1 - ease(prog(t, 24.8, 28.6)))).toFixed(1));
    op(el.pathHome, fade(t, 24.8, 25, 29.2, 30));

    // 3. thermal view: tint, deer, sweep
    var d = droneAt(t);
    op(el.tint, 0.28 * fade(t, 9.4, 10.2, 24.8, 26));
    op(el.deer, fade(t, 10.2, 10.8, 25, 26));
    var spook = ease(prog(t, 16, 20));
    move(el.deer, -14 * spook, -10 * spook);
    op(el.sweep, fade(t, 9.6, 10, 13, 13.6));
    move(el.sweep, d[0], d[1]);
    el.sweepCone.setAttribute("transform", "rotate(" + ((t * 200) % 360).toFixed(1) + ")");

    // the person: found by the sweep, flashes on detection
    var w = walkAt(t);
    var flash = t > 10.8 ? 1 + 0.7 * (1 - prog(t, 10.8, 11.6)) : 1;
    move(el.person, w[0], w[1], " scale(" + flash.toFixed(3) + ")");
    op(el.person, fade(t, 10.8, 11.1, 24.1, 24.4));

    // 4. tag, tether, track
    var snap = 1 + 0.6 * (1 - ease(prog(t, 13.6, 14.1)));
    move(el.tag, w[0], w[1], " scale(" + snap.toFixed(3) + ")");
    op(el.tag, fade(t, 13.6, 13.9, 24, 24.4));
    el.tether.setAttribute("x1", d[0].toFixed(1));
    el.tether.setAttribute("y1", d[1].toFixed(1));
    el.tether.setAttribute("x2", w[0].toFixed(1));
    el.tether.setAttribute("y2", w[1].toFixed(1));
    op(el.tether, 0.8 * fade(t, 14, 14.4, 23, 23.6));
    var pts = [];
    if (t > 13.5) {
      for (var s = 13.5, end = Math.min(t, 24.4); s <= end; s += 0.3) {
        var p = walkAt(s);
        pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
      }
      pts.push(w[0].toFixed(1) + "," + w[1].toFixed(1));
    }
    el.trail.setAttribute("points", pts.join(" "));
    op(el.trail, fade(t, 13.5, 14, 25, 26));

    op(el.inset, fade(t, 14.2, 14.6, 22.8, 23.2));
    move(el.insetFigure, 566 + Math.sin(t * 5) * 1.5, 16 - Math.abs(Math.sin(t * 5)) * 1.2, " scale(0.85)");

    // drone: grows and its shadow drifts as it climbs
    var alt = altitudeAt(t);
    move(el.drone, d[0], d[1], " scale(" + (0.8 + 0.25 * alt).toFixed(3) + ")");
    el.droneShadow.setAttribute("cx", (2 + 6 * alt).toFixed(1));
    el.droneShadow.setAttribute("cy", (3 + 8 * alt).toFixed(1));
    op(el.droneShadow, 0.45 - 0.15 * alt);

    // 5. phone alert, 6. saved report
    el.alertCard.classList.toggle("is-shown", t >= 18.2 && t < 23.4);
    el.reportCard.classList.toggle("is-shown", t >= 25.6);

    // HUD
    for (i = STATUS.length - 1; i > 0 && t < STATUS[i][0]; i--) { /* find current */ }
    if (i !== lastStatus) {
      el.hudStatus.textContent = STATUS[i][1];
      el.hudSub.textContent = STATUS[i][2];
      lastStatus = i;
    }

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
