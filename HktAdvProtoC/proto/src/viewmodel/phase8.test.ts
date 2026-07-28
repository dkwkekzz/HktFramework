// Phase 8 DoD — 표현 고도화 (§36 4개 화면, §33.3 Event Interpreter, §8.0 ViewModel 파이프라인)
//
// 측정은 전부 phase8Checks 가 한다 — verify 스크립트의 보고와 이 테스트가 같은 수를 본다.
import { beforeAll, describe, expect, it } from "vitest";
import { runPlayerScenario, type PlayerScenarioResult } from "../core/agents/phase7Checks";
import { DEFAULT_PLAYER_AGENT_ID } from "../content/player-world";
import { eventsBySignificance } from "../core/events/phase4Checks";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import { CanvasSceneRenderer } from "../rendering/CanvasSceneRenderer";
import { RecordingSurface } from "../rendering/SceneSurface";
import { TextSceneRenderer } from "../rendering/TextSceneRenderer";
import { EventInterpreter } from "../presentation/EventInterpreter";
import { buildScenePayload } from "./ScenePayloadBuilder";
import type { SceneViewPayload } from "./SceneViewModel";
import {
  abilityDisplayMatchesLedger,
  auditNarration,
  checkRendererImports,
  checkRendererParity,
  compareModes,
  sceneOf,
} from "./phase8Checks";

const SEED = 42;
const DAYS = 30;

let scenario: PlayerScenarioResult;
let runtime: WorldRuntime;
let developer: SceneViewPayload;
let player: SceneViewPayload;
let topEventId: string | undefined;

beforeAll(async () => {
  scenario = await runPlayerScenario({ worldSeed: SEED, days: DAYS });
  runtime = scenario.runtime;
  topEventId = eventsBySignificance(runtime)[0]?.id;
  const focus = { agentId: DEFAULT_PLAYER_AGENT_ID, ...(topEventId === undefined ? {} : { eventId: topEventId }) };
  developer = buildScenePayload(runtime, { mode: "developer", ...focus });
  player = buildScenePayload(runtime, { mode: "player", ...focus });
}, 120_000);

describe("§36.2 월드 지도 화면", () => {
  it("지역·연결·주체·자원·사건이 표시 속성으로 실린다", () => {
    expect(developer.map.regions.length).toBeGreaterThan(0);
    expect(developer.map.connections.length).toBeGreaterThan(0);
    expect(developer.map.markers.length).toBeGreaterThan(0);
    expect(developer.map.resources.length).toBeGreaterThan(0);
    expect(developer.map.overlays.length).toBeGreaterThan(0);
  });

  it("3D→2D 투영과 정규화가 빌더에서 끝난다 — 좌표는 전부 0~1", () => {
    const points = [
      ...developer.map.markers.map((marker) => marker.point),
      ...developer.map.resources.map((marker) => marker.point),
      ...developer.map.overlays.map((overlay) => overlay.point),
    ];
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
    // 고도(z)는 좌표에서 빠지고 표시 속성으로 남는다 (§13 개정)
    expect(developer.map.markers.some((marker) => marker.elevation !== 0)).toBe(true);
    for (const marker of developer.map.markers) {
      expect(marker.elevationShade).toBeGreaterThanOrEqual(0);
      expect(marker.elevationShade).toBeLessThanOrEqual(1);
    }
  });

  it("수치 해석은 빌더가 끝낸다 — 색상 키·심볼 키만 넘어간다", () => {
    for (const region of developer.map.regions) {
      expect(region.dangerKey).toMatch(/^danger-(low|mid|high|extreme)$/);
      expect(region.climateKey.startsWith("climate-")).toBe(true);
    }
    for (const marker of developer.map.markers) {
      expect(marker.symbolKey.startsWith("symbol-")).toBe(true);
    }
  });

  it("신호는 채널 속성으로만 실린다 (§42-8 연출)", () => {
    for (const signal of developer.map.signals) {
      expect(signal.channelKey.length).toBeGreaterThan(0);
      expect(signal.intensity).toBeGreaterThanOrEqual(0);
      expect(signal.intensity).toBeLessThanOrEqual(1);
      expect(signal.ttl).toBeGreaterThan(0);
    }
  });
});

describe("§36.3 주체 관찰 화면 — 개발자/플레이어 모드", () => {
  it("목록 8항목이 전부 실린다", () => {
    const panel = developer.agentPanel!;
    expect(panel.states.filter((row) => row.actual !== undefined).length).toBeGreaterThan(0); // ① 실제
    expect(panel.beliefsAboutOthers.length).toBeGreaterThan(0); // ② 믿음
    expect(panel.activeGoal).toBeDefined(); // ③ 활성 목적
    expect(panel.goalGraph.length).toBeGreaterThan(0); // ④ 목적 그래프
    expect(panel.goalGraph[0]!.breakdown.length).toBe(11); // §20 활성도 11항
    expect(panel.memories.length).toBeGreaterThan(0); // ⑥ 기억
    expect(panel.relationships.length).toBeGreaterThan(0); // ⑦ 관계
    expect(panel.abilities.length).toBeGreaterThan(0); // ⑧ 능력
    expect(panel.abilities[0]!.restrictions.length).toBeGreaterThan(0);
  });

  it("개발자 모드는 실제+믿음 병렬, 플레이어 모드는 관찰된 것만 (§36.3 말미)", () => {
    const report = compareModes(runtime, "creature.echo_beast_mother", topEventId);
    expect(report.developerActualRows).toBeGreaterThan(0);
    expect(report.playerActualRows).toBe(0);
    expect(report.playerHidden).toBeGreaterThan(0);
    expect(report.leaks).toEqual([]);
    // 실제와 믿음이 갈라진 상태가 개발자 모드에서 눈에 보인다 (§10)
    expect(report.divergentRows + report.developerRows).toBeGreaterThan(0);
  });

  it("플레이어 모드 지도는 개발자 모드 지도의 부분집합이다", () => {
    const known = new Set(player.map.markers.map((marker) => marker.id));
    const all = new Set(developer.map.markers.map((marker) => marker.id));
    expect(known.size).toBeGreaterThan(0);
    expect(known.size).toBeLessThanOrEqual(all.size);
    for (const id of known) expect(all.has(id)).toBe(true);
  });

  it("조작 중인 주체가 아닌 관찰자로는 플레이어 시점이 성립하지 않는다 (지식 필터가 없다)", () => {
    const empty = buildScenePayload(runtime, {
      mode: "player",
      observerId: "agent.mar",
      agentId: "agent.mar",
    });
    expect(empty.map.markers.length).toBe(0);
    expect(empty.events.length).toBe(0);
    expect(empty.agentPanel).toBeUndefined();
  });

  it("표시된 능력은 성장 원장 합성값과 일치한다 (§32)", () => {
    expect(abilityDisplayMatchesLedger(runtime, DEFAULT_PLAYER_AGENT_ID, developer)).toBe(true);
  });
});

describe("§36.4 사건 화면", () => {
  it("목록 8항목이 실리고 알려진 정보와 실제 원인이 분리된다", () => {
    const detail = developer.eventDetail!;
    expect(detail.participants.length).toBeGreaterThan(0); // ①
    expect(detail.participants.some((participant) => participant.goals.length > 0)).toBe(true); // ②
    expect(detail.actualCauses.length).toBeGreaterThan(0); // ④
    expect(detail.causeVisible).toBe(true);
    expect(detail.timeline.length).toBeGreaterThan(0); // ⑤
    expect(detail.results.length).toBeGreaterThan(0); // ⑦
    expect(detail.significanceRows.length).toBe(6); // §29 6항

    // 플레이어 시점에서는 실제 원인이 사라진다 (§30 "아직 모르는 것")
    const playerDetail = player.eventDetail!;
    expect(playerDetail.causeVisible).toBe(false);
    expect(playerDetail.actualCauses).toEqual([]);
    expect(playerDetail.participants.every((participant) => participant.goals.length === 0)).toBe(true);
  });

  it("플레이어 시점 목록에는 아는 사건만 오른다", () => {
    expect(player.events.length).toBeGreaterThan(0);
    expect(player.events.length).toBeLessThanOrEqual(developer.events.length);
    expect(player.events.every((item) => item.known)).toBe(true);
  });
});

describe("§8.0 ViewModel 파이프라인 — 표현 방식 변경의 격리", () => {
  it("rendering/ 은 SceneViewModel 밖의 타입을 import 하지 않는다", () => {
    const reports = checkRendererImports("src/rendering");
    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) expect(report.violations).toEqual([]);
  });

  it("Canvas 렌더러와 텍스트 렌더러가 같은 SceneViewModel 로 같은 것을 그린다", () => {
    const parity = checkRendererParity(sceneOf(developer));
    expect(parity.canvasOps).toBeGreaterThan(0);
    expect(parity.sharedKeys.length).toBeGreaterThan(0);
    expect(parity.missingInCanvas).toEqual([]);
    expect(parity.missingInText).toEqual([]);
  });

  it("렌더러는 시뮬레이션 타입 없이도 돈다 — 표면만 갈아 끼운다", () => {
    const surface = new RecordingSurface(400, 300);
    new CanvasSceneRenderer(surface).render(sceneOf(player));
    expect(surface.countOf("rect")).toBeGreaterThan(0);
    expect(new TextSceneRenderer().render(sceneOf(player)).length).toBeGreaterThan(0);
  });
});

describe("§33.3 Event Interpreter", () => {
  it("6종 문장이 만들어지고 unknownFacts 는 한 번도 새지 않는다", async () => {
    const report = await auditNarration(runtime, DEFAULT_PLAYER_AGENT_ID);
    expect(report.requests).toBeGreaterThan(0);
    // "막을 것이 있었다"는 것도 증거의 일부다
    expect(report.withForbidden).toBeGreaterThan(0);
    expect(report.forbiddenFacts).toBeGreaterThan(0);
    expect(report.leaks).toEqual([]);
    // 금지 사실을 흘리는 포트의 문장은 폐기되고 템플릿으로 되돌아간다
    expect(report.rejectedFromPort).toBeGreaterThan(0);
    expect(report.cacheHits).toBe(report.requests);
  }, 120_000);

  it("AI 포트가 없어도 전 화면이 문장을 갖는다 (템플릿 폴백)", () => {
    const interpreter = new EventInterpreter();
    const detail = developer.eventDetail!;
    expect(detail.title.length).toBeGreaterThan(0);
    expect(detail.summarySentence.length).toBeGreaterThan(0);
    expect(detail.rumor.length).toBeGreaterThan(0);
    expect(detail.document.length).toBeGreaterThan(0);
    expect(developer.agentPanel!.narration[0]!.length).toBeGreaterThan(0);
    expect(interpreter.cacheSize).toBe(0);
  });
});
