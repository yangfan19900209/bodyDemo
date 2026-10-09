/** Build real, aligned lazy assets without ever overwriting the V1 core binary. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { THREE, source, output, readJson, assertCore, readSource, simplify, applySharedFrame, merge, exportAsset } from './model-utils.mjs';
import { bodyRegion, chineseName, neuralType, organSystems } from './anatomy-metadata.mjs';
const coreBytes = await assertCore();
const baseline = await readJson(path.join(source, 'core-manifest-v1.json'));
if (baseline.structures.length !== 640) throw new Error('The preserved V1 manifest must contain exactly 640 structures');
const frame = await readJson(path.join(source, 'shared-frame.json'));
const selection = await readJson(path.join(source, 'selected-v2.json'));
const audit = { generatedAt: '2026-10-09', coreSha256: frame.coreSha256, sharedFrame: frame, indexAudit: selection.audit,
  excluded: [...selection.excluded], obtained: [], unavailable: [], calibration: null, assets: [],
  licenseEvidence: {
    '4.0': {source:'jixiangying/anatomy',evidence:'Historical CC BY-SA 2.1 Japan declaration retained in every acquired OBJ header'},
    '4.3': {source:'olivercase/body_parts_3d_api',evidence:'Mirror README declares BodyParts3D CC BY-SA 2.1 Japan; actual OBJ version/FMA/name headers retained'},
    '3.0': {source:'Kevin-Mattheus-Moerman/BodyParts3D',evidence:'Mirror README and LICENSE_content declare original DBCLS BodyParts3D data CC BY-SA 2.1 Japan'},
    currentOfficial: {license:'CC BY 4.0',url:'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',note:'Kept distinct from accompanying historical mirror declarations'}
  } };
audit.coreMetadataReclassification=['FJ1424','FJ1424M','FJ2763','FJ2764'].map(id=>({id,previousSystem:'bones',system:'connective',tissueType:'ligament',
  evidence:'Actual BodyParts3D OBJ English header and original FMA mappings identify a ligament; original core geometry/ID/defaults were retained, not duplicated.'}));
// Compare independent native anatomy anchors without fitting them. The fixed
// tolerance is 1% of native core body height; version shape differences are
// recorded and are not a claim of exact clinical surface coincidence.
let compatible3 = false;
try {
  const anchors=[], toleranceMm=(frame.bounds.max[1]-frame.bounds.min[1])/frame.sourceScale*0.01;
  for(const anchor of [selection.calibration,...(selection.extraCalibration??[])]){
    const calibration = await readSource({...anchor,nameEn:anchor.id==='FMA52734'?'Frontal bone':'Right hip bone'});
    const reference = await readSource({id:anchor.referenceCoreId,filename:anchor.referenceCoreId+'.obj'});
    const a=calibration.sourceBounds,b=reference.sourceBounds;
    const centerDifferenceMm=a.getCenter(new THREE.Vector3()).distanceTo(b.getCenter(new THREE.Vector3()));
    const extentDifferenceMm=a.getSize(new THREE.Vector3()).distanceTo(b.getSize(new THREE.Vector3()));
    anchors.push({sourceIds:[anchor.id,anchor.referenceCoreId],centerDifferenceMm,extentDifferenceMm,
      compatible:centerDifferenceMm<=toleranceMm&&extentDifferenceMm<=toleranceMm,
      bounds3:{min:a.min.toArray(),max:a.max.toArray()},bounds4:{min:b.min.toArray(),max:b.max.toArray()}});
    [...calibration.geometries,...reference.geometries].forEach(g=>g.dispose());
  }
  compatible3=anchors.length>=2&&anchors.every(a=>a.compatible);
  audit.calibration={anchors,toleranceMm,compatible:compatible3,nativeCoreHeightMm:toleranceMm*100,
    note:'All assets use the unchanged common native frame. No independent fitting/translation/scaling. Compatible means bounded version differences, not exact clinical surface coincidence.'};
} catch(error) { audit.calibration = {compatible:false,error:error.message}; }
const palettes = {
  muscles:[0x9c5b51,0x9d645c,0x92594f,0xa56c64,0x905c53,0xab7065,0x86524b,0xa16a60],
  nerves:[0xd3b875,0xc6b079,0xd0b780], connective:[0xd3dcd7,0xc3d4d8,0xe2ded0]
};
const materials = new Map();
function materialFor(item) {
  const palette = palettes[item.assetId];
  const hash = [...item.id].reduce((sum,c)=>sum+c.charCodeAt(0),0);
  const color = palette[hash % palette.length];
  const key = item.assetId+'-'+color;
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:item.assetId==='muscles'?0.72:0.65,metalness:0,name:key}));
  return materials.get(key);
}
const scenes = Object.fromEntries(['muscles','nerves','connective'].map(id=>{const scene=new THREE.Scene();scene.name='BodyParts3D '+id+' — shared core frame';return[id,scene];}));
const added = [];
const registeredSources = new Set(baseline.structures.flatMap(s=>s.sourceComponents??[]));
const actualPrimaryNames = new Set();
for (const item of selection.candidates.filter(x=>x.sourceVersion!=='3.0')) {
  try { const text = await fs.readFile(path.join(source,item.filename),'utf8'); const name=text.match(/^# English name\s*:\s*(.+)$/m)?.[1]?.trim(); if(name)actualPrimaryNames.add(name.toLowerCase()); } catch { /* missing candidate is recorded below */ }
}
for (const candidate of selection.candidates) {
  const item={...candidate};
  if(registeredSources.has(item.id))continue;
  if(item.sourceVersion==='3.0'&&!compatible3){audit.unavailable.push({id:item.id,reason:'The 3.0 native-coordinate calibration is unavailable or outside tolerance'});continue;}
  if(item.sourceVersion==='3.0'&&actualPrimaryNames.has(item.nameEn.toLowerCase())){audit.excluded.push({id:item.id,reason:'A verified newer named mesh already covers this same structure; no duplicate supplement'});continue;}
  let loaded;
  try { loaded=await readSource(item); }
  catch(error){audit.unavailable.push({id:item.id,assetId:item.assetId,sourceUrl:item.sourceUrl,reason:error.message});continue;}
  const {header,sourceBounds,sourceBytes,sourceSha256}=loaded;
  const actualNameEn=header.nameEn;
  const nameEn=item.id==='FJ3901'?'Glossopharyngeal nerve (source laterality unverified)':actualNameEn;
  // The true acquired header wins over a broad/AI-generated index category.
  if(/iliotibial tract|aponeurosis|fascia/i.test(actualNameEn)&&!/tensor fasciae/i.test(actualNameEn)){
    item.system='connective';item.assetId='connective';item.tissueType='fascia';
  }
  const nativeCenter=sourceBounds.getCenter(new THREE.Vector3());
  if(item.sourceVersion==='3.0'){
    const nativeBody=new THREE.Box3(new THREE.Vector3(frame.bounds.min[0]/frame.sourceScale,-frame.bounds.max[2]/frame.sourceScale,frame.bounds.min[1]/frame.sourceScale),
      new THREE.Vector3(frame.bounds.max[0]/frame.sourceScale,-frame.bounds.min[2]/frame.sourceScale,frame.bounds.max[1]/frame.sourceScale)).expandByScalar(5);
    const left=/\bleft\b/i.test(nameEn),right=/\bright\b/i.test(nameEn);
    const lateralityMatches=(!left||nativeCenter.x>0)&&(!right||nativeCenter.x<0);
    const inside=nativeBody.containsBox(sourceBounds);
    if(!inside||!lateralityMatches){audit.unavailable.push({id:item.id,reason:'Supplement outside native body bounds or declared laterality conflicts with native coordinates',bounds:sourceBounds,inside,lateralityMatches});loaded.geometries.forEach(g=>g.dispose());continue;}
  }
  // Refuse to silently call a source tendon/ligament a muscle.
  if(item.tissueType==='muscle'&&/tendon|ligament|retinaculum|trochlea/i.test(nameEn)&&!/tensor fasciae/i.test(nameEn)){
    audit.excluded.push({id:item.id,reason:'Actual source header identifies connective tissue, not muscle',actualName:nameEn});loaded.geometries.forEach(g=>g.dispose());continue;
  }
  const geoms=[], inputTriangles=loaded.geometries.reduce((n,g)=>n+(g.index?.count??g.attributes.position.count)/3,0);
  const ratio=item.assetId==='muscles'?(item.sourceVersion==='3.0'?0.018:0.12):item.assetId==='nerves'?0.5:item.sourceVersion==='3.0'?0.018:0.24;
  const errorMm=item.assetId==='muscles'?0.65:item.assetId==='nerves'?0.075:item.sourceVersion==='3.0'?0.65:0.25;
  for(const original of loaded.geometries){const reduced=await simplify(original,ratio,errorMm);applySharedFrame(reduced,frame);geoms.push(reduced);}
  const geometry=merge(geoms);
  const id=(item.assetId==='muscles'?'muscle-':item.assetId==='nerves'?'nerve-':'connective-')+item.id;
  const sourceIds=[...new Set([item.id,header.fmaId].filter(Boolean))];
  const tissueType=/spinal cord/i.test(nameEn)?'neural':item.tissueType;
  const mesh=new THREE.Mesh(geometry,materialFor(item));mesh.name=id;mesh.userData={structureId:id,system:item.system,sourceComponents:[item.id],sourceIds,tissueType};
  scenes[item.assetId].add(mesh);
  const structure={id,nameZh:item.id==='FJ3901'?'舌咽神经（源侧别待核）':chineseName(nameEn,item.nameCn),nameEn,system:item.system,description:'',assetId:item.assetId,
    bodyRegion:bodyRegion(nameEn,sourceBounds),sourceIds,sourceComponents:[item.id],
    tissueType,
    ...(item.assetId==='nerves'?{neuralType:neuralType(nameEn),organSystem:'nervous'}:{}),
    defaultVisible:false,defaultOpacity:1};
  added.push(structure);registeredSources.add(item.id);
  audit.obtained.push({id,assetId:item.assetId,sourceIds,nameEn,nameZh:structure.nameZh,tissueType:structure.tissueType,neuralType:structure.neuralType,
    version:header.version,sourceUrl:item.sourceUrl,sourceBytes,sourceSha256,sourceHeader:header,
    sourceBounds:{min:sourceBounds.min.toArray(),max:sourceBounds.max.toArray()},
    triangles:geometry.index.count/3,vertices:geometry.attributes.position.count,inputTriangles,bodyRegion:structure.bodyRegion,
    ...(item.id==='FJ3901'?{metadataWarning:'Source English/FMA declare left, but native mesh is entirely at negative x (the subject right); preserved geometry, neutral display label, laterality not claimed.'}:{})});
}
const coreStructures=[];
const confirmedLigaments=new Set(['FJ1424','FJ1424M','FJ2763','FJ2764']);
for(const original of baseline.structures){
  const structure={...original,assetId:'core',sourceIds:[...(original.sourceComponents??[])],bodyRegion:bodyRegion(original.nameEn),
    ...(organSystems[original.id]?{organSystem:organSystems[original.id]}:{})};
  if(confirmedLigaments.has(original.id)){structure.system='connective';structure.tissueType='ligament';}
  else if(/cartilage|intervertebral disk/i.test(original.nameEn))structure.tissueType='cartilage';
  else if(original.system==='bones'&&!/tooth|membrane/i.test(original.nameEn))structure.tissueType='bone';
  else if(['arteries','veins','organs','skin'].includes(original.system))structure.tissueType={arteries:'artery',veins:'vein',organs:'organ',skin:'skin'}[original.system];
  // All core source identities are read from their acquired OBJ headers.
  const rawBounds=new THREE.Box3();
  for(const id of original.sourceComponents??[]){try{const text=await fs.readFile(path.join(source,id+'.obj'),'utf8');const fma=text.match(/^# Concept ID\s*:\s*(.+)$/m)?.[1]?.trim();if(fma&&!structure.sourceIds.includes(fma))structure.sourceIds.push(fma);const b=text.match(/^# Bounds\(mm\):\s*\(([^)]+)\)-\(([^)]+)\)/m);if(b)rawBounds.union(new THREE.Box3(new THREE.Vector3(...b[1].split(',').map(Number)),new THREE.Vector3(...b[2].split(',').map(Number))));}catch{/* Source IDs preserved even if a future offline clone only has core GLB */}}
  structure.bodyRegion=bodyRegion(original.nameEn,rawBounds.isEmpty()?undefined:rawBounds);
  coreStructures.push(structure);
}
const attribution=baseline.source;
const assets=[{id:'core',file:'anatomy.glb',initial:true,structureIds:coreStructures.map(s=>s.id),systemIds:[...new Set(coreStructures.map(s=>s.system))],
  stats:{structures:640,triangles:553914,vertices:314339,bytes:coreBytes.length},source:attribution,license:baseline.license}];
for(const assetId of ['muscles','nerves','connective']){
  const stats=await exportAsset(scenes[assetId],assetId+'.glb');
  const structureIds=added.filter(s=>s.assetId===assetId).map(s=>s.id);
  assets.push({id:assetId,file:assetId+'.glb',initial:false,structureIds,systemIds:[assetId],stats,source:attribution,license:baseline.license});
  audit.assets.push({id:assetId,file:assetId+'.glb',stats,versions:[...new Set(audit.obtained.filter(x=>x.assetId===assetId).map(x=>x.version))]});
}
const structures=[...coreStructures,...added],systems=['bones','muscles','arteries','veins','nerves','connective','organs','skin'];
audit.coverage={
  muscles:Object.fromEntries([...new Set(added.filter(s=>s.system==='muscles').map(s=>s.bodyRegion))].map(region=>[region,added.filter(s=>s.system==='muscles'&&s.bodyRegion===region).length])),
  nerveTypes:Object.fromEntries(['central','cranial','spinal','peripheral'].map(type=>[type,added.filter(s=>s.system==='nerves'&&s.neuralType===type).length])),
  connectiveTypes:Object.fromEntries(['tendon','ligament','fascia'].map(type=>[type,structures.filter(s=>s.system==='connective'&&s.tissueType===type).length])),
  organSystemMetadata:Object.fromEntries([...new Set(coreStructures.map(s=>s.organSystem).filter(Boolean))].map(system=>[system,coreStructures.filter(s=>s.organSystem===system).map(s=>s.id)])),
  respiratoryDigestiveUrinary:'Only existing, real core organs receive system metadata; no unsupported new organ GLB or complete additional system is claimed.',
  lymphatic:'Existing spleen metadata only; no complete lymphatic vessels/nodes or standalone lymphatic layer.',
  meridians:'Reserved concept only, no geometry, no runtime registration, and not a modern anatomical nerve/vessel layer.'};
const manifest={...baseline,schemaVersion:2,label:'BodyParts3D 多层全身解剖',assets,structures,frame,
  stats:{...baseline.stats,coreStructures:640,coreTriangles:553914,coreBytes:coreBytes.length,coreSourceComponents:770,sourceComponents:registeredSources.size,
    inputTriangles:baseline.stats.inputTriangles+audit.obtained.reduce((n,s)=>n+s.inputTriangles,0),
    structures:structures.length,meshes:structures.length,triangles:assets.reduce((n,a)=>n+a.stats.triangles,0),vertices:assets.reduce((n,a)=>n+a.stats.vertices,0),
    glbBytes:assets.reduce((n,a)=>n+a.stats.bytes,0),systems:Object.fromEntries(systems.map(s=>[s,structures.filter(x=>x.system===s).length]))},
  limitations:'真实模型数据子集；新增神经以脊髓、部分脑神经和左颈胸/上肢神经为主，未覆盖坐骨、股神经与完整双侧周围神经。连接组织只注册确证网格，未包含完整膝韧带与手足独立肌腱。中文标签未经医学专家审校。'};
await assertCore();
await fs.writeFile(path.join(output,'anatomy.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(output,'asset-audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({stats:manifest.stats,assets:assets.map(a=>({id:a.id,stats:a.stats})),unavailable:audit.unavailable.length,calibration:audit.calibration},null,2));
for(const scene of Object.values(scenes))scene.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});materials.forEach(m=>m.dispose());
