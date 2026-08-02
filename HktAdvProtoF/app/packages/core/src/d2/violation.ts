// D2 위반 서식 — 종의 설계도가 그래프를 낳지 못할 때, 어느 종의·어디가·왜 인지를 한 모양으로 적는다.
//
// D1 은 손으로 적은 그래프 하나가 온전한지를 보았다. D2 가 보는 것은 그 앞이다 —
// **종 하나에서 그래프가 나올 수 있는가.** 그래서 사유의 결이 다르다:
// D1 의 사유는 "이 그래프가 틀렸다" 이고, D2 의 사유는 "이 종은 살 수 없다" 이다.
//
// 판정을 두 번 만들지 않는다. 찍어 낸 그래프가 온전한지는 D1 의 `checkGraph` 가 유일한 판정자이고,
// D2 는 그 판정을 `broken-graph` 하나로 안고 옮긴다 — 사유·경로는 D1 의 것을 그대로 싣는다.

import type { Id } from '../v1/id.ts';

/** 종의 설계도가 거부되는 사유. */
export type SpeciesGraphViolationRule =
  // D2-a 뿌리
  | 'unrooted-need' // 종이 무너진다고 말한 자리에 뿌리가 없다
  | 'phantom-root' // 종이 말하지 않은 자리에 뿌리를 세웠다
  | 'duplicate-root' // 같은 자리에 뿌리가 둘이다
  | 'bad-blueprint' // 설계도의 값이 서식과 다르다
  // D2-b 채움
  | 'dangling-fill' // 없는 것을 채운다고 적었다
  | 'fillless-supply' // 아무것도 채우지 않는 채움 — 무엇 때문에 있는지 말하지 못한다
  | 'duplicate-supply' // 같은 이름의 채움이 둘이다
  | 'overridden-need-timing' // 뿌리를 채우면서 급함·시한을 따로 적었다 — 종이 이미 말했다
  | 'bare-supply-timing' // 뿌리 밖의 채움이 급함·시한을 적지 않았다
  // D2-c 생존·번식 무단절
  | 'unsupplied-need' // 무너지는 자리를 채우는 것이 하나도 없다 — 생존 경로가 끊겼다
  | 'unsupplied-lineage' // 대를 잇는 자리를 채우는 것이 하나도 없다 — 한 세대로 끝난다
  | 'lineage-missing' // 늙는 종이 대를 잇는 자리를 밝히지 않았다
  | 'ageless-lineage' // 늙지 않는 종이 대를 잇는다고 적었다
  | 'off-species-lineage' // 종이 열지 않은 자리로 대를 잇는다
  // 옮겨 온 판정
  | 'broken-graph'; // 찍어 낸 그래프가 D1 관문을 지나지 못한다

/** 어느 종의 설계도인가 — 화면에서 읽히도록 이름을 함께 진다 (앞 계층과 같은 태도). */
export interface SpeciesGraphRef {
  readonly speciesId: Id;
  readonly name: string;
}

/** 위반 하나 — 종의 설계도 어디가 왜 막혔는가. */
export interface SpeciesGraphViolation {
  readonly rule: SpeciesGraphViolationRule;
  readonly species: SpeciesGraphRef;
  /** 어느 뿌리·채움에서 걸렸는가. 설계도 전체면 빈 문자열 */
  readonly at: string;
  /** 설계도 안의 경로 (`$.supplies[2].fills[0]`) */
  readonly path: string;
  readonly message: string;
}

/** 위반 하나를 쌓는다. */
export function violateBlueprint(
  out: SpeciesGraphViolation[],
  species: SpeciesGraphRef,
  rule: SpeciesGraphViolationRule,
  at: string,
  path: string,
  message: string,
): void {
  out.push({ rule, species, at, path, message });
}

/** 위반 목록을 한 줄로 접는다 — 터미널·배지용. */
export function blueprintViolationVerdict(
  violations: readonly SpeciesGraphViolation[],
): string {
  if (violations.length === 0) return '설계도가 온전하다';
  const rules = [...new Set(violations.map((violation) => violation.rule))];
  const species = [...new Set(violations.map((violation) => violation.species.name))];
  return `${species.join(', ')} 의 설계도가 막혔다 — ${rules.join(', ')}`;
}
