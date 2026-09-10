// T4 — 등급 판정기가 무엇으로 A · B · C 를 가르는가 (engine/world-authoring/grade.ts).
//
// 이 파일은 **게임을 모른다** — 어휘도 규칙 이름도 여기서 지어 준다. 계약 목록을 받아
// 대조하는 것이 판정의 전부라는 것이 그 자체로 이 시험의 내용이다.
//
// 등급이 가르는 것은 방의 좋고 나쁨이 아니라 **그 방을 세우는 공정**이다 (Tool-Scale §2).

import { describe, expect, it } from 'vitest';
import type { RegionBrief } from '../brief';
import { defaultDecisionTree, gradeRegion, type DecisionBranch, type WorldContracts } from '../grade';

const CONTRACTS: WorldContracts = {
  hazardKinds: ['danger/cold', 'danger/beast'],
  depths: ['near', 'far'],
  transitions: ['path', 'door'],
  carriers: ['ground', 'plant'],
  roles: ['free', 'risky'],
  propertyAspects: ['a', 'b'],
  propertyRelations: ['x', 'y'],
  // 성질 태그를 가르는 글자와, 성질이 나올 수 있는 문장의 갈래들 (T2 확장 ADDED · ⑩)
  propertyTagSeparator: ':',
  propertyStatements: ['앞모습', '버릇'],
  // 물음이 걸리는 자리의 갈래와 세기의 어휘 (T2 확장 ADDED · ⑨)
  lockAtKinds: ['문', '자락'],
  lockStrengths: ['무르게', '세게'],
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
      birth: { said: said('이것이 난다'), born: [], populations: [] },
      asking: { said: said('여기는 묻지 않는다'), locks: [] },
      offering: said('이것을 내민다'),
    },
    neighbours: [{ region: 'HOME', transition: 'path', direction: 'bidirectional', frontier: false }],
    requires: [],
    ...over,
  };
}

const grade = (over: Partial<RegionBrief> = {}) => gradeRegion(brief(over), CONTRACTS);

type Lock = RegionBrief['answers']['asking']['locks'][number];
type Source = RegionBrief['answers']['worth']['sources'][number];

/**
 * 물음 하나 — **형이 기본값을 채운 뒤의 꼴**이다 (판정기는 파서를 지나지 않고 값을 받는다).
 * 어휘는 여기서 지어 준다: 어느 갈래가 · 어느 세기가 성립하는지는 계약 목록이 안다
 */
function aLock(over: Partial<Lock> = {}): Lock {
  return {
    id: 'A_DOOR',
    at: { kind: '문', ref: 'A_ROOM_B_ROOM' },
    strength: '세게',
    important: false,
    requires: [],
    traces: [],
    ...over,
  };
}

/** 그 물음들을 세운 답 묶음 */
const asking = (locks: Lock[]): RegionBrief['answers'] => ({
  ...brief().answers,
  asking: { said: said('이 방은 이것을 묻는다'), locks },
});

/** 그 성질들을 밝힌 원천 하나를 세운 답 묶음 (⑩) */
const owning = (properties: Source['properties']): RegionBrief['answers'] => ({
  ...brief().answers,
  worth: {
    said: said('이것이 귀하다'),
    sources: [
      {
        id: 'S',
        material: 'M',
        heldBy: 'ground',
        worldCause: 'CHAIN',
        recoveryCause: 'molt-cycle',
        form: '덩이',
        role: 'free',
        properties,
      },
    ],
  },
});

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
            sources: [
              {
                id: 'S',
                material: '아무도 모르던 것',
                heldBy: 'ground',
                worldCause: 'CHAIN',
                recoveryCause: 'molt-cycle',
                form: '덩이',
                role: 'free',
                properties: [],
              },
            ],
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
          sources: [
            {
              id: 'S',
              material: 'M',
              heldBy: '구름',
              worldCause: 'CHAIN',
              recoveryCause: 'molt-cycle',
              form: '덩이',
              role: '공짜',
              properties: [],
            },
          ],
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
        birth: { said: { unanswered: '생명 계약이 아직 없다' }, born: [], populations: [] },
      },
    });
    expect(result.grade).toBe('A');
    expect(result.blocking).toEqual([]);
    // 답이 몇인지를 읊는 말은 이 시험이 쥐지 않는다 (여덟이었다가 아홉이 되고 열이 되었다) —
    // 재는 것은 **어느 답이 비었는가와 어디로 돌려보내는가**다
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]!.required).toContain('A_ROOM');
    expect(result.pending[0]!.required.endsWith('birth')).toBe(true);
    expect({
      missing: result.pending[0]!.missing,
      reason: result.pending[0]!.reason,
      returnTo: result.pending[0]!.returnTo,
    }).toEqual({ missing: '아직 답이 없다', reason: '생명 계약이 아직 없다', returnTo: '나중에' });
    expect(result.because).toContain('1');
  });

  it('두 번 재면 같다 — 읽기만 하고 아무것도 고치지 않는다', () => {
    expect(JSON.stringify(grade())).toBe(JSON.stringify(grade()));
  });
});

// ── C031 — 계약 목록이 성질 어휘를 안다 (WorldContracts.propertyAspects · propertyRelations · R4) ──
//
// C031 은 **등록**까지였다 — brief 가 요구와 답을 성질로 적기 전에는 대조할 입력이 없었다.
// T2 확장이 그 입력을 세웠으므로 이제 대조가 선다 (아래 '어휘 대조'). 그래도 성질을 **적지
// 않은** brief 는 어휘를 넓히든 좁히든 한 값도 달라지지 않는다 — 그것이 아래 시험의 내용이다.

// ── C037 — 갈래를 등급으로 옮기는 것은 코드가 아니라 결정 나무다 (T4 CHANGED) ──
//
// 판정의 자리가 코드에서 **데이터**로 옮겨졌다. 그래서 여기서 재는 것은 셋이다:
// 표를 주지 않아도 답이 그대로인가 · 표를 바꾸면 답이 바뀌는가 · 표에 없는 갈래를 어떻게 다루는가.

describe('결정 나무 — 요구의 갈래가 무엇을 뜻하는가는 계약이 정한다 (C037 ADDED)', () => {
  const REQUIRES = [
    { kind: 'rule' as const, what: '새 규칙', why: '이 방만의 규칙이다' },
    { kind: 'fact' as const, what: '새 사실', why: '세계의 값 하나가 없다' },
  ];

  it('표를 주지 않으면 기본 표가 서고 판정이 지금까지와 같다 — 셋의 등급도 돌려보내는 곳도', () => {
    for (const [kind, expected] of [
      ['rule', 'B'],
      ['axis', 'C'],
      ['contract', 'C'],
    ] as const) {
      const bare = grade({ requires: [{ kind, what: '없는 것', why: '까닭' }] });
      const withTree = gradeRegion(
        brief({ requires: [{ kind, what: '없는 것', why: '까닭' }] }),
        { ...CONTRACTS, decisionTree: defaultDecisionTree(CONTRACTS.returnTo) },
      );
      expect(bare.grade).toBe(expected);
      expect(JSON.stringify(withTree)).toBe(JSON.stringify(bare));
    }
  });

  it('요구마다 어느 가지를 탔는지가 요구 차례 그대로 남는다', () => {
    const tree: DecisionBranch[] = [
      ...defaultDecisionTree(CONTRACTS.returnTo),
      { kind: 'fact', grade: 'A', returnTo: '적은 사람', because: '그 사실이 아직 데이터에 없다' },
    ];
    const result = gradeRegion(brief({ requires: REQUIRES }), { ...CONTRACTS, decisionTree: tree });
    expect(result.decided).toEqual([
      { what: '새 규칙', kind: 'rule', grade: 'B' },
      { what: '새 사실', kind: 'fact', grade: 'A' },
    ]);
    // A 로 치는 갈래는 등급을 밀지 않는다 — 그래도 아직 적히지 않은 것이므로 걸린 것에는 선다
    expect(result.grade).toBe('B');
    expect(result.blocking[1]).toEqual({
      required: 'A_ROOM 가 새 사실 를 요구한다',
      missing: '그 사실이 아직 데이터에 없다',
      reason: '세계의 값 하나가 없다',
      returnTo: '적은 사람',
    });
  });

  it('표가 달라지면 같은 brief 의 등급이 달라진다 — 무엇을 A 로 칠지는 이 세계의 판단이다', () => {
    const harsh: DecisionBranch[] = [
      { kind: 'rule', grade: 'C', returnTo: '기반', because: '이 세계는 규칙 하나도 층의 일로 친다' },
    ];
    const result = gradeRegion(
      brief({ requires: [{ kind: 'rule', what: '새 규칙', why: '이 방만의 규칙이다' }] }),
      { ...CONTRACTS, decisionTree: harsh },
    );
    expect({ grade: result.grade, returnTo: result.blocking[0]!.returnTo }).toEqual({
      grade: 'C',
      returnTo: '기반',
    });
  });

  it('이미 선 규칙은 가지를 타지 않는다 — 요구가 아니기 때문이다', () => {
    const result = grade({
      requires: [{ kind: 'rule', what: '이미 선 규칙', why: '이 방이 그 규칙 위에 선다' }],
    });
    expect({ grade: result.grade, decided: result.decided }).toEqual({ grade: 'A', decided: [] });
  });

  it('표에 없는 갈래는 가장 무거운 쪽으로 두고 그 사실을 적는다 — 모르는 것을 가볍게 치지 않는다', () => {
    const result = grade({ requires: [{ kind: 'observation', what: '새 관찰', why: '알 길이 없다' }] });
    expect(result.grade).toBe('C');
    expect(result.decided).toEqual([{ what: '새 관찰', kind: 'observation', grade: 'C' }]);
    expect(result.blocking[0]!.missing).toContain('결정 나무에 없다');
    expect(result.blocking[0]!.returnTo).toBe('어휘');
  });
});

describe('성질을 적지 않은 brief 는 성질 어휘가 흔들려도 그대로다 (C031 ADDED)', () => {
  it('어휘를 비우든 채우든 · 늘리든 같은 brief 가 같은 판정을 낸다', () => {
    const empty: WorldContracts = { ...CONTRACTS, propertyAspects: [], propertyRelations: [] };
    const wider: WorldContracts = {
      ...CONTRACTS,
      propertyAspects: [...CONTRACTS.propertyAspects, 'c'],
      propertyRelations: [...CONTRACTS.propertyRelations, 'z'],
    };
    // 등급 A 인 방과 어휘 밖의 깊이를 쓴 방(C) 둘 다에서 같다
    for (const over of [{}, { depth: '없는깊이' }]) {
      const base = JSON.stringify(gradeRegion(brief(over), CONTRACTS));
      expect(JSON.stringify(gradeRegion(brief(over), empty))).toBe(base);
      expect(JSON.stringify(gradeRegion(brief(over), wider))).toBe(base);
    }
  });
});

// ── T2 확장 — 판정기가 드디어 성질 어휘를 **대조한다** (⑨ · ⑩ · ⑫) ──────────
//
// C031 이 등록해 둔 축 · 관계에 셋이 는다 — 태그를 가르는 글자 · 성질이 나올 문장의 갈래 ·
// 물음이 걸리는 자리와 세기의 어휘. 재는 것은 언제나 같다: **작성기는 문법을 넓히지 않는다.**
// 새 이름을 받아 주는 대신 어휘로 돌려보낸다 (깊이 · 갈래 · 이음이 선 그 자리 그대로).

describe('어휘 대조 — 성질 태그 (T2 확장 ADDED)', () => {
  /** 어휘 밖의 값 하나가 어휘로 돌려보내지는가 — vocabularyGap 의 어법 그대로 */
  const rejected = (result: ReturnType<typeof grade>, value: string) => {
    expect(result.grade).toBe('C');
    expect(result.blocking.some((gap) => gap.returnTo === '어휘' && gap.required.includes(value))).toBe(
      true,
    );
  };

  it.each([['ax'], ['a:x:y'], [':x'], ['a:']])(
    '성질 태그가 "축:관계" 꼴이 아니면 잡는다 (%s) — 가르지 못하는 태그는 어느 축도 가리키지 못한다',
    (tag) => {
      rejected(grade({ answers: asking([aLock({ requires: [{ property: tag, seasons: [] }] })]) }), tag);
    },
  );

  it('모르는 축을 잡는다 — 축이 느는 것은 이 방 하나의 일이 아니다', () => {
    rejected(grade({ answers: asking([aLock({ requires: [{ property: 'c:x', seasons: [] }] })]) }), 'c:x');
  });

  it('모르는 관계를 잡는다 — 성질이 요구에 무엇을 하는가도 어휘다', () => {
    rejected(grade({ answers: asking([aLock({ requires: [{ property: 'a:z', seasons: [] }] })]) }), 'a:z');
  });

  it('원천이 내미는 성질의 태그도 같은 잣대로 잡는다 (⑩) — 묻는 쪽과 답하는 쪽이 한 어휘를 쓴다', () => {
    rejected(grade({ answers: owning([{ tag: 'c:z', from: '앞모습' }]) }), 'c:z');
  });

  it('모르는 문장 갈래를 잡는다 (⑩ 의 from) — 문장에 없는 성질을 태그가 말하지 않는다', () => {
    rejected(grade({ answers: owning([{ tag: 'a:x', from: '없는 문장' }]) }), '없는 문장');
  });
});

describe('어휘 대조 — 물음이 걸리는 자리와 세기 (T2 확장 ADDED)', () => {
  it('모르는 at.kind 를 잡는다 — 어디에 걸리는가의 갈래는 이 세계가 고른다', () => {
    const result = grade({
      answers: asking([aLock({ at: { kind: '하늘', ref: 'A_ROOM_B_ROOM' } })]),
    });
    expect(result.grade).toBe('C');
    expect(result.blocking.some((gap) => gap.returnTo === '어휘' && gap.required.includes('하늘'))).toBe(true);
  });

  it('모르는 세기를 잡는다 — 무르게 묻는가 세게 묻는가도 어휘다', () => {
    const result = grade({ answers: asking([aLock({ strength: '조금' })]) });
    expect(result.grade).toBe('C');
    expect(result.blocking.some((gap) => gap.returnTo === '어휘' && gap.required.includes('조금'))).toBe(true);
  });

  it('아는 어휘만 쓴 물음은 등급을 흔들지 않는다 — **새 검사가 옛 답을 흔들지 않는다**', () => {
    const asked = grade({
      answers: asking([
        aLock({
          at: { kind: '자락', ref: 'some-area' },
          strength: '무르게',
          important: true,
          requires: [
            { property: 'a:x', seasons: [] },
            { seasons: ['어느 철'] },
            { seasons: [], state: { region: 'HOME', patterns: ['어느 배열'] } },
            { seasons: [], knowledge: '이것을 안다' },
          ],
          traces: ['첫째 흔적'],
          reason: '무엇이 일어난다',
        }),
      ]),
    });
    const quiet = grade();
    // 묻는 방과 묻지 않는 방의 판정이 같다 — 물음을 적었다는 것만으로 등급이 달라지지 않는다
    expect({ grade: asked.grade, blocking: asked.blocking }).toEqual({
      grade: quiet.grade,
      blocking: quiet.blocking,
    });
    expect(asked.grade).toBe('A');
  });

  it('아는 어휘만 쓴 성질도 마찬가지다 (⑩)', () => {
    const owned = grade({ answers: owning([{ tag: 'a:x', from: '앞모습' }, { tag: 'b:y', from: '버릇' }]) });
    expect({ grade: owned.grade, blocking: owned.blocking.length }).toEqual({ grade: 'A', blocking: 0 });
  });

  it('두 번 재면 같다 — 성질이 붙어도 읽기만 한다', () => {
    const over = { answers: asking([aLock({ requires: [{ property: 'a:x', seasons: [] }] })]) };
    expect(JSON.stringify(grade(over))).toBe(JSON.stringify(grade(over)));
  });
});

describe('⑪ 답의 다양함은 T4 가 판정하지 않는다 (T2 확장 ADDED)', () => {
  // grade 는 brief **하나**만 본다. "중요한 요구에 서로 다른 원천의 답이 있는가" 는 세계
  // 전체의 일이라 검사 ㊴ ㊵ 가 잰다 — 이 시험이 그 **경계**를 지키는 자리다.
  const importantLock = aLock({ important: true, requires: [{ property: 'a:x', seasons: [] }] });

  it('중요한 물음이라고 등급이 갈리지 않는다 — 중요함은 세는 쪽의 눈금이지 판정의 잣대가 아니다', () => {
    const heavy = grade({ answers: asking([importantLock]) });
    const light = grade({ answers: asking([{ ...importantLock, important: false }]) });
    expect({ grade: heavy.grade, blocking: heavy.blocking }).toEqual({
      grade: light.grade,
      blocking: light.blocking,
    });
    expect(heavy.grade).toBe('A');
  });

  it('답할 성질을 가진 원천이 하나뿐이어도 등급이 갈리지 않는다 — 그것은 이 방 하나로 알 수 없다', () => {
    const alone = gradeRegion(
      brief({
        answers: {
          ...asking([importantLock]),
          worth: owning([{ tag: 'a:x', from: '앞모습' }]).worth,
        },
      }),
      CONTRACTS,
    );
    const none = grade({ answers: asking([importantLock]) });
    expect({ grade: alone.grade, blocking: alone.blocking }).toEqual({
      grade: none.grade,
      blocking: none.blocking,
    });
    // 걸린 것도 pending 도 늘지 않는다 — 다양함을 재는 자리가 여기가 아니기 때문이다
    expect(alone.blocking).toEqual([]);
  });
});
