// C01-R-S02 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-R-S02.mjs   (HktAdvProtoG/ 루트에서)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBaseScene, buildSituationScene } from '../packages/dependencies/src/c01Scenes.js';
import { buildC01DependencyGraph, C01_SUPPLIES } from '../packages/dependencies/src/c01Dependencies.js';
import { evaluateDependencies } from '../packages/dependencies/src/dependencyGraph.js';
import { planAll } from '../packages/possibilities/src/possibilityGraph.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { PHENOMENON_SENSES } from '../packages/runtime/src/phenomena.js';
import { perceiveAll, validatePerception, PERCEPTION_CHANNELS } from '../packages/runtime/src/perception.js';
import { BeliefLedger, updateBeliefs } from '../packages/runtime/src/beliefs.js';
import { formIntents, CAUTION_THRESHOLD } from '../packages/runtime/src/intents.js';
import { createC01Runtime, senseAndIntend, c01PlaceOf } from '../packages/runtime/src/c01Runtime.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

const setup = (situation = null) => {
  const scene = situation ? buildSituationScene(situation) : buildBaseScene();
  return { scene, runtime: createC01Runtime({ state: scene.state, ontology: scene.ontology }) };
};
const byArchetype = (state, a) => Object.values(state.subjects).find((s) => s.archetype === a);
const plansOf = (scene) => planAll({
  catalog: C01_STRATEGIES, ctx: scene,
  evaluation: evaluateDependencies(buildC01DependencyGraph(scene), C01_SUPPLIES, scene),
}).plans;
const ledgerFrom = (runtime, tick) => {
  const state = runtime.state();
  return updateBeliefs(new BeliefLedger(), perceiveAll({
    subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes,
  }), { tick });
};

/** 목장 습격 — 세계에 자국이 남고, 소식이 퍼진다 */
function raidScene() {
  const { scene, runtime } = setup();
  const apex = byArchetype(scene.state, 'apex-monster').id;
  const villager = byArchetype(scene.state, 'villager').id;
  runtime.commit({ type: 'MonsterMoved', behavior: 'raid-pasture', strategy: 'P-RAID-PASTURE', tick: 1,
    payload: { subjectId: apex, from: 'apex-lair', to: 'village-pasture' },
    at: 'village-pasture', actor: apex, traceId: 'tr-raid' });
  runtime.commit({ type: 'TrackProgress', behavior: 'spread-rumor', strategy: 'P-REPORT-SIGHTING', tick: 2,
    payload: { by: villager, roll: 1 }, at: 'village-pasture', actor: villager, traceId: 'tr-raid' });
  return { scene, runtime, apex, villager };
}

check('R3 지각 어휘 정합 — 양방향 (Handoff: S-S01 프로필 소비)', () => {
  const { scene } = setup();
  const errors = validatePerception(scene.state.subjects, PHENOMENON_SENSES);
  if (errors.length) throw new Error(errors.join(' | '));
  const reach = {};
  for (const spec of Object.values(PERCEPTION_CHANNELS)) reach[spec.reach] = (reach[spec.reach] ?? 0) + 1;
  return `채널 ${Object.keys(PERCEPTION_CHANNELS).length}종 (${Object.entries(reach).map(([k, v]) => `${k}${v}`).join(' ')}), 감각 ${PHENOMENON_SENSES.length}종 전부 읽는 주체 존재`;
});

check('R3 세계를 통째로 보는 주체는 없다 — 감각·거리·예민함이 맞아야 닿는다', () => {
  const { scene, runtime, apex } = raidScene();
  const state = runtime.state();
  const seen = perceiveAll({ subjects: state.subjects, phenomena: runtime.phenomena.list(), routes: state.region.routes });
  const colony = byArchetype(state, 'resource-colony');
  if (seen[colony.id].length) throw new Error('감각 없는 군락이 무언가를 지각했다');
  const villager = byArchetype(state, 'villager');
  if (!seen[villager.id].some((p) => p.direct)) throw new Error('목장에 선 주민이 습격을 못 봤다');
  if (seen[apex.id]?.some((p) => p.sourceEventId === runtime.log.list()[0].id))
    throw new Error('자기가 남긴 자국을 스스로 지각했다');
  const lines = Object.entries(seen).filter(([, v]) => v.length)
    .map(([id, v]) => `${state.subjects[id].role ?? state.subjects[id].archetype}:${v.length}건`);
  return `${lines.join(' ')} / 지각 0건인 주체 ${Object.values(seen).filter((v) => !v.length).length}종`;
});

check('SC-C01-R4-01 과장된 목격 소문 대 실제 흔적 → 상이한 믿음', () => {
  const { runtime, villager } = raidScene();
  const state = runtime.state();
  const ledger = ledgerFrom(runtime, 3);
  const seenIt = ledger.believes(villager, 'village-pasture', 'threat');
  const merchant = byArchetype(state, 'merchant').id;
  const heardIt = ledger.believes(merchant, 'village-pasture', 'threat');
  if (!seenIt || !heardIt) throw new Error('목격·소문 중 한쪽 믿음이 없다');
  if (!(heardIt.magnitude > seenIt.magnitude))
    throw new Error(`소문이 부풀지 않았다: ${heardIt.magnitude} vs ${seenIt.magnitude}`);
  if (!(heardIt.confidence < seenIt.confidence))
    throw new Error(`소문의 확신이 목격보다 낮지 않다: ${heardIt.confidence} vs ${seenIt.confidence}`);
  return `직접 목격(${seenIt.via}) 크기 ${seenIt.magnitude}·확신 ${seenIt.confidence} vs `
    + `소문(${heardIt.via}) 크기 ${heardIt.magnitude}·확신 ${heardIt.confidence}`;
});

check('R4 믿음은 지각에서만 자란다 — 자국이 없으면 아무도 아무것도 모른다', () => {
  const { runtime } = setup();
  const ledger = ledgerFrom(runtime, 1);
  const knowing = ledger.subjects().filter((id) => ledger.of(id).beliefs.length);
  if (knowing.length) throw new Error(`자국 없이 믿는 주체: ${knowing.join(',')}`);
  // 세계에는 포식자가 실재하지만 아무도 그것을 모른다
  const apex = byArchetype(runtime.state(), 'apex-monster');
  if (!apex) throw new Error('장면에 포식자가 없다');
  return '자국 0건 → 믿음 0건 (세계에 포식자가 실재해도 아무도 모른다)';
});

check('SC-C01-R5-BASE-01 위협 기억 → 다음 행동(경계·회피) 반영', () => {
  const { scene, runtime } = setup('ST-C01-01');
  const plans = plansOf(scene);
  const apexId = byArchetype(scene.state, 'apex-monster').id;
  const plan = plans.find((p) => p.subject === apexId);
  if (plan.chosen.id !== 'P-RAID-PASTURE') throw new Error(`포식자의 계획이 ${plan.chosen.id}`);

  // 한 번 내려와 목장을 알게 된다
  runtime.commit({ type: 'MonsterMoved', behavior: 'raid-pasture', strategy: 'P-RAID-PASTURE', tick: 1,
    payload: { subjectId: apexId, from: 'apex-lair', to: 'village-pasture' },
    at: 'village-pasture', actor: apexId, traceId: 'tr-r5' });
  const calm = formIntents({ plans, subjects: runtime.state().subjects, beliefs: new BeliefLedger(), tick: 2, placeOf: c01PlaceOf })
    .intents.find((i) => i.subject === apexId);
  if (!calm.submitted) throw new Error(`기억이 없는데 물러섰다: ${calm.reason}`);

  // 사냥꾼들이 목장에서 거듭 몰아붙인다 — 포식자는 그 싸움 소리를 듣는다
  for (const tick of [2, 3])
    runtime.commit({ type: 'MonsterHunted', behavior: 'fight', strategy: 'P-HUNT-APEX', tick,
      payload: { subjectId: apexId, by: 'pl-hunter' }, at: 'village-pasture', actor: 'pl-hunter', traceId: `tr-h${tick}` });

  const ledger = ledgerFrom(runtime, 4);
  const fear = ledger.weight(apexId, 'village-pasture', 'threat', 4);
  const scared = formIntents({ plans, subjects: runtime.state().subjects, beliefs: ledger, tick: 4, placeOf: c01PlaceOf })
    .intents.find((i) => i.subject === apexId);
  if (scared.submitted) throw new Error('거듭 당하고도 그대로 내려온다');

  const healed = formIntents({ plans, subjects: runtime.state().subjects, beliefs: ledger, tick: 400, placeOf: c01PlaceOf })
    .intents.find((i) => i.subject === apexId);
  if (!healed.submitted) throw new Error('기억이 흐려졌는데도 영영 물러서 있다');
  return `기억 0 → 진입 / 기억 ${fear} ≥ 이득 ${plan.chosen.gain}+${CAUTION_THRESHOLD} → 회피 / 400tick 뒤 기억 ${ledger.weight(apexId, 'village-pasture', 'threat', 400)} → 복귀`;
});

check('R6 모르는 곳으로는 가지 않는다 — 전지적 주체 금지', () => {
  const { scene, runtime } = setup('ST-C01-01');
  const plans = plansOf(scene);
  const apexId = byArchetype(scene.state, 'apex-monster').id;
  const blind = formIntents({ plans, subjects: runtime.state().subjects, beliefs: new BeliefLedger(), tick: 1, placeOf: c01PlaceOf })
    .intents.find((i) => i.subject === apexId);
  if (blind.submitted) throw new Error('모르는 곳으로 나섰다');
  if (!/모른다/.test(blind.reason)) throw new Error(`거절 사유가 앎이 아니다: ${blind.reason}`);
  return blind.reason;
});

check('R6 의도는 사건이 아니다 — 세계를 바꾸지 않는다', () => {
  const { scene, runtime } = setup('ST-C01-01');
  runtime.commit({ type: 'MonsterMoved', behavior: 'raid-pasture', strategy: 'P-RAID-PASTURE', tick: 1,
    payload: { subjectId: byArchetype(scene.state, 'apex-monster').id, from: 'apex-lair', to: 'village-pasture' },
    at: 'village-pasture', actor: byArchetype(scene.state, 'apex-monster').id });
  const before = { hash: runtime.hash(), events: runtime.log.length, phenomena: runtime.phenomena.length };
  const r = senseAndIntend({ runtime, subjects: runtime.state().subjects, plans: plansOf(scene), tick: 2 });
  if (runtime.hash() !== before.hash || runtime.log.length !== before.events || runtime.phenomena.length !== before.phenomena)
    throw new Error('의도가 세계를 바꿨다');
  return `의도 ${r.intents.length}건(제출 ${r.submitted.length}) 생성, stateHash 불변 ${before.hash}`;
});

check('결정성 — 같은 자국·같은 계획 → 같은 믿음·의도 해시', () => {
  const run = () => {
    const { scene, runtime } = setup('ST-C01-01');
    runtime.commit({ type: 'MonsterMoved', behavior: 'raid-pasture', strategy: 'P-RAID-PASTURE', tick: 1,
      payload: { subjectId: byArchetype(scene.state, 'apex-monster').id, from: 'apex-lair', to: 'village-pasture' },
      at: 'village-pasture', actor: byArchetype(scene.state, 'apex-monster').id });
    return senseAndIntend({ runtime, subjects: runtime.state().subjects, plans: plansOf(scene), tick: 2 });
  };
  const a = run(); const b = run();
  if (a.hash !== b.hash) throw new Error(`의도 해시 상이: ${a.hash} vs ${b.hash}`);
  if (a.ledger.hash() !== b.ledger.hash()) throw new Error('믿음 해시 상이');
  return `intentHash=${a.hash} beliefHash=${a.ledger.hash()}`;
});

check('완료 조건 — Lab 에서 주체별 믿음 대 실제 상태 diff 확인', () => {
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  const { scene, runtime } = raidScene();
  const state = runtime.state();
  const ledger = ledgerFrom(runtime, 3);
  const plans = plansOf(scene);
  const { intents } = formIntents({ plans, subjects: state.subjects, beliefs: ledger, tick: 3, placeOf: c01PlaceOf });

  const label = (id) => state.subjects[id]?.role ? `player:${state.subjects[id].role}` : state.subjects[id]?.archetype ?? id;
  const rows = [];
  for (const id of ledger.subjects()) {
    if (!ledger.of(id).beliefs.length) continue;
    for (const d of ledger.diff(id, state)) rows.push({ subject: label(id), ...d });
  }
  if (!rows.length) throw new Error('믿음 대 실제 diff 가 비었다');
  writeFileSync(`${dir}/sample-beliefs.json`, JSON.stringify({
    label: '목장 습격 후 주체별 믿음 (R4·R5)',
    beliefDiff: rows,
    intents: intents.map((i) => ({ ...i, subject: label(i.subject) })),
    channels: PERCEPTION_CHANNELS,
  }, null, 2) + '\n');
  return `주체 ${new Set(rows.map((r) => r.subject)).size}종 x 믿음 ${rows.length}건 → apps/lab/sample-beliefs.json`;
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  const { runtime, villager } = raidScene();
  const ledger = ledgerFrom(runtime, 3);
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-R-S02.json`, buildEvidence({
    step: 'C01-R-S02',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      channelCount: Object.keys(PERCEPTION_CHANNELS).length,
      beliefHash: ledger.hash(),
      knowingSubjects: ledger.subjects().filter((id) => ledger.of(id).beliefs.length).length,
      villagerBelief: ledger.believes(villager, 'village-pasture', 'threat'),
      checks: results,
    },
    artifacts: [
      'packages/runtime/src/perception.js',
      'packages/runtime/src/beliefs.js',
      'packages/runtime/src/intents.js',
    ],
    limitations: [
      '믿음의 주제는 장소 x 주제(위협·고갈·기회·계약 등) 단위 — 개체 단위 추적(누가 어디 있는지)은 E/G 에서',
      '소문은 한 단계만 왜곡된다 — 사람을 거칠수록 더 어긋나는 다단 전파는 E1(사회적 상호작용)의 몫',
      '기억 감쇠는 주제별 고정 계수 — 주체 기질(겁·담대함)에 따른 차이는 G 성장에서',
      '의도는 계획 1건당 1개 — 동시 다중 의도·파티 분업은 E1/E2 에서',
      '거짓말·기만으로 남의 믿음을 흔드는 경로는 아직 없다 (E1)',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-R-S02.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
