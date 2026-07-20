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
  };
}
