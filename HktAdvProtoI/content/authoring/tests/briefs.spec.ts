// T2 완료 조건 — 지금 있는 방을 이 형으로 **손으로 역기술**해 전부 검증을 통과한다.
//
// "형이 현실을 담는가" 를 재는 시험이다. JSON 이 파싱된다는 것만으로는 아무것도 증명하지 못하므로,
// 형이 진 값 가운데 **세계가 이미 아는 것**은 전부 content/regions · content/view 와 맞춰 본다:
// id · 이름 · 깊이 · 부모 · 이웃(방 · 이음 · 방향 · 경계인가) · 귀함의 원천.
// 손으로 적다 틀리면 여기서 걸린다 — 그것이 이 시험이 있는 이유다.
//
// 맞춰 보지 않는 것은 **세계가 아직 모르는 것**이다. 그런 답은 지어내지 않고 미답으로 적혀 있고,
// 이 시험은 그 미답이 까닭을 달고 있는지만 본다.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  answerOf,
  isUnanswered,
  parseRegionBrief,
  unansweredKeys,
  type RegionBrief,
} from '../../../engine/world-authoring/brief';
import { REGION_GRAPH, REGION_SPECS } from '../../regions';
import { REGION_NAMES } from '../../view/region-presentation';

const DIR = fileURLToPath(new URL('../briefs/', import.meta.url));
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

/** 형을 통과한 brief 들 — 통과하지 못하면 그 자리가 첫 시험에서 걸린다 */
const briefs = new Map<string, RegionBrief>();
for (const file of FILES) {
  const result = parseRegionBrief(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
  if (result.ok) briefs.set(result.brief.id, result.brief);
}

/** 그 방에서 나가고 들어오는 끝 — (상대 방 · 이음 · 방향 · 경계인가) 의 다발 */
function graphNeighbours(regionId: string): string[] {
  const frontiers = new Set(REGION_GRAPH.frontiers ?? []);
  const out: string[] = [];
  for (const c of REGION_GRAPH.connectors) {
    const other =
      c.from.region === regionId ? c.to.region : c.to.region === regionId ? c.from.region : undefined;
    if (other === undefined) continue;
    out.push(`${other}|${c.transition}|${c.direction}|${frontiers.has(other)}`);
  }
  return out.sort();
}

describe('T2 — 방마다 brief 하나가 형을 통과한다', () => {
  it('지금 있는 방이 하나도 빠지지 않았고, 없는 방을 적지도 않았다', () => {
    expect([...briefs.keys()].sort()).toEqual(REGION_SPECS.map((s) => s.id).sort());
  });

  it.each(FILES)('%s 가 형을 통과한다', (file) => {
    const result = parseRegionBrief(JSON.parse(readFileSync(join(DIR, file), 'utf8')));
    expect(result.ok ? [] : result.problems).toEqual([]);
    // 파일 이름이 곧 방 이름이다 — 도구가 파일을 골라 읽을 수 있어야 한다
    if (result.ok) expect(`${result.brief.id}.json`).toBe(file);
  });
});

describe('T2 — 형이 진 값이 세계가 아는 것과 같다', () => {
  it.each(REGION_SPECS.map((s) => s.id))('%s — 이름 · 깊이 · 부모', (id) => {
    const brief = briefs.get(id)!;
    const spec = REGION_SPECS.find((s) => s.id === id)!;
    const parent = REGION_GRAPH.containment.find((c) => c.child === id)?.parent;
    expect({ name: brief.name, depth: brief.depth, parent: brief.parent }).toEqual({
      name: REGION_NAMES[id],
      depth: spec.depth,
      parent,
    });
  });

  it.each(REGION_SPECS.map((s) => s.id))('%s — 이웃이 Connector 그대로다', (id) => {
    const brief = briefs.get(id)!;
    const written = brief.neighbours
      .map((n) => `${n.region}|${n.transition}|${n.direction}|${n.frontier}`)
      .sort();
    expect(written).toEqual(graphNeighbours(id));
  });

  it.each(REGION_SPECS.map((s) => s.id))('%s — 귀함의 원천이 그 방이 낳는 것 그대로다', (id) => {
    const brief = briefs.get(id)!;
    const spec = REGION_SPECS.find((s) => s.id === id)!;
    const written = brief.answers.worth.sources
      .map((s) => `${s.id}|${s.material}|${s.heldBy}|${s.form}|${s.role}`)
      .sort();
    const world = (spec.resourceEcology?.sources ?? [])
      .map((s) => `${s.id}|${s.materialId}|${s.carrier}|${s.form}|${s.opportunity}`)
      .sort();
    expect(written).toEqual(world);
  });

  it('규칙을 품은 방만 규칙을 요구한다 — 나머지는 데이터만으로 선다 (등급 A)', () => {
    const demanding = [...briefs.values()]
      .filter((b) => b.requires.some((r) => r.kind === 'rule'))
      .map((b) => b.id)
      .sort();
    expect(demanding).toEqual(REGION_SPECS.filter((s) => s.rule).map((s) => s.id).sort());
  });
});

describe('T2 — 모르는 것은 미답으로 남아 있다 (지어내지 않는다)', () => {
  it('미답에는 저마다 까닭이 달려 있다', () => {
    for (const brief of briefs.values()) {
      for (const key of unansweredKeys(brief)) {
        const answer = answerOf(brief, key);
        // 까닭이 한 마디라도 서 있어야 한다 — 빈 자리와 "아직 모른다" 는 다른 것이다
        expect({ id: brief.id, key, why: isUnanswered(answer) ? answer.unanswered.trim() : '' })
          .toMatchObject({ id: brief.id, key, why: expect.stringMatching(/.{10,}/) });
      }
    }
  });

  it('여덟째(탄생)는 아직 어느 방도 답하지 못한다 — 생명 계약이 서지 않았기 때문이다', () => {
    // 이 줄이 뒤집히는 날이 RoomBearsLife(C022~C025) 가 닫히는 날이다
    const answered = [...briefs.values()].filter((b) => !isUnanswered(b.answers.birth.said));
    expect(answered.map((b) => b.id)).toEqual([]);
  });

  it('재료를 낳는 방은 귀함을 반드시 답했다 — 낳는 것을 모른다고 적을 수는 없다', () => {
    for (const spec of REGION_SPECS) {
      if ((spec.resourceEcology?.sources ?? []).length === 0) continue;
      const brief = briefs.get(spec.id)!;
      expect({ id: spec.id, answered: !isUnanswered(brief.answers.worth.said) }).toEqual({
        id: spec.id,
        answered: true,
      });
    }
  });

  it('낳지 않는 것이 **결정된** 방은 그 없음까지 답했다 — 미답과 다르다', () => {
    // 백왕령이 재료를 낳지 않는 것은 아직 안 정한 것이 아니라 정해진 것이다
    // (Play RoomBearsMaterial 확정 5 — 백왕령이 안전한 이유와 같은 조건).
    // 형은 그 둘을 구별할 수 있어야 한다: 없음을 답한 방과 아직 모르는 방
    const domain = briefs.get('WHITE_KING_DOMAIN')!;
    expect(domain.answers.worth.sources).toEqual([]);
    expect(isUnanswered(domain.answers.worth.said)).toBe(false);

    const silent = briefs.get('PREDATOR_NEST')!;
    expect(silent.answers.worth.sources).toEqual([]);
    expect(isUnanswered(silent.answers.worth.said)).toBe(true);
  });
});
