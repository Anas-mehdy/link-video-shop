"""Turn the supplied FBX into a small, interactive phone mascot GLB.

The exported roots Phone and Case are animated by the web preview.  Individual
expression objects have stable names so the browser can blend moods.
"""
import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "output")
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT, "phone.fbx"))

for obj in list(bpy.context.scene.objects):
    if obj.type in {"LIGHT", "CAMERA"}:
        bpy.data.objects.remove(obj, do_unlink=True)

# The FBX contains an Octane environment and scene helpers much larger than
# the handset. Only measure and export meshes beneath the iPhone model root.
model_roots = [o for o in bpy.context.scene.objects if o.name == "_iPhone_18_2"]
if not model_roots:
    raise RuntimeError("iPhone model root was not found in the supplied FBX")
model_root = model_roots[0]
model_root_name = model_root.name
if len(model_root.children) < 2:
    raise RuntimeError("Expected front and rear phone branches")
# The FBX places two complete phone views side by side. The branch on the
# positive X side is the rear handset with the camera island.
rear_branch = max(model_root.children, key=lambda o: o.matrix_world.translation.x)
rear_branch_name = rear_branch.name
def within_phone(obj):
    while obj is not None:
        if obj == rear_branch:
            return True
        obj = obj.parent
    return False
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and within_phone(o)]
if len(meshes) < 10:
    raise RuntimeError("Phone subtree contains too few meshes: " + str(len(meshes)))
for obj in list(bpy.context.scene.objects):
    if obj.type == "MESH" and obj not in meshes:
        bpy.data.objects.remove(obj, do_unlink=True)
points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector(min(p[i] for p in points) for i in range(3))
hi = Vector(max(p[i] for p in points) for i in range(3))
center = (lo + hi) / 2
size = hi - lo
if not .25 < size.x / size.z < 1.0:
    raise RuntimeError("Unexpected phone aspect ratio: " + str(tuple(size)))
scale = 2.0 / size.z
print("CHARACTER_PHONE_BOUNDS", tuple(size), "meshes", len(meshes))

# "back" FBX material identifies the actual rear surface independent of FBX axis.
rear_samples = []
for o in meshes:
    if any("背面-背板" in m.name for m in o.data.materials if m):
        rear_samples.append((o.matrix_world @ Vector(o.bound_box[0])).y)
rear_sign = 1 if (sum(rear_samples) / len(rear_samples) if rear_samples else lo.y) > center.y else -1
print("CHARACTER_REAR_SIGN", rear_sign, "samples", len(rear_samples))

# Freeze each mesh in world coordinates, then discard FBX parent transforms.
# The source has a nested 0.01 scale which otherwise shrinks the body in GLB.
for obj in meshes:
    world = obj.matrix_world.copy()
    obj.data = obj.data.copy()
    for vertex in obj.data.vertices:
        vertex.co = world @ vertex.co
    obj.parent = None
    obj.matrix_world.identity()
for obj in list(bpy.context.scene.objects):
    if obj.type == "EMPTY":
        bpy.data.objects.remove(obj, do_unlink=True)

# All meshes now have identity transforms, so joining preserves the full body.
bpy.ops.object.select_all(action="DESELECT")
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
meshes = [meshes[0]]

def mat(name, rgb, metallic=0, roughness=.4, alpha=1):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, alpha)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, alpha)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    return m

burgundy = mat("Mascot burgundy", (.28, .055, .17), .48, .27)
rim = mat("Clear case edge", (.72, .90, .97), .08, .20, .52)
glass = mat("Clear case back", (.85, .94, .98), .02, .13, .09)
white = mat("Eye white", (1, .96, .99), 0, .16)
black = mat("Ink", (.035, .014, .07), 0, .14)
blue = mat("Electric cyan", (.02, .73, .98), .25, .16)
cheek = mat("Cheek", (.91, .28, .56), 0, .5, .8)
lens_metal = mat("Camera lens metal", (.28, .43, .60), .72, .18)
lens_dark = mat("Camera lens glass", (.012, .045, .10), .35, .08)

for m in bpy.data.materials:
    target = None
    if "背面-背板" in m.name or "背面-边框" in m.name:
        target = burgundy.diffuse_color[:3]
    elif m.name == "logo":
        # The imported white logo sits directly beneath the character's mouth.
        target = (.25, .045, .145)
    elif "镜头玻璃" in m.name or "镜面" in m.name:
        target = (.025, .095, .17)
    if target is not None:
        m.diffuse_color = (*target, 1)
        if m.use_nodes and m.node_tree.nodes.get("Principled BSDF"):
            m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = m.diffuse_color

phone = bpy.data.objects.new("Phone", None)
bpy.context.collection.objects.link(phone)
for obj in meshes:
    obj.parent = phone
phone.scale = (scale,) * 3
phone.location = -center * scale

mascot = bpy.data.objects.new("Mascot", None)
bpy.context.collection.objects.link(mascot)

def attach(obj, root=mascot):
    obj.parent = root
    return obj

def sphere(name, at, dims, material, root=mascot, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=12, location=at)
    o = bpy.context.object
    o.name = name
    o.scale = dims
    o.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(o, root)

def tube(name, coords, radius, material, root=mascot):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 16
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    spline = cu.splines.new("BEZIER")
    spline.bezier_points.add(len(coords)-1)
    for p, co in zip(spline.bezier_points, coords):
        p.co = co
        p.handle_left_type = p.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    return attach(o, root)

face_y = rear_sign * (.103)
front_y = face_y + rear_sign * .035
for side in (-1, 1):
    x = side * .16
    sphere("Eye white " + str(side), (x, face_y, .06), (.088, .028, .11), white)
    sphere("Pupil " + str(side), (x-side*.014, front_y, .047), (.045, .025, .065), black)
    sphere("Eye glint " + str(side), (x-side*.028, front_y+rear_sign*.02, .083), (.017, .011, .023), white, seg=16)
    sphere("Blush " + str(side), (side*.315, face_y, -.10), (.052, .008, .026), cheek)
    tube("Worried brow " + str(side),
         [(side*.09, front_y, .25), (side*.16, front_y, .29-side*.015),
          (side*.23, front_y, .26-side*.03)], .013, black)

tube("MouthWorried", [(-.075, front_y, -.25), (0, front_y, -.215),
                       (.075, front_y, -.25)], .013, black)
tube("MouthNeutral", [(-.075, front_y, -.24), (0, front_y, -.245),
                       (.075, front_y, -.24)], .012, black)
tube("MouthHappy", [(-.13, front_y, -.21), (0, front_y, -.30),
                     (.13, front_y, -.21)], .018, black)

# Add three dark camera optics over the FBX's flat grey placeholders.
for index, (lens_x, lens_z) in enumerate(((.30, .88), (.10, .73), (.30, .58))):
    sphere("Camera optic rim " + str(index),
           (lens_x, rear_sign * .155, lens_z), (.095, .022, .095), lens_metal, seg=32)
    sphere("Camera optic glass " + str(index),
           (lens_x, rear_sign * .178, lens_z), (.078, .012, .078), lens_dark, seg=32)
    sphere("Camera optic glint " + str(index),
           (lens_x-.027, rear_sign * .192, lens_z+.028), (.014, .005, .018), blue, seg=16)

for side in (-1, 1):
    tube("Arm " + str(side), [(side*.43, .0, -.22),
         (side*.61, rear_sign*.04, -.37), (side*.54, rear_sign*.08, -.51)],
         .044, burgundy)
    sphere("Hand " + str(side), (side*.54, rear_sign*.08, -.51),
           (.067, .065, .067), burgundy)
    tube("Leg " + str(side), [(side*.18, 0, -.96),
         (side*.18, 0, -1.08)], .048, burgundy)
    sphere("Shoe " + str(side), (side*.19, rear_sign*.035, -1.09),
           (.11, .09, .065), black)

case = bpy.data.objects.new("Case", None)
bpy.context.collection.objects.link(case)
case_y = rear_sign*.126
def bar(name, at, dims, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    bevel = o.modifiers.new("Soft rounded plastic", "BEVEL")
    bevel.width = .018
    bevel.segments = 3
    o.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return attach(o, case)

for x in (-.494, .494):
    bar("Case vertical rail", (x, case_y, 0), (.023,.045,1.98), rim)
for z in (-.994, .994):
    bar("Case horizontal rail", (0, case_y, z), (.99,.045,.023), rim)
bar("Case left side", (-.49, 0, 0), (.021,.19,1.96), rim)
bar("Case right side", (.49, 0, 0), (.021,.19,1.96), rim)
# Five transparent panels leave a camera island open on the upper left.
bar("Case lower pane", (0, case_y, -.30), (.94,.012,1.35), glass)
bar("Case upper right pane", (.18, case_y, .72), (.58,.012,.55), glass)
bar("Case upper left slim pane", (-.43, case_y, .72), (.065,.012,.55), glass)
bar("Case upper lip", (0, case_y, .985), (.94,.012,.026), glass)
bar("Case camera cutout edge", (-.28, case_y, .45), (.40,.035,.025), rim)

# Floating demonstration lens halo. The actual purchased state is controlled
# by the browser, which can show/hide this root without changing the FBX.
lens = bpy.data.objects.new("Lens", None)
bpy.context.collection.objects.link(lens)
for x,z in [(-.31,.72),(-.12,.72),(-.31,.53)]:
    tube("Lens ring", [(x+math.cos(i*math.pi/8)*.092,
                        rear_sign*.135,
                        z+math.sin(i*math.pi/8)*.092) for i in range(17)],
         .009, blue, lens)

for o in bpy.context.scene.objects:
    if o.type == "MESH":
        for p in o.data.polygons:
            p.use_smooth = True

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, "phone-mascot.glb"), export_format="GLB",
    export_apply=False, export_animations=False, export_lights=False,
    export_cameras=False, export_yup=True)
with open(os.path.join(OUT, "character-report.json"), "w") as f:
    json.dump({"rear_sign":rear_sign, "source_vertices":sum(len(o.data.vertices) for o in meshes),
               "glb_bytes":os.path.getsize(os.path.join(OUT, "phone-mascot.glb")),
               "phone_bounds":list(size), "model_root":model_root_name, "rear_branch":rear_branch_name}, f)
print("CHARACTER_COMPLETE", os.path.getsize(os.path.join(OUT, "phone-mascot.glb")))
# A fast, static render lets us inspect the phone body even if browser automation stalls.
case.hide_render = True
for obj in case.children:
    obj.hide_render = True
for obj in lens.children:
    obj.hide_render = True
for obj in bpy.context.scene.objects:
    if obj.name.startswith("MouthNeutral") or obj.name.startswith("MouthHappy"):
        obj.hide_render = True
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.light = "STUDIO"
scene.render.resolution_x = 480
scene.render.resolution_y = 620
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
preview_camera = bpy.data.objects.new("Preview camera", bpy.data.cameras.new("Preview camera"))
scene.collection.objects.link(preview_camera)
scene.camera = preview_camera
preview_camera.location = (2.0, rear_sign * 5.2, 1.4)
preview_camera.rotation_euler = (Vector((0, 0, 0)) - preview_camera.location).to_track_quat("-Z", "Y").to_euler()
preview_camera.data.type = "ORTHO"
preview_camera.data.ortho_scale = 3.4
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(OUT, "preview-phone.png")
bpy.ops.render.render(write_still=True)
print("CHARACTER_PREVIEW_COMPLETE")
