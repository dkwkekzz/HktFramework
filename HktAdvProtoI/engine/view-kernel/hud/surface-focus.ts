// 겹침 표면 안에서 **자판이 다니는 길** — 그 길의 판단만 모아 둔 자리.
//
// 표면은 자판을 잡는다 (`SurfaceLayer.capturing`). 잡아 두고 다닐 길을 주지 않으면
// 그것은 붙잡은 것이 아니라 가둔 것이다 — 실제로 그랬다: Tab 은 표면을 지나쳐 뒤의
// 페이지로 새어 나갔고, 글자 자리의 `Esc` 는 아무 데도 닿지 않았다.
//
// **여기 있는 것은 판단뿐이고 DOM 이 없다.** 마디를 만지는 일은 `surface.ts` 가 하고,
// "다음은 어디인가 · 이 Escape 는 무엇을 닫는가 · 지금 초점을 옮겨야 하는가" 는 여기서
// 정한다. 브라우저 없이 확인할 수 있어야 하는 성질이기 때문이다 (surfaceMarkup 과 같은 이유).
//
// 이 파일에도 게임의 명사가 하나도 없다.

/**
 * 한 무리(칸 격자 · 줄 목록) 안에서 **Tab 이 서는 한 자리**.
 *
 * 무리 안을 걷는 것은 방향키의 일이고 무리 사이를 건너는 것이 Tab 의 일이다 — 격자의
 * 예순 칸이 전부 Tab 자리면 다음 구획까지 예순 번을 눌러야 한다.
 *
 * 실려 온 초점이 이 무리 안에 있으면 그 자리가, 아니면 첫 자리가 선다.
 */
export function tabStopId(
  ids: readonly string[],
  focusId: string | undefined,
): string | undefined {
  if (ids.length === 0) return undefined;
  if (focusId !== undefined && ids.includes(focusId)) return focusId;
  return ids[0];
}

/**
 * Tab 이 들어올 때 서는 자리 — **밖에서 들어오는 걸음**이다.
 *
 * 앞으로 오면 첫 자리, 뒤로 오면 마지막 자리. 이것이 없으면 Shift+Tab 으로 들어와도
 * 첫 자리에 서고, 그때 한 번 더 뒤로 가려면 목록을 한 바퀴 돌아야 한다.
 */
export function enterStop(count: number, backwards: boolean): number {
  if (count <= 0) return 0;
  return backwards ? count - 1 : 0;
}

/** Escape 한 번이 닫는 것 — **언제나 가장 가까운 것 하나**다 */
export type SurfaceEscape =
  /** 표면이 아무것도 열려 있지 않다 — 이 Escape 는 표면의 것이 아니다 */
  | 'none'
  /** 캐럿이 글자 자리에 있다 — 그 자리에서 나온다. 표면은 열린 채다 */
  | 'leave-field'
  /** 곁말이 떠 있다 — 읽던 것만 닫는다 */
  | 'close-tip'
  /** 맨 위 표면을 닫는다 */
  | 'close-surface';

/**
 * 이 Escape 는 무엇을 닫는가.
 *
 * 차례는 **가까운 것부터**다. 캐럿이 있는 자리가 가장 가깝고(글자 자리), 그다음이
 * 손이나 초점이 열어 둔 곁말이며, 표면 자체가 가장 멀다. 한 번에 하나씩만 닫히므로
 * 겪는 사람은 언제나 한 걸음 되돌아온다 — 읽던 것을 닫자고 누른 손이 표면째 닫아
 * 버리면 그 자리로 돌아오는 길이 사라진다.
 *
 * 글자 자리가 곁말보다 먼저인 이유: 곁말은 손이 얹혀만 있어도 떠 있을 수 있지만
 * 캐럿은 겪는 사람이 **거기 있기로 하고** 놓아 둔 자리다.
 */
export function escapeMeans(at: {
  readonly anyOpen: boolean;
  readonly inField: boolean;
  readonly tipOpen: boolean;
}): SurfaceEscape {
  if (!at.anyOpen) return 'none';
  if (at.inField) return 'leave-field';
  if (at.tipOpen) return 'close-tip';
  return 'close-surface';
}

export type FocusClaim =
  /** 그대로 둔다 */
  | { readonly move: 'none' }
  /** 실려 온 초점이 가리키는 자리로 */
  | { readonly move: 'ring'; readonly id: string }
  /** 표면 안 첫 자리로 — 열렸는데 실려 온 초점이 없을 때다 */
  | { readonly move: 'enter' };

/**
 * 이 프레임에 브라우저의 초점을 **실려 온 초점**으로 옮겨야 하는가 — 옮긴다면 어디로.
 *
 * 표면에는 초점이 둘 있었다. 결정 Layer 가 보내는 `focusId`(그려지는 링)와 브라우저가
 * 쥔 것(`document.activeElement`)이다. 둘이 만나지 않는 동안 방향키로 링을 옮겨도
 * 브라우저는 아무 데도 가지 않았고, 그래서 곁말도 열리지 않고 읽어 주는 장치도
 * 아무 말을 하지 않았다 — 링은 눈이 밝은 사람에게만 있는 초점이었다.
 *
 * **실려 온 것이 참이다.** 다만 옮기는 순간은 셋뿐이다.
 *
 *     표면이 방금 열렸다     자판이 표면 안에 있어야 한다 (표면이 자판을 잡았으므로)
 *     링이 움직였다          방향키가 링을 옮겼다 — 브라우저가 따라간다
 *     그 밖                  옮기지 않는다. 손이나 Tab 이 놓아 둔 자리를 빼앗지 않는다
 *
 * 글자를 치는 중이면 어느 경우에도 옮기지 않는다 — 한 글자마다 캐럿을 빼앗기면
 * 그 자리는 쓸 수 없는 자리가 된다.
 */
export function focusToClaim(now: {
  readonly focusId: string | undefined;
  readonly lastFocus: string | undefined;
  readonly justOpened: boolean;
  readonly typing: boolean;
}): FocusClaim {
  if (now.typing) return { move: 'none' };
  if (now.justOpened) {
    return now.focusId === undefined ? { move: 'enter' } : { move: 'ring', id: now.focusId };
  }
  if (now.focusId !== undefined && now.focusId !== now.lastFocus) {
    return { move: 'ring', id: now.focusId };
  }
  return { move: 'none' };
}
