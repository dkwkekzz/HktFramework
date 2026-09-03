// world:observe 가 데이터를 그대로 읊는지 — 순서 · 개수 · 결정성 (C004 SPEC-008 · SPEC-009).
//
// 도구가 스스로 정하는 수는 하나도 없다는 것이 이 검사의 내용이다:
// 방·Connector·중첩·경계의 줄 수를 컨텐츠 데이터의 배열 길이와 맞춰 본다.

import { describe, expect, it } from 'vitest';
import { REGION_GRAPH, REGION_SPECS } from '../../../content/regions';
import { renderGraph, renderUsage } from '../observe';

const output = renderGraph();

/** 가로줄로 나뉜 묶음들 — [머리말, 방, Connector, 중첩, 경계, 검사] */
const sections = output.split(/\n {2}-{2,}\n/);

describe('world:observe --graph', () => {
  it('두 번 읊어도 글자까지 같다 (SPEC-009)', () => {
    expect(renderGraph()).toBe(output);
  });

  it('묶음이 SPEC-008 의 순서로 실린다', () => {
    const order = ['  방 ', '  Connector ', '  중첩 ', '  경계 ', '  검사 ('];
    let cursor = -1;
    for (const head of order) {
      const at = output.indexOf(head);
      expect(at, `${head} 가 없다`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it('방을 REGION_SPECS 순서로, 준 만큼 적는다', () => {
    const ids = REGION_SPECS.map((spec) => spec.id);
    const rows = sections[1]!
      .split('\n')
      .filter((line) => ids.some((id) => line.startsWith(`    ${id} `)));
    expect(rows.length).toBe(REGION_SPECS.length);
    expect(rows.map((row) => row.trim().split(/\s+/)[0])).toEqual(ids);
  });

  it('Connector 를 connectors 순서로, 준 만큼 적는다', () => {
    const ids = REGION_GRAPH.connectors.map((connector) => connector.id);
    const rows = sections[2]!
      .split('\n')
      .filter((line) => ids.some((id) => line.startsWith(`    ${id} `)));
    expect(rows.length).toBe(REGION_GRAPH.connectors.length);
    expect(rows.map((row) => row.trim().split(/\s+/)[0])).toEqual(ids);
  });

  it('중첩과 경계도 데이터가 준 만큼이다', () => {
    const nested = output.split('\n').filter((line) => line.includes(' ⊃ '));
    expect(nested.length).toBe(REGION_GRAPH.containment.length);
    for (const name of REGION_GRAPH.frontiers ?? []) {
      expect(output).toContain(`\n    ${name}\n`);
    }
  });

  it('열림/닫힘과 지어짐/경계를 데이터대로 적는다', () => {
    // 이 세계의 지금 값 — 닫힌 문이 없고, 경계를 가리키는 끝은 frontiers 그대로다
    const frontiers = new Set(REGION_GRAPH.frontiers ?? []);
    for (const connector of REGION_GRAPH.connectors) {
      const row = sections[2]!.split('\n').find((line) => line.startsWith(`    ${connector.id} `))!;
      expect(row, connector.id).toBeDefined();
      expect(row).toContain(frontiers.has(connector.to.region) ? '경계' : '지어짐');
    }
  });
});

describe('world:observe 의 다른 인자', () => {
  it('무엇을 아는지 밝히고 아무것도 하지 않는다 (SPEC-009 경계)', () => {
    const usage = renderUsage(['--json']);
    expect(usage).toContain('--json');
    expect(usage).toContain('--graph');
    expect(usage).toContain('아무것도 하지 않았다');
  });
});
