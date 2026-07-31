import type { WorldEvent } from '@hkt/k3-event-replay';
import type { Sensorium } from './sensorium.js';
import {
  CHANNEL_ALIASES,
  type Phenomenon,
  type PhenomenonGap,
  type PhenomenonSpec,
  type PerceptionChannel,
} from './types.js';

/**
 * 파이프라인의 첫 마디 — `WorldEvent → Phenomenon`.
 *
 * 사건은 세계가 무엇을 했는지 적고, 현상은 그 일이 **무엇으로 드러났는지** 적는다. 둘은 다르다.
 * 늑대가 사슴을 잡은 사건 하나는 보이는 것 하나·들리는 것 하나·냄새 하나를 남기며, 각각 다른
 * 거리까지 간다. 그리고 어떤 사건은 아무 흔적도 남기지 않는다 — 그런 사건은 아무도 모른다.
 *
 * 세 가지를 여기서 정한다.
 *
 * | 무엇 | 어디서 |
 * |---|---|
 * | 어느 감각으로 드러나는가 | 규칙의 `emits.channels` — 법칙이 정한다 |
 * | 얼마나 크게 드러나는가 | 현상 사전 — 세계가 정한다 |
 * | 어디서 일어났는가 | 행위자의 자리 (S0) |
 *
 * 사전에 없는 이름은 **지어내지 않는다.** 기본값을 슬쩍 끼워 넣으면 늑대의 사냥과 풀의 회복이
 * 같은 크기로 들리고, 그 세계는 조용히 균일해진다.
 */
export function phenomenaOf(
  events: readonly WorldEvent[],
  book: readonly PhenomenonSpec[],
  sensorium: Sensorium,
): { phenomena: Phenomenon[]; gaps: PhenomenonGap[] } {
  const byId = new Map(book.map((entry) => [entry.id, entry]));
  const phenomena: Phenomenon[] = [];
  const gaps: PhenomenonGap[] = [];
  // 같은 틱에 같은 흔적이 여러 번 나면 서로 다른 현상이다 — 두 번 울린 종은 두 번 들린다.
  const seen = new Map<string, number>();

  for (const event of events) {
    for (const emitted of event.emittedPhenomena) {
      const entry = byId.get(emitted.id);
      if (!entry) {
        gaps.push({
          code: 'E_UNKNOWN_PHENOMENON',
          phenomenonId: emitted.id,
          channel: null,
          message: `현상 사전에 없는 흔적이다: ${emitted.id} (사건 ${event.id}). 세기를 지어내지 않고 버린다.`,
          occurredAtTick: event.tick,
        });
        continue;
      }

      const channels: PerceptionChannel[] = [];
      for (const raw of emitted.channels) {
        const channel = CHANNEL_ALIASES[raw];
        if (!channel) {
          gaps.push({
            code: 'E_UNKNOWN_CHANNEL',
            phenomenonId: emitted.id,
            channel: raw,
            message: `모르는 채널 이름이다: ${raw} (사건 ${event.id}). 원본 10장의 이름으로 옮길 표가 없다.`,
            occurredAtTick: event.tick,
          });
          continue;
        }
        if (!channels.includes(channel)) channels.push(channel);
      }
      if (channels.length === 0) continue;

      const source = sourceOf(event, sensorium);
      const key = `t${event.tick}_${emitted.id}_${source.entity ?? 'nowhere'}`;
      const ordinal = (seen.get(key) ?? 0) + 1;
      seen.set(key, ordinal);

      const measurements: Record<string, number> = {};
      for (const channel of channels) {
        const value = entry.measurements[channel];
        if (typeof value === 'number') measurements[channel] = value;
      }

      phenomena.push({
        id: ordinal === 1 ? key : `${key}#${ordinal}`,
        ...(source.entity === null ? {} : { sourceEntityId: source.entity }),
        ...(source.subject === null ? {} : { sourceSubjectId: source.subject }),
        tags: [...new Set([...(entry.tags ?? []), ...(emitted.tags ?? [])])].sort(),
        channels: channels.slice().sort(),
        measurements,
        ...(source.location === null ? {} : { location: source.location }),
        occurredAtTick: event.tick,
        // 현상의 증거는 그것을 일으킨 사건이다. U2 가 주장의 근거로 이 id 를 따라간다.
        evidenceIds: [event.id],
      });
    }
  }

  phenomena.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  gaps.sort((left, right) =>
    left.occurredAtTick === right.occurredAtTick
      ? left.phenomenonId < right.phenomenonId
        ? -1
        : 1
      : left.occurredAtTick - right.occurredAtTick,
  );
  return { phenomena, gaps };
}

/**
 * 이 사건이 어디서 일어났는가.
 *
 * 행위자가 몸이면(S1 의 자연 법칙) 그 자리가 곧 사건의 자리다. 행위자가 주체면(U0 의 주체 법칙)
 * 주체 자신은 공간에 없으므로 **그 주체의 첫 몸**의 자리를 쓴다 — 주체는 몸을 통해서만 세계에
 * 닿아 있다는 U0 의 판단이 여기서도 그대로 이어진다. 몸이 여럿이면 id 오름차순의 첫 몸이다
 * (결정적이어야 하므로 한 번 못을 박는다).
 */
function sourceOf(
  event: WorldEvent,
  sensorium: Sensorium,
): { entity: string | null; subject: string | null; location: [number, number, number] | null } {
  const actor = event.participantSubjectIds[0] ?? null;
  if (actor === null || !sensorium.has(actor)) return { entity: null, subject: null, location: null };

  const own = sensorium.positionOf(actor);
  if (own) {
    return {
      entity: actor,
      subject: sensorium.ownerOfBody(actor),
      location: [own.x, own.y, own.z],
    };
  }

  const body = sensorium.bodiesOf(actor)[0] ?? null;
  const at = body === null ? null : sensorium.positionOf(body);
  return {
    entity: body ?? actor,
    subject: actor,
    location: at ? [at.x, at.y, at.z] : null,
  };
}
