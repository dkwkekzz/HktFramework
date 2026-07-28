// 최소 셸 페이지 (Phase 0 스텝 9)
// SceneViewModel 만 소비한다 — tick 숫자 하나도 코어에서 직접 읽지 않는다 (분해 원칙 5).
import type { SimulationHost, WorkerResponse } from "../shared/protocol";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../shared/time";
import { ViewModelBuilder } from "../viewmodel/ViewModelBuilder";
import type { SceneViewModel } from "../viewmodel/SceneViewModel";
import { WorkerHost } from "./WorkerHost";

const host: SimulationHost = new WorkerHost();
const builder = new ViewModelBuilder();

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`요소 없음: ${id}`);
  return node as T;
}

const seedInput = el<HTMLInputElement>("seed");
const initButton = el<HTMLButtonElement>("init");
const hourButton = el<HTMLButtonElement>("advance-hour");
const dayButton = el<HTMLButtonElement>("advance-day");
const statusView = el<HTMLElement>("status");

function render(scene: SceneViewModel): void {
  // 렌더는 ViewModel 속성 그대로 — 해석 없음
  if (!scene.initialized) {
    statusView.textContent = "세계 없음 — 시드를 입력하고 생성하세요.";
    hourButton.disabled = true;
    dayButton.disabled = true;
    return;
  }
  hourButton.disabled = false;
  dayButton.disabled = false;
  const globals = scene.globalBadges.map((b) => `${b.key}=${b.value}`).join(", ");
  statusView.textContent = [
    `${scene.day}일차 ${String(Math.floor(scene.minuteOfDay / 60)).padStart(2, "0")}:${String(scene.minuteOfDay % 60).padStart(2, "0")} (tick ${scene.time})`,
    `개체 ${scene.entities.length}개`,
    globals.length > 0 ? `세계 상태: ${globals}` : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function applyResponses(responses: WorkerResponse[]): void {
  for (const response of responses) {
    switch (response.type) {
      case "world_initialized":
        builder.markInitialized();
        break;
      case "state_patch":
        builder.applyPatch(response.patch);
        break;
      case "error":
        statusView.textContent = `오류: ${response.message}`;
        return;
      default:
        break;
    }
  }
  render(builder.buildScene());
}

initButton.addEventListener("click", () => {
  const worldSeed = Number(seedInput.value) || 0;
  void host.request({ type: "initialize_world", worldSeed }).then(applyResponses);
});

hourButton.addEventListener("click", () => {
  void host.request({ type: "advance_time", amount: TICKS_PER_HOUR }).then(applyResponses);
});

dayButton.addEventListener("click", () => {
  void host.request({ type: "advance_time", amount: TICKS_PER_DAY }).then(applyResponses);
});

render(builder.buildScene());
