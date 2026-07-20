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
  };
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
