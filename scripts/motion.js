/* dsteamps.com motion layer.
 *
 * Rules this file obeys, in order of importance:
 *  1. Content is visible with JS off. Nothing here reveals text -- the CSS
 *     only hides .reveal AFTER this script adds .motion-ready to <html>.
 *     If the script never runs, the page is simply a static luxury page.
 *  2. prefers-reduced-motion is honoured by bailing out entirely.
 *  3. Transform and opacity only. No layout-triggering properties, so the
 *     compositor does the work and the main thread stays free.
 */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) return;

  var root = document.documentElement;
  root.classList.add("motion-ready");

  // --- scroll reveals + gold rule draw -------------------------------------
  var targets = document.querySelectorAll(".reveal, .rule-gold");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);           // one-shot: no churn on scroll back
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    // No IO (old browser): show everything rather than leave it hidden.
    targets.forEach(function (t) { t.classList.add("is-in"); });
  }

  // --- hero parallax --------------------------------------------------------
  // rAF-throttled. Caps at a small translate so text never drifts off its
  // background, and switches off under 760px where it just costs battery.
  var hero = document.querySelector("[data-parallax]");
  if (hero && window.innerWidth > 760) {
    var ticking = false;
    var apply = function () {
      var y = window.scrollY;
      if (y < window.innerHeight * 1.2) {
        hero.style.transform = "translate3d(0," + (y * 0.18).toFixed(2) + "px,0)";
      }
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
    }, { passive: true });
  }

  // --- staggered hero lines -------------------------------------------------
  var lines = document.querySelectorAll("[data-stagger] > *");
  Array.prototype.forEach.call(lines, function (el, i) {
    el.style.transitionDelay = (i * 90) + "ms";
    el.classList.add("is-in");
  });

  // Deliberately absent: animated counters. The brief allows them only for
  // approved numbers, and there are none yet -- an animated figure invented
  // to look impressive is exactly the kind of claim this site must not make.
})();
