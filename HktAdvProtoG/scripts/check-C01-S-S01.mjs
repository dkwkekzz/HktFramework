// C01-S-S01 Step Gate 점검 + 완료 증거 생성.
// 사용: node scripts/check-C01-S-S01.mjs   (HktAdvProtoG/ 루트에서)
import { fileURLToPath } from 'node:url';
import { defineC01Ontology } from '../packages/ontology/src/c01Ontology.js';
import { validateC01Profiles, createC01Cast, createC01Player } from '../packages/subjects/src/c01Subjects.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const ontology = defineC01Ontology();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

check('프로필 6종·역할 4종 존재론 정합', () => {
  const errors = validateC01Profiles(ontology);
  if (errors.length) throw new Error(errors.join(' | '));
  return '원형6 역할4';
});

let cast;
check('표준 배역 생성 결정성 (같은 시드 = 같은 해시)', () => {
  cast = createC01Cast(11, ontology);
  const again = createC01Cast(11, ontology);
  if (cast.castHash !== again.castHash) throw new Error('결정성 실패');
  return `subjects=${Object.keys(cast.subjects).length}, castHash=${cast.castHash}`;
});

check('원형별 지각·행동 차이 (SC-C01-S-01)', () => {
  const byArch = (a) => Object.values(cast.subjects).find((s) => s.archetype === a);
  const herd = byArch('herd-beast'); const apex = byArch('apex-monster');
  if (!herd.behaviors.includes('flee') || herd.behaviors.includes('stalk-prey')) throw new Error('무리 행동 불량');
  if (!apex.behaviors.includes('stalk-prey') || apex.behaviors.includes('flee')) throw new Error('포식자 행동 불량');
  return '무리=flee/포식자=stalk-prey 확인';
});

check('조직 구성원·개체군 수량 (공리 정합 기반)', () => {
  const guild = Object.values(cast.subjects).find((s) => s.archetype === 'hunters-guild');
  const herd = Object.values(cast.subjects).find((s) => s.archetype === 'herd-beast');
  if (!(guild.members?.length >= 2)) throw new Error('조합 구성원 부족');
  if (!(herd.population?.count > 0)) throw new Error('무리 수량 없음');
  return `조합 구성원=${guild.members.length}, 무리=${herd.population.count}`;
});

check('플레이어 역할 4종 생성', () => {
  const players = ['tracker', 'hunter', 'dresser-crafter', 'trader'].map((r, i) => createC01Player(`p${i + 1}`, r, ontology));
  return players.map((p) => `${p.role}(${p.behaviors.length}행동)`).join(', ');
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-S-S01.json`, buildEvidence({
    step: 'C01-S-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: { castHash: cast.castHash, subjectCount: Object.keys(cast.subjects).length, checks: results },
    artifacts: ['packages/subjects/src/subjectModel.js', 'packages/subjects/src/c01Subjects.js'],
    limitations: [
      '의존 선언은 미포함 — D 계층이 원형에서 의존 그래프를 생성한다 (D2)',
      '지각·행동은 후보 목록 — 실제 선택은 P(전략)·R(지각/의도) 계층에서',
      '배역 규모는 표준 1벌(주체 8) — 지역 배치·수량 실체화는 W 계층에서',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-S-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
