/* Verify page: collect the 6-digit code and sign in. */
(function () {
  "use strict";
  var PP = window.PP;
  var email = PP.getQueryParam("email");
  if (!email) { location.href = "signin.html"; return; }

  // Show which email we sent to.
  var strong = PP.qs(".auth__sub strong");
  if (strong) strong.textContent = email;

  var form = PP.qs("form");
  var otp = PP.qs(".otp");
  var alertBox = PP.qs(".alert");
  var button = PP.qs("button[type=submit]");
  var inputs = PP.qsa(".otp input");

  function readCode() {
    return inputs.map(function (i) { return i.value.replace(/\D/g, ""); }).join("");
  }
  function clearError() {
    if (otp) otp.classList.remove("is-error");
    if (alertBox) alertBox.hidden = true;
  }
  function showError() {
    if (otp) otp.classList.add("is-error");
    if (alertBox) alertBox.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = readCode();
    if (code.length !== 6) { showError(); return; }
    button.disabled = true;
    clearError();
    PP.api("/auth/verify-code", { method: "POST", body: { email: email, code: code } })
      .then(function (res) {
        location.href = res.needsOnboarding ? "onboarding.html" : "library.html";
      })
      .catch(function () {
        button.disabled = false;
        showError();
        inputs.forEach(function (i) { i.value = ""; i.classList.remove("is-filled"); });
        if (inputs[0]) inputs[0].focus();
      });
  });

  // ---- Resend countdown ----
  var foot = PP.qs(".auth__foot");
  var resend = foot ? foot.querySelector('a[href="#"]') : null;
  var timerNode = null;
  if (foot) {
    Array.prototype.forEach.call(foot.childNodes, function (n) {
      if (n.nodeType === 3 && /\d:\d\d/.test(n.nodeValue)) timerNode = n;
    });
  }
  var remaining = 0;

  function setEnabled(on) {
    if (!resend) return;
    resend.style.pointerEvents = on ? "" : "none";
    resend.style.opacity = on ? "" : "0.5";
  }
  function tick() {
    if (remaining <= 0) {
      if (timerNode) timerNode.nodeValue = " · ";
      setEnabled(true);
      return;
    }
    var m = Math.floor(remaining / 60), s = remaining % 60;
    if (timerNode) timerNode.nodeValue = " in " + m + ":" + String(s).padStart(2, "0") + " · ";
    remaining -= 1;
    setTimeout(tick, 1000);
  }
  function startCountdown() { remaining = 42; setEnabled(false); tick(); }
  startCountdown();

  if (resend) {
    resend.addEventListener("click", function (e) {
      e.preventDefault();
      if (remaining > 0) return;
      clearError();
      PP.api("/auth/request-code", { method: "POST", body: { email: email } })
        .then(function () { startCountdown(); })
        .catch(function () { /* ignore; user can retry */ });
    });
  }
})();
