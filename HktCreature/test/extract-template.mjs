// extract-template.mjs — Mixamo 표준 리그의 rest 계층을 실측해 src/rig-template.js 를 재생성한다.
//
// 리그를 "코드로 짓기" 위한 휴머노이드 템플릿(뼈 이름·부모·로컬 rest 변환)은 손으로
// 추정하지 않고 실물 Mixamo FBX(idle) 에서 한 번 추출해 데이터로 굳힌다. 이 스크립트가
// 그 추출기 — 리그 소스를 갈아끼울 때만 다시 돌린다.
//
//   node test/extract-template.mjs
//
// 평소 개발/검증에는 필요 없다(생성물 src/rig-template.js 는 커밋됨).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

globalThis.self = globalThis; // FBXLoader 최소 스텁
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'public', 'assets', 'anim', 'idle.fbx');
const OUT = join(HERE, '..', 'src', 'rig-template.js');

const buf = readFileSync(SRC);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const obj = new FBXLoader().parse(ab, '');

const bones = [];
obj.traverse(o => { if (o.isBone) bones.push(o); });

const rows = bones.map(b => {
  const r4 = v => +v.toFixed(4);
  const parent = b.parent && b.parent.isBone ? b.parent.name : null;
  return {
    name: b.name, parent,
    pos: [b.position.x, b.position.y, b.position.z].map(r4),
    quat: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w].map(r4),
  };
});

const body = rows.map(r =>
  `  { name: ${JSON.stringify(r.name)}, parent: ${JSON.stringify(r.parent)}, ` +
  `pos: [${r.pos.join(', ')}], quat: [${r.quat.join(', ')}] },`).join('\n');

writeFileSync(OUT, `// 자동 생성: Mixamo 표준 리그(idle.fbx)의 rest 계층 실측값을 그대로 굳힌 휴머노이드 템플릿.
// 단위 = cm (Mixamo 원본 스케일; Hips.y≈103). 부모=null 이면 리그 루트(Hips).
// rig.js 의 buildRig() 가 이 표에서 THREE.Bone 을 절차 생성한다 — 손으로 그린 에셋 없음.
// 재생성: node test/extract-template.mjs
export const RIG_TEMPLATE = [
${body}
];
`);
console.log(`wrote ${OUT}  (${rows.length} bones)`);
