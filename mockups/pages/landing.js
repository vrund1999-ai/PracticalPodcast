/* Landing page: send signed-in visitors into the app; show the marketing
   page to everyone else. Mirrors the signin page's "already logged in?" probe,
   but calls PP.api directly (NOT requireAuth, which would bounce a signed-out
   visitor to signin instead of letting them see this page). */
(function () {
  "use strict";
  var PP = window.PP;

  function showLanding() {
    var loading = PP.qs("[data-landing-loading]");
    var content = PP.qs("[data-landing-content]");
    if (loading) loading.hidden = true;
    if (content) content.hidden = false;
    document.documentElement.setAttribute("data-pp-ready", "landing");
  }

  PP.api("/me")
    .then(function (me) {
      // Signed in — go straight to the app (or finish onboarding first).
      location.href = me.needsOnboarding ? "onboarding.html" : "library.html";
    })
    .catch(function () {
      // 401 (not signed in) or any other error — show the landing content.
      showLanding();
    });
})();
