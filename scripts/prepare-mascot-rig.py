"""Prepare the supplied LABRICA mesh for the landing's staged character animation.

Run with Blender: blender -b --python scripts/prepare-mascot-rig.py -- source.glb
The source is never overwritten. Outputs: assets/mascot/labrica-mascot.blend and
public/landing-assets/labrica-mascot.glb. Everything runs locally.
"""
import bpy, bmesh, math, sys, os, shutil, subprocess
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform, closest_point_on_tri

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE=sys.argv[sys.argv.index('--')+1]
bpy.context.preferences.filepaths.save_version=0
os.makedirs(os.path.join(ROOT,'assets','mascot'),exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=SOURCE)
body=next(o for o in bpy.context.scene.objects if o.type=='MESH')
body.name='Alpaca';bpy.context.view_layer.objects.active=body;body.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)

# Separate the existing glasses using their original texture and geometric region.
material=body.data.materials[0]
principled=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
base_image=principled.inputs['Base Color'].links[0].from_node.image
pixels=np.empty(len(base_image.pixels),dtype=np.float32);base_image.pixels.foreach_get(pixels)
pixels=pixels.reshape((base_image.size[1],base_image.size[0],4));height,width=pixels.shape[:2]
uv=body.data.uv_layers.active.data
selected=[]
for polygon in body.data.polygons:
 c=polygon.center
 if not(-.39<c.x<.39 and -.44<c.y<-.17 and .36<c.z<.515):continue
 coords=[uv[i].uv for i in polygon.loop_indices]
 u=sum(p.x for p in coords)/3;v=sum(p.y for p in coords)/3
 color=pixels[min(height-1,max(0,int(v*height))),min(width-1,max(0,int(u*width))),:3]
 if max(color)<.28 or (max(color)-min(color)<.115 and min(color)>.2):selected.append(polygon.index)
selected_set=set(selected)
for vertex in body.data.vertices:vertex.select=False
for edge in body.data.edges:edge.select=False
for p in body.data.polygons:p.select=p.index in selected_set
bpy.context.tool_settings.mesh_select_mode=(False,False,True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
glasses=next(o for o in bpy.context.selected_objects if o!=body);glasses.name='Sunglasses'
print('Separated glasses faces',len(selected),flush=True)

def separate_region(name,predicate):
 bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
 for vertex in body.data.vertices:vertex.select=False
 for edge in body.data.edges:edge.select=False
 for polygon in body.data.polygons:polygon.select=predicate(polygon.center)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
 result=next(o for o in bpy.context.selected_objects if o!=body);result.name=name
 return result

# The scan fuses the arms against the torso. Separate their contact seam before
# skinning, otherwise lifting an arm stretches the torso into a sheet.
arms={}
for side,sign in [('L',-1),('R',1)]:
 arms[side]=separate_region('Arm.'+side,lambda p,s=sign:-.55<p.z<.095 and s*p.x>(.255 if p.z>-.37 else .31))

# UV seams duplicate vertices in the import. Weld before sealing the hidden
# separation boundaries, keeping the UV coordinates on the original face loops.
for obj in [body,*arms.values()]:
 bm=bmesh.new();bm.from_mesh(obj.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
 boundary=[edge for edge in bm.edges if edge.is_boundary and max(v.co.z for v in edge.verts)<.2]
 filled=bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
 for face in filled['faces']:face.material_index=1
 bmesh.ops.triangulate(bm,faces=list(filled['faces']))
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 bm.to_mesh(obj.data);bm.free();obj.data.update()

# Retain the supplied surface, UVs and texture; reduce web payload after separation.
for obj,ratio in [(body,.20),(glasses,.35),*[(arm,.5) for arm in arms.values()]]:
 bpy.context.view_layer.objects.active=obj
 modifier=obj.modifiers.new('Web topology','DECIMATE');modifier.ratio=ratio
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 for polygon in obj.data.polygons:polygon.use_smooth=True
for image in bpy.data.images:
 if image.size[0]>1024:image.scale(1024,1024)
 if image.source=='FILE':image.pack()

def material_color(name,color,roughness=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 node=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');node.inputs['Base Color'].default_value=(*color,1);node.inputs['Roughness'].default_value=roughness
 return m
cream=material_color('Face repair / cream',(.66,.61,.48))
mint=material_color('Hidden shoulder and temple repair',(.107,.731,.301))
for obj in [body,*arms.values()]:obj.data.materials.append(mint)
white=material_color('Eye ivory',(.87,.85,.71));black=material_color('Eye dark',(.013,.018,.019),.3)
def sphere(name,location,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=location)
 o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o

# The source has no eyes under the fused lenses. Reconstruct only the concealed
# upper-face patch and eyes so lowering its original glasses reveals a real face.
patch=sphere('Upper face beneath glasses',(0,-.265,.445),(.223,.08,.092),cream)
repairs=[sphere('Temple repair '+side,(x,-.165,.444),(.085,.072,.081),mint) for side,x in [('L',-.283),('R',.283)]]
# Rebuild the formerly concealed arm/torso contact surfaces as closed volumes.
# The scan has no inner arms at all: leaving its cut surface would expose holes.
for obj in arms.values():bpy.data.objects.remove(obj,do_unlink=True)
arm_parts=[]
torso_repairs=[]
for side,sign in [('L',-1),('R',1)]:
 torso_repairs.append(sphere('Torso seam '+side,(sign*.224,-.015,-.245),(.108,.235,.323),mint))
 arm_parts.extend([
  (sphere('Upper sleeve '+side,(sign*.30,0,-.092),(.108,.125,.206),mint),'UpperArm.'+side),
  (sphere('Lower sleeve '+side,(sign*.36,-.024,-.295),(.11,.125,.161),mint),'Forearm.'+side),
  (sphere('Hand '+side,(sign*.392,-.046,-.452),(.052,.063,.061),cream),'Hand.'+side),
 ])

# Fuse the repaired torso, removing the visible contact seams. Reproject the
# supplied UV texture onto it; the head and its detailed surface stay untouched.
torso=separate_region('Body below collar',lambda p:p.z<.09)
torso.data.calc_loop_triangles()
source_vertices=[v.co.copy() for v in torso.data.vertices]
source_triangles=[tri for tri in torso.data.loop_triangles if tri.material_index==0]
source_indices=[tuple(tri.vertices) for tri in source_triangles]
source_uvs=[[Vector((*torso.data.uv_layers.active.data[index].uv,0)) for index in tri.loops] for tri in source_triangles]
surface=BVHTree.FromPolygons(source_vertices,source_indices,all_triangles=True)
# Close the collar before voxel union. It is concealed beneath the wool collar.
bm=bmesh.new();bm.from_mesh(torso.data)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=0)
bm.to_mesh(torso.data);bm.free()
bpy.ops.object.select_all(action='DESELECT');torso.select_set(True)
for obj in torso_repairs:obj.select_set(True)
bpy.context.view_layer.objects.active=torso;bpy.ops.object.join()
solid=torso.modifiers.new('Inner surface','SOLIDIFY');solid.thickness=.03;solid.offset=-1
bpy.ops.object.modifier_apply(modifier=solid.name)
remesh=torso.modifiers.new('Closed torso surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.006;remesh.use_smooth_shade=True;remesh.use_remove_disconnected=False
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth_mod=torso.modifiers.new('Seam polish','SMOOTH');smooth_mod.factor=.7;smooth_mod.iterations=5
bpy.ops.object.modifier_apply(modifier=smooth_mod.name)
decimate=torso.modifiers.new('Web torso','DECIMATE');decimate.ratio=.07;bpy.ops.object.modifier_apply(modifier=decimate.name)
# Tuck the sealed collar under the unchanged wool, avoiding an exposed cut edge.
for vertex in torso.data.vertices:
 t=max(0,min(1,(vertex.co.z+.07)/.16));vertex.co.z+=.06*t*t*(3-2*t)
 taper=max(0,min(1,(vertex.co.z-.02)/.13));vertex.co.x*=1-.15*taper
torso.data.update()
uv_layer=torso.data.uv_layers.new(name='UVMap')
for poly in torso.data.polygons:
 location,normal,index,distance=surface.find_nearest(poly.center)
 if index is None:continue
 a,b,c=[source_vertices[v] for v in source_indices[index]]
 u,v,w=source_uvs[index]
 for loop_index in poly.loop_indices:
  position=torso.data.vertices[torso.data.loops[loop_index].vertex_index].co
  mapped=barycentric_transform(closest_point_on_tri(position,a,b,c),a,b,c,u,v,w)
  uv_layer.data[loop_index].uv=(mapped.x,mapped.y)
 poly.material_index=1 if abs(poly.center.x)>.24 and -.53<poly.center.z<.09 else 0;poly.use_smooth=True
torso.data.materials.clear();torso.data.materials.append(material);torso.data.materials.append(mint)
torso.data.validate();torso.data.update()
eye_objects=[]
for side,x in [('L',-.09),('R',.09)]:
 eye_objects += [(sphere('Eye white '+side,(x,-.341,.462),(.032,.014,.033),white),side),
                 (sphere('Pupil '+side,(x,-.355,.461),(.017,.009,.023),black),side),
                 (sphere('Eye glint '+side,(x-.005,-.364,.47),(.004,.003,.005),white),side)]
finger=sphere('Pointing index finger',(.389,-.063,-.523),(.032,.031,.083),cream)

# Bone hierarchy: articulated limbs, head, original sunglasses, blink and finger.
bpy.ops.object.armature_add(enter_editmode=True)
rig=bpy.context.object;rig.name='LabricaMascotRig';bones=rig.data.edit_bones;bones.remove(bones[0])
def bone(name,head,tail,parent=None):
 b=bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=bones[parent]
 return b
bone('Root',(0,0,-.95),(0,0,-.65))
bone('Spine',(0,0,-.43),(0,0,.14),'Root')
bone('Head',(0,0,.13),(0,0,.68),'Spine')
bone('Glasses',(0,-.3,.435),(0,-.3,.535),'Head')
for side,sign in [('L',-1),('R',1)]:
 bone('UpperArm.'+side,(sign*.252,0,.065),(sign*.348,-.015,-.22),'Spine')
 bone('Forearm.'+side,(sign*.348,-.015,-.22),(sign*.387,-.04,-.414),'UpperArm.'+side)
 bone('Hand.'+side,(sign*.387,-.04,-.414),(sign*.394,-.05,-.488),'Forearm.'+side)
 bone('Thigh.'+side,(sign*.145,0,-.445),(sign*.203,.005,-.7),'Root')
 bone('Shin.'+side,(sign*.203,.005,-.7),(sign*.209,-.027,-.9),'Thigh.'+side)
 bone('Eye.'+side,(sign*.09,-.341,.462),(sign*.09,-.341,.502),'Head')
bone('Index.R',(.389,-.063,-.448),(.389,-.063,-.598),'Hand.R')
bpy.ops.object.mode_set(mode='OBJECT')
def bind(obj,weights):
 obj.parent=rig
 groups={name:obj.vertex_groups.new(name=name) for name in rig.data.bones.keys()}
 for vertex in obj.data.vertices:
  position=obj.matrix_world @ vertex.co
  for name,weight in weights(position).items():
   if weight>.0001:groups[name].add([vertex.index],weight,'REPLACE')
 mod=obj.modifiers.new('Character rig','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
def smooth(a,b,value):
 t=max(0,min(1,(value-a)/(b-a)));return t*t*(3-2*t)
def body_weights(p):
 x,y,z=p;side='R' if x>=0 else 'L'
 head=smooth(.03,.21,z)
 arm=0
 # Hands/arms stop above the thighs; avoid pulling the outside of a leg.
 arm*=smooth(-.54,-.41,z)
 leg=1-smooth(-.52,-.36,z)
 head=min(head,1);arm=min(arm,1-head);leg=min(leg,1-head-arm)
 fore=1-smooth(-.28,-.16,z);hand=1-smooth(-.43,-.37,z)
 shin=1-smooth(-.76,-.66,z)
 return {'Head':head,'Spine':1-head-arm-leg,'UpperArm.'+side:arm*(1-fore),'Forearm.'+side:arm*fore*(1-hand),'Hand.'+side:arm*hand,'Thigh.'+side:leg*(1-shin),'Shin.'+side:leg*shin}
bind(body,body_weights);bind(glasses,lambda p:{'Glasses':1});bind(patch,lambda p:{'Head':1})
bind(torso,body_weights)
for obj in repairs:bind(obj,lambda p:{'Head':1})
for obj,bone_name in arm_parts:bind(obj,lambda p,n=bone_name:{n:1})
for obj,side in eye_objects:bind(obj,lambda p,s=side:{'Eye.'+s:1})
bind(finger,lambda p:{'Index.R':1})

pose=rig.pose.bones
for p in pose:p.rotation_mode='XYZ'
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=270
def key(name,frame,rotation=None,location=None,scale=None):
 p=pose[name]
 if rotation is not None:p.rotation_euler=rotation;p.keyframe_insert('rotation_euler',frame=frame)
 if location is not None:p.location=location;p.keyframe_insert('location',frame=frame)
 if scale is not None:p.scale=scale;p.keyframe_insert('scale',frame=frame)
for frame in range(1,79,3):
 t=(frame-1)/77;stride=math.sin(t*math.pi*8);strength=min(1,(1-t)*4)
 key('Root',frame,location=(2.5*(1-t),.02*abs(stride)*strength,0),rotation=(0,-.9*(1-smooth(.45,1,t)),0))
 for side,sign in [('L',1),('R',-1)]:
  key('Thigh.'+side,frame,rotation=(sign*.25*stride*strength,0,0))
  key('Shin.'+side,frame,rotation=(max(0,-sign*stride)*.25*strength,0,0))
  key('UpperArm.'+side,frame,rotation=(-sign*.16*stride*strength,0,0))
key('Root',79,location=(0,0,0),rotation=(0,0,0));key('Root',270,location=(0,0,0))
for side in ['L','R']:
 for name in ['Thigh.','Shin.','UpperArm.']:key(name+side,79,rotation=(0,0,0))
key('Index.R',1,scale=(.01,.01,.01));key('Index.R',207,scale=(.01,.01,.01));key('Index.R',225,scale=(1,1,1));key('Index.R',270,scale=(1,1,1))
# Left hand reaches toward the temple; glasses slide down, then a single wink.
for frame,angle in [(1,0),(83,0),(110,1.55),(148,1.55),(173,0),(270,0)]:key('UpperArm.L',frame,rotation=(0,0,angle))
for frame,angle in [(1,0),(83,0),(110,2.25),(148,2.25),(173,0),(270,0)]:key('Forearm.L',frame,rotation=(.08*angle,0,angle))
for frame,drop in [(1,0),(113,0),(135,-.087),(174,-.087),(195,0),(270,0)]:key('Glasses',frame,location=(0,drop,abs(drop)*.3))
for frame,value in [(1,1),(143,1),(149,.08),(156,.08),(162,1),(270,1)]:key('Eye.R',frame,scale=(1,value,1))
for frame,angle in [(1,0),(179,0),(216,-2.45),(245,-2.45),(270,-2.45)]:key('UpperArm.R',frame,rotation=(0,0,angle))
for frame,angle in [(1,0),(179,0),(225,-.15),(270,-.15)]:key('Hand.R',frame,rotation=(0,0,angle))
for frame,angle in [(1,0),(180,0),(217,-.08),(270,-.08)]:key('Forearm.R',frame,rotation=(0,0,angle))
for frame,angle in [(1,0),(79,0),(115,-.045),(160,.04),(190,0),(225,-.055),(270,-.055)]:key('Head',frame,rotation=(0,0,angle))
rig.animation_data.action.name='Enter_AdjustGlasses_Wink_Point'

# Local previews and editable master. Transparent render, camera never animates.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.film_transparent=True
scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100
def aim(obj,target):obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,-4.5,.15));camera=bpy.context.object;aim(camera,(0,0,.03));camera.data.type='ORTHO';camera.data.ortho_scale=2.35;scene.camera=camera
for location,power,size,color in [((-3,-4,4),450,4,(.88,.94,1)),((3,-3,1),230,3,(1,.94,.83)),((3,2,3),300,3,(.2,1,.53))]:
 bpy.ops.object.light_add(type='AREA',location=location);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,0))
for frame in [35,80,138,153,235]:
 scene.frame_set(frame);scene.render.filepath=f'/tmp/labrica-rig-{frame}.png';bpy.ops.render.render(write_still=True)
if shutil.which('cwebp'):
 subprocess.run(['cwebp','-quiet','-q','90','/tmp/labrica-rig-80.png','-o',os.path.join(ROOT,'public','landing-assets','mascot-3d-poster.webp')],check=True)
scene.frame_set(80)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','mascot','labrica-mascot.blend'))
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public','landing-assets','labrica-mascot.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_image_format='JPEG',export_jpeg_quality=90)
