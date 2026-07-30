// 화면 셸 (기획서 §36 네 화면 + Phase-9 플레이 모드, §37 app/, §38)
//
// **이 파일이 아는 것은 세 가지뿐이다** — 프로토콜 메시지, ViewModel 속성, 페이지들.
// WorldDefinition·WorldState·사건 원본·생성 파이프라인은 하나도 등장하지 않는다(분해 원칙 5, 린트로 강제).
//
// 두 모드 (Phase-9 §9.2, §3 아키텍처):
//   #studio — 제작·검증 도구 (§36 네 화면 = §3 모듈 1~6 의 작업대)
//   #play   — §3 모듈 7. 패키지로 구운 세계를 불러와 플레이한다.
import { createEmptyGenerationView, type GenerationViewModel } from "../viewmodel/GenerationViewModel";
import { ViewModelBuilder } from "../viewmodel/ViewModelBuilder";
import type { SimulationHost, WorkerRequest, WorkerResponse } from "../shared/protocol";
import { EventInspectorPage } from "./EventInspectorPage";
import { PlayPage } from "./play/PlayPage";
import { SimulationPage } from "./SimulationPage";
import { WorldEditorPage } from "./WorldEditorPage";
import { WorldLibrary } from "./WorldLibrary";
import { WorldSeedPage } from "./WorldSeedPage";
import { el, setupTabs, type PageContext } from "./shell";
import { WorkerHost } from "./WorkerHost";

const host: SimulationHost = new WorkerHost();
const builder = new ViewModelBuilder();
const notice = el<HTMLElement>("notice");
const library = new WorldLibrary();

let generation: GenerationViewModel = createEmptyGenerationView();

const ctx: PageContext = {
  send: (request: WorkerRequest) => {
    void host.request(request).then(applyResponses);
  },
  notify: (message: string) => {
    notice.textContent = message;
  },
};

const seedPage = new WorldSeedPage(ctx);
const editorPage = new WorldEditorPage(ctx);
const simulationPage = new SimulationPage(ctx);
const eventPage = new EventInspectorPage(ctx);
const playPage = new PlayPage(ctx, library);

const showScreen = setupTabs(["seed", "editor", "simulation", "events"]);
showScreen("seed");

// --- 모드 라우팅 (Phase-9 §9.2) — URL 해시가 진실이다 -----------------------------------

type AppMode = "studio" | "play";
let mode: AppMode = "studio";

function applyMode(next: AppMode): void {
  mode = next;
  document.body.classList.toggle("play-mode", next === "play");
  el<HTMLElement>("studio-root").hidden = next === "play";
  el<HTMLElement>("screen-play").hidden = next !== "play";
  if (next === "play") playPage.enter();
  else playPage.leave();
}

function modeFromHash(): AppMode {
  return location.hash === "#play" ? "play" : "studio";
}

window.addEventListener("hashchange", () => applyMode(modeFromHash()));
el<HTMLButtonElement>("mode-play").addEventListener("click", () => {
  location.hash = "#play";
});
el<HTMLButtonElement>("play-to-studio").addEventListener("click", () => {
  location.hash = "#studio";
});

function renderAll(): void {
  const scene = builder.buildScene();
  simulationPage.render(scene);
  eventPage.render(scene);
  playPage.render(scene);
}

function applyResponses(responses: WorkerResponse[]): void {
  let message = "";
  for (const response of responses) {
    switch (response.type) {
      case "world_initialized":
        builder.markInitialized();
        break;
      case "state_patch":
        builder.applyPatch(response.patch);
        break;
      case "player_view":
        builder.setPlayerView(response.view);
        break;
      case "scene_view":
        builder.setSceneView(response.view);
        break;
      case "seed_input":
        seedPage.fill(response.input);
        break;
      case "generation_view":
        generation = response.view;
        seedPage.render(generation);
        editorPage.render(generation);
        break;
      case "world_package":
        // §3 모듈 1~6 의 산출물 — 스튜디오에서는 보관, 플레이에서는 즉시 로드 (Phase-9 §9.1)
        if (mode === "play") {
          playPage.onWorldPackage(response.json);
        } else {
          const saved = library.save(response.worldId, response.label, response.json, response.stages);
          seedPage.showPackageReport(response.stages, saved?.label);
        }
        break;
      case "playable_agents":
        playPage.onPlayableAgents(response.agents);
        break;
      case "player_action_result":
        message = response.outcome.accepted
          ? `${response.outcome.actionId} 시작 (완료 ${response.outcome.completesAt})`
          : `거절 — ${response.outcome.reason ?? ""}`;
        break;
      case "error":
        seedPage.settle();
        ctx.notify(`오류: ${response.message}`);
        return;
      default:
        break;
    }
  }
  if (message.length > 0) ctx.notify(message);
  simulationPage.setMessage(message);
  renderAll();
}

seedPage.render(generation);
editorPage.render(generation);
renderAll();
applyMode(modeFromHash());
