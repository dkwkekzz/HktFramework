// 이동·시점 키 코드 원본 — 팩이 사본 없이 읽을 수 있게 내보낸 것의 모양을 잠근다.
//
// 이 목록과 어긋난 키를 상호작용에 주면 그 조작은 눌러도 아무 일이 없다
// (눌린 순간 삼켜져 interaction 판정까지 오지 않는다 — 실제로 겪은 일이다).
// 그래서 이 내보내기는 "지금 무슨 키인가" 가 아니라 **원본과 같은 파일에서 나온다**는
// 사실이 요점이다 — 원본이 늘면 이 목록이 함께 는다.

import { describe, expect, it } from 'vitest';
import { MOVE_KEY_CODES, TURN_KEY_CODES } from '../input/keyboard';

describe('키 코드 원본 내보내기', () => {
  it('이동 방향키 — WASD 와 방향키 여덟이다', () => {
    expect([...MOVE_KEY_CODES].sort()).toEqual(
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].sort(),
    );
  });

  it('시점 조작키 — 돌기(Z·X)와 기울이기(R·T) 넷이다', () => {
    expect([...TURN_KEY_CODES].sort()).toEqual(['KeyZ', 'KeyX', 'KeyR', 'KeyT'].sort());
  });

  it('이동과 시점은 서로 겹치지 않는다 — 한 키가 두 뜻이면 어느 쪽도 믿을 수 없다', () => {
    const overlap = MOVE_KEY_CODES.filter((code) => TURN_KEY_CODES.includes(code));
    expect(overlap).toEqual([]);
  });
});
