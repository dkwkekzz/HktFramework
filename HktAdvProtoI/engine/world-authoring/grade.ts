// World Authoring — 등급 판정기 (T4 ADDED).
//
// brief(T2) 하나를 **세계의 계약 목록**과 대조해 A · B · C 로 가르고, 빠진 것을 GAP 형식으로 낸다.
// 등급이 가르는 것은 방의 좋고 나쁨이 아니라 **그 방을 세우는 공정**이다 (Tool-Scale §2):
//
//   A  데이터만      Play 없음 · Cycle 없음. RegionSpec 하나 + graph 한 줄 + view 표 한 줄
//   B  규칙 하나     Cycle 하나 — 그 지역만의 Region Rule 이 필요하다
//   C  새 축         컨텐츠 행이 아니다. 기반 층의 그 행이 설 때까지 기다린다
//
// **판정기는 문법을 넓히지 않는다** (§4). 어휘 밖의 값을 쓴 brief 를 받아 주는 대신 돌려보낸다 —
// 초안기(T5)가 지어낸 세계 사실을 잡는 자리가 여기다.
//
// **게임 명사가 없다.** 어느 태그가 어휘이고 어느 규칙이 이미 섰는지는 `WorldContracts` 로 받는다.
// 이 파일이 아는 것은 "어휘가 있다 · 요구에는 갈래가 있다" 는 형뿐이다.
//
// **어느 갈래가 어느 등급인가도 여기서 정하지 않는다** (T4 CHANGED). 기획서 §14 의 일곱 질문이
// 가르는 요구의 갈래마다 무엇을 A · B · C 로 칠 것인가는 **이 세계의 판단**이라, 코드의 갈래
// 나눔이 아니라 계약이 건네는 **결정 나무**(`DecisionBranch[]`)가 답한다. 나무를 주지 않는
// 세계에는 지금까지의 판정을 그대로 쓰는 기본 표가 선다 — 계약이 없으면 absent 로 두는 검사의
// 어법과 달리 여기서는 판정이 멈추면 안 되기 때문이다 (등급 없는 brief 는 공정을 세운다).

import {
  ANSWER_ORDER,
  isUnanswered,
  type Answer,
  type AnswerKey,
  type RegionBrief,
  type Requirement,
} from './brief';
import { answerOf } from './brief';

export type Grade = 'A' | 'B' | 'C';

/** 무거운 쪽이 이긴다 — 등급을 합칠 때 쓰는 유일한 자리 */
const GRADE_WEIGHT: Record<Grade, number> = { A: 0, B: 1, C: 2 };

/**
 * 결정 나무의 가지 하나 — 요구의 갈래 하나가 무엇을 뜻하는가 (T4 ADDED).
 *
 * 갈래 하나에 가지 하나다. 나무에 없는 갈래를 만나면 판정기는 가장 무거운 쪽(C)으로 두고
 * 그 사실을 걸린 것에 적는다 — 모르는 것을 가볍게 치지 않는다.
 *
 * 등급 A 인 가지도 있을 수 있다 (그 세계가 "그것은 데이터다" 로 치는 갈래). 그런 요구도 아직
 * 적히지 않은 것이므로 걸린 것에는 서되, 등급은 밀지 않는다 — 미는 것과 적어 두는 것은 다르다.
 */
export interface DecisionBranch {
  /** 요구의 갈래 */
  kind: Requirement['kind'];
  /** 그 갈래가 무엇을 뜻하는 등급인가 */
  grade: Grade;
  /** 어디로 돌려보내는가 */
  returnTo: string;
  /** 왜 그 등급인가 — 한 줄 (보고가 그대로 읊는다) */
  because: string;
}

/** 빠진 것 하나 — CLAUDE.md 의 GAP 형식 그대로다 */
export interface Gap {
  required: string;
  missing: string;
  reason: string;
  returnTo: string;
}

/** 이 세계가 이미 가진 것들 — 판정은 이 목록과의 대조다 */
export interface WorldContracts {
  /** 위험의 갈래 어휘 */
  hazardKinds: readonly string[];
  /** 깊이 어휘 */
  depths: readonly string[];
  /** 이음의 종류 */
  transitions: readonly string[];
  /** 재료를 무엇이 붙잡아 두는가 */
  carriers: readonly string[];
  /** 원천이 맡는 자리 */
  roles: readonly string[];
  /**
   * 성질의 축 어휘 (C031 ADDED).
   *
   * 판정하는 방식은 한 줄도 바뀌지 않는다 — 이 둘은 아직 **등록**될 뿐이다. brief 가 요구와 답을
   * 성질로 적기 전에는 대조할 입력이 없기 때문이고, 그 자리가 서면 여기가 그 대조의 어휘가 된다.
   */
  propertyAspects: readonly string[];
  /** 성질의 관계 어휘 — propertyAspects 와 같은 까닭으로 아직 대조에 쓰이지 않는다 */
  propertyRelations: readonly string[];
  /** 이미 지어진 방들 */
  regions: readonly string[];
  /** 아직 짓지 않은 곳 — 이웃으로 가리켜도 된다 */
  frontiers: readonly string[];
  /** 세계가 이미 품은 규칙의 이름들 — 그것을 요구하면 이미 있는 것이다 */
  rules: readonly string[];
  /**
   * 요구의 갈래를 등급으로 옮기는 표 (T4 ADDED).
   *
   * 게임 명사는 없지만 "이 세계가 무엇을 A 로 치는가" 는 컨텐츠의 판단이다. 주지 않으면
   * `defaultDecisionTree` 가 서고 판정은 지금까지와 한 값도 다르지 않다.
   */
  decisionTree?: readonly DecisionBranch[];
  /** 갈래마다 어디로 돌려보내는가 */
  returnTo: {
    /** 어휘 밖의 값을 돌려보내는 곳 — 성질의 축·관계(propertyAspects · propertyRelations)도 여기다 */
    vocabulary: string;
    rule: string;
    axis: string;
    contract: string;
    brief: string;
    /** 아직 답하지 않은 질문 — 등급을 가르지는 않는다 */
    pending: string;
  };
}

/**
 * 결정 나무를 주지 않은 세계의 기본 표 — **지금까지의 판정 그대로**다 (셋만 선다).
 *
 * 돌려보내는 곳은 계약이 이미 갈래마다 적어 두었으므로 그것을 그대로 옮긴다 — 같은 목록이
 * 두 자리에 있지 않도록.
 */
export function defaultDecisionTree(
  returnTo: WorldContracts['returnTo'],
): readonly DecisionBranch[] {
  return [
    { kind: 'rule', grade: 'B', returnTo: returnTo.rule, because: '그 규칙이 아직 세계에 없다' },
    { kind: 'axis', grade: 'C', returnTo: returnTo.axis, because: '그 층의 의미가 아직 서지 않았다' },
    {
      kind: 'contract',
      grade: 'C',
      returnTo: returnTo.contract,
      because: '그 공통 계약이 아직 데이터로 서지 않았다',
    },
  ];
}

/** 요구 하나가 어느 가지를 탔는가 — 요구 차례 그대로 */
export interface DecidedRequirement {
  what: string;
  kind: string;
  grade: Grade;
}

export interface GradeResult {
  grade: Grade;
  /** 등급을 가른 것들 — 이것이 비어 있으면 A 다 */
  blocking: Gap[];
  /**
   * 요구마다 어느 가지를 탔는가 — 나무에 없는 갈래도 (가장 무거운 쪽으로) 선다.
   * 이미 선 규칙을 요구한 줄은 요구가 아니므로 가지를 타지 않고 여기에도 서지 않는다.
   */
  decided: DecidedRequirement[];
  /**
   * 등급을 가르지는 않으나 채워야 할 것들 — 아직 답하지 않은 질문들.
   * 등급 A 의 방도 아홉 답을 다 적어야 실제로 설 수 있다 (Life §3.5 F2).
   */
  pending: Gap[];
  /** 왜 이 등급인가 — 한 줄 */
  because: string;
}

/** 그 값이 어휘 안에 있는가 — 없으면 문법을 넓히는 일이므로 돌려보낸다 */
function vocabularyGap(
  what: string,
  value: string,
  vocabulary: readonly string[],
  where: string,
  returnTo: string,
): Gap | undefined {
  if (vocabulary.includes(value)) return undefined;
  return {
    required: `${where} 가 ${what} 로 '${value}' 를 쓴다`,
    missing: `그 이름이 ${what} 어휘에 없다 (아는 것: ${vocabulary.join(' · ')})`,
    reason:
      '작성기는 문법을 넓히지 않는다 — 어휘를 늘리는 것은 이 방 하나의 일이 아니라 층의 일이다',
    returnTo,
  };
}

/** 아직 답하지 않은 질문 하나 — 등급을 가르지는 않지만 비어 있다는 것이 남는다 */
function pendingGap(brief: RegionBrief, key: AnswerKey, returnTo: string): Gap {
  // 형을 거치지 않고 온 값에는 자리 자체가 없을 수 있다 (기본값이 붙기 전에 적힌 brief) —
  // 그것도 미답이고, 까닭은 적힌 것이 없으므로 비운다
  const answer = answerOf(brief, key) as Answer | undefined;
  return {
    required: `${brief.id} 의 아홉 답 가운데 ${key}`,
    missing: '아직 답이 없다',
    reason: answer !== undefined && isUnanswered(answer) ? answer.unanswered : '',
    returnTo,
  };
}

/**
 * brief 하나를 계약 목록과 대조한다 — 읽기만 하고 아무것도 고치지 않는다.
 *
 * 걸린 것들의 순서는 언제나 같다: 깊이 → 갈래 → 이웃 → 원천 → 요구.
 * 그래야 같은 brief 가 언제나 같은 보고를 낸다.
 */
export function gradeRegion(brief: RegionBrief, contracts: WorldContracts): GradeResult {
  const blocking: Gap[] = [];
  const decided: DecidedRequirement[] = [];
  /** 지금까지 걸린 것들이 미는 등급 — 아무것도 걸리지 않으면 A 다 */
  let grade: Grade = 'A';
  /** 걸린 것 하나가 등급을 그만큼 민다 — 어휘 밖의 값과 없는 이웃은 규칙 하나로 풀리지 않는다 (C) */
  const block = (gap: Gap, pushes: Grade = 'C'): void => {
    blocking.push(gap);
    if (GRADE_WEIGHT[pushes] > GRADE_WEIGHT[grade]) grade = pushes;
  };
  const returnTo = contracts.returnTo;
  const decisionTree = contracts.decisionTree ?? defaultDecisionTree(returnTo);

  // ① 깊이 — 사슬의 어느 자리인가
  const depthGap = vocabularyGap('깊이', brief.depth, contracts.depths, brief.id, returnTo.vocabulary);
  if (depthGap) block(depthGap);

  // ② 갈래 — 위험이 무엇인가
  for (const kind of brief.kinds) {
    const gap = vocabularyGap('갈래', kind, contracts.hazardKinds, brief.id, returnTo.vocabulary);
    if (gap) block(gap);
  }

  // ③ 이웃 — 지어진 방이거나 밝혀진 경계여야 한다
  const placeable = [...contracts.regions, ...contracts.frontiers];
  for (const neighbour of brief.neighbours) {
    const gap = vocabularyGap(
      '이음의 종류',
      neighbour.transition,
      contracts.transitions,
      `${brief.id} → ${neighbour.region}`,
      returnTo.vocabulary,
    );
    if (gap) block(gap);
    if (!placeable.includes(neighbour.region)) {
      block({
        required: `${brief.id} 가 ${neighbour.region} 에 잇는다`,
        missing: '그 이름의 방도, 밝혀진 경계도 없다',
        reason: '이을 자리가 없으면 이 방은 세계에 붙지 못한다',
        returnTo: returnTo.brief,
      });
    }
  }

  // ④ 원천 — 붙잡는 것과 맡은 자리가 어휘 안인가 (재료의 **이름**은 새것이어도 된다: 데이터다)
  for (const source of brief.answers.worth.sources) {
    const held = vocabularyGap(
      '붙잡는 것',
      source.heldBy,
      contracts.carriers,
      `${brief.id} 의 ${source.id}`,
      returnTo.vocabulary,
    );
    if (held) block(held);
    const role = vocabularyGap(
      '맡은 자리',
      source.role,
      contracts.roles,
      `${brief.id} 의 ${source.id}`,
      returnTo.vocabulary,
    );
    if (role) block(role);
  }

  // ⑤ 요구 — 이 방이 성립하려면 세계에 무엇이 있어야 하는가.
  // 갈래를 등급으로 옮기는 것은 코드가 아니라 결정 나무다 (T4 CHANGED)
  for (const requirement of brief.requires) {
    if (requirement.kind === 'rule' && contracts.rules.includes(requirement.what)) continue; // 이미 선 규칙이다
    const branch = decisionTree.find((candidate) => candidate.kind === requirement.kind);
    const required = `${brief.id} 가 ${requirement.what} 를 요구한다`;
    if (!branch) {
      // 모르는 갈래는 가장 무거운 쪽으로 둔다 — 나무에 없는 것을 가볍게 치면 판정이 거짓말을 한다
      decided.push({ what: requirement.what, kind: requirement.kind, grade: 'C' });
      block({
        required,
        missing: `그 요구의 갈래가 결정 나무에 없다 (아는 것: ${decisionTree.map((b) => b.kind).join(' · ')})`,
        reason: requirement.why,
        returnTo: returnTo.vocabulary,
      });
      continue;
    }
    decided.push({ what: requirement.what, kind: requirement.kind, grade: branch.grade });
    block(
      { required, missing: branch.because, reason: requirement.why, returnTo: branch.returnTo },
      branch.grade,
    );
  }

  const pending = ANSWER_ORDER.filter((key) => isUnanswered(answerOf(brief, key))).map((key) =>
    pendingGap(brief, key, returnTo.pending),
  );

  return {
    grade,
    blocking,
    decided,
    pending,
    because:
      grade === 'A'
        ? `데이터만으로 선다 — 계약 밖의 것을 하나도 요구하지 않는다${pending.length > 0 ? ` (다만 아직 답하지 않은 질문이 ${pending.length})` : ''}`
        : grade === 'B'
          ? '규칙 하나가 필요하다 — Cycle 하나로 서고 Play 는 아니다'
          : '지금 없는 의미를 요구한다 — 기반 층의 그 행이 설 때까지 기다린다',
  };
}
