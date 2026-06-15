/* Library (home): render episodes grouped by day; wire length filter + search. */
(function () {
  "use strict";
  var PP = window.PP;
  var el = PP.el;

  var PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  PP.requireAuth().then(function () {
    PP.PlayerAudio.miniResume();
    PP.api("/episodes")
      .then(render)
      .catch(function (err) { console.error(err); });
  });

  function tagEls(tags) {
    var out = [];
    tags.slice(0, 2).forEach(function (t) { out.push(el("span", { class: "tag", text: t })); });
    if (tags.length > 2) out.push(el("span", { class: "tag", text: "+" + (tags.length - 2) }));
    return out;
  }

  function card(ep) {
    var ready = ep.status === "READY";
    var searchText = ep.searchText || (ep.title + " " + ep.tags.join(" ")).toLowerCase();
    var coverChildren = [
      el("span", { class: "cover__glyph", "aria-hidden": "true", text: ep.coverGlyph }),
      el("span", { class: "cover__len" }, [
        el("span", { class: "badge badge--len " + ep.badgeClass, text: ep.badgeLabel }),
      ]),
    ];
    if (ready) {
      coverChildren.push(
        el("button", {
          class: "cover__play",
          "aria-label": "Play " + ep.title,
          html: PLAY_SVG,
          onclick: function (e) {
            e.stopPropagation();
            location.href = "player.html?id=" + ep.id + "&autoplay=1";
          },
        })
      );
    }
    var metaText = ready
      ? ep.generatedLabel
      : ep.status === "GENERATING"
      ? "Generating…"
      : ep.status === "FAILED"
      ? "Generation failed"
      : "Pending";

    var article = el(
      "article",
      {
        class: "ep-card" + (ready ? "" : " is-disabled"),
        "data-card-len": ep.dataLen,
        "data-search": searchText,
        style: ready ? "" : "opacity:0.55",
      },
      [
        el("div", { class: "cover " + ep.colorClass }, coverChildren),
        el("div", { class: "ep-card__body" }, [
          el("h3", { class: "ep-card__title", text: ep.title }),
          el("div", { class: "ep-card__meta" }, [el("span", { text: metaText })]),
          el("div", { class: "ep-card__tags" }, tagEls(ep.tags)),
        ]),
      ]
    );
    if (ready) {
      article.style.cursor = "pointer";
      article.addEventListener("click", function () { location.href = "player.html?id=" + ep.id; });
    }
    return article;
  }

  function render(data) {
    var main = PP.qs("main");
    var emptyState = PP.qs("[data-empty-state]");
    PP.qsa(".day-section").forEach(function (s) { s.remove(); });

    data.days.forEach(function (day) {
      var section = el("section", { class: "day-section" }, [
        el("div", { class: "day-section__head" }, [
          el("h2", { text: day.label }),
          el("span", { class: "day-section__date", text: day.displayDate }),
        ]),
        el("div", { class: "ep-grid" }, day.episodes.map(card)),
      ]);
      main.insertBefore(section, emptyState);
    });

    wireFilters();
    applyFilters();
    document.documentElement.setAttribute("data-pp-ready", "library");
  }

  // ---- Combined length + search filtering (runs after app.js's length handler) ----
  function activeLength() {
    var seg = PP.qs("[data-length-filter]");
    if (!seg) return "all";
    var btn = seg.querySelector('button[aria-pressed="true"]');
    return btn ? btn.getAttribute("data-len") : "all";
  }
  function searchValue() {
    var input = PP.qs(".toolbar .search input");
    return input ? input.value.trim().toLowerCase() : "";
  }
  function applyFilters() {
    var len = activeLength();
    var q = searchValue();
    var shown = 0;
    PP.qsa("[data-card-len]").forEach(function (cardEl) {
      var lenOk = len === "all" || cardEl.getAttribute("data-card-len") === len;
      var qOk = !q || (cardEl.getAttribute("data-search") || "").indexOf(q) !== -1;
      var visible = lenOk && qOk;
      cardEl.style.display = visible ? "" : "none";
      if (visible) shown++;
    });
    PP.qsa(".day-section").forEach(function (sec) {
      var any = PP.qsa("[data-card-len]", sec).some(function (c) { return c.style.display !== "none"; });
      sec.style.display = any ? "" : "none";
    });
    var empty = PP.qs("[data-empty-state]");
    if (empty) empty.hidden = shown !== 0;
  }
  function wireFilters() {
    var seg = PP.qs("[data-length-filter]");
    if (seg) seg.addEventListener("click", function () { setTimeout(applyFilters, 0); });
    var input = PP.qs(".toolbar .search input");
    if (input) {
      var t;
      input.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(applyFilters, 200);
      });
    }
  }
})();
