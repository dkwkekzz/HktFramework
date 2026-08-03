// R3-a 거리와 차폐 — 흔적이 난 자리를 관측자까지의 거리로 바꾸고, 가려진 만큼 세기를 깎는다.
//
// S0-b 는 판정을 이미 다 만들어 두고 한 줄을 남겼다: "현상에서 읽는 것은 통로와 세기뿐이다 —
// 어디서 났는지(placeId)를 거리로 바꾸는 일은 위치를 아는 R3 의 몫이고, S0 은 그 거리를 받아서
// 문턱과만 비교한다." 그 자리다.
//
// 두 가지를 세계에서 읽는다.
//
//   ① **거리** — 관측자가 선 곳(`physical.region`)과 흔적이 난 곳(`Phenomenon.placeId`) 사이.
//      같은 자리면 0 이고, 다른 자리면 세계가 적어 둔 장소 간 거리(`physical.distance.{entity}`)를
//      읽는다. **적히지 않은 거리는 없는 거리다** — D3 이 "적히지 않은 사이는 없는 사이다" 로
//      정한 태도 그대로다. 없는 거리를 지어내면 세계에 없는 길이 생기고, 그러면 아무 데서나
//      아무거나 보인다.
//   ② **차폐** — 흔적이 난 자리의 `physical.cover`. 다만 **자리를 건널 때만 든다**: 같은 자리에
//      선 자는 이미 가림막 안쪽이다. 협곡 안에서 오간 것은 협곡 안의 넷에게는 보이고 밖에서는
//      보이지 않는다 — 이것이 차폐의 뜻이다.
//
// 통로마다 차폐에 얼마나 약한지는 **R3 이 지어내지 않는다.** S0-b `CHANNEL_SPECS` 가 통로마다
// 이미 한 줄씩 적어 두었다("빛은 차폐에 가장 약하다" · "소리는 벽을 돌아오므로 덜 약하다" ·
// "흔적은 늦게 오지만 오래 남는다" · "냄새는 거리보다 시간에 강하다" · "의념은 몸이 없어도 닿는다" ·
// "보고는 주체를 거쳐 온다"). 여기서 하는 일은 그 문장을 값으로 옮기고, 옮긴 것이 통로 6종을
// 빠짐없이 덮는지 검사하는 것뿐이다.

import type { Id } from '../v1/id.ts';
import { PHENOMENON_CHANNELS, type PhenomenonChannel } from '../o1/operation.ts';
import { channelSpec } from '../s0/perception.ts';
import { readSlot, type WorldState } from '../o2/world.ts';
import { violatePercept, type PerceptViolation } from './violation.ts';

/** 통로 하나가 차폐에 얼마나 약한가 — 0(무관) ~ 1(가려진 만큼 그대로 죽는다). */
export interface CoverResistance {
  readonly channel: PhenomenonChannel;
  /** 0~1. 유효 세기 = 세기 × (1 − 차폐 × factor) */
  readonly factor: number;
  /** 왜 이 값인가 — S0-b CHANNEL_SPECS 가 적어 둔 문장을 옮긴다 */
  readonly note: string;
}

/**
 * 통로별 차폐 감쇠. 순서는 O1 `PHENOMENON_CHANNELS` 그대로다.
 *
 * 값은 S0-b 가 통로마다 적어 둔 문장의 번역이다 — 여기서 새로 판단하는 것이 아니라,
 * 서술로만 있던 것을 값으로 세워 검사 가능하게 만드는 것이다.
 */
export const COVER_RESISTANCES: readonly CoverResistance[] = [
  {
    channel: 'light',
    factor: 1,
    note: 'S0-b: "차폐에 가장 약한 통로다" — 가려진 만큼 그대로 죽는다. 완전히 가려지면 아무것도 보이지 않는다',
  },
  {
    channel: 'sound',
    factor: 0.5,
    note: 'S0-b: "벽을 돌아오므로 차폐에 덜 약하다" — 절반만 든다. 가려도 들리는 것이 있다',
  },
  {
    channel: 'trace',
    factor: 0,
    note: 'S0-b: "발자국·파손·사체 — 늦게 오지만 오래 남는다" — 자국은 현장에 있는 것이라 가림막이 가리지 못한다. 대신 도달 거리가 짧다(S1 사냥꾼 5m)',
  },
  {
    channel: 'smell',
    factor: 0,
    note: 'S0-b: "거리보다 시간에 강한 통로다" — 냄새는 가림막을 돌아 흐른다',
  },
  {
    channel: 'psychic',
    factor: 0,
    note: 'S0-b: "몸이 없어도 닿는다" — 물리 차폐가 의념을 막지 못한다. 막는 것은 의념 간섭(psychic.interference)이고 그것은 G 계층의 몫이다',
  },
  {
    channel: 'report',
    factor: 0,
    note: 'S0-b: "주체를 거쳐 온다" — 사람이 옮기는 것이라 가림막과 무관하다. 대신 거치는 주체가 왜곡 지점이다 (R4)',
  },
];

/** 거리를 알 수 없을 때의 값 — 어떤 통로의 도달 거리보다도 멀다 (S0 MAX_PERCEPTION_RANGE 밖). */
export const UNREACHABLE = Number.POSITIVE_INFINITY;

/** 통로 하나의 차폐 감쇠를 찾는다. */
export function coverResistance(
  channel: PhenomenonChannel,
  resistances: readonly CoverResistance[] = COVER_RESISTANCES,
): CoverResistance | null {
  return resistances.find((entry) => entry.channel === channel) ?? null;
}

/** 그 주체가 선 곳. 세계에 적혀 있지 않으면 null — 선 곳 없는 자는 거리를 잴 수 없다. */
export function standsIn(world: WorldState, subjectId: Id): Id | null {
  const region = readSlot(world, 'physical', subjectId, 'region');
  return typeof region === 'string' && region !== '' ? region : null;
}

/**
 * 두 자리 사이의 거리.
 *
 * 같은 자리면 0. 다른 자리면 세계가 적어 둔 것을 읽되, **어느 쪽에 적혀 있어도 읽는다**
 * (거리는 방향이 없다). 적혀 있지 않으면 `UNREACHABLE` — 없는 거리를 지어내지 않는다.
 */
export function distanceBetween(world: WorldState, from: Id, to: Id): number {
  if (from === to) return 0;
  const forward = readSlot(world, 'physical', from, `distance.${to}`);
  if (typeof forward === 'number') return forward;
  const backward = readSlot(world, 'physical', to, `distance.${from}`);
  if (typeof backward === 'number') return backward;
  return UNREACHABLE;
}

/** 그 자리가 얼마나 가려져 있는가 (0~1). 적혀 있지 않으면 가려지지 않은 것이다. */
export function coverOf(world: WorldState, placeId: Id): number {
  const cover = readSlot(world, 'physical', placeId, 'cover');
  if (typeof cover !== 'number') return 0;
  return Math.min(1, Math.max(0, cover));
}

/** 흔적 하나가 관측자에게 닿는 방식 — 얼마나 멀고, 얼마나 가려졌고, 그래서 얼마나 약해졌는가. */
export interface Reach {
  readonly distance: number;
  /** 자리를 건너야 하는가 — 같은 자리면 차폐가 들지 않는다 */
  readonly crossesCover: boolean;
  /** 실제로 든 차폐 (0~1) */
  readonly cover: number;
  /** 그 통로가 차폐에 얼마나 약한가 */
  readonly factor: number;
  /** 차폐를 지난 뒤의 세기 (0~1) */
  readonly intensity: number;
}

/**
 * 흔적 하나가 관측자에게 닿는 방식을 잰다.
 *
 * 차폐는 **자리를 건널 때만** 든다 — 같은 자리에 선 자는 가림막 안쪽이다. 그래서 협곡 안에서
 * 오간 것은 협곡 안의 넷에게는 보이고 밖에서는 죽는다.
 */
export function reachOf(
  world: WorldState,
  observerPlaceId: Id,
  phenomenon: { readonly placeId: Id; readonly channel: PhenomenonChannel; readonly intensity: number },
  resistances: readonly CoverResistance[] = COVER_RESISTANCES,
): Reach {
  const distance = distanceBetween(world, observerPlaceId, phenomenon.placeId);
  const crossesCover = observerPlaceId !== phenomenon.placeId;
  const cover = crossesCover ? coverOf(world, phenomenon.placeId) : 0;
  const factor = coverResistance(phenomenon.channel, resistances)?.factor ?? 0;
  const intensity = Math.max(0, phenomenon.intensity * (1 - cover * factor));
  return { distance, crossesCover, cover, factor, intensity };
}

/** 감쇠표 검사 결과. */
export interface AttenuationReport {
  /** 통로별 감쇠 계수 */
  readonly byChannel: Readonly<Record<string, number>>;
  /** 차폐가 아예 들지 않는 통로 */
  readonly immune: readonly PhenomenonChannel[];
  /** 근거(S0-b 문장)를 대지 못하는 통로 */
  readonly unsourced: readonly PhenomenonChannel[];
  readonly violations: readonly PerceptViolation[];
  readonly complete: boolean;
}

/**
 * 감쇠표가 온전한가 — 통로 6종을 빠짐없이 덮고, 계수가 0~1 이고, 근거를 대는가.
 * 던지지 않는다 — 어긋남은 값으로 남는다.
 */
export function checkAttenuation(
  resistances: readonly CoverResistance[] = COVER_RESISTANCES,
): AttenuationReport {
  const violations: PerceptViolation[] = [];
  const byChannel: Record<string, number> = {};
  const unsourced: PhenomenonChannel[] = [];
  const seen = new Set<PhenomenonChannel>();

  for (const [index, entry] of resistances.entries()) {
    const at = `$.resistances[${String(index)}]`;
    if (!(PHENOMENON_CHANNELS as readonly string[]).includes(entry.channel)) {
      violatePercept(
        violations,
        '',
        'unknown-channel',
        `${at}.channel`,
        `O1 이 연 통로 6종에 없는 통로 ${JSON.stringify(entry.channel)} 의 감쇠를 적었다`,
      );
      continue;
    }
    if (seen.has(entry.channel)) {
      violatePercept(
        violations,
        '',
        'bad-attenuation',
        `${at}.channel`,
        `${channelSpec(entry.channel)?.label ?? entry.channel} 의 감쇠가 두 번 적혔다 — 어느 쪽이 세계인지 알 수 없다`,
      );
      continue;
    }
    seen.add(entry.channel);
    byChannel[entry.channel] = entry.factor;

    if (!Number.isFinite(entry.factor) || entry.factor < 0 || entry.factor > 1) {
      violatePercept(
        violations,
        '',
        'bad-attenuation',
        `${at}.factor`,
        `${channelSpec(entry.channel)?.label ?? entry.channel} 의 감쇠는 0~1 이어야 한다 — ${String(entry.factor)}. 1 을 넘으면 가림막이 없던 세기를 만들어 낸다`,
      );
    }
    if (entry.note === '') {
      unsourced.push(entry.channel);
      violatePercept(
        violations,
        '',
        'bad-attenuation',
        `${at}.note`,
        `${channelSpec(entry.channel)?.label ?? entry.channel} 의 감쇠가 근거를 대지 못한다 — 이 값들은 S0-b CHANNEL_SPECS 의 문장을 옮긴 것이어야 한다`,
      );
    }
  }

  for (const channel of PHENOMENON_CHANNELS) {
    if (seen.has(channel)) continue;
    violatePercept(
      violations,
      '',
      'bad-attenuation',
      '$.resistances',
      `${channelSpec(channel)?.label ?? channel} 통로가 차폐에 얼마나 약한지 적히지 않았다 — 적히지 않은 통로는 감지 판정을 지날 수 없다`,
    );
  }

  return {
    byChannel,
    immune: [...seen].filter((channel) => (byChannel[channel] ?? 0) === 0),
    unsourced,
    violations,
    complete: resistances.length > 0 && violations.length === 0,
  };
}

/** 감쇠표를 한 줄 판정으로 접는다 — 터미널·배지용. */
export function attenuationVerdict(report: AttenuationReport): string {
  if (report.complete) {
    return `통로 ${String(PHENOMENON_CHANNELS.length)} 종이 전부 차폐 앞에서의 몫을 갖는다 (차폐가 들지 않는 통로 ${String(report.immune.length)} — 흔적·냄새·의념·보고)`;
  }
  return `감쇠표가 어긋났다 — ${[...new Set(report.violations.map((violation) => violation.rule))].join(', ')}`;
}

/** 닿음 하나를 사람이 읽는 한 줄로. */
export function reachLine(reach: Reach): string {
  const where = reach.distance === UNREACHABLE ? '거리가 세계에 적혀 있지 않다' : `${String(reach.distance)}m`;
  if (!reach.crossesCover) return `${where} · 같은 자리라 차폐가 들지 않는다`;
  return `${where} · 차폐 ${reach.cover.toFixed(2)} × ${reach.factor.toFixed(2)} → 세기 ${reach.intensity.toFixed(2)}`;
}
