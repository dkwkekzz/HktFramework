// C01-O-S01 Step Gate 점검 + 완료 증거 생성.
// 사용: node scripts/check-C01-O-S01.mjs   (HktAdvProtoG/ 루트에서)
import { fileURLToPath } from 'node:url';
import {
  AxiomRegistry, validateTransition, validateWorldProposal, validateAuthorityResolution,
} from '../packages/ontology/src/axioms.js';
import { registerC01Axioms } from '../packages/ontology/src/c01Axioms.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const reg = registerC01Axioms(new AxiomRegistry());
const results = [];
const expectViolation = (name, report, code) => {
  const hit = !report.passed && report.violations.some((v) => v.violationCode === code);
  results.push({ name, passed: hit, detail: hit ? code : `기대 ${code}, 실제 ${JSON.stringify(report.violations)}` });
};
const expectPass = (name, report) => {
  results.push({ name, passed: report.passed, detail: report.passed ? 'ok' : JSON.stringify(report.violations) });
};

expectViolation('실패1 비용 없는 생산 거부', validateTransition({
  before: { resources: { 'healing-herb': 3 } },
  after: { resources: { 'healing-herb': 3, 'healing-potion': 99 } },
  input: { events: [{ type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 99 }] } }] },
}, reg), 'CONSERVATION_NO_COST');

expectViolation('실패2 사건 없는 상태 변경 거부', validateTransition({
  before: { herd: { population: 40 } }, after: { herd: { population: 25 } }, input: { events: [] },
}, reg), 'EVENT_REQUIRED');

expectViolation('실패3 관찰 요소 소급 수정 거부', validateWorldProposal({
  proposal: { modifies: ['region.apexLair.position'] }, observedPaths: ['region.apexLair.position'],
}, reg), 'OBSERVED_RETROACTIVE_CHANGE');

expectViolation('실패4 구성원 없는 조직 행동 거부', validateTransition({
  before: { contracts: {} }, after: { contracts: { 'ct-1': {} } },
  input: { events: [{ type: 'ContractIssued', actor: { kind: 'organization', id: 'hunters-guild' }, payload: {}, statePaths: ['contracts.ct-1'] }] },
}, reg), 'ORG_NO_EMBODIMENT');

expectViolation('실패5 이중 소유 확정 거부', validateAuthorityResolution({
  resource: 'organ-1', claims: [{ by: 'H1' }, { by: 'H2' }], accepted: [{ by: 'H1' }, { by: 'H2' }], resolvedBy: 'authority-server',
}, reg), 'AUTHORITY_DOUBLE_CONFIRM');

expectPass('정상 재료 소비 제작 + 실체 있는 조직 행동 통과', validateTransition({
  before: { resources: { 'healing-herb': 3 }, contracts: {} },
  after: { resources: { 'healing-herb': 1, 'healing-potion': 1 }, contracts: { 'ct-1': {} } },
  input: { events: [
    { type: 'ItemCrafted', payload: { produces: [{ resource: 'healing-potion', qty: 1 }], consumes: [{ resource: 'healing-herb', qty: 2 }] } },
    { type: 'ContractIssued', actor: { kind: 'organization', id: 'hunters-guild', via: { members: ['npc-guild-clerk-1'] } }, payload: {}, statePaths: ['contracts.ct-1'] },
  ] },
}, reg));

const snapshot = reg.snapshot();
for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
console.log(`registryHash=${snapshot.hash}, axioms=${snapshot.axioms.map((a) => a.id).join(',')}`);

const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  const evidence = buildEvidence({
    step: 'C01-O-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      axiomsRegistered: snapshot.axioms.length,
      registryHash: snapshot.hash,
      failureScenarios: 'passed',
      checks: results,
    },
    artifacts: ['packages/ontology/src/axioms.js', 'packages/ontology/src/c01Axioms.js'],
    limitations: [
      '신 유지·능력 흔적 공리는 후속 Cycle 이월 (대상 부재)',
      '보존 공리의 재고 조회는 state.resources 관례 — O-S02 존재론 스키마에서 고정',
      '코드 소비자(W/R/E/N/A)는 해당 Step 에서 연결 — 현재는 REGISTRY.json 계약 배선',
    ],
  });
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-O-S01.json`, evidence);
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-O-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
