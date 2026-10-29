"""Export any layer of this site (a COG in City-Tiles/, local path or URL) to a KMZ for Google Earth.
Reprojects to lat/lon and cuts it into tiles of at most --max-px, each a GroundOverlay with transparency.
usage: python export_kmz.py <cog path or url> <out.kmz> [--res-m 2] [--max-px 4096] [--name "Layer name"]
Resolution: --res-m is metres per pixel of the export (source resolution is the best you can get).
Google Earth Pro copes well with up to about 20 tiles; raise --res-m for big layers (e.g. 2 or 3 for the khasra mosaic).
In QGIS/ArcGIS you do not need this: open the .tif directly (QGIS accepts /vsicurl/<url>)."""
import sys, io, math, zipfile, argparse
import numpy as np, rasterio
from rasterio.warp import transform_bounds, reproject, Resampling
from rasterio.transform import from_bounds
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("out")
ap.add_argument("--res-m", type=float, default=None); ap.add_argument("--max-px", type=int, default=4096); ap.add_argument("--name", default="Superimposed Master Plans layer")
a = ap.parse_args()
src = rasterio.open(a.src)
W, S, E, N = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
res = a.res_m or src.res[0]
mid = math.radians((S + N) / 2)
wpx, hpx = int((E - W) * 111320 * math.cos(mid) / res), int((N - S) * 110574 / res)
nx, ny = math.ceil(wpx / a.max_px), math.ceil(hpx / a.max_px)
print("export size %d x %d px in %d x %d tiles" % (wpx, hpx, nx, ny))
kml = ['<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>%s</name>' % a.name]
files = {}
for j in range(ny):
    for i in range(nx):
        tw, th = (E - W) / nx, (N - S) / ny
        b = (W + i * tw, N - (j + 1) * th, W + (i + 1) * tw, N - j * th)
        w, h = math.ceil(wpx / nx), math.ceil(hpx / ny)
        dst = np.zeros((4, h, w), np.uint8)
        reproject(source=rasterio.band(src, [1, 2, 3, 4]), destination=dst, dst_transform=from_bounds(*b, w, h), dst_crs="EPSG:4326", resampling=Resampling.bilinear)
        if dst[3].max() == 0: continue                               # empty tile
        buf = io.BytesIO(); Image.fromarray(np.moveaxis(dst, 0, 2)).save(buf, "PNG", optimize=True)
        fn = "tiles/%d_%d.png" % (j, i); files[fn] = buf.getvalue()
        kml.append('<GroundOverlay><name>%d_%d</name><Icon><href>%s</href></Icon><LatLonBox><north>%.7f</north><south>%.7f</south><east>%.7f</east><west>%.7f</west></LatLonBox></GroundOverlay>' % (j, i, fn, b[3], b[1], b[2], b[0]))
kml.append("</Document></kml>")
with zipfile.ZipFile(a.out, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("doc.kml", "".join(kml))
    for k, v in files.items(): z.writestr(k, v)
print(len(files), "overlays,", round(sum(len(v) for v in files.values()) / 1e6, 1), "MB of images ->", a.out)
