// T2 — RegionBrief 형이 무엇을 받고 무엇을 물리치는가 (engine/world-authoring/brief.ts).
//
// 이 파일은 **게임을 모른다** — 방 이름도 재료도 여기서 지어 준다. 형이 일반명뿐이라
// 기반에 설 수 있다는 것이 그 자체로 이 시험의 내용이다.
//
// 형이 물리쳐야 하는 것 셋: 빈 답 · 까닭 없는 미답 · 형에 없는 필드.
// 셋 다 같은 규율에서 나온다 — **답하지 않은 것을 답한 것처럼 적으면 형이 거짓말을 한다** (T1 의 absent).

import { describe, expect, it } from 'vitest';
import {
  ANSWER_ORDER,
  isUnanswered,
  parseRegionBrief,
  unansweredKeys,
  type RegionBrief,
} from '../brief';

/** 여덟 답이 다 서 있는 가장 작은 brief */
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
        sources: [{ id: 'S', material: 'M', heldBy: '땅', form: '드러난 것', role: 'baseline' }],
      },
      discovery: '이것을 알게 된다',
      opening: '이것이 열린다',
      birth: { said: '이것이 태어난다', born: [{ id: 'L', from: 'M' }] },
    },
  };
}

const parsed = (over: (b: Record<string, unknown>) => void = () => {}) => {
  const value = sound() as Record<string, unknown>;
  over(value);
  return parseRegionBrief(value);
};

describe('RegionBrief — 형이 받는 것', () => {
  it('여덟 답이 선 brief 를 받고, 적지 않은 목록은 빈 목록이 된다', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.brief.kinds).toEqual([]);
    expect(result.brief.neighbours).toEqual([]);
    expect(result.brief.requires).toEqual([]);
    expect(result.brief.parent).toBeUndefined();
    // 태어나는 것의 세 목록도 적지 않으면 빈 목록이다 — 없는 것을 undefined 로 남기지 않는다
    expect(result.brief.answers.birth.born[0]).toEqual({
      id: 'L',
      from: 'M',
      consumes: [],
      leaves: [],
      calls: [],
    });
  });

  it('여덟 답의 순서가 형에 한 번만 적혀 있다', () => {
    const result = parsed();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.brief.answers)).toEqual([...ANSWER_ORDER]);
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

  it('여덟 중 하나가 없으면 물리친다 — 탄생도 마찬가지다 (Life §3.5)', () => {
    for (const key of ANSWER_ORDER) {
      const result = parsed((b) => {
        delete (b.answers as Record<string, unknown>)[key];
      });
      expect({ key, ok: result.ok }).toEqual({ key, ok: false });
    }
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
        sources: [{ id: 'S', material: 'M', heldBy: '구름', form: '덩이', role: '아무도 안 쓰는 자리' }],
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

  it('요구의 갈래는 셋 중 하나이고 까닭이 있어야 한다', () => {
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
