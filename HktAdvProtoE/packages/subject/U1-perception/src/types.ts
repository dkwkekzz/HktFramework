import type { EntityId } from '@hkt/k0-entity-state';

/**
 * U1 의 계약 타입.
 *
 * 원문 「11」 U1 의 파이프라인은 세 마디다.
 *
 * ```text
 * WorldEvent
 *     ↓
 * Phenomenon
 *     ↓ 센서별 필터
 * PerceivedPhenomenon
 * ```
 *
 * `Phenomenon` 은 세계 설계 원본 10장의 인터페이스를 **한 칸도 늘리거나 줄이지 않고** 옮긴 것이다
 * (원문 「23」 상위 계약 변경 금지). `PerceivedPhenomenon` 은 원본이 이름만 부르고 형태를 정하지
 * 않았으므로 U1 이 정의하며, 그 자리는 "무엇이 어느 감각으로 얼마나 닿았는가"다.
 */

/** 원본 10장 `Phenomenon.channels` 의 여덟 갈래. */
export const PERCEPTION_CHANNELS = [
  'visual',
  'audio',
  'smell',
  'touch',
  'aura',
  'report',
  'rumor',
  'memory',
] as const;

export type PerceptionChannel = (typeof PERCEPTION_CHANNELS)[number];

/**
 * 원문 「11」 U1 의 「포함」 일곱 항목.
 *
 * 원본의 여덟 갈래 중 `memory` 만 빠진다 — 기억은 지각이 아니라 U3 의 것이다.
 */
export const U1_CHANNELS: readonly PerceptionChannel[] = [
  'visual',
  'audio',
  'smell',
  'touch',
  'aura',
  'report',
  'rumor',
];

/**
 * 앞선 모듈이 다른 이름으로 부른 채널을 원본 10장의 이름으로 옮긴다.
 *
 * S1 의 자연 법칙은 `sight` · `sound` 로 흔적을 남기는데, 원본 10장 `Phenomenon.channels` 의
 * 이름은 `visual` · `audio` 다. 어느 쪽도 틀리지 않았지만 **같은 사실을 두 이름으로 부르면**
 * 지각이 조용히 새어 나간다 — `sight` 를 모르는 필터는 늑대의 사냥을 아무도 못 보게 만든다.
 *
 * S1 을 고치는 것은 남의 모듈을 고치는 일이므로(원문 「23」) 하지 않는다. 정본은 원본 10장이고,
 * 옮기는 일은 그 이름을 쓰는 쪽인 U1 이 한다. 이 표에 없는 이름은 **버리지 않고**
 * `E_UNKNOWN_CHANNEL` 로 남긴다 — 조용히 사라지는 채널이 없어야 한다.
 */
export const CHANNEL_ALIASES: Readonly<Record<string, PerceptionChannel>> = {
  sight: 'visual',
  visual: 'visual',
  sound: 'audio',
  audio: 'audio',
  smell: 'smell',
  scent: 'smell',
  touch: 'touch',
  aura: 'aura',
  report: 'report',
  rumor: 'rumor',
  memory: 'memory',
};

/** 주체의 감각 문턱을 담는 K0 컴포넌트. 채널이 없으면 그 감각이 없는 주체다. */
export const SENSES_COMPONENT = 'senses';

/** 의념을 느끼려면 있어야 하는 능력 (U0 의 `cap_` 태그로 확인한다). */
export const AURA_CAPABILITY = 'sense_aura';

/**
 * 현상 하나 — **원본 10장 그대로.**
 *
 * 칸을 더하고 싶은 유혹이 계속 생긴다(예컨대 "누가 보았는가"). 그것은 `PerceivedPhenomenon`
 * 쪽의 일이다. 현상은 아직 누구의 것도 아니며, 세계에 일어난 일의 자국일 뿐이다.
 */
export interface Phenomenon {
  id: string;
  sourceEntityId?: EntityId;
  sourceSubjectId?: EntityId;
  tags: string[];
  channels: PerceptionChannel[];
  /** 채널 이름 → 원본 세기. 거리도 벽도 아직 반영되지 않은 값이다. */
  measurements: Record<string, number>;
  location?: [number, number, number];
  occurredAtTick: number;
  /** 이 현상을 남긴 사건들 — 현상의 증거는 그것을 일으킨 사건이다 */
  evidenceIds: string[];
}

/**
 * 채널 하나가 세계를 어떻게 건너오는가 — **콘텐츠 데이터**다.
 *
 * 소리가 벽을 넘고 시선이 벽에 끊기는 것은 세계의 성질이지 계산기의 성질이 아니다.
 * `if (channel === 'visual') return 0` 으로 적으면 세계마다 코드를 고쳐야 한다.
 */
export interface ChannelSpec {
  id: PerceptionChannel;
  title: string;
  /** 거리 감쇠. 세기 = 원본 / (1 + falloff × 거리) */
  falloff: number;
  /** 이 거리를 넘으면 아예 닿지 않는다 (m) */
  maxDistance: number;
  /**
   * 막는 것을 만나면 어떻게 되는가.
   *
   * `cut` 은 끊긴다 — 벽 하나면 아무것도 보이지 않는다.
   * `damped` 는 줄어든다 — 벽 하나마다 `dampPerBlocker` 를 곱한다.
   */
  onBlocked: 'cut' | 'damped';
  /** `damped` 일 때 막는 것 하나마다 곱하는 비율 */
  dampPerBlocker: number;
  /** 이 채널을 쓰려면 있어야 하는 능력 (U0 의 능력 id). 없으면 누구나 쓴다 */
  requiredCapability?: string;
  /** 공간이 아니라 사람을 거쳐 오는 채널인가 (`report` · `rumor`) */
  carriedByPeople: boolean;
}

/**
 * 현상 사전 — 어떤 일이 어느 감각에 얼마나 크게 남는가.
 *
 * K2 의 `PhenomenonSpec` 은 이름과 채널만 들고 있고 **세기가 없다.** 그것이 맞다 — 규칙은
 * "무엇이 일어났는가"를 적는 자리이고, 그 일이 얼마나 크게 들리는가는 세계가 정할 값이다.
 * 사전에 없는 현상은 지어내지 않고 `E_UNKNOWN_PHENOMENON` 으로 남긴다.
 */
export interface PhenomenonSpec {
  id: string;
  title: string;
  /** 채널 → 원본 세기 */
  measurements: Partial<Record<PerceptionChannel, number>>;
  tags?: string[];
}

/**
 * 전언 한 줄 — 원본 26장 `InformationTransmission` 중 U1 이 쓰는 칸.
 *
 * 보고와 소문은 세계 사건에서 저절로 나오지 않는다. **누군가 말해야 온다.** 전파망 자체는
 * S3(정보·의념)와 I2(약속·전달)의 몫이므로, U1 은 전언이 주어졌을 때 그것이 받는 이에게
 * 닿는지만 판정한다.
 *
 * 그리고 한 가지를 강제한다 — **보낸 이가 스스로 지각하지 않은 것은 전할 수 없다**(GI-02).
 * 이것이 없으면 소문 채널이 전지적 지식의 뒷문이 된다.
 */
export interface Testimony {
  id: string;
  tick: number;
  senderId: EntityId;
  receiverId: EntityId;
  /** 무엇에 대한 전언인가 */
  phenomenonId: string;
  channel: 'report' | 'rumor';
  /** 얼마나 뒤틀렸는가 0~1 — U2 가 확신도로 쓴다 */
  distortion: number;
  /** 얼마나 숨겼는가 0~1 */
  concealment: number;
  /** 얼마나 설득력 있게 말했는가 */
  persuasion: number;
}

/** 주체 하나에게 실제로 닿은 것. */
export interface PerceivedPhenomenon {
  /** `<주체>:<현상>:<채널>` — 같은 사건도 감각마다 따로 닿는다 */
  id: string;
  phenomenonId: string;
  perceiverId: EntityId;
  channel: PerceptionChannel;
  /** 거리와 차폐를 지난 뒤의 세기 */
  strength: number;
  /** 이 주체의 문턱 */
  threshold: number;
  /** 원본까지의 거리 (m). 전언이면 null */
  distance: number | null;
  /** 어느 몸으로 느꼈는가. 전언이면 null */
  sensedBy: EntityId | null;
  /** 세기를 줄인 것들 (id 오름차순) */
  dampedBy: EntityId[];
  /** 전언이면 누가 전했는가 */
  via: EntityId | null;
  /** 전언이면 얼마나 뒤틀렸는가 */
  distortion: number;
  tags: string[];
  occurredAtTick: number;
  evidenceIds: string[];
}

export const MISS = {
  /** 그 감각이 아예 없다 */
  NO_SENSE: 'E_NO_SENSE',
  /** 감각은 있으나 그 채널을 쓸 능력이 없다 (의념) */
  NO_CAPABILITY: 'E_NO_CAPABILITY',
  /** 몸이 없어 공간에 있지 않다 */
  NO_BODY: 'E_NO_BODY',
  /** 현상에 자리가 없다 */
  NO_LOCATION: 'E_NO_LOCATION',
  /** 너무 멀다 */
  OUT_OF_RANGE: 'E_OUT_OF_RANGE',
  /** 막는 것이 시선을 끊었다 */
  SIGHT_BLOCKED: 'E_SIGHT_BLOCKED',
  /** 닿기는 했으나 문턱을 넘지 못했다 */
  BELOW_THRESHOLD: 'E_BELOW_THRESHOLD',
  /** 보낸 이가 그것을 지각한 적이 없다 (GI-02) */
  SENDER_NEVER_PERCEIVED: 'E_SENDER_NEVER_PERCEIVED',
  /** 전언이 가리키는 현상이 세계에 없다 */
  UNKNOWN_PHENOMENON_IN_TESTIMONY: 'E_UNKNOWN_PHENOMENON_IN_TESTIMONY',
} as const;

export type MissCode = (typeof MISS)[keyof typeof MISS];

/**
 * 닿지 못한 것과 그 이유.
 *
 * 원문 「22」 8단계는 "모든 거부·위반이 경로와 코드로 위치를 지목"할 것을 요구한다. 지각에서
 * 그것은 **못 본 이유**다 — 멀어서인지, 막혀서인지, 감각이 없어서인지가 구분되지 않으면
 * 뒤에 오는 모듈은 "왜 저 NPC 는 모르는가"에 답할 수 없다.
 */
export interface PerceptionMiss {
  perceiverId: EntityId;
  phenomenonId: string;
  channel: PerceptionChannel;
  code: MissCode;
  message: string;
  /** 잰 세기 (문턱을 못 넘은 경우) */
  strength: number | null;
  threshold: number | null;
  distance: number | null;
  /** 막은 것들 (id 오름차순) */
  blockedBy: EntityId[];
}

/** 현상을 만들 수 없었던 자리 — 사전에 없거나 이름을 모르는 채널. */
export interface PhenomenonGap {
  code: 'E_UNKNOWN_PHENOMENON' | 'E_UNKNOWN_CHANNEL';
  /** 규칙이 남긴 흔적의 id */
  phenomenonId: string;
  /** 모르는 채널 이름 (E_UNKNOWN_CHANNEL 일 때) */
  channel: string | null;
  message: string;
  occurredAtTick: number;
}

/**
 * 무대의 자리 한 줄 — **화면이 세계를 그리기 위한 것**이다.
 *
 * 지각은 공간에서 일어나는 일이므로 공간으로 보여야 한다(원문 「24」: "표·그래프·타임라인을
 * 통해 반드시 눈으로 확인할 수 있어야 한다"). 거리와 차폐를 숫자로만 내주면 화면은 코드 목록이
 * 되고, 벽이 시선을 끊고 소리를 줄인다는 이 모듈의 요지가 눈에 보이지 않는다.
 *
 * 판정에는 쓰지 않는다. 판정은 `Sensorium` 을 거친 `perceive.ts` 만 한다.
 */
export interface StagePlacement {
  id: EntityId;
  at: [number, number, number];
  role: 'source' | 'body' | 'blocker';
  /** `body` 면 그 몸의 주인 */
  owner: EntityId | null;
  /** `blocker` 면 시선을 막는가 */
  opaque: boolean;
}

/** 한 틱의 지각 단면. */
export interface PerceptionSample {
  tick: number;
  /** 이 틱에 세계가 남긴 현상 (id 오름차순) */
  phenomena: Phenomenon[];
  /** 주체 id → 그 주체에게 닿은 것 (키 오름차순) */
  perceived: Record<EntityId, PerceivedPhenomenon[]>;
  misses: PerceptionMiss[];
  /** 이 틱에 일어난 사건 수 — 현상보다 많을 수 있다 (흔적을 남기지 않는 사건이 있다) */
  events: number;
}

/**
 * 한 주체가 무엇을 알고 무엇을 모르는가 — 화면과 검증이 읽는 요약.
 *
 * 원본 「2.4」가 요구하는 "시각 주장과 청각 주장이 구분된다"가 여기서 눈에 보인다.
 */
export interface PerceiverReport {
  subjectId: EntityId;
  kind: string;
  /** 채널 → 그 감각으로 잡은 현상 id (오름차순) */
  byChannel: Record<string, string[]>;
  /** 어떤 감각으로든 잡은 현상 id (오름차순·중복 없음) */
  known: string[];
  /** 세계에 있었으나 이 주체에게 닿지 않은 현상 id (오름차순) */
  unknown: string[];
  /** 못 본 이유 (현상 id → 코드 오름차순) */
  reasons: Record<string, string[]>;
}
