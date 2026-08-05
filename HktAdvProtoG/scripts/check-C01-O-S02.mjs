// C01-O-S02 Step Gate 점검 + 완료 증거 생성.
// 사용: node scripts/check-C01-O-S02.mjs   (HktAdvProtoG/ 루트에서)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineC01Ontology } from '../packages/ontology/src/c01Ontology.js';
import { createInitialWorldState, validateWorldState } from '../packages/ontology/src/worldOntology.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const ontology = defineC01Ontology();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

check('CYCLE.yaml 요소 전부 존재론 표현 (완료 조건)', () => {
  const misses = [];
  for (const id of cycleSpec.regionScope.places) if (!ontology.has('place', id)) misses.push(`place/${id}`);
  for (const id of cycleSpec.regionScope.movement) if (!ontology.has('route', id)) misses.push(`route/${id}`);
  for (const s of cycleSpec.subjectsAndFactions) if (!ontology.has('subject-archetype', s.id)) misses.push(`subject/${s.id}`);
  for (const r of cycleSpec.playerRoles) if (!ontology.has('player-role', r.id)) misses.push(`role/${r.id}`);
  for (const id of cycleSpec.resourceEconomy.resources) if (!ontology.has('resource', id)) misses.push(`resource/${id}`);
  for (const id of cycleSpec.resourceEconomy.crafts) if (!ontology.has('craft-item', id)) misses.push(`craft/${id}`);
  if (misses.length) throw new Error(`누락: ${misses.join(', ')}`);
  return `장소${ontology.idsByKind('place').length} 경로${ontology.idsByKind('route').length} `
    + `주체${ontology.idsByKind('subject-archetype').length}(원형6+player) 역할${ontology.idsByKind('player-role').length} `
    + `자원${ontology.idsByKind('resource').length} 제작물${ontology.idsByKind('craft-item').length} `
    + `사건타입${ontology.idsByKind('event-type').length}`;
});

check('초기 상태가 스키마 v1 을 통과', () => {
  const errors = validateWorldState(createInitialWorldState(ontology), ontology);
  if (errors.length) throw new Error(errors.join(' | '));
  return 'schemaVersion=1';
});

check('SC-C01-O-01 스키마 위반 요소 거부', () => {
  const bad = createInitialWorldState(ontology);
  bad.resources['dragon-scale'] = 1;
  bad.region.places['castle'] = {};
  const errors = validateWorldState(bad, ontology);
  if (errors.length !== 2) throw new Error(`위반 2건 기대, 실제 ${errors.length}: ${errors.join(' | ')}`);
  return errors.join(' | ');
});

const snap = ontology.snapshot();
for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
console.log(`ontologyHash=${snap.hash}`);

const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-O-S02.json`, buildEvidence({
    step: 'C01-O-S02',
    status: 'STEP_VERIFIED_LOCAL',
    results: { ontologyHash: snap.hash, checks: results },
    artifacts: ['packages/ontology/src/worldOntology.js', 'packages/ontology/src/c01Ontology.js'],
    limitations: [
      '제작식은 존재론의 최소 기본값 — 품질·숙련 반영은 G/W 확장',
      '공간 좌표·수치 실체화는 W 계층 — 존재론은 어휘와 태그까지만',
      '사건 타입 requiredPayload 강제는 R 계층(사건 로그 기록 시)에서 적용 예정',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-O-S02.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
