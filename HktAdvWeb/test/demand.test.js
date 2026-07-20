// B2 — demand 판정 (속성 매칭)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';
import { World } from '../src/substrate/substance.js';
import { matchDemand, matchAllDemands } from '../src/graph/demand.js';

const lex = loadLexicon();
const graph = loadGraph();
const constants = graph.constants;

function worldWith(specs) {
  const w = new World(lex);
  for (const s of specs) w.add(s);
  return w;
}

test('다중 해법: 서로 다른 archetype 2종이 같은 속성 demand 를 충족한다 (원칙 ②)', () => {
  const world = worldWith([
    { id: '신의조직조각', archetype: '조직조각', kind: '물질', properties: { 신성잔향보존율: 0.7 } },
    { id: '권속의심장', archetype: '권속심장', kind: '물질', properties: { 신성잔향보존율: 0.65, 생체촉매활성: 0.6 } },
    { id: '평범한돌', archetype: '광물', kind: '물질', properties: { 신성잔향보존율: 0.1 } },
  ]);
  const demand = { kind: '물질', property: { name: '신성잔향보존율', op: '>=', value: 'const.잔향보존_최소' } };
  const r = matchDemand({ id: 'bot', inventory: [] }, demand, world, { constants, lexicon: lex });
  assert.equal(r.met, true);
  const archetypes = r.candidates.map((c) => c.archetype).sort();
  assert.deepEqual(archetypes, ['권속심장', '조직조각'], '품목이 아니라 속성이 판정 기준');
});

test('보유(인벤토리)도 후보가 된다', () => {
  const world = worldWith([]);
  const inv = [{ id: '손안의표본', kind: '물질', properties: { 신성잔향보존율: 0.8 } }];
  const demand = { kind: '물질', property: { name: '신성잔향보존율', op: '>=', value: 0.6 } };
  const r = matchDemand({ id: 'bot', inventory: inv.map((s) => ({ ...s })) }, demand, world, { lexicon: lex });
  assert.equal(r.met, true);
  assert.equal(r.candidates[0].source, '보유');
});

test('에너지·잔고 demand 는 원장을 읽는다', () => {
  const world = worldWith([]);
  const ledger = { has: () => true, balance: () => 12 };
  const demand = { kind: '에너지', property: { name: '잔고', op: '>=', value: 10 } };
  const r = matchDemand({ id: 'bot', inventory: [] }, demand, world, { lexicon: lex, ledger });
  assert.equal(r.met, true);
  assert.equal(r.trace.balance, 12);
});

test('상태형 시간 창: 창 안이면 충족, 창 밖이면 미충족 + 다음 도래 정보', () => {
  const world = worldWith([]);
  const demand = { kind: '환경 상태', when: { state: { path: 'stage.S-0045.잔여시간', op: '>', value: 0 } } };
  const inWindow = matchDemand({ id: 'bot', inventory: [] }, demand, world, { constants, lexicon: lex, state: { stage: { 'S-0045': { 잔여시간: 3 } } } });
  assert.equal(inWindow.met, true);
  const outWindow = matchDemand({ id: 'bot', inventory: [] }, demand, world, { constants, lexicon: lex, state: { stage: { 'S-0045': { 잔여시간: 0 } } } });
  assert.equal(outWindow.met, false);
  assert.match(outWindow.trace.nextInfo, /창 밖/);
});

test('Slice-1 말단(G-0.1.1.2.1) 의 demand 전 항목이 픽스처 세계에서 판정된다', () => {
  const term = graph.goalsById.get('G-0.1.1.2.1');
  const world = worldWith([
    { id: '조직조각-A', archetype: '조직조각', kind: '물질', properties: { 신성잔향보존율: 0.72, 오염도: 0.1 } },
  ]);
  const state = { world: {}, stage: { 'S-0045': { 잔여시간: 5 } } };
  const ok = matchAllDemands({ id: 'bot', inventory: [] }, term.demand, world, { constants, lexicon: lex, state });
  assert.equal(ok.met, true, '표본 존재 + 시간 창 안 → demand 전건 충족');

  // 시간이 다 되면(잔여시간 0) 상태형 재료가 무너져 demand 미충족
  const late = matchAllDemands({ id: 'bot', inventory: [] }, term.demand, world, { constants, lexicon: lex, state: { world: {}, stage: { 'S-0045': { 잔여시간: 0 } } } });
  assert.equal(late.met, false);
});
