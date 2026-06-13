/* PracticalPodcast — mockup interactivity (progressive enhancement) */
(function () {
  "use strict";

  /* ---------- Theme: respect OS first load, persist choice ---------- */
  var STORE_KEY = "pp-theme";
  var root = document.documentElement;

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(t === "light"));
      var label = t === "light" ? "Switch to dark mode" : "Switch to light mode";
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
      var sun = btn.querySelector("[data-icon-sun]");
      var moon = btn.querySelector("[data-icon-moon]");
      if (sun && moon) {
        sun.style.display = t === "light" ? "none" : "block";
        moon.style.display = t === "light" ? "block" : "none";
      }
    });
  }

  var stored = null;
  try { stored = localStorage.getItem(STORE_KEY); } catch (e) {}
  applyTheme(stored || systemTheme());

  document.addEventListener("click", function (e) {
    var toggle = e.target.closest("[data-theme-toggle]");
    if (!toggle) return;
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
    try { localStorage.setItem(STORE_KEY, next); } catch (err) {}
  });

  /* ---------- OTP code inputs: auto-advance + paste ---------- */
  var otp = document.querySelector(".otp");
  if (otp) {
    var boxes = Array.prototype.slice.call(otp.querySelectorAll("input"));
    boxes.forEach(function (box, i) {
      box.addEventListener("input", function () {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        box.classList.toggle("is-filled", box.value !== "");
        if (box.value && boxes[i + 1]) boxes[i + 1].focus();
      });
      box.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !box.value && boxes[i - 1]) boxes[i - 1].focus();
      });
      box.addEventListener("paste", function (e) {
        e.preventDefault();
        var digits = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
        boxes.forEach(function (b, j) {
          b.value = digits[j] || "";
          b.classList.toggle("is-filled", !!digits[j]);
        });
        var last = Math.min(digits.length, boxes.length) - 1;
        if (boxes[last]) boxes[last].focus();
      });
    });
  }

  /* ---------- Length filter (library) ---------- */
  var seg = document.querySelector("[data-length-filter]");
  if (seg) {
    seg.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-len]");
      if (!btn) return;
      seg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      var len = btn.getAttribute("data-len");
      var shown = 0;
      document.querySelectorAll("[data-card-len]").forEach(function (card) {
        var match = len === "all" || card.getAttribute("data-card-len") === len;
        card.style.display = match ? "" : "none";
        if (match) shown++;
      });
      // Hide day sections that have no visible cards
      document.querySelectorAll(".day-section").forEach(function (sec) {
        var any = Array.prototype.some.call(sec.querySelectorAll("[data-card-len]"), function (c) {
          return c.style.display !== "none";
        });
        sec.style.display = any ? "" : "none";
      });
      var empty = document.querySelector("[data-empty-state]");
      if (empty) empty.hidden = shown !== 0;
    });
  }

  /* ---------- Chips: toggle pressed state ---------- */
  document.querySelectorAll("[data-chip-group]").forEach(function (group) {
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      var pressed = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!pressed));
      var counter = document.querySelector("[data-chip-count]");
      if (counter) {
        var n = group.querySelectorAll('.chip[aria-pressed="true"]').length;
        counter.textContent = n;
      }
    });
  });

  /* ---------- Tabs (player) ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (tabs) {
    var buttons = Array.prototype.slice.call(tabs.querySelectorAll('[role="tab"]'));
    buttons.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(i); });
      tab.addEventListener("keydown", function (e) {
        var idx = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : -1;
        if (idx >= 0 && buttons[idx]) { e.preventDefault(); buttons[idx].focus(); select(idx); }
      });
    });
    function select(i) {
      buttons.forEach(function (b, j) {
        var sel = i === j;
        b.setAttribute("aria-selected", String(sel));
        b.tabIndex = sel ? 0 : -1;
        var panel = document.getElementById(b.getAttribute("aria-controls"));
        if (panel) panel.hidden = !sel;
      });
    }
  });

  /* ---------- Fake play/pause toggle for buttons ---------- */
  document.addEventListener("click", function (e) {
    var pb = e.target.closest("[data-play-toggle]");
    if (!pb) return;
    var playing = pb.getAttribute("aria-pressed") === "true";
    pb.setAttribute("aria-pressed", String(!playing));
    var play = pb.querySelector("[data-icon-play]");
    var pause = pb.querySelector("[data-icon-pause]");
    if (play && pause) {
      play.style.display = playing ? "block" : "none";
      pause.style.display = playing ? "none" : "block";
    }
  });
})();
