// T4 — 등급 판정기가 무엇으로 A · B · C 를 가르는가 (engine/world-authoring/grade.ts).
//
// 이 파일은 **게임을 모른다** — 어휘도 규칙 이름도 여기서 지어 준다. 계약 목록을 받아
// 대조하는 것이 판정의 전부라는 것이 그 자체로 이 시험의 내용이다.
//
// 등급이 가르는 것은 방의 좋고 나쁨이 아니라 **그 방을 세우는 공정**이다 (Tool-Scale §2).

import { describe, expect, it } from 'vitest';
import type { RegionBrief } from '../brief';
import { gradeRegion, type WorldContracts } from '../grade';

const CONTRACTS: WorldContracts = {
  hazardKinds: ['danger/cold', 'danger/beast'],
  depths: ['near', 'far'],
  transitions: ['path', 'door'],
  carriers: ['ground', 'plant'],
  roles: ['free', 'risky'],
  regions: ['HOME'],
  frontiers: ['UNBUILT'],
  rules: ['이미 선 규칙'],
  returnTo: {
    vocabulary: '어휘',
    rule: '규칙',
    axis: '축',
    contract: '계약',
    brief: '적은 사람',
    pending: '나중에',
  },
};

const said = (text: string) => text;
function brief(over: Partial<RegionBrief> = {}): RegionBrief {
  return {
    id: 'A_ROOM',
    name: '어떤 방',
    depth: 'near',
    kinds: [],
    answers: {
      distinction: said('이런 곳'),
      cause: said('이래서'),
      dwelling: said('이런 것이 산다'),
      danger: said('이것이 위험'),
      worth: { said: said('이것이 귀하다'), sources: [] },
      discovery: said('이것을 안다'),
      opening: said('이것이 열린다'),
      birth: { said: said('이것이 난다'), born: [] },
    },
    neighbours: [{ region: 'HOME', transition: 'path', direction: 'bidirectional', frontier: false }],
    requires: [],
    ...over,
  };
}

const grade = (over: Partial<RegionBrief> = {}) => gradeRegion(brief(over), CONTRACTS);

describe('등급 A — 데이터만으로 선다', () => {
  it('계약 밖의 것을 하나도 요구하지 않으면 A 이고 걸린 것이 없다', () => {
    const result = grade();
    expect({ grade: result.grade, blocking: result.blocking.length }).toEqual({ grade: 'A', blocking: 0 });
  });

  it('아직 짓지 않은 곳(경계)을 가리켜도 A 다 — 밝혀진 경계는 정합 오류가 아니다', () => {
    expect(
      grade({
        neighbours: [{ region: 'UNBUILT', transition: 'door', direction: 'one-way', frontier: true }],
      }).grade,
    ).toBe('A');
  });

  it('**이미 선 규칙**을 요구하는 것은 요구가 아니다 — 그것은 이미 있다', () => {
    const result = grade({
      requires: [{ kind: 'rule', what: '이미 선 규칙', why: '이 방이 그 규칙 위에 선다' }],
    });
    expect({ grade: result.grade, blocking: result.blocking.length }).toEqual({ grade: 'A', blocking: 0 });
  });

  it('새 재료의 **이름**은 A 를 깨지 않는다 — 재료가 느는 것은 데이터다', () => {
    expect(
      grade({
        answers: {
          ...brief().answers,
          worth: {
            said: said('새것이 난다'),
            sources: [{ id: 'S', material: '아무도 모르던 것', heldBy: 'ground', form: '덩이', role: 'free' }],
          },
        },
      }).grade,
    ).toBe('A');
  });
});

describe('등급 B — 규칙 하나', () => {
  const ruled = () =>
    grade({ requires: [{ kind: 'rule', what: '새 규칙', why: '이 방만의 규칙이다' }] });

  it('아직 없는 규칙 하나를 요구하면 B 다', () => {
    expect(ruled().grade).toBe('B');
  });

  it('빠진 것이 GAP 형식으로 적힌다 — 어디로 돌려보내는지까지', () => {
    expect(ruled().blocking).toEqual([
      {
        required: 'A_ROOM 가 새 규칙 를 요구한다',
        missing: '그 규칙이 아직 세계에 없다',
        reason: '이 방만의 규칙이다',
        returnTo: '규칙',
      },
    ]);
  });

  it('규칙 말고 또 걸린 것이 있으면 B 가 아니라 C 다 — 규칙 하나로 풀리지 않는다', () => {
    expect(
      grade({
        depth: '아무도 모르는 깊이',
        requires: [{ kind: 'rule', what: '새 규칙', why: '이 방만의 규칙이다' }],
      }).grade,
    ).toBe('C');
  });
});

describe('등급 C — 지금 없는 의미를 요구한다', () => {
  it('축을 요구하면 C 다', () => {
    expect(grade({ requires: [{ kind: 'axis', what: '없는 층', why: '그 층이 이 방의 절반이다' }] }).grade).toBe('C');
  });

  it('공통 계약을 요구해도 C 다 — 그것은 이 방 하나의 일이 아니다', () => {
    expect(grade({ requires: [{ kind: 'contract', what: '없는 계약', why: '없으면 못 선다' }] }).grade).toBe('C');
  });

  it.each([
    ['깊이', { depth: '아무도 모르는 깊이' }],
    ['갈래', { kinds: ['danger/unknown'] }],
    ['이음의 종류', { neighbours: [{ region: 'HOME', transition: '헤엄', direction: 'bidirectional' as const, frontier: false }] }],
  ])('어휘 밖의 %s 를 쓰면 C 다 — 작성기는 문법을 넓히지 않는다', (_what, over) => {
    const result = grade(over as Partial<RegionBrief>);
    expect(result.grade).toBe('C');
    expect(result.blocking[0]!.returnTo).toBe('어휘');
    expect(result.blocking[0]!.missing).toContain('어휘에 없다');
  });

  it('없는 곳을 이웃으로 가리키면 C 다 — 이을 자리가 없으면 붙지 못한다', () => {
    const result = grade({
      neighbours: [{ region: 'NOWHERE', transition: 'path', direction: 'bidirectional', frontier: false }],
    });
    expect(result.grade).toBe('C');
    expect(result.blocking.map((g) => g.returnTo)).toEqual(['적은 사람']);
  });

  it('원천의 붙잡는 것 · 맡은 자리도 어휘다', () => {
    const result = grade({
      answers: {
        ...brief().answers,
        worth: {
          said: said('난다'),
          sources: [{ id: 'S', material: 'M', heldBy: '구름', form: '덩이', role: '공짜' }],
        },
      },
    });
    expect(result.grade).toBe('C');
    expect(result.blocking.length).toBe(2); // 붙잡는 것 하나 · 맡은 자리 하나
  });
});

describe('아직 답하지 않은 질문은 등급을 가르지 않는다', () => {
  it('미답은 pending 으로 따로 선다 — A 인 채로 채울 것이 남는다', () => {
    const result = grade({
      answers: {
        ...brief().answers,
        birth: { said: { unanswered: '생명 계약이 아직 없다' }, born: [] },
      },
    });
    expect(result.grade).toBe('A');
    expect(result.blocking).toEqual([]);
    expect(result.pending).toEqual([
      {
        required: 'A_ROOM 의 여덟 답 가운데 birth',
        missing: '아직 답이 없다',
        reason: '생명 계약이 아직 없다',
        returnTo: '나중에',
      },
    ]);
    expect(result.because).toContain('1');
  });

  it('두 번 재면 같다 — 읽기만 하고 아무것도 고치지 않는다', () => {
    expect(JSON.stringify(grade())).toBe(JSON.stringify(grade()));
  });
});
