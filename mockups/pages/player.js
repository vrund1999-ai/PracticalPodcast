/* Player page: load an episode and render art, notes, transcript, chapters. */
(function () {
  "use strict";
  var PP = window.PP;
  var el = PP.el;
  var id = PP.getQueryParam("id");
  if (!id) { location.href = "library.html"; return; }

  PP.requireAuth().then(function (me) {
    PP.api("/episodes/" + id)
      .then(function (detail) {
        render(detail);
        PP.PlayerAudio.initPlayer(detail, me.user);
      })
      .catch(function () { location.href = "library.html"; });
  });

  function render(detail) {
    var ep = detail.episode;
    document.title = ep.title + " · PracticalPodcast";

    // Cover art
    var cover = PP.qs(".player-art .cover");
    if (cover) {
      cover.className = "cover " + ep.colorClass;
      var glyph = cover.querySelector(".cover__glyph");
      if (glyph) glyph.textContent = ep.coverGlyph;
    }
    // Title + meta
    var h1 = PP.qs(".player-art h1");
    if (h1) h1.textContent = ep.title;
    var meta = PP.qs(".player-art .ep-card__meta");
    if (meta) {
      var badge = meta.querySelector(".badge");
      if (badge) badge.textContent = ep.badgeLabel;
      var spans = meta.querySelectorAll("span");
      var dateSpan = spans[spans.length - 1];
      if (dateSpan && !dateSpan.classList.contains("badge")) dateSpan.textContent = ep.dateMeta;
    }

    // ----- Show notes -----
    var notes = PP.qs("#panel-notes");
    if (notes) {
      notes.innerHTML = "";
      notes.appendChild(
        el("p", {
          html:
            "Nova and Atlas break down the day's top stories across markets, geopolitics, technology and more. This episode summarizes <strong>" +
            detail.sourceCount + " sourced article" + (detail.sourceCount === 1 ? "" : "s") + "</strong>.",
        })
      );
      notes.appendChild(el("h3", { style: "margin-top:18px", text: "Sources covered" }));
      detail.sources.forEach(function (s) {
        notes.appendChild(
          el("div", { class: "notes-source" }, [
            el("span", { class: "notes-source__dot", "aria-hidden": "true" }),
            el("div", {}, [
              el("h4", {}, [s.url ? el("a", { href: s.url, target: "_blank", rel: "noopener", style: "color:inherit" }, [s.headline]) : s.headline]),
              el("div", { class: "notes-source__meta", text: [s.topicName, s.source, s.timeLabel].filter(Boolean).join(" · ") }),
            ]),
          ])
        );
      });
      notes.appendChild(
        el("p", { style: "margin-top:14px" }, [
          el("a", { href: "topics.html", style: "color:var(--accent);font-weight:600" }, [
            "See all " + detail.sourceCount + " sources in Discover →",
          ]),
        ])
      );
    }

    // ----- Transcript -----
    var tr = PP.qs("#panel-transcript");
    if (tr) {
      tr.innerHTML = "";
      if (!detail.lines.length) {
        tr.appendChild(el("p", { style: "color:var(--text-faint)", text: "Transcript will appear when the episode is generated." }));
      }
      detail.lines.forEach(function (l) {
        tr.appendChild(
          el("div", { class: "transcript-line " + l.lineClass, "data-start": String(l.startSeconds) }, [
            el("div", { class: "transcript-line__who" }, [l.name + " ", el("small", { text: l.timecode })]),
            el("p", { text: l.text }),
          ])
        );
      });
    }

    // ----- Chapters -----
    var ch = PP.qs("#panel-chapters");
    if (ch) {
      ch.innerHTML = "";
      detail.chapters.forEach(function (c) {
        ch.appendChild(
          el("div", { class: "row", "data-start": String(c.startSeconds) }, [
            el("div", {}, [
              el("div", { class: "row__label", text: c.title }),
              el("div", { class: "row__desc", text: c.topics.join(" · ") }),
            ]),
            el("span", { style: "color:var(--text-faint)", text: c.timecode }),
          ])
        );
      });
    }
    document.documentElement.setAttribute("data-pp-ready", "player");
  }
})();
