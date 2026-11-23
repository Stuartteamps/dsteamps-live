/* dsteamps.com analytics + consent.
 *
 * What this does, and only this:
 *  - Cookie notice with Accept / Decline. Accept grants analytics_storage ONLY.
 *    ad_storage, ad_user_data and ad_personalization stay denied: there is no
 *    advertising or remarketing tag on this site.
 *  - "Do Not Sell or Share My Personal Information": sets the choice to
 *    declined. A browser Global Privacy Control signal is treated the same way
 *    unless the visitor later clicks Accept themselves.
 *  - dataLayer events for GTM: FunnelPageView, ClickToCall, TextClick,
 *    EmailClick, ValuationFormStart / FormStart. The Lead event is pushed by
 *    lead-form.js, and only after the endpoint answers ok:true.
 *
 * Privacy rule enforced in code (and by tests/analytics.test.mjs): an event
 * carries page_type, lead_type, link_location and utm_* -- never a name, email,
 * phone number, address, message, or the href of the link that was clicked.
 *
 * The consent DEFAULT (everything denied) and the restore of a stored choice
 * run inline in <head> (build.py tracking()), before GTM loads. This file only
 * handles the visitor's clicks. Without JavaScript, no tag loads at all.
 */
(function (root) {
  "use strict";

  var KEY = "dsteamps_consent_v1";          // "granted" | "denied"
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var ALLOWED = ["event", "page_type", "lead_type", "link_location"].concat(UTM);

  /** Event name for a clicked link's href, or null. Pure. */
  function clickEvent(href) {
    var h = String(href || "").trim().toLowerCase();
    if (h.indexOf("tel:") === 0) return "ClickToCall";
    if (h.indexOf("sms:") === 0) return "TextClick";
    if (h.indexOf("mailto:") === 0) return "EmailClick";
    return null;
  }

  /** Form-start event for a lead type. Pure. */
  function formStartEvent(leadType) {
    return leadType === "valuation" ? "ValuationFormStart" : "FormStart";
  }

  /**
   * Build a dataLayer object, keeping ONLY whitelisted keys with short string
   * values. Anything else (a stray email, a phone number) is dropped here, so
   * a future edit cannot leak PII by passing the wrong object. Pure.
   */
  function payload(name, fields) {
    var out = { event: name };
    var f = fields || {};
    ALLOWED.forEach(function (k) {
      if (k === "event" || f[k] == null || f[k] === "") return;
      var v = String(f[k]).slice(0, 100);
      if (/@|\d{3}[^\d]?\d{3}[^\d]?\d{4}/.test(v)) return;   // looks like an email or phone: never send
      out[k] = v;
    });
    return out;
  }

  /** Where on the page a link sits, as a coarse label. Pure on an element-like. */
  function locationOf(el) {
    var n = el, guard = 0;
    while (n && guard++ < 40) {
      var c = " " + (n.className && n.className.baseVal == null ? n.className : "") + " ";
      if (n.tagName === "HEADER" || c.indexOf(" site-head ") > -1) return "header";
      if (n.tagName === "FOOTER" || c.indexOf(" site-foot ") > -1) return "footer";
      if (c.indexOf(" action-bar ") > -1) return "action_bar";
      if (c.indexOf(" form-status ") > -1) return "form_fallback";
      if (n.tagName === "SECTION" && n.id) return n.id.slice(0, 40);
      n = n.parentNode;
    }
    return "body";
  }

  var api = { clickEvent: clickEvent, formStartEvent: formStartEvent, payload: payload,
              locationOf: locationOf, KEY: KEY, ALLOWED: ALLOWED };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  root.dsteampsAnalytics = api;

  // ---------------------------------------------------------------- browser
  var dl = root.dataLayer = root.dataLayer || [];
  var gtag = root.gtag || function () { dl.push(arguments); };
  var doc = document;
  var pageType = doc.body.getAttribute("data-page-type") || "other";
  var attr = root.dsteampsAttr || {};      // first-touch utm_* from lead-form.js
  var push = function (name, extra) {
    var f = { page_type: pageType };
    UTM.forEach(function (k) { if (attr[k]) f[k] = attr[k]; });
    Object.keys(extra || {}).forEach(function (k) { f[k] = extra[k]; });
    try { dl.push(payload(name, f)); } catch (e) { /* never break the page */ }
  };
  root.dsteampsTrack = push;

  var read = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var write = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } };
  var gpc = navigator.globalPrivacyControl === true;

  var banner = doc.getElementById("consent");
  var setChoice = function (v) {
    write(v);
    if (v === "granted") activatePixel();
    gtag("consent", "update", { analytics_storage: v === "granted" ? "granted" : "denied" });
    dl.push({ event: "consent_choice", consent_analytics: v });
    if (banner) banner.hidden = true;
    var st = doc.querySelectorAll("[data-consent-status]");
    for (var i = 0; i < st.length; i++) st[i].textContent = statusText(v);
  };
  var statusText = function (v) {
    return v === "granted" ? "Your current choice: analytics allowed."
         : v === "denied" ? "Your current choice: analytics declined (opted out)."
         : gpc ? "Your browser sent a Global Privacy Control signal, so analytics stay off."
         : "You have not made a choice yet. Analytics stay off until you accept.";
  };

  // Coldwell Banker Home CRM pixel: shipped inert in <template id="home-pixel">
  // (only when configured AND the privacy page is approved). Activated once,
  // and only after the visitor has accepted analytics.
  var pixelDone = false;
  var activatePixel = function () {
    var t = doc.getElementById("home-pixel");
    if (pixelDone || !t || !t.content) return;
    pixelDone = true;
    var frag = t.content.cloneNode(true);
    var olds = frag.querySelectorAll("script");
    for (var i = 0; i < olds.length; i++) {        // cloned scripts do not run; recreate them
      var s = doc.createElement("script");
      for (var a = 0; a < olds[i].attributes.length; a++) { var an = olds[i].attributes[a].name; s.setAttribute(an, olds[i].getAttribute(an)); }
      s.text = olds[i].text;
      olds[i].parentNode.replaceChild(s, olds[i]);
    }
    doc.body.appendChild(frag);
  };

  var current = read();
  if (current === "granted") activatePixel();
  if (banner && !current && !gpc) banner.hidden = false;
  var st0 = doc.querySelectorAll("[data-consent-status]");
  for (var j = 0; j < st0.length; j++) st0[j].textContent = statusText(current);

  doc.addEventListener("click", function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest("[data-consent], a[href]") : null;
    if (!t) return;
    var c = t.getAttribute("data-consent");
    if (c === "accept") { setChoice("granted"); return; }
    if (c === "decline" || c === "optout") { setChoice("denied"); return; }   // the link still navigates
    if (c === "settings") { if (banner) { banner.hidden = false; var b = banner.querySelector("button"); if (b) b.focus(); } ev.preventDefault(); return; }
    var name = clickEvent(t.getAttribute("href"));
    if (name) push(name, { link_location: locationOf(t) });
  }, true);

  var forms = doc.querySelectorAll("form[data-lead-type]");
  for (var k = 0; k < forms.length; k++) (function (form) {
    var started = false;
    form.addEventListener("focusin", function () {
      if (started) return;
      started = true;
      var lt = form.getAttribute("data-lead-type");
      push(formStartEvent(lt), { lead_type: lt });
    });
  })(forms[k]);

  push("FunnelPageView");
})(typeof window !== "undefined" ? window : this);
