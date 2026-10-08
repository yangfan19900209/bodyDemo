// Build the reproducible full-body component list from cached source metadata.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'source');
const data = JSON.parse((await fs.readFile(path.join(source, 'anatomy-source-data.json'), 'utf8')).replace(/^\uFEFF/, ''));
const old = JSON.parse((await fs.readFile(path.join(source, 'selected-source.json'), 'utf8')).replace(/^\uFEFF/, ''));
const all = Object.values(data).flat();
const lookup = new Map(all.map(item => [item.id, item]));
const items = new Map();
function add(item, system, group) { items.set(item.id, { ...item, system, ...(group ? { group } : {}) }); }
function addIds(ids, system, group) { for (const id of ids) add(lookup.get(id) ?? { id, nameEn: id, nameCn: id }, system, group); }
for (const item of data.skeletal) add(item, 'bones');
for (const item of data.digestive.filter(x => /tooth/i.test(x.nameEn))) add(item, 'bones');
for (const item of old.filter(x => x.systemEn === 'Cardiovascular System')) add(item, /vein|vena|venous|caval|azygos/i.test(item.nameEn) ? 'veins' : 'arteries');
const majorVessels = /femoral artery|femoral vein|tibial|fibular artery|brachial artery|brachial vein|radial artery|ulnar artery|cephalic vein|basilic vein|great saphenous|popliteal|carotid|jugular|palmar arch|dorsalis pedis|deep femoral/;
for (const item of data.cardiovascular.filter(x => majorVessels.test(x.nameEn))) add(item, /vein|vena|venous|caval|azygos/i.test(item.nameEn) ? 'veins' : 'arteries');
const brain = data.nervous.filter(x => /gyrus|insula|occipital lobe|superior parietal lobule|white matter of.+cerebral/i.test(x.nameEn));
for (const item of brain) add(item, 'organs', 'brain');
addIds(['FJ1769','FJ1831','FJ1775','FJ1822','FJ1781','FJ1830','FJ1793','FJ1794'], 'organs', 'brain');
addIds(['FJ2428','FJ2438','FJ2439'], 'organs', 'heart');
addIds(['FJ2409','FJ2818','FJ2819','FJ2820','FJ2821','FJ2822','FJ2823','FJ2824'], 'organs', 'liver');
addIds(['FJ2817'], 'organs', 'gallbladder');
addIds(['FJ2564'], 'organs', 'stomach');
addIds(['FJ2561'], 'organs', 'spleen');
addIds(['FJ1895'], 'organs', 'pancreas');
addIds(['FJ3145'], 'organs', 'left-kidney');
addIds(['FJ3147'], 'organs', 'right-kidney');
addIds(['FJ3149'], 'organs', 'bladder');
addIds(['FJ2573'], 'organs', 'duodenum');
for (const item of data.digestive.filter(x => /small intestine|jejunum|ileum/i.test(x.nameEn))) add(item, 'organs', 'small-intestine');
for (const item of data.digestive.filter(x => /large intestine|colon|rectum|caecum|cecum|appendix/i.test(x.nameEn))) add(item, 'organs', 'large-intestine');
addIds(['FJ2541'], 'organs', 'trachea');
addIds(['FJ2810'], 'skin', 'skin');
// BodyParts3D 4.0's mirrored respiratory entries contain bronchial trees but
// no lung parenchyma. Add actual 4.3 lung segment meshes from a second mirror.
for (let number = 6595; number <= 6612; number++) {
  const id = 'FJ' + number;
  add({ id, nameEn: 'BodyParts3D 4.3 lung parenchyma', nameCn: '肺实质', remoteMirror: 'olivercase/body_parts_3d_api' }, 'organs', number <= 6603 ? 'left-lung' : 'right-lung');
}
const selected = [...items.values()];
await fs.writeFile(path.join(source, 'selected-full-body.json'), JSON.stringify(selected, null, 2) + '\n');
console.log(JSON.stringify({ total: selected.length, systems: Object.fromEntries(['bones','arteries','veins','organs','skin'].map(s=>[s,selected.filter(x=>x.system===s).length])) }, null, 2));
