/* Arches Labs — the demos that share one player: records and guests (hunting page); cow
   records, grazing plan, temperature checks, and herding (cattle page). A scene whose
   markup isn't on the page is skipped.
   Progressive enhancement only. Without this file each demo shows its finished state
   and every step's text. One small player (below) runs them all: it loops a timeline,
   keeps the numbered steps in sync (the active step opens, its bar fills, clicking a
   step jumps to it), respects prefers-reduced-motion (starts paused on a still frame),
   and pauses while the demo is off-screen. Each scene only says what's on screen at
   time t. STEPS start times must line up with that demo's <li class="demo__step">s. */
(function () {
  "use strict";

  if (!window.requestAnimationFrame) { return; }

  /* --- helpers --- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function ease(p) { return p * p * (3 - 2 * p); }
  // fades in over a→b, out over c→d
  function fade(t, a, b, c, d) { return Math.min(prog(t, a, b), 1 - prog(t, c, d)); }
  function op(n, v) { n.setAttribute("opacity", clamp(v, 0, 1).toFixed(3)); }
  function show(n, on) { n.classList.toggle("is-shown", !!on); }
  function setText(n, s) { if (n.textContent !== s) { n.textContent = s; } }

  /* --- the player --- */
  function play(name, o) {
    var root = document.querySelector('[data-demo="' + name + '"]');
    if (!root) { return; }
    var el = {};
    Array.prototype.forEach.call(root.querySelectorAll("[data-el]"), function (n) {
      el[n.getAttribute("data-el")] = n;
    });
    if (o.setup && o.setup(el) === false) { return; }

    var items = Array.prototype.slice.call(root.querySelectorAll(".demo__step"));
    var bars = [];
    var buttons = [];
    items.forEach(function (li, i) {
      var h = li.querySelector(".demo__title");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "demo__step-btn";
      while (h.firstChild) { btn.appendChild(h.firstChild); }
      h.appendChild(btn);
      btn.addEventListener("click", function () { jump(i); });
      var bar = document.createElement("span");
      bar.className = "demo__progress";
      bar.setAttribute("aria-hidden", "true");
      li.insertBefore(bar, li.firstChild);
      bars.push(bar);
      buttons.push(btn);
    });

    var lastStep = -1;
    function render(t) {
      o.render(t, el);
      for (var i = o.STEPS.length - 1; i > 0 && t < o.STEPS[i]; i--) { /* find current */ }
      if (i !== lastStep) {
        items.forEach(function (li, k) {
          li.classList.toggle("is-active", k === i);
          if (k === i) { buttons[k].setAttribute("aria-current", "step"); }
          else { buttons[k].removeAttribute("aria-current"); bars[k].style.transform = "scaleX(0)"; }
        });
        lastStep = i;
      }
      var stepEnd = i + 1 < o.STEPS.length ? o.STEPS[i + 1] : o.T;
      if (bars[i]) { bars[i].style.transform = "scaleX(" + prog(t, o.STEPS[i], stepEnd).toFixed(3) + ")"; }
    }

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var playing = !reduce;
    var onScreen = true;
    var t = reduce ? o.KEYS[o.KEYS.length - 1] : 0;
    var last = 0;
    var raf = 0;

    function frame(now) {
      raf = 0;
      if (!playing || !onScreen) { return; }
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      t += dt;
      if (t >= o.T) { t = 0; }
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
      t = playing ? o.STEPS[i] : o.KEYS[i];
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
      }, { threshold: 0.15 }).observe(root.querySelector("figure") || root);
    }

    root.classList.add("demo--live");
    render(t);
    setPlaying(playing);
  }

  /* --- records: a trail-cam photo is matched to Buck 14, his record fills in, then harvest --- */
  var lineLen = 0, lineHead = 0;
  play("records", {
    T: 21,
    STEPS: [0, 7, 13],
    KEYS: [5.8, 11.5, 20.5],
    setup: function (el) {
      if (typeof el.line.getTotalLength !== "function") { return false; }
      lineLen = el.line.getTotalLength();
      lineHead = lineLen * 2 / 3;  // 2022 to 2024 (the three segments are about equal); 2025 draws in during step 2
      el.line.setAttribute("stroke-dasharray", lineLen.toFixed(1) + " " + lineLen.toFixed(1));
    },
    render: function (t, el) {
      // 1. the photo comes in and is matched, then confirmed
      show(el.inbox, t >= 0.6);
      var confirmed = t >= 4.5;
      setText(el.matchText, t < 2.2 ? "Checking your herd…" : confirmed ? "Matched to Buck 14" : "Looks like Buck 14");
      setText(el.confirm, confirmed ? "Confirmed ✓" : "Confirm");
      el.confirm.classList.toggle("is-done", confirmed);
      el.confirm.classList.toggle("is-pressed", t >= 4.2 && !confirmed);
      var logged = t >= 5.2;
      setText(el.sightings, logged ? "24" : "23");
      setText(el.seen, logged ? "Oct 3, Cam 6" : "Sep 25, survey");
      el.sightings.classList.toggle("is-new", t >= 5.2 && t < 7.4);
      el.seen.classList.toggle("is-new", t >= 5.2 && t < 7.4);

      // 2. this year's score estimate joins the chart
      var grow = ease(prog(t, 7.6, 9));
      el.line.setAttribute("stroke-dashoffset", (lineLen - (lineHead + (lineLen - lineHead) * grow)).toFixed(1));
      op(el.lastDot, prog(t, 8.9, 9.1));
      op(el.lastVal, prog(t, 9.1, 9.5));

      // 3. harvest, herd count, state report
      el.status.classList.toggle("is-harvested", t >= 13.8);
      setText(el.status, t >= 13.8 ? "Harvested" : "Mature buck");
      show(el.harvest, t >= 13.6);
      show(el.chip1, t >= 15.2);
      show(el.chip2, t >= 16.6);
    }
  });

  /* --- guests: a request lands on the one free guide and cabin, and the client is remembered --- */
  play("guests", {
    T: 20,
    STEPS: [0, 6, 12],
    KEYS: [4, 10.5, 19],
    render: function (t, el) {
      show(el.request, t >= 0.6);
      show(el.hl, t >= 2.4 && t < 12);
      el.ray.classList.toggle("is-free", t >= 6.2 && t < 12);
      el.cab2.classList.toggle("is-free", t >= 7.8 && t < 12);
      show(el.newGuide, t >= 7);
      show(el.newCabin, t >= 8.4);
      show(el.client, t >= 12.6);
      show(el.sent, t >= 15.4);
    }
  });

  /* --- cattle records: a new calf is paired to Cow 9626, her record fills in, then preg check --- */
  var cowLen = 0, cowHead = 0;
  play("cow", {
    T: 21,
    STEPS: [0, 7, 13],
    KEYS: [5.8, 11.5, 20.5],
    setup: function (el) {
      if (typeof el.line.getTotalLength !== "function") { return false; }
      cowLen = el.line.getTotalLength();
      cowHead = cowLen * 2 / 3;   // 2022 to 2024; this year's calf draws in during step 2
      el.line.setAttribute("stroke-dasharray", cowLen.toFixed(1) + " " + cowLen.toFixed(1));
    },
    render: function (t, el) {
      // 1. the calf's tag comes in and is paired to his mother, then confirmed
      show(el.inbox, t >= 0.6);
      var confirmed = t >= 4.5;
      setText(el.matchText, t < 2.2 ? "Finding his mother…" : confirmed ? "Paired with Cow 9626" : "Looks like Cow 9626");
      setText(el.confirm, confirmed ? "Confirmed ✓" : "Confirm");
      el.confirm.classList.toggle("is-done", confirmed);
      el.confirm.classList.toggle("is-pressed", t >= 4.2 && !confirmed);
      var logged = t >= 5.2;
      setText(el.calves, logged ? "6" : "5");
      setText(el.calved, logged ? "Mar 14" : "Mar 2024");
      el.calves.classList.toggle("is-new", t >= 5.2 && t < 7.4);
      el.calved.classList.toggle("is-new", t >= 5.2 && t < 7.4);

      // 2. this year's weaning weight joins the chart
      var grow = ease(prog(t, 7.6, 9));
      el.line.setAttribute("stroke-dashoffset", (cowLen - (cowHead + (cowLen - cowHead) * grow)).toFixed(1));
      op(el.lastDot, prog(t, 8.9, 9.1));
      op(el.lastVal, prog(t, 9.1, 9.5));

      // 3. preg check, her rank in the herd, the buyer's paperwork
      el.status.classList.toggle("is-harvested", t >= 13.8);
      setText(el.status, t >= 13.8 ? "Bred" : "With calf");
      show(el.preg, t >= 13.6);
      show(el.chip1, t >= 15.2);
      show(el.chip2, t >= 16.6);
    }
  });

  /* --- grazing: a move comes due, rested grass lights up, and the crew gets the plan --- */
  play("grazing", {
    T: 20,
    STEPS: [0, 6, 12],
    KEYS: [4, 10.5, 19],
    render: function (t, el) {
      show(el.request, t >= 0.6);
      show(el.hl, t >= 2.4 && t < 12);
      el.east.classList.toggle("is-free", t >= 6.2 && t < 12);
      show(el.newMove, t >= 7);
      show(el.newRest, t >= 8.4);
      show(el.note, t >= 12.6);
      show(el.sent, t >= 15.4);
    }
  });

  /* --- temperature checks: a thermal pass reads each calf against the group; one runs warm,
     is flagged, treated, and rechecked --- */
  var calves = [];
  play("temps", {
    T: 20,
    STEPS: [0, 7, 13],
    KEYS: [5.6, 11, 19.5],
    setup: function (el) {
      calves = Array.prototype.map.call(el.herd.querySelectorAll(".tc-a"), function (g) {
        var m = /translate\(\s*([\d.]+)/.exec(g.getAttribute("transform")) || [0, 0];
        return { node: g, x: +m[1] };
      });
    },
    render: function (t, el) {
      // 1. the scan line crosses the group; each calf brightens as it's read
      var sx = 320 * prog(t, 0.6, 6);
      el.scan.setAttribute("transform", "translate(" + sx.toFixed(1) + " 0)");
      op(el.scan, fade(t, 0.4, 0.6, 6, 6.4));
      var n = 0;
      calves.forEach(function (c) {
        var read = t >= 0.6 && sx >= c.x;
        show(c.node, read);
        if (read) { n++; }
      });
      var done = t >= 6.2;
      el.card.classList.toggle("is-scanning", t >= 0.6 && !done);
      setText(el.pill, done ? "Done" : t >= 0.6 ? "Scanning" : "Ready");
      setText(el.clock, "7:0" + Math.min(6, 1 + Math.floor(t * 0.8)) + " AM");
      setText(el.readNum, String(n));
      setText(el.readNote, done ? "of " + calves.length + " · one pass" : "of " + calves.length + " · reading");
      show(el.wait, !done);
      show(el.rows, done);

      // 2. the one running warm is flagged
      var flagged = t >= 7.2;
      el.card.classList.toggle("is-flagged", flagged);
      el.warm.classList.toggle("is-flagged", flagged);
      setText(el.warmNum, flagged ? "1" : "0");
      setText(el.warmNote, flagged ? "pull for a look" : "none yet");
      el.t1.classList.toggle("is-done", flagged);

      // 3. treated that morning; Thursday's flight finds it back with the group
      el.t2.classList.toggle("is-done", t >= 13.8);
      el.t3.classList.toggle("is-done", t >= 16);
    }
  });

  /* --- herding: the drone works a pasture from behind and counts every head through the gate.
     Pairs bunch into a funnel of slots in front of the gate, closest first, and file through
     one at a time; the pair hung up in the brush waits until the drone goes back for it. --- */
  var GATE = [342, 109], BARN = [70, 378], CALF_X = -8, FENCE_X = 331;
  var queue = [], stray = null, headTotal = 0;
  function lerp2(a, b, p) { return [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p]; }
  function slot(k) {
    var r = Math.floor(k / 2);
    return [312 - r * 16, 109 + (k % 2 ? 9 : -9) + (r % 2 ? 4 : 0)];
  }
  function queuedAt(t, p) {
    if (t < p.pass) {
      if (t < 9.6) { return lerp2(p.from, slot(p.k), ease(prog(t, 4.8 + (p.k % 3) * 0.4, 9.6))); }
      var q = Math.max(0, p.k - Math.max(0, t - 10) / 0.4);   // slots move up as the front pairs go through
      return lerp2(slot(Math.floor(q)), slot(Math.ceil(q)), q - Math.floor(q));
    }
    if (t < p.pass + 0.35) { return lerp2(slot(0), GATE, prog(t, p.pass, p.pass + 0.35)); }
    return lerp2(GATE, p.to, ease(prog(t, p.pass + 0.35, p.pass + 2)));
  }
  function strayAt(t, p) {
    if (t < 15.2) { return p.from; }
    if (t < 17.4) { return lerp2(p.from, slot(0), ease(prog(t, 15.2, 17.4))); }
    if (t < 17.75) { return lerp2(slot(0), GATE, prog(t, 17.4, 17.75)); }
    return lerp2(GATE, p.to, ease(prog(t, 17.75, 19.4)));
  }
  // behind the queue, swinging side to side
  function behindQueue(t) {
    var base = lerp2([200, 172], [262, 140], prog(t, 9.6, 13.2));
    var s = Math.sin((t - 9.6) * 2.2) * 26;
    return [base[0] + 0.49 * s, base[1] + 0.872 * s];
  }
  function herdDroneAt(t) {
    if (t < 1.4) { return BARN; }
    if (t < 4) { return lerp2(BARN, [40, 262], ease(prog(t, 1.4, 4))); }
    if (t < 9.6) {
      // sweep in from the far side of the pasture, side to side, narrowing as they bunch
      var p = prog(t, 4, 9.6);
      var base = lerp2([40, 262], [200, 172], ease(p));
      var s = Math.sin(p * Math.PI * 3) * 90 * (1 - 0.6 * p);
      return [base[0] + 0.49 * s, base[1] + 0.872 * s];
    }
    if (t < 13.2) { return behindQueue(t); }
    if (t < 15) { return lerp2(behindQueue(13.2), [70, 318], ease(prog(t, 13.2, 15))); }
    var follow = function (u) { var a = strayAt(u, stray); return [a[0] - 30, a[1] + 26]; };
    if (t < 17.4) { return follow(t); }
    if (t < 18.6) { return lerp2(follow(17.4), [292, 150], ease(prog(t, 17.4, 18.6))); }
    if (t < 21.4) { return lerp2([292, 150], BARN, ease(prog(t, 18.6, 21.4))); }
    return BARN;
  }
  function herdAltitude(t) {
    if (t < 1) { return 0; }
    if (t < 1.4) { return ease(prog(t, 1, 1.4)); }
    if (t < 21.4) { return 1; }
    return 1 - ease(prog(t, 21.4, 22));
  }
  var HERD_STATUS = [
    [0, "Move planned", "Creek to East · north gate open"],
    [1.4, "Drone heading out", "Getting behind the herd"],
    [4, "Gathering", "Working them from behind, slow"],
    [10, "Through the gate", null],            // null: the sub line is the gate count
    [13.2, "1 pair hung up in the brush", "Going back for them"],
    [17.4, "Through the gate", null],
    [19.6, "Move done · 7:52 AM", null]
  ];
  play("herding", {
    T: 24,
    STEPS: [0, 4, 10, 13.2],
    KEYS: [3, 8.5, 12, 23.5],
    setup: function (el) {
      var all = Array.prototype.map.call(el.herd.querySelectorAll(".hd-pair"), function (g) {
        var to = /translate\(\s*([\d.]+)[ ,]+([\d.]+)/.exec(g.getAttribute("transform")) || [0, 0, 0];
        var from = g.getAttribute("data-from").split(" ");
        return { node: g, from: [+from[0], +from[1]], to: [+to[1], +to[2]], stray: g.hasAttribute("data-stray") };
      });
      stray = all.filter(function (p) { return p.stray; })[0];
      queue = all.filter(function (p) { return !p.stray; }).sort(function (a, b) {
        return Math.hypot(a.from[0] - GATE[0], a.from[1] - GATE[1]) - Math.hypot(b.from[0] - GATE[0], b.from[1] - GATE[1]);
      });
      queue.forEach(function (p, k) { p.k = k; p.pass = 10 + 0.4 * k; });
      headTotal = all.length * 2;
    },
    render: function (t, el) {
      // the pairs, and the count at the gate (a cow or calf is through once it's east of the fence)
      var through = 0;
      queue.concat(stray).forEach(function (p) {
        var at = p.stray ? strayAt(t, p) : queuedAt(t, p);
        p.node.setAttribute("transform", "translate(" + at[0].toFixed(1) + " " + at[1].toFixed(1) + ")");
        if (at[0] > FENCE_X) { through++; }
        if (at[0] + CALF_X > FENCE_X) { through++; }
      });

      // the drone: grows and its shadow drifts as it climbs; pulses while it's working them
      var d = herdDroneAt(t);
      var alt = herdAltitude(t);
      el.drone.setAttribute("transform", "translate(" + d[0].toFixed(1) + " " + d[1].toFixed(1) +
        ") scale(" + (0.8 + 0.25 * alt).toFixed(3) + ")");
      el.droneShadow.setAttribute("cx", (2 + 6 * alt).toFixed(1));
      el.droneShadow.setAttribute("cy", (3 + 8 * alt).toFixed(1));
      op(el.droneShadow, 0.2 - 0.08 * alt);
      var beat = (t * 1.1) % 1;
      el.push.setAttribute("cx", d[0].toFixed(1));
      el.push.setAttribute("cy", d[1].toFixed(1));
      el.push.setAttribute("r", (12 + 18 * beat).toFixed(1));
      op(el.push, 0.6 * (1 - beat) * fade(t, 4, 4.3, 17.6, 18));
      var dk = t < 12 ? prog(t, 1, 2.2) : prog(t, 21.6, 22.8);
      el.dockRing.setAttribute("r", (12 + 18 * dk).toFixed(1));
      op(el.dockRing, dk > 0 && dk < 1 ? 1 - dk : 0);

      // status, and the card once everyone's through
      for (var i = HERD_STATUS.length - 1; i > 0 && t < HERD_STATUS[i][0]; i--) { /* find current */ }
      setText(el.status, HERD_STATUS[i][1]);
      setText(el.statusSub, HERD_STATUS[i][2] !== null ? HERD_STATUS[i][2]
        : through + " of " + headTotal + " head counted through");
      show(el.card, t >= 20);
    }
  });
})();
