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
// 이 파일이 아는 것은 "어휘가 있다 · 요구에는 세 갈래가 있다" 는 형뿐이다.

import { ANSWER_ORDER, isUnanswered, type AnswerKey, type RegionBrief } from './brief';
import { answerOf } from './brief';

export type Grade = 'A' | 'B' | 'C';

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
  /** 이미 지어진 방들 */
  regions: readonly string[];
  /** 아직 짓지 않은 곳 — 이웃으로 가리켜도 된다 */
  frontiers: readonly string[];
  /** 세계가 이미 품은 규칙의 이름들 — 그것을 요구하면 이미 있는 것이다 */
  rules: readonly string[];
  /** 갈래마다 어디로 돌려보내는가 */
  returnTo: {
    vocabulary: string;
    rule: string;
    axis: string;
    contract: string;
    brief: string;
    /** 아직 답하지 않은 질문 — 등급을 가르지는 않는다 */
    pending: string;
  };
}

export interface GradeResult {
  grade: Grade;
  /** 등급을 가른 것들 — 이것이 비어 있으면 A 다 */
  blocking: Gap[];
  /**
   * 등급을 가르지는 않으나 채워야 할 것들 — 아직 답하지 않은 질문들.
   * 등급 A 의 방도 여덟 답을 다 적어야 실제로 설 수 있다 (Life §3.5 F2).
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
  const answer = answerOf(brief, key);
  return {
    required: `${brief.id} 의 여덟 답 가운데 ${key}`,
    missing: '아직 답이 없다',
    reason: isUnanswered(answer) ? answer.unanswered : '',
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
  /** 규칙 하나로는 풀리지 않는 걸림의 수 — 등급을 C 로 미는 것들 */
  let beyondRule = 0;
  const block = (gap: Gap, rulesCanFix = false): void => {
    blocking.push(gap);
    if (!rulesCanFix) beyondRule++;
  };
  const returnTo = contracts.returnTo;

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

  // ⑤ 요구 — 이 방이 성립하려면 세계에 무엇이 있어야 하는가
  let needsRule = false;
  let needsAxis = false;
  for (const requirement of brief.requires) {
    if (requirement.kind === 'rule' && contracts.rules.includes(requirement.what)) continue; // 이미 선 규칙이다
    if (requirement.kind === 'rule') needsRule = true;
    else needsAxis = true;
    block({
      required: `${brief.id} 가 ${requirement.what} 를 요구한다`,
      missing:
        requirement.kind === 'rule'
          ? '그 규칙이 아직 세계에 없다'
          : requirement.kind === 'axis'
            ? '그 층의 의미가 아직 서지 않았다'
            : '그 공통 계약이 아직 데이터로 서지 않았다',
      reason: requirement.why,
      returnTo:
        requirement.kind === 'rule'
          ? returnTo.rule
          : requirement.kind === 'axis'
            ? returnTo.axis
            : returnTo.contract,
      },
      // 규칙 요구는 Cycle 하나로 풀린다 — 등급을 C 로 밀지 않는다
      requirement.kind === 'rule',
    );
  }

  // 어휘 밖의 값과 없는 이웃은 규칙 하나로 해결되지 않는다 — 지금 없는 의미를 요구하는 것이다
  const grade: Grade = needsAxis || beyondRule > 0 ? 'C' : needsRule ? 'B' : 'A';

  const pending = ANSWER_ORDER.filter((key) => isUnanswered(answerOf(brief, key))).map((key) =>
    pendingGap(brief, key, returnTo.pending),
  );

  return {
    grade,
    blocking,
    pending,
    because:
      grade === 'A'
        ? `데이터만으로 선다 — 계약 밖의 것을 하나도 요구하지 않는다${pending.length > 0 ? ` (다만 아직 답하지 않은 질문이 ${pending.length})` : ''}`
        : grade === 'B'
          ? '규칙 하나가 필요하다 — Cycle 하나로 서고 Play 는 아니다'
          : '지금 없는 의미를 요구한다 — 기반 층의 그 행이 설 때까지 기다린다',
  };
}
