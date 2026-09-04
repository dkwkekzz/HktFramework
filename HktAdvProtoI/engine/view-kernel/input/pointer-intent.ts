// 집은 것의 뜻 (Pointer Intent) — **기구는 뜻을 정하지 않는다.**
//
// 화면을 누르면 기구가 할 수 있는 일은 하나뿐이다: 그 자리에 무엇이 있는지 집어 오는 것
// (renderer.pickEntity · pickGround). 집힌 것을 무엇으로 옮길지 — 요청인가, 고르기인가,
// 아무것도 아닌가 — 는 게임의 결정이므로 밖에서 주입된다.
//
// 여태 그 결정은 input.ts 안에 박혀 있었다 ("집힌 존재의 첫 interaction 을 즉시 보낸다").
// 그것은 기구가 게임의 뜻 하나를 몰래 쥐고 있었다는 뜻이고, 같은 클릭에 다른 뜻을 더하려면
// 기구를 고쳐야 했다. 이제 기구는 집기까지만 하고 정책이 답한다 — 정책을 주지 않으면
// 아무 요청도 만들어지지 않는다. **숨겨진 기본 동작은 없다.**

import type { ActionRequest } from '../../protocol-core/actions';

/** 한 번 누른 자리에서 집힌 것 전부 — 무엇이 뜻이 될지는 이 형이 알지 못한다 */
export interface PointerPick {
  /** 집힌 존재 (없으면 null) */
  entityId: string | null;
  /** 집힌 지면 (지형 밖이면 null) */
  ground: { x: number; z: number } | null;
  /** 함께 눌려 있던 보조키 — 같은 누름을 여러 뜻으로 가르는 수단이다 */
  modifiers: { alt: boolean; shift: boolean; ctrl: boolean; meta: boolean };
}

/**
 * 집힌 것을 무엇으로 옮길지 — **조립이 준다.**
 *
 * null 이면 아무 일도 하지 않는다 (요청이 나가지 않는다). 정책이 세계 밖에서 끝나는 일
 * (고르기 · 풀기)을 했더라도 기구가 알 바는 아니다 — 기구는 null 을 받으면 조용하다.
 */
export type PointerIntent = (pick: PointerPick) => ActionRequest | null;
