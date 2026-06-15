/* Account & settings: load + save profile topics, appearance, playback, notifications. */
(function () {
  "use strict";
  var PP = window.PP;
  var el = PP.el;
  var MIN = 3;

  var emailInput = PP.qs("#email");
  var topicGroup = PP.qs("#topics [data-chip-group]");
  var appearanceSeg = PP.qs("#appearance .segmented");
  var speedSeg = PP.qs("#playback .segmented");
  var autoplayCb = PP.qs('#playback input[type=checkbox]');
  var digestCb = PP.qs('#notifications input[aria-label="Daily email digest"]');
  var breakingCb = PP.qs('#notifications input[aria-label="Breaking news alerts"]');
  var saveBtn = PP.qs(".btn--primary");
  var signOut = PP.qs('a.btn--ghost[href="signin.html"]');

  function setActive(seg, btn) {
    PP.qsa("button", seg).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
  }
  function activeButton(seg) {
    return seg ? seg.querySelector('button[aria-pressed="true"]') : null;
  }
  function pressedTopicSlugs() {
    return PP.qsa('.chip[aria-pressed="true"]', topicGroup).map(PP.slugFromChip);
  }

  PP.requireAuth().then(function (me) {
    if (emailInput) emailInput.value = me.user.email;
    renderTopics(me.topics);
    initAppearance(me.user.themePref);
    initSpeed(me.user.defaultSpeed);
    if (autoplayCb) autoplayCb.checked = !!me.user.autoplay;
    if (digestCb) digestCb.checked = !!me.user.emailDigest;
    if (breakingCb) breakingCb.checked = !!me.user.breakingAlerts;
    document.documentElement.setAttribute("data-pp-ready", "account");
  });

  function renderTopics(selected) {
    if (!topicGroup) return;
    var sel = selected || [];
    PP.api("/topics").then(function (data) {
      topicGroup.innerHTML = "";
      data.topics.forEach(function (t) {
        var on = sel.indexOf(t.slug) !== -1;
        topicGroup.appendChild(
          el("button", { type: "button", class: "chip", "aria-pressed": String(on) }, [
            el("span", { class: "chip__emoji", "aria-hidden": "true", text: t.emoji }),
            " " + t.name,
          ])
        );
      });
    });
  }

  function initAppearance(pref) {
    if (!appearanceSeg) return;
    PP.qsa("button", appearanceSeg).forEach(function (b) {
      if (b.textContent.trim().toLowerCase() === pref) setActive(appearanceSeg, b);
    });
    appearanceSeg.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      setActive(appearanceSeg, b);
      PP.syncTheme(b.textContent.trim().toLowerCase()); // live preview
    });
  }

  function initSpeed(speed) {
    if (!speedSeg) return;
    PP.qsa("button", speedSeg).forEach(function (b) {
      if (parseFloat(b.textContent) === speed) setActive(speedSeg, b);
    });
    speedSeg.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (b) setActive(speedSeg, b);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var slugs = pressedTopicSlugs();
      if (slugs.length < MIN) { flash(saveBtn, "Pick at least 3 topics", true); return; }
      var appBtn = activeButton(appearanceSeg);
      var spdBtn = activeButton(speedSeg);
      var settings = {
        themePref: appBtn ? appBtn.textContent.trim().toLowerCase() : "system",
        defaultSpeed: spdBtn ? parseFloat(spdBtn.textContent) : 1.0,
        autoplay: autoplayCb ? autoplayCb.checked : true,
        emailDigest: digestCb ? digestCb.checked : true,
        breakingAlerts: breakingCb ? breakingCb.checked : false,
      };
      saveBtn.disabled = true;
      Promise.all([
        PP.api("/me/topics", { method: "PUT", body: { slugs: slugs } }),
        PP.api("/me/settings", { method: "PUT", body: settings }),
      ])
        .then(function () { flash(saveBtn, "Saved ✓", false); })
        .catch(function (err) { flash(saveBtn, err.message || "Save failed", true); })
        .finally(function () { saveBtn.disabled = false; });
    });
  }

  function flash(btn, msg, isError) {
    var original = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", original);
    btn.textContent = msg;
    if (isError) btn.style.background = "var(--len-long)";
    setTimeout(function () { btn.textContent = original; btn.style.background = ""; }, 1600);
  }

  if (signOut) {
    signOut.addEventListener("click", function (e) {
      e.preventDefault();
      PP.api("/auth/logout", { method: "POST" })
        .catch(function () {})
        .finally(function () { location.href = "signin.html"; });
    });
  }
})();
