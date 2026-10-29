/* Superimposed Master Plans additions. Loaded after main.js; touches the upstream page only through its DOM
 * and by capturing the ol.Map it creates (main.js constructs it after cities.json loads, so the wrapper is in time).
 * - legend pane for the selected city (fields legendUrl, legendTitle, source, sourceUrl, note, bounds in mpm/legends.json)
 * - "more plans at once": extra overlay layers, so neighbouring plans can be viewed together
 * - Search Address also loads the plan(s) covering the place found
 * - ?city=<name>&plus=<name,name> deep links
 * - credit line, About text, comment UI hidden (see mpm.css and stub-supabase.js)
 */
(function () {
  'use strict';
  var cities = {};
  var list = [];
  var current = null;
  var pane, tab, fab, extrasBox, toast;
  var extras = {};   // name -> ol layer
  var map = null;

  // capture upstream's map instance
  var OrigMap = ol.Map;
  ol.Map = function (opts) { map = new OrigMap(opts); return map; };
  ol.Map.prototype = OrigMap.prototype;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html) { e.innerHTML = html; }
    return e;
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  function branding() {
    var h = document.querySelector('#menu-content h2');
    if (h) {
      h.textContent = 'Superimposed Master Plans';
    }
    document.title = 'Superimposed Master Plans';
    Array.prototype.forEach.call(document.querySelectorAll('label'), function (l) {
      if (l.textContent.trim() === 'Comments') { l.classList.add('mpm-hidden'); }
    });
    var modal = document.querySelector('#info-modal .modal-content');
    if (modal) {
      modal.appendChild(el('p', {}, '<strong>About this version:</strong> a public fork of <a href="https://github.com/datsvarun/master-plan-viewer" target="_blank" rel="noopener">Master Plan Viewer</a> by Varun Phadke, with added plans, map legends and a multi-plan view. ' +
        'Overlays are scanned government maps placed on the map by control points, so treat them as zone-level only (tens of metres of error). ' +
        'Comments are turned off here. Source and accuracy notes for each plan are in the Legend panel.'));
    }
    toast = el('div', { id: 'mpm-toast' });
    document.body.appendChild(toast);
  }

  function say(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('show'); }, 3500);
  }

  // ---------- legend pane ----------
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
    var host = $('bottom-left-controls');
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

  // ---------- selecting the main city through upstream's own dropdown ----------
  function selectCity(name, cb) {
    var inp = $('city-search'), tries = 0;
    (function attempt() {
      inp.value = name;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      var li = Array.prototype.find.call(document.querySelectorAll('#city-results li'), function (e) {
        return e.textContent.toLowerCase().indexOf(name.toLowerCase()) !== -1;
      });
      if (li) { ['mousedown', 'mouseup', 'click'].forEach(function (t) { li.dispatchEvent(new MouseEvent(t, { bubbles: true })); }); if (cb) { setTimeout(cb, 300); } }
      else if (++tries < 10) { setTimeout(attempt, 400); }
    })();
  }

  function onCity(name) {
    var city = cities[name] || null;
    if (city === current) { return; }
    current = city;
    if (city && extras[city.name]) { setExtra(city.name, false); }
    if (city && window.innerWidth <= 600) {   // phones: get the big menu panel out of the way of the map
      setTimeout(function () {
        var mc = $('menu-content'), mt = $('menu-toggle');
        if (mc && mt && !mc.classList.contains('hidden')) { mt.click(); }
      }, 500);
    }
    syncBoxes();
    render(city);
    if (city && city.legendUrl && window.innerWidth > 900) { setOpen(true); } else { setOpen(false); }
  }

  // upstream sets #city-search.value programmatically on selection (no event), so watch it.
  function watch() {
    var inp = $('city-search');
    setInterval(function () { if (inp && inp !== document.activeElement) { onCity(inp.value.trim()); } }, 300);
  }

  // ---------- several plans at once ----------
  function makeSource(c) {
    if (c.xyzUrl) { return new ol.source.XYZ({ url: c.xyzUrl, crossOrigin: 'anonymous' }); }
    return new ol.source.GeoTIFF({ sources: [{ url: c.cogUrl }], interpolate: true, normalize: true, wrapX: false });
  }

  function setExtra(name, on) {
    var c = cities[name];
    if (!map || !c) { return; }
    if (on && !extras[name]) {
      var lyr = new ol.layer.WebGLTile({ source: makeSource(c), opacity: parseFloat($('opacity-slider').value) });
      map.addLayer(lyr); extras[name] = lyr;
      var sw = $('swipe-toggle');
      if (sw && sw.classList.contains('active')) { sw.click(); say('Swipe compare is off while several plans are shown.'); }
    } else if (!on && extras[name]) {
      map.removeLayer(extras[name]); delete extras[name];
    }
    syncBoxes();
  }

  function syncBoxes() {
    if (!extrasBox) { return; }
    Array.prototype.forEach.call(extrasBox.querySelectorAll('input'), function (b) {
      b.checked = !!extras[b.value];
      b.disabled = !!(current && current.name === b.value);
    });
    var n = Object.keys(extras).length;
    extrasBox.querySelector('summary').textContent = 'More plans at once' + (n ? ' (' + n + ' added)' : '');
  }

  function buildExtras() {
    extrasBox = el('details', { id: 'mpm-extras' });
    extrasBox.innerHTML = '<summary>More plans at once</summary><p class="hint">Tick plans to show them together with the selected city, for example neighbouring cities that meet at a border.</p><div class="mpm-list"></div>';
    var box = extrasBox.querySelector('.mpm-list');
    list.slice().sort(function (a, b) { return (b.legendUrl ? 1 : 0) - (a.legendUrl ? 1 : 0) || a.name.localeCompare(b.name); }).forEach(function (c) {
      var lab = el('label', {}, '<input type="checkbox" value="' + esc(c.name) + '"> ' + esc(c.name));
      lab.querySelector('input').addEventListener('change', function (e) { setExtra(c.name, e.target.checked); });
      box.appendChild(lab);
    });
    var wrap = $('city-search-wrapper');
    wrap.after(extrasBox);
    $('opacity-slider').addEventListener('input', function (e) {
      Object.keys(extras).forEach(function (k) { extras[k].setOpacity(parseFloat(e.target.value)); });
    });
  }

  // ---------- Search Address loads the plans covering the place ----------
  function distKm(a, b) {
    var R = 6371, dLat = (b[1] - a[1]) * Math.PI / 180, dLon = (b[0] - a[0]) * Math.PI / 180;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function covers(c, p) {
    if (c.bounds) { return p[0] >= c.bounds[0] && p[0] <= c.bounds[2] && p[1] >= c.bounds[1] && p[1] <= c.bounds[3]; }
    // upstream entries only give a centre and start zoom: assume the plan fills about 1.5 screens at that zoom
    var half = 0.5 * 800 * 156.543 * Math.cos(c.center[1] * Math.PI / 180) / Math.pow(2, c.zoom) * 1.5;
    return distKm(p, c.center) <= half;
  }

  function afterAddressPick() {
    if (!map) { return; }
    var p = ol.proj.toLonLat(map.getView().getCenter());
    var hits = list.filter(function (c) { return covers(c, p); })
      .sort(function (a, b) { return distKm(p, a.center) - distKm(p, b.center); });
    if (!hits.length) { say('No plan in this list covers that place.'); return; }
    var names = hits.map(function (c) { return c.name; });
    if (current && names.indexOf(current.name) !== -1) {
      // keep the current plan, add the others that cover this spot
      names.filter(function (n) { return n !== current.name; }).slice(0, 2).forEach(function (n) { setExtra(n, true); });
      return;
    }
    var keepCenter = map.getView().getCenter(), keepZoom = map.getView().getZoom();
    selectCity(names[0], function () {
      // upstream recentres on the city when it loads; go back to the place that was searched
      map.getView().setCenter(keepCenter); map.getView().setZoom(keepZoom);
      names.slice(1, 3).forEach(function (n) { setExtra(n, true); });
    });
    say('Loaded: ' + names.slice(0, 3).join(', '));
  }

  function hookSearch() {
    var results = $('search-results'), inp = $('address-search');
    // wait for upstream's fly-to to finish, then look at where the map ended up
    function soon() {
      var done = false;
      function go() { if (!done) { done = true; setTimeout(afterAddressPick, 150); } }
      map.once('moveend', go); setTimeout(go, 2500);
    }
    results.addEventListener('mousedown', function (e) { if (e.target.closest('li:not(.no-results)')) { soon(); } });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && results.querySelector('li.active, li[aria-selected="true"]')) { soon(); }
    });
  }

  function deepLink() {
    var q = new URLSearchParams(location.search), want = q.get('city'), plus = q.get('plus');
    if (!want) { return; }
    selectCity(want, function () {
      (plus ? plus.split(',') : []).forEach(function (frag) {
        var c = list.find(function (x) { return x.name.toLowerCase().indexOf(frag.trim().toLowerCase()) !== -1; });
        if (c && (!current || c.name !== current.name)) { setExtra(c.name, true); }
      });
    });
  }

  Promise.all([fetch('cities.json').then(function (r) { return r.json(); }), fetch('mpm/legends.json').then(function (r) { return r.json(); })]).then(function (res) {
    var d = res[0], extra = res[1];
    d.cities.forEach(function (c) { var m = Object.assign({}, c, extra[c.name] || {}); cities[c.name] = m; list.push(m); });
    branding(); buildUI(); buildExtras(); render(null); watch(); hookSearch();
    setTimeout(deepLink, 600);
  });
})();
