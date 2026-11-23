/* First-party, cookieless conversion counter. Sends only: action, page path, utm tags, referrer.
   No cookies, no identifiers, no personal data. Respects Do Not Track / Global Privacy Control. */
(function () {
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) { window.stTrack = function () {}; return; }
  var URL_ = 'https://thepropertydna.com/.netlify/functions/track-dsteamps-event';
  var q = new URLSearchParams(location.search);
  var base = { p: location.pathname, src: q.get('utm_source') || '', med: q.get('utm_medium') || '', cmp: q.get('utm_campaign') || '', ref: document.referrer || '' };
  function send(e) {
    var body = JSON.stringify(Object.assign({ e: e }, base));
    try { if (navigator.sendBeacon && navigator.sendBeacon(URL_, new Blob([body], { type: 'text/plain' }))) return; } catch (x) {}
    try { fetch(URL_, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }); } catch (x) {}
  }
  window.stTrack = send;
  send('page_view');
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href');
    if (/^tel:/.test(h)) send('call_click'); else if (/^sms:/.test(h)) send('text_click'); else if (/^mailto:/.test(h)) send('email_click');
  }, true);
  var f = document.getElementById('val-form'), started = false;
  if (f) f.addEventListener('input', function () { if (!started) { started = true; send('valuation_start'); } });
})();
