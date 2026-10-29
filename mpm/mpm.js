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

  function onCity(name) {
    var city = cities[name] || null;
    if (city === current) { return; }
    if (current && current.group) { groupSet(current, false); }
    current = city;
    if (city && city.group) { groupSet(city, true); }
    if (city && extras[city.name]) { setExtra(city.name, false); }
    if (city && window.innerWidth <= 600) {   // phones: get the big menu panel out of the way of the map
      setTimeout(function () {
        var mc = $('menu-content'), mt = $('menu-toggle');
        if (mc && mt && !mc.classList.contains('hidden')) { mt.click(); }
      }, 500);
    }
    syncBoxes();
    // cadastral (khasra) layers draw above master plans, even when chosen as the main layer
    if (map) {
      var mine = Object.keys(extras).map(function (k) { return extras[k]; });
      map.getLayers().getArray().forEach(function (l) {
        if (l instanceof ol.layer.WebGLTile && mine.indexOf(l) === -1) { l.setZIndex(city && city.top ? 10 : 0); }
      });
    }
    render(city);
    if (city && city.legendUrl && window.innerWidth > 900) { setOpen(true); } else { setOpen(false); }
  }

  // upstream sets #city-search.value programmatically on selection (no event), so watch it.
  function watch() {
    var inp = $('city-search');
    setInterval(function () { if (inp && inp !== document.activeElement) { onCity(inp.value.trim()); } }, 300);
  }

  // ---------- village groups (many small COGs, loaded only while in view) ----------
  var groups = {};
  function groupSync(c, g) {
    var v = map.getView(), z = v.getZoom(), base = c.group.replace('index.json', '');
    var e = ol.proj.transformExtent(v.calculateExtent(map.getSize()), 'EPSG:3857', 'EPSG:4326');
    g.idx.forEach(function (i) {
      var b = i.bounds, seen = z >= 12.5 && !(b[0] > e[2] || b[2] < e[0] || b[1] > e[3] || b[3] < e[1]);
      if (seen && !g.layers[i.code]) {
        g.layers[i.code] = new ol.layer.WebGLTile({ source: new ol.source.GeoTIFF({ sources: [{ url: base + i.code + '.tif' }], interpolate: true, normalize: true, wrapX: false }),
          opacity: parseFloat($('opacity-slider').value), zIndex: 10 });
        map.addLayer(g.layers[i.code]);
      } else if (!seen && g.layers[i.code]) { map.removeLayer(g.layers[i.code]); delete g.layers[i.code]; }
    });
  }
  function groupSet(c, on) {
    var g = groups[c.name];
    if (on && !g && map) {
      g = groups[c.name] = { layers: {} };
      fetch(c.group).then(function (r) { return r.json(); }).then(function (idx) {
        g.idx = idx; g.h = function () { groupSync(c, g); }; map.on('moveend', g.h); g.h();
      });
      if (map.getView().getZoom() < 12.5) { say('Zoom in to see khasra maps.'); }
    } else if (!on && g) {
      if (g.h) { map.un('moveend', g.h); }
      Object.keys(g.layers).forEach(function (k) { map.removeLayer(g.layers[k]); });
      delete groups[c.name];
    }
  }
  function groupOpacity(c, o) { var g = groups[c.name]; if (g) { Object.keys(g.layers).forEach(function (k) { g.layers[k].setOpacity(o); }); } }

  // ---------- several plans at once ----------
  function makeSource(c) {
    if (c.xyzUrl) { return new ol.source.XYZ({ url: c.xyzUrl, crossOrigin: 'anonymous' }); }
    return new ol.source.GeoTIFF({ sources: [{ url: c.cogUrl }], interpolate: true, normalize: true, wrapX: false });
  }

  function setExtra(name, on) {
    var c = cities[name];
    if (!map || !c) { return; }
    if (c.group) {
      groupSet(c, on);
      if (on) { extras[name] = { setOpacity: function (o) { groupOpacity(c, o); } }; } else { delete extras[name]; }
      var sg = $('swipe-toggle'); if (on && sg && sg.classList.contains('active')) { sg.click(); }
    } else if (on && !extras[name]) {
      var lyr = new ol.layer.WebGLTile({ source: makeSource(c), opacity: parseFloat($('opacity-slider').value), zIndex: c.top ? 10 : 0 });
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
