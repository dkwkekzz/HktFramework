// B1 — 그래프 스키마 + seed 로더/정합 검사기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import { loadGraph, validateGraph } from '../src/graph/loader.js';
import { loadLexicon } from '../src/substrate/lexicon.js';

const here = dirname(fileURLToPath(import.meta.url));
const lex = loadLexicon();
const base = yaml.load(readFileSync(join(here, 'fixtures/base-good.yaml'), 'utf8'));

// 기준 그래프를 클론해 한 곳만 오염시키는 헬퍼.
function mutate(fn) {
  const raw = structuredClone(base);
  fn(raw);
  return () => validateGraph(raw, lex);
}
const goal = (raw, id) => raw.goals.find((g) => g.id === id);

test('seed 그래프가 정합 검사를 통과하고 통계가 상식적이다', () => {
  const g = loadGraph();
  assert.equal(g.stats.roots.length, 1);
  assert.equal(g.stats.roots[0], 'G-0');
  assert.ok(g.stats.goals >= 30);
  assert.equal(g.warnings.length, 0, '죽은 무대 등 경고가 없다');
  // slice-1 커버리지가 명시된다
  assert.deepEqual(g.stats.sliceCoverage, { goals: 5, stages: 1 });
});

test('기준(base-good) 픽스처는 통과한다', () => {
  const g = validateGraph(structuredClone(base), lex);
  assert.equal(g.stats.goals, 2);
});

test('중복 id 거부', () => {
  assert.throws(mutate((r) => r.goals.push({ ...goal(r, 'G-0.1') })), /중복 id/);
});

test('없는 노드를 가리키는 serves 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').serves = ['G-9.9']; }), /serves 가 없는 노드/);
});

test('serves 사이클 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0').serves = ['G-0.1']; }), /사이클/);
});

test('뿌리에 닿지 못하는 노드 거부', () => {
  assert.throws(mutate((r) => {
    r.goals.push({
      id: 'G-9', title: '고아', desired: 'd', current: 'c',
      done_when: { state: { path: 'world.x', op: '>=', value: 0 } }, epistemic: '추정', serves: [],
    });
  }), /뿌리 'G-0' 에 닿지 못한다/);
});

test('파싱 불가 술어 거부 (미지 연산자)', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').done_when = { 없는연산자: 1 }; }), /술어 파싱 실패/);
});

test('demand 의 미등재 속성 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').demand[0].property.name = '없는속성'; }), /미등재 속성|술어 파싱 실패/);
});

test('supplies 의 미등재 속성 거부', () => {
  assert.throws(mutate((r) => { r.stages[0].supplies[0].property = '없는속성'; }), /사전에 없다/);
});

test('17 동사 밖의 verb 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').verb = '도둑질'; }), /알 수 없는 동사/);
});

test('없는 무대를 가리키는 stages 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').stages = ['S-9']; }), /stages 가 없는 무대/);
});

test('alternatives 안의 없는 id 참조 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').alternatives = ['대체 (G-9.9)']; }), /alternatives 가 없는 id/);
});

test('필수 필드 누락 거부', () => {
  assert.throws(mutate((r) => { delete goal(r, 'G-0.1').desired; }), /필수 필드 'desired'/);
});

test('알 수 없는 발견 상태 거부', () => {
  assert.throws(mutate((r) => { goal(r, 'G-0.1').epistemic = '몰라'; }), /알 수 없는 발견 상태/);
});

test('predicate_dsl 버전 불일치 거부', () => {
  assert.throws(mutate((r) => { r.meta.predicate_dsl = 'v9'; }), /버전 불일치/);
});

test('죽은 무대는 경고(오류 아님)', () => {
  const raw = structuredClone(base);
  // 어떤 demand 와도 무관한 속성만 공급하는 무대 추가
  raw.stages.push({ id: 'S-2', source: '죽은 원천', supplies: [{ property: '소멸타이머' }], discovered: false });
  const g = validateGraph(raw, lex); // throw 하지 않는다
  assert.ok(g.warnings.some((w) => /죽은 무대/.test(w)), '죽은 무대 경고가 실린다');
});
