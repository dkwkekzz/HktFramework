// A2 — 속성 물질 + 속성 사전
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLexicon, buildLexicon } from '../src/substrate/lexicon.js';
import { Substance, World, getProp, hasProp } from '../src/substrate/substance.js';

test('사전이 로드되고 필수 속성명이 존재한다', () => {
  const lex = loadLexicon();
  assert.ok(lex.has('신성잔향보존율'));
  assert.equal(lex.valueType('신성잔향보존율'), '수치01');
  assert.ok(lex.has('잔고'));
});

test('중복 속성명은 거부된다', () => {
  assert.throws(() => buildLexicon({
    properties: [
      { name: '오염도', 값형: '수치01' },
      { name: '오염도', 값형: '수치01' },
    ],
  }), /중복명/);
});

test('알 수 없는 값형은 거부된다', () => {
  assert.throws(() => buildLexicon({ properties: [{ name: 'x', 값형: '문자열' }] }), /값형/);
});

test('미등재 속성 조회는 예외 (오타 조기 차단)', () => {
  const lex = loadLexicon();
  const s = new Substance({ id: 's1', properties: { 오염도: 0.2 } }, lex);
  assert.throws(() => getProp(s, '오염도오타', lex), /미등재 속성/);
  // 등재 속성은 정상 조회
  assert.equal(getProp(s, '오염도', lex), 0.2);
});

test('생성 시 미등재 속성명을 가진 물질은 거부된다', () => {
  const lex = loadLexicon();
  assert.throws(() => new Substance({ id: 's', properties: { 없는속성: 1 } }, lex), /미등재 속성/);
});

test('hasProp 은 사전 기반으로 동작한다', () => {
  const lex = loadLexicon();
  const s = new Substance({ id: 's', properties: { 신성잔향보존율: 0.72 } }, lex);
  assert.equal(hasProp(s, '신성잔향보존율', '>=', 0.6, lex), true);
  assert.equal(hasProp(s, '신성잔향보존율', '>=', 0.8, lex), false);
  // 속성이 없는 개체는 미충족(예외 아님)
  const t = new Substance({ id: 't', properties: {} }, lex);
  assert.equal(hasProp(t, '신성잔향보존율', '>=', 0.6, lex), false);
});

test('속성 조건 스캔은 아키타입이 달라도 속성이 맞으면 찾는다 (다중 해법의 씨앗)', () => {
  const lex = loadLexicon();
  const world = new World(lex);
  world.add({ id: '조직조각', archetype: '조직조각', properties: { 신성잔향보존율: 0.7 } });
  world.add({ id: '권속심장', archetype: '권속심장', properties: { 신성잔향보존율: 0.65, 생체촉매활성: 0.6 } });
  world.add({ id: '돌멩이', archetype: '광물', properties: { 신성잔향보존율: 0.1 } });

  const found = world.scan('신성잔향보존율', '>=', 0.6);
  const ids = found.map((s) => s.id).sort();
  assert.deepEqual(ids, ['권속심장', '조직조각']); // 서로 다른 아키타입 2종이 같은 속성 요구를 충족
});

test('World 는 id·archetype 조회를 제공하고 중복 id 를 거부한다', () => {
  const lex = loadLexicon();
  const world = new World(lex);
  world.add({ id: 'a', archetype: '광물', properties: {} });
  assert.equal(world.get('a').id, 'a');
  assert.equal(world.byArchetype('광물').length, 1);
  assert.throws(() => world.add({ id: 'a', properties: {} }), /중복/);
});
