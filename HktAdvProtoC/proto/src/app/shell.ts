// 화면 공통 유틸 (기획서 §36, §37 / Phase-8)
//
// 페이지는 SceneViewModel·GenerationViewModel 속성만 읽는다 — core/persistence/generation 을 import 하지 않는다(린트).
// 여기 있는 것은 DOM 조작의 최소 도구뿐이고, 시뮬레이션 의미 해석은 한 줄도 없다.
import type { WorkerRequest } from "../shared/protocol";

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`요소 없음: ${id}`);
  return node as T;
}

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );
}

export function badgeLine(badges: { key: string; value: string }[], separator = " · "): string {
  return badges.map((badge) => `${badge.key} ${badge.value}`).join(separator);
}

/** 페이지가 시뮬레이션에게 말을 거는 유일한 통로 */
export interface PageContext {
  send(request: WorkerRequest): void;
  /** 화면 상단의 알림 문구 */
  notify(message: string): void;
}

/** 탭 전환 — 4개 화면(§36)은 같은 문서 안의 섹션이다 */
export function setupTabs(ids: string[]): (active: string) => void {
  const show = (active: string): void => {
    for (const id of ids) {
      el<HTMLElement>(`screen-${id}`).hidden = id !== active;
      el<HTMLButtonElement>(`tab-${id}`).classList.toggle("active", id === active);
    }
  };
  for (const id of ids) {
    el<HTMLButtonElement>(`tab-${id}`).addEventListener("click", () => show(id));
  }
  return show;
}
