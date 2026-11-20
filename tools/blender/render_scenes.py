# Severus Shot: renders 3D mock-up scenes and records where the phone screen lands in each picture.
import bpy, bmesh, json, math, os, sys, traceback
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "log.txt"), "a")
def log(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()

W, H = 2200, 2868   # wider than a phone slide, so tablet sizes have picture at the sides
SCALE = float(os.environ.get("SEVERUS_SCALE", "100"))
PW, PH, PD, PR = 0.715, 1.496, 0.085, 0.115           # phone: width, height, depth, corner radius

def mat(name, color, rough=0.5, metal=0.0, sheen=0.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    def put(key, val):
        if b is not None and key in b.inputs:
            try: b.inputs[key].default_value = val
            except Exception as e: log("mat", key, e)
    put("Base Color", (*color, 1.0)); put("Roughness", rough); put("Metallic", metal)
    put("Sheen Weight", sheen); put("Sheen Roughness", 0.4)
    if emit: put("Emission Color", (*emit, 1.0)); put("Emission Strength", 1.0)
    return m

def rounded_rect(name, w, h, r, depth, z0=0.0, seg=14):
    bm = bmesh.new(); pts = []
    for cx, cy, a0 in ((w/2-r, h/2-r, 0), (-w/2+r, h/2-r, 90), (-w/2+r, -h/2+r, 180), (w/2-r, -h/2+r, 270)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append(bm.verts.new((cx + r*math.cos(a), cy + r*math.sin(a), z0)))
    face = bm.faces.new(pts)
    if depth > 0:
        ex = bmesh.ops.extrude_face_region(bm, geom=[face])
        bmesh.ops.translate(bm, vec=(0, 0, depth), verts=[v for v in ex["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def smooth(ob, bevel=0.0):
    if bevel:
        mod = ob.modifiers.new("bevel", "BEVEL"); mod.width = bevel; mod.segments = 4; mod.limit_method = "ANGLE"
    for p in ob.data.polygons: p.use_smooth = True

def build_phone(body_color):
    body = rounded_rect("PhoneBody", PW, PH, PR, PD); smooth(body, 0.012)
    body.data.materials.append(mat("Body", body_color, rough=0.28, metal=0.9))
    inset = 0.022
    glass = rounded_rect("PhoneGlass", PW - inset, PH - inset, PR - inset/2, 0, z0=PD + 0.0008)
    glass.data.materials.append(mat("Glass", (0.01, 0.01, 0.012), rough=0.25))
    sw, sh = PW - 0.06, PH - 0.06
    screen = rounded_rect("PhoneScreen", sw, sh, PR - 0.03, 0, z0=PD + 0.0016)
    screen.data.materials.append(mat("Screen", (0.012, 0.012, 0.015), rough=0.55))
    root = bpy.data.objects.new("Phone", None); bpy.context.scene.collection.objects.link(root)
    for ob in (body, glass, screen): ob.parent = root
    return root, (sw, sh)

def add(kind, name, material, **kw):
    getattr(bpy.ops.mesh, kind)(**kw)
    ob = bpy.context.active_object; ob.name = name; ob.data.materials.append(material)
    return ob

def area_light(name, loc, target, power, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA"); data.energy = power; data.size = size; data.color = color
    ob = bpy.data.objects.new(name, data); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob

def clear():
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(coll):
            if item.users == 0: coll.remove(item)

def setup_render(scene):
    scene.render.resolution_x, scene.render.resolution_y = W, H
    scene.render.resolution_percentage = int(SCALE)
    scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.quality = 86
    try:
        scene.render.engine = "CYCLES"; scene.cycles.samples = 96; scene.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "METAL"; prefs.get_devices()
            for d in prefs.devices: d.use = True
            scene.cycles.device = "GPU"
        except Exception as e: log("gpu not used:", e)
    except Exception as e:
        log("cycles unavailable:", e)

def P(id, wall, floor, prop, pc, body=(0.04, 0.04, 0.045), lean=(80, 0, -14), x=0.0, pc2=(0.9, 0.9, 0.95)):
    return dict(id=id, wall=wall, floor=floor, prop=prop, prop_color=pc, prop2=pc2, body=body, lean=lean, x=x)

SILVER = (0.86, 0.86, 0.88)
SCENES = [
    P("velvet-green", (0.03, 0.42, 0.10), (0.02, 0.25, 0.06), "cushion", (0.02, 0.16, 0.05), lean=(76, 0, -20), x=0.18),
    P("coral-podium", (0.93, 0.36, 0.28), (0.80, 0.26, 0.21), "podium", (0.97, 0.55, 0.45), body=SILVER, lean=(84, 0, 10)),
    P("midnight-spheres", (0.03, 0.045, 0.16), (0.02, 0.03, 0.10), "spheres", (0.22, 0.27, 0.85), lean=(80, 0, -14)),
    P("lilac-arch", (0.60, 0.50, 0.88), (0.48, 0.38, 0.76), "arch", (0.80, 0.72, 0.98), body=SILVER, lean=(84, 0, 8)),
    P("sand-steps", (0.84, 0.72, 0.55), (0.72, 0.60, 0.44), "steps", (0.92, 0.82, 0.66), lean=(82, 0, -12), x=0.12),
    P("ocean-capsules", (0.04, 0.34, 0.62), (0.03, 0.24, 0.48), "capsules", (0.30, 0.72, 0.95), lean=(80, 0, 16)),
    P("lemon-ring", (0.98, 0.80, 0.10), (0.88, 0.68, 0.06), "ring", (0.08, 0.08, 0.09), lean=(82, 0, -10)),
    P("blush-cubes", (0.96, 0.66, 0.72), (0.88, 0.52, 0.60), "cubes", (0.99, 0.84, 0.86), body=SILVER, lean=(80, 0, 14)),
    P("forest-cushion", (0.04, 0.20, 0.14), (0.03, 0.13, 0.09), "cushion", (0.70, 0.52, 0.16), lean=(76, 0, -18), x=0.18),
    P("noir-podium", (0.025, 0.025, 0.03), (0.015, 0.015, 0.018), "podium", (0.10, 0.10, 0.12), lean=(84, 0, -8), pc2=(0.78, 0.95, 0.20)),
    P("sky-spheres", (0.52, 0.74, 0.96), (0.40, 0.62, 0.88), "spheres", (0.98, 0.98, 1.0), body=SILVER, lean=(80, 0, 12)),
    P("terracotta-arch", (0.70, 0.30, 0.18), (0.56, 0.22, 0.13), "arch", (0.90, 0.60, 0.42), lean=(84, 0, -8)),
    P("mint-steps", (0.56, 0.90, 0.76), (0.42, 0.78, 0.64), "steps", (0.82, 0.98, 0.90), body=SILVER, lean=(82, 0, 12), x=-0.12),
    P("royal-ring", (0.22, 0.12, 0.55), (0.15, 0.08, 0.40), "ring", (0.98, 0.72, 0.16), lean=(82, 0, 10)),
    P("cream-capsules", (0.93, 0.89, 0.80), (0.84, 0.79, 0.69), "capsules", (0.88, 0.36, 0.20), lean=(80, 0, -16)),
    P("slate-cubes", (0.14, 0.18, 0.24), (0.09, 0.12, 0.17), "cubes", (0.22, 0.60, 0.92), lean=(80, 0, -14)),
]

def soften(ob, bevel=0.0, seg=6):
    if bevel:
        m = ob.modifiers.new("bevel", "BEVEL"); m.width = bevel; m.segments = seg
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def build(cfg):
    clear(); scene = bpy.context.scene; setup_render(scene)
    world = scene.world or bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs[0].default_value = (0.85, 0.86, 0.9, 1.0); bg.inputs[1].default_value = 0.45
    add("primitive_plane_add", "Floor", mat("Floor", cfg["floor"], rough=0.6), size=60, location=(0, 0, 0))
    wall = add("primitive_plane_add", "Wall", mat("Wall", cfg["wall"], rough=0.9), size=60, location=(0, 5.0, 0)); wall.rotation_euler = (math.radians(90), 0, 0)
    phone, (sw, sh) = build_phone(cfg["body"])
    rx, ry, rz = (math.radians(v) for v in cfg["lean"])
    phone.rotation_euler = (rx, ry, rz)
    pm = mat("Prop", cfg["prop_color"], rough=0.7, sheen=1.0)
    pm2 = mat("Prop2", cfg["prop2"], rough=0.3)
    base = 0.0; kind = cfg["prop"]; side = -1 if cfg["lean"][2] <= 0 else 1   # props sit on the side the phone turns away from
    if kind == "cushion":
        c = add("primitive_cube_add", "Cushion", pm, size=1, location=(-0.50 * 1 + cfg["x"] - 0.25, 0.46, 0.30)); c.scale = (0.95, 0.85, 0.60); soften(c, 0.28, 12)
    elif kind == "podium":
        base = 0.26
        soften(add("primitive_cylinder_add", "Podium", pm, radius=0.62, depth=base, vertices=128, location=(cfg["x"], 0.05, base / 2)), 0.02, 3)
        soften(add("primitive_uv_sphere_add", "Ball", pm2, radius=0.12, segments=64, ring_count=32, location=(0.58 * -side, -0.42, 0.12)))
    elif kind == "spheres":
        for i, (x, y, r, m) in enumerate(((-0.56 * side, 0.55, 0.30, pm), (0.60 * side, 0.35, 0.17, pm2), (0.50 * side, -0.40, 0.09, pm))):
            soften(add("primitive_uv_sphere_add", f"Sphere{i}", m, radius=r, segments=64, ring_count=32, location=(x, y, r)))
    elif kind == "arch":
        a = add("primitive_cylinder_add", "Arch", pm, radius=0.66, depth=0.22, vertices=128, location=(cfg["x"], 0.75, 0.95)); a.rotation_euler = (math.radians(90), 0, 0); soften(a, 0.015, 3)
        b = add("primitive_cube_add", "ArchBase", pm, size=1, location=(cfg["x"], 0.75, 0.475)); b.scale = (1.32, 0.22, 0.95); soften(b, 0.015, 3)
        soften(add("primitive_uv_sphere_add", "Ball", pm2, radius=0.11, segments=64, ring_count=32, location=(0.56 * -side, -0.35, 0.11)))
    elif kind == "steps":
        for i, (w, h) in enumerate(((1.25, 0.14), (0.95, 0.28), (0.66, 0.42))):
            s = add("primitive_cube_add", f"Step{i}", pm, size=1, location=(-0.30 * side, 0.60 + 0.16 * i, h / 2)); s.scale = (w, 0.5, h); soften(s, 0.02, 3)
        soften(add("primitive_uv_sphere_add", "Ball", pm2, radius=0.10, segments=64, ring_count=32, location=(0.55 * side, -0.35, 0.10)))
    elif kind == "capsules":
        for i, (x, y, r, l, rot) in enumerate(((-0.52 * side, 0.50, 0.17, 0.75, 25), (0.55 * side, 0.30, 0.11, 0.45, -35))):
            c = add("primitive_cube_add", f"Capsule{i}", pm if i == 0 else pm2, size=1, location=(x, y, r)); c.scale = (l, 2 * r, 2 * r); c.rotation_euler = (0, 0, math.radians(rot)); soften(c, r * 0.98, 16)
    elif kind == "ring":
        t = add("primitive_torus_add", "Ring", pm, major_radius=0.58, minor_radius=0.075, major_segments=128, minor_segments=32, location=(cfg["x"], 0.70, 0.66)); t.rotation_euler = (math.radians(90), 0, 0); soften(t)
        soften(add("primitive_uv_sphere_add", "Ball", pm2, radius=0.12, segments=64, ring_count=32, location=(0.56 * -side, -0.38, 0.12)))
    else:
        for i, (x, y, sz, rot) in enumerate(((-0.56 * side, 0.50, 0.44, 18), (0.58 * side, 0.36, 0.26, -24), (-0.48 * side, -0.42, 0.15, 40))):
            c = add("primitive_cube_add", f"Cube{i}", pm if i != 1 else pm2, size=sz, location=(x, y, sz / 2)); c.rotation_euler = (0, 0, math.radians(rot)); soften(c, sz * 0.08, 4)
    phone.location = (cfg["x"], 0.0, base + (PH / 2) * math.sin(rx) + 0.002)
    bpy.context.view_layer.update()
    area_light("Key", (-2.4, -3.6, 4.6), (0, 0, 0.8), 520, 4.0)
    area_light("Fill", (3.2, -2.4, 1.8), (0, 0, 0.7), 150, 5.0)
    area_light("Rim", (0.8, 3.2, 3.2), (0, 0, 0.9), 240, 2.5)
    cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 50
    cam = bpy.data.objects.new("Cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = (0.0, -4.9, 1.30)
    cam.rotation_euler = (Vector((0.0, 0.0, 1.36)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    z = PD + 0.0016; corners = []
    for lx, ly in ((-sw/2, sh/2), (sw/2, sh/2), (sw/2, -sh/2), (-sw/2, -sh/2)):
        co = world_to_camera_view(scene, cam, phone.matrix_world @ Vector((lx, ly, z)))
        corners.append([round(co.x, 5), round(1 - co.y, 5)])
    path = os.path.join(OUT, cfg["id"] + ".jpg"); scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return dict(id=cfg["id"], image=os.path.basename(path), screen=corners, screenAspect=round(sw / sh, 5), radius=round((PR - 0.03) / sw, 4), prop=cfg["prop"])

def main():
    log("start", bpy.app.version_string, "scale", SCALE)
    done = []
    for cfg in SCENES:
        try:
            done.append(build(cfg)); log("rendered", cfg["id"])
        except Exception:
            log("FAILED", cfg["id"], traceback.format_exc())
        json.dump(done, open(os.path.join(OUT, "scenes.json"), "w"), indent=1)
    log("finished", len(done), "of", len(SCENES))

main()
