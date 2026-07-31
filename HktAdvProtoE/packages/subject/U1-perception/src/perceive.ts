import type { Sensorium } from './sensorium.js';
import {
  MISS,
  type ChannelSpec,
  type PerceivedPhenomenon,
  type PerceiverReport,
  type PerceptionChannel,
  type PerceptionMiss,
  type Phenomenon,
  type Testimony,
} from './types.js';

/**
 * 파이프라인의 둘째 마디 — `Phenomenon → 센서별 필터 → PerceivedPhenomenon`.
 *
 * ## 무엇이 걸러지는가
 *
 * 다섯 관문을 차례로 지나야 주체에게 닿는다. 하나라도 걸리면 **왜 걸렸는지가 남는다** —
 * 원문 「22」 8단계의 인과 추적이 지각에서는 "왜 저 NPC 는 모르는가"의 답이 된다.
 *
 * ```text
 * ① 그 감각이 있는가              없으면 E_NO_SENSE
 * ② 그 채널을 쓸 능력이 있는가     없으면 E_NO_CAPABILITY   (의념)
 * ③ 몸이 세계 어디엔가 있는가      없으면 E_NO_BODY
 * ④ 닿는 거리 안인가              아니면 E_OUT_OF_RANGE
 * ⑤ 막는 것을 지날 수 있는가       못 지나면 E_SIGHT_BLOCKED
 * ⑥ 남은 세기가 문턱을 넘는가      못 넘으면 E_BELOW_THRESHOLD
 * ```
 *
 * ## 왜 저장소를 받지 않는가
 *
 * 이 파일의 어느 함수도 `EntityStore` 를 받지 않고, K0 도 S0 도 들여오지 않는다. 세계에 물어볼
 * 수 있는 것은 `Sensorium` 이 열어 준 좁은 창뿐이다 — 걸러 주는 쪽이 세계 전체를 손에 쥐고
 * 있으면 거르지 않을 이유가 언제든 생긴다.
 */

/** 세기와 거리의 자릿수. 두 곳에서 다르게 자르면 해시가 흔들린다. */
const PRECISION = 4;

export function round(value: number): number {
  const scale = 10 ** PRECISION;
  const rounded = Math.round(value * scale) / scale;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export interface PerceptionPass {
  perceived: PerceivedPhenomenon[];
  misses: PerceptionMiss[];
}

/**
 * 공간을 건너오는 채널(시각·청각·냄새·접촉·의념)을 판정한다.
 *
 * 보고와 소문은 여기서 다루지 않는다 — 사람이 들고 오는 것이므로 `receiveTestimonies` 의 몫이다.
 */
export function perceiveAll(
  sensorium: Sensorium,
  phenomena: readonly Phenomenon[],
  channels: readonly ChannelSpec[],
): PerceptionPass {
  const byChannel = new Map(channels.map((spec) => [spec.id, spec]));
  const perceived: PerceivedPhenomenon[] = [];
  const misses: PerceptionMiss[] = [];

  for (const subject of sensorium.subjects()) {
    const senses = sensorium.sensesOf(subject);
    const capabilities = sensorium.capabilitiesOf(subject);
    const bodies = sensorium
      .bodiesOf(subject)
      .map((body) => ({ body, at: sensorium.positionOf(body) }))
      .filter((entry): entry is { body: string; at: NonNullable<typeof entry.at> } => entry.at !== null);

    for (const phenomenon of phenomena) {
      for (const channel of phenomenon.channels) {
        const spec = byChannel.get(channel);
        if (!spec || spec.carriedByPeople) continue;
        const outcome = senseOne(subject, phenomenon, channel, spec, senses, capabilities, bodies, sensorium);
        if ('miss' in outcome) misses.push(outcome.miss);
        else perceived.push(outcome.perceived);
      }
    }
  }

  return { perceived: sortPerceived(perceived), misses: sortMisses(misses) };
}

type Placed = { body: string; at: { x: number; y: number; z: number } };

function senseOne(
  subject: string,
  phenomenon: Phenomenon,
  channel: PerceptionChannel,
  spec: ChannelSpec,
  senses: Record<string, number>,
  capabilities: readonly string[],
  bodies: readonly Placed[],
  sensorium: Sensorium,
): { perceived: PerceivedPhenomenon } | { miss: PerceptionMiss } {
  const at = (
    code: PerceptionMiss['code'],
    message: string,
    extra: Partial<PerceptionMiss> = {},
  ): { miss: PerceptionMiss } => ({
    miss: {
      perceiverId: subject,
      phenomenonId: phenomenon.id,
      channel,
      code,
      message,
      strength: null,
      threshold: senses[channel] ?? null,
      distance: null,
      blockedBy: [],
      ...extra,
    },
  });

  // ① 그 감각이 있는가
  const threshold = senses[channel];
  if (threshold === undefined) {
    return at(MISS.NO_SENSE, `${subject} 에게는 ${spec.title} 이(가) 없다.`);
  }

  // ② 그 채널을 쓸 능력이 있는가
  if (spec.requiredCapability !== undefined && !capabilities.includes(spec.requiredCapability)) {
    return at(
      MISS.NO_CAPABILITY,
      `${spec.title} 을(를) 느끼려면 능력 ${spec.requiredCapability} 이(가) 있어야 한다.`,
    );
  }

  // ③ 몸이 세계 어디엔가 있는가
  if (phenomenon.location === undefined) {
    return at(MISS.NO_LOCATION, `현상 ${phenomenon.id} 에 자리가 없어 공간으로는 닿지 않는다.`);
  }
  if (bodies.length === 0) {
    return at(MISS.NO_BODY, `${subject} 은(는) 세계 어디에도 몸이 없어 공간을 느끼지 못한다.`);
  }

  const source = { x: phenomenon.location[0], y: phenomenon.location[1], z: phenomenon.location[2] };
  // 몸이 여럿이면 가장 가까운 몸이 느낀다. 동률은 id 오름차순으로 깬다 (GI-12).
  const nearest = bodies.reduce((best, entry) => {
    const gap = span(entry.at, source) - span(best.at, source);
    if (gap < 0) return entry;
    if (gap > 0) return best;
    return entry.body < best.body ? entry : best;
  }, bodies[0] as Placed);
  const distance = round(span(nearest.at, source));

  // ④ 닿는 거리 안인가
  if (distance > spec.maxDistance) {
    return at(
      MISS.OUT_OF_RANGE,
      `${distance}m 는 ${spec.title} 이(가) 닿는 ${spec.maxDistance}m 밖이다.`,
      { distance },
    );
  }

  const ignore = [nearest.body];
  if (phenomenon.sourceEntityId !== undefined) ignore.push(phenomenon.sourceEntityId);
  const blockers = sensorium.sightBlockers(nearest.at, source, ignore);

  // ⑤ 막는 것을 지날 수 있는가
  if (spec.onBlocked === 'cut' && blockers.length > 0) {
    return at(
      MISS.SIGHT_BLOCKED,
      `${blockers.join(' · ')} 이(가) ${spec.title} 을(를) 끊는다.`,
      { distance, blockedBy: blockers },
    );
  }

  const base = phenomenon.measurements[channel] ?? 0;
  const damped = spec.onBlocked === 'damped' ? spec.dampPerBlocker ** blockers.length : 1;
  const strength = round((base / (1 + spec.falloff * distance)) * damped);

  // ⑥ 남은 세기가 문턱을 넘는가
  if (strength < threshold) {
    return at(
      MISS.BELOW_THRESHOLD,
      `세기 ${strength} 이(가) 문턱 ${threshold} 에 못 미친다${
        blockers.length > 0 ? ` (${blockers.join(' · ')} 이(가) 줄였다)` : ''
      }.`,
      { strength, distance, blockedBy: blockers },
    );
  }

  return {
    perceived: {
      id: `${subject}:${phenomenon.id}:${channel}`,
      phenomenonId: phenomenon.id,
      perceiverId: subject,
      channel,
      strength,
      threshold,
      distance,
      sensedBy: nearest.body,
      dampedBy: blockers,
      via: null,
      distortion: 0,
      tags: phenomenon.tags,
      occurredAtTick: phenomenon.occurredAtTick,
      evidenceIds: phenomenon.evidenceIds,
    },
  };
}

/**
 * 보고와 소문 — 사람이 들고 오는 채널.
 *
 * 여기서 한 가지를 반드시 지킨다. **보낸 이가 스스로 지각하지 않은 것은 전할 수 없다.**
 * 이것이 없으면 소문 채널이 전지적 지식의 뒷문이 된다 — 아무도 보지 못한 사건을 누군가
 * "전해 주는" 것으로 세계 전체가 새어 나간다(GI-02).
 *
 * `alreadyPerceived` 는 **지금까지 쌓인** 지각이다. 어제 본 것을 오늘 전할 수 있어야 하므로
 * 이번 틱만 보아서는 안 된다.
 */
export function receiveTestimonies(
  sensorium: Sensorium,
  testimonies: readonly Testimony[],
  phenomena: ReadonlyMap<string, Phenomenon>,
  alreadyPerceived: ReadonlySet<string>,
  channels: readonly ChannelSpec[],
): PerceptionPass {
  const byChannel = new Map(channels.map((spec) => [spec.id, spec]));
  const perceived: PerceivedPhenomenon[] = [];
  const misses: PerceptionMiss[] = [];

  for (const testimony of [...testimonies].sort((left, right) => (left.id < right.id ? -1 : 1))) {
    const spec = byChannel.get(testimony.channel);
    const senses = sensorium.sensesOf(testimony.receiverId);
    const threshold = senses[testimony.channel] ?? null;
    const miss = (code: PerceptionMiss['code'], message: string, strength: number | null = null): void => {
      misses.push({
        perceiverId: testimony.receiverId,
        phenomenonId: testimony.phenomenonId,
        channel: testimony.channel,
        code,
        message,
        strength,
        threshold,
        distance: null,
        blockedBy: [],
      });
    };

    const phenomenon = phenomena.get(testimony.phenomenonId);
    if (!phenomenon || !spec) {
      miss(
        MISS.UNKNOWN_PHENOMENON_IN_TESTIMONY,
        `전언 ${testimony.id} 이(가) 가리키는 현상이 세계에 없다: ${testimony.phenomenonId}`,
      );
      continue;
    }
    if (!alreadyPerceived.has(`${testimony.senderId}:${testimony.phenomenonId}`)) {
      miss(
        MISS.SENDER_NEVER_PERCEIVED,
        `${testimony.senderId} 은(는) ${testimony.phenomenonId} 을(를) 지각한 적이 없다 — 못 본 것은 전할 수 없다 (GI-02).`,
      );
      continue;
    }
    if (threshold === null) {
      miss(MISS.NO_SENSE, `${testimony.receiverId} 은(는) ${spec.title} 을(를) 받지 않는다.`);
      continue;
    }

    // 숨긴 만큼 덜 전해진다. 설득력이 그 나머지를 밀어 준다.
    const strength = round(testimony.persuasion * (1 - testimony.concealment));
    if (strength < threshold) {
      miss(
        MISS.BELOW_THRESHOLD,
        `전해진 세기 ${strength} 이(가) 문턱 ${threshold} 에 못 미친다 (숨김 ${testimony.concealment}).`,
        strength,
      );
      continue;
    }

    perceived.push({
      id: `${testimony.receiverId}:${testimony.phenomenonId}:${testimony.channel}`,
      phenomenonId: testimony.phenomenonId,
      perceiverId: testimony.receiverId,
      channel: testimony.channel,
      strength,
      threshold,
      distance: null,
      sensedBy: null,
      dampedBy: [],
      via: testimony.senderId,
      distortion: testimony.distortion,
      tags: phenomenon.tags,
      occurredAtTick: phenomenon.occurredAtTick,
      evidenceIds: phenomenon.evidenceIds,
    });
  }

  return { perceived: sortPerceived(perceived), misses: sortMisses(misses) };
}

/**
 * 한 주체가 무엇을 알고 무엇을 모르는가.
 *
 * 원문 「2.4」가 요구하는 "시각 주장과 청각 주장이 구분된다"가 `byChannel` 에서 눈에 보인다.
 * 같은 사건이라도 눈으로 잡은 것과 귀로 잡은 것은 다른 줄에 있으며, 하나만 있는 경우도 있다.
 */
export function reportFor(
  subject: string,
  kind: string,
  phenomena: readonly Phenomenon[],
  perceived: readonly PerceivedPhenomenon[],
  misses: readonly PerceptionMiss[],
): PerceiverReport {
  const mine = perceived.filter((entry) => entry.perceiverId === subject);
  const byChannel: Record<string, string[]> = {};
  for (const entry of mine) {
    (byChannel[entry.channel] ??= []).push(entry.phenomenonId);
  }
  for (const list of Object.values(byChannel)) list.sort();

  const known = [...new Set(mine.map((entry) => entry.phenomenonId))].sort();
  const unknown = phenomena.map((entry) => entry.id).filter((id) => !known.includes(id)).sort();

  const reasons: Record<string, string[]> = {};
  for (const entry of misses) {
    if (entry.perceiverId !== subject || known.includes(entry.phenomenonId)) continue;
    const codes = (reasons[entry.phenomenonId] ??= []);
    if (!codes.includes(entry.code)) codes.push(entry.code);
  }
  for (const codes of Object.values(reasons)) codes.sort();

  return { subjectId: subject, kind, byChannel: sortKeys(byChannel), known, unknown, reasons: sortKeys(reasons) };
}

function span(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function sortPerceived(list: PerceivedPhenomenon[]): PerceivedPhenomenon[] {
  return list.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function sortMisses(list: PerceptionMiss[]): PerceptionMiss[] {
  return list.sort((left, right) => {
    const leftKey = `${left.perceiverId}:${left.phenomenonId}:${left.channel}`;
    const rightKey = `${right.perceiverId}:${right.phenomenonId}:${right.channel}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key] as T;
  return out;
}
