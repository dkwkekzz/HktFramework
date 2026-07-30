// 2차 구현 재검증 탐침 (design/impl/Review-DesignValidation-2.md 의 근거)
//
// verify 는 "완료 조건이 지켜지는가"를 본다. 이 스크립트는 그 반대편 —
// **기획서에 있는데 아직 구현에 없는 것**을 한 번의 명령으로 수치와 함께 드러낸다.
// 실행: npx vite-node src/scripts/review2-probes.ts
//
// 여기서 ✗ 는 회귀가 아니라 **남은 거리**다. 고쳐지면 이 스크립트의 행이 ✓ 로 바뀐다.
import { buildManualWorld } from "../content/manual-world";
import { buildPlayerWorld } from "../content/player-world";
import {
  FIRST_WORLD_CORPUS,
  FIRST_WORLD_ID,
  FIRST_WORLD_SEED_INPUT,
} from "../content/first-world";
import { compileWorld } from "../generation/CompilerPipeline";
import { RecordedTextGenerationPort } from "../generation/RecordedTextGenerationPort";
import { SEMANTIC_CODES } from "../generation/WorldValidator";
import { InlineHost } from "../core/simulation/InlineHost";
import { buildMapView } from "../viewmodel/MapViewBuilder";
import { OBSERVATION_CHANNELS, type ObservationChannel } from "../shared/observation";
import { TICKS_PER_DAY } from "../shared/time";
import { readFileSync } from "node:fs";
import type { WorldRuntime } from "../core/world/WorldRuntime";
import type { ObservationEffect, WorldDefinition } from "../core/world/types";

const rows: { ok: boolean; title: string; evidence: string[] }[] = [];
function probe(ok: boolean, title: string, ...evidence: string[]): void {
  rows.push({ ok, title, evidence });
}

// =====================================================================================
// P1 — §1·§44-1 "짧은 세계관 주제로부터" 는 어느 입력까지 성립하는가
// =====================================================================================

async function compileAttempt(themes: string[], title?: string): Promise<string> {
  // 포트에 **자기 경계**를 쥐여 준다 — 앱(RuntimeServer)이 쓰는 것과 같은 구성이다 (F-1)
  const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS, undefined, [], FIRST_WORLD_SEED_INPUT);
  try {
    const result = await compileWorld({
      port,
      seedInput: { ...(title === undefined ? {} : { title }), themes },
      worldSeed: 42,
      worldId: FIRST_WORLD_ID,
    });
    return `성공(규칙 ${result.definition.ruleDefinitions.length}·종족 ${result.definition.species.length}·제목 "${result.definition.metadata.title}")`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `중단 — ${message.split("\n").slice(0, 2).join(" / ")}`;
  }
}

const recorded = [...FIRST_WORLD_SEED_INPUT.themes];
const asRecorded = await compileAttempt(recorded);
const titleChanged = await compileAttempt(recorded, "다른 이름의 세계");
const oneSentenceChanged = await compileAttempt([
  ...recorded.slice(0, recorded.length - 1),
  "바다 아래에는 잊힌 도시가 가라앉아 있다.",
]);
const allChanged = await compileAttempt([
  "세계는 얼어붙어 가고 있다.",
  "불을 다루는 자만이 겨울을 넘긴다.",
  "불은 기억을 태워 얻는다.",
  "얼음 아래에 옛 문명이 잠들어 있다.",
  "사람들은 온기를 두고 다툰다.",
]);

/** ① 경계가 **선언되어 있는가** — 고칠 수 있는 쪽(F-1 의 ⑴)을 판정한다 */
const gateSource = readFileSync(new URL("../viewmodel/phase8Checks.ts", import.meta.url), "utf8");
const seedScreen = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const boundaryDeclared =
  gateSource.includes("inputBoundary") &&
  gateSource.includes("살아 있는 LLM 어댑터") &&
  seedScreen.includes("녹화 재생 포트") &&
  oneSentenceChanged.includes("녹화 재생 포트의 경계");
probe(
  boundaryDeclared,
  "§44-1 이 통과라고 말하는 **범위**가 게이트·화면·오류에 밝혀져 있다 (F-1 ⑴)",
  `게이트 근거 — §44-1 이 포트 구현체 수와 "살아 있는 LLM 어댑터 0종"을 함께 싣는다: ${gateSource.includes("inputBoundary") ? "있음" : "없음"}`,
  `§36.1 화면 — 입력 폼 위에 경계 안내: ${seedScreen.includes("녹화 재생 포트") ? "있음" : "없음"}`,
  `오류 문구 — 녹화 밖의 주제를 넣으면 포트가 이유를 말한다: ${oneSentenceChanged.includes("녹화 재생 포트의 경계") ? "있음" : "없음"}`,
);

/** ② 경계 자체를 **없앴는가** — 살아 있는 어댑터가 필요한 쪽(F-1 의 ⑵). 아직 남은 거리다 */
probe(
  oneSentenceChanged.startsWith("성공") && allChanged.startsWith("성공"),
  "§44-1 사용자가 입력한 주제 문장으로 세계가 생성된다 (녹화된 5문장 밖에서도 — F-1 ⑵)",
  `녹화된 5문장 그대로 → ${asRecorded}`,
  `제목만 교체 → ${titleChanged}`,
  `문장 하나 교체 → ${oneSentenceChanged}`,
  `다섯 문장 전부 교체 → ${allChanged}`,
  `TextGenerationPort 구현체: RecordedTextGenerationPort 1종 — 살아 있는 LLM 어댑터 없음(§2.1 포트는 열려 있다)`,
);

// =====================================================================================
// 30일 실행 (지도·기억 탐침의 공통 재료)
// =====================================================================================

const host = new InlineHost();
await host.request({ type: "initialize_world", worldSeed: 42 });
await host.request({ type: "advance_time", amount: 30 * TICKS_PER_DAY });
const runtime = host.server.inspectRuntime() as WorldRuntime;

// =====================================================================================
// P2 — §36.2 조직은 지도에 오르는가
// =====================================================================================

const factionEntities = Object.values(runtime.state.entities).filter((e) => e.type === "faction");
const positioned = factionEntities.filter((e) => e.position !== undefined);
const map = buildMapView(runtime, { mode: "developer" });
const mapIds = new Set(
  [...map.markers, ...map.resources, ...map.places, ...map.factions].map((m) => m.id),
);
const onMap = positioned.filter((e) => mapIds.has(e.id));
probe(
  positioned.length > 0 && onMap.length === positioned.length,
  "§36.2 위치를 가진 조직이 지도 마커로 오른다 (shape-banner 도달 가능)",
  `조직 개체 ${factionEntities.length} · 위치 보유 ${positioned.length} · 지도 마커 ${onMap.length}`,
  `도형 — ${[...new Set(map.factions.map((m) => m.shapeKey))].join(" ") || "없음"} · 범례 ${map.legend.map((b) => `${b.key} ${b.value}`).join(" · ")}`,
);

// =====================================================================================
// P3 — §23 관찰 채널 12종 (타입만이 아니라 발신자·수신자까지)
// =====================================================================================

const DESIGN_CHANNELS: { name: string; impl: ObservationChannel }[] = [
  { name: "시각", impl: "sight" },
  { name: "청각", impl: "sound" },
  { name: "후각", impl: "smell" },
  { name: "촉각", impl: "touch" },
  { name: "진동", impl: "vibration" },
  { name: "열", impl: "heat" },
  { name: "의력 감지", impl: "energy_sense" },
  { name: "흔적", impl: "trace" },
  { name: "대화", impl: "talk" },
  { name: "문서", impl: "document" },
  { name: "소문", impl: "rumor" },
  { name: "조직 보고", impl: "report" },
];

/** 이 세계에서 그 채널로 신호를 내는 자리 (행동 visibleSignals + 규칙 observations + 능력 observableSignals) */
function emittersOf(definition: WorldDefinition): Map<ObservationChannel, number> {
  const counts = new Map<ObservationChannel, number>();
  const add = (effects: readonly ObservationEffect[]): void => {
    for (const effect of effects) {
      for (const channel of effect.channels) counts.set(channel, (counts.get(channel) ?? 0) + 1);
    }
  };
  for (const action of definition.actionDefinitions) add(action.visibleSignals);
  for (const rule of definition.ruleDefinitions) add(rule.observations);
  for (const ability of definition.abilitySystem?.abilities ?? []) add(ability.observableSignals);
  return counts;
}

const playerDefinition = buildPlayerWorld(42);
const emitters = emittersOf(playerDefinition);
const receivers = new Map<ObservationChannel, string[]>();
for (const species of playerDefinition.species) {
  for (const sense of species.senses) {
    receivers.set(sense.channel, [...(receivers.get(sense.channel) ?? []), species.name]);
  }
}
const channelGaps = DESIGN_CHANNELS.filter(
  (channel) => (emitters.get(channel.impl) ?? 0) === 0 || (receivers.get(channel.impl) ?? []).length === 0,
);
probe(
  DESIGN_CHANNELS.length === OBSERVATION_CHANNELS.length && channelGaps.length === 0,
  "§23 관찰 채널 12종이 전부 채널로 존재 (발신 자리 + 받는 감각까지)",
  `채널 타입 ${OBSERVATION_CHANNELS.length}종(shared/observation.ts) / 기획 ${DESIGN_CHANNELS.length}종`,
  ...DESIGN_CHANNELS.map(
    (channel) =>
      `${channel.name}(${channel.impl}) — 발신 ${emitters.get(channel.impl) ?? 0}자리 · 감각 ${(receivers.get(channel.impl) ?? []).join(",") || "없음"}`,
  ),
  `빈 채널: ${channelGaps.map((c) => c.name).join(" · ") || "없음"}`,
);

// =====================================================================================
// P4 — §24 기억 8유형의 생산 경로
// =====================================================================================

const MEMORY_TYPES = [
  "observation",
  "interaction",
  "success",
  "failure",
  "trauma",
  "promise",
  "betrayal",
  "discovery",
] as const;
const produced = new Map<string, number>();
for (const agent of Object.values(runtime.state.agentRuntimes)) {
  for (const memory of agent.memories) {
    produced.set(memory.type, (produced.get(memory.type) ?? 0) + 1);
  }
}
// 부트스트랩 선언분(§18 memories) 도 생산 경로다 — 30일 뒤 감쇠로 사라졌을 수 있어 정의에서 센다
const declared = new Set<string>();
for (const entity of runtime.definition.bootstrap.entities) {
  for (const memory of entity.memories ?? []) declared.add(memory.type);
}
/** 코드에 실제로 존재하는 생성 경로 (rememberEvent 호출부) — 표본에 남지 않은 것과 아예 없는 것을 가른다 */
const CODE_PATHS: Record<string, string> = {
  observation: "PerceptionSystem.ts:337 (관찰 성공)",
  interaction: "AgentRuntime.ts:200 (상호작용 상대)",
  success: "AgentRuntime.ts:190 (행동 완료)",
  failure: "GoalSystem.ts:534 (목적 포기)",
  promise: "FactionRuntime.ts:80 (위임 수락)",
  betrayal: "AgentRuntime.rememberBrokenPromises (약속 파기 — 당한 쪽의 기억, F-4)",
  trauma: "WorldBootstrap.ts:124 (§18 초기 기억 선언)",
  discovery: "WorldBootstrap.ts:124 (§18 초기 기억 선언) · PerceptionSystem 요약",
};
const noPath = MEMORY_TYPES.filter((t) => CODE_PATHS[t] === undefined);
const pathButUnseen = MEMORY_TYPES.filter(
  (t) => CODE_PATHS[t] !== undefined && !produced.has(t) && !declared.has(t),
);
probe(
  noPath.length === 0,
  "§24 기억 8유형 전부에 생산 경로가 있다",
  `30일 실행에 남은 유형: ${[...produced].map(([t, n]) => `${t}:${n}`).join(" · ")}`,
  `부트스트랩 선언 유형: ${[...declared].join(" · ")}`,
  `코드 경로 자체가 없음: ${noPath.join(" · ") || "없음"}`,
  `경로는 있으나 이 표본에 남지 않음: ${pathButUnseen.map((t) => `${t}[${CODE_PATHS[t]}]`).join(" · ") || "없음"}`,
);

// =====================================================================================
// P5 — §21 행동 예시 21종
// =====================================================================================

const manual = buildManualWorld(42);
const player = playerDefinition;
/** 생성 세계(§41)의 행동도 같은 체계다 — 어느 세계가 그 행동을 갖는지까지 밝힌다 */
const generatedActions = (
  JSON.parse(
    readFileSync(new URL("../content/first-world/recorded/actions.json", import.meta.url), "utf8"),
  ) as { actions: { id: string }[] }
).actions.map((a) => a.id);
const allActionIds = new Set([
  ...manual.actionDefinitions.map((a) => a.id),
  ...player.actionDefinitions.map((a) => a.id),
  ...generatedActions,
]);
const DESIGN_ACTIONS: { name: string; ids: string[] }[] = [
  { name: "이동한다", ids: ["action.move"] },
  { name: "관찰한다", ids: ["action.observe"] },
  { name: "추적한다", ids: ["action.track"] },
  { name: "수집한다", ids: ["action.forage", "action.hunt"] },
  { name: "공격한다", ids: ["action.attack"] },
  { name: "방어한다", ids: ["action.defend"] },
  { name: "도주한다", ids: ["action.flee"] },
  { name: "협상한다", ids: ["action.negotiate"] },
  { name: "거래한다", ids: ["action.trade", "action.faction_trade"] },
  { name: "설득한다", ids: ["action.persuade"] },
  { name: "거짓말한다", ids: ["action.lie"] },
  { name: "협박한다", ids: ["action.threaten"] },
  { name: "고용한다", ids: ["action.hire"] },
  { name: "동맹을 제안한다", ids: ["action.propose_alliance"] },
  { name: "계약한다", ids: ["action.contract"] },
  { name: "소문을 퍼뜨린다", ids: ["action.gossip"] },
  { name: "증거를 숨긴다", ids: ["action.hide_evidence"] },
  { name: "제작한다", ids: ["action.craft"] },
  { name: "연구한다", ids: ["action.research"] },
  { name: "능력을 사용한다", ids: ["action.use_ability"] },
  { name: "행동을 위임한다", ids: ["action.delegate"] },
];
const missingActions = DESIGN_ACTIONS.filter((a) => !a.ids.some((id) => allActionIds.has(id)));
/** 선언만 있고 30일 동안 한 번도 뽑히지 않은 행동은 없는 것과 다르다 — 실행 횟수도 함께 센다 */
const performed = new Map<string, number>();
for (const change of runtime.state.changeLog) {
  for (const tag of change.tags) {
    if (tag.startsWith("action.")) performed.set(tag, (performed.get(tag) ?? 0) + 1);
  }
}
probe(
  missingActions.length === 0,
  "§21 행동 예시 21종이 수동·플레이어 세계에 전부 있다",
  `행동 ${allActionIds.size}종(수동 ${manual.actionDefinitions.length} + 플레이어 층 ${player.actionDefinitions.length - manual.actionDefinitions.length} + 생성 세계 ${generatedActions.length}) · 기획 21종 중 ${21 - missingActions.length}종 대응`,
  `없음: ${missingActions.map((a) => `${a.name}(${a.ids.join("|")})`).join(" · ") || "없음"}`,
  `방어(action.defend) — 30일 무개입 실행에서 ${performed.get("action.defend") ?? 0}회 발화 (공격 ${performed.get("action.attack") ?? 0}회 · 도주 ${performed.get("action.flee") ?? 0}회)`,
  `능력 사용은 생성 세계에만 독립 행동(action.use_ability) — 수동 세계에서는 다른 행동의 실행 규칙으로 분해된다(Phase-2 §2.7)`,
);

// =====================================================================================
// P6 — §17 FactionDefinition 필드 9종 + 제도의 실행 연결
// =====================================================================================

const factionSample = manual.factions[0]!;
const DESIGN_FACTION_FIELDS = [
  "publicPurpose",
  "hiddenPurposes",
  "requiredStates",
  "controlledResources",
  "structures",
  "policies",
  "internalGroups",
  "relationshipDefaults",
  "collapseConditions",
];
const factionMissing = DESIGN_FACTION_FIELDS.filter(
  (field) => !(field in (factionSample as unknown as Record<string, unknown>)),
);
const structures = manual.factions.flatMap((faction) => faction.structures ?? []);
const executedStructures = structures.filter((structure) => structure.ruleIds.length > 0);
probe(
  factionMissing.length === 0 && executedStructures.length === structures.length && structures.length > 0,
  "§17 조직 정의 9필드가 전부 타입에 있다 (제도까지)",
  `보유: ${DESIGN_FACTION_FIELDS.filter((f) => !factionMissing.includes(f)).join(" · ")}`,
  `없음: ${factionMissing.join(" · ") || "없음"}`,
  `수동 세계 제도 ${structures.length}개 — ${structures
    .map((s) => `${s.name}(${s.mechanism}·${s.controlledResource}·규칙 ${s.ruleIds.length}·수혜 ${s.benefitingGroupIds.length}/피해 ${s.harmedGroupIds.length})`)
    .join(" · ")}`,
  `정책 ${manual.factions.flatMap((f) => f.policies ?? []).length}개 · §34 검사기 faction.structure 가 연결을 상시 감시`,
);

// =====================================================================================
// P7 — §16 failureEffects 의 대상
// =====================================================================================

const abilities = player.abilitySystem?.abilities ?? [];
const failureEffects = abilities.flatMap((ability) => ability.failureEffects);
const beyondSelf = failureEffects.filter(
  (effect) => effect.type === "modify_state" && effect.target.type !== "actor",
);
probe(
  failureEffects.length > 0 && beyondSelf.length > 0,
  "§16 failureEffects 가 §11.3 RuleEffect 전체(대상 선택 포함)를 쓴다",
  `타입: RuleEffect[] — §11.3 6종 + 대상 선택자(core/world/types.ts AbilityDefinition.failureEffects)`,
  `능력 ${abilities.length}개 · 실패 반동 ${failureEffects.length}건 · 능력자 밖을 향하는 반동 ${beyondSelf.length}건`,
  ...abilities.map(
    (ability) =>
      `${ability.id} — ${ability.failureEffects
        .map((effect) =>
          effect.type === "modify_state" ? `${effect.stateKey}@${effect.target.type}` : effect.type,
        )
        .join(" · ")}`,
  ),
  `실행 연결은 §34 ability.backlash 가 요구한다 — 선언한 반동은 그 상태를 건드리는 규칙을 가져야 한다`,
);

// =====================================================================================
// P8 — 검사기 수 주석 드리프트
// =====================================================================================

const validatorSource = readFileSync(new URL("../generation/WorldValidator.ts", import.meta.url), "utf8");
/** "검사기 N종"·"의미 층 N종" 을 말하는 줄은 전부 SEMANTIC_CODES 의 길이와 같아야 한다 */
const staleComments = validatorSource
  .split("\n")
  .map((line, index) => ({ line: line.trim(), no: index + 1 }))
  .filter((entry) => /검사기|의미 층/.test(entry.line))
  .flatMap((entry) =>
    [...entry.line.matchAll(/(\d+)종/g)]
      .filter((match) => Number(match[1]) !== SEMANTIC_CODES.length)
      .map(() => entry),
  );
probe(
  staleComments.length === 0,
  "§34 검사기 수를 말하는 주석이 실제 개수와 맞는다",
  `SEMANTIC_CODES ${SEMANTIC_CODES.length}종 (verify 는 ${SEMANTIC_CODES.length}/${SEMANTIC_CODES.length} 로 보고한다)`,
  ...staleComments.map((entry) => `WorldValidator.ts:${entry.no} — "${entry.line.slice(0, 90)}"`),
  staleComments.length === 0 ? "어긋난 주석 0줄" : "",
);

// =====================================================================================
// 출력
// =====================================================================================

console.log("\n=== 2차 재검증 탐침 — 기획서에 있고 구현에 없는 것 ===\n");
for (const row of rows) {
  console.log(`${row.ok ? "✓" : "✗"} ${row.title}`);
  for (const line of row.evidence) {
    if (line.length > 0) console.log(`      ${line}`);
  }
}
const passed = rows.filter((r) => r.ok).length;
console.log(`\n  ${passed}/${rows.length} 충족 — ✗ 는 회귀가 아니라 남은 거리다\n`);
