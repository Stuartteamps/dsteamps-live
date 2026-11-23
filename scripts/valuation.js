/* Valuation request → Stuart Team CRM. Success is shown only after the server returns a saved lead id.
   Any failure falls back to a pre-filled email so no request is lost. Works without JS via the mailto action. */
(function () {
  var f = document.getElementById('val-form'); if (!f) return;
  var ENDPOINT = 'https://thepropertydna.com/.netlify/functions/capture-valuation-lead';
  var status = f.querySelector('.val-status'), btn = f.querySelector('button[type=submit]');
  var v = function (n) { return (f.elements[n] && f.elements[n].value || '').trim(); };
  var qs = new URLSearchParams(location.search);
  function mailFallback() {
    var body = 'Please prepare a valuation for:\n' + v('address') + '\n\nName: ' + v('name') + '\nEmail: ' + v('email') + '\nPhone: ' + v('phone') + '\nTimeline: ' + v('timeline') + '\n\nSent from dsteamps.com';
    status.innerHTML = 'We couldn’t submit online. Opening an email to Dan instead — or call <a href="tel:+16196770900">(619) 677-0900</a>.';
    location.href = 'mailto:stuartteamps@gmail.com?subject=' + encodeURIComponent('Home valuation request: ' + v('address')) + '&body=' + encodeURIComponent(body);
  }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!v('address')) { f.elements.address.focus(); status.textContent = 'Add the property address.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) { f.elements.email.focus(); status.textContent = 'Add a valid email so Dan can send the valuation.'; return; }
    btn.disabled = true; btn.textContent = 'Sending…'; status.textContent = '';
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var t = setTimeout(function () { ctrl && ctrl.abort(); }, 12000);
    fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl && ctrl.signal,
      body: JSON.stringify({ address: v('address'), email: v('email'), name: v('name'), phone: v('phone'), timeline: v('timeline'), website: v('website'),
        pageUrl: location.href.split('#')[0], referrer: document.referrer || '', utmSource: qs.get('utm_source') || '', utmMedium: qs.get('utm_medium') || '', utmCampaign: qs.get('utm_campaign') || '' })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        clearTimeout(t);
        if (res.ok && res.d && res.d.success && res.d.leadId) {
          f.innerHTML = '<p class="val-done"><strong>Got it.</strong> Dan has your request for ' + v('address').replace(/[<>&]/g, '') +
            ' and will reach out today with next steps. Reference ' + String(res.d.leadId).slice(0, 8).toUpperCase() + '.</p>';
          window.stTrack && stTrack('valuation_saved');
        } else if (res.d && /required/.test(res.d.error || '')) {
          btn.disabled = false; btn.textContent = 'Request my valuation';
          status.textContent = res.d.error === 'valid_phone_required' ? 'Check the phone number (10 digits) or leave it blank.' : 'Check the address and email.';
        } else { mailFallback(); }
      }).catch(function () { clearTimeout(t); mailFallback(); });
  });
})();
