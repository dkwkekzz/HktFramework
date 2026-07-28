// 화면 셸 (기획서 §36 네 화면, §37 app/, §38 / Phase-8)
//
// **이 파일이 아는 것은 세 가지뿐이다** — 프로토콜 메시지, ViewModel 속성, 네 페이지.
// WorldDefinition·WorldState·사건 원본·생성 파이프라인은 하나도 등장하지 않는다(분해 원칙 5, 린트로 강제).
import { createEmptyGenerationView, type GenerationViewModel } from "../viewmodel/GenerationViewModel";
import { ViewModelBuilder } from "../viewmodel/ViewModelBuilder";
import type { SimulationHost, WorkerRequest, WorkerResponse } from "../shared/protocol";
import { EventInspectorPage } from "./EventInspectorPage";
import { SimulationPage } from "./SimulationPage";
import { WorldEditorPage } from "./WorldEditorPage";
import { WorldSeedPage } from "./WorldSeedPage";
import { el, setupTabs, type PageContext } from "./shell";
import { WorkerHost } from "./WorkerHost";

const host: SimulationHost = new WorkerHost();
const builder = new ViewModelBuilder();
const notice = el<HTMLElement>("notice");

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

const showScreen = setupTabs(["seed", "editor", "simulation", "events"]);
showScreen("seed");

function renderAll(): void {
  const scene = builder.buildScene();
  simulationPage.render(scene);
  eventPage.render(scene);
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
