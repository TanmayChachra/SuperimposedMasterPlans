# Superimposed Master Plans (fork notes)

Public fork of [datsvarun/master-plan-viewer](https://github.com/datsvarun/master-plan-viewer) (Varun Phadke) with more plans and map legends.
Live site: https://tanmaychachra.github.io/SuperimposedMasterPlans/ (GitHub Pages, branch `site`).

## Branches and upstream sync
- `main` is an exact mirror of upstream. Never commit to it. Update with "Sync fork" on GitHub, or:
  `git fetch upstream && git checkout main && git merge --ff-only upstream/main && git push origin main`
- `site` holds all our work and is what Pages serves. After syncing `main`: `git checkout site && git merge main`, resolve, push.

## What we added (all additive)
- `mpm/mpm.js`, `mpm/mpm.css`: legend pane and tab, `?city=` deep link, title and credit text, hides comment UI.
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
- Delhi legend: cropped from the DDA draft land use plan sheet inside upstream's `Delhi_2041_COG.tif` (hosted by upstream; source https://dda.gov.in/master-plan-2041-draft).
- Control points and checks: OpenStreetMap contributors (ODbL). Basemap tiles: OpenStreetMap, Esri World Imagery.
- Other cities load from upstream's own storage; we do not copy those files.
- Upstream repo has no licence file. Keep credit to Varun Phadke visible and ask before any commercial use.

## Known limits
- Overlays are scanned maps, zone-level accuracy only.
- The Ghaziabad legend is Hindi as printed.
- OpenStreetMap's public tile server has a usage policy; heavy traffic needs another tile provider.
- Georeferencing method and scripts: SolarIndexMeasure/masterplans/ghaziabad_pdf/georef.
