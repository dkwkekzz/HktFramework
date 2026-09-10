// 단위 — **기회의 기본형 유도**와 **op 이름표** (C036 W · spec SPEC-002 · SPEC-003 · SPEC-006).
//
// 시나리오(플레이가 실제로 그렇게 되는가)는 따로 있다. 여기서 재는 것은 셋뿐이다 —
//   ① 유도가 짓는 형이 spec 이 적은 그 형인가 (항목마다)
//   ② **덮어쓰기 경계** — 데이터가 같은 id 를 적으면 자리째 이기고, 새 id 는 뒤에 붙는가
//   ③ op 이름표의 모든 줄이 §4.2 의 (군, op) 짝 안인가
//
// 유도가 순수 함수(deriveOpportunities)로 따로 서 있기 때문에 ①②를 세계 없이 잰다.

import { describe, expect, it } from 'vitest';
import {
  MUTATION_OPS,
  type Opportunity,
} from '../../../engine/world-authoring/opportunity';
import {
  ALL_OPPORTUNITIES,
  LOCKS,
  LOCK_AT_CONNECTOR,
  REGION_SPECS,
  crossOpportunityId,
  deriveOpportunities,
  gatherOpportunityId,
  opportunitiesOf,
  opportunityForAction,
  sourceTakenTotalPath,
  type Lock,
  type ResourceSourceSpec,
} from '../../regions';
import { MUTATION_BINDINGS } from '../semantic/mutation';
import { sourcesInRegion } from '../semantic/resource';

const ROOM = 'A_ROOM';

/** 시험용 원천 한 줄 — 유도가 읽는 자리만 채운다 (나머지는 형이 요구하는 최소) */
function aSource(over: Partial<ResourceSourceSpec> = {}): ResourceSourceSpec {
  return {
    id: 'A_SOURCE',
    materialId: 'A_MATERIAL',
    worldCause: 'A_CAUSE',
    form: 'a-form',
    carrier: 'terrain',
    opportunity: 'baseline',
    supply: 'baseline-renewable',
    recoveryCause: 'a-cause',
    harvests: 1,
    recoverySeconds: 10,
    ...over,
  };
}

/** 시험용 Lock 하나 — 유도가 읽는 자리만 채운다 */
function aLock(over: Partial<Lock> = {}): Lock & { connectorId: string } {
  return {
    id: 'A_LOCK',
    at: { kind: 'connector', ref: 'A_DOOR' },
    strength: 'hard',
    requires: [{ time: { seasons: ['LONG_NIGHT'] } }],
    traces: [],
    connectorId: 'A_DOOR',
    ...over,
  } as Lock & { connectorId: string };
}

function derive(
  sources: readonly ResourceSourceSpec[],
  locks: readonly (Lock & { connectorId: string })[] = [],
  authored: readonly Opportunity[] = [],
): readonly Opportunity[] {
  return deriveOpportunities({ region: ROOM, sources, connectorLocks: locks, authored });
}

describe('SPEC-002 — 채집 기회의 기본형 유도', () => {
  it('U-001 원천 하나에 채집 기회 하나가 서고 항목 여덟이 spec 그대로다', () => {
    const [opportunity] = derive([aSource()]);
    expect(opportunity).toEqual({
      id: gatherOpportunityId('A_SOURCE'),
      region: ROOM,
      discovery: 'TRACE',
      target: { kind: 'source', ref: 'A_SOURCE' },
      possibleActions: ['gather'],
      progress: { kind: 'counter', ref: sourceTakenTotalPath('A_SOURCE') },
      outcomes: {
        world: [{ group: 'entity', op: 'CHANGE_STATE', ref: 'A_SOURCE' }],
        yield: ['Material'],
      },
    });
    // 아무 조건도 밝히지 않은 원천은 **availability 자리 자체가 없다** (늘 참을 지어내지 않는다)
    expect('availability' in opportunity!).toBe(false);
  });

  it('U-002 (Q3 의 답) 자리 역할이 발견을 정한다 — world-event 만 SIGNAL 이고 넷은 TRACE', () => {
    const roles: readonly ResourceSourceSpec['opportunity'][] = [
      'baseline',
      'by-product',
      'risk',
      'conditional',
      'world-event',
    ];
    const derived = derive(roles.map((role, index) => aSource({ id: `S${index}`, opportunity: role })));
    expect(derived.map((it) => it.discovery)).toEqual([
      'TRACE',
      'TRACE',
      'TRACE',
      'TRACE',
      'SIGNAL',
    ]);
  });

  it('U-003 때만 밝힌 원천의 availability 는 그 조건 하나 그대로다', () => {
    const [opportunity] = derive([aSource({ occurrence: { seasons: ['LONG_NIGHT'] } })]);
    expect(opportunity!.availability).toEqual({
      target: { kind: 'clock' },
      query: { kind: 'property', path: 'season' },
      operator: 'IN',
      value: ['LONG_NIGHT'],
    });
  });

  it('U-004 때와 원천이 밝힌 조건이 둘 다 있으면 all 로 묶인다 (차례 — 때가 먼저)', () => {
    const memory: Opportunity['availability'] = {
      target: { kind: 'history', ref: ROOM },
      query: { kind: 'history', path: 'passages.A_ROUTE' },
      operator: 'EXISTS',
    };
    const [opportunity] = derive([
      aSource({ dayPhases: ['NIGHT'], condition: memory }),
    ]);
    expect(opportunity!.availability).toEqual({
      all: [
        {
          target: { kind: 'clock' },
          query: { kind: 'property', path: 'dayPhase' },
          operator: 'IN',
          value: ['NIGHT'],
        },
        memory,
      ],
    });
  });

  it('U-005 원천이 없는 방은 채집 기회가 0 이다', () => {
    expect(derive([])).toEqual([]);
  });
});

describe('SPEC-003 — 건너기 기회의 기본형 유도', () => {
  it('U-006 Lock 이 걸린 문마다 건너기 기회 하나가 서고 문은 보인다(VISIBLE)', () => {
    const [opportunity] = derive([], [aLock()]);
    expect(opportunity).toEqual({
      id: crossOpportunityId('A_DOOR'),
      region: ROOM,
      availability: {
        target: { kind: 'clock' },
        query: { kind: 'property', path: 'season' },
        operator: 'IN',
        value: ['LONG_NIGHT'],
      },
      discovery: 'VISIBLE',
      target: { kind: 'connector', ref: 'A_DOOR' },
      possibleActions: ['cross'],
      progress: { kind: 'none' },
      outcomes: { world: [], yield: ['Access'] },
    });
  });

  it('U-007 아무것도 묻지 않는 Lock 은 availability 자리가 없다 (묻지 않는 것과 같다)', () => {
    const [opportunity] = derive([], [aLock({ requires: [] })]);
    expect('availability' in opportunity!).toBe(false);
  });

  it('U-008 차례는 채집이 먼저 · 건너기가 뒤다 (데이터 차례 그대로)', () => {
    const derived = derive([aSource({ id: 'S1' }), aSource({ id: 'S2' })], [aLock()]);
    expect(derived.map((it) => it.id)).toEqual([
      gatherOpportunityId('S1'),
      gatherOpportunityId('S2'),
      crossOpportunityId('A_DOOR'),
    ]);
  });
});

describe('SPEC-002 경계 — 데이터가 기본형을 덮는다', () => {
  const authored: Opportunity = {
    id: gatherOpportunityId('S1'),
    region: ROOM,
    discovery: 'HIDDEN',
    target: { kind: 'source', ref: 'S1' },
    possibleActions: ['observe'],
    progress: { kind: 'none' },
    outcomes: { world: [], yield: ['Discovery'] },
  };

  it('U-009 같은 id 는 데이터가 이기고 **그 자리 그대로** 선다', () => {
    const derived = derive([aSource({ id: 'S1' }), aSource({ id: 'S2' })], [], [authored]);
    expect(derived.map((it) => it.id)).toEqual([
      gatherOpportunityId('S1'),
      gatherOpportunityId('S2'),
    ]);
    expect(derived[0]).toEqual(authored);
  });

  it('U-010 새 id 는 유도된 것 뒤에 붙는다', () => {
    const extra: Opportunity = { ...authored, id: 'observe:S1' };
    const derived = derive([aSource({ id: 'S1' })], [], [extra]);
    expect(derived.map((it) => it.id)).toEqual([gatherOpportunityId('S1'), 'observe:S1']);
  });

  it('U-011 원천도 Lock 도 없는 방에 데이터만 있으면 그것이 전부다', () => {
    expect(derive([], [], [authored])).toEqual([authored]);
  });
});

describe('이 세계의 유도 — 저장되지 않고 언제나 같다', () => {
  it('U-012 방마다의 기회는 원천 수 + 그 방의 Connector Lock 수다', () => {
    for (const spec of REGION_SPECS) {
      const connectorLocks = (spec.access?.locks ?? []).filter(
        (lock) => lock.at.kind === LOCK_AT_CONNECTOR,
      );
      expect({
        region: spec.id,
        count: opportunitiesOf(spec.id).length,
      }).toEqual({
        region: spec.id,
        count: sourcesInRegion(spec.id).length + connectorLocks.length,
      });
    }
  });

  it('U-013 채집 기회의 차례와 대상은 sourcesInRegion 의 것 그대로다', () => {
    for (const spec of REGION_SPECS) {
      const gathers = opportunitiesOf(spec.id).filter((it) => it.target.kind === 'source');
      expect({ region: spec.id, refs: gathers.map((it) => it.target.ref) }).toEqual({
        region: spec.id,
        refs: sourcesInRegion(spec.id).map((source) => source.id),
      });
    }
  });

  it('U-014 (기본형 ③) Lock 이 걸리지 않은 문에는 건너기 기회가 서지 않는다', () => {
    const crossRefs = ALL_OPPORTUNITIES.filter((it) => it.target.kind === 'connector').map(
      (it) => it.target.ref,
    );
    const lockedDoors = LOCKS.filter((lock) => lock.at.kind === LOCK_AT_CONNECTOR).map(
      (lock) => lock.at.ref,
    );
    expect(crossRefs).toEqual(lockedDoors);
  });

  it('U-015 두 번 물어도 같은 목록이고 id 는 겹치지 않는다 (결정론)', () => {
    const again = REGION_SPECS.flatMap((spec) => opportunitiesOf(spec.id));
    expect(JSON.stringify(again)).toEqual(JSON.stringify(ALL_OPPORTUNITIES));
    expect(new Set(ALL_OPPORTUNITIES.map((it) => it.id)).size).toBe(ALL_OPPORTUNITIES.length);
  });

  it('U-016 투영이 쓰는 조회 — 그 대상의 그 동사만 찾아 준다', () => {
    const spec = REGION_SPECS.find((it) => sourcesInRegion(it.id).length > 0)!;
    const source = sourcesInRegion(spec.id)[0]!;
    expect(opportunityForAction(spec.id, 'gather', source.id)?.id).toBe(
      gatherOpportunityId(source.id),
    );
    // 동사가 다르면 없다 · 대상이 없으면 없다 · 탄생지는 원천이 아니라 없다
    expect(opportunityForAction(spec.id, 'cross', source.id)).toBeUndefined();
    expect(opportunityForAction(spec.id, 'gather', 'NO_SUCH_SOURCE')).toBeUndefined();
  });
});

describe('SPEC-006 — op 이름표', () => {
  it('U-017 모든 줄의 (군, op) 짝이 §4.2 의 표 안이다', () => {
    for (const binding of MUTATION_BINDINGS) {
      expect({
        group: binding.group,
        op: binding.op,
        listed: MUTATION_OPS.some(
          (pair) => pair.group === binding.group && pair.op === binding.op,
        ),
      }).toEqual({ group: binding.group, op: binding.op, listed: true });
    }
  });

  it('U-018 모든 줄이 규칙을 인용한다 — ruleId 도 what 도 비지 않는다', () => {
    for (const binding of MUTATION_BINDINGS) {
      expect({ id: binding.ruleId.startsWith('RULE-'), what: binding.what.length > 0 }).toEqual({
        id: true,
        what: true,
      });
    }
  });

  it('U-019 (C037 CHANGED) 여섯 군이 서 있고 자리만인 군(knowledge)은 서지 않는다', () => {
    // C036 은 다섯이었다 — 기회의 열림 · 닫힘 · 완료가 실제로 일어나는 이 Cycle 에
    // opportunity 군이 여섯째로 선다. knowledge 는 통째로 3층이라 여전히 자리만이다
    const groups = new Set(MUTATION_BINDINGS.map((it) => it.group));
    expect([...groups].sort()).toEqual(
      ['entity', 'opportunity', 'ownership', 'process', 'property', 'relation'].sort(),
    );
    expect(
      MUTATION_BINDINGS.filter((it) => it.group === 'opportunity').map((it) => it.op),
    ).toEqual(['OPEN', 'CLOSE', 'COMPLETE']);
  });

  it('U-020 기회의 outcomes 에 쓰인 op 도 전부 표 안이다', () => {
    for (const opportunity of ALL_OPPORTUNITIES) {
      for (const mutation of opportunity.outcomes.world) {
        expect(
          MUTATION_OPS.some(
            (pair) => pair.group === mutation.group && pair.op === mutation.op,
          ),
        ).toBe(true);
      }
    }
  });
});
