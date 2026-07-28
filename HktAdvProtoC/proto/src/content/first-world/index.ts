// §41 첫 번째 세계 — 사용자 입력과 녹화된 생성 응답
//
// `recorded/` 의 JSON 은 "생성 AI 가 이 입력에 대해 내놓은 응답"을 그대로 담은 코퍼스다(Phase-5 스텝 1).
// 오프라인 목 포트가 이것을 재생하므로 테스트·verify 는 AI 없이 항상 같은 세계를 만든다.
//
// 코퍼스의 출처를 숨기지 않는다: 규칙·목적·행동·사건 패턴의 상당 부분은 Phase 1~4 가 손으로 쓴 데이터
// 그대로다. 그것이 이 트랙의 역전 관계다 — "Phase 1~4 가 만든 실행 가능한 데이터 포맷이 Phase 5 생성기의
// 출력 스키마가 된다"(구현 분해 README). 나머지(새 지역·종족·조직·능력·인물)는 §40 규모를 채우기 위해
// 같은 포맷으로 이어 쓴 것이다.
import type { RecordedCorpus } from "../../generation/RecordedTextGenerationPort";
import type { WorldSeedInput } from "../../generation/GenerationTypes";
import abilities from "./recorded/abilities.json";
import actions from "./recorded/actions.json";
import agents from "./recorded/agents.json";
import bootstrap from "./recorded/bootstrap.json";
import eventPatterns from "./recorded/event-patterns.json";
import factions from "./recorded/factions.json";
import goals from "./recorded/goals.json";
import rules from "./recorded/rules.json";
import spaceResources from "./recorded/space-resources.json";
import species from "./recorded/species.json";
import steps14 from "./recorded/steps-1-4.json";

export const FIRST_WORLD_ID = "world.constraint_continent";

/** §41 초기 입력 — 다섯 문장이 전부다 (§4 WorldSeedInput) */
export const FIRST_WORLD_SEED_INPUT: WorldSeedInput = {
  title: "제약의 대륙",
  themes: [
    "모든 생명은 자신이 중요하게 여기는 존재를 지속시키려 한다.",
    "인간은 자신의 욕망에 명확한 제약을 걸어 초월적인 능력을 사용할 수 있다.",
    "강한 제약은 강한 능력을 만들지만, 제약을 어기면 심각한 반동을 받는다.",
    "문명 밖에는 능력의 흔적을 흡수해 적응하는 생물들이 존재한다.",
    "위험한 지역에서만 능력을 성장시킬 희귀 자원을 얻을 수 있다.",
  ],
  desiredExperiences: [
    "알 수 없는 생물과 환경을 탐험한다.",
    "상대 능력의 조건을 추론한다.",
    "다양한 조직과 인물의 이해관계에 개입한다.",
    "선택에 따라 새로운 성장 가능성을 발견한다.",
  ],
  prohibitedElements: [
    "NPC 머리 위에 고정 퀘스트 표시",
    "고정 레벨에 따른 지역 순차 진행",
    "아무 이유 없이 배치된 몬스터",
  ],
};

/** taskId → 녹화된 응답 */
export const FIRST_WORLD_CORPUS: RecordedCorpus = {
  ...(steps14 as unknown as RecordedCorpus),
  ...(rules as unknown as RecordedCorpus),
  ...(spaceResources as unknown as RecordedCorpus),
  ...(species as unknown as RecordedCorpus),
  ...(factions as unknown as RecordedCorpus),
  ...(abilities as unknown as RecordedCorpus),
  ...(goals as unknown as RecordedCorpus),
  ...(actions as unknown as RecordedCorpus),
  ...(eventPatterns as unknown as RecordedCorpus),
  ...(agents as unknown as RecordedCorpus),
  ...(bootstrap as unknown as RecordedCorpus),
};
