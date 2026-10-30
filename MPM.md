# Silverleaf Buildcon master plan overlay (fork notes)

Public fork of [datsvarun/master-plan-viewer](https://github.com/datsvarun/master-plan-viewer) (Varun Phadke) with more plans and map legends.
Live site: https://tanmaychachra.github.io/SuperimposedMasterPlans/ (GitHub Pages, branch `site`).

## Branches and upstream sync
- `main` is an exact mirror of upstream. Never commit to it. Update with "Sync fork" on GitHub, or:
  `git fetch upstream && git checkout main && git merge --ff-only upstream/main && git push origin main`
- `site` holds all our work and is what Pages serves. After syncing `main`: `git checkout site && git merge main`, resolve, push.

## What we added (all additive)
- `mpm/mpm.js`, `mpm/mpm.css`: legend pane and tab, "More plans at once" (extra overlay layers; swipe compare switches off), Search Address loads the plan(s) covering the place found, `?city=` and `&plus=` deep links, title and credit text, hides comment UI. It captures upstream's `ol.Map` by wrapping the constructor, so main.js is untouched.
- `mpm/legends/gzb/*.png`: legend swatches cropped from the Ghaziabad sheet for the English legend (labels translated by us from Hindi; Hindi view is the sheet as printed).
- `mpm/mpm.js` also frees the previous plan's tiles on city switch and re-selects the main plan if it fails to load (twice at most).
- `mpm/legends.json` also holds `bounds` [W,S,E,N] for plans we host; other cities use a centre and zoom estimate for address matching.
- `mpm/stub-supabase.js`: stands in for the Supabase client. Upstream's comments read and write the original author's database, so they are off here.
- `mpm/legends.json`: per-city legend image, source and note (merged over cities.json by name).
- `mpm/legends/*.png`, `City-Tiles/Ghaziabad_2031_COG.tif`.

## Patches to upstream files (expect small merge conflicts on sync)
- `index.html`: og:url, mpm.css link, Supabase script replaced by the stub, mpm.js script added.
- `cities.json`: Ghaziabad and Meerut entries inserted at the top.
- `robots.txt`, `sitemap.xml`: site URL. Deleted `google3b474d8927d0dea6.html` (author's search-console token). Added `.nojekyll`.

## Data sources and attribution
- Ghaziabad plan: Ghaziabad Development Authority, Master Plan 2031 map PDF (https://ntender.gdaghaziabad.in/uploads/listing/12547_Map.pdf, via gdaghaziabad.in), downloaded 2026-10-29. No reuse licence stated. Raster only, placed by 16 control points (about 40 m RMSE), exterior made transparent. Legend is cropped from the same sheet.
- Meerut plan: Meerut Development Authority, Master Plan 2031 (revised) PDF, https://mdameerut.in/CMS/upload/circular/17074634911.pdf, downloaded 2026-10-29, no reuse licence stated. Raster only, 12 control points (UTM 44N), exterior transparent. Legend cropped from the same sheet.
- Modinagar khasra (all 101 tehsil villages): UP Bhu-Naksha (https://upbhunaksha.gov.in/), the portal's own map service, which serves village maps in EPSG:32644. Fetched 2026-10-29 with the site owner's permission: one coarse request per village to find its extent, then one image per village at 1 m/px, 5 to 8 s apart, with back-off. Village codes from the portal's location dropdown (district 140, tehsil 000738, gis_code = 14 + 000738 + village). No owner or khatauni data fetched. All villages are merged into ONE sparse COG (`City-Tiles/Modinagar_khasra_COG.tif`, 83 MB, 1 m/px, WebP q75) so the viewer draws a single layer. Reference only, not a legal copy. Scripts: SolarIndexMeasure/masterplans/khasra_modinagar (villages.py, fetch_overview.py, fetch_hires.py, mk_mosaic.py). Second layer: the 38 villages under Ghaziabad tehsil (000739), same method, `City-Tiles/Ghaziabad_tehsil_khasra_COG.tif` (28 MB, set `KH=739` for the scripts). The portal has no Muradnagar tehsil and no village maps for towns, so Modinagar and Muradnagar towns and villages such as Kajampur and Kalchhina are blank. Loni tehsil (01028) not fetched.
- Delhi legend: cropped from the DDA draft land use plan sheet inside upstream's `Delhi_2041_COG.tif` (hosted by upstream; source https://dda.gov.in/master-plan-2041-draft).
- Control points and checks: OpenStreetMap contributors (ODbL). Basemap tiles: OpenStreetMap, Esri World Imagery.
- Other cities load from upstream's own storage; we do not copy those files.
- Upstream repo has no licence file. Keep credit to Varun Phadke visible and ask before any commercial use.

## Known limits
- Overlays are scanned maps, zone-level accuracy only.
- The Ghaziabad legend is Hindi as printed.
- OpenStreetMap's public tile server has a usage policy; heavy traffic needs another tile provider.
- Georeferencing method and scripts: SolarIndexMeasure/masterplans/ghaziabad_pdf/georef.

## Performance notes
- One layer per plan: the khasra mosaic replaced a first version that loaded up to 101 per-village layers (slow, and opacity did not reach them).
- Every layer is a COG with overviews, so zoomed-out views read small overview tiles, not full resolution.
- `preconnect` hints for the CDN and OSM tiles. Asset links carry a `?v=` number: bump it when `mpm.js` or `mpm.css` change.
- Biggest remaining cost is OpenStreetMap's public tile server and the 1 MB+ OpenLayers bundle from the CDN.

## Exporting a layer (Google Earth, QGIS, ArcGIS)
- QGIS: Layer > Add Raster Layer, source `/vsicurl/https://tanmaychachra.github.io/SuperimposedMasterPlans/City-Tiles/<file>.tif` (or download the .tif). ArcGIS Pro: download the .tif and add it.
- Google Earth Pro: `python tools/export_kmz.py City-Tiles/<file>.tif out.kmz [--res-m 2]` makes a KMZ of tiled, transparent ground overlays. Then File > Open. Keep big layers coarse (khasra at 2 m is 120 MB).
- Not tested in Google Earth itself, only that the KML parses.

## Caching (sw.js)
The maps barely change, so a service worker keeps them on the device after the first visit.
- `City-Tiles/*.tif`: every byte range the viewer asks for is stored and replayed (the Cache API cannot store partial replies, so each is saved as a 200 under url + range and replayed as a 206). Cached for good.
- OSM and Esri tiles: cache first, newest 800 kept. CDN libraries: cache first. This site's files: stale-while-revalidate (instant, refreshed for next time).
- RULE: replacing a .tif under the same name makes visitors see mixed old and new blocks. Rename the file, or bump `DATA_V` in sw.js, when you change a map.
- RULE: bump `APP_V` in sw.js to push new app files to everyone at once, and bump the `?v=` numbers in index.html.
- `?nosw=1` on the page URL removes the worker and all its caches (use it if something looks stale).
- Verified in desktop Chrome (first request stored, repeat served instantly with the right bytes). The Claude in-app browser pane does not run service workers, so it always loads fresh.

## Layers panel (UI)
- Each active layer is a row with its own show/hide box, opacity slider, `i` button (legend, source, accuracy) and remove button. The primary layer's slider is upstream's own `#opacity-slider` (upstream resets opacity from it on every city load); overlays have their own.
- "+ Add a layer" is a grouped picker (master plans, khasra, other cities). The first layer chosen becomes the primary layer, later ones are overlays (default opacity 0.85). Removing the primary layer hides it, and the next layer added becomes primary.
- Branding: Silverleaf Buildcon header, green theme in `mpm/mpm.css` (CSS variables at the top of the theme block), `noindex` meta and `robots.txt` Disallow since this is an internal tool. The About text no longer names the upstream author; credit stays in this file and the repo history.

## Click info, sharing, client view (mpm/tools.js)
- Plot info is a toggle (the crosshair button in the floating column, off by default), so panning, pinching or scrolling never opens a card. Turn it on, tap the map, turn it off to close the card. Client view has it too.
- Shatru Sampatti check: the card (and the report) check village + khasra against `mpm/data/enemy_property.json`, a hand-entered list. Red = exact khasra listed, amber = same base number (1045 vs 1045/2), "not in our list" = not found (never a guarantee), "list not loaded" while the file is empty. Why a list and not a layer: MHA publishes district counts only (https://enemyproperty.mha.gov.in/epweb/immovableEnemyProperty, read 2026-10-30: Ghaziabad 30, Meerut 126, Baghpat 44, Gautam Buddha Nagar 74 plots), so there is no geometry. Fill the file from RTI replies, see `docs/RTI_ENEMY_PROPERTY.md`.
- Click the map (with Plot info on): card with lat/lon, village (from `mpm/data/villages_grid.png` + `villages.json`, built by `mk_idgrid.py`), planning zone per visible layer (`mpm/data/zonecolors.json`: indicative: the Ghaziabad plan colour is matched to the legend), and links to Bhu-Naksha and Bhulekh with a "Copy details" button. No owner data is fetched or stored by the site.
- Share bar: Copy link, WhatsApp, Client link, PDF. The link stores layers, order, opacity, visibility, map position and satellite on/off (`?L=...&P=...&v=lon,lat,zoom&sat=1`). `&client=1` gives a read-only view (no search, add, remove, move, swipe).
- PDF: map extract plus coordinates, layer list with sources and the disclaimer (jsPDF 2.5.1 from cdnjs, loaded on demand). Verified in desktop Chrome with a WebGL layer; Hindi names are left out of the PDF (no Devanagari font).
- If you add villages, rerun `mk_idgrid.py` and commit the two files in `mpm/data/`.
- Feasibility of the one-page plot report: `docs/PLOT_REPORT_FEASIBILITY.md`.

## One-page plot report and Bhulekh help
- Click the map, then **One-page report**: A4 PDF with village (English and portal code), tehsil, khasra number you typed, coordinates, nearest RRTS and Delhi Metro station (straight line, from `mpm/data/landmarks.json`), planning zones from the visible layers, a wider and a close-up map with the selected point ringed, a 9-item buying checklist with tick boxes, links and the disclaimer. Verified by generating one in Chrome and reading the PDF back.
- **Open Khatauni** goes to `https://upbhulekh.gov.in/#/selection` (the district list; the home page and service click are skipped) and copies the village name for the Search Village box. Bhulekh keeps district, tehsil and village in page state (the URL stays `#/selection`), so it cannot be pre-filled by link. **Bhu-Naksha** copies the village code. Owner data is never fetched or stored here.
- Villages not on the khasra map (Kajampur, Machhri, Sikri Kalan and the other 11) are still in Bhulekh's records, so the card offers a village picker built from Bhulekh's lists (`mpm/data/bhulekh_villages.json`: Modinagar 127, Ghaziabad 85, Loni 49 villages, read 2026-10-29). Bhu-Naksha simply has no digitised map for them.
- Master plan land use (Ghaziabad 2031) stays indicative: it is shown only when the click colour is close to a legend colour, otherwise "no clear match".
- Chrome blocks repeated automatic downloads from one page, so test the PDF once per tab.
