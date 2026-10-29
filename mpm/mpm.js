/* Superimposed Master Plans additions. Loaded after main.js; touches the upstream page only through its DOM
 * and by capturing the ol.Map it creates (main.js constructs it after cities.json loads, so the wrapper is in time).
 * - legend pane for the selected city (fields legendUrl, legendTitle, source, sourceUrl, note, bounds in mpm/legends.json)
 * - layers panel: several plans at once, each with its own visibility, opacity, legend and remove button
 * - Search Address also loads the plan(s) covering the place found
 * - ?city=<name>&plus=<name,name> deep links
 * - credit line, About text, comment UI hidden (see mpm.css and stub-supabase.js)
 */
(function () {
  'use strict';
  var cities = {};
  var list = [];
  var current = null;
  var pane, tab, fab, toast;
  var extras = {};   // name -> ol layer
  var order = [];    // layer names, bottom to top
  var map = null;

  // capture upstream's map instance
  var OrigMap = ol.Map;
  ol.Map = function (opts) { map = new OrigMap(opts); window.mpmMap = map; return map; };   // window.mpmMap: handy for debugging
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
    var h = document.querySelector('#menu-content h2'), hd = $('controls-header');
    if (h) { h.remove(); }
    if (hd) { hd.insertAdjacentHTML('beforeend', '<div class="mpm-brand"><span class="mpm-mark">SB</span><div><strong>Silverleaf Buildcon</strong><small>Master plan overlay &middot; internal</small></div></div>'); }
    document.title = 'Silverleaf Buildcon | Master Plan Overlay';
    Array.prototype.forEach.call(document.querySelectorAll('label'), function (l) {
      var s = l.textContent.trim();
      if (s === 'Comments' || s === 'City') { l.classList.add('mpm-hidden'); }
      if (s === 'Search Address') { l.textContent = 'Find a place'; }
    });
    var modal = document.querySelector('#info-modal .modal-content');
    if (modal) {
      Array.prototype.forEach.call(Array.prototype.slice.call(modal.children), function (n) { if (n.id !== 'modal-close') { n.remove(); } });
      modal.insertAdjacentHTML('beforeend',
        '<h2>About this tool</h2>' +
        '<p><strong>Silverleaf Buildcon master plan overlay.</strong> An internal tool for viewing government master plans, zone maps and village khasra (plot) maps on top of a real map, for site selection and due diligence.</p>' +
        '<h3>How to read it</h3><p>Plans are scanned government maps placed on the map with control points, so treat them as zone-level (tens of metres of error). Khasra maps come from the UP Bhu-Naksha portal and are as accurate as the portal. Each layer\'s source, status and accuracy note is behind its <b>i</b> button.</p>' +
        '<h3>Disclaimer</h3><p>For internal reference only. This is not a legal document or a survey. Verify with the issuing authority (GDA, MDA, DDA, tehsil) and the khatauni before any decision. Draft or notified status is noted per layer.</p>' +
        '<h3>Data</h3><p>Base map &copy; OpenStreetMap contributors. Satellite imagery &copy; Esri. Government maps remain the property of the issuing departments.</p>');
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
    if (city.legendEn) {
      var en = '<p class="meta">' + esc(city.legendEnTitle || '') + '</p>' + city.legendEn.map(function (s) {
        return '<h4>' + esc(s.name) + '</h4>' + s.items.map(function (i) {
          return '<div class="mpm-row"><img src="' + esc(i.img) + '" alt="" loading="lazy"><span>' + esc(i.en) + '</span></div>';
        }).join('');
      }).join('');
      var lang = (function () { try { return localStorage.getItem('mpmLang') || 'en'; } catch (e) { return 'en'; } })();
      body.innerHTML = '<p class="meta">' + meta + '</p><div class="mpm-lang" role="tablist"><button type="button" data-l="en">English</button><button type="button" data-l="hi">हिन्दी (as printed)</button></div>' +
        '<div class="mpm-pane" data-l="en">' + en + '</div><div class="mpm-pane" data-l="hi">' + img + '</div>';
      var setLang = function (l) {
        Array.prototype.forEach.call(body.querySelectorAll('.mpm-lang button'), function (b) { b.classList.toggle('on', b.getAttribute('data-l') === l); });
        Array.prototype.forEach.call(body.querySelectorAll('.mpm-pane'), function (p) { p.hidden = p.getAttribute('data-l') !== l; });
        try { localStorage.setItem('mpmLang', l); } catch (e) { /* private mode */ }
      };
      Array.prototype.forEach.call(body.querySelectorAll('.mpm-lang button'), function (b) { b.addEventListener('click', function () { setLang(b.getAttribute('data-l')); }); });
      setLang(lang);
      return;
    }
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

  // free the previous plan's tiles when upstream swaps the main layer's source (phones ran out of memory after a few switches)
  var origSet = ol.layer.WebGLTile.prototype.setSource;
  ol.layer.WebGLTile.prototype.setSource = function (s) {
    var old = this.getSource(); origSet.call(this, s);
    if (old && old !== s && old.dispose) { setTimeout(function () { old.dispose(); }, 1500); }
  };

  // if the main plan did not come up (flaky network or a phone short of GPU memory), select it again, twice at most
  function watchLoad(city, n) {
    if (!city || !map) { return; }
    setTimeout(function () {
      if (current !== city) { return; }
      var main = mainLayer();
      var st = main && main.getSource() && main.getSource().getState();
      if (st === 'error' && n < 2) { say('Reloading ' + city.name + '...'); selectCity(city.name, function () { watchLoad(city, n + 1); }); }
      else if (st === 'loading' && n < 2) { watchLoad(city, n + 1); }
    }, 5000);
  }

  function onCity(name) {
    var city = cities[name] || null;
    if (city === current) { return; }
    var prev = current;
    current = city;
    watchLoad(city, 0);
    if (city && extras[city.name]) { setExtra(city.name, false); }
    if (city && window.innerWidth <= 600) {   // phones: get the big menu panel out of the way of the map
      setTimeout(function () {
        var mc = $('menu-content'), mt = $('menu-toggle');
        if (mc && mt && !mc.classList.contains('hidden')) { mt.click(); }
      }, 500);
    }
    var pi = prev ? order.indexOf(prev.name) : -1;          // the new primary layer takes the old one's place in the stack
    if (city) { if (pi >= 0) { order[pi] = city.name; } else { place(city.name); } } else if (pi >= 0) { order.splice(pi, 1); }
    applyOrder();
    if (city) { var ml = mainLayer(); if (ml) { ml.setVisible(true); } }
    renderLayers();
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

  var EXTRA_OPACITY = 0.85;
  // stacking order: new layers go on top, but khasra ("top") layers stay above master plans until you move them
  function layerOf(name) { return extras[name] || (current && current.name === name ? mainLayer() : null); }
  function applyOrder() { order.forEach(function (n, i) { var l = layerOf(n); if (l) { l.setZIndex(i + 1); } }); }
  function place(name) {
    order = order.filter(function (n) { return n !== name; });
    var c = cities[name], at = c && c.top ? order.length : order.findIndex(function (n) { return cities[n] && cities[n].top; });
    order.splice(at < 0 ? order.length : at, 0, name);
  }
  function move(name, dir) {
    var i = order.indexOf(name), j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) { return; }
    var x = order[i]; order[i] = order[j]; order[j] = x; applyOrder(); renderLayers();
  }
  function mainLayer() {
    var mine = Object.keys(extras).map(function (k) { return extras[k]; });
    return map && map.getLayers().getArray().filter(function (l) { return l instanceof ol.layer.WebGLTile && mine.indexOf(l) === -1; })[0];
  }

  function setExtra(name, on) {
    var c = cities[name];
    if (!map || !c) { return; }
    if (on && !extras[name]) {
      var lyr = new ol.layer.WebGLTile({ source: makeSource(c), opacity: EXTRA_OPACITY, zIndex: c.top ? 10 : 0 });
      map.addLayer(lyr); extras[name] = lyr; place(name); applyOrder();
      var sw = $('swipe-toggle');
      if (sw && sw.classList.contains('active')) { sw.click(); say('Swipe compare is off while several layers are shown.'); }
    } else if (!on && extras[name]) {
      var src = extras[name].getSource();
      map.removeLayer(extras[name]); delete extras[name]; order = order.filter(function (n) { return n !== name; }); applyOrder();
      if (src && src.dispose) { setTimeout(function () { src.dispose(); }, 1000); }
    }
    renderLayers();
  }

  function addLayer(name) {
    if (!cities[name] || extras[name] || (current && current.name === name)) { return; }
    if (!current) { selectCity(name); } else { setExtra(name, true); }
  }

  function removeLayer(name) {
    if (extras[name]) { setExtra(name, false); return; }
    var ml = mainLayer(); if (ml) { ml.setVisible(false); }
    $('city-search').value = ''; onCity('');
  }

  // layers panel: one row per active layer, each with its own visibility, opacity, legend and remove button.
  // The primary layer's slider is upstream's own #opacity-slider (upstream resets opacity from it on every city load).
  function renderLayers() {
    var box = $('mpm-layers'); if (!box) { return; }
    var slider = $('opacity-slider'); $('mpm-slider-park').appendChild(slider); box.innerHTML = '';
    function row(name, layer, isMain, pos) {
      var r = el('div', { 'class': 'mpm-layer' + (isMain ? ' main' : '') });
      r.innerHTML = '<label class="eye" title="Show or hide"><input type="checkbox"></label><div class="nm"><b></b><small></small></div><div class="mv"><button type="button" class="up" title="Move up (draw on top)">&#9650;</button><button type="button" class="dn" title="Move down">&#9660;</button></div><button type="button" class="lg" title="Legend, source and accuracy">i</button><button type="button" class="x" title="Remove layer">&#10005;</button><div class="op"></div>';
      r.querySelector('b').textContent = name; r.querySelector('small').textContent = (isMain ? 'primary' : 'overlay') + (pos === order.length - 1 ? ' \u00b7 on top' : '');
      var chk = r.querySelector('input'); chk.checked = layer ? layer.getVisible() : true;
      chk.addEventListener('change', function () { var l = layerOf(name); if (l) { l.setVisible(chk.checked); } });
      r.querySelector('.up').disabled = pos === order.length - 1; r.querySelector('.dn').disabled = pos === 0;
      r.querySelector('.up').addEventListener('click', function () { move(name, 1); });
      r.querySelector('.dn').addEventListener('click', function () { move(name, -1); });
      r.querySelector('.lg').addEventListener('click', function () { render(cities[name]); setOpen(true); });
      r.querySelector('.x').addEventListener('click', function () { removeLayer(name); });
      var op = r.querySelector('.op');
      if (isMain) { op.appendChild(slider); } else {
        var s = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: layer.getOpacity(), title: 'Opacity' });
        s.addEventListener('input', function () { layer.setOpacity(parseFloat(s.value)); }); op.appendChild(s);
      }
      box.appendChild(r);
    }
    for (var i = order.length - 1; i >= 0; i--) { var n = order[i], isMain = !!(current && current.name === n); row(n, layerOf(n), isMain, i); }
    if (!box.children.length) { box.appendChild(el('p', { 'class': 'mpm-empty' }, 'No layer yet. Add one below.')); }
    var sel = $('mpm-add');
    Array.prototype.forEach.call(sel.options, function (o) { if (o.value) { o.disabled = !!extras[o.value] || !!(current && current.name === o.value); } });
  }

  function groupOf(c) {
    if (/khasra/i.test(c.name)) { return 'Khasra (plots)'; }
    if (/zone/i.test(c.name)) { return 'Zones'; }
    return c._own ? 'Master plans' : 'Other cities';
  }

  function buildLayersUI() {
    var sec = el('section', { id: 'mpm-layerbox' });
    sec.innerHTML = '<label>Layers</label><div id="mpm-layers"></div><select id="mpm-add" aria-label="Add a layer"></select><div id="mpm-slider-park" hidden></div>';
    $('city-search-wrapper').after(sec); $('city-search-wrapper').classList.add('mpm-hidden');
    var sel = $('mpm-add'), groups = {};
    sel.appendChild(new Option('+ Add a layer', ''));
    ['Master plans', 'Zones', 'Khasra (plots)', 'Other cities'].forEach(function (g) { groups[g] = el('optgroup', { label: g }); sel.appendChild(groups[g]); });
    list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (c) { groups[groupOf(c)].appendChild(new Option(c.name, c.name)); });
    sel.addEventListener('change', function () { addLayer(sel.value); sel.value = ''; });
    renderLayers();
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
    d.cities.forEach(function (c) { var m = Object.assign({}, c, extra[c.name] || {}); m._own = !!extra[c.name]; cities[c.name] = m; list.push(m); });
    branding(); buildUI(); buildLayersUI(); render(null); watch(); hookSearch();
    setTimeout(deepLink, 600);
  });
  // cache: maps rarely change, so a service worker keeps plans, tiles and app files on the device (see sw.js). ?nosw=1 switches it off.
  if ('serviceWorker' in navigator) {
    if (/[?&]nosw=1/.test(location.search)) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
    } else { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ }); }); }
  }
})();
