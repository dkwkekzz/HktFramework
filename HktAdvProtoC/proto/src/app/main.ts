// 최소 셸 페이지 (Phase 0 스텝 9 → Phase 1 스텝 7 확장)
// SceneViewModel 만 소비한다 — tick 숫자 하나도, 개체 상태 하나도 코어에서 직접 읽지 않는다 (분해 원칙 5).
import type { SimulationHost, WorkerResponse } from "../shared/protocol";
import { TICKS_PER_DAY, TICKS_PER_HOUR } from "../shared/time";
import { ViewModelBuilder } from "../viewmodel/ViewModelBuilder";
import type { SceneEntity, SceneViewModel } from "../viewmodel/SceneViewModel";
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
const weekButton = el<HTMLButtonElement>("advance-week");
const statusView = el<HTMLElement>("status");
const worldView = el<HTMLElement>("world");

function renderEntity(entity: SceneEntity): string {
  const place =
    entity.position === undefined
      ? ""
      : ` @${entity.position.x.toFixed(0)},${entity.position.y.toFixed(0)}` +
        (entity.elevation === undefined ? "" : `,${entity.elevation.toFixed(0)}`);
  const goal =
    entity.topGoal === undefined ? "" : ` → ${entity.topGoal.id}(${entity.topGoal.activation})`;
  const badges = entity.stateBadges.map((badge) => `${badge.key}=${badge.value}`).join(" ");
  return `[${entity.kind}] ${entity.label}${place}${goal}\n    ${badges}`;
}

function render(scene: SceneViewModel): void {
  // 렌더는 ViewModel 속성 그대로 — 해석 없음
  const running = scene.initialized;
  hourButton.disabled = !running;
  dayButton.disabled = !running;
  weekButton.disabled = !running;
  if (!running) {
    statusView.textContent = "세계 없음 — 시드를 입력하고 생성하세요.";
    worldView.textContent = "";
    return;
  }

  const globals = scene.globalBadges.map((badge) => `${badge.key}=${badge.value}`).join(", ");
  statusView.textContent = [
    `${scene.day}일차 ${String(Math.floor(scene.minuteOfDay / 60)).padStart(2, "0")}:${String(scene.minuteOfDay % 60).padStart(2, "0")} (tick ${scene.time})`,
    `개체 ${scene.entities.length}개`,
    globals.length > 0 ? `세계 상태: ${globals}` : "",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  // 지역별로 묶어 보여준다 — 묶음 키도 ViewModel 의 속성(regionId)이다
  const groups = new Map<string, SceneEntity[]>();
  for (const entity of scene.entities) {
    const key = entity.position?.regionId ?? "(위치 없음)";
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [entity]);
    else list.push(entity);
  }
  worldView.textContent = [...groups.entries()]
    .map(([regionId, entities]) => `# ${regionId}\n${entities.map(renderEntity).join("\n")}`)
    .join("\n\n");
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

function advance(amount: number): void {
  void host.request({ type: "advance_time", amount }).then(applyResponses);
}

hourButton.addEventListener("click", () => advance(TICKS_PER_HOUR));
dayButton.addEventListener("click", () => advance(TICKS_PER_DAY));
weekButton.addEventListener("click", () => advance(7 * TICKS_PER_DAY));

render(builder.buildScene());
