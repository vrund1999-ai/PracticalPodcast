/* PracticalPodcast — shared frontend API layer, auth guard, and DOM helpers.
   Loads AFTER app.js so it builds on (never replaces) app.js's hooks. */
(function () {
  "use strict";

  class ApiError extends Error {
    constructor(status, code, message) {
      super(message || code || "Request failed");
      this.status = status;
      this.code = code;
    }
  }

  /** fetch wrapper: same-origin cookies, JSON in/out, throws ApiError on !ok. */
  async function api(path, opts) {
    opts = opts || {};
    const init = {
      method: opts.method || "GET",
      credentials: "include",
      headers: {},
    };
    if (opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch("/api" + path, init);
    if (res.status === 204) return null;
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }
    if (!res.ok) {
      const err = (data && data.error) || {};
      throw new ApiError(res.status, err.code || "ERROR", err.message || res.statusText);
    }
    return data;
  }

  /** Guard a protected page. Redirects to signin (401) or onboarding (if needed).
   *  Returns the /me payload; if it redirects, returns a never-resolving promise
   *  so the caller's init halts. Pass {allowOnboarding:true} on the onboarding page. */
  async function requireAuth(options) {
    options = options || {};
    try {
      const me = await api("/me");
      syncTheme(me.user.themePref);
      setAvatar(me.user.email);
      if (me.needsOnboarding && !options.allowOnboarding) {
        location.href = "onboarding.html";
        return new Promise(function () {});
      }
      return me;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        location.href = "signin.html";
        return new Promise(function () {});
      }
      throw e;
    }
  }

  /** Set the topbar avatar initials from the user's email. */
  function setAvatar(email) {
    var local = (email || "").split("@")[0] || "";
    var initials = local.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
    if (!initials) initials = "U";
    qsa(".avatar").forEach(function (a) { a.textContent = initials; });
  }

  /** Mirror the server's theme preference into app.js's localStorage key. */
  function syncTheme(pref) {
    try {
      if (pref === "light" || pref === "dark") {
        localStorage.setItem("pp-theme", pref);
        document.documentElement.setAttribute("data-theme", pref);
      } else if (pref === "system") {
        localStorage.removeItem("pp-theme");
      }
    } catch (e) { /* ignore */ }
  }

  // ---------- DOM + format helpers ----------

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** el("div", {class:"x", onclick:fn, "data-id":1}, [child, "text"]) */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        const v = props[k];
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v !== null && v !== undefined && v !== false) {
          node.setAttribute(k, v === true ? "" : v);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /** seconds -> "M:SS" (or "H:MM:SS" past an hour). */
  function fmtTime(total) {
    total = Math.max(0, Math.floor(total || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const ss = String(s).padStart(2, "0");
    if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + ss;
    return m + ":" + ss;
  }

  function getQueryParam(name) {
    return new URLSearchParams(location.search).get(name);
  }

  /** Topic slug for a chip = its label lowercased (every topic name maps 1:1). */
  function slugFromChip(chip) {
    const clone = chip.cloneNode(true);
    const em = clone.querySelector(".chip__emoji");
    if (em) em.remove();
    return clone.textContent.trim().toLowerCase();
  }

  window.PP = {
    api: api,
    ApiError: ApiError,
    requireAuth: requireAuth,
    syncTheme: syncTheme,
    qs: qs,
    qsa: qsa,
    el: el,
    fmtTime: fmtTime,
    getQueryParam: getQueryParam,
    slugFromChip: slugFromChip,
  };
})();
