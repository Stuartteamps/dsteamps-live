/* dsteamps.com lead forms.
 *
 * Progressive enhancement only: with JS off the form still posts natively and
 * the endpoint answers with a plain page. With JS on, this posts JSON and
 * shows a confirmation ONLY when the endpoint returns ok:true. Any failure
 * shows Dan's phone and email instead -- never a fake success.
 * Independent of motion.js, which bails out under prefers-reduced-motion.
 *
 * Attribution: utm_* only (no click IDs, matching the endpoint). The FIRST
 * touch in a browser session is remembered (sessionStorage, wrapped in
 * try/catch), so someone who lands on /links/?utm_source=instagram and then
 * taps through to /home-value/ is still credited to Instagram.
 *
 * buildPayload() is pure and exported for tests/funnels.test.mjs.
 */
(function (root) {
  "use strict";

  var ATTR = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  // Fields the endpoint does not store as columns: folded into `message` so
  // Dan still sees them in the notification.
  var FOLD = [["areas", "Areas"], ["intent", "Buying/selling"]];
  var KEY = "dsteamps_attr_v1";

  /** Attribution from a query string + referrer, merged over a stored first touch. */
  function attribution(search, referrer, pathname, stored) {
    var q = {};
    String(search || "").replace(/^\?/, "").split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("=");
      var k = decodeURIComponent((i < 0 ? kv : kv.slice(0, i)).replace(/\+/g, " "));
      var v = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
      q[k] = v;
    });
    var fresh = {};
    ATTR.forEach(function (k) { if (q[k]) fresh[k] = String(q[k]).slice(0, 120); });
    var first = stored && typeof stored === "object" ? stored : null;
    // A new campaign click replaces the stored touch; plain navigation keeps it.
    var hasFresh = Object.keys(fresh).length > 0;
    var out = hasFresh || !first ? fresh : first;
    var clean = {};
    ATTR.forEach(function (k) { if (out[k]) clean[k] = out[k]; });
    return clean;
  }

  /**
   * The JSON body sent to the endpoint.
   * entries: [[name, value], ...] from the form (FormData order). Repeated
   * names (checkbox groups) are joined with ", ".
   * ctx: { type, pathname, attr, startedAt, now }
   */
  function buildPayload(entries, ctx) {
    var data = {};
    entries.forEach(function (kv) {
      var k = kv[0], v = typeof kv[1] === "string" ? kv[1] : "";
      if (Object.prototype.hasOwnProperty.call(data, k) && data[k] !== "") {
        data[k] = v ? data[k] + ", " + v : data[k];
      } else {
        data[k] = v;
      }
    });
    // The form's declared type is authoritative, whatever a hidden field says.
    data.type = ctx.type;
    data.source = data.source || ctx.pathname;
    var a = ctx.attr || {};
    Object.keys(a).forEach(function (k) { if (!data[k]) data[k] = a[k]; });
    var extra = FOLD.filter(function (f) { return data[f[0]]; })
      .map(function (f) { return f[1] + ": " + data[f[0]]; });
    if (extra.length) data.message = extra.join("\n") + (data.message ? "\n\n" + data.message : "");
    data.startedAt = ctx.startedAt || (ctx.now || Date.now()) - 10000;
    return data;
  }

  var api = { buildPayload: buildPayload, attribution: attribution, ATTR: ATTR, FOLD: FOLD };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  root.dsteampsLeads = api;

  // ---------------------------------------------------------------- browser
  var stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { stored = null; }
  var ref = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : "";
  var attr = attribution(location.search, ref, location.pathname, stored);
  try { sessionStorage.setItem(KEY, JSON.stringify(attr)); } catch (e) { /* private mode */ }
  root.dsteampsAttr = attr;   // analytics.js reads utm_* from here (never form fields)

  var params = {};
  location.search.replace(/^\?/, "").split("&").forEach(function (kv) {
    var i = kv.indexOf("="); if (i > 0) params[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
  });

  var forms = document.querySelectorAll("form[data-lead-type]");
  if (!forms.length) return;

  forms.forEach(function (form) {
    // Native (JS-off style) posts still carry attribution: fill the hidden inputs.
    Object.keys(attr).forEach(function (k) {
      var el = form.querySelector('input[type=hidden][name="' + k + '"]');
      if (el && !el.value) el.value = attr[k];
    });
    // /open-house/?listing=1450-lorena-way preselects the home.
    var sel = form.querySelector("[data-listing-select]");
    if (sel && params.listing) {
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === params.listing) { sel.selectedIndex = i; break; }
      }
    }
    if (!window.fetch) return;

    var started = 0;
    form.addEventListener("focusin", function () { if (!started) started = Date.now(); });

    var status = document.createElement("p");
    status.className = "form-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.appendChild(status);

    var unlock = form.getAttribute("data-unlock-target");
    var reveal = function () {
      var u = unlock && document.getElementById(unlock);
      if (u) u.hidden = false;
    };

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var btn = form.querySelector("[type=submit]");
      var entries = [];
      new FormData(form).forEach(function (v, k) { entries.push([k, v]); });
      var data = buildPayload(entries, {
        type: form.getAttribute("data-lead-type"), pathname: location.pathname,
        attr: attr, startedAt: started
      });
      if (btn) btn.disabled = true;
      status.textContent = "Sending...";

      fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.ok && j.ok) {
            form.reset();
            status.textContent = form.getAttribute("data-success") || "Received. Dan Stuart will be in touch shortly.";
            reveal();
            // Analytics conversion: ONLY here, after the endpoint said ok:true.
            // lead_type + page_type + utm_* only; never a form field value.
            try {
              if (window.dsteampsTrack) window.dsteampsTrack("Lead", { lead_type: data.type });
              else (window.dataLayer = window.dataLayer || []).push({ event: "Lead", lead_type: data.type });
            } catch (e) { }
          } else if (r.status === 422 && j.errors) {
            status.textContent = "Please check: " + j.errors.join("; ") + ".";
          } else {
            throw new Error("failed");
          }
        });
      }).catch(function () {
        status.innerHTML = 'Your request could not be sent. Please call Dan at ' +
          '<a href="tel:+16196770900">619-677-0900</a> or email ' +
          '<a href="mailto:stuartteamps@gmail.com">stuartteamps@gmail.com</a>.';
        // The guide is still theirs: our failure should not cost them the download.
        reveal();
      }).then(function () { if (btn) btn.disabled = false; });
    });
  });
})(typeof window !== "undefined" ? window : this);
