#!/usr/bin/env python3
"""Turn Blender's output (pictures + scenes.json) into the app's bundled scenes: ui/scenes/*.jpg and ui/js/scenes.js."""
import json, os, sys
from PIL import Image

src, root = sys.argv[1], os.path.join(os.path.dirname(__file__), "..", "..")
W, H, BASE_W = 2200, 2868, 1320
LABELS = {"velvet-green": "Velvet green", "coral-podium": "Coral podium", "midnight-spheres": "Midnight spheres", "lilac-arch": "Lilac arch", "sand-steps": "Sand steps", "ocean-capsules": "Ocean capsules", "lemon-ring": "Lemon ring", "blush-cubes": "Blush cubes", "forest-cushion": "Forest cushion", "noir-podium": "Noir podium", "sky-spheres": "Sky spheres", "terracotta-arch": "Terracotta arch", "mint-steps": "Mint steps", "royal-ring": "Royal ring", "cream-capsules": "Cream capsules", "slate-cubes": "Slate cubes"}
hexc = lambda c: "#%02x%02x%02x" % tuple(c[:3])
out = []
for s in json.load(open(os.path.join(src, "scenes.json"))):
    im = Image.open(os.path.join(src, s["image"])).convert("RGB")
    assert im.size == (W, H), im.size
    im.save(os.path.join(root, "ui", "scenes", s["id"] + ".jpg"), quality=80, optimize=True, progressive=True)
    wall, floor = im.getpixel((W // 2, 40)), im.getpixel((W // 2, H - 40))
    lum = (wall[0] * 299 + wall[1] * 587 + wall[2] * 114) / 1000
    # picture coordinates -> slide design units (the picture is centred on the slide)
    pts = [[round(BASE_W / 2 + (u - 0.5) * W, 1), round(v * H, 1)] for u, v in s["screen"]]
    out.append({"id": s["id"], "label": LABELS.get(s["id"], s["id"]), "wall": hexc(wall), "floor": hexc(floor), "ink": "#141414" if lum > 150 else "#ffffff", "quad": pts, "radius": s["radius"]})
js = "// Rendered in Blender by tools/blender/render_scenes.py; written by tools/blender/import_scenes.py. Do not edit by hand.\n"
js += "export const SCENE_SIZE = { w: %d, h: %d };\nexport const SCENES3D = %s;\n" % (W, H, json.dumps(out, indent=1))
open(os.path.join(root, "ui", "js", "scenes.js"), "w").write(js)
print(len(out), "scenes")
