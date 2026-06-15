/* Sign-in page: POST the email, then go to the verify page. */
(function () {
  "use strict";
  var PP = window.PP;
  var form = PP.qs("form");
  var input = PP.qs("#email");
  var button = PP.qs("button[type=submit]");
  if (!form || !input) return;

  // If already signed in, skip straight ahead.
  PP.api("/me")
    .then(function (me) {
      location.href = me.needsOnboarding ? "onboarding.html" : "library.html";
    })
    .catch(function () { /* not signed in — stay */ });

  var errEl = PP.el("p", {
    class: "field__hint",
    role: "alert",
    style: "color:var(--len-long);display:none",
  });
  form.appendChild(errEl);

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = "block";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!email) return;
    button.disabled = true;
    errEl.style.display = "none";
    PP.api("/auth/request-code", { method: "POST", body: { email: email } })
      .then(function () {
        location.href = "verify.html?email=" + encodeURIComponent(email);
      })
      .catch(function (err) {
        button.disabled = false;
        showError(err.message || "Something went wrong. Please try again.");
      });
  });
})();
