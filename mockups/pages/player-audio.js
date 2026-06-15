/* Real <audio> engine for the player page + mini-player sync, and a lightweight
   "resume" mini-player for the library/discover pages. */
(function () {
  "use strict";
  var PP = window.PP;
  var SPEEDS = [1.0, 1.25, 1.5, 2.0];
  var NOW_KEY = "pp-now-playing";

  function pct(a, b) { return b > 0 ? Math.min(100, Math.max(0, (a / b) * 100)) : 0; }
  function remaining(cur, dur) { return "-" + PP.fmtTime(Math.max(0, (dur || 0) - (cur || 0))); }

  function saveNowPlaying(np) {
    try { localStorage.setItem(NOW_KEY, JSON.stringify(np)); } catch (e) {}
  }
  function readNowPlaying() {
    try { return JSON.parse(localStorage.getItem(NOW_KEY) || "null"); } catch (e) { return null; }
  }

  /** Full player experience on player.html. */
  function initPlayer(detail, user) {
    var ep = detail.episode;
    var audio = new Audio();
    audio.preload = "metadata";
    audio.style.display = "none";
    document.body.appendChild(audio); // hidden, but in the DOM so it's inspectable

    // ---- Mini-player content ----
    setMini(ep);
    var miniSub = ep.lengthMinutes + " min · Nova & Atlas";

    // Transport + controls
    var playButtons = PP.qsa("[data-play-toggle]");
    var rewindBtn = PP.qs('button[aria-label="Rewind 15 seconds"]');
    var forwardBtn = PP.qs('button[aria-label="Forward 15 seconds"]');
    var ghosts = PP.qsa(".player-art .btn--ghost");
    var speedBtn = ghosts[0];
    var queueBtn = ghosts[1];

    // Scrubber
    var track = PP.qs(".scrubber__track");
    var fill = PP.qs(".scrubber__fill");
    var knob = PP.qs(".scrubber__knob");
    var timeSpans = PP.qsa(".scrubber__time span");
    // Mini bar + time
    var miniBar = PP.qs(".mini-player__bar span");
    var miniTime = PP.qs(".mini-player__right span");

    var duration = ep.durationSeconds || 0;
    var startAt = (detail.playback && detail.playback.positionSeconds) || 0;
    var speedIdx = Math.max(0, SPEEDS.indexOf(user && user.defaultSpeed ? user.defaultSpeed : 1.0));
    if (speedIdx < 0) speedIdx = 0;

    if (!ep.audioUrl) {
      // Not generated yet — disable transport.
      playButtons.forEach(function (b) { b.disabled = true; b.style.opacity = "0.4"; });
      if (rewindBtn) rewindBtn.disabled = true;
      if (forwardBtn) forwardBtn.disabled = true;
      if (timeSpans[0]) timeSpans[0].textContent = ep.status === "FAILED" ? "Generation failed" : "Generating…";
      return;
    }

    audio.src = ep.audioUrl;
    audio.playbackRate = SPEEDS[speedIdx];
    if (speedBtn) speedBtn.textContent = SPEEDS[speedIdx].toFixed(SPEEDS[speedIdx] % 1 ? 2 : 1).replace(/0$/, "") + "×";
    updateSpeedLabel();

    function updateSpeedLabel() {
      if (speedBtn) speedBtn.textContent = String(SPEEDS[speedIdx]) + "×";
    }

    audio.addEventListener("loadedmetadata", function () {
      if (isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
      if (startAt > 0 && startAt < duration) audio.currentTime = startAt;
      renderProgress();
    });

    // ---- Play / pause (drive real audio; sync every toggle button) ----
    function syncPlayingUI(playing) {
      playButtons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(playing));
        b.setAttribute("aria-label", playing ? "Pause" : "Play");
        var play = b.querySelector("[data-icon-play]");
        var pause = b.querySelector("[data-icon-pause]");
        if (play && pause) {
          play.style.display = playing ? "none" : "block";
          pause.style.display = playing ? "block" : "none";
        }
      });
    }
    function togglePlay() {
      if (audio.paused) audio.play().catch(function () {}); else audio.pause();
    }
    playButtons.forEach(function (b) {
      b.addEventListener("click", function () { setTimeout(togglePlay, 0); });
    });
    audio.addEventListener("play", function () { syncPlayingUI(true); persistNow(); startSaver(); });
    audio.addEventListener("pause", function () { syncPlayingUI(false); stopSaver(); save(); });

    if (rewindBtn) rewindBtn.addEventListener("click", function () { audio.currentTime = Math.max(0, audio.currentTime - 15); });
    if (forwardBtn) forwardBtn.addEventListener("click", function () { audio.currentTime = Math.min(duration, audio.currentTime + 15); });

    if (speedBtn) speedBtn.addEventListener("click", function () {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      audio.playbackRate = SPEEDS[speedIdx];
      updateSpeedLabel();
    });

    if (queueBtn) queueBtn.addEventListener("click", function () {
      try {
        var q = JSON.parse(localStorage.getItem("pp-queue") || "[]");
        if (q.indexOf(ep.id) === -1) q.push(ep.id);
        localStorage.setItem("pp-queue", JSON.stringify(q));
      } catch (e) {}
      queueBtn.textContent = "Queued ✓";
      setTimeout(function () { queueBtn.textContent = "Add to queue"; }, 1500);
    });

    // ---- Transcript / chapter sync (live highlight + click-to-seek) ----
    // Both lists are rendered (by player.js) before initPlayer runs and carry a
    // data-start (seconds) on each row — see episode.service.ts.
    var transcriptPanel = PP.qs("#panel-transcript");
    var transcriptTargets = buildTargets("#panel-transcript .transcript-line[data-start]");
    var chapterTargets = buildTargets("#panel-chapters .row[data-start]");
    var lastLineIdx = -1;
    var lastChapterIdx = -1;
    var lastManualScroll = 0; // timestamp of the user's last manual scroll

    function buildTargets(sel) {
      return PP.qsa(sel).map(function (node) {
        var s = Number(node.getAttribute("data-start"));
        return { el: node, start: isFinite(s) ? s : 0 };
      });
    }

    // Move the playhead (clamped) and persist the new resume position.
    function seek(t) {
      t = Math.min(duration || 0, Math.max(0, t));
      audio.currentTime = t;
      renderProgress();
      save();
    }
    // Clicking a line/chapter jumps there and starts playback, and re-engages
    // auto-follow immediately (cancels any manual-scroll suspension).
    function activate(start) {
      lastManualScroll = 0;
      seek(start);
      audio.play().catch(function () {});
    }
    function makeInteractive(targets) {
      targets.forEach(function (t) {
        t.el.classList.add("is-clickable");
        t.el.setAttribute("role", "button");
        t.el.setAttribute("tabindex", "0");
        t.el.setAttribute("aria-label", "Jump to " + PP.fmtTime(t.start));
        t.el.addEventListener("click", function () { activate(t.start); });
        t.el.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            activate(t.start);
          }
        });
      });
    }
    makeInteractive(transcriptTargets);
    makeInteractive(chapterTargets);

    // Index of the last target whose start time is at/below the current time.
    function activeIndex(targets, cur) {
      var idx = -1;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].start <= cur + 0.25) idx = i; else break;
      }
      return idx;
    }
    function setCurrent(targets, prevIdx, nextIdx) {
      if (prevIdx >= 0 && targets[prevIdx]) {
        targets[prevIdx].el.classList.remove("is-current");
        targets[prevIdx].el.removeAttribute("aria-current");
      }
      if (nextIdx >= 0 && targets[nextIdx]) {
        targets[nextIdx].el.classList.add("is-current");
        targets[nextIdx].el.setAttribute("aria-current", "true");
      }
    }
    function highlightCurrent(cur) {
      var li = activeIndex(transcriptTargets, cur);
      if (li !== lastLineIdx) {
        setCurrent(transcriptTargets, lastLineIdx, li);
        lastLineIdx = li;
        // Auto-follow: keep the active line in view, unless the transcript tab
        // is hidden or the user scrolled in the last few seconds.
        if (li >= 0 && transcriptPanel && !transcriptPanel.hasAttribute("hidden") &&
            Date.now() - lastManualScroll > 4000) {
          transcriptTargets[li].el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }
      var ci = activeIndex(chapterTargets, cur);
      if (ci !== lastChapterIdx) {
        setCurrent(chapterTargets, lastChapterIdx, ci);
        lastChapterIdx = ci;
      }
    }

    // Manual scroll/wheel/touch suspends auto-follow (these don't fire from our
    // own programmatic scrollIntoView, so they cleanly signal user intent).
    function markManual() { lastManualScroll = Date.now(); }
    window.addEventListener("wheel", markManual, { passive: true });
    window.addEventListener("touchmove", markManual, { passive: true });

    highlightCurrent(audio.currentTime || 0); // initial paint

    // ---- Progress rendering ----
    function renderProgress() {
      var cur = audio.currentTime || 0;
      var p = pct(cur, duration);
      if (fill) fill.style.width = p + "%";
      if (knob) knob.style.left = p + "%";
      if (track) track.setAttribute("aria-valuenow", String(Math.round(p)));
      if (timeSpans[0]) timeSpans[0].textContent = PP.fmtTime(cur);
      if (timeSpans[1]) timeSpans[1].textContent = remaining(cur, duration);
      if (miniBar) miniBar.style.width = p + "%";
      if (miniTime) miniTime.textContent = PP.fmtTime(cur) + " / " + PP.fmtTime(duration);
      highlightCurrent(cur);
    }
    audio.addEventListener("timeupdate", renderProgress);

    // ---- Seeking ----
    function seekToClientX(clientX) {
      if (!track || !duration) return;
      var rect = track.getBoundingClientRect();
      var frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = frac * duration;
      renderProgress();
    }
    if (track) {
      var dragging = false;
      track.addEventListener("pointerdown", function (e) {
        dragging = true;
        track.setPointerCapture(e.pointerId);
        seekToClientX(e.clientX);
      });
      track.addEventListener("pointermove", function (e) { if (dragging) seekToClientX(e.clientX); });
      track.addEventListener("pointerup", function () { dragging = false; save(); });
      track.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { audio.currentTime = Math.min(duration, audio.currentTime + 5); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
        else if (e.key === "Home") { audio.currentTime = 0; e.preventDefault(); }
        else if (e.key === "End") { audio.currentTime = duration; e.preventDefault(); }
      });
    }

    // ---- Position saving (throttled + on exit) ----
    var saver = null;
    function startSaver() { if (!saver) saver = setInterval(save, 10000); }
    function stopSaver() { if (saver) { clearInterval(saver); saver = null; } }
    var lastSaved = -1;
    function save() {
      var pos = Math.floor(audio.currentTime || 0);
      if (pos === lastSaved) return;
      lastSaved = pos;
      PP.api("/episodes/" + ep.id + "/playback", { method: "PUT", body: { positionSeconds: pos } }).catch(function () {});
    }
    function persistNow() {
      saveNowPlaying({ id: ep.id, title: ep.title, sub: miniSub, glyph: ep.coverGlyph, colorClass: ep.colorClass });
    }
    window.addEventListener("pagehide", function () {
      var pos = Math.floor(audio.currentTime || 0);
      try {
        navigator.sendBeacon &&
          navigator.sendBeacon(
            "/api/episodes/" + ep.id + "/playback",
            new Blob([JSON.stringify({ positionSeconds: pos })], { type: "application/json" })
          );
      } catch (e) {}
    });

    // ---- Autoplay + next ----
    if (PP.getQueryParam("autoplay")) {
      audio.play().catch(function () {});
    }
    audio.addEventListener("ended", function () {
      save();
      if (user && user.autoplay) playNextLength(ep);
    });
  }

  function setMini(ep) {
    var cover = PP.qs(".mini-player__cover");
    if (cover) {
      cover.className = "cover " + ep.colorClass + " mini-player__cover";
      var glyph = cover.querySelector(".cover__glyph");
      if (glyph) glyph.textContent = ep.coverGlyph;
    }
    var title = PP.qs(".mini-player__title");
    if (title) title.textContent = ep.title;
    var sub = PP.qs(".mini-player__sub");
    if (sub) sub.textContent = ep.lengthMinutes + " min · Nova & Atlas";
  }

  function playNextLength(ep) {
    var order = [10, 30, 60];
    var idx = order.indexOf(ep.lengthMinutes);
    if (idx === -1 || idx === order.length - 1) return;
    var nextLen = order[idx + 1];
    PP.api("/episodes?length=" + nextLen)
      .then(function (data) {
        for (var d = 0; d < data.days.length; d++) {
          var match = data.days[d].episodes.find(function (e) { return e.status === "READY"; });
          if (match) { location.href = "player.html?id=" + match.id + "&autoplay=1"; return; }
        }
      })
      .catch(function () {});
  }

  /** Lightweight resume bar on library/discover pages — links to the player. */
  function miniResume() {
    var np = readNowPlaying();
    var mini = PP.qs(".mini-player");
    if (!mini) return;
    if (!np) { mini.style.display = "none"; return; }
    setMini({ title: np.title, lengthMinutes: 0, coverGlyph: np.glyph, colorClass: np.colorClass });
    var sub = PP.qs(".mini-player__sub");
    if (sub) sub.textContent = np.sub;
    function go() { location.href = "player.html?id=" + np.id + "&autoplay=1"; }
    PP.qsa(".mini-player [data-play-toggle]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); go(); });
    });
    mini.addEventListener("click", function (e) {
      if (e.target.closest(".mini-player__now")) go();
    });
  }

  PP.PlayerAudio = { initPlayer: initPlayer, miniResume: miniResume };
})();
