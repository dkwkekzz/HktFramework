// World Authoring — 후보 하나가 세계의 수를 어떻게 움직이는가 (T6 ADDED).
//
// 판정 표면이 사람에게 보여야 하는 것은 "이 방이 서는가" 만이 아니다. 서는 방 백 개를 들이면
// 세계는 **편중**된다 — 기회 자리가 한쪽으로 쏠리고, 어느 Carrier 만 늘고, 고립된 방이 는다.
// 그것을 재는 자는 이미 있다: 검사(T1)가 분포를 답으로 낸다. 그러니 새로 셀 것이 없고,
// **후보를 넣기 전과 넣은 뒤의 답을 견주면** 그 방이 세계를 어디로 미는지가 그대로 나온다.
//
// 그래서 이 파일은 아무것도 세지 않는다. 두 보고를 견주어 **달라진 줄만** 고를 뿐이다.
// 검사가 늘면(㉕ ㉖ ㉚ ㉝ — Time C018 · Life C022 · C025) 편중 요약도 저절로 는다.
// 고를 항목의 목록을 손으로 들지 않는 것이 그래서 중요하다 — 그 목록이 곧 낡을 자리다.
//
// **게임 명사가 없다.** 무엇이 기회이고 무엇이 Carrier 인지 이 파일은 알지 못한다.

import type { CheckItem, CheckReport } from './check';

/** 검사 한 줄이 후보 때문에 움직인 자국 */
export interface CheckShift {
  mark: string;
  id: string;
  name: string;
  /** 후보를 넣기 전의 답. 그 검사가 전에 없었으면 없다 */
  before?: string;
  /** 후보를 넣은 뒤의 답 */
  after: string;
  /** 전에 통과하던 것이 걸렸는가 — 이 방이 세계를 무너뜨린다는 뜻이다 */
  broke: boolean;
}

/**
 * 두 보고를 견주어 **달라진 줄만** 고른다. 보고의 차례를 그대로 지키므로 같은 후보는 언제나
 * 같은 요약을 낸다.
 *
 * 달라지지 않은 줄은 고르지 않는다 — 백 개를 나란히 놓고 볼 때, 움직이지 않은 수는 읽는 사람의
 * 눈만 채운다. "무엇이 그대로인가" 는 검사 전체를 보면 되고, 그것은 `world:check` 의 일이다.
 */
export function checkShifts(before: CheckReport, after: CheckReport): CheckShift[] {
  const was = new Map<string, CheckItem>(before.items.map((item) => [item.id, item]));
  const shifts: CheckShift[] = [];
  for (const item of after.items) {
    const previous = was.get(item.id);
    if (previous && previous.answer === item.answer && previous.status === item.status) continue;
    shifts.push({
      mark: item.mark,
      id: item.id,
      name: item.name,
      ...(previous ? { before: previous.answer } : {}),
      after: item.answer,
      broke: item.status === 'fail' && previous?.status !== 'fail',
    });
  }
  return shifts;
}
