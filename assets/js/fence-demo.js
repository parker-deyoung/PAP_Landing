/* Arches Labs — fences section fence-check demo (section 5).
   Progressive enhancement only. Without this file the SVG map and the phone show the
   finished check (whole line checked, both breaks pinned and listed) and every step's text.
   This script plays one 30-second loop: the drone leaves the barn and follows the fence,
   holds over each break while its photo comes up, the phone gets an alert, the drone
   flies home, and later that morning the downed section is marked fixed.
   STEPS start times must line up with the four <li class="fence__step"> in order.
   Respects prefers-reduced-motion (starts paused on a still frame) and pauses itself
   while the demo is scrolled off-screen. */
(function () {
  "use strict";

  var root = document.querySelector("[data-fence]");
  if (!root || !window.requestAnimationFrame) { return; }

  var el = {};
  Array.prototype.forEach.call(root.querySelectorAll("[data-el]"), function (n) {
    el[n.getAttribute("data-el")] = n;
  });
  if (!el.checked || typeof el.checked.getTotalLength !== "function") { return; }

  var T = 30;
  var STEPS = [0, 10.8, 13.8, 22.4];
  var KEYS = [7, 12.4, 15.2, 28.5];   // still frame per step when paused
  var BARN = [110, 356];
  var MILES = 11.6;
  var LANDED = 23.4;
  var LATER = 25.5;                   // the phone jumps ahead to late morning
  var FIXED = 26.5;
  // fence legs [start, end, from, to] as fractions of the fence; the drone holds over
  // each find in the gaps between legs. The finds' fractions come from the pins below.
  var HOLDS = [[10.8, 13.8], [17.7, 19.2]];
  var NOTES = [
    [13.9, 17.2, "Fence down on the East line", "About 40 ft of wire under a fallen tree. Tap for directions."],
    [19.3, 22, "Washout at the creek crossing", "A gap under the bottom wire on the south line. Tap for the photo."]
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
  function setText(n, s) { if (n && n.textContent !== s) { n.textContent = s; } }
  // demo clock: the check runs from 7:02 in the morning, a minute a second
  function clock(t) {
    var m = t >= LATER ? 11 * 60 + 40 + Math.floor(t - LATER) : 422 + Math.floor(t);
    return Math.floor(m / 60) + ":" + ("0" + (m % 60)).slice(-2);
  }

  function prep(path) {
    var len = path.getTotalLength();
    path.setAttribute("stroke-dasharray", len.toFixed(1) + " " + len.toFixed(1));
    return len;
  }
  var lenFence = prep(el.checked);
  var lenLeg = prep(el.leg);
  function along(path, len, p) { var pt = path.getPointAtLength(len * p); return [pt.x, pt.y]; }

  // where along the fence a pin sits (0..1)
  function pinAt(pin) {
    var m = /translate\(\s*([\d.]+)[ ,]+([\d.]+)/.exec(pin.getAttribute("transform")) || [0, 0, 0];
    var x = +m[1], y = +m[2], best = Infinity, at = 0;
    for (var s = 0; s <= lenFence; s += 2) {
      var pt = el.checked.getPointAtLength(s);
      var d = (pt.x - x) * (pt.x - x) + (pt.y - y) * (pt.y - y);
      if (d < best) { best = d; at = s / lenFence; }
    }
    return { x: x, y: y, at: at };
  }
  var pin1 = pinAt(el.pin1);
  var pin2 = pinAt(el.pin2);
  var LEGS = [[3, HOLDS[0][0], 0, pin1.at], [HOLDS[0][1], HOLDS[1][0], pin1.at, pin2.at], [HOLDS[1][1], 21.9, pin2.at, 1]];

  function fenceAt(t) {
    for (var i = 0; i < LEGS.length; i++) {
      if (t < LEGS[i][0]) { return LEGS[i][2]; }   // on the ground, or holding over a find
      if (t <= LEGS[i][1]) { return mix(LEGS[i][2], LEGS[i][3], prog(t, LEGS[i][0], LEGS[i][1])); }
    }
    return 1;
  }
  function hover(t) {
    return Math.max(fade(t, HOLDS[0][0], HOLDS[0][0] + 0.4, HOLDS[0][1] - 0.4, HOLDS[0][1]),
                    fade(t, HOLDS[1][0], HOLDS[1][0] + 0.4, HOLDS[1][1] - 0.4, HOLDS[1][1]));
  }

  function droneAt(t) {
    if (t < 1.4) { return BARN; }
    if (t < 3) { return along(el.leg, lenLeg, ease(prog(t, 1.4, 3))); }
    if (t < 21.9) {
      var pt = along(el.checked, lenFence, fenceAt(t));
      var h = 4 * hover(t);   // a slow circle while it looks the break over
      return [pt[0] + Math.sin(t * 2.2) * h, pt[1] + Math.cos(t * 2.2) * h];
    }
    if (t < LANDED) { return along(el.leg, lenLeg, 1 - ease(prog(t, 21.9, LANDED))); }
    return BARN;
  }

  function altitudeAt(t) {
    if (t < 1.1) { return 0; }
    if (t < 1.7) { return ease(prog(t, 1.1, 1.7)); }
    if (t < LANDED) { return 1; }
    return 1 - ease(prog(t, LANDED, LANDED + 0.6));
  }

  /* --- steps list: turn each title into a button + progress bar --- */
  var items = Array.prototype.slice.call(root.querySelectorAll(".fence__step"));
  var bars = [];
  var buttons = [];
  items.forEach(function (li, i) {
    var h = li.querySelector(".fence__title");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fence__step-btn";
    while (h.firstChild) { btn.appendChild(h.firstChild); }
    h.appendChild(btn);
    btn.addEventListener("click", function () { jump(i); });
    var bar = document.createElement("span");
    bar.className = "fence__progress";
    bar.setAttribute("aria-hidden", "true");
    li.insertBefore(bar, li.firstChild);
    bars.push(bar);
    buttons.push(btn);
  });

  var find1Text = el.find1Text.textContent;

  /* --- one frame --- */
  var lastStep = -1;
  var lastNote = -2;

  function render(t) {
    var i;
    var f = fenceAt(t);
    var d = droneAt(t);

    // 1. the checked stretch of fence (hidden outright at zero, like the survey swath)
    el.checked.setAttribute("stroke-dashoffset", (lenFence * (1 - f)).toFixed(1));
    el.checked.style.visibility = f > 0 ? "" : "hidden";

    // barn dock ring, and the short leg out to the fence and back
    var dk = t < 12 ? prog(t, 1.1, 2.3) : prog(t, LANDED, LANDED + 1.2);
    el.dockRing.setAttribute("r", (12 + 18 * dk).toFixed(1));
    op(el.dockRing, dk > 0 && dk < 1 ? 1 - dk : 0);
    if (t < 12) {
      el.leg.setAttribute("stroke-dashoffset", (lenLeg * (1 - ease(prog(t, 1.4, 3)))).toFixed(1));
      op(el.leg, fade(t, 1.4, 1.5, 3, 3.8));
    } else {
      el.leg.setAttribute("stroke-dashoffset", (-lenLeg * (1 - ease(prog(t, 21.9, LANDED)))).toFixed(1));
      op(el.leg, fade(t, 21.9, 22, 24, 25));
    }

    // 2. each find: the pin drops, and the camera's photo comes up beside it
    var fixed = t >= FIXED;
    var drop1 = 1 - ease(prog(t, 11, 11.35));
    var pop1 = fixed ? 1 + 0.5 * (1 - ease(prog(t, FIXED, FIXED + 0.35))) : 1;
    move(el.pin1, pin1.x, pin1.y - 14 * drop1, " scale(" + pop1.toFixed(3) + ")");
    op(el.pin1, prog(t, 11, 11.15));
    op(el.pin1Alert, fixed ? 0 : 1);
    op(el.pin1Fixed, fixed ? 1 : 0);
    op(el.pin1Label, prog(t, 15.5, 15.9));   // after its photo closes; the photo covers it
    setText(el.pin1Label, fixed ? "FIXED" : "WIRE DOWN");
    move(el.pin2, pin2.x, pin2.y - 14 * (1 - ease(prog(t, 17.8, 18.15))));
    op(el.pin2, prog(t, 17.8, 17.95));
    op(el.pin2Label, prog(t, 18, 18.4));
    op(el.call1, fade(t, 11.2, 11.6, 15.4, 15.9));
    op(el.call2, fade(t, 17.9, 18.3, 20.9, 21.4));

    // the camera's view around the drone while it's on the fence
    op(el.scan, fade(t, 2.8, 3.1, 21.8, 22.1));
    el.scan.setAttribute("cx", d[0].toFixed(1));
    el.scan.setAttribute("cy", d[1].toFixed(1));
    el.scan.setAttribute("r", (22 + 5 * hover(t)).toFixed(1));

    // drone: grows and its shadow drifts as it climbs
    var alt = altitudeAt(t);
    move(el.drone, d[0], d[1], " scale(" + (0.8 + 0.25 * alt).toFixed(3) + ")");
    el.droneShadow.setAttribute("cx", (2 + 6 * alt).toFixed(1));
    el.droneShadow.setAttribute("cy", (3 + 8 * alt).toFixed(1));
    op(el.droneShadow, 0.2 - 0.08 * alt);

    /* --- 3. the phone --- */
    setText(el.phoneTime, clock(t));
    setText(el.phoneSub, t < 1.1 ? "Starting · after last night's wind"
      : t < LANDED ? "Checking now · after last night's wind"
      : "Done " + clock(LANDED) + " AM · after last night's wind");
    setText(el.miles, (f * MILES).toFixed(1) + " of " + MILES + " mi");
    el.milesBar.style.setProperty("--v", f.toFixed(3));

    var found1 = t >= 11.4, found2 = t >= 18.1;
    el.find1.classList.toggle("is-found", found1);
    el.find2.classList.toggle("is-found", found2);
    var open = (found1 && !fixed ? 1 : 0) + (found2 ? 1 : 0);
    setText(el.findLabel, !found1 ? (t < 3 ? "Nothing found yet" : "Nothing found yet · so far so good")
      : (open === 1 ? "1 spot needs work" : open + " spots need work") + (fixed ? " · 1 fixed" : ""));
    el.okLine.style.visibility = t >= LANDED ? "" : "hidden";

    // 4. later that morning: the downed section is marked fixed
    el.fix1.classList.toggle("is-pressed", t >= FIXED - 0.35 && t < FIXED + 0.3);
    setText(el.fix1, fixed ? "Fixed ✓" : "Mark fixed");
    setText(el.badge1, fixed ? "Fixed" : "Fence down");
    el.badge1.classList.toggle("fp-badge--down", !fixed);
    el.badge1.classList.toggle("fp-badge--fixed", fixed);
    setText(el.find1Text, fixed ? "Fixed at " + clock(FIXED) + " AM. The next check will make sure it held." : find1Text);

    // phone alerts
    for (i = NOTES.length - 1; i >= 0 && !(t >= NOTES[i][0] && t < NOTES[i][1]); i--) { /* find current */ }
    if (i !== lastNote) {
      if (i >= 0) {
        setText(el.notifTitle, NOTES[i][2]);
        setText(el.notifText, NOTES[i][3]);
      }
      el.notif.classList.toggle("is-shown", i >= 0);
      lastNote = i;
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
  var t = reduce ? KEYS[2] : 0;
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
    }, { threshold: 0.15 }).observe(root.querySelector(".fence__scene") || root);
  }

  root.classList.add("fence--live");
  render(t);
  setPlaying(playing);
})();
