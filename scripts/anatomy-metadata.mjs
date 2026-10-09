// Labels use source ontology names; regions are browsing groups, not depth layers.
export function bodyRegion(name, bounds) {
  const n = name.toLowerCase();
  if (/spinal cord/.test(n)) return '背部';
  if (/carpi|forearm|brachii|brachialis|deltoid|axillary|brachial|median nerve|ulnar nerve|radial nerve|musculocutaneous|supraspinatus|infraspinatus|subscapularis|teres|anconeus|pronator|supinator/.test(n)) return '肩部与上肢';
  if (/hand|palmar|finger|pollicis|digiti minimi.*hand/.test(n)) return '手部';
  if (/foot|plantar|calcaneal|hallucis brevis|digitorum brevis|metatars/.test(n)) return '足部';
  if (/femor|femur|glute|sciatic|tibia|fibula|gastrocnemius|soleus|sartorius|quadriceps|vastus|hamstring|semitendin|semimembran|psoas|iliacus|iliotibial|pectineus|adductor (?:magnus|longus|brevis)|popliteus|pelvi|hip bone|patella|inguinal|obturator/.test(n)) return '臀部与下肢';
  if (/brain|cranial|skull|frontal bone|parietal bone|temporal bone|occipital bone|sphenoid|zygomatic|tooth|maxilla|head|neck|facial|optic|ocular|rectus.*eye|cervical|capitis|thyro|pharyng|laryn|hyoid|tongue|mandib|masseter|temporalis|trigeminal|vagus|oculomotor|trochlear|abducens|glossopharyngeal|vestibulocochlear|accessory nerve|hypoglossal|sternocleidomastoid|scalene|scalenus|palpebr|oblique.*(?:left|right)|intermediate tendon/.test(n)) return '头颈部';
  if (/trapezius|latissimus|rhomboid|erector|spinalis|splenius|longissimus|iliocostalis|multifidus|rotator|interspinal|vertebral/.test(n)) return '背部';
  if (/pectoralis|intercostal|thorac|diaphragm|phrenic|serratus anterior|subclavius|lung|heart/.test(n)) return '胸部';
  if (/abdomin|oblique|bowel|colon|liver|stomach|spleen|pancreas|kidney|bladder|intestin|gallbladder/.test(n)) return '腹部';
  if (bounds) {
    const z = (bounds.min.z + bounds.max.z) / 2;
    const x = Math.abs((bounds.min.x + bounds.max.x) / 2);
    if (z > 1450) return '头颈部';
    if (z < 140) return '足部';
    if (z < 660) return '臀部与下肢';
    if (x > 200 && z < 850) return '手部';
    if (x > 155) return '肩部与上肢';
    if (z > 1150) return '胸部';
    return '腹部';
  }
  return '全身';
}
const nerveNames = {
  'neural tissue of spinal cord': '脊髓神经组织', 'oculomotor nerve': '动眼神经', 'trochlear nerve': '滑车神经', 'abducens nerve': '展神经',
  'vestibulocochlear nerve': '前庭蜗神经', 'glossopharyngeal nerve': '舌咽神经', 'vagus nerve': '迷走神经',
  'accessory nerve': '副神经', 'hypoglossal nerve': '舌下神经', 'trigeminal nerve': '三叉神经', 'facial nerve': '面神经',
  'optic nerve': '视神经', 'recurrent laryngeal nerve': '喉返神经', 'median nerve': '正中神经', 'ulnar nerve': '尺神经',
  'radial nerve': '桡神经', 'axillary nerve': '腋神经', 'maxillary nerve': '上颌神经', 'musculocutaneous nerve': '肌皮神经', 'phrenic nerve': '膈神经',
};
export function chineseName(name, fallback) {
  if (fallback && !/^FJ|^FMA/.test(fallback)) return fallback;
  const n = name.toLowerCase(), side = /\bleft\b/.test(n) ? '左' : /\bright\b/.test(n) ? '右' : '';
  if (/brachial nerve plexus/.test(n)) {
    const part = /inferior trunk/.test(n) ? '下干' : /middle trunk/.test(n) ? '中干' : /superior trunk/.test(n) ? '上干' : /lateral cord/.test(n) ? '外侧束' : /medial cord/.test(n) ? '内侧束' : /posterior cord/.test(n) ? '后束' : '';
    return side + '臂丛' + part;
  }
  const ordinal = ['first','second','third','fourth','fifth','sixth','seventh','eighth'].findIndex(word => n.includes(word));
  if (ordinal >= 0 && /cervical nerve|thoracic nerve/.test(n)) return side + '第' + (ordinal + 1) + (/cervical/.test(n) ? '颈' : '胸') + '神经' + (/trunk/.test(n) ? '干' : '');
  for (const [word, chinese] of Object.entries(nerveNames).sort((a,b)=>b[0].length-a[0].length)) if (n.includes(word)) {
    const part = /pericardial branch/.test(n) ? '心包支' : /phrenico-abdominal/.test(n) ? '膈腹支' : /inferior branch/.test(n) ? '下支' : /superior branch/.test(n) ? '上支' : /orbital branch/.test(n) ? '眶支' : /ganglionic branch/.test(n) ? '神经节支' : /trunk/.test(n) ? '干' : '';
    return side + chinese + part;
  }
  if (/inguinal ligament/.test(n)) return side + '腹股沟韧带';
  if (/stylomandibular ligament/.test(n)) return side + '茎突下颌韧带';
  if (/flexor retinaculum/.test(n)) return side + '腕屈肌支持带';
  return name; // Keep the verified source term rather than inventing a translation.
}
export function neuralType(name) {
  if (/spinal cord/i.test(name)) return 'central';
  if (/cervical nerve|thoracic nerve/i.test(name)) return 'spinal';
  if (/oculomotor|trochlear|abducens|vestibulocochlear|glossopharyngeal|vagus|accessory nerve|hypoglossal|trigeminal|facial|optic nerve|maxillary nerve|recurrent laryngeal/i.test(name)) return 'cranial';
  return 'peripheral';
}
export const organSystems = { brain: 'nervous', heart: 'cardiovascular', 'left-lung': 'respiratory', 'right-lung': 'respiratory', trachea: 'respiratory',
  liver: 'digestive', gallbladder: 'digestive', stomach: 'digestive', pancreas: 'digestive', duodenum: 'digestive', 'small-intestine': 'digestive', 'large-intestine': 'digestive',
  spleen: 'lymphatic', 'left-kidney': 'urinary', 'right-kidney': 'urinary', bladder: 'urinary' };
