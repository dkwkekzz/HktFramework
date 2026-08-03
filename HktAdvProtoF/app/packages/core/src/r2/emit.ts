// R2-b 세기·수명·자리 — 사건 하나가 세계에 남기는 흔적을 세운다.
//
// R1 은 사건까지 만들어 두고 한 줄을 남겼다: "사건이 남기는 관찰 가능한 흔적(Phenomenon)은
// R2 의 몫이다." 그 자리다.
//
// 현상을 새로 설계하지 않는다 — O1 이 이미 `Phenomenon` 을 열어 뒀다(통로 · 원인 사건 · 자리 ·
// 세기 · 수명). R2-b 가 하는 일은 그 자리를 **사건과 세계에서** 채우는 것이고, 채울 수 없으면
// 사유를 남기는 것이다. 넷 다 앞 계층에서 읽어 온다:
//
//   어느 통로로 새는가  R2-a 표면 (`LEAK_CHANNELS` — 자리가 정한다. 원자가 아니다)
//   얼마나 센가         값이 움직인 폭. **잴 수 있는 자리만 비율로 재고**, 세계가 상한을 열어 둔
//                       자리(재고·빚)는 있다·없다만 안다 — P4-a `MEASURABLE_SPAN` 그대로다
//   얼마나 남는가       P0-b `reversible`. **되돌릴 수 없는 원자가 한 일은 사라지지 않는다** —
//                       R1-b 가 봉인한 것과 정확히 같은 자리(바꾼 것이지 치른 것이 아니다)
//   어디서 났는가       세계에서 읽는다 (`physical.region`) — 손으로 적게 하지 않는다
//
// 그리고 R2 가 처음 세우는 값이 하나 있다: **애매함**(`ambiguity`). 같은 자국을 남길 수 있는
// 원자가 몇인가에서 나온다 — 이것도 R2 가 지어낸 것이 아니라 P0-b 걸림을 세는 것이다.
// 체력이 깎인 자국은 열여섯 중 열둘이 남길 수 있어 거의 아무것도 말해 주지 않고, 부서진 것은
// 제거 하나뿐이라 부순 자를 가리킨다. 이 값이 R3 의 선택 감지와 R4 의 오인이 설 자리를 만든다.
//
// 못박는 것 둘.
//
//   ① **새지 않는 자리에서는 현상이 나지 않는다.** 앎이 움직여도 밖에는 아무것도 남지 않는다
//      (`sealed-leak` 은 "났다고 주장하는" 쪽을 막는다). 그래서 세계가 바뀌었는데 아무도 보지
//      못하는 사건이 실제로 있다 — 그것이 정보전이 성립하는 조건이다.
//   ② **원인 없는 현상은 없다.** O0 `caused-persistence` 가 이미 그렇게 적었고 O1 이 그 자리를
//      `causeEventId` 로 열어 뒀다 — R2 는 그것을 사건에서 채울 뿐 비워 둘 수 없다.

import { deterministicId, type Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { Tick } from '../v1/tick.ts';
import type { StateValue } from '../o1/being.ts';
import { classify } from '../o1/index.ts';
import type { Phenomenon } from '../o1/operation.ts';
import type { StateDomain } from '../o2/domain.ts';
import { numericRange } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { readSlot, type WorldState } from '../o2/world.ts';
import { ACTION_ATOMS, atomGrounding, atomLabel, type ActionAtom } from '../p0/index.ts';
import { MEASURABLE_SPAN } from '../p4/payment.ts';
import { effectText, movedEffects, type EventEffect, type WorldEvent } from '../r1/index.ts';
import {
  atomsMoving,
  leakOf,
  sealedOf,
  type LeakChannel,
  type PhenomenonChannel,
  type SealedSlot,
} from './channel.ts';
import { violatePhenomenon, type PhenomenonViolation } from './violation.ts';

/**
 * 되돌릴 수 있는 흔적이 가장 셀 때 얼마나 오래 남는가 (틱).
 *
 * 결정론 상수다 — 세기 1 의 흔적이 이만큼 남고 그 아래는 비례해서 짧아진다. 되돌릴 수 없는
 * 원자가 **바꾼** 자리의 흔적에는 이 값이 쓰이지 않는다: 그것은 사라지지 않는다.
 */
export const TRACE_LIFESPAN = 20;

/** 열여섯 중 하나만 남길 수 있는 자국이 0, 전부가 남길 수 있는 자국이 1 이 되는 눈금. */
const AMBIGUITY_SPAN = ACTION_ATOMS.length - 1;

/**
 * 세계에 실제로 난 흔적 하나 — O1 `Phenomenon` 을 그대로 쓰고 R2 가 쓰는 자리 넷을 더한다.
 * 더한 넷은 전부 사건과 P0-b 에서 온다: 어느 원자였나 · 누가 냈나 · 어느 자리가 새서 났나 ·
 * 그 자국을 남길 수 있는 자가 몇인가.
 */
export interface WorldPhenomenon extends Phenomenon {
  readonly atom: ActionAtom;
  /** 언제 났는가 — 원인 사건의 틱. 흔적은 그 전에는 없고 `decaysAtTick` 뒤에는 없다 */
  readonly atTick: Tick;
  /** 누가 일으킨 사건의 흔적인가 (R1 은 자연 발생을 유예했으므로 언제나 누군가다) */
  readonly actorId: Id;
  /** 어느 자리가 새서 났는가 */
  readonly domain: StateDomain;
  readonly holderId: Id;
  readonly path: string;
  /** 바꾼 자리인가 치른 자리인가 (R1 `EffectKind`) */
  readonly effectKind: EventEffect['kind'];
  /**
   * 0~1. **같은 자국을 남길 수 있는 원자가 몇인가** — 0 이면 그 자국이 원자 하나를 가리키고,
   * 1 에 가까우면 누군가 무언가 했다는 것 말고는 말해 주지 않는다.
   */
  readonly ambiguity: number;
}

/** 사건 하나가 남긴 흔적들. 던지지 않는다 — 서지 못하면 사유가 남는다. */
export interface EmitResult {
  readonly phenomena: readonly WorldPhenomenon[];
  /** 흔적을 남기지 않은 자리들 (새지 않는다고 선언된 자리) — 빠뜨림이 아니라 결과다 */
  readonly sealedSlots: readonly string[];
  readonly violations: readonly PhenomenonViolation[];
}

export interface EmitOptions {
  readonly schema?: StateSchema;
  readonly channels?: readonly LeakChannel[];
  readonly sealed?: readonly SealedSlot[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 값 하나가 "있다" 인가 — 0·거짓·빈 문자열·없음은 없는 것이다 (P4-a `present` 와 같은 뜻). */
function present(value: StateValue | null): boolean {
  return value !== null && value !== false && value !== 0 && value !== '';
}

/**
 * 값이 얼마나 움직였는가 — 0~1.
 *
 * 눈금이 어디서 오는가가 전부다. **세계가 폭을 적어 둔 자리**(체력 0~1 · 신뢰 −1~1)는 그 폭으로
 * 잰다 — 잴 수 있는 자리와 그렇지 않은 자리를 가르는 기준은 P4-a `MEASURABLE_SPAN` 그대로이고
 * R2 가 그 판단을 다시 하지 않는다.
 *
 * 세계가 상한을 사실상 열어 둔 자리(재고·빚 0~10억)에는 폭이 없다. 그렇다고 흔적이 없는 것은
 * 아니다 — 창고가 줄어드는 것은 보인다. 눈금이 밖에 없으면 **그 자리 자신이 눈금이 된다**:
 * 얼마나 있었느냐에 대한 비율로 잰다(`|to−from| ÷ max(|from|, |to|)`). 열에서 여덟이 된 것은
 * 옅은 자국이고, 열에서 0 이 된 것은 최대치다. 없던 것이 생기는 것도 최대치다 — 눈금이 없던
 * 자리에 무언가 선 것은 온전한 변화다.
 *
 * 숫자가 아닌 자리(참거짓·선택지·가리킴)에는 중간이 없다: 바뀌었으면 1 이다.
 * 그래서 **움직인 자리의 세기는 언제나 0 보다 크다** — 움직였는데 흔적이 옅다는 것은 있어도
 * 움직였는데 흔적이 없다는 것은 없다. (움직이지 않은 자리는 애초에 흔적을 내지 않는다.)
 */
export function movementOf(
  effect: EventEffect,
  schema: StateSchema = STATE_SCHEMA,
): { readonly intensity: number; readonly measurable: boolean } {
  if (effect.from === effect.to) return { intensity: 0, measurable: false };

  const field = lookupField(schema, effect.domain, effect.path);
  const range = field === null ? null : numericRange(field.spec.value);

  if (range === null || typeof effect.to !== 'number' || typeof effect.from !== 'number') {
    // 없던 자리에 값이 서는 것(`from` null)도 여기로 온다 — 온전한 변화다.
    return { intensity: 1, measurable: false };
  }

  const span = range.max - range.min;
  if (span > 0 && span <= MEASURABLE_SPAN) {
    return { intensity: clamp01(Math.abs(effect.to - effect.from) / span), measurable: true };
  }

  const scale = Math.max(Math.abs(effect.from), Math.abs(effect.to));
  if (scale === 0) return { intensity: 1, measurable: false };
  return { intensity: clamp01(Math.abs(effect.to - effect.from) / scale), measurable: false };
}

/** 그 자국을 남길 수 있는 원자가 몇인가 — 0(하나뿐) ~ 1(거의 전부). */
export function ambiguityOf(domain: StateDomain, path: string): number {
  const movers = atomsMoving({ domain, path });
  if (movers.length === 0) return 0;
  return clamp01((movers.length - 1) / AMBIGUITY_SPAN);
}

/**
 * 흔적이 언제까지 남는가.
 *
 * **되돌릴 수 없는 원자가 바꾼 자리의 흔적은 사라지지 않는다**(`null`). R1-b 가 봉인한 것과
 * 같은 자리다 — 봉인되는 것은 그 원자가 **한 일**이지 치른 대가가 아니므로, 제거하느라 닳은
 * 제 몸의 자국은 삭고 제거당한 몸의 자국은 남는다.
 */
export function decayOf(
  atom: ActionAtom,
  effect: EventEffect,
  tick: Tick,
  intensity: number,
): Tick | null {
  const reversible = atomGrounding(atom)?.reversible ?? true;
  if (!reversible && effect.kind === 'change') return null;
  return tick + Math.max(1, Math.round(intensity * TRACE_LIFESPAN));
}

/**
 * 그 자리의 흔적이 어디서 나는가.
 *
 * 자리를 지닌 자가 선 곳이다. 장소 자신은 `physical.region` 을 갖지 않으므로(O2 note), 지닌 자의
 * 자리가 비면 **일으킨 자가 선 곳**으로 내려가고 그것도 없으면 흔적은 서지 못한다 — 어디서
 * 났는지 못 대는 현상은 아무도 감지할 수 없기 때문이다(R3 은 거리로 거른다).
 */
export function placeOf(world: WorldState, holderId: Id, actorId: Id): Id | null {
  const held = readSlot(world, 'physical', holderId, 'region');
  if (typeof held === 'string' && held !== '') return held;
  const stood = readSlot(world, 'physical', actorId, 'region');
  if (typeof stood === 'string' && stood !== '') return stood;
  return null;
}

/** 현상의 id — 유래(원인 사건 · 통로 · 자리)에서 나온다 (V1 결정적 ID). */
export function phenomenonIdOf(eventId: Id, channel: PhenomenonChannel, where: string): Id {
  return deterministicId('phenomenon', eventId, channel, where);
}

/**
 * 사건 하나가 남기는 흔적들을 세운다.
 *
 * 관문 순서: 원인이 있는가 → 자리마다 (움직였는가 → 새는가 → 어디서 나는가) → O1 관문.
 * 앞이 무너지면 뒤는 묻지 않는다.
 */
export function emitPhenomena(
  event: WorldEvent,
  world: WorldState,
  options: EmitOptions = {},
): EmitResult {
  const violations: PhenomenonViolation[] = [];
  const schema = options.schema ?? STATE_SCHEMA;
  const phenomena: WorldPhenomenon[] = [];
  const sealedSlots: string[] = [];

  // ① 원인 없는 현상은 없다 (O0 caused-persistence).
  if (event.id === '') {
    violatePhenomenon(
      violations,
      event.name,
      'causeless-phenomenon',
      '$.event.id',
      '원인 사건을 지목할 수 없다 — 원인 없는 지속적 결과는 존재할 수 없다 (O0 caused-persistence)',
    );
    return { phenomena, sealedSlots, violations };
  }
  // 자연 발생 사건(일으킨 자 null)의 흔적도 아직 세우지 않는다 — R1 이 그 사건 자체를 유예했다.
  const actorId = event.actorId;
  if (actorId === null || actorId === '') {
    violatePhenomenon(
      violations,
      event.name,
      'causeless-phenomenon',
      '$.event.actorId',
      '일으킨 자가 없는 사건의 흔적은 아직 세울 수 없다 — R1 이 자연 발생을 유예했다 (W2)',
    );
    return { phenomena, sealedSlots, violations };
  }

  // ② 자리마다 — 움직인 자리만 본다. 값이 그대로면 흔적도 없다.
  for (const [index, effect] of event.effects.entries()) {
    const at = `$.effects[${String(index)}]`;
    const where = effectText(effect);

    if (effect.from === effect.to) continue;

    const sealed = sealedOf(effect.domain, effect.path, options.sealed);
    if (sealed !== null) {
      sealedSlots.push(where);
      continue;
    }

    const leak = leakOf(effect.domain, effect.path, options.channels);
    if (leak === null) {
      violatePhenomenon(
        violations,
        where,
        'unchanneled-slot',
        at,
        `${where} 가 움직였는데 어느 통로로 새는지 적혀 있지 않다 — 표면에 구멍이 있다 (R2-a)`,
      );
      continue;
    }

    // 움직인 자리의 세기는 언제나 0 보다 크다 (`movementOf` 마지막 문단) — 여기서 다시 묻지 않는다.
    // "움직이지 않은 자리에서 났다" 는 사건이 아니라 **주장**을 검사할 때 걸린다 (R2-c 감사).
    const { intensity } = movementOf(effect, schema);

    const placeId = placeOf(world, effect.holderId, actorId);
    if (placeId === null) {
      violatePhenomenon(
        violations,
        where,
        'placeless-phenomenon',
        at,
        `${where} 의 흔적이 어디서 났는지 댈 수 없다 — 지닌 자도 일으킨 자도 세계에 선 곳이 없다`,
      );
      continue;
    }

    const ambiguity = ambiguityOf(effect.domain, effect.path);
    for (const channel of leak.channels) {
      phenomena.push({
        kind: 'Phenomenon',
        id: phenomenonIdOf(event.id, channel, where),
        channel,
        causeEventId: event.id,
        placeId,
        intensity,
        decaysAtTick: decayOf(event.atom, effect, event.tick, intensity),
        atom: event.atom,
        atTick: event.tick,
        actorId,
        domain: effect.domain,
        holderId: effect.holderId,
        path: effect.path,
        effectKind: effect.kind,
        ambiguity,
      });
    }
  }

  // ③ O1 관문 — 현상도 다른 원소처럼 존재론을 지난다.
  const standing: WorldPhenomenon[] = [];
  for (const phenomenon of phenomena) {
    const classified = classify(phenomenon);
    if (classified.kind !== 'Phenomenon') {
      for (const reason of classified.violations) {
        violatePhenomenon(
          violations,
          `${phenomenon.domain}.${phenomenon.holderId}.${phenomenon.path}`,
          'malformed-phenomenon',
          reason.path,
          reason.message,
        );
      }
      continue;
    }
    standing.push(phenomenon);
  }

  if (violations.length > 0) {
    return { phenomena: [], sealedSlots, violations };
  }

  return { phenomena: orderPhenomena(standing), sealedSlots, violations };
}

/** 통로·자리 순으로 — 같은 사건이면 언제나 같은 순서다. */
export function orderPhenomena(
  phenomena: readonly WorldPhenomenon[],
): readonly WorldPhenomenon[] {
  return stableSort(phenomena, (left, right) =>
    compareStrings(
      `${left.channel}/${left.domain}.${left.holderId}.${left.path}`,
      `${right.channel}/${right.domain}.${right.holderId}.${right.path}`,
    ),
  );
}

/** 현상 하나를 사람이 읽는 한 줄로 — 터미널·화면이 같은 문장을 쓴다. */
export function phenomenonLine(phenomenon: WorldPhenomenon): string {
  const life =
    phenomenon.decaysAtTick === null
      ? '사라지지 않는다'
      : `틱 ${String(phenomenon.decaysAtTick)} 까지`;
  return `${channelLabel(phenomenon.channel)} · ${phenomenon.domain}.${phenomenon.path} 세기 ${phenomenon.intensity.toFixed(2)} · 애매함 ${phenomenon.ambiguity.toFixed(2)} · ${life}`;
}

/** 통로의 한국어 이름 — 화면·사유가 같은 말을 쓴다. */
export function channelLabel(channel: PhenomenonChannel): string {
  return CHANNEL_LABELS[channel];
}

const CHANNEL_LABELS: Readonly<Record<PhenomenonChannel, string>> = {
  light: '빛',
  sound: '소리',
  trace: '흔적',
  smell: '냄새',
  psychic: '의념 잔향',
  report: '보고',
};

/** 사건 하나의 흔적을 한 줄 판정으로 접는다. */
export function emitVerdict(event: WorldEvent, result: EmitResult): string {
  if (result.violations.length > 0) {
    return `${event.name} 의 흔적이 서지 못한다 — ${[...new Set(result.violations.map((violation) => violation.rule))].join(', ')}`;
  }
  if (result.phenomena.length === 0) {
    return `${atomLabel(event.atom)} — ${event.name}: 세계는 바뀌었는데 아무 흔적도 남지 않았다 (새지 않는 자리 ${String(result.sealedSlots.length)})`;
  }
  const channels = [...new Set(result.phenomena.map((phenomenon) => phenomenon.channel))];
  return `${atomLabel(event.atom)} — ${event.name}: 현상 ${String(result.phenomena.length)} (${channels.map(channelLabel).join('·')})${result.sealedSlots.length > 0 ? ` · 새지 않은 자리 ${String(result.sealedSlots.length)}` : ''}`;
}

/** 움직인 자리 중 실제로 새는 것들 — 감사(R2-c)가 "흔적 없는 사건" 을 가릴 때 쓴다. */
export function leakingEffects(
  event: WorldEvent,
  options: EmitOptions = {},
): readonly EventEffect[] {
  return movedEffects(event).filter(
    (effect) =>
      sealedOf(effect.domain, effect.path, options.sealed) === null &&
      leakOf(effect.domain, effect.path, options.channels) !== null,
  );
}
