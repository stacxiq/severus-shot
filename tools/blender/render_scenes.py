# Severus Shot: renders 3D mock-up scenes and records where the phone screen lands in each picture.
import bpy, bmesh, json, math, os, sys, traceback
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "log.txt"), "a")
def log(*a):
    LOG.write(" ".join(str(x) for x in a) + "\n"); LOG.flush()

W, H = 1320, 2868
SCALE = float(os.environ.get("SEVERUS_SCALE", "50"))  # percent of full size
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
    glass.data.materials.append(mat("Glass", (0.012, 0.013, 0.016), rough=0.08))
    sw, sh = PW - 0.06, PH - 0.06
    screen = rounded_rect("PhoneScreen", sw, sh, PR - 0.03, 0, z0=PD + 0.0016)
    screen.data.materials.append(mat("Screen", (0.03, 0.032, 0.04), rough=0.12))
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
    scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.quality = 90
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
    try: scene.view_settings.view_transform = "Standard"
    except Exception as e: log("view transform:", e)

SCENES = [
    dict(id="velvet-green", wall=(0.05, 0.62, 0.12), floor=(0.03, 0.30, 0.07), prop="cushion", prop_color=(0.03, 0.22, 0.06), body=(0.05, 0.05, 0.055), lean=(72, 0, -24), pos=(0.25, 0.0, 0.0)),
    dict(id="clay-coral", wall=(0.98, 0.45, 0.36), floor=(0.86, 0.33, 0.28), prop="podium", prop_color=(0.98, 0.62, 0.52), body=(0.92, 0.9, 0.88), lean=(84, 0, 12), pos=(0.0, 0.0, 0.32)),
    dict(id="midnight-spheres", wall=(0.05, 0.07, 0.2), floor=(0.03, 0.04, 0.12), prop="spheres", prop_color=(0.35, 0.4, 0.95), body=(0.05, 0.05, 0.06), lean=(80, 0, -14), pos=(0.0, 0.0, 0.0)),
]

def build(cfg):
    clear(); scene = bpy.context.scene; setup_render(scene)
    world = scene.world or bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg: bg.inputs[0].default_value = (*cfg["wall"], 1.0); bg.inputs[1].default_value = 0.35
    add("primitive_plane_add", "Floor", mat("Floor", cfg["floor"], rough=0.55), size=40, location=(0, 0, 0))
    wall = add("primitive_plane_add", "Wall", mat("Wall", cfg["wall"], rough=0.8), size=40, location=(0, 4.5, 0)); wall.rotation_euler = (math.radians(90), 0, 0)
    phone, (sw, sh) = build_phone(cfg["body"])
    rx, ry, rz = (math.radians(v) for v in cfg["lean"])
    phone.rotation_euler = (rx, ry, rz)
    px, py, pz = cfg["pos"]
    # stand the phone on its bottom edge at the chosen spot
    phone.location = (px, py, pz + (PH / 2) * math.sin(rx) + 0.002)
    pm = mat("Prop", cfg["prop_color"], rough=0.75, sheen=1.0)
    if cfg["prop"] == "cushion":
        c = add("primitive_cube_add", "Cushion", pm, size=1, location=(-0.62, 0.42, 0.34)); c.scale = (1.15, 0.9, 0.68)
        mod = c.modifiers.new("bevel", "BEVEL"); mod.width = 0.3; mod.segments = 12
        for p in c.data.polygons: p.use_smooth = True
    elif cfg["prop"] == "podium":
        add("primitive_cylinder_add", "Podium", pm, radius=0.72, depth=0.32, vertices=96, location=(0, 0, 0.16))
        add("primitive_uv_sphere_add", "Ball", mat("Ball", (1.0, 0.86, 0.5), rough=0.35), radius=0.16, location=(0.78, -0.35, 0.16))
        for ob in bpy.data.objects:
            if ob.type == "MESH" and ob.name in ("Podium", "Ball"):
                for p in ob.data.polygons: p.use_smooth = True
    else:
        for i, (x, y, r) in enumerate(((-0.75, 0.5, 0.32), (0.78, 0.3, 0.2), (0.55, -0.45, 0.11))):
            s = add("primitive_uv_sphere_add", f"Sphere{i}", pm if i != 1 else mat("Glossy", (0.9, 0.9, 1.0), rough=0.1, metal=1.0), radius=r, location=(x, y, r), segments=64, ring_count=32)
            for p in s.data.polygons: p.use_smooth = True
    bpy.context.view_layer.update()
    area_light("Key", (-2.6, -3.2, 4.2), (0, 0, 0.8), 900, 3.5)
    area_light("Fill", (3.0, -2.0, 1.6), (0, 0, 0.7), 260, 4.0)
    area_light("Rim", (0.5, 3.0, 3.0), (0, 0, 0.9), 420, 2.0, cfg["wall"])
    cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 62
    cam = bpy.data.objects.new("Cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = (0.0, -5.6, 1.75)
    cam.rotation_euler = (Vector((0.0, 0.0, 1.02)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    # where the four screen corners land in the picture (0..1 from the top-left)
    z = PD + 0.0016; corners = []
    for lx, ly in ((-sw/2, sh/2), (sw/2, sh/2), (sw/2, -sh/2), (-sw/2, -sh/2)):
        co = world_to_camera_view(scene, cam, phone.matrix_world @ Vector((lx, ly, z)))
        corners.append([round(co.x, 5), round(1 - co.y, 5)])
    path = os.path.join(OUT, cfg["id"] + ".jpg"); scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return dict(id=cfg["id"], image=os.path.basename(path), screen=corners, screenAspect=round(sw / sh, 5), radius=round((PR - 0.03) / sw, 4))

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
