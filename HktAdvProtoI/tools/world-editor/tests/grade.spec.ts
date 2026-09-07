// T4 완료 조건 — brief 셋(가스 마을 · 유령 도시 · 마법도시)이 **A · B · C** 로 갈리고
// B/C 의 빠진 것이 정확히 적힌다 (Tool-Scale §3 T4 의 완료 조건 그대로).
//
// 셋 다 §2 표가 **등급의 예로 든 바로 그 방들**이다 — 세계 사실을 새로 지어내지 않으려고
// 문서가 이미 든 예를 그대로 썼고, 셋 다 세계에 들이지 않는다 (content/authoring/examples).
//
// 이 세계의 계약 목록(content/authoring/contracts)으로 잰다 — 시험이 어휘를 따로 지어 주지 않는다.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD_CONTRACTS } from '../../../content/authoring/contracts';
import { REGION_GRAPH, REGION_SPECS } from '../../../content/regions';
import { gradeFromFile, renderGrade } from '../author';

const DIR = fileURLToPath(new URL('../../../content/authoring/examples/', import.meta.url));
const at = (id: string) => join(DIR, `${id}.json`);

describe('T4 — 셋이 A · B · C 로 갈린다', () => {
  it.each([
    ['GAS_VILLAGE', 'A'],
    ['GHOST_CITY', 'B'],
    ['MAGIC_CITY', 'C'],
  ])('%s → 등급 %s', (id, expected) => {
    expect({ id, grade: gradeFromFile(at(id)).grade }).toEqual({ id, grade: expected });
  });

  it('가스 마을은 걸린 것이 하나도 없다 — 데이터만으로 선다', () => {
    const result = gradeFromFile(at('GAS_VILLAGE'));
    expect(result.blocking).toEqual([]);
    // 다만 여덟째(탄생)는 아직 답이 없다. 등급 A 의 방도 그것을 적어야 실제로 선다 (Life §3.5 F2)
    expect(result.pending.map((g) => g.required.split('가운데 ')[1])).toEqual(['birth']);
  });
});

describe('T4 — B · C 의 빠진 것이 정확히 적힌다', () => {
  it('유령 도시에 빠진 것은 **규칙 하나**다 — 유령의 행동(3층)까지 요구하지 않는다', () => {
    const result = gradeFromFile(at('GHOST_CITY'));
    expect(result.blocking.length).toBe(1);
    const [gap] = result.blocking;
    expect(gap!.required).toContain('죽은 생물이 자리에 기억을 남긴다');
    expect(gap!.missing).toBe('그 규칙이 아직 세계에 없다');
    expect(gap!.returnTo).toBe(WORLD_CONTRACTS.returnTo.rule);
    // 3층의 것은 요구가 아니라 미답으로 남아 있다 — 그래서 C 가 아니라 B 다
    expect(result.pending.map((g) => g.required.split('가운데 ')[1])).toContain('dwelling');
  });

  it('마법도시에 빠진 것은 **축 둘**이다 — 6층(능력)과 3층(주체)', () => {
    const result = gradeFromFile(at('MAGIC_CITY'));
    expect(result.blocking.length).toBe(2);
    for (const gap of result.blocking) {
      expect(gap.missing).toBe('그 층의 의미가 아직 서지 않았다');
      expect(gap.returnTo).toBe(WORLD_CONTRACTS.returnTo.axis);
    }
    expect(result.blocking.map((g) => g.required).join(' ')).toContain('6층');
    expect(result.blocking.map((g) => g.required).join(' ')).toContain('3층');
    // 축이 없으므로 여덟 답을 하나도 적지 못한다 — 그것이 C 의 모습이다
    expect(result.pending.length).toBe(8);
  });

  it('GAP 이 CLAUDE.md 의 네 줄로 적힌다', () => {
    const text = renderGrade(gradeFromFile(at('MAGIC_CITY')));
    for (const head of ['GAP', 'Required', 'Missing', 'Reason', 'Return To']) {
      expect(text).toContain(head);
    }
    expect(text).toContain('등급 C');
  });
});

describe('T4 — 계약 목록은 세계에서 읽는다 (손으로 옮기지 않는다)', () => {
  it('방 · 경계 · 이음의 종류가 지금 세계 그대로다', () => {
    expect(WORLD_CONTRACTS.regions).toEqual(REGION_SPECS.map((s) => s.id));
    expect(WORLD_CONTRACTS.frontiers).toEqual([...(REGION_GRAPH.frontiers ?? [])]);
    expect(WORLD_CONTRACTS.transitions).toEqual(
      [...new Set(REGION_GRAPH.connectors.map((c) => c.transition))].sort(),
    );
  });

  it('규칙 목록이 규칙을 품은 방의 수와 같다 — 방이 늘면 목록도 저절로 는다', () => {
    expect(WORLD_CONTRACTS.rules.length).toBe(REGION_SPECS.filter((s) => s.rule).length);
  });
});

describe('T4 — 세계에 들이지 않았다', () => {
  it('본보기 셋은 examples 에만 있고 방으로 서 있지 않다', () => {
    const ids = readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
    expect(ids.sort()).toEqual(['GAS_VILLAGE', 'GHOST_CITY', 'MAGIC_CITY']);
    for (const id of ids) expect(REGION_SPECS.map((s) => s.id)).not.toContain(id);
  });
});
