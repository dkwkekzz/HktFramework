// S1-b 종의 감각 — 원문 S1 의 둘째 낱말, "종의 감각".
//
// S0-b 는 감각을 개체마다 손으로 적게 두었다. 사냥꾼 04 의 눈이 300m 를 보는 것은 그
// 개체 하나의 선언이었고, 옆 마을 사냥꾼이 3km 를 본다고 적어도 아무것도 막지 못했다.
// **감각은 종이 정한다.** 여기서 그 자리를 가져오고, 개체는 종에서 물려받는다 (perceptionOf).
//
// 종으로 올리면 S0 이 낼 수 없던 검사가 하나 생긴다: **기관과의 대조.**
//
//   몸을 거치는 통로(빛·소리·흔적·냄새)는 그것을 여는 기관이 몸에 있어야 한다.
//     눈 없이 빛을 보는 종은 없다. S0 은 "몸이 있는가" 까지만 물었지만 (bodiless-sense),
//     종은 어떤 몸인지를 알고 있으므로 "눈이 있는가" 를 물을 수 있다.
//   남을 거쳐 오는 통로(의념 잔향·보고)는 기관으로 열리지 않는다.
//     그것들은 몸이 아니라 관계를 타고 온다 — 그래서 몸 없는 조직·국가·신도 갖는다.
//
// 생애도 여기 걸린다. 유체는 성체만큼 보지 못한다 — 단계의 감각 배수(senseScale)가
// 거리와 문턱을 함께 흔든다. 같은 종의 같은 눈이라도 언제 태어났는지에 따라 다른 세계가 보인다.

import { PHENOMENON_CHANNELS, type PhenomenonChannel } from '../o1/operation.ts';
import {
  isBodyChannel,
  channelSpec,
  MAX_PERCEPTION_RANGE,
  type PerceptionProfile,
} from '../s0/perception.ts';
import { organOpening, organSpec, ORGAN_KINDS, type BodyPlan, type OrganKind } from './body.ts';
import { violateSpecies, type SpeciesRef, type SpeciesViolation } from './violation.ts';

/** 종이 여는 통로 하나 — S0 PerceptionAcuity 에 "무엇이 이것을 여는가" 를 더한 것. */
export interface SenseSpec {
  readonly channel: PhenomenonChannel;
  /** 성체 기준 감지 문턱 0 초과 1 이하 — 낮을수록 예민하다 */
  readonly threshold: number;
  /** 성체 기준 도달 거리 (m) */
  readonly range: number;
  /** 이 통로를 여는 기관. 남을 거쳐 오는 통로(의념 잔향·보고)는 null */
  readonly organ: OrganKind | null;
}

/** 감각 배수의 위쪽 끝 — 이보다 예민해지면 종이 아니라 능력이다 (능력은 O0 를 지나야 한다). */
export const MAX_SENSE_SCALE = 4;

/**
 * 종의 감각을 개체의 감각으로 편다.
 * 배수는 거리와 문턱을 반대로 흔든다 — 예민할수록 멀리 보고 낮은 문턱까지 잡는다.
 * 문턱은 1 을 넘을 수 없다 (세기의 위쪽 끝), 거리는 O2 거리 범위를 넘을 수 없다.
 */
export function perceptionOf(
  senses: readonly SenseSpec[],
  senseScale = 1,
): PerceptionProfile {
  return {
    channels: senses.map((sense) => ({
      channel: sense.channel,
      threshold: Math.min(1, sense.threshold / senseScale),
      range: Math.min(MAX_PERCEPTION_RANGE, sense.range * senseScale),
    })),
  };
}

/** 감각이 이 종에게 온전한가 — 몸을 거치는 통로는 그것을 여는 기관을 요구한다. */
export function checkSenses(
  species: SpeciesRef,
  senses: readonly SenseSpec[],
  body: BodyPlan | null,
  out: SpeciesViolation[],
): void {
  const seen = new Set<PhenomenonChannel>();

  for (const [index, sense] of senses.entries()) {
    const path = `$.senses[${String(index)}]`;
    const spec = channelSpec(sense.channel);
    if (spec === null) {
      violateSpecies(
        out,
        species,
        'unknown-channel',
        `${path}.channel`,
        `현상 통로는 [${PHENOMENON_CHANNELS.join(' ')}] 중 하나여야 한다 — ${JSON.stringify(sense.channel)}`,
      );
      continue;
    }
    if (seen.has(sense.channel)) {
      violateSpecies(
        out,
        species,
        'duplicate-sense',
        `${path}.channel`,
        `${spec.label} 통로가 두 번 선언됐다 — 어느 문턱이 이 종의 것인지 알 수 없다`,
      );
      continue;
    }
    seen.add(sense.channel);

    if (!(sense.threshold > 0) || sense.threshold > 1 || !Number.isFinite(sense.threshold)) {
      violateSpecies(
        out,
        species,
        'omniscient-sense',
        `${path}.threshold`,
        `${spec.label} 문턱은 0 초과 1 이하여야 한다 — ${String(sense.threshold)}. 문턱 0 은 세기 0 의 현상까지 감지한다는 뜻이고, 그러면 이 종 앞에서는 은폐도 기만도 성립하지 않는다`,
      );
    }
    if (!Number.isFinite(sense.range) || sense.range < 0 || sense.range > MAX_PERCEPTION_RANGE) {
      violateSpecies(
        out,
        species,
        'bad-sense-range',
        `${path}.range`,
        `${spec.label} 도달 거리는 0~${String(MAX_PERCEPTION_RANGE)}m 여야 한다 (O2 physical.distance) — ${String(sense.range)}`,
      );
    }

    if (!isBodyChannel(sense.channel)) {
      if (sense.organ !== null) {
        violateSpecies(
          out,
          species,
          'mediated-organ',
          `${path}.organ`,
          `${spec.label} 은 몸이 아니라 남을 거쳐 온다 — 여는 기관을 적을 수 없다 (${sense.organ})`,
        );
      }
      continue;
    }

    if (sense.organ === null) {
      violateSpecies(
        out,
        species,
        'organless-sense',
        `${path}.organ`,
        `${spec.label} 은 몸을 거치는 통로다 — 이 종의 무엇이 그것을 여는지 적어야 한다`,
      );
      continue;
    }
    const organ = organSpec(sense.organ);
    if (organ === null || !organ.opens.includes(sense.channel)) {
      violateSpecies(
        out,
        species,
        'mismatched-organ',
        `${path}.organ`,
        `${organ?.label ?? sense.organ} 은 ${spec.label} 을 열지 않는다 — 여는 것은 ${organsOpening(sense.channel)} 이다`,
      );
      continue;
    }
    if (organOpening(body, sense.channel) === null) {
      violateSpecies(
        out,
        species,
        'organless-sense',
        `${path}.organ`,
        `이 종의 몸에는 ${organ.label} 이 없다 — 없는 기관으로 ${spec.label} 을 받을 수는 없다`,
      );
    }
  }

  if (senses.length === 0) {
    violateSpecies(
      out,
      species,
      'senseless-species',
      '$.senses',
      '통로 없는 종에서 태어난 개체는 "무엇을 감지할 수 있는가" 에 답하지 못한다 — 세계가 그에게 일어나지 않는다',
    );
  }
}

/** 그 통로를 여는 기관들의 이름 — 사유 문장에 쓴다. */
function organsOpening(channel: PhenomenonChannel): string {
  const names = ORGANS_BY_CHANNEL[channel] ?? [];
  return names.length === 0 ? '아무 기관도 아니다' : names.join('·');
}

/** 통로별로 그것을 여는 기관 이름표 — ORGAN_SPECS 를 뒤집은 표. */
const ORGANS_BY_CHANNEL: Partial<Record<PhenomenonChannel, readonly string[]>> = (() => {
  const out: Partial<Record<PhenomenonChannel, string[]>> = {};
  for (const channel of PHENOMENON_CHANNELS) {
    const names: string[] = [];
    for (const organ of ORGAN_KINDS) {
      const spec = organSpec(organ);
      if (spec?.opens.includes(channel) === true) names.push(spec.label);
    }
    out[channel] = names;
  }
  return out;
})();

/** 감각을 한 줄로 접는다 — 종 카드용. */
export function senseSummary(senses: readonly SenseSpec[]): string {
  if (senses.length === 0) return '아무것도 감지하지 못한다';
  return senses
    .map((sense) => {
      const label = channelSpec(sense.channel)?.label ?? sense.channel;
      const by = sense.organ === null ? '' : `(${organSpec(sense.organ)?.label ?? sense.organ})`;
      return `${label}${by} ≥${String(sense.threshold)} · ${String(sense.range)}m`;
    })
    .join(' · ');
}
