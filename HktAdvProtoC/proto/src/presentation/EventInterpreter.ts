// Event Interpreter — 구조화 사건을 읽을 수 있는 문장으로 옮긴다 (기획서 §3 블록 6, §33.3 / Phase-8 §8.2)
//
// 이 파일은 **세계를 만질 수 없다.** import 목록이 그 증거다 — core/ 도 persistence/ 도 없고
// 들어오는 것은 순수 데이터(NarrationRequest)뿐이다. 대화가 계약·거래로 이어지는 것은
// 플레이어가 그 **행동**(§21)을 선택할 때 시스템 규칙이 하는 일이고, Interpreter 는 표시 문장만 낸다(§33 마지막 문단).
//
// 두 가지를 강제한다.
//  ① 정보 비대칭 : unknownFacts 는 프롬프트에 "말하면 안 되는 것"으로 실리고, 생성 결과도 같은 목록으로 검사한다.
//                  새면 그 문장은 버리고 템플릿으로 되돌린다 — 새는 문장이 화면에 오르는 경로가 없다.
//  ② AI 없이도 동작 : 포트가 없으면 템플릿 문장으로 폴백한다(§2.1 표현 계층이 없어도 시스템은 돈다).
import type {
  ForbiddenFact,
  NarrationKind,
  NarrationPort,
  NarrationRequest,
  NarrationResult,
} from "../shared/narration";

/** 캐시 키 — 같은 (사건, 시점, 관찰자, 종류) 의 문장은 다시 만들지 않는다 (§8.2) */
export function narrationCacheKey(request: NarrationRequest): string {
  const speaker = request.speaker?.id ?? "-";
  return `${request.kind}|${request.eventId}|${request.at}|${request.observerId}|${speaker}`;
}

// --- 금지 사실 검사 (§8.2 핵심 장치) --------------------------------------------------

/**
 * 문장이 흘린 금지 사실 (비어 있으면 통과).
 *
 * 판정 기준은 세 가지다.
 *  ① 금지 사실의 문장이 그대로 실렸다 (문장째 복사가 가장 흔한 누출이다)
 *  ② "대상 + 상태 키 + 값"이 한 문장 안에 함께 등장했다 — 상태 비밀의 정체가 그 세 쪽이다
 *  ③ 아직 정체를 모르는 참여자의 이름이 등장했다
 *
 * 단어 단위로 훑지 않는 이유: 사건이 벌어진 지역이나 이미 아는 참여자의 이름은
 * 관찰자가 아는 것이므로 금지어가 될 수 없다. 그것까지 막으면 "안전한 문장"이 아니라 빈 문장이 된다.
 * 같은 이유로 ②는 **한 절(clause) 안에서** 셋이 모였는지를 본다 — 아는 참여자 이름과 다른 사실의 수치가
 * 서로 다른 절에서 우연히 만나는 것은 누출이 아니다.
 */
export function findLeaks(text: string, unknownFacts: ForbiddenFact[]): string[] {
  const lower = text.toLowerCase();
  const clauses = lower.split(/[.,·|\n"]+/).filter((clause) => clause.trim().length > 0);
  const has = (value: string | undefined): boolean =>
    value !== undefined && value.length > 0 && lower.includes(value.toLowerCase());
  const together = (fact: ForbiddenFact): boolean => {
    if (fact.stateKey === undefined || fact.value === undefined) return false;
    const parts = [fact.subjectLabel, fact.stateKey, fact.value].filter(
      (part): part is string => part !== undefined && part.length > 0,
    );
    return clauses.some((clause) => parts.every((part) => clause.includes(part.toLowerCase())));
  };

  const leaks: string[] = [];
  for (const fact of unknownFacts) {
    if (has(fact.sentence)) {
      leaks.push(fact.sentence);
      continue;
    }
    if (fact.identityLabel !== undefined && has(fact.identityLabel)) {
      leaks.push(`정체 ${fact.identityLabel}`);
      continue;
    }
    if (together(fact)) {
      leaks.push(`${fact.subjectLabel ?? ""}.${fact.stateKey ?? ""}=${fact.value ?? ""}`);
    }
  }
  return leaks;
}

// --- 템플릿 폴백 (§8.2) ---------------------------------------------------------------
// 태그·수치 치환만 한다. 여기서도 unknownFacts 는 **입력으로 쓰이지 않는다** — 새는 경로가 애초에 없다.

function metric(request: NarrationRequest, key: string): string | undefined {
  return request.metrics.find((entry) => entry.key === key)?.value;
}

function joinFacts(facts: string[], limit: number): string {
  if (facts.length === 0) return "아직 아는 것이 없다";
  const shown = facts.slice(0, limit).join(" · ");
  return facts.length > limit ? `${shown} (외 ${facts.length - limit}건)` : shown;
}

function participantPhrase(request: NarrationRequest): string {
  const labels = request.participantLabels;
  if (labels.length === 0) return "누군가";
  if (labels.length === 1) return labels[0] ?? "누군가";
  if (labels.length === 2) return `${labels[0]}와 ${labels[1]}`;
  return `${labels[0]} 외 ${labels.length - 1}명`;
}

const TYPE_PHRASE: Record<string, string> = {
  ecological_conflict: "생태 충돌",
  resource_conflict: "자원 다툼",
  information_spread: "소문의 확산",
  faction_pressure: "조직의 압박",
  ability_manifestation: "능력의 발현",
  social_rupture: "관계의 파열",
};

function typePhrase(type: string): string {
  return TYPE_PHRASE[type] ?? type.replace(/_/g, " ");
}

function templateFor(request: NarrationRequest): string {
  const who = participantPhrase(request);
  const where = request.locationLabel;
  const significance = metric(request, "significance") ?? "0";
  const speaker = request.speaker;

  switch (request.kind) {
    case "event_title":
      return `${where}의 ${typePhrase(request.eventType)} — ${who}`;
    case "event_summary":
      return (
        `${where}에서 ${typePhrase(request.eventType)}이 일어났다(중요도 ${significance}). ` +
        `${who}가 얽혔고, 바뀐 상태는 ${metric(request, "netChangedStates") ?? "0"}종이다.`
      );
    case "observation":
      return `${where} — ${joinFacts(request.knownFacts, 3)}. 그 밖의 것은 보이지 않는다.`;
    case "rumor":
      return `"${where}에서 ${typePhrase(request.eventType)}이 있었다더군. ${joinFacts(request.knownFacts, 2)}." — 출처는 분명하지 않다`;
    case "document":
      return (
        `[기록] ${request.at}시점 ${where}. 종류: ${typePhrase(request.eventType)}. ` +
        `참여: ${request.participantLabels.join(", ") || "미상"}. 확인된 사실: ${joinFacts(request.knownFacts, 4)}.`
      );
    case "dialogue":
      if (speaker === undefined) {
        return `"${joinFacts(request.knownFacts, 2)}" — 말하는 이를 알 수 없다`;
      }
      return (
        `${speaker.name}: "${joinFacts(request.knownFacts, 2)}. ` +
        `${speaker.currentGoal.length > 0 ? `나는 ${speaker.currentGoal}를 해야 한다.` : ""} ` +
        `${request.conversationPurpose ?? ""}"`
      ).replace(/\s+/g, " ");
  }
}

// --- 프롬프트 (§33 구조화 입력만) ------------------------------------------------------

const KIND_INSTRUCTION: Record<NarrationKind, string> = {
  event_title: "사건의 제목을 한 줄로 만든다. 20자 이내.",
  dialogue: "화자가 관찰자에게 건네는 한 마디를 만든다. 화자의 가치관·두려움·목적이 드러나야 한다.",
  rumor: "떠도는 소문 한 줄을 만든다. 출처가 흐릿하고 과장이 섞인다.",
  document: "기록 문서의 한 단락을 만든다. 확인된 사실만 적는다.",
  observation: "관찰자가 지금 본 것을 묘사한다. 보이지 않는 것은 묘사하지 않는다.",
  event_summary: "사건의 경과를 두세 문장으로 요약한다.",
};

/** 생성 호출에 실리는 구조화 입력 (§33.3 예시 JSON 형식) — 월드 상태는 절대 실리지 않는다 */
export function buildNarrationPrompt(request: NarrationRequest): {
  instruction: string;
  input: Record<string, unknown>;
} {
  return {
    instruction:
      `${KIND_INSTRUCTION[request.kind]}\n` +
      `knownFacts 안의 내용만 사용한다. forbidden 에 있는 것은 **어떤 방식으로도 언급하지 않는다** ` +
      `(암시·부정문·추측 포함) — 관찰자는 그것을 모른다.`,
    input: {
      kind: request.kind,
      eventType: request.eventType,
      location: request.locationLabel,
      participants: request.participantLabels,
      ...(request.speaker === undefined ? {} : { speaker: request.speaker }),
      knownFacts: request.knownFacts,
      /** 프롬프트에 "말하면 안 되는 것"으로 명시된다 (§8.2) */
      forbidden: request.unknownFacts.map((fact) => fact.sentence),
      ...(request.conversationPurpose === undefined
        ? {}
        : { conversationPurpose: request.conversationPurpose }),
      metrics: request.metrics,
      tags: request.tags,
    },
  };
}

// --- Interpreter ----------------------------------------------------------------------

export class EventInterpreter {
  private readonly cache = new Map<string, NarrationResult>();
  /** 생성 문장이 금지 사실을 흘려 폐기된 횟수 — 보고용 관측점 */
  private rejected = 0;

  constructor(private readonly port?: NarrationPort) {}

  get cacheSize(): number {
    return this.cache.size;
  }

  get rejectedCount(): number {
    return this.rejected;
  }

  clear(): void {
    this.cache.clear();
    this.rejected = 0;
  }

  /** 포트 없이 즉시 만드는 문장 — 전 화면의 기본 경로다(§8.2 폴백) */
  interpret(request: NarrationRequest): NarrationResult {
    const key = narrationCacheKey(request);
    const cached = this.cache.get(key);
    if (cached !== undefined) return { ...cached, fromCache: true };
    const result: NarrationResult = {
      kind: request.kind,
      text: templateFor(request).trim(),
      source: "template",
      fromCache: false,
    };
    this.cache.set(key, result);
    return result;
  }

  /**
   * 포트가 있으면 생성 문장을, 없거나 누출이 있으면 템플릿을 돌려준다.
   * **누출 검사를 통과하지 못한 문장은 캐시에도 남지 않는다** — 다음 호출에서 다시 시도되거나 템플릿으로 간다.
   */
  async interpretWithPort(request: NarrationRequest): Promise<NarrationResult> {
    const key = narrationCacheKey(request);
    const cached = this.cache.get(key);
    if (cached !== undefined) return { ...cached, fromCache: true };
    if (this.port === undefined) return this.interpret(request);

    const forbidden = request.unknownFacts;
    let text: string;
    try {
      text = await this.port.narrate(request, forbidden);
    } catch {
      return this.interpret(request);
    }
    const leaks = findLeaks(text, forbidden);
    if (leaks.length > 0) {
      this.rejected += 1;
      const fallback = this.interpret(request);
      return { ...fallback, rejectedLeaks: leaks };
    }
    const result: NarrationResult = {
      kind: request.kind,
      text: text.trim(),
      source: "generated",
      fromCache: false,
    };
    this.cache.set(key, result);
    return result;
  }
}
