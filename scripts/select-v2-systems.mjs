/** Candidate selection only. Final registration requires a parsed real mesh. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source');
const read = async name => JSON.parse((await fs.readFile(path.join(source, name), 'utf8')).replace(/^\uFEFF/, ''));
const data = await read('anatomy-source-data.json');
const core = await read('selected-full-body.json');
const paths = await read('bodyparts43-paths.json');
const coreSources = new Set(core.map(item => item.id));
const tree = paths.map(file => {
  const match = file.match(/^meshes\/(FJ\d+M?)_(BP\d+)_(FMA\d+)_(.+)\.obj$/);
  return match ? { id: match[1], bpId: match[2], fmaId: match[3], nameEn: match[4], file } : null;
}).filter(Boolean);
const original = new Map(Object.values(data).flat().map(item => [item.id, item]));
const items = new Map(), excluded = [];
function add(item, system, tissueType, version = '4.0') {
  if (coreSources.has(item.id)) return;
  const entry = tree.find(x => x.id === item.id);
  const assetId = system === 'muscles' ? 'muscles' : system === 'nerves' ? 'nerves' : 'connective';
  const url = version === '4.0'
    ? `https://raw.githubusercontent.com/jixiangying/anatomy/main/isa_BP3D_4.0_obj_99/${item.id}.obj`
    : `https://media.githubusercontent.com/media/olivercase/body_parts_3d_api/main/${entry.file.split('/').map(encodeURIComponent).join('/')}`;
  items.set(item.id, { ...item, system, assetId, tissueType, sourceVersion: version, sourceUrl: url, filename: item.id + '.obj', expectedFmaId: entry?.fmaId });
}
for (const item of data.muscular) {
  if (/trochlea|subdivision of muscle layer/i.test(item.nameEn)) {
    excluded.push({ id: item.id, reason: 'Not a verified skeletal muscle: anatomical pulley or bowel muscle layer', indexName: item.nameEn });
  } else if (/fascia|aponeurosis|iliotibial tract/i.test(item.nameEn)&&!/tensor fasciae latae/i.test(item.nameEn)) add(item,'connective','fascia');
  else if (/tendon/i.test(item.nameEn)) add(item, 'connective', 'tendon');
  else if (/ligament/i.test(item.nameEn)) add(item, 'connective', 'ligament');
  else add(item, 'muscles', 'muscle'); // Tensor fasciae latae is a muscle.
}
// Named ligaments/membranes already in the core are deliberately not duplicated.
for (const item of Object.values(data).flat()) {
  if (/ligament|retinaculum/i.test(item.nameEn)) add(item, 'connective', 'ligament');
}
for (const entry of tree) {
  if (/inguinal ligament|stylomandibular ligament|flexor retinaculum/i.test(entry.nameEn)) {
    add({ ...entry, nameCn: original.get(entry.id)?.nameCn }, 'connective', 'ligament', '4.3');
  }
  const major = /neural tissue of spinal cord|brachial nerve plexus|(?:first|second|third|fourth|fifth|sixth|seventh|eighth) cervical nerve|(?:first|second) thoracic nerve|median nerve|ulnar nerve|radial nerve|axillary nerve|musculocutaneous nerve|phrenic nerve|vagus nerve|accessory nerve|hypoglossal nerve|trigeminal nerve|facial nerve|oculomotor nerve|abducens nerve|vestibulocochlear nerve|glossopharyngeal nerve|trochlear nerve|optic nerve|recurrent laryngeal nerve/i;
  // Keep major trunks/cords and named cranial nerves, rather than hundreds of
  // small facial/digital branches. Do not include venous/choroid plexuses.
  const smallBranch = /digital|palmar|dorsal digital|buccal branch|cervical branch|marginal mandibular|temporal branch|zygomatic branch|palpebral|infratrochlear|supratrochlear|central canal|venous|artery|choroid/i;
  if (major.test(entry.nameEn) && !smallBranch.test(entry.nameEn)) add({ ...entry, nameCn: original.get(entry.id)?.nameCn }, 'nerves', 'nerve', '4.3');
}
// 3.0 supplies high-priority muscles absent from the verified 4.0/4.3 mirrors.
// These are true global-coordinate STL meshes; their alignment is validated
// against the existing body before they are registered in the final manifest.
const supplements = [
  ['FMA13377','Right rectus abdominis','右腹直肌'], ['FMA13378','Left rectus abdominis','左腹直肌'],
  ['FMA13358','Right latissimus dorsi','右背阔肌'], ['FMA13359','Left latissimus dorsi','左背阔肌'],
  ['FMA49001','Superficial part of right masseter','右咬肌浅部'], ['FMA49002','Superficial part of left masseter','左咬肌浅部'],
  ['FMA49004','Deep part of right masseter','右咬肌深部'], ['FMA49005','Deep part of left masseter','左咬肌深部'],
  ['FMA49007','Right temporalis','右颞肌'], ['FMA49008','Left temporalis','左颞肌'],
  ['FMA58776','Right iliotibial tract','右髂胫束'], ['FMA58777','Left iliotibial tract','左髂胫束'],
];
for (const [id, nameEn, nameCn] of supplements) items.set(id, { id, nameEn, nameCn,
  system: /iliotibial/i.test(nameEn) ? 'connective' : 'muscles',
  assetId: /iliotibial/i.test(nameEn) ? 'connective' : 'muscles',
  tissueType: /iliotibial/i.test(nameEn) ? 'fascia' : 'muscle', sourceVersion: '3.0', filename: id + '.stl',
  sourceUrl: `https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl/${id}.stl`, expectedFmaId: id });
const selected = [...items.values()];
await fs.writeFile(path.join(source, 'selected-v2.json'), JSON.stringify({ candidates: selected, excluded,
  calibration: { id: 'FMA52734', filename: 'FMA52734.stl', sourceVersion: '3.0',
    sourceUrl: 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl/FMA52734.stl',
    referenceCoreId: 'FJ3200', purpose: 'Compare native frontal-bone bounds across 3.0 STL and 4.0 OBJ without inventing independent translations.' },
  extraCalibration: [{ id:'FMA16586',filename:'FMA16586.stl',sourceVersion:'3.0',referenceCoreId:'FJ3152',
    sourceUrl:'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl/FMA16586.stl',purpose:'Independent native pelvis anchor'}],
  audit: { muscularIndexCandidates: data.muscular.length, nervousIndexCandidates: data.nervous.length,
    unverifiedTargets: ['Sciatic nerve', 'Femoral nerve', 'Right median/ulnar/radial and brachial plexus', 'Patellar/cruciate/collateral ligaments', 'Independent hand/foot flexor-extensor tendons'],
    note: 'These targets have no verified named mesh in the cached 4.0/4.3 sources. No mirrored or procedural substitutes are fabricated.' } }, null, 2) + '\n');
console.log(JSON.stringify({ total: selected.length, assets: Object.fromEntries(['muscles','nerves','connective'].map(id => [id, selected.filter(x=>x.assetId===id).length])), excluded: excluded.length }, null, 2));
