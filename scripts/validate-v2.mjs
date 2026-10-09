/** Validate the exported multi-file model and the protected, unchanged V1 core. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE,source,output,readJson,assertCore } from './model-utils.mjs';
await assertCore();
const baseline=await readJson(path.join(source,'core-manifest-v1.json'));
const manifest=await readJson(path.join(output,'anatomy.json'));
const ids=new Set(manifest.structures.map(s=>s.id));
if(ids.size!==manifest.structures.length)throw new Error('Global structure IDs are not unique');
for(const old of baseline.structures){const current=manifest.structures.find(s=>s.id===old.id);if(!current)throw new Error('Missing original '+old.id);if(current.defaultVisible!==old.defaultVisible||current.defaultOpacity!==old.defaultOpacity)throw new Error('Core defaults changed: '+old.id);}
const all=new Map(),summary=[],sourceComponents=new Set();
for(const asset of manifest.assets){
  const bytes=await fs.readFile(path.join(output,asset.file));
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB '+asset.id);
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
  for(const view of json.bufferViews)if((view.byteOffset??0)+view.byteLength>json.buffers[0].byteLength)throw new Error('Invalid bufferView '+asset.id);
  const loaded=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const actual=new Set();let triangles=0,vertices=0;
  loaded.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const id=mesh.userData.structureId,structure=manifest.structures.find(s=>s.id===id);
    if(!structure||structure.assetId!==asset.id||actual.has(id))throw new Error('Asset mapping mismatch '+id);
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,index=mesh.geometry.index;
    for(const value of p.array)if(!Number.isFinite(value))throw new Error('Non-finite position '+id);
    for(const value of n.array)if(!Number.isFinite(value))throw new Error('Non-finite normal '+id);
    if(index.array.some(x=>x>=p.count))throw new Error('Out-of-range index '+id);
    triangles+=index.count/3;vertices+=p.count;actual.add(id);all.set(id,mesh);
    if(asset.id!=='core'&&(structure.defaultVisible!==false||structure.defaultOpacity!==1))throw new Error('An added structure changes the V1 default view '+id);
    for(const component of structure.sourceComponents??[]){if(sourceComponents.has(component))throw new Error('Duplicate source geometry registered across layers: '+component);sourceComponents.add(component);}
  });
  if(actual.size!==asset.structureIds.length||asset.structureIds.some(id=>!actual.has(id)))throw new Error('Incomplete real asset '+asset.id);
  if(triangles!==asset.stats.triangles||vertices!==asset.stats.vertices||bytes.length!==asset.stats.bytes)throw new Error('Asset statistics mismatch '+asset.id);
  summary.push({id:asset.id,structures:actual.size,triangles,vertices,bytes:bytes.length});
}
const body=new THREE.Box3().setFromObject(all.get('skin'));
const padded=body.clone().expandByScalar(0.35);
let outside=0;
for(const structure of manifest.structures.filter(s=>s.assetId!=='core')){
  const mesh=all.get(structure.id),bounds=new THREE.Box3().setFromObject(mesh),center=bounds.getCenter(new THREE.Vector3());
  if(!padded.containsPoint(center))throw new Error('Added structure is misaligned outside the shared body '+structure.id);
  if(!padded.containsBox(bounds))outside++;
  if(!structure.sourceIds?.length||!structure.bodyRegion||!structure.tissueType)throw new Error('Incomplete audited metadata '+structure.id);
}
if(!manifest.structures.some(s=>s.system==='nerves'&&s.neuralType==='central'&&/spinal cord/i.test(s.nameEn)))throw new Error('No real spinal cord registered');
if(manifest.structures.some(s=>s.system==='nerves'&&/eyeball|cerebral|gyrus|choroid plexus/i.test(s.nameEn)))throw new Error('Non-nerve brain/eye tissue was falsely registered as peripheral nerves');
await assertCore();
console.log(JSON.stringify({originalIdsPreserved:640,globalStructures:ids.size,assets:summary,addedBoundsExtendingPastPaddedSkin:outside,coreHashUnchanged:true},null,2));
