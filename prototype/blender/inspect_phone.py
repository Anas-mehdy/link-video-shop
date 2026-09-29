"""Inspect the supplied FBX and render both sides before modifying the model."""
import bpy
import json
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(ROOT, "output")
os.makedirs(OUTPUT, exist_ok=True)
SOURCE = os.path.join(ROOT, "phone.fbx")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=SOURCE, use_custom_normals=True)

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
if not points:
    raise RuntimeError("FBX has no mesh objects")

low = Vector([min(p[i] for p in points) for i in range(3)])
high = Vector([max(p[i] for p in points) for i in range(3)])
center = (low + high) / 2
size = high - low
axes = sorted(range(3), key=lambda axis: size[axis])
thin, wide, tall = axes

report = {
    "object_count": len(bpy.context.scene.objects),
    "mesh_count": len(meshes),
    "vertices": sum(len(obj.data.vertices) for obj in meshes),
    "polygons": sum(len(obj.data.polygons) for obj in meshes),
    "material_names": [m.name for m in bpy.data.materials],
    "bounds_min": list(low),
    "bounds_max": list(high),
    "size": list(size),
    "thin_axis": thin,
    "wide_axis": wide,
    "tall_axis": tall,
    "sample_objects": [obj.name for obj in meshes[:30]],
}
with open(os.path.join(OUTPUT, "report.json"), "w", encoding="utf-8") as handle:
    json.dump(report, handle, ensure_ascii=False, indent=2)
print("PHONE_REPORT", json.dumps(report, ensure_ascii=False))

for obj in list(bpy.context.scene.objects):
    if obj.type in {"LIGHT", "CAMERA"}:
        bpy.data.objects.remove(obj, do_unlink=True)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 720
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.light = "STUDIO"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.camera = bpy.data.objects.new("PreviewCamera", bpy.data.cameras.new("PreviewCamera"))
scene.collection.objects.link(scene.camera)
scene.camera.data.type = "ORTHO"
scene.camera.data.ortho_scale = size[tall] * 1.35
scene.camera.data.clip_end = max(size[tall] * 10, 10000)

up = Vector((0, 0, 0))
up[tall] = 1
for label, sign in [("side_a", 1), ("side_b", -1)]:
    normal = Vector((0, 0, 0))
    normal[thin] = sign
    camera = scene.camera
    camera.location = center + normal * max(size[tall] * 2, 1)
    direction = center - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    # Track quaternion assumes global Z is up; explicitly align the image's top with the phone's long axis.
    from mathutils import Matrix
    right = up.cross(normal).normalized()
    basis = Matrix(((right.x, up.x, normal.x),
                    (right.y, up.y, normal.y),
                    (right.z, up.z, normal.z)))
    camera.rotation_euler = basis.to_euler()
    scene.render.filepath = os.path.join(OUTPUT, label + ".png")
    bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTPUT, "imported-phone.blend"))
