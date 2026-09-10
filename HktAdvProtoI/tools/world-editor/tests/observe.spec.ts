// world:observe 가 데이터를 그대로 읊는지 — 순서 · 개수 · 결정성 (C004 SPEC-008 · SPEC-009).
//
// 도구가 스스로 정하는 수는 하나도 없다는 것이 이 검사의 내용이다:
// 방·Connector·중첩·경계의 줄 수를 컨텐츠 데이터의 배열 길이와 맞춰 본다.

import { describe, expect, it } from 'vitest';
import { REGION_GRAPH, REGION_SPECS } from '../../../content/regions';
import { parseArgs, renderGraph, renderUsage, renderWorldReport } from '../observe';

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

  // C038 — 세계의 보고도 `--at <철>` 을 받는다. 방 하나의 보고가 이미 쓰는 그 인자 · 그 어휘다
  it('--report 와 --at 을 함께 받는다', () => {
    expect(parseArgs(['--report'])).toEqual({ kind: 'world' });
    expect(parseArgs(['--report', '--at', 'LONG_NIGHT'])).toEqual({
      kind: 'world',
      season: 'LONG_NIGHT',
    });
  });

  it('모르는 철은 조용히 지금으로 읽지 않는다 — 밝히고 멈춘다', () => {
    expect(parseArgs(['--report', '--at', 'NO_SUCH_SEASON']).kind).toBe('usage');
  });
});

// 세계의 보고에 조건 표가 선다 (C035 Observable Result 4). 총수는 재지 않는다 —
// 조건 자리는 데이터가 늘리는 것이고 이 검사는 표가 서는가와 기억 조건이 한 행으로 읽히는가만 본다.
describe('world:observe --report 의 조건 표', () => {
  const report = renderWorldReport();

  it('열쇠 × 자물쇠 표 곁에 조건 표의 머리가 선다', () => {
    // 머리는 줄머리에서 잰다 — 검사의 이름에도 '조건' 이 든다
    const keys = report.indexOf('\n  열쇠 × 자물쇠 ');
    const conditions = report.search(/\n {2}조건 \d+ \(조건 자리 순/);
    expect(keys).toBeGreaterThan(-1);
    expect(conditions).toBeGreaterThan(keys);
    expect(report).toContain('어디에');
    expect(report).toContain('qualifier');
  });

  it('기억을 읽는 조건(history)이 한 행으로 실린다 (SPEC-006)', () => {
    const rows = report.split('\n').filter((line) => line.startsWith('    source-memory:'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.includes('history'))).toBe(true);
  });

  it('두 번 읊어도 글자까지 같다', () => {
    expect(renderWorldReport()).toBe(report);
  });
});

// 「지금」 을 가진 두 표가 **묻는 때**의 값을 낸다 (C038 SPEC-007).
// 밝히지 않으면 갓 선 세계이고 글자가 전과 한 자도 다르지 않다 — 그것이 이 묶음의 회귀다.
describe('world:observe --report --at <철>', () => {
  const now = renderWorldReport();
  const night = renderWorldReport('LONG_NIGHT');

  it('밝히지 않으면 두 표 머리가 갓 선 세계라고 밝힌다 (회귀)', () => {
    expect(now).toContain('지금 은 갓 선 세계의 것)');
    // 조건 표와 기회 표 둘 다 — 한쪽만 밝히면 읽는 사람이 다른 표를 지금으로 읽는다
    expect(now.split('지금 은 갓 선 세계의 것)').length - 1).toBe(2);
    expect(now).not.toContain('철 LONG_NIGHT 의 것');
  });

  it('밝히면 두 표 머리가 그 철을 밝힌다', () => {
    expect(night.split('지금 은 철 LONG_NIGHT 의 것)').length - 1).toBe(2);
    expect(night).not.toContain('갓 선 세계');
  });

  it('조건 표와 기회 표가 **같은 세계**를 본다 — 둘 다 그 철의 값으로 달라진다', () => {
    // 조건 쪽 — 그 철을 묻는 잎들이 참이 된다
    const yes = (text: string) =>
      text.split('\n').filter((line) => line.trimEnd().endsWith('참')).length;
    expect(yes(night)).toBeGreaterThan(yes(now));
    // 기회 쪽 — 그 철·그 낮밤에만 서는 것이 열린다 ('열리지 않음' 은 '열림' 을 품지 않는다)
    const opens = (text: string) =>
      text.split('\n').filter((line) => line.includes('열림')).length;
    expect(opens(night)).toBeGreaterThan(opens(now));
  });

  it('데이터를 읽는 표들은 철에 달라지지 않는다 — 두 표 앞뒤가 글자까지 같다', () => {
    const head = (text: string) => text.slice(0, text.indexOf('\n  조건 '));
    const tail = (text: string) => text.slice(text.indexOf('\n  Yield '));
    expect(head(night)).toBe(head(now));
    expect(tail(night)).toBe(tail(now));
  });

  it('같은 철로 두 번 읊어도 글자까지 같다', () => {
    expect(renderWorldReport('LONG_NIGHT')).toBe(night);
  });
});
