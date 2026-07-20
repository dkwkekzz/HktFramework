// 세계 구성(world-composition.yaml) — 배치의 기계 검증 (Design-WorldComposition §5·§8)
// 배치 원칙 ㉠(공급원 ≥ 2)·전 무대 배치·인접 대칭·속성 대역 정합을 회귀로 고정한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../src/paths.js';
import { loadLexicon } from '../src/substrate/lexicon.js';
import { loadGraph } from '../src/graph/loader.js';

const lex = loadLexicon();
const graph = loadGraph();
const comp = yaml.load(readFileSync(dataPath('world-composition.yaml'), 'utf8'));
const regions = comp.regions;
const byId = new Map(regions.map((r) => [r.id, r]));

test('① 모든 무대는 정확히 한 지역에 배치된다 (그래프 ↔ 배치 완전 일치)', () => {
  const placed = new Map(); // stageId → regionId
  for (const r of regions) {
    for (const sid of r.stages ?? []) {
      assert.ok(!placed.has(sid), `${sid} 가 ${placed.get(sid)} 와 ${r.id} 에 중복 배치`);
      placed.set(sid, r.id);
    }
  }
  for (const s of graph.stages) {
    assert.ok(placed.has(s.id), `그래프 무대 ${s.id} 가 어떤 지역에도 배치되지 않았다`);
  }
  for (const sid of placed.keys()) {
    assert.ok(graph.stagesById.has(sid), `배치된 무대 ${sid} 가 그래프에 없다`);
  }
});

test('② 지역 인접은 대칭이고, 이동 비용은 인접에만 있다', () => {
  for (const r of regions) {
    for (const adj of r.adjacent ?? []) {
      const other = byId.get(adj);
      assert.ok(other, `${r.id} 의 인접 ${adj} 가 존재하지 않는다`);
      assert.ok((other.adjacent ?? []).includes(r.id), `인접 비대칭: ${r.id}→${adj}`);
    }
    for (const target of Object.keys(r.move_cost ?? {})) {
      assert.ok((r.adjacent ?? []).includes(target), `${r.id}: 비인접 ${target} 에 이동 비용`);
    }
  }
});

test('③ 재료 아키타입의 속성은 사전에 있고, 수치01 대역은 0..1 에서 min≤max', () => {
  for (const r of regions) {
    for (const sub of r.substances ?? []) {
      for (const [name, band] of Object.entries(sub.props ?? {})) {
        assert.ok(lex.has(name), `${r.id}/${sub.archetype}: 미등재 속성 '${name}'`);
        assert.ok(Array.isArray(band) && band.length === 2, `${sub.archetype}.${name}: 대역은 [min,max]`);
        const [min, max] = band;
        assert.ok(min <= max, `${sub.archetype}.${name}: min(${min}) > max(${max})`);
        if (lex.valueType(name) === '수치01') {
          assert.ok(min >= 0 && max <= 1, `${sub.archetype}.${name}: 수치01 대역 이탈 [${min},${max}]`);
        }
      }
    }
  }
});

test('④ 배치 원칙 ㉠: 물질·생명체 demand 속성마다 공급 무대 ≥ 2 (예외는 사유 명시)', () => {
  // 그래프의 demand 에서 실물 재료(물질·생명체) 속성명을 모은다.
  const demanded = new Set();
  for (const g of graph.goals) {
    for (const d of g.demand ?? []) {
      if ((d.kind === '물질' || d.kind === '생명체') && d.property?.name) demanded.add(d.property.name);
    }
  }
  // 무대별 공급 속성으로 공급원 수를 센다.
  const supplyCount = new Map();
  for (const s of graph.stages) {
    for (const sup of s.supplies ?? []) {
      supplyCount.set(sup.property, (supplyCount.get(sup.property) ?? 0) + 1);
    }
  }
  const exceptions = new Map((comp.supply_exceptions ?? []).map((e) => [e.property, e]));
  for (const prop of demanded) {
    const n = supplyCount.get(prop) ?? 0;
    if (n >= 2) continue;
    const ex = exceptions.get(prop);
    assert.ok(ex, `공급 구멍: '${prop}' 공급 무대 ${n}개 — 2개 미만이면 supply_exceptions 에 사유를 명시할 것`);
    assert.equal(ex.sources, n, `'${prop}' 예외의 sources(${ex.sources})가 실제(${n})와 다르다 — 예외를 갱신할 것`);
    assert.ok(ex.reason, `'${prop}' 예외에 reason 이 없다`);
  }
  // 죽은 예외 방지: 예외로 등재된 속성이 실제로는 2개 이상 공급되면 예외를 지워야 한다.
  for (const [prop, ex] of exceptions) {
    const n = supplyCount.get(prop) ?? 0;
    assert.ok(n < 2, `'${prop}' 는 이미 공급 ${n}개 — supply_exceptions 에서 제거할 것 (${ex.reason})`);
  }
});

test('⑤ 주기: 이름 유일, period > window > 0', () => {
  const names = new Set();
  for (const c of comp.cycles ?? []) {
    assert.ok(!names.has(c.name), `주기 이름 중복: ${c.name}`);
    names.add(c.name);
    assert.ok(c.period > c.window && c.window > 0, `${c.name}: period(${c.period}) > window(${c.window}) > 0 위반`);
    for (const rid of c.affects ?? []) assert.ok(byId.has(rid), `${c.name}: 없는 지역 ${rid}`);
  }
  assert.ok(names.size >= 3, '상태형 재료를 만드는 주기가 3개 이상 있다');
});
