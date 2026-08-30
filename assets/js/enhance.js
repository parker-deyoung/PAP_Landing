/* Arches Labs — progressive enhancement only.
   The page is fully usable with this file absent or blocked:
   every link works, and the form submits natively to its action endpoint.
   This script only: (1) re-syncs links from window.SITE_CONFIG,
   (2) tags the hidden `topic` field from the section CTA that was clicked,
   (3) upgrades the form submit to stay on-page with a real success/error state. */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $all = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* --- 1. Re-sync links from config (single source of truth for the JS path) --- */
  function syncLinks() {
    if (CFG.CAL_URL && CFG.CAL_URL.indexOf("REPLACE_ME") === -1) {
      $all("a[data-book]").forEach(function (a) {
        try {
          var old = new URL(a.getAttribute("href"), location.href);
          var next = new URL(CFG.CAL_URL);
          old.searchParams.forEach(function (v, k) { next.searchParams.set(k, v); });
          a.setAttribute("href", next.toString());
        } catch (e) { a.setAttribute("href", CFG.CAL_URL); }
      });
    }
    if (CFG.PHONE_TEL) {
      $all("a[data-tel]").forEach(function (a) { a.setAttribute("href", "tel:" + CFG.PHONE_TEL); });
    }
    if (CFG.EMAIL) {
      $all("a[data-email]").forEach(function (a) { a.setAttribute("href", "mailto:" + CFG.EMAIL); });
    }
  }

  /* --- 2. Topic tagging: which section's CTA sent them to the form --- */
  function wireTopic() {
    var topicField = $("#f-topic");
    $all("[data-topic]").forEach(function (el) {
      el.addEventListener("click", function () {
        var t = el.getAttribute("data-topic");
        if (topicField && t) { topicField.value = t; }
      });
    });
  }

  /* --- 3. Form submit upgrade --- */
  function wireForm() {
    var form = $("#contact-form");
    var status = $("#form-status");
    if (!form || !status) { return; }
    var phone = CFG.PHONE || "720-498-7552";

    form.addEventListener("submit", function (ev) {
      // honeypot: quietly stop bots without a scary message
      var hp = form.querySelector('input[name="company_url"]');
      if (hp && hp.value) { ev.preventDefault(); return; }

      var endpoint = form.getAttribute("action");
      if (CFG.FORM_ENDPOINT && CFG.FORM_ENDPOINT.indexOf("REPLACE_ME") === -1) {
        endpoint = CFG.FORM_ENDPOINT;
      }
      // No usable endpoint yet -> let the browser do its native thing.
      if (!endpoint || endpoint.indexOf("REPLACE_ME") !== -1) { return; }

      ev.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var email = (form.querySelector('#f-email') || {}).value || "";
      setStatus("", "Sending…");
      if (btn) { btn.disabled = true; }

      fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        headers: { "Accept": "application/json" }
      })
        .then(function (res) {
          if (!res.ok) { throw new Error("bad status " + res.status); }
          form.reset();
          setStatus("ok",
            "Thanks — we’ll email you" + (email ? " at " + email : "") +
            " within a day or two to set up a time.");
        })
        .catch(function () {
          setStatus("err",
            "That didn’t send — something went wrong on our end. " +
            "Call or text us at " + phone + " and we’ll take it from there.");
        })
        .finally(function () { if (btn) { btn.disabled = false; } });
    });

    function setStatus(kind, msg) {
      status.textContent = msg;
      status.className = "form-status" + (kind ? " form-status--" + kind : "");
    }
  }

  syncLinks();
  wireTopic();
  wireForm();
})();
