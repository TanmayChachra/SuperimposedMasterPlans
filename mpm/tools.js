/* Click-for-info, sharing (link, WhatsApp, client view) and PDF extract. Loaded after mpm.js and built only on its small window.mpm API.
 * Privacy: owner and khatauni data are NOT fetched or stored here. The info card only helps you open the government portals with the right village and khasra. */
(function () {
  'use strict';
  var map, M, grid = null, zc = {}, pop, popEl, q = new URLSearchParams(location.search);
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function copy(t, msg) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { M.say(msg || 'Copied'); }, function () { window.prompt('Copy this:', t); }); }

  // ---------- share links ----------
  function shareUrl(client) {
    var parts = M.order.map(function (n) { var l = M.layerOf(n); return encodeURIComponent(n) + '~' + (l ? +l.getOpacity().toFixed(2) : 1) + '~' + (l && l.getVisible() ? 1 : 0); });
    var v = map.getView(), c = ol.proj.toLonLat(v.getCenter());
    return location.origin + location.pathname + '?L=' + encodeURIComponent(parts.join('|')) + '&P=' + encodeURIComponent(M.current ? M.current.name : '') +
      '&v=' + c[0].toFixed(5) + ',' + c[1].toFixed(5) + ',' + v.getZoom().toFixed(2) + (window.satLayer && window.satLayer.getVisible() ? '&sat=1' : '') + (client ? '&client=1' : '');
  }

  function restore() {
    var L = q.get('L'); if (!L) { return; }
    var items = L.split('|').map(function (s) { var p = s.split('~'); return { name: decodeURIComponent(p[0]), op: parseFloat(p[1]), vis: p[2] !== '0' }; }).filter(function (i) { return M.cities[i.name]; });
    if (!items.length) { return; }
    var P = q.get('P') && M.cities[q.get('P')] ? q.get('P') : items[items.length - 1].name, v = (q.get('v') || '').split(',').map(parseFloat);
    function apply() {
      M.setOrder(items.map(function (i) { return i.name; }));
      items.forEach(function (i) {
        if (i.name === P) { var s = $('opacity-slider'); s.value = i.op; s.dispatchEvent(new Event('input', { bubbles: true })); }
        var l = M.layerOf(i.name); if (l) { l.setOpacity(i.op); l.setVisible(i.vis); }
      });
      if (v.length === 3 && !v.some(isNaN)) { map.getView().setCenter(ol.proj.fromLonLat([v[0], v[1]])); map.getView().setZoom(v[2]); }
      if (q.get('sat') === '1' && window.satLayer && !window.satLayer.getVisible()) { $('basemap-toggle-btn').click(); }
      M.renderLayers();
    }
    M.selectCity(P, function () { items.forEach(function (i) { if (i.name !== P) { M.setExtra(i.name, true); } }); setTimeout(apply, 900); setTimeout(apply, 2200); });
  }

  function clientMode() {
    document.body.classList.add('mpm-client');
    var sub = document.querySelector('.mpm-brand small'); if (sub) { sub.textContent = 'Master plan overlay'; }
    Array.prototype.forEach.call(document.querySelectorAll('#menu-content > label, #menu-content > div, #menu-content > button'), function (n) {
      if (n.id === 'search-wrapper' || n.id === 'swipe-toggle' || (n.tagName === 'LABEL' && /find a place|compare/i.test(n.textContent))) { n.classList.add('mpm-hidden'); }
    });
    var add = $('mpm-add'); if (add) { add.classList.add('mpm-hidden'); }
    var loc = $('geolocate-btn'); if (loc && loc.parentNode) { loc.parentNode.classList.add('mpm-hidden'); }
  }

  function shareBar() {
    var sec = document.createElement('section'); sec.id = 'mpm-share';
    sec.innerHTML = '<label>Share</label><div class="row"><button type="button" data-a="link">Copy link</button><button type="button" data-a="wa">WhatsApp</button><button type="button" data-a="client">Client link</button><button type="button" data-a="pdf">PDF</button></div>';
    var anchor = $('swipe-toggle'); anchor.parentNode.appendChild(sec);
    sec.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a'); if (!a) { return; }
      if (a === 'link') { copy(shareUrl(false), 'Link copied'); }
      if (a === 'client') { copy(shareUrl(true), 'Client link copied (read-only view)'); }
      if (a === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent('Silverleaf Buildcon map: ' + shareUrl(true)), '_blank', 'noopener'); }
      if (a === 'pdf') { exportPdf(); }
    });
  }

  // ---------- PDF extract ----------
  function loadPdfLib() {
    return window.jspdf ? Promise.resolve() : new Promise(function (ok, bad) {
      var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    });
  }
  function snapshot() {
    return new Promise(function (ok) {
      map.once('rendercomplete', function () {
        var size = map.getSize(), c = document.createElement('canvas'); c.width = size[0]; c.height = size[1]; var ctx = c.getContext('2d');
        Array.prototype.forEach.call(map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer'), function (cv) {
          if (!cv.width) { return; }
          var op = cv.parentNode.style.opacity || cv.style.opacity; ctx.globalAlpha = op === '' ? 1 : Number(op);
          var t = cv.style.transform, m = t ? t.match(/^matrix\(([^(]*)\)$/)[1].split(',').map(Number) : [parseFloat(cv.style.width) / cv.width, 0, 0, parseFloat(cv.style.height) / cv.height, 0, 0];
          ctx.setTransform.apply(ctx, m); ctx.drawImage(cv, 0, 0);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0); ok(c);
      });
      map.renderSync();
    });
  }
  function exportPdf() {
    M.say('Preparing PDF...');
    Promise.all([loadPdfLib(), snapshot()]).then(function (r) {
      var cv = r[1], img; try { img = cv.toDataURL('image/jpeg', 0.92); } catch (e) { M.say('Could not capture the map (a tile source blocked it).'); return; }
      var J = window.jspdf.jsPDF, d = new J({ orientation: 'landscape', unit: 'mm', format: 'a4' }), W = 297, H = 210;
      d.setFillColor(15, 47, 41); d.rect(0, 0, W, 16, 'F'); d.setTextColor(255); d.setFontSize(14); d.text('Silverleaf Buildcon', 10, 10.5); d.setFontSize(9); d.text('Master plan overlay | map extract', 70, 10.5);
      var mw = 190, mh = Math.min(H - 30, mw * cv.height / cv.width); mw = mh * cv.width / cv.height; d.addImage(img, 'JPEG', 10, 22, mw, mh);
      var c = ol.proj.toLonLat(map.getView().getCenter()), x = mw + 16, y = 24, tw = W - x - 8;
      d.setTextColor(30); d.setFontSize(10); d.setFont(undefined, 'bold'); d.text('Map centre', x, y); d.setFont(undefined, 'normal'); y += 5; d.setFontSize(9);
      d.text(c[1].toFixed(5) + ', ' + c[0].toFixed(5), x, y); y += 4.5; d.text('maps.google.com/?q=' + c[1].toFixed(5) + ',' + c[0].toFixed(5), x, y, { maxWidth: tw }); y += 8;
      d.text(new Date().toLocaleString('en-IN'), x, y); y += 9;
      d.setFont(undefined, 'bold'); d.setFontSize(10); d.text('Layers (top first)', x, y); d.setFont(undefined, 'normal'); y += 5; d.setFontSize(8.5);
      M.order.slice().reverse().forEach(function (n) {
        var cc = M.cities[n], l = M.layerOf(n); if (!l || !l.getVisible()) { return; }
        var t = d.splitTextToSize(n + ' (opacity ' + Math.round(l.getOpacity() * 100) + '%)' + (cc.source ? '. Source: ' + cc.source : '') + (cc.note ? '. ' + cc.note : ''), tw);
        if (y + t.length * 3.6 > H - 28) { return; } d.text(t, x, y); y += t.length * 3.6 + 2;
      });
      d.setFontSize(7.5); d.setTextColor(110); d.text(d.splitTextToSize('For internal and client reference only. Not a legal document or survey. Overlays are scanned government maps placed with control points (zone-level accuracy). Verify with the issuing authority and the khatauni before any decision. Base map: OpenStreetMap contributors.', tw), x, H - 22);
      d.save('Silverleaf-map-' + new Date().toISOString().slice(0, 10) + '.pdf');
    }).catch(function () { M.say('PDF could not be created.'); });
  }

  // ---------- click for info ----------
  function tehsilName(c) { return c === '000738' ? 'Modinagar' : c === '000739' ? 'Ghaziabad' : c; }
  function villageAt(xy) {
    if (!grid) { return null; }
    var i = Math.floor((xy[0] - grid.meta.x0) / grid.meta.res), j = Math.floor((grid.meta.y1 - xy[1]) / grid.meta.res);
    if (i < 0 || j < 0 || i >= grid.w || j >= grid.h) { return null; }
    var id = grid.data[(j * grid.w + i) * 4]; return id ? grid.meta.villages[id - 1] : null;
  }
  function zoneAt(name, px) {
    var t = zc[name], l = M.layerOf(name); if (!t || !l || !l.getVisible() || !l.getOpacity()) { return null; }
    var sum = [0, 0, 0], n = 0;
    [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].forEach(function (o) {
      var d = l.getData([px[0] + o[0], px[1] + o[1]]); if (d && d.length >= 4 && d[3] > 0) { sum[0] += d[0]; sum[1] += d[1]; sum[2] += d[2]; n++; }
    });
    if (!n) { return { label: 'outside this plan' }; }
    var rgb = sum.map(function (v) { return v / n; });
    var ranked = t.items.map(function (it) { return { label: it.label, d: Math.hypot(rgb[0] - it.rgb[0], rgb[1] - it.rgb[1], rgb[2] - it.rgb[2]) }; }).sort(function (a, b) { return a.d - b.d; });
    if (t.exact) { return { label: ranked[0].label }; }
    // hatch patterns blur colours, so give the two closest legend colours, not one confident answer
    return ranked[0].d > 90 ? { label: 'no clear match, see the legend', approx: false } : { label: ranked[0].label + ' or ' + ranked[1].label, approx: true };
  }
  function onClick(e) {
    if (document.body.classList.contains('mpm-client') && false) { return; }
    var xy = e.coordinate, ll = ol.proj.toLonLat(xy), v = villageAt(xy), rows = '';
    M.order.slice().reverse().forEach(function (n) { var z = zoneAt(n, e.pixel); if (z) { rows += '<div class="r"><span>' + esc(n) + '</span><b>' + esc(z.label) + (z.approx ? ' <i>(indicative)</i>' : '') + '</b></div>'; } });
    var ctx = 'Ghaziabad district (140)' + (v ? ', ' + tehsilName(v.tehsil) + ' tehsil (' + v.tehsil + '), village ' + v.name + ' (' + v.code + ')' : '');
    popEl.innerHTML = '<button class="x" type="button" aria-label="Close">&#10005;</button>' +
      '<div class="t">' + ll[1].toFixed(5) + ', ' + ll[0].toFixed(5) + ' <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + ll[1].toFixed(5) + ',' + ll[0].toFixed(5) + '">Google Maps</a></div>' +
      '<div class="r"><span>Village (portal)</span><b>' + (v ? esc(v.name) + ' <small>' + tehsilName(v.tehsil) + ' tehsil</small>' : 'not in the mapped villages') + '</b></div>' + rows +
      (v ? '<div class="kh"><input id="mpm-kh" type="text" inputmode="numeric" placeholder="Khasra no. (read it off the map)"><div class="b"><button type="button" data-k="copy">Copy details</button><a target="_blank" rel="noopener" href="https://upbhunaksha.gov.in/">Bhu-Naksha</a><a target="_blank" rel="noopener" href="https://upbhulekh.gov.in/">Khatauni</a></div>' +
        '<p>Owner records are on the government Bhulekh portal. Open it, choose Ghaziabad, ' + tehsilName(v.tehsil) + ' tehsil and the village, then enter the khasra. We do not fetch or store owner data.</p></div>' : '');
    pop.setPosition(xy);
    popEl.querySelector('.x').onclick = function () { pop.setPosition(undefined); };
    var cb = popEl.querySelector('[data-k=copy]'); if (cb) { cb.onclick = function () { copy(ctx + ', khasra ' + ($('mpm-kh').value || '?'), 'Details copied'); }; }
  }

  function init() {
    M = window.mpm; map = M.map;
    popEl = document.createElement('div'); popEl.id = 'mpm-pop'; document.body.appendChild(popEl);
    pop = new ol.Overlay({ element: popEl, positioning: 'bottom-center', offset: [0, -10], stopEvent: true }); map.addOverlay(pop);
    map.on('singleclick', onClick);
    M.snapshot = snapshot;   // also used for testing
    shareBar();
    if (q.get('client') === '1') { clientMode(); }
    Promise.all([fetch('mpm/data/villages.json').then(function (r) { return r.json(); }), fetch('mpm/data/zonecolors.json').then(function (r) { return r.json(); })]).then(function (r) {
      zc = r[1]; var img = new Image(); img.onload = function () {
        var c = document.createElement('canvas'); c.width = img.width; c.height = img.height; var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
        grid = { meta: r[0], w: img.width, h: img.height, data: x.getImageData(0, 0, img.width, img.height).data };
      }; img.src = 'mpm/data/villages_grid.png';
    }).catch(function () { /* click info still works without them */ });
    restore();
  }
  if (window.mpm && window.mpm.ready) { init(); } else { document.addEventListener('mpm:ready', init); }
})();
