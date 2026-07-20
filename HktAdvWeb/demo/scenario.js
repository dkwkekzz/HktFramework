// =====================================================================
// 데모 시나리오 — Phase A 모듈을 실제로 굴려 눈 검증용 스냅샷을 만든다.
// ---------------------------------------------------------------------
// 자동 회귀(test/)와 같은 코드 경로를 쓴다 (불변 원칙 ⑤: 자동+눈 동일 근거).
// 서버(server.js)가 이 스냅샷을 /api/demo 로 방출하고 index.html 이 렌더한다.
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../src/paths.js';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { World } from '../src/substrate/substance.js';
import { Ledger } from '../src/substrate/ledger.js';
import { EventLog } from '../src/substrate/events.js';
import { defaultLawTable } from '../src/substrate/laws.js';
import { evalPred } from '../src/substrate/predicate.js';
import { loadGraph } from '../src/graph/loader.js';
import { runSlice, loadSliceFixture } from '../src/actors/bot.js';
import { BeliefView } from '../src/epistemic/belief.js';
import { evaluateHypothesis, applyVerdict } from '../src/epistemic/hypothesis.js';
import { findUnbound, discoverNode } from '../src/epistemic/retrobind.js';
import { Substance } from '../src/substrate/substance.js';
import { buildScene } from '../src/scene/viewmodel.js';
import { ripple } from '../src/graph/ripple.js';
import { scan } from '../src/planner/reinterpret.js';
import { backlogAgainstWorld } from '../src/planner/constraints.js';
import { decompose } from '../src/planner/decompose.js';
import { runMultiSim, loadMultiFixture } from '../src/actors/multibot.js';

export function buildDemo() {
  const lexicon = loadLexicon();
  const graph = yaml.load(readFileSync(dataPath('objective-graph.yaml'), 'utf8'));
  const constants = graph.constants;

  // ── 세계: 신이 지나간 자리의 조직 조각 (S-0045 원천) ──
  const world = new World(lexicon);
  world.add({
    id: '조직조각-A', archetype: '조직조각', kind: '물질', tags: ['신.조직'],
    properties: { 신성잔향보존율: 0.8, 오염도: 0.1 },
  });

  // ── 원장: 봇 계좌 개설 ──
  const ledger = new Ledger();
  ledger.open('bot-1', 20);

  const events = new EventLog();
  const laws = defaultLawTable(lexicon);
  const actor = { id: 'bot-1', inventory: [] };

  const source = world.get('조직조각-A');

  // ── 법칙 apply: 정밀 채취(고순도) → 거친 채취(저순도) → 관찰 ──
  laws.apply(actor, '채취', source, { 정밀도: 0.9, stage: 'S-0045' }, { ledger, events, world });
  laws.apply(actor, '채취', source, { 정밀도: 0.3, stage: 'S-0045' }, { ledger, events, world });
  laws.apply(actor, '관찰', source, { 주제: '신.에너지순환', stage: 'S-0045' }, { ledger, events });

  // ── 술어 평가: 말단 G-0.1.1.2.1 의 done_when 을 봇의 보유 재료에 대고 판정 ──
  const doneWhen = {
    has: { kind: '물질', property: { name: '신성잔향보존율', op: '>=', value: 'const.잔향보존_최소' }, min_count: 1 },
  };
  const ctx = { constants, lexicon, actor, ledger, events, state: { world: {}, stage: {} } };
  const doneEval = evalPred(doneWhen, ctx);

  // 술어 콘솔 예시 몇 가지 (연산자별 trace 관찰용).
  const examples = [
    { label: 'has 신성잔향보존율 ≥ 0.6 (말단 done_when)', pred: doneWhen, result: doneEval },
    {
      label: 'state world.신.영향력 ≤ 0.2 (미정의 경로 → 미충족)',
      pred: { state: { path: 'world.신.영향력', op: '<=', value: 'const.신영향_임계' } },
      result: evalPred({ state: { path: 'world.신.영향력', op: '<=', value: 'const.신영향_임계' } }, ctx),
    },
    {
      label: 'event 관찰 1회 이상 (A5 실체)',
      pred: { event: { verb: '관찰', min_count: 1 } },
      result: evalPred({ event: { verb: '관찰', min_count: 1 } }, ctx),
    },
    {
      label: 'epistemic 신.약점 확인 (C1 전 — 스텁)',
      pred: { epistemic: { tag: '신.약점', is: '확인', min_count: 1 } },
      result: evalPred({ epistemic: { tag: '신.약점', is: '확인', min_count: 1 } }, ctx),
    },
  ];

  // ── Phase B: 그래프 정합 인수 + 최소 수직 절편 실행 ──
  const g = loadGraph();
  const sliceSuccess = runSlice(g, loadSliceFixture(), { 소멸타이머: 3 });
  const sliceTimeout = runSlice(g, loadSliceFixture(), { 소멸타이머: 1 });

  // ── Phase C: 믿음 필터 · 가설 반증/확인 · 상향 발견 ──
  const epistemic = buildEpistemicDemo(g, lexicon);

  // ── Phase D: Scene 서술자 (방사형·별자리 뷰의 먹이) ──
  const scene = buildSceneDemo(g, lexicon);

  // ── Phase E: 재해석 스캐너 · 생성 제약 관문 · 규칙 플래너 ──
  const planner = buildPlannerDemo(g, lexicon);

  // ── Phase F: 봇 N기 관전 + aftermath 연쇄 (살아있는 세계) ──
  const multibot = buildMultiDemo(g, lexicon);

  return {
    lexicon: lexicon.names().map((n) => lexicon.get(n)),
    constants,
    substances: world.all().map((s) => ({ id: s.id, archetype: s.archetype, kind: s.kind, tags: s.tags, properties: s.properties })),
    inventory: actor.inventory.map((s) => ({ id: s.id, kind: s.kind, tags: s.tags, properties: s.properties })),
    ledger: ledger.snapshot(),
    events: events.all(),
    predicates: examples,
    graph: { stats: g.stats, warnings: g.warnings },
    slice: {
      success: { result: sliceSuccess.result, log: sliceSuccess.log, ripples: sliceSuccess.ripples, audit: sliceSuccess.audit },
      timeout: { result: sliceTimeout.result, log: sliceTimeout.log },
    },
    epistemic,
    scene,
    planner,
    multibot,
  };
}

// Phase F 시연: 봇 2기 경쟁 + aftermath 연쇄 → 관전용 Scene(익명 완료 링).
function buildMultiDemo(g, lexicon) {
  const sim = runMultiSim(g, loadMultiFixture());
  // 관전 Scene: 봇 B 시점(aftermath 로 새 목적을 얻은) 믿음 + 완료 파문/발견 연출.
  const belief = BeliefView.fromGraph(g, 'bot-B');
  if (sim.beliefs['bot-B']['G-0.1.4'] === '추정') belief.set('G-0.1.4', '추정');
  const predCtx = { constants: g.constants, lexicon, belief, actor: { id: 'bot-B', inventory: [] }, state: { world: {}, stage: {} } };
  const events = [...sim.ripples, { type: 'discover', id: 'G-0.1.4' }];
  const scene = buildScene({ graph: g, belief, events, predCtx });
  return {
    log: sim.log,
    results: sim.results,
    newGoals: sim.newGoals,
    audit: sim.audit,
    scene,
  };
}

// Phase E 시연: 재해석(스폰 금지) · 백로그 · 두 세계 분해 차이.
function buildPlannerDemo(g, lexicon) {
  const constants = g.constants;
  const log = [];

  // E1 — 재해석 스캐너 (스폰 금지: 세계에 있는 것만 후보)
  const empty = new World(lexicon);
  const demand = { kind: '물질', property: { name: '공명전달률', op: '>=', value: 'const.공명전달_최소' } };
  log.push(`E1 재해석: 빈 세계에서 공명전달 재료 스캔 → 후보 ${scan(demand, empty, { constants, lexicon }).length}건 (스폰 금지, 불변 원칙 ④)`);
  const world1 = new World(lexicon);
  world1.add({ id: '수정맥', archetype: '수정질 광맥', kind: '물질', properties: { 공명전달률: 0.85, 에너지손실률: 0.1 } });
  const cands = scan(demand, world1, { constants, lexicon });
  log.push(`   요소(수정맥) 추가 후 스캔 → 후보 ${cands.length}건: ${cands.map((c) => c.fromElement).join(',')} (이미 존재하는 것을 재해석)`);

  // E2 — 절편 세계 대비 백로그 (아직 무대 없는 노드)
  const sliceWorld = new World(lexicon);
  sliceWorld.add({ id: '조직조각-A', archetype: '조직조각', kind: '물질', tags: ['신.조직'], properties: { 신성잔향보존율: 0.8, 오염도: 0.1, 소멸타이머: 3 } });
  const ctx = { constants, lexicon, state: { world: {}, stage: { 'S-0045': { 잔여시간: 3 } } } };
  const { passed, backlog } = backlogAgainstWorld(g, sliceWorld, ctx);
  log.push(`E2 관문: 절편 세계에서 통과 ${passed.length} · 백로그(무대 미실존) ${backlog.length} → ${backlog.slice(0, 4).map((b) => b.id).join(', ')} …`);

  // E3 — 두 세계 분해 차이
  const parent = g.goalsById.get('G-0.1.1');
  const wA = new World(lexicon); wA.add({ id: '공명포', kind: '물질', properties: { 공명출력: 0.8 } });
  const wB = new World(lexicon); wB.add({ id: '독초', kind: '물질', properties: { 생체촉매활성: 0.7 } });
  const A = decompose(parent, wA, { constants, lexicon, obstacles: ['육체형'] });
  const B = decompose(parent, wB, { constants, lexicon, obstacles: ['신앙형'] });
  log.push(`E3 플래너: 같은 목적(${parent.title})을 두 세계에 분해 →`);
  log.push(`   육체형 신: "${A.admitted[0]?.title}"`);
  log.push(`   신앙형 신: "${B.admitted[0]?.title}"  (세계가 다르면 분해가 다르다, §5 원칙 2)`);

  return { log };
}

// Phase D 시연: 발견 상태 4값을 담은 방사형용 Scene + 4 연출을 담은 별자리용 Scene.
function buildSceneDemo(g, lexicon) {
  const belief = BeliefView.fromGraph(g, 'bot');
  belief.set('G-0.1.1.2.H2', '반증'); // 확인/추정/미발견 은 seed 에 이미 있음 → 4값 확보
  const predCtx = { constants: g.constants, lexicon, belief, actor: { id: 'bot', inventory: [] }, state: { world: {}, stage: {} } };
  const radial = buildScene({ graph: g, belief, focus: 'G-0.1.1.2', predCtx });

  // 네 연출: 절편 완료 파문 + 권속의 심장 2갈래 파문 + H2 붕괴 + C3 역결합
  const events = [
    ...ripple(g.goalsById.get('G-0.1.1.2.1'), g, predCtx),
    ...ripple(g.goalsById.get('G-0.2.3.2.1'), g, predCtx),
    { type: 'collapse', id: 'G-0.1.1.2.H2', collapsed: ['G-0.1.1.2.H2', 'G-0.1.1.2.H2.1'] },
    { type: 'retro-bind', node: 'G-0.1.1.3.2', links: [{ material: '수정편', property: '공명전달률' }] },
  ];
  const constellation = buildScene({ graph: g, belief, events, predCtx });
  return { radial, constellation };
}

// Phase C 시연: 믿음 필터 + 가설 반증/확인 + 상향 발견을 한 번에 굴린다.
function buildEpistemicDemo(g, lexicon) {
  const constants = g.constants;
  const log = [];

  // C1 — 봇 시점 그래프 통계 (미발견은 "?")
  const belief = BeliefView.fromGraph(g, 'bot');
  const view = belief.visibleGraph();
  const masked = view.filter((n) => n.masked).length;
  log.push(`C1 믿음 필터: 전역 ${view.length} 노드 중 봇에게 보이는 것 ${view.length - masked}, 미발견("?") ${masked}`);

  // C2 — 경합 가설: 진동(강) 확인 / 저온(약) 반증 → 가지 붕괴
  const 진실 = { 진동: 0.9, 저온: 0.1 };
  const experiments = [
    { stimulus: '진동', response: 진실['진동'] },
    { stimulus: '진동', response: 진실['진동'] },
    { stimulus: '저온', response: 진실['저온'] },
  ];
  const h1 = evaluateHypothesis({ id: 'G-0.1.1.2.H1', stimulus: '진동', threshold: 0.5 }, experiments, constants);
  const h2 = evaluateHypothesis({ id: 'G-0.1.1.2.H2', stimulus: '저온', threshold: 0.5 }, experiments, constants);
  applyVerdict(belief, g, { id: 'G-0.1.1.2.H1' }, h1);
  const collapseEvents = applyVerdict(belief, g, { id: 'G-0.1.1.2.H2' }, h2);
  log.push(`C2 가설 검증: H1(공명진동) → ${h1.verdict}, H2(저온) → ${h2.verdict}`);
  log.push(`   H2 붕괴 가지: ${collapseEvents[0]?.collapsed?.join(', ')}`);
  const g2Done = evalPred(g.goalsById.get('G-0.1.1.2').done_when, { constants, lexicon, belief }).value;
  log.push(`   → G-0.1.1.2(약점 발견) done_when: ${g2Done ? '충족' : '미충족'}`);

  // C3 — 상향 발견(역결합)
  const belief3 = BeliefView.fromGraph(g, 'bot');
  for (const id of ['G-0.1.1.3.2', 'G-0.1.1.3.4', 'G-0.1.1.2.H1.1']) belief3.set(id, '미발견');
  const actor = { id: 'bot', inventory: [new Substance({ id: '수정편', kind: '물질', properties: { 공명전달률: 0.8, 에너지손실률: 0.1 } }, lexicon)] };
  const unbound = findUnbound(actor, g, belief3).map((s) => s.id);
  const { events } = discoverNode(belief3, g, actor, 'G-0.1.1.3.2', { constants, lexicon, world: null, via: '탐색' });
  const retro = events.find((e) => e.type === 'retro-bind');
  log.push(`C3 상향 발견: 획득 시 용도 불명 [${unbound.join(',')}] → G-0.1.1.3.2 발견 시 역결합 ${retro ? retro.links.map((l) => l.property).join('+') : '없음'}`);

  return { log, hypotheses: { h1, h2 } };
}
