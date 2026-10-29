# Changelog (branch `site`)

Newest first. One line per change that visitors or maintainers can notice. Each feature is built on a `feature/*` branch and merged into `site` with `--no-ff`.

- 2026-10-29 Click-for-info card (village, zone, portal links), share link + WhatsApp + client view + PDF extract, plot report feasibility. Branch `feature/plot-info-sharing`.
- 2026-10-29 Layer re-ordering (up/down), one consistent palette and monochrome icons, second khasra layer for the 38 Ghaziabad-tehsil villages (Muradnagar side). Branch `feature/layer-order-theme`.
- 2026-10-29 Internal Silverleaf Buildcon UI, per-layer opacity/visibility/remove, service worker cache, About text without creator name, noindex. Branch `feature/internal-ui-cache`.
- 2026-10-29 Khasra: all 101 Modinagar villages in one COG (faster, opacity works), retry + memory fix on city switch, KMZ export tool. Branch `fix/khasra-speed-and-switching`.
- 2026-10-29 Modinagar khasra from Bhu-Naksha (92 villages, loaded on demand), replaces the hand-placed Sikri Khurd layer. Branch `feature/modinagar-khasra`.
- 2026-10-29 Ghaziabad zones layer (draft 2031, zones 1 to 8, RRTS). Branch `feature/ghaziabad-zones-2031`.
- 2026-10-29 Sikri Khurd khasra layer, cadastral layers drawn above plans.
- 2026-10-29 English/Hindi legend toggle for Ghaziabad plan.
- 2026-10-29 Phone layout, credit line moved to the Info text.
- 2026-10-29 Multi-plan view, Search Address loads covering plans, `?city=&plus=` links.
- 2026-10-29 Meerut 2031 plan and legend. Project renamed Superimposed Master Plans.
- 2026-10-29 Ghaziabad 2031 plan, legend pane, comments backend disabled.

## Adding a layer (checklist)
1. `git checkout site && git checkout -b feature/<name>`.
2. Georeference to a north-up COG (WebP, RGBA, transparent outside the plan) and put it in `City-Tiles/`.
3. Add an entry at the top of `cities.json` (name, cogUrl, center, zoom).
4. Add `bounds`, legend image, source, note to `mpm/legends.json`; legend image in `mpm/legends/`.
5. Record source and method in `MPM.md`; add a line here.
6. Test locally (`?city=<name>`, Legend pane, phone width), then `git checkout site && git merge --no-ff feature/<name>`, push, check the live page.
