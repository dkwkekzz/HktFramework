// 겹침 표면의 열림 상태 (팩 결정 Layer) — **세계의 상태가 아니다.**
//
// 어떤 작업 공간이 지금 열려 있는가는 겪는 사람 쪽의 형편이며, 세계는 그것을 알지도
// 못하고 알 필요도 없다. 여는 것도 닫는 것도 세계로 아무것도 보내지 않으므로,
// 아무리 여닫아도 세계에는 흔적이 남지 않는다.
//
// 같은 성질의 상태가 이미 이 팩에 둘 있다 — `bindings.ts` 의 `armed`(다음 숫자 키가
// 무엇인가)와 조립 루트의 `commandOpen`(명령 표면이 열렸는가). 이 파일은 그 셋째다.
//
// 기반은 표면을 **그리는 능력**만 가진다 (engine/view-kernel/hud/surface.ts).
// 무엇이 열려 있는지는 결정 Layer 인 여기가 쥔다 (설계 반전 ⑤).

const open = new Set<string>();

/** 이 표면이 지금 열려 있는가 — 결정 Layer 가 장면을 지을 때 묻는다 */
export function surfaceIsOpen(id: string): boolean {
  return open.has(id);
}

/** 여닫는다. 같은 손짓이 열고 닫는다 — 여는 길과 닫는 길이 다르면 갇힐 수 있다 */
export function toggleSurface(id: string): void {
  if (open.has(id)) open.delete(id);
  else open.add(id);
}

/**
 * 닫는다. 기반의 Escape 와 닫는 자리(✕)가 조립을 거쳐 이것을 부른다.
 *
 * 이미 닫혀 있으면 아무 일도 일어나지 않는다 — 닫는 요청이 여는 요청이 되면
 * Escape 를 두 번 눌렀을 때 표면이 되살아난다.
 */
export function closeSurface(id: string): void {
  open.delete(id);
}

/** 검증용 — 지금 열려 있는 것들 */
export function openSurfaces(): string[] {
  return [...open];
}
