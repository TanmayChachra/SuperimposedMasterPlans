# One-page plot report: feasibility (2026-10-29)

Goal: pick a plot on the map and get a one-page sheet an agent can hand a client. Verdict: feasible, in phases. The map extract, village, zone and distances can be automated today. Owner records cannot, and should not be.

| Item on the sheet | Automatable? | How / limit |
|---|---|---|
| Map extract, lat/lon, date, Google Maps link | Yes, built | PDF button (jsPDF, client side) |
| District, tehsil, village (portal name and code) | Yes, built | `mpm/data/villages_grid.png`, 139 villages. Villages the portal lacks show "not in the mapped villages" |
| Planning zone (draft 2031 zones 1 to 8) | Yes, built, exact | Colour of the zones layer under the click |
| Master plan land use (Ghaziabad 2031) | Indicative only | Hatched fills blur colours, so the card gives the two closest legend colours. Exact answer needs the plan vectorised (about 2 days) |
| Khasra number | Manual | Read off the map and type it. Automatic reading would need OCR on the khasra image or the portal's identify call (not used) |
| Khatauni and owner | No (link-out) | Bhulekh is a multi-step form (district, tehsil, village, search), with Login and a certified-copy payment flow. Owner names are personal data, and automating a government form that may use a CAPTCHA is not something we do. The card opens Bhulekh and copies the village and khasra for pasting |
| Plot sale status and litigation status | No (link-out) | Two separate Bhulekh services. Worth ticking on every sheet |
| Unauthorised colony check | Semi | GDA publishes a Hindi PDF list (latest 18-06-2026). Match by colony name and locality: about 1 day, needs a human check |
| RERA status | Link-out | UP RERA project search, layout plan PDFs per registered project |
| Distance to RRTS stations, highways, metro | Yes, not built | OpenStreetMap, static table, about half a day |
| Satellite history | Link-out | Esri Wayback / Google Earth historical imagery |

Phases: 1 = what is built (extract, village, zone, links). 2 = unauthorised-colony match and distances, plus checklist tick-boxes on the PDF. 3 = vectorise the plan for exact land use.
Privacy rule: no owner or khatauni data is fetched, stored or shown by this site. Keep any plot-owner notes in a private tool with login.
