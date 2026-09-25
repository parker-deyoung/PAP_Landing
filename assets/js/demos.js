/* Arches Labs — records and guests demos (sections 6 and 7).
   Progressive enhancement only. Without this file each demo shows its finished state
   and every step's text. One small player (below) runs both: it loops a timeline,
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
})();
