// A4 done_when — seed 그래프의 모든 done_when/demand 술어가 파싱·평가(스텁 포함) 가능하다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../src/paths.js';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { evalPred } from '../src/substrate/predicate.js';

const lex = loadLexicon();
const graph = yaml.load(readFileSync(dataPath('objective-graph.yaml'), 'utf8'));
const ctx = { constants: graph.constants, lexicon: lex, actor: { id: 'x', inventory: [] }, state: { world: {}, stage: {} } };

// demand 항목에서 평가 가능한 술어를 추출한다.
function demandPreds(demand) {
  const out = [];
  for (const d of demand ?? []) {
    if (d.when) out.push(d.when);
    if (d.property) out.push({ has: { kind: d.kind, property: d.property, min_count: 1 } });
  }
  return out;
}

test('seed 그래프의 모든 done_when 술어가 예외 없이 평가된다', () => {
  let n = 0;
  for (const g of graph.goals) {
    if (!g.done_when) continue;
    const r = evalPred(g.done_when, ctx);
    assert.equal(typeof r.value, 'boolean', `${g.id} done_when → boolean value`);
    assert.ok(r.trace, `${g.id} done_when → trace 존재`);
    n++;
  }
  assert.ok(n >= 25, `평가된 done_when 이 충분히 많다 (${n})`);
});

test('seed 그래프의 모든 demand 술어가 예외 없이 평가된다', () => {
  let n = 0;
  for (const g of graph.goals) {
    for (const p of demandPreds(g.demand)) {
      const r = evalPred(p, ctx);
      assert.equal(typeof r.value, 'boolean', `${g.id} demand → boolean value`);
      n++;
    }
  }
  assert.ok(n >= 10, `평가된 demand 술어가 충분히 많다 (${n})`);
});

test('Slice-1 말단(G-0.1.1.2.1) 의 done_when 이 has(신성잔향보존율≥const) 로 파싱된다', () => {
  const term = graph.goals.find((g) => g.id === 'G-0.1.1.2.1');
  assert.ok(term.done_when.has, 'done_when 이 has 형');
  const r = evalPred(term.done_when, ctx);
  // 인벤토리 비었으니 미충족이지만 예외 없이 판정되고 const 가 해석된다.
  assert.equal(r.value, false);
  assert.equal(r.trace.property.value, graph.constants['잔향보존_최소']);
});
