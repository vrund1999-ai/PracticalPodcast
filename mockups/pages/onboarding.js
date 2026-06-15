/* Onboarding page: pick topics (>=3) and save. */
(function () {
  "use strict";
  var PP = window.PP;
  var DEFAULTS = ["finance", "technology", "science", "ai"];
  var MIN = 3;

  var group = PP.qs("[data-chip-group]");
  var countEl = PP.qs("[data-chip-count]");
  var continueLink = PP.qs("a.btn--primary");
  var skipLink = PP.qs(".auth__foot a");

  function chips() { return PP.qsa(".chip", group); }
  function pressedSlugs() {
    return chips()
      .filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })
      .map(PP.slugFromChip);
  }
  function setChip(chip, on) { chip.setAttribute("aria-pressed", String(on)); }

  function refresh() {
    var n = pressedSlugs().length;
    if (countEl) countEl.textContent = n;
    var ok = n >= MIN;
    if (continueLink) {
      continueLink.style.opacity = ok ? "" : "0.5";
      continueLink.style.pointerEvents = ok ? "" : "none";
    }
  }

  PP.requireAuth({ allowOnboarding: true }).then(function (me) {
    // Reconcile chips with the user's saved topics (if any).
    if (me.topics && me.topics.length) {
      chips().forEach(function (c) {
        setChip(c, me.topics.indexOf(PP.slugFromChip(c)) !== -1);
      });
    }
    refresh();
  });

  // app.js toggles aria-pressed on click; we just recompute Continue state after.
  if (group) group.addEventListener("click", function () { setTimeout(refresh, 0); });

  function save(slugs, btn) {
    if (btn) { btn.style.pointerEvents = "none"; btn.style.opacity = "0.6"; }
    PP.api("/me/topics", { method: "PUT", body: { slugs: slugs } })
      .then(function () { location.href = "library.html"; })
      .catch(function (err) {
        if (btn) { btn.style.pointerEvents = ""; btn.style.opacity = ""; }
        alert(err.message || "Could not save your topics.");
      });
  }

  if (continueLink) {
    continueLink.addEventListener("click", function (e) {
      e.preventDefault();
      var slugs = pressedSlugs();
      if (slugs.length < MIN) return;
      save(slugs, continueLink);
    });
  }
  if (skipLink) {
    skipLink.addEventListener("click", function (e) {
      e.preventDefault();
      // "Skip for now" keeps the pre-selected defaults so the >=3 rule holds.
      var slugs = pressedSlugs();
      if (slugs.length < MIN) slugs = DEFAULTS;
      save(slugs, skipLink);
    });
  }
})();
