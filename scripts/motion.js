/* dsteamps.com motion layer (Pass 2, cinematic).
 *
 * Rules this file obeys, in order of importance:
 *  1. Content is visible with JS off. CSS only hides .reveal once the inline
 *     head script has set html.motion, and a failsafe un-hides everything if
 *     this file never runs.
 *  2. prefers-reduced-motion: no parallax, no reveals, no crossfade. The
 *     header, progress line and chapter rail still work -- they are
 *     navigation, not decoration.
 *  3. Only transform and opacity are animated. One passive scroll listener,
 *     one requestAnimationFrame per frame, no layout writes inside the read.
 *  4. Native scrolling. No scroll hijacking, no smooth-scroll library.
 */
(function () {
  "use strict";
  window.__motion = true;
  var doc = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var motion = doc.classList.contains("motion") && !(mq && mq.matches);
  var $ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var head = document.querySelector("[data-head]");
  var bar = document.querySelector("[data-progress]");
  var chapters = $("[data-chapter][id]");
  var railLinks = $("[data-rail]");
  var rail = document.querySelector(".rail");
  var land = document.querySelector(".ch--land");
  var landLayers = land ? $(".layer[data-depth]", land) : [];
  var landContent = land ? land.querySelector("[data-land-content]") : null;
  var day = document.querySelector("[data-day]");
  var dayPanels = day ? $("[data-day-panel]", day) : [];
  var dayTexts = dayPanels.map(function (p) { return p.querySelector(".day__text"); });
  var dayTicks = day ? $(".day__ticks i", day) : [];
  var dark = $(".day__panel--dark, .site-foot");

  var vh = window.innerHeight;
  var parallax = [];          // [el, factor] currently near the viewport
  var lastRail = null;

  // --- reveals ----------------------------------------------------------------
  if (motion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    $(".reveal").forEach(function (el) { io.observe(el); });

    // Only track parallax elements while they are near the screen.
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var f = parseFloat(en.target.getAttribute("data-parallax")) || 0;
        var i = -1;
        for (var k = 0; k < parallax.length; k++) if (parallax[k][0] === en.target) i = k;
        if (en.isIntersecting && i < 0) parallax.push([en.target, f]);
        if (!en.isIntersecting && i >= 0) parallax.splice(i, 1);
      });
    }, { rootMargin: "20% 0px 20% 0px" });
    $("[data-parallax]").forEach(function (el) { pio.observe(el); });
  } else {
    $(".reveal").forEach(function (el) { el.classList.add("is-in"); });
  }

  // --- per-frame update ------------------------------------------------------
  var ticking = false;
  function frame() {
    ticking = false;
    var y = window.pageYOffset || doc.scrollTop;
    var max = Math.max(1, doc.scrollHeight - vh);

    if (head) head.classList.toggle("is-solid", y > 24);
    if (bar) bar.style.transform = "scaleX(" + (y / max).toFixed(4) + ")";

    // Chapter rail: the last chapter whose top has passed mid-screen.
    if (railLinks.length) {
      var cur = null;
      for (var c = 0; c < chapters.length; c++) {
        if (chapters[c].getBoundingClientRect().top <= vh * 0.5) cur = chapters[c].id;
      }
      if (cur !== lastRail) {
        lastRail = cur;
        railLinks.forEach(function (a) {
          if (a.getAttribute("data-rail") === cur) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      }
      if (rail) {
        var mid = vh * 0.5, onDark = false;
        for (var d = 0; d < dark.length; d++) {
          var r = dark[d].getBoundingClientRect();
          var vis = (!motion || dark[d].classList.contains("site-foot")) ? 1 : parseFloat(dark[d].style.opacity || 0);
          if (r.top < mid && r.bottom > mid && vis > 0.5) onDark = true;
        }
        rail.classList.toggle("on-dark", onDark);
      }
    }

    if (!motion) return;

    // Chapter 1: depth parallax while the opening is on screen.
    if (land && y < vh * 1.3) {
      for (var i = 0; i < landLayers.length; i++) {
        var dpt = parseFloat(landLayers[i].getAttribute("data-depth")) || 0;
        landLayers[i].style.transform = "translate3d(0," + (y * dpt).toFixed(1) + "px,0)";
      }
      if (landContent) {
        landContent.style.transform = "translate3d(0," + (y * 0.32).toFixed(1) + "px,0)";
        landContent.style.opacity = clamp(1 - y / (vh * 0.75), 0, 1).toFixed(3);
      }
    }

    // Generic gentle parallax: offset from viewport centre.
    for (var p = 0; p < parallax.length; p++) {
      var el = parallax[p][0], f = parallax[p][1];
      var rc = el.parentNode.getBoundingClientRect();
      var off = (rc.top + rc.height / 2 - vh / 2) * -f;
      el.style.transform = "translate3d(0," + off.toFixed(1) + "px,0)";
    }

    // Chapter 3: one day, dawn to dusk, as you scroll.
    if (day && dayPanels.length) {
      var dr = day.getBoundingClientRect();
      if (dr.top < vh && dr.bottom > 0) {
        var prog = clamp(-dr.top / Math.max(1, dr.height - vh), 0, 1);
        var x = prog * (dayPanels.length - 1);
        for (var k = 0; k < dayPanels.length; k++) {
          var dist = Math.abs(x - k);
          var o = clamp(1.6 - dist * 2.2, 0, 1);
          if (k === 0 && x < 0.27) o = 1;
          dayPanels[k].style.opacity = o.toFixed(3);
          if (dayTexts[k]) dayTexts[k].style.transform = "translate3d(0," + ((x - k) * -60).toFixed(1) + "px,0)";
          if (dayTicks[k]) dayTicks[k].style.setProperty("--f", clamp(x - k + 1, 0, 1).toFixed(3));
        }
      }
    }
  }
  function request() { if (!ticking) { ticking = true; window.requestAnimationFrame(frame); } }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", function () { vh = window.innerHeight; request(); }, { passive: true });
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function (ev) {
      if (!ev.matches) return;
      // User switched reduced motion on mid-visit: drop every effect now.
      motion = false;
      doc.classList.remove("motion"); doc.classList.add("motion-off");
      $("[style]").forEach(function (el) { el.style.transform = ""; el.style.opacity = ""; });
    });
  }
  frame();

  // Deliberately absent: animated counters. They are allowed only for
  // approved numbers, and none exist yet -- an animated figure invented to
  // look impressive is exactly the kind of claim this site must not make.
})();
