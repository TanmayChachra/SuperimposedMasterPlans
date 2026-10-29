/* MasterPlanMapping additions. Loaded after main.js; touches the upstream page only through its DOM.
 * - legend pane for the selected city (fields legendUrl, legendTitle, source, sourceUrl, note in cities.json)
 * - ?city=<name> deep link
 * - credit line, About text, comment UI hidden (see mpm.css and stub-supabase.js)
 */
(function () {
  'use strict';
  var cities = {};
  var current = null;
  var pane, tab, fab;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html) { e.innerHTML = html; }
    return e;
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function branding() {
    var h = document.querySelector('#menu-content h2');
    if (h) {
      h.textContent = 'NCR Master Plan Map';
      h.after(el('p', { 'class': 'mpm-credit' },
        'Fork of <a href="https://github.com/datsvarun/master-plan-viewer" target="_blank" rel="noopener">Master Plan Viewer</a> by Varun Phadke.'));
    }
    document.title = 'NCR Master Plan Map';
    Array.prototype.forEach.call(document.querySelectorAll('label'), function (l) {
      if (l.textContent.trim() === 'Comments') { l.classList.add('mpm-hidden'); }
    });
    var modal = document.querySelector('#info-modal .modal-content');
    if (modal) {
      modal.appendChild(el('p', {}, '<strong>About this version:</strong> a public fork of Master Plan Viewer with added NCR plans and map legends. ' +
        'Overlays are scanned government maps placed on the map by control points, so treat them as zone-level only (tens of metres of error). ' +
        'Comments are turned off here. Source and accuracy notes for each plan are in the Legend panel.'));
    }
  }

  function buildUI() {
    pane = el('aside', { id: 'mpm-legend', 'aria-label': 'Map legend' });
    pane.innerHTML = '<header><h3>Legend</h3><button type="button" aria-label="Close legend">✕</button></header><div class="body"></div>';
    document.body.appendChild(pane);
    pane.querySelector('button').addEventListener('click', function () { setOpen(false); });

    tab = el('button', { id: 'mpm-legend-tab', type: 'button', hidden: '' }, 'Legend');
    tab.addEventListener('click', function () { setOpen(!pane.classList.contains('open')); });
    document.body.appendChild(tab);

    var row = el('div', { 'class': 'fab-row' });
    fab = el('button', { id: 'mpm-legend-fab', type: 'button', 'class': 'fab', title: 'Map legend' }, '🎨');
    row.appendChild(fab);
    row.appendChild(el('span', { 'class': 'fab-label' }, 'Legend'));
    fab.addEventListener('click', function () { setOpen(!pane.classList.contains('open')); });
    var host = document.getElementById('bottom-left-controls');
    if (host) { host.insertBefore(row, host.children[1] || null); }
  }

  function setOpen(open) {
    pane.classList.toggle('open', open);
    if (fab) { fab.classList.toggle('active', open); }
    if (tab) { tab.hidden = open || !current; }
  }

  function render(city) {
    var body = pane.querySelector('.body');
    pane.querySelector('h3').textContent = city ? 'Legend: ' + city.name : 'Legend';
    if (!city) { body.innerHTML = '<p class="none">Select a city to see its legend.</p>'; return; }
    var meta = '';
    if (city.legendTitle) { meta += '<strong>' + esc(city.legendTitle) + '</strong><br>'; }
    if (city.source) {
      meta += 'Source: ' + (city.sourceUrl ? '<a href="' + esc(city.sourceUrl) + '" target="_blank" rel="noopener">' + esc(city.source) + '</a>' : esc(city.source)) + '<br>';
    }
    if (city.note) { meta += esc(city.note); }
    var img = city.legendUrl
      ? '<a href="' + esc(city.legendUrl) + '" target="_blank" rel="noopener"><img src="' + esc(city.legendUrl) + '" alt="Legend of ' + esc(city.name) + '" loading="lazy"></a><div class="hint">Tap the image to open it full size.</div>'
      : '<p class="none">No separate legend for this plan. If the overlay is a full map sheet, the legend is printed on the sheet itself.</p>';
    body.innerHTML = '<p class="meta">' + meta + '</p>' + img;
  }

  function onCity(name) {
    var city = cities[name] || null;
    if (city === current) { return; }
    current = city;
    render(city);
    if (city && city.legendUrl && window.innerWidth > 900) { setOpen(true); } else { setOpen(false); }
  }

  // upstream sets #city-search.value programmatically on selection (no event), so watch it.
  function watch() {
    var inp = document.getElementById('city-search');
    setInterval(function () { if (inp && inp !== document.activeElement) { onCity(inp.value.trim()); } }, 300);
  }

  function deepLink() {
    var want = new URLSearchParams(location.search).get('city');
    if (!want) { return; }
    var inp = document.getElementById('city-search');
    var tries = 0;
    (function attempt() {
      inp.value = want;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      var li = Array.prototype.find.call(document.querySelectorAll('#city-results li'), function (e) {
        return e.textContent.toLowerCase().indexOf(want.toLowerCase()) !== -1;
      });
      if (li) { ['mousedown', 'mouseup', 'click'].forEach(function (t) { li.dispatchEvent(new MouseEvent(t, { bubbles: true })); }); }
      else if (++tries < 10) { setTimeout(attempt, 400); }
    })();
  }

  Promise.all([fetch('cities.json').then(function (r) { return r.json(); }), fetch('mpm/legends.json').then(function (r) { return r.json(); })]).then(function (res) {
    var d = res[0], extra = res[1];
    d.cities.forEach(function (c) { cities[c.name] = Object.assign({}, c, extra[c.name] || {}); });
    branding(); buildUI(); render(null); watch();
    setTimeout(deepLink, 600);
  });
})();
