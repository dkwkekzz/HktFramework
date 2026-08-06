// C01-R-S01 Step Gate 점검 + Lab 산출 + 완료 증거 생성.
// 사용: node scripts/check-C01-R-S01.mjs   (HktAdvProtoG/ 루트에서)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildBaseScene } from '../packages/dependencies/src/c01Scenes.js';
import { buildC01RequirementGraph } from '../packages/world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { buildPhenomenonCatalog, BEHAVIOR_SENSES } from '../packages/runtime/src/phenomena.js';
import { createC01Runtime, runtimeReport } from '../packages/runtime/src/c01Runtime.js';
import { buildEvidence, writeEvidence } from '../packages/verification/src/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const results = [];
const check = (name, fn) => {
  try { results.push({ name, passed: true, detail: fn() }); }
  catch (e) { results.push({ name, passed: false, detail: e.message }); }
};

const requirementGraph = buildC01RequirementGraph(C01_STRATEGIES);
const newRuntime = () => {
  const scene = buildBaseScene();
  return { scene, runtime: createC01Runtime({ state: scene.state, ontology: scene.ontology, requirementGraph }) };
};
const archetypeId = (scene, a) => Object.values(scene.state.subjects).find((s) => s.archetype === a).id;

/**
 * 무개입 사건 열 — 포식 마물이 골짜기로 내려와 무리를 덮치고 목장까지 밀고 들어온다.
 * 플레이어는 이 사건들을 보지 못한다. 남는 것은 자국뿐이다.
 */
function runRaidSequence() {
  const { scene, runtime } = newRuntime();
  const apex = archetypeId(scene, 'apex-monster');
  const herd = archetypeId(scene, 'herd-beast');
  const trace = 'tr-raid-01';
  const steps = [
    { type: 'MonsterMoved', behavior: 'stalk-prey', strategy: 'P-HUNT-HERD', tick: 1, at: 'herd-valley', actor: apex,
      payload: { subjectId: apex, from: 'apex-lair', to: 'herd-valley' } },
    // 사냥이 치르는 비용은 개체군이다 — 잡은 만큼 줄고, 그 감소가 부산물의 근거가 된다 (I-5)
    { type: 'MonsterHunted', behavior: 'hunt', strategy: 'P-HUNT-HERD', tick: 2, at: 'herd-valley', actor: apex,
      payload: { subjectId: herd, by: apex, consumesPopulation: [{ subjectId: herd, count: 1 }] } },
    { type: 'MonsterMoved', behavior: 'raid-pasture', strategy: 'P-RAID-PASTURE', tick: 3, at: 'village-pasture', actor: apex,
      payload: { subjectId: apex, from: 'herd-valley', to: 'village-pasture' } },
    { type: 'ContractIssued', behavior: 'issue-subjugation-contract', strategy: 'P-SUBJUGATION-CONTRACT',
      tick: 4, at: 'hunter-outpost', actor: archetypeId(scene, 'hunters-guild'),
      payload: { contractId: 'ct-sub-01', kind: 'subjugation' } },
  ];
  for (const s of steps) {
    const r = runtime.commit({ ...s, traceId: trace });
    if (!r.ok) throw new Error(`${s.type} 거부됨: ${r.violations.map((v) => v.violationCode).join(',')}`);
  }
  return { scene, runtime };
}

check('I-3 현상 카탈로그가 Q 의 성공 결과에서 나온다 (Handoff: Q-S01 출력 소비)', () => {
  const catalog = buildPhenomenonCatalog(requirementGraph);
  const fromQ = [...new Set(requirementGraph.outcomes.map((o) => o.behavior))].sort();
  const inCatalog = catalog.entries.map((e) => e.behavior).sort();
  if (JSON.stringify(fromQ) !== JSON.stringify(inCatalog))
    throw new Error(`Q 행동과 카탈로그 불일치: Q ${fromQ.length}종 / 카탈로그 ${inCatalog.length}종`);
  for (const e of catalog.entries)
    if (!e.effects.every((eff) => requirementGraph.outcomes.some((o) => o.behavior === e.behavior && o.effect === eff)))
      throw new Error(`${e.behavior} 의 자국 서술이 Q 에서 오지 않았다`);
  const senses = {};
  for (const e of catalog.entries) senses[e.sense] = (senses[e.sense] ?? 0) + 1;
  return `성공 결과 ${requirementGraph.outcomes.length}건 → 행동 ${inCatalog.length}종 현상 (${Object.entries(senses).map(([k, v]) => `${k}${v}`).join(' ')})`;
});

check('I-3 죽은 매핑·미매핑 행동 거부 (양방향 lint)', () => {
  const missing = { ...BEHAVIOR_SENSES }; delete missing.hunt;
  let caught = [];
  try { buildPhenomenonCatalog(requirementGraph, missing); } catch (e) { caught.push(e.message); }
  try { buildPhenomenonCatalog(requirementGraph, { ...BEHAVIOR_SENSES, 'sing-a-song': { sense: 'sound', legibility: 1 } }); }
  catch (e) { caught.push(e.message); }
  if (caught.length !== 2) throw new Error(`양방향 lint 미작동 (잡힌 것 ${caught.length}건)`);
  return caught.map((m) => m.split(':')[0]).join(' | ');
});

check('R0 읽기 스냅샷은 얼어 있다 — 사건 없는 직접 수정 거부', () => {
  const { runtime } = newRuntime();
  const before = runtime.hash();
  const snap = runtime.state();
  let rejected = 0;
  for (const mutate of [
    () => { snap.resources.meat = 999; },
    () => { snap.region.places['apex-lair'].integrity = 0; },
    () => { snap.subjects = {}; },
  ]) { try { mutate(); } catch { rejected++; } }
  if (rejected !== 3) throw new Error(`직접 수정 ${3 - rejected}건이 통과했다`);
  if (runtime.hash() !== before) throw new Error('스냅샷 수정이 세계에 반영됐다');
  return `직접 수정 3종 전부 거부, stateHash 불변 ${before}`;
});

check('R1 공리 위반 사건 거부 — 상태·로그·자국 전부 불변 (오류 은폐 금지)', () => {
  const { runtime } = newRuntime();
  const before = runtime.hash();
  const noCost = runtime.commit({
    type: 'ItemCrafted', behavior: 'craft-item', tick: 1,
    payload: { produces: [{ resource: 'healing-potion', qty: 5 }], consumes: [] },
  });
  if (noCost.ok) throw new Error('비용 없는 생산이 통과했다');
  if (runtime.hash() !== before || runtime.log.length !== 0 || runtime.phenomena.length !== 0)
    throw new Error('거부된 사건이 흔적을 남겼다');

  let unknown = null;
  try { runtime.commit({ type: 'DragonAwakened', behavior: 'hunt', payload: {}, tick: 1 }); }
  catch (e) { unknown = e.message; }
  if (!unknown) throw new Error('미등록 사건 타입이 통과했다');
  return `${noCost.violations[0].violationCode} + ${unknown}`;
});

check('I-5 값이 나오는 곳은 셋뿐이고 셋 다 유한하다 (재고·산지·개체군)', () => {
  const { scene, runtime } = newRuntime();
  const herd = archetypeId(scene, 'herd-beast');
  const lines = [];

  // 개체군을 비용으로 치른 사냥은 통과한다
  const pop = runtime.state().subjects[herd].population.count;
  const hunted = runtime.commit({ type: 'MonsterHunted', behavior: 'hunt', strategy: 'P-HUNT-HERD', tick: 1,
    payload: { subjectId: herd, by: 'pl-hunter', consumesPopulation: [{ subjectId: herd, count: 2 }],
      produces: [{ resource: 'hide', qty: 2 }] } });
  if (!hunted.ok) throw new Error(`비용 선언 사냥이 거부됨: ${hunted.violations[0].violationCode}`);
  if (runtime.state().subjects[herd].population.count !== pop - 2) throw new Error('개체군이 줄지 않았다');
  lines.push(`사냥 개체군 ${pop}→${pop - 2} → 가죽 +2`);

  // 비용을 선언하지 않으면 거부된다
  const free = runtime.commit({ type: 'MonsterHunted', behavior: 'hunt', strategy: 'P-HUNT-HERD', tick: 2,
    payload: { subjectId: herd, by: 'pl-hunter', produces: [{ resource: 'hide', qty: 2 }] } });
  if (free.ok) throw new Error('비용 없는 부산물이 통과했다');
  lines.push(`무비용 생산 ${free.violations[0].violationCode}`);

  // 산지가 내지 않는 자원은 그 땅에서 나오지 않는다 (예전에는 심사를 통째로 지나갔다)
  const nowhere = runtime.commit({ type: 'ResourceGathered', behavior: 'gather-herbs', strategy: 'P-GATHER-HERBS',
    tick: 3, payload: { resource: 'healing-herb', qty: 2, at: 'lookout-rocks' }, at: 'lookout-rocks' });
  if (nowhere.ok) throw new Error('산출 없는 땅에서 자원이 생겼다');
  lines.push(`무산지 채집 ${nowhere.violations[0].violationCode}`);

  // 있는 것보다 많이 치를 수는 없다
  const tooMany = runtime.commit({ type: 'MonsterHunted', behavior: 'hunt', strategy: 'P-HUNT-HERD', tick: 4,
    payload: { subjectId: herd, by: 'pl-hunter', consumesPopulation: [{ subjectId: herd, count: 9999 }],
      produces: [{ resource: 'hide', qty: 1 }] } });
  if (tooMany.ok || tooMany.violations[0].violationCode !== 'CONSERVATION_INSUFFICIENT_SOURCE')
    throw new Error('개체군을 넘는 소비가 통과했다');
  lines.push(`초과 소비 ${tooMany.violations[0].violationCode}`);
  return lines.join(' | ');
});

check('I-5 산지는 마르고, 마른 뒤의 시도는 기록되지 않는다', () => {
  const { runtime } = newRuntime();
  const land = runtime.state().region.places['marsh-colony'].yields['healing-herb'];
  if (!(land > 0)) throw new Error('W 가 산지 산출을 세계 상태에 올리지 않았다');
  let tick = 0;
  for (let taken = 0; taken < land; taken += 2) {
    const r = runtime.commit({ type: 'ResourceGathered', behavior: 'gather-herbs', strategy: 'P-GATHER-HERBS',
      tick: ++tick, payload: { resource: 'healing-herb', qty: 2, at: 'marsh-colony' }, at: 'marsh-colony' });
    if (!r.ok) throw new Error(`채집 ${tick}회차 거부: ${r.violations[0].violationCode}`);
  }
  if (runtime.state().region.places['marsh-colony'].yields['healing-herb'] !== 0) throw new Error('땅이 마르지 않았다');
  const logged = runtime.log.length;
  const dry = runtime.commit({ type: 'ResourceGathered', behavior: 'gather-herbs', strategy: 'P-GATHER-HERBS',
    tick: ++tick, payload: { resource: 'healing-herb', qty: 2, at: 'marsh-colony' }, at: 'marsh-colony' });
  if (dry.ok || dry.violations[0].violationCode !== 'EVENT_NO_EFFECT') throw new Error('마른 땅에서 또 나왔다');
  if (runtime.log.length !== logged) throw new Error('소득 없는 시도가 로그에 남았다');
  return `습지 약초 ${land} → 0 (${logged}회 채집), 이후 시도는 EVENT_NO_EFFECT 로 미기록`;
});

check('완료 조건 — 임의 상태 조회가 사건 이력으로 완전히 설명됨', () => {
  const { runtime } = runRaidSequence();
  const paths = runtime.explainedPaths();
  if (!paths.length) throw new Error('바뀐 상태 경로가 없다');
  for (const p of paths) {
    const evs = runtime.explain(p);
    if (!evs.length) throw new Error(`${p} 를 설명하는 사건이 없다`);
    if (!evs.every((e) => e.type && e.behavior)) throw new Error(`${p} 의 사건에 타입·행동이 없다`);
  }
  if (runtime.explain('schemaVersion').length) throw new Error('바뀌지 않은 경로에 거짓 설명이 붙었다');
  return `사건 ${runtime.log.length}건이 상태 경로 ${paths.length}종을 전부 설명 (미설명 0)`;
});

check('결정성 — 로그 재생 = 상태 재현', () => {
  const { scene, runtime } = runRaidSequence();
  const initial = buildBaseScene().state;
  const replayed = runtime.replay(initial);
  if (replayed.hash !== runtime.hash())
    throw new Error(`재생 해시 ${replayed.hash} != 현재 ${runtime.hash()}`);
  // 같은 사건 열을 새 런타임에 다시 넣어도 같은 해시
  const fresh = createC01Runtime({ state: buildBaseScene().state, ontology: scene.ontology, requirementGraph });
  for (const ev of runtime.log.list())
    fresh.commit({ type: ev.type, behavior: ev.behavior, strategy: ev.strategy, payload: ev.payload, tick: ev.tick, traceId: ev.traceId });
  if (fresh.hash() !== runtime.hash()) throw new Error('같은 사건 열이 다른 상태를 냈다');
  return `stateHash=${runtime.hash()} (재생·재실행 3경로 일치)`;
});

check('플레이어 가시 — 사건이 발자국·가축 실종·공고로 남는다', () => {
  const { runtime } = runRaidSequence();
  const seen = runtime.phenomena.list();
  const want = [
    ['herd-valley', 'trace'],        // 발자국·사냥 자국
    ['village-pasture', 'absence'],  // 가축 실종
    ['hunter-outpost', 'record'],    // 조합 공고
  ];
  for (const [place, sense] of want)
    if (!seen.some((p) => p.at === place && p.sense === sense))
      throw new Error(`${place} 에 ${sense} 자국이 없다`);
  // 모든 자국이 실제 사건에서 나왔다 — 자생 현상 금지
  const eventIds = new Set(runtime.log.list().map((e) => e.id));
  const orphan = seen.filter((p) => !eventIds.has(p.sourceEventId));
  if (orphan.length) throw new Error(`사건 없는 자국 ${orphan.length}건`);
  // 인과 추적 ID 가 자국까지 이어진다
  if (!seen.every((p) => p.traceId === 'tr-raid-01')) throw new Error('자국에 인과 추적 ID 가 끊겼다');
  // 자국의 서술은 그 행동을 부른 전략이 선언한 것이다 (전략 → 행동 → 자국)
  const catalog = buildPhenomenonCatalog(requirementGraph);
  for (const p of seen) {
    if (!p.strategy) throw new Error(`${p.behavior} 자국에 전략 근거가 없다`);
    const declared = catalog.byBehavior[p.behavior].effectByStrategy[p.strategy];
    if (p.description !== declared)
      throw new Error(`${p.behavior} 자국 서술이 ${p.strategy} 선언과 다르다: "${p.description}" != "${declared}"`);
  }
  return seen.map((p) => `${p.at}:${p.sense}(${p.description})`).join(' → ');
});

check('Lab 산출 (사건·현상·상태 설명)', () => {
  const dir = `${root}/apps/lab`;
  mkdirSync(dir, { recursive: true });
  const { runtime } = runRaidSequence();
  writeFileSync(`${dir}/sample-runtime-raid.json`, JSON.stringify(runtimeReport(runtime, 'ST-C01-01 무개입 습격'), null, 2) + '\n');
  writeFileSync(`${dir}/sample-phenomenon-catalog.json`,
    JSON.stringify({ label: '현상 카탈로그 (Q 성공 결과 기반)', entries: buildPhenomenonCatalog(requirementGraph).entries }, null, 2) + '\n');
  return 'apps/lab/sample-runtime-raid.json + sample-phenomenon-catalog.json';
});

for (const r of results) console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`);
const failed = results.filter((r) => !r.passed).length;
if (!failed) {
  const { runtime } = runRaidSequence();
  writeEvidence(`${root}/cycles/C01-border-canyon/evidence/C01-R-S01.json`, buildEvidence({
    step: 'C01-R-S01',
    status: 'STEP_VERIFIED_LOCAL',
    results: {
      phenomenonKinds: buildPhenomenonCatalog(requirementGraph).entries.length,
      outcomeCount: requirementGraph.outcomes.length,
      raidStateHash: runtime.hash(),
      eventCount: runtime.log.length,
      phenomenonCount: runtime.phenomena.length,
      explainedPaths: runtime.explainedPaths().length,
      checks: results,
    },
    artifacts: [
      'packages/runtime/src/worldRuntime.js',
      'packages/runtime/src/phenomena.js',
      'packages/runtime/src/c01Runtime.js',
    ],
    limitations: [
      '사건 로그·리플레이는 Foundation 의 EventLog 를 그대로 쓴다 (REUSE) — 스냅샷·재접속 복구는 N-S02',
      '산지 산출은 캐면 줄지만 아직 재생하지 않는다 — 군락 재생·개체군 번식은 C-S01 의 몫',
      '현상은 아직 아무도 지각하지 않는다 — 누가 무엇을 보는지는 R-S02(지각·믿음)의 몫',
      'legibility(읽기 난이도)는 설계값 — 추적 숙련에 따른 판정은 G1 에서 소비한다',
      '사건 열은 아직 손으로 넣는다 — 압력·계획에서 사건이 자동으로 나오는 것은 E-S01(Situation)·C-S01(복합 주체)',
      '리듀서는 C01 이 지금 쓰는 전이만 다룬다 — 개체군 번식·군락 훼손 같은 생태 전이는 C-S01 에서 확장',
    ],
  }));
  console.log('evidence → cycles/C01-border-canyon/evidence/C01-R-S01.json');
}
console.log(`\n점검 ${results.length}항 중 ${results.length - failed}항 통과`);
process.exit(failed ? 1 : 0);
