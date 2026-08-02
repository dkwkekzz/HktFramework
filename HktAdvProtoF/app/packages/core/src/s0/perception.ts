// S0-b 감지 프로필 — 원문 S0 다섯 질문의 첫째, "무엇을 감지할 수 있는가".
//
// 주체는 세계의 상태를 보지 못한다. 보는 것은 현상뿐이고(O1 규칙→사건→현상),
// 현상은 통로 6종을 타고 온다(빛·소리·흔적·냄새·의념 잔향·보고). 그래서 감지 프로필은
// **통로별 문턱과 거리**다 — 무엇을 볼 수 있느냐가 아니라, 어느 통로가 얼마나 열려 있느냐.
//
// 두 가지가 세계를 만든다.
//
//   ① 전지한 감각은 없다. 문턱 0 은 세기 0 의 현상까지 감지한다는 뜻이고, 그러면 은폐도
//      기만도 성립하지 않는다 — 원문 §6.1 "객관적 상태와 관찰된 현상의 분리" 가 무너진다.
//   ② 몸 없는 주체는 몸의 감각을 갖지 못한다. 조직·국가·신에게는 눈도 코도 없다.
//      그들이 아는 방법은 구성원의 보고와 의념 잔향뿐이다 — 그래서 국가는 늘 늦게 알고,
//      보고하는 자가 곧 국가의 눈이 된다. 이 제약이 S0-a 경계와 맞물린다.

import type { PhenomenonChannel, Phenomenon } from '../o1/operation.ts';
import { PHENOMENON_CHANNELS } from '../o1/operation.ts';
import { violateSubject, type SubjectRef, type SubjectViolation } from './violation.ts';
import type { Boundary } from './boundary.ts';

/** 통로가 몸을 거치는가, 남을 거치는가. */
export type ChannelRoute = 'body' | 'mediated';

/** 통로 하나의 성격 — 무엇을 타고 오고, 누구에게 열리는가. */
export interface ChannelSpec {
  readonly channel: PhenomenonChannel;
  readonly label: string;
  readonly route: ChannelRoute;
  readonly note: string;
}

export const CHANNEL_SPECS: readonly ChannelSpec[] = [
  {
    channel: 'light',
    label: '빛',
    route: 'body',
    note: '눈이 있어야 한다. 차폐(physical.cover)에 가장 약한 통로다',
  },
  {
    channel: 'sound',
    label: '소리',
    route: 'body',
    note: '귀가 있어야 한다. 벽을 돌아오므로 차폐에 덜 약하다',
  },
  {
    channel: 'trace',
    label: '흔적',
    route: 'body',
    note: '발자국·파손·사체 — 늦게 오지만 오래 남는다',
  },
  {
    channel: 'smell',
    label: '냄새',
    route: 'body',
    note: '코가 있어야 한다. 거리보다 시간에 강한 통로다',
  },
  {
    channel: 'psychic',
    label: '의념 잔향',
    route: 'mediated',
    note: '능력이 남긴 것(psychic.trace.{rule}) — 몸이 없어도 닿는다. 신이 세계를 아는 방법',
  },
  {
    channel: 'report',
    label: '보고',
    route: 'mediated',
    note: '주체를 거쳐 온다 — 조직·국가의 유일한 눈. 거치는 주체가 곧 왜곡 지점이다 (R4)',
  },
];

/** 통로 하나가 이 주체에게 얼마나 열려 있는가. */
export interface PerceptionAcuity {
  readonly channel: PhenomenonChannel;
  /** 감지 문턱 0 초과 1 이하 — 현상의 세기가 이 값 이상이어야 감지된다. 낮을수록 예민하다 */
  readonly threshold: number;
  /** 도달 거리 (m, O2 `physical.distance.{entity}` 와 같은 축). 0 이면 같은 자리만 */
  readonly range: number;
}

/** 주체의 감각 — 통로별 문턱과 거리의 묶음. */
export interface PerceptionProfile {
  readonly channels: readonly PerceptionAcuity[];
}

/** 거리의 위쪽 끝 — O2 `physical.distance.{entity}` 의 범위 그대로. */
export const MAX_PERCEPTION_RANGE = 1000000;

/** 감지에 실패하는 이유. */
export type PerceptionMiss =
  | 'no-channel' // 그 통로가 이 주체에게 아예 없다
  | 'too-faint' // 통로는 있으나 세기가 문턱에 못 미친다
  | 'too-far'; // 세기는 충분하나 거리가 닿지 않는다

/** 현상 하나에 대한 감지 판정 — 감지하지 못했으면 왜 못 했는지가 함께 나온다. */
export interface PerceptionVerdict {
  readonly channel: PhenomenonChannel;
  readonly perceived: boolean;
  readonly miss: PerceptionMiss | null;
  readonly message: string;
}

/** 통로 하나의 성격을 찾는다. */
export function channelSpec(channel: PhenomenonChannel): ChannelSpec | null {
  return CHANNEL_SPECS.find((spec) => spec.channel === channel) ?? null;
}

/** 몸을 거치는 통로인가. */
export function isBodyChannel(channel: PhenomenonChannel): boolean {
  return channelSpec(channel)?.route === 'body';
}

/** 이 프로필에서 그 통로의 감도. 없으면 null. */
export function acuityOf(
  profile: PerceptionProfile,
  channel: PhenomenonChannel,
): PerceptionAcuity | null {
  return profile.channels.find((entry) => entry.channel === channel) ?? null;
}

/** 열려 있는 통로들 (선언 순서). */
export function openChannels(profile: PerceptionProfile): readonly PhenomenonChannel[] {
  return profile.channels.map((entry) => entry.channel);
}

/**
 * 이 주체가 그 현상을 감지하는가.
 * 현상에서 읽는 것은 통로와 세기뿐이다 — 어디서 났는지(placeId)를 거리로 바꾸는 일은
 * 위치를 아는 R3 의 몫이고, S0 은 그 거리를 받아서 문턱과만 비교한다.
 */
export function perceives(
  profile: PerceptionProfile,
  phenomenon: Pick<Phenomenon, 'channel' | 'intensity'>,
  distance: number,
): PerceptionVerdict {
  const label = channelSpec(phenomenon.channel)?.label ?? phenomenon.channel;
  const acuity = acuityOf(profile, phenomenon.channel);
  if (acuity === null) {
    return {
      channel: phenomenon.channel,
      perceived: false,
      miss: 'no-channel',
      message: `${label} 통로가 없다 — 이 주체에게 그 현상은 일어나지 않은 것과 같다`,
    };
  }
  if (phenomenon.intensity < acuity.threshold) {
    return {
      channel: phenomenon.channel,
      perceived: false,
      miss: 'too-faint',
      message: `${label} 세기 ${String(phenomenon.intensity)} 가 문턱 ${String(acuity.threshold)} 에 못 미친다`,
    };
  }
  if (distance > acuity.range) {
    return {
      channel: phenomenon.channel,
      perceived: false,
      miss: 'too-far',
      message: `${label} 이 닿는 거리는 ${String(acuity.range)}m 인데 ${String(distance)}m 떨어져 있다`,
    };
  }
  return {
    channel: phenomenon.channel,
    perceived: true,
    miss: null,
    message: `${label} 세기 ${String(phenomenon.intensity)} · ${String(distance)}m — 감지한다`,
  };
}

/** 감지 프로필이 이 주체에게 온전한가. 경계(S0-a)를 함께 본다 — 몸 없는 자에게 눈은 없다. */
export function checkPerception(
  subject: SubjectRef,
  profile: PerceptionProfile,
  boundaries: readonly Boundary[],
  out: SubjectViolation[],
): void {
  const hasBody = boundaries.some((boundary) => boundary.kind === 'body');
  const seen = new Set<PhenomenonChannel>();

  for (const [index, acuity] of profile.channels.entries()) {
    const path = `$.perception.channels[${String(index)}]`;
    const spec = channelSpec(acuity.channel);
    if (spec === null) {
      violateSubject(
        out,
        subject,
        'unknown-channel',
        `${path}.channel`,
        `현상 통로는 [${PHENOMENON_CHANNELS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(acuity.channel)}`,
      );
      continue;
    }
    if (seen.has(acuity.channel)) {
      violateSubject(
        out,
        subject,
        'duplicate-channel',
        `${path}.channel`,
        `${spec.label} 통로가 두 번 선언됐다 — 어느 문턱이 진짜인지 알 수 없다`,
      );
      continue;
    }
    seen.add(acuity.channel);

    if (!(acuity.threshold > 0) || acuity.threshold > 1 || !Number.isFinite(acuity.threshold)) {
      violateSubject(
        out,
        subject,
        'omniscient-channel',
        `${path}.threshold`,
        `${spec.label} 문턱은 0 초과 1 이하여야 한다 — ${String(acuity.threshold)}. 문턱 0 은 세기 0 의 현상까지 감지한다는 뜻이고, 그러면 은폐도 기만도 성립하지 않는다`,
      );
    }
    if (!Number.isFinite(acuity.range) || acuity.range < 0 || acuity.range > MAX_PERCEPTION_RANGE) {
      violateSubject(
        out,
        subject,
        'bad-range',
        `${path}.range`,
        `${spec.label} 도달 거리는 0~${String(MAX_PERCEPTION_RANGE)}m 여야 한다 (O2 physical.distance) — ${String(acuity.range)}`,
      );
    }
    if (spec.route === 'body' && !hasBody) {
      violateSubject(
        out,
        subject,
        'bodiless-sense',
        `${path}.channel`,
        `몸 없는 ${subject.subjectKind} 에게 ${spec.label} 은 열리지 않는다 — 보고와 의념 잔향으로만 안다`,
      );
    }
  }

  if (profile.channels.length === 0) {
    violateSubject(
      out,
      subject,
      'senseless-subject',
      '$.perception.channels',
      '통로 없는 주체는 "무엇을 감지할 수 있는가" 에 답하지 못한다 — 세계가 그에게 일어나지 않는다',
    );
  }
}

/** 감지를 한 줄로 접는다 — 5질문 응답표의 첫 줄이 된다. */
export function perceptionSummary(profile: PerceptionProfile): string {
  if (profile.channels.length === 0) return '아무것도 감지하지 못한다';
  return profile.channels
    .map(
      (acuity) =>
        `${channelSpec(acuity.channel)?.label ?? acuity.channel} ≥${String(acuity.threshold)} · ${String(acuity.range)}m`,
    )
    .join(' · ');
}
