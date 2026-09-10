// T2 — RegionBrief 형이 무엇을 받고 무엇을 물리치는가 (engine/world-authoring/brief.ts).
//
// 이 파일은 **게임을 모른다** — 방 이름도 재료도 여기서 지어 준다. 형이 일반명뿐이라
// 기반에 설 수 있다는 것이 그 자체로 이 시험의 내용이다.
//
// 형이 물리쳐야 하는 것 셋: 빈 답 · 까닭 없는 미답 · 형에 없는 필드.
// 셋 다 같은 규율에서 나온다 — **답하지 않은 것을 답한 것처럼 적으면 형이 거짓말을 한다** (T1 의 absent).
//
// T2 확장 CHANGED — 답이 **열**이다. 물음(asking)이 탄생과 내밂 사이에 서고, 원문 번호의
// ⑨~⑫ 넷이 그 한 자리에 모여 산다 (⑩ 만은 귀함이 낳는 것의 성질이라 worth 에 얹힌다).

import { describe, expect, it } from 'vitest';
import {
  ANSWER_ORDER,
  isUnanswered,
  parseRegionBrief,
  unansweredKeys,
  type RegionBrief,
} from '../brief';

/** 열 답이 다 서 있는 가장 작은 brief */
function sound(): unknown {
  return {
    id: 'A_ROOM',
    name: '어떤 방',
    depth: 'near',
    answers: {
      distinction: '여기는 이런 곳이다',
      cause: '이래서 이렇게 되었다',
      dwelling: '이런 것이 산다',
      danger: '이것이 위험하다',
      worth: {
        said: '이것이 귀하다',
        sources: [
          {
            id: 'S',
            material: 'M',
            heldBy: '땅',
            worldCause: '이것이 낳는다',
            recoveryCause: '이것이 되돌린다',
            form: '드러난 것',
            role: 'baseline',
          },
        ],
      },
      discovery: '이것을 알게 된다',
      opening: '이것이 열린다',
      birth: {
        said: '이것이 태어난다',
        // 탄생 하나가 서려면 이름과 재료만으로는 모자란다 — 어떻게 맺히고 · 무엇이 낳았고 ·
        // 어느 규칙이 일으키고 · 무엇의 값을 올리는가까지 함께 있어야 한다 (T3 CHANGED)
        born: [
          {
            id: 'L',
            mode: 'ONE_WAY',
            worldCause: '이것이 낳는다',
            form: '난 것',
            regionRule: 'RULE_ONE',
            from: { materials: ['M'] },
            population: 'P',
            ecologicalRole: '이 자리를 맡는다',
          },
        ],
        populations: [{ id: 'P', scale: 2, declineCause: '이것이 값을 내린다' }],
      },
      // 묻지 않는 방이 가장 작은 꼴이다 — 빈 목록에 said 가 그 까닭을 진다 (born 과 같은 어법)
      asking: {
        said: '여기는 아무것도 묻지 않는다 — 지나는 데 걸리는 것이 없다',
        locks: [],
      },
      offering: '이것을 내밀고 이것을 기억한다',
    },
  };
}

/** 물음 하나가 다 선 꼴 — 어디에 걸리고 · 무엇을 묻고 · 무엇으로 알아내는가 */
function lockValue(): Record<string, unknown> {
  return {
    id: 'A_DOOR',
    at: { kind: 'connector', ref: 'A_ROOM_B_ROOM' },
    strength: 'hard',
    important: true,
    requires: [
      { property: 'axis:relation' },
      { seasons: ['SOME_SEASON'] },
      { state: { region: 'A_ROOM', patterns: ['SOME_PATTERN'] } },
      { knowledge: '이것을 안다' },
    ],
    traces: ['첫째 흔적', '둘째 흔적'],
    reason: '무엇이 일어난다',
  };
}

const parsed = (over: (b: Record<string, unknown>) => void = () => {}) => {
  const value = sound() as Record<string, unknown>;
  over(value);
  return parseRegionBrief(value);
};

describe('RegionBrief — 형이 받는 것', () => {
  it('열 답이 선 brief 를 받고, 적지 않은 목록은 빈 목록이 된다', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.kinds).toEqual([]);
    expect(result.brief.neighbours).toEqual([]);
    expect(result.brief.requires).toEqual([]);
    expect(result.brief.parent).toBeUndefined();
    // 태어나는 것의 세 목록도 적지 않으면 빈 목록이다 — 없는 것을 undefined 로 남기지 않는다.
    // 무엇으로 맺히는가도 마찬가지다: 재료만 적으면 상태 쪽이 빈 목록으로 선다
    expect(result.brief.answers.birth.born[0]).toEqual({
      id: 'L',
      mode: 'ONE_WAY',
      worldCause: '이것이 낳는다',
      form: '난 것',
      regionRule: 'RULE_ONE',
      from: { materials: ['M'], states: [] },
      consumes: [],
      leaves: [],
      calls: [],
      population: 'P',
      ecologicalRole: '이 자리를 맡는다',
    });
  });

  it('열 답의 순서가 형에 한 번만 적혀 있다 — 원문 번호 차례로 (… 탄생 · 물음 · 내밂)', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.brief.answers)).toEqual([...ANSWER_ORDER]);
  });

  it('탄생과 개체군을 따로 답한다 — 나는 것 없이 드는 것만 있는 방이 있기 때문이다', () => {
    const result = parsed((b) => {
      const a = b.answers as Record<string, unknown>;
      a.birth = {
        said: '여기서 나는 것은 없고 드는 것만 있다',
        born: [],
        populations: [{ id: 'P', scale: 1, declineCause: '이것이 값을 내린다' }],
      };
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 태어나는 것이 없어도 사는 것은 있다 — 둘을 한 목록으로 묶으면 이 방을 적을 수 없다
    expect(result.brief.answers.birth.born).toEqual([]);
    expect(result.brief.answers.birth.populations).toEqual([
      { id: 'P', scale: 1, declineCause: '이것이 값을 내린다' },
    ]);
  });

  it('떼의 의미는 밝히지 않아도 받는다 — 밝히지 않은 개체군은 자락이 서지 않는다 (그 일은 T3 이 한다)', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.answers.birth.populations[0]!.presence).toBeUndefined();
    const said = parsed((b) => {
      const a = b.answers as Record<string, any>;
      a.birth.populations = [{ id: 'P', scale: 1, declineCause: '내린다', presence: '여기 무엇이 돈다' }];
    });
    expect(said.ok).toBe(true);
    if (!said.ok) return;
    expect(said.brief.answers.birth.populations[0]!.presence).toBe('여기 무엇이 돈다');
  });

  it('답 자리에 미답을 적을 수 있다 — 까닭과 함께', () => {
    const result = parsed((b) => {
      (b.answers as Record<string, unknown>).danger = { unanswered: '위험이 아직 놓이지 않았다' };
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isUnanswered(result.brief.answers.danger)).toBe(true);
  });
});

describe('RegionBrief — 형이 물리치는 것', () => {
  it('빈 답을 물리친다 — 걸린 자리를 점 경로로 돌려준다', () => {
    const result = parsed((b) => {
      (b.answers as Record<string, unknown>).cause = '   ';
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.path)).toContain('answers.cause');
  });

  it('까닭 없는 미답을 물리친다 — 비워 두는 것과 지어내는 것 사이에 침묵을 두지 않는다', () => {
    const result = parsed((b) => {
      (b.answers as Record<string, unknown>).dwelling = { unanswered: '' };
    });
    expect(result.ok).toBe(false);
  });

  it('앞의 여덟 중 하나가 없으면 물리친다 — 탄생도 마찬가지다 (Life §3.5)', () => {
    // 내밂은 기본값을 가지므로 빠진다 (아래 시험이 그것을 잰다). **물음도 여기서 판정하지
    // 않는다** — 형 선언이 그 자리에 기본값이 서는지 말하지 않았고, 말하지 않은 것을
    // 시험이 정하면 시험이 선언을 앞지른다. 물음이 답하지 않은 채로 남는 자리는 아래
    // '물음도 미답일 수 있다' 가 **적힌 미답**으로 잰다
    for (const key of ANSWER_ORDER.filter((k) => k !== 'offering' && k !== 'asking')) {
      const result = parsed((b) => {
        delete (b.answers as Record<string, unknown>)[key];
      });
      expect({ key, ok: result.ok }).toEqual({ key, ok: false });
    }
  });

  it('열째(내밂)만은 없어도 받는다 — 대신 **미답으로 센다** (T2 규율 · 옛 brief 가 그대로 선다)', () => {
    const result = parsed((b) => {
      delete (b.answers as Record<string, unknown>).offering;
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 통과시키는 것이 아니라 비어 있음을 남기는 것이다 — T4 의 pending 이 이것을 읊는다
    expect(isUnanswered(result.brief.answers.offering)).toBe(true);
    expect(unansweredKeys(result.brief)).toEqual(['offering']);
  });

  it('탄생 하나에서 한 자리라도 빠지면 물리친다 — 이름과 재료만으로는 탄생지가 서지 못한다', () => {
    const born = ['id', 'mode', 'worldCause', 'form', 'regionRule', 'from', 'population', 'ecologicalRole'];
    for (const key of born) {
      const result = parsed((b) => {
        const a = b.answers as Record<string, any>;
        delete a.birth.born[0][key];
      });
      expect({ key, ok: result.ok }).toEqual({ key, ok: false });
    }
  });

  it('개체군의 수는 **양의 정수**다 — 0 마리가 사는 개체군도 반 마리도 세계에 없다', () => {
    for (const scale of [0, -1, 1.5]) {
      const result = parsed((b) => {
        const a = b.answers as Record<string, any>;
        a.birth.populations = [{ id: 'P', scale, declineCause: '내린다' }];
      });
      expect({ scale, ok: result.ok }).toEqual({ scale, ok: false });
    }
  });

  it('탄생 안의 형에 없는 필드도 물리친다 — 걸린 자리를 탄생지까지 짚어 준다', () => {
    const result = parsed((b) => {
      const a = b.answers as Record<string, any>;
      a.birth.born[0].colour = '붉다';
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.path)).toContain('answers.birth.born.0.colour');
  });

  it('형에 없는 필드를 물리친다 — 형 밖의 뜻이 몰래 실리지 않는다', () => {
    const result = parsed((b) => {
      b.mood = '어둡다';
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.path)).toContain('mood');
  });

  it('어휘는 형이 쥐지 않는다 — 모르는 맡은 자리도 형은 받는다 (거르는 것은 T4 다)', () => {
    // 형이 어휘를 박으면 기반이 게임 명사를 쥐고, 같은 목록이 두 자리에 있게 된다.
    // 어느 이름이 성립하는지는 세계의 계약 목록이 알고 등급 판정기가 대조한다
    const result = parsed((b) => {
      const a = b.answers as Record<string, unknown>;
      a.worth = {
        said: '이것이 귀하다',
        sources: [
          {
            id: 'S',
            material: 'M',
            heldBy: '구름',
            worldCause: '아무도 안 쓰는 과정',
            recoveryCause: '아무도 안 쓰는 원인',
            form: '덩이',
            role: '아무도 안 쓰는 자리',
          },
        ],
      };
    });
    expect(result.ok).toBe(true);
  });

  it('이웃의 방향은 둘 중 하나다', () => {
    const result = parsed((b) => {
      b.neighbours = [{ region: 'B_ROOM', transition: 'door', direction: 'sideways' }];
    });
    expect(result.ok).toBe(false);
  });

  it('요구의 갈래는 여덟 중 하나이고 까닭이 있어야 한다', () => {
    expect(
      parsed((b) => {
        b.requires = [{ kind: 'mood', what: 'x', why: 'y' }];
      }).ok,
    ).toBe(false);
    expect(
      parsed((b) => {
        b.requires = [{ kind: 'rule', what: 'x', why: '' }];
      }).ok,
    ).toBe(false);
    expect(
      parsed((b) => {
        b.requires = [{ kind: 'rule', what: 'x', why: 'y' }];
      }).ok,
    ).toBe(true);
  });
});

describe('unansweredKeys — 무엇을 아직 모르는가를 셀 수 있다', () => {
  it('미답만 형에 적힌 순서로 돌려준다', () => {
    const result = parsed((b) => {
      const a = b.answers as Record<string, unknown>;
      a.birth = { said: { unanswered: '생명 계약이 아직 없다' }, born: [] };
      a.cause = { unanswered: '까닭이 적히지 않았다' };
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(unansweredKeys(result.brief)).toEqual(['cause', 'birth']);
  });

  it('다 답한 brief 는 빈 목록이다', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(unansweredKeys(result.brief as RegionBrief)).toEqual([]);
  });
});

// ── 물음 ⑨~⑫ (T2 확장 ADDED) ──────────────────────────────────────────────
//
// 여기서도 **게임을 모른다** — 자리의 갈래도 세기도 성질 태그도 지어낸 글자다. 어느 이름이
// 성립하는지는 이 세계의 계약 목록이 알고 T4 가 대조한다 (원천의 role 이 세운 그 규율 그대로).

describe('RegionBrief — 이 방은 무엇을 묻는가 (⑨~⑫)', () => {
  const asked = (over: (lock: Record<string, unknown>) => void = () => {}) =>
    parsed((b) => {
      const lock = lockValue();
      over(lock);
      (b.answers as Record<string, any>).asking = { said: '이 방은 이것을 묻는다', locks: [lock] };
    });

  it('물음 하나가 다 선다 — 어디에 걸리고 · 얼마나 세게 · 무엇을 묻고 · 무엇으로 알아내는가', () => {
    const result = asked();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lock = result.brief.answers.asking.locks[0]!;
    // 걸리는 자리는 **갈래도 값이다** — 문인지 자락인지를 형에 박으면 기반이 게임을 쥔다
    expect({ id: lock.id, at: lock.at, strength: lock.strength, important: lock.important }).toEqual({
      id: 'A_DOOR',
      at: { kind: 'connector', ref: 'A_ROOM_B_ROOM' },
      strength: 'hard',
      important: true,
    });
    // ⑫ 흔적은 **이름들**이다 — 자리는 생성기가 낸다 (원천·탄생지가 그런 그대로)
    expect(lock.traces).toEqual(['첫째 흔적', '둘째 흔적']);
    expect(lock.reason).toBe('무엇이 일어난다');
  });

  it('요구의 네 갈래를 따로 적는다 — 밝힌 것이 전부 참이어야 열린다', () => {
    const result = asked();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 하나만 밝힌 요구도 요구다. 밝히지 않은 갈래는 자리 자체가 없고, 철만은 목록이라 빈 목록이다
    expect(result.brief.answers.asking.locks[0]!.requires).toEqual([
      { property: 'axis:relation', seasons: [] },
      { seasons: ['SOME_SEASON'] },
      { seasons: [], state: { region: 'A_ROOM', patterns: ['SOME_PATTERN'] } },
      { seasons: [], knowledge: '이것을 안다' },
    ]);
  });

  it('중요와 흔적과 요구는 적지 않아도 된다 — 밝히지 않은 물음은 거짓이고 빈 목록이다', () => {
    const result = asked((lock) => {
      delete lock.important;
      delete lock.traces;
      delete lock.requires;
      delete lock.reason;
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lock = result.brief.answers.asking.locks[0]!;
    expect({ important: lock.important, traces: lock.traces, requires: lock.requires }).toEqual({
      important: false,
      traces: [],
      requires: [],
    });
    // 밝히지 않은 사유는 자리 자체가 없다 — 빈 글자를 두면 "말하지 않는다" 와 "빈 말" 이 갈리지 않는다
    expect(lock.reason).toBeUndefined();
  });

  it('묻지 않는 방을 적을 수 있다 — 빈 목록에 said 가 그 까닭을 진다 (탄생의 born 과 같은 어법)', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.answers.asking.locks).toEqual([]);
    // 그 said 는 **실제 답**이다 — "아직 안 적었다" 가 아니라 "묻지 않는다" 이고, 둘을 갈라
    // 읽는 것이 T3 의 침묵과 미답을 가르는 자리다
    expect(isUnanswered(result.brief.answers.asking.said)).toBe(false);
    expect(unansweredKeys(result.brief)).toEqual([]);
  });

  it('물음도 미답일 수 있다 — 열 답 가운데 asking 을 세고, 차례는 형에 적힌 그대로다', () => {
    const result = parsed((b) => {
      const a = b.answers as Record<string, any>;
      a.cause = { unanswered: '까닭이 적히지 않았다' };
      a.asking = { said: { unanswered: '이 방이 무엇을 묻는가를 아직 답하지 못했다' }, locks: [] };
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 물음이 탄생과 내밂 사이에 선다 — 셈하는 차례가 곧 원문의 번호 차례다
    expect(unansweredKeys(result.brief)).toEqual(['cause', 'asking']);
  });

  it('물음 안의 형에 없는 필드도 물리친다 — 걸린 자리를 그 물음까지 짚어 준다', () => {
    const result = asked((lock) => {
      lock.colour = '붉다';
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.path)).toContain('answers.asking.locks.0.colour');
  });

  it('물음 안의 빈 글자를 물리친다 — 이름 없는 물음도 갈래 없는 자리도 세계에 없다', () => {
    for (const [path, over] of [
      ['answers.asking.locks.0.id', (lock: Record<string, unknown>) => (lock.id = '   ')],
      [
        'answers.asking.locks.0.at.kind',
        (lock: Record<string, unknown>) => (lock.at = { kind: '', ref: 'A_ROOM_B_ROOM' }),
      ],
      ['answers.asking.locks.0.strength', (lock: Record<string, unknown>) => (lock.strength = '')],
      [
        'answers.asking.locks.0.traces.0',
        (lock: Record<string, unknown>) => (lock.traces = ['  ']),
      ],
    ] as const) {
      const result = asked(over);
      expect({ path, ok: result.ok }).toEqual({ path, ok: false });
      if (result.ok) continue;
      expect(result.problems.map((p) => p.path)).toContain(path);
    }
  });
});

describe('RegionBrief — 무엇이 그 요구에 답할 성질을 가지는가 (⑩)', () => {
  it('원천이 내는 것의 성질을 받는다 — 태그와 그것이 나온 문장이 함께 선다', () => {
    const result = parsed((b) => {
      const a = b.answers as Record<string, any>;
      a.worth.sources[0].properties = [
        { tag: 'axis:relation', from: 'appearance' },
        { tag: 'axis:other', from: 'behavior' },
      ];
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 태그만으로는 모자란다 — 그 재료의 **어느 문장**이 그 성질을 말하는가까지 있어야
    // 문장에 없는 성질을 태그가 말하지 않는다
    expect(result.brief.answers.worth.sources[0]!.properties).toEqual([
      { tag: 'axis:relation', from: 'appearance' },
      { tag: 'axis:other', from: 'behavior' },
    ]);
  });

  it('밝히지 않으면 빈 목록이다 — 없음이 결핍이 아니다', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.answers.worth.sources[0]!.properties).toEqual([]);
  });

  it('반쪽 성질을 물리친다 — 태그도 문장도 빈 글자로 서지 못한다', () => {
    for (const properties of [[{ tag: 'axis:relation' }], [{ from: 'appearance' }], [{ tag: 'axis:relation', from: '  ' }]]) {
      const result = parsed((b) => {
        const a = b.answers as Record<string, any>;
        a.worth.sources[0].properties = properties;
      });
      expect({ properties, ok: result.ok }).toEqual({ properties, ok: false });
    }
  });
});
