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
  var bhu = null, lm = [], byCode = {}, last = null;
  function tehsilName(c) { return c === '000738' ? 'Modinagar' : c === '000739' ? 'Ghaziabad' : c === '001028' ? 'Loni' : c; }
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
    return ranked[0].d > 60 ? { label: 'no clear match, see the legend', approx: false } : { label: ranked[0].label + ' or ' + ranked[1].label, approx: true };
  }
  function km(a, b) { var R = 6371, r = Math.PI / 180, dl = (b[0] - a[0]) * r, dp = (b[1] - a[1]) * r, h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dl / 2) * Math.sin(dl / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
  function nearest(ll, type) {
    var best = null; lm.forEach(function (x) { if (x.t !== type) { return; } var d = km(ll, [x.lon, x.lat]); if (!best || d < best.d) { best = { n: x.n, d: d }; } }); return best;
  }
  function villageInfo() {   // the village the card is about: from the map grid, or picked from the Bhulekh list
    var s = $('mpm-vsel'), code = s && s.value ? s.value : (last.v ? last.v.code : ''); if (!code) { return null; }
    var b = byCode[code]; return { code: code, name: b ? b.name : (last.v ? last.v.name : code), tehsil: b ? b.tehsil : (last.v ? last.v.tehsil : '') };
  }
  function steps(v, kh) { return 'Ghaziabad district (140), ' + tehsilName(v.tehsil) + ' tehsil (' + v.tehsil + '), village ' + v.name + ' (' + v.code + ')' + (kh ? ', khasra ' + kh : ''); }

  function onClick(e) {
    var xy = e.coordinate, ll = ol.proj.toLonLat(xy), v = villageAt(xy), rows = '', zones = [];
    M.order.slice().reverse().forEach(function (n) { var z = zoneAt(n, e.pixel); if (z) { zones.push({ layer: n, label: z.label, approx: z.approx }); rows += '<div class="r"><span>' + esc(n) + '</span><b>' + esc(z.label) + (z.approx ? ' <i>(indicative)</i>' : '') + '</b></div>'; } });
    last = { xy: xy, ll: ll, v: v, zones: zones };
    var bn = v && byCode[v.code], vrow;
    if (v) { vrow = '<div class="r"><span>Village</span><b>' + esc(bn ? bn.name : v.name) + ' <small>' + tehsilName(v.tehsil) + ' tehsil</small></b></div>'; }
    else {
      var opts = '<option value="">Not on the map. Pick the village...</option>';
      if (bhu) { Object.keys(bhu.tehsils).forEach(function (k) { opts += '<optgroup label="' + esc(bhu.tehsils[k].name) + ' tehsil">' + bhu.tehsils[k].villages.split(';').map(function (s) { var p = s.split('|'); return '<option value="' + p[0] + '">' + esc(p[1]) + '</option>'; }).join('') + '</optgroup>'; }); }
      vrow = '<div class="r"><span>Village</span><b><select id="mpm-vsel">' + opts + '</select></b></div>';
    }
    var ls = nearest(ll, 'RRTS'), ms = nearest(ll, 'Metro');
    popEl.innerHTML = '<button class="x" type="button" aria-label="Close">&#10005;</button>' +
      '<div class="t">' + ll[1].toFixed(5) + ', ' + ll[0].toFixed(5) + ' <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + ll[1].toFixed(5) + ',' + ll[0].toFixed(5) + '">Google Maps</a></div>' +
      vrow + rows + (ls ? '<div class="r"><span>Nearest RRTS</span><b>' + esc(ls.n) + ' <small>' + ls.d.toFixed(1) + ' km straight</small></b></div>' : '') +
      '<div class="kh"><input id="mpm-kh" type="text" inputmode="numeric" placeholder="Khasra no. (read it off the map)"><div class="b"><button type="button" data-k="bhulekh">Open Khatauni</button><button type="button" data-k="naksha" class="alt">Bhu-Naksha</button><button type="button" data-k="report">One-page report</button></div>' +
      '<p id="mpm-hint">Khatauni opens on the Bhulekh district list and copies the village name: choose Ghaziabad, the tehsil, paste in Search Village, then enter the khasra. Owner details come from Bhulekh itself; this site does not fetch or store them.</p></div>';
    pop.setPosition(xy);
    popEl.querySelector('.x').onclick = function () { pop.setPosition(undefined); };
    popEl.querySelector('.kh .b').onclick = function (ev) {
      var k = ev.target.getAttribute('data-k'); if (!k) { return; }
      var vi = villageInfo(), kh = $('mpm-kh').value.trim();
      if (k === 'report') { return exportReport(vi, kh); }
      if (!vi) { M.say('Pick the village first.'); return; }
      if (k === 'bhulekh') {
        copy(vi.name, 'Copied "' + vi.name + '". In Bhulekh: Ghaziabad > ' + tehsilName(vi.tehsil) + ' > paste in Search Village' + (kh ? ' > khasra ' + kh : ''));
        window.open('https://upbhulekh.gov.in/#/selection', '_blank', 'noopener');
      } else {
        copy(vi.code, 'Copied village code ' + vi.code + '. In Bhu-Naksha pick district 140, tehsil ' + vi.tehsil + ', then this village' + (kh ? ', plot ' + kh : ''));
        window.open('https://upbhunaksha.gov.in/', '_blank', 'noopener');
      }
    };
  }

  // ---------- one-page report (PDF, A4 portrait) ----------
  function shotAt(ll, zoom) {
    var v = map.getView(), c0 = v.getCenter(), z0 = v.getZoom();
    v.setCenter(ol.proj.fromLonLat(ll)); v.setZoom(zoom);
    // rendercomplete can fire before the new tiles even start loading, so give them time first
    return new Promise(function (ok) { setTimeout(ok, 3500); }).then(snapshot).then(function (cv) {
      var x = cv.getContext('2d'), cx = cv.width / 2, cy = cv.height / 2;
      x.strokeStyle = '#d32f2f'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.moveTo(cx - 18, cy); x.lineTo(cx + 18, cy); x.moveTo(cx, cy - 18); x.lineTo(cx, cy + 18); x.stroke();
      v.setCenter(c0); v.setZoom(z0); return cv;
    });
  }
  function exportReport(vi, kh) {
    if (!last) { return; }
    var ll = last.ll; M.say('Building the report, about 10 seconds...');
    return Promise.all([loadPdfLib(), shotAt(ll, 12.5).then(function (a) { return shotAt(ll, 16.5).then(function (b) { return [a, b]; }); })]).then(function (r) {
      var imgs; try { imgs = r[1].map(function (c) { var w = Math.min(c.width, c.height * 92 / 62), h = w * 62 / 92, o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, (c.width - w) / 2, (c.height - h) / 2, w, h, 0, 0, w, h); return o.toDataURL('image/jpeg', 0.9); }); } catch (e) { M.say('Could not capture the map (a tile source blocked it).'); return; }
      var J = window.jspdf.jsPDF, d = new J({ orientation: 'portrait', unit: 'mm', format: 'a4' }), W = 210, y;
      d.setFillColor(15, 47, 41); d.rect(0, 0, W, 20, 'F'); d.setTextColor(255); d.setFontSize(15); d.text('Silverleaf Buildcon', 10, 11); d.setFontSize(9.5); d.text('Plot report', 10, 16.5);
      d.text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), W - 10, 11, { align: 'right' });
      d.setTextColor(30); y = 29;
      function head(s) { d.setFont(undefined, 'bold'); d.setFontSize(10.5); d.setTextColor(15, 47, 41); d.text(s, 10, y); d.setDrawColor(200); d.line(10, y + 1.5, W - 10, y + 1.5); y += 7; d.setTextColor(30); d.setFont(undefined, 'normal'); d.setFontSize(9.5); }
      function kv(k, val) { d.setFont(undefined, 'bold'); var kt = d.splitTextToSize(k, 44); d.text(kt, 10, y); d.setFont(undefined, 'normal'); var t = d.splitTextToSize(String(val), 130); d.text(t, 58, y); y += Math.max(1, t.length, kt.length) * 4.8; }
      head('Plot');
      kv('Village', vi ? vi.name + ' (portal code ' + vi.code + ')' : 'not selected');
      kv('Tehsil / district', (vi ? tehsilName(vi.tehsil) + ' tehsil' : '-') + ', Ghaziabad district (140), Uttar Pradesh');
      kv('Khasra number', kh || 'not entered (read it off the khasra map)');
      kv('Coordinates', ll[1].toFixed(5) + ', ' + ll[0].toFixed(5) + '   maps.google.com/?q=' + ll[1].toFixed(5) + ',' + ll[0].toFixed(5));
      var rs = nearest(ll, 'RRTS'), ms = nearest(ll, 'Metro');
      kv('Nearest RRTS station', rs ? rs.n + ', ' + rs.d.toFixed(1) + ' km straight line' : '-');
      kv('Nearest Delhi Metro', ms ? ms.n + ', ' + ms.d.toFixed(1) + ' km straight line' : '-');
      y += 2; head('Planning (from the layers shown on the map)');
      if (last.zones.length) { last.zones.forEach(function (z) { kv(z.layer, z.label + (z.approx ? ' (indicative: closest legend colours)' : '')); }); }
      else { kv('Layers', 'no zone layer was visible when the report was made'); }
      M.order.slice().reverse().forEach(function (n) { var cc = M.cities[n], l = M.layerOf(n); if (l && l.getVisible() && cc.source) { var t = d.splitTextToSize(n + ': ' + cc.source, W - 20); d.setFontSize(7.5); d.setTextColor(100); d.text(t.slice(0, 2), 10, y); y += Math.min(t.length, 2) * 3.4; d.setFontSize(9.5); d.setTextColor(30); } });
      y += 3; head('Map');
      var iw = 92, ih = 62; d.addImage(imgs[0], 'JPEG', 10, y, iw, ih); d.addImage(imgs[1], 'JPEG', 108, y, iw, ih);
      d.setFontSize(7.5); d.setTextColor(100); d.text('Wider area', 10, y + ih + 3.5); d.text('Close-up (red ring = selected point)', 108, y + ih + 3.5); y += ih + 9; d.setFontSize(9.5); d.setTextColor(30);
      head('Checks before buying (tick and note)');
      ['Khatauni (Bhulekh): owner name and area match the seller\'s papers', 'Plot sale status (Bhulekh service)', 'Plot litigation status (Bhulekh service)', 'Khasra map boundary matches the boundary on site / shajra',
       'Not in the GDA unauthorised colonies list (latest list)', 'RERA registration, if sold as part of a project', 'Planning zone and permitted use confirmed with GDA', 'Road access and site visit done', 'Registry and encumbrance checked'].forEach(function (s) {
        d.setDrawColor(90); d.rect(10, y - 3.2, 3.8, 3.8); d.setFontSize(9); d.text(s, 16, y); d.setDrawColor(210); d.line(128, y + 0.5, W - 10, y + 0.5); y += 6.4;
      });
      y += 1; d.setFontSize(7.5); d.setTextColor(60);
      d.text(d.splitTextToSize('Where to check: Bhulekh upbhulekh.gov.in/#/selection | Bhu-Naksha upbhunaksha.gov.in | GDA unauthorised colonies gdaghaziabad.in/list-of-unauthorized-colonies | UP RERA up-rera.in', W - 20), 10, y);
      d.setTextColor(110); d.text(d.splitTextToSize('Prepared by Silverleaf Buildcon for reference only. Not a legal document, title search or survey. Master plan layers are scanned government maps placed with control points (zone-level accuracy); khasra maps are the Bhu-Naksha portal maps. Verify with the issuing authority and the khatauni before any decision. Base map: OpenStreetMap contributors. Distances are straight-line.', W - 20), 10, 281);
      d.save('Silverleaf-plot-report-' + (vi ? vi.code : 'point') + (kh ? '-kh' + kh : '') + '.pdf');
    }).catch(function (e) { console.error(e); M.say('The report could not be created: ' + (e && e.message)); });
  }

  function init() {
    M = window.mpm; map = M.map;
    popEl = document.createElement('div'); popEl.id = 'mpm-pop'; document.body.appendChild(popEl);
    pop = new ol.Overlay({ element: popEl, positioning: 'bottom-center', offset: [0, -10], stopEvent: true }); map.addOverlay(pop);
    map.on('singleclick', onClick);
    M.snapshot = snapshot; M.shotAt = shotAt; M.exportReport = exportReport;   // also used for testing
    shareBar();
    if (q.get('client') === '1') { clientMode(); }
    fetch('mpm/data/bhulekh_villages.json').then(function (r) { return r.json(); }).then(function (b) { bhu = b; Object.keys(b.tehsils).forEach(function (k) { b.tehsils[k].villages.split(';').forEach(function (s) { var p = s.split('|'); byCode[p[0]] = { name: p[1], tehsil: k }; }); }); }).catch(function () {});
    fetch('mpm/data/landmarks.json').then(function (r) { return r.json(); }).then(function (l) { lm = l.items; }).catch(function () {});
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
