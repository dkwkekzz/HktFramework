// V-007 — 보낸 것과 일어난 것 사이의 시간 (UX 문서 §7 · §8 응답 지연).
//
// 재는 것은 하나다: **늦지 않은 기다림은 보이지 않는다.** 세계는 보통 한 Tick 안에
// 답하므로, 보내자마자 `처리 중` 을 띄우면 그 글자는 읽히기 전에 사라진다.
// 남는 것은 칸이 한 번 깜빡였다는 인상뿐이고, 깜빡임은 정보가 아니다.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetWaits,
  LATE_AFTER_MS,
  waitingSince,
  waitStage,
  waitText,
  WORKING_AFTER_MS,
} from '../request-timing';

beforeEach(() => forgetWaits());

describe('waitStage — 늦을 때만 말한다', () => {
  it('보낸 지 얼마 안 됐으면 아무 말도 없다', () => {
    expect(waitStage(1000, 1000)).toBe('silent');
    expect(waitStage(1000, 1000 + WORKING_AFTER_MS - 1)).toBe('silent');
  });

  it('1초가 지나면 처리 중이다', () => {
    expect(waitStage(1000, 1000 + WORKING_AFTER_MS)).toBe('working');
    expect(waitText(waitStage(1000, 1000 + WORKING_AFTER_MS))).toBe('처리 중');
  });

  it('5초가 지나면 재시도가 아니라 이어짐이다 — 같은 요청을 두 번 보내게 하지 않는다', () => {
    expect(waitStage(1000, 1000 + LATE_AFTER_MS)).toBe('late');
    expect(waitText(waitStage(1000, 1000 + LATE_AFTER_MS))).toBe('이어짐 확인');
  });

  it('언제 보냈는지 모르면 말하지 않는다 — 모르는 것을 지어내지 않는다', () => {
    expect(waitStage(undefined, 9999)).toBe('silent');
    expect(waitText('silent')).toBeUndefined();
  });
});

describe('waitingSince — 언제 보냈는지 모르는 자리의 장부', () => {
  it('처음 본 순간을 적고, 그 뒤로는 같은 값을 낸다', () => {
    expect(waitingSince('attack', true, 100)).toBe(100);
    expect(waitingSince('attack', true, 900)).toBe(100);
    expect(waitStage(waitingSince('attack', true, 1200), 1200)).toBe('working');
  });

  it('기다림이 끝난 자리는 잊는다 — 다음 요청이 지난번 나이를 물려받지 않는다', () => {
    waitingSince('attack', true, 100);
    expect(waitingSince('attack', false, 200)).toBeUndefined();
    // 다시 걸었다 — 나이는 여기서부터 다시 센다. 잊지 않으면 누르자마자
    // `이어짐 확인` 이 뜨는 화면이 된다
    expect(waitingSince('attack', true, 9000)).toBe(9000);
    expect(waitStage(waitingSince('attack', true, 9000), 9000)).toBe('silent');
  });

  it('자리마다 따로 센다 — 한 기술의 기다림이 다른 기술의 나이가 되지 않는다', () => {
    waitingSince('attack', true, 100);
    expect(waitingSince('skill-heavy', true, 5200)).toBe(5200);
    expect(waitStage(waitingSince('attack', true, 5200), 5200)).toBe('late');
    expect(waitStage(waitingSince('skill-heavy', true, 5200), 5200)).toBe('silent');
  });
});
