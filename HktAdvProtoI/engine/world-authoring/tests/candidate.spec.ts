// T6 — 편중 요약의 기계를 잰다. 두 보고를 견주어 **움직인 줄만** 고르는가.
//
// 세계도 방도 없다 — 보고 둘뿐이다. 그래야 검사가 늘어도(㉕ ㉖ ㉚ ㉝) 이 기계가 그대로임이 보인다.

import { describe, expect, it } from 'vitest';
import { checkShifts } from '../candidate';
import type { CheckItem, CheckReport } from '../check';

const item = (
  id: string,
  answer: string,
  status: CheckItem['status'] = 'pass',
  mark = '①',
): CheckItem => ({ mark, id, name: id, status, answer, refs: [] });

const report = (items: CheckItem[]): CheckReport => ({
  ok: items.every((i) => i.status !== 'fail'),
  counts: { pass: 0, fail: 0, absent: 0 } as CheckReport['counts'],
  items,
});

describe('T6 — 후보가 세계의 수를 어디로 미는가', () => {
  it('움직이지 않은 줄은 고르지 않는다 — 백 개를 나란히 볼 때 눈만 채운다', () => {
    const shifts = checkShifts(
      report([item('a', '방 11'), item('b', '그대로')]),
      report([item('a', '방 12'), item('b', '그대로')]),
    );
    expect(shifts.map((s) => s.id)).toEqual(['a']);
    expect(shifts[0]).toMatchObject({ before: '방 11', after: '방 12', broke: false });
  });

  it('전에 통과하던 것이 걸리면 그렇게 적는다 — 이 방이 세계를 무너뜨린다는 뜻이다', () => {
    const shifts = checkShifts(
      report([item('a', '걸린 것 0')]),
      report([item('a', '걸린 것 1', 'fail')]),
    );
    expect(shifts[0]).toMatchObject({ broke: true, after: '걸린 것 1' });
  });

  it('걸린 채로 답만 달라진 것은 새로 무너진 것이 아니다', () => {
    const shifts = checkShifts(
      report([item('a', '걸린 것 1', 'fail')]),
      report([item('a', '걸린 것 2', 'fail')]),
    );
    expect(shifts[0]).toMatchObject({ broke: false });
  });

  it('답이 같아도 판정이 달라졌으면 고른다 — 수는 그대로인데 통과가 아니게 되는 일이 있다', () => {
    const shifts = checkShifts(
      report([item('a', '없다', 'absent')]),
      report([item('a', '없다', 'fail')]),
    );
    expect(shifts.map((s) => s.id)).toEqual(['a']);
    expect(shifts[0]!.broke).toBe(true);
  });

  it('없던 검사가 생기면 앞의 답이 없다 — 검사가 늘면 요약도 저절로 는다 (㉕ ㉖ ㉚ ㉝)', () => {
    const shifts = checkShifts(report([item('a', '그대로')]), [
      report([item('a', '그대로'), item('새검사', '처음 잰다', 'pass', '㉕')]),
    ][0]!);
    expect(shifts.map((s) => s.id)).toEqual(['새검사']);
    expect(shifts[0]!.before).toBeUndefined();
    expect(shifts[0]!.mark).toBe('㉕');
  });

  it('보고의 차례를 그대로 지킨다 — 같은 후보는 언제나 같은 요약이다', () => {
    const before = report([item('a', '1'), item('b', '1'), item('c', '1')]);
    const after = report([item('a', '2'), item('b', '1'), item('c', '2')]);
    expect(checkShifts(before, after).map((s) => s.id)).toEqual(['a', 'c']);
    expect(checkShifts(before, after)).toEqual(checkShifts(before, after));
  });
});
