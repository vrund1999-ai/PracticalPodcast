/* Discover page: render sourced articles grouped by topic; wire topic filter. */
(function () {
  "use strict";
  var PP = window.PP;
  var el = PP.el;

  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style="width:14px;height:14px"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> In today\'s podcasts';

  PP.requireAuth().then(function () {
    PP.PlayerAudio.miniResume();
    PP.api("/discover").then(render).catch(function (e) { console.error(e); });
  });

  function newsCard(a) {
    var children = [
      el("div", { class: "news-card__src" }, [
        el("span", { text: a.source }),
        el("span", { text: "·" }),
        el("span", { text: a.publishedLabel }),
      ]),
      el("h4", {}, [a.url ? el("a", { href: a.url, target: "_blank", rel: "noopener", style: "color:inherit" }, [a.headline]) : a.headline]),
      el("p", { style: "font-size:.9rem", text: a.summary }),
    ];
    if (a.inTodaysPodcasts) {
      children.push(el("span", { class: "news-card__included", html: CHECK_SVG }));
    }
    return el("article", { class: "news-card" }, children);
  }

  function topicBlock(topic) {
    return el("section", { class: "topic-block", "data-topic-slug": topic.slug }, [
      el("div", { class: "topic-block__head" }, [
        el("span", { class: "topic-block__icon " + topic.colorClass, "aria-hidden": "true", text: topic.emoji }),
        el("h2", { style: "margin:0", text: topic.name }),
      ]),
      el("div", { class: "news-grid" }, topic.articles.map(newsCard)),
    ]);
  }

  function render(data) {
    // Subtitle date
    var sub = PP.qs(".page-head p");
    if (sub) {
      sub.textContent =
        "The top stories we sourced this morning — these feed today's three podcasts. " + data.displayDate + ".";
    }

    // Chips: "All topics" + one per topic present today.
    var chipGroup = PP.qs("[data-chip-group]");
    if (chipGroup) {
      chipGroup.innerHTML = "";
      chipGroup.appendChild(chip("All topics", "", "", true));
      data.topics.forEach(function (t) { chipGroup.appendChild(chip(t.name, t.emoji, t.slug, false)); });
    }

    // Blocks
    var main = PP.qs("main");
    PP.qsa(".topic-block").forEach(function (b) { b.remove(); });
    if (!data.topics.length) {
      main.appendChild(el("p", { style: "text-align:center;color:var(--text-faint);padding:40px", text: "No sourced news yet for this day." }));
    }
    data.topics.forEach(function (t) { main.appendChild(topicBlock(t)); });

    wireFilter(chipGroup);
    document.documentElement.setAttribute("data-pp-ready", "topics");
  }

  function chip(label, emoji, slug, active) {
    var children = [];
    if (emoji) children.push(el("span", { class: "chip__emoji", "aria-hidden": "true", text: emoji }));
    children.push(emoji ? " " + label : label);
    return el("button", {
      type: "button",
      class: "chip" + (active ? " is-active" : ""),
      "aria-pressed": String(active),
      "data-topic-slug": slug,
    }, children);
  }

  function wireFilter(group) {
    if (!group) return;
    group.addEventListener("click", function (e) {
      var c = e.target.closest(".chip");
      if (!c) return;
      // Single-select (overrides app.js's multi-toggle).
      PP.qsa(".chip", group).forEach(function (x) {
        var on = x === c;
        x.setAttribute("aria-pressed", String(on));
        x.classList.toggle("is-active", on);
      });
      var slug = c.getAttribute("data-topic-slug");
      PP.qsa(".topic-block").forEach(function (b) {
        b.style.display = !slug || b.getAttribute("data-topic-slug") === slug ? "" : "none";
      });
    });
  }
})();
