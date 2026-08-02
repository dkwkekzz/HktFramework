// D3-a 개인화 — 뿌리는 개체의 Need 로 다시 읽히고, 노드와 사슬은 그대로다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { graphHash } from '../../src/d1/index.ts';
import { specimenOf } from '../../src/d2/index.ts';
import {
  bodyIdOf,
  checkPersonalBase,
  graphBirthOf,
  needForRoot,
  personalizeRoots,
  retuneSummary,
  type PersonalViolation,
} from '../../src/d3/index.ts';
import { buildSpeciesGraph } from '../../src/d2/index.ts';

import { baseGraphOf, beast, beastBlueprint, bodyId, plain, timid } from './fixture.ts';

describe('D3-a 개인화', () => {
  test('개체의 자리는 개체의 ID 와 그 몸이다', () => {
    assert.equal(bodyIdOf(plain), bodyId);
    assert.deepEqual(graphBirthOf(plain, '성체'), {
      subjectId: plain.id,
      bodyId,
      stage: '성체',
    });
  });

  test('성격이 흔든 급함이 뿌리 간선에 그대로 실린다', () => {
    const base = baseGraphOf(timid);
    const { graph, retunes } = personalizeRoots(base, timid);
    const hungerEdge = graph.edges.find(
      (edge) => graph.nodes.find((node) => node.id === edge.from)?.label === '주린 몸',
    );

    assert.equal(hungerEdge?.urgency, 1); // 종은 0.8 이라고 했다
    assert.equal(hungerEdge?.failureDelayTicks, 20); // 종은 30 이라고 했다
    assert.equal(retunes.length, 1);
    assert.equal(retunes[0]?.moved, true);
    assert.deepEqual(retunes[0]?.urgency, [0.8, 1]);
    assert.match(retuneSummary(retunes[0] as never), /급함 0\.8 → 1/);
  });

  test('흔들 것이 없으면 종이 말한 그대로다', () => {
    const base = baseGraphOf(plain);
    const { graph, retunes } = personalizeRoots(base, plain);
    assert.equal(graphHash(graph), graphHash(base));
    assert.equal(retunes[0]?.moved, false);
    assert.match(retuneSummary(retunes[0] as never), /종이 말한 그대로/);
  });

  test('노드와 사슬은 하나도 변하지 않는다 — 흔들리는 것은 뿌리의 수치뿐이다', () => {
    const base = baseGraphOf(timid);
    const { graph } = personalizeRoots(base, timid);
    assert.deepEqual(
      graph.nodes.map((node) => node.id),
      base.nodes.map((node) => node.id),
    );
    assert.deepEqual(
      graph.edges.map((edge) => edge.id),
      base.edges.map((edge) => edge.id),
    );
  });

  test('대 잇는 뿌리는 개체의 무너짐이 아니므로 다시 읽지 않는다', () => {
    const base = baseGraphOf(plain);
    const lineageRoot = base.nodes.find((node) => node.label === '대 이을 몸');
    assert.notEqual(lineageRoot, undefined);
    assert.equal(needForRoot(lineageRoot as never, plain), null);

    const out: PersonalViolation[] = [];
    checkPersonalBase(base, plain, out);
    assert.deepEqual(out, []); // 그래도 막히지 않는다
  });

  test('다른 주체의 그래프는 이 개체의 것이 될 수 없다', () => {
    const out: PersonalViolation[] = [];
    checkPersonalBase(
      buildSpeciesGraph(beast, beastBlueprint, specimenOf(beast)),
      plain,
      out,
    );
    assert.equal(out[0]?.rule, 'foreign-base');
  });

  test('뿌리 중 개체가 무너지는 자리가 하나도 없으면 막힌다', () => {
    const base = baseGraphOf(plain);
    const out: PersonalViolation[] = [];
    checkPersonalBase(base, { ...plain, needs: [] }, out);
    assert.equal(out[0]?.rule, 'unrooted-instance');
    assert.match(out[0]?.message ?? '', /하나도 없다/);
  });
});
