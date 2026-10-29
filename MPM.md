# Superimposed Master Plans (fork notes)

Public fork of [datsvarun/master-plan-viewer](https://github.com/datsvarun/master-plan-viewer) (Varun Phadke) with more plans and map legends.
Live site: https://tanmaychachra.github.io/SuperimposedMasterPlans/ (GitHub Pages, branch `site`).

## Branches and upstream sync
- `main` is an exact mirror of upstream. Never commit to it. Update with "Sync fork" on GitHub, or:
  `git fetch upstream && git checkout main && git merge --ff-only upstream/main && git push origin main`
- `site` holds all our work and is what Pages serves. After syncing `main`: `git checkout site && git merge main`, resolve, push.

## What we added (all additive)
- `mpm/mpm.js`, `mpm/mpm.css`: legend pane and tab, "More plans at once" (extra overlay layers; swipe compare switches off), Search Address loads the plan(s) covering the place found, `?city=` and `&plus=` deep links, title and credit text, hides comment UI. It captures upstream's `ol.Map` by wrapping the constructor, so main.js is untouched.
- `mpm/legends/gzb/*.png`: legend swatches cropped from the Ghaziabad sheet for the English legend (labels translated by us from Hindi; Hindi view is the sheet as printed).
- `mpm/mpm.js` also has village groups: a `group` entry in legends.json points to an index of per-village COGs that load and unload as you pan.
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
- Modinagar khasra (92 of 101 tehsil villages): UP Bhu-Naksha (https://upbhunaksha.gov.in/), the portal's own map service, which serves village maps in EPSG:32644. Fetched 2026-10-29 with the site owner's permission: one coarse request per village to find its extent, then one image per village at 1 m/px, 5 to 8 s apart, with back-off. Village codes come from the portal's location dropdown (district 140, tehsil 000738). No owner or khatauni data was fetched. Stored as one COG per village in `City-Tiles/khasra/` with `index.json`; `mpm.js` loads only villages in view (zoom 12.5 or closer). Reference only, not a legal copy. The earlier hand-placed Sikri Khurd layer was removed because this is exact. Fetch scripts: SolarIndexMeasure/masterplans/khasra_modinagar (villages.py, fetch_overview.py, fetch_hires.py, mk_cogs.py). 9 villages not yet located; remaining villages of other tehsils not fetched.
- Ghaziabad zone boundaries (draft 2031): GDA sheet https://ntender.gdaghaziabad.in/uploads/listing/af01d_Zone%20Boundary%20After%20Smiti%20.pdf (ArcMap vector PDF, Nov 2022, downloaded 2026-10-29, no reuse licence stated). Rendered at 200 dpi, placed with 6 RRTS station control points vs OSM (north-up, UTM 43N, 1:50,120, about 50 m error), pastel fills made semi-transparent. Legend cropped from the sheet. Not included: the 2021 Zone-1 zonal plan (https://gdaghaziabad.in/wp-content/uploads/2020/10/Zonal-Plan-New-Ghaziabad.pdf), not yet placed.
- Delhi legend: cropped from the DDA draft land use plan sheet inside upstream's `Delhi_2041_COG.tif` (hosted by upstream; source https://dda.gov.in/master-plan-2041-draft).
- Control points and checks: OpenStreetMap contributors (ODbL). Basemap tiles: OpenStreetMap, Esri World Imagery.
- Other cities load from upstream's own storage; we do not copy those files.
- Upstream repo has no licence file. Keep credit to Varun Phadke visible and ask before any commercial use.

## Known limits
- Overlays are scanned maps, zone-level accuracy only.
- The Ghaziabad legend is Hindi as printed.
- OpenStreetMap's public tile server has a usage policy; heavy traffic needs another tile provider.
- Georeferencing method and scripts: SolarIndexMeasure/masterplans/ghaziabad_pdf/georef.
