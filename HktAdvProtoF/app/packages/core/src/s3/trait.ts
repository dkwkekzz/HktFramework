// S3-b 성격 — 원문 S3 조립식의 마지막 줄, "+ 개인 성격".
//
// 성격을 자리로 두면 세계가 무너진다. "겁이 많다" 를 새 상태로 적으면 그 값을 읽는 규칙이 따로
// 필요해지고, 그 규칙은 다시 다른 성격을 부르고, 결국 성격의 수만큼 세계가 늘어난다.
// 그래서 여기서는 성격에게 자리를 주지 않는다. 성격이 하는 일은 하나뿐이다:
//
//   **이미 있는 값을 흔든다.**
//
// 겁이 많은 사냥꾼은 남과 다른 것을 보지 않는다 — 같은 붉은 빛을 보고 **덜 확신하고**,
// 같은 허기를 **더 급하게** 느끼고, 같은 신뢰를 **덜 밀** 뿐이다. 흔들 자리는 셋으로 고정한다:
//
//   need-urgency      의존의 급함 (D4 압력의 재료)
//   value-weight      유지의 미는 힘 (P4 목적 선택의 가중치)
//   reading-confidence 읽기의 확신 (R 계층 믿음의 세기)
//
// 셋 다 이미 종·문화가 놓아 둔 값이다. 그래서 성격은 **없는 자리를 흔들 수 없다** — 그 개체에게
// 그 자리가 없으면 흔들 것이 없고, 흔들 것 없는 기울기는 성격이 아니라 이름이다.
//
// 흔든 결과는 반드시 원래 값의 범위 안에 머문다 (0 초과 1 이하). 성격이 값의 상한을 넘길 수
// 있으면 그것은 성격이 아니라 능력이고, 능력은 O0 를 지나야 한다.

import type { Id } from '../v1/id.ts';
import type { Rule } from '../o1/operation.ts';
import { violateInstance, type InstanceRef, type InstanceViolation } from './violation.ts';

/** 성격이 흔들 수 있는 자리 3종 — 늘리려면 그것도 작업 카드로. */
export const TUNE_TARGETS = [
  'need-urgency', // 의존의 급함
  'value-weight', // 유지의 미는 힘
  'reading-confidence', // 읽기의 확신
] as const;
export type TuneTarget = (typeof TUNE_TARGETS)[number];

/** 흔들 자리를 사람이 읽는 한 마디로. */
export const TUNE_LABELS: Readonly<Record<TuneTarget, string>> = {
  'need-urgency': '의존의 급함',
  'value-weight': '유지의 미는 힘',
  'reading-confidence': '읽기의 확신',
};

/** 배수의 양끝 — 이보다 세게 흔들면 성격이 아니라 다른 개체다. */
export const MIN_TUNE_SCALE = 0.25;
export const MAX_TUNE_SCALE = 4;

/** 성격이 흔드는 자리 하나. */
export interface Tune {
  readonly target: TuneTarget;
  /**
   * 무엇을 흔드는가 — 그 자리의 열쇠.
   * need·value 는 O2 경로(`hunger`, `trust.subject:…`), reading 은 표식(`light:붉은 장막의 빛`).
   */
  readonly key: string;
  /** 배수 (0.25~4, 1 제외). 1 이면 흔들지 않는 것과 같다 */
  readonly scale: number;
  /** 왜 이 개체에게서 이 값이 흔들리는가 */
  readonly note: string;
}

/** 개인 성격 하나 — O1 Rule 이다 ("이 개체에게서는 이 값이 이렇게 흔들린다"). */
export interface Trait extends Rule {
  readonly tunes: readonly Tune[];
}

/** 성격을 세울 때 손으로 적는 것. */
export interface TraitSpec {
  readonly id: Id;
  readonly name: string;
  readonly domain: Rule['domain'];
  readonly when: readonly string[];
  readonly then: readonly string[];
  readonly axiomId: Id | null;
  readonly tunes: readonly Tune[];
}

/** 선언에서 성격을 세운다. */
export function buildTrait(spec: TraitSpec): Trait {
  return {
    kind: 'Rule',
    id: spec.id,
    domain: spec.domain,
    name: spec.name,
    when: spec.when,
    then: spec.then,
    axiomId: spec.axiomId,
    tunes: spec.tunes,
  };
}

/** 흔드는 자리 하나의 열쇠 — 무엇을 어디서. */
export function tuneKey(tune: Tune): string {
  return `${tune.target}:${tune.key}`;
}

/**
 * 배수를 값에 먹인다 — 결과는 언제나 0 초과 1 이하다.
 * 성격은 값을 흔들 뿐 상한을 넘기지 못한다. 0 으로 떨어뜨리지도 못한다 —
 * 없애는 것은 흔드는 것이 아니라 지우는 것이고, 지우는 일은 문화·자리의 몫이다(S2 금기).
 */
export function tuned(value: number, scale: number): number {
  const raw = value * scale;
  if (!Number.isFinite(raw)) return value;
  return Math.min(1, Math.max(Number.EPSILON, raw));
}

/** 성격 여럿이 흔드는 자리를 한 표로 — 같은 자리를 둘이 흔들면 앞의 것이 남는다(검사가 먼저 막는다). */
export function tuneTable(traits: readonly Trait[]): ReadonlyMap<string, Tune> {
  const table = new Map<string, Tune>();
  for (const trait of traits) {
    for (const tune of trait.tunes) {
      if (table.has(tuneKey(tune))) continue;
      table.set(tuneKey(tune), tune);
    }
  }
  return table;
}

/** 그 자리의 배수 — 흔들지 않으면 1. */
export function scaleFor(
  table: ReadonlyMap<string, Tune>,
  target: TuneTarget,
  key: string,
): number {
  return table.get(`${target}:${key}`)?.scale ?? 1;
}

/** 개체가 실제로 가진 자리들 — 성격이 흔들 수 있는 전부. */
export interface TunableKeys {
  readonly needs: readonly string[];
  readonly values: readonly string[];
  readonly readings: readonly string[];
}

/** 그 자리 종류가 갖는 열쇠 목록. */
function keysFor(available: TunableKeys, target: TuneTarget): readonly string[] {
  if (target === 'need-urgency') return available.needs;
  if (target === 'value-weight') return available.values;
  return available.readings;
}

/**
 * 성격 묶음이 이 개체 위에 설 수 있는가.
 * `available` 을 넘기지 않으면 "그 자리가 있는가" 검사는 건너뛴다 (성격만 따로 볼 때).
 */
export function checkTraits(
  subject: InstanceRef,
  traits: readonly Trait[],
  available: TunableKeys | null,
  out: InstanceViolation[],
  base = '$.traits',
): void {
  const seen = new Map<string, string>();

  for (const [index, trait] of traits.entries()) {
    const path = `${base}[${String(index)}]`;

    if (trait.name === '' || trait.when.length === 0 || trait.then.length === 0) {
      violateInstance(
        out,
        subject,
        'bad-trait',
        path,
        '성격도 O1 Rule 이다 — 이름·언제·그러면이 있어야 한다',
      );
      continue;
    }

    if (trait.tunes.length === 0) {
      violateInstance(
        out,
        subject,
        'idle-trait',
        `${path}.tunes`,
        `${trait.name} 이 아무 값도 흔들지 않는다 — 흔들지 않는 기울기는 성격이 아니라 이름이다`,
      );
      continue;
    }

    for (const [order, tune] of trait.tunes.entries()) {
      const tunePath = `${path}.tunes[${String(order)}]`;

      if (!TUNE_TARGETS.includes(tune.target)) {
        violateInstance(
          out,
          subject,
          'bad-tune',
          `${tunePath}.target`,
          `성격이 흔들 수 있는 것은 [${TUNE_TARGETS.join(' ')}] 셋뿐이다 — ${JSON.stringify(tune.target)}. 새 자리를 만들려면 그것은 성격이 아니다`,
        );
        continue;
      }
      if (tune.key === '') {
        violateInstance(
          out,
          subject,
          'bad-tune',
          `${tunePath}.key`,
          '무엇을 흔드는지 적지 않았다 — 대상 없는 배수는 아무 데도 걸리지 않는다',
        );
        continue;
      }

      const key = tuneKey(tune);
      const owner = seen.get(key);
      if (owner !== undefined) {
        violateInstance(
          out,
          subject,
          owner === trait.name ? 'duplicate-tune' : 'conflicting-trait',
          `${tunePath}.key`,
          owner === trait.name
            ? `${trait.name} 이 ${TUNE_LABELS[tune.target]} ${tune.key} 를 두 번 흔든다`
            : `${owner} 와 ${trait.name} 이 같은 자리(${TUNE_LABELS[tune.target]} ${tune.key})를 흔든다 — 어느 쪽이 이길지 알 수 없다`,
        );
        continue;
      }
      seen.set(key, trait.name);

      if (tune.scale === 1) {
        violateInstance(
          out,
          subject,
          'unit-tune',
          `${tunePath}.scale`,
          `배수 1 은 흔들지 않는 것과 같다 — ${tune.key}`,
        );
      } else if (
        !Number.isFinite(tune.scale) ||
        tune.scale < MIN_TUNE_SCALE ||
        tune.scale > MAX_TUNE_SCALE
      ) {
        violateInstance(
          out,
          subject,
          'bad-tune',
          `${tunePath}.scale`,
          `배수는 ${String(MIN_TUNE_SCALE)}~${String(MAX_TUNE_SCALE)} 여야 한다 — ${String(tune.scale)}. 이보다 세게 흔들면 성격이 아니라 다른 개체다`,
        );
      }
      if (tune.note === '') {
        violateInstance(
          out,
          subject,
          'bad-tune',
          `${tunePath}.note`,
          `${tune.key} 가 왜 흔들리는지 적지 않았다 — 근거 없는 기울기는 개체를 설명하지 못한다`,
        );
      }

      // 성격은 새 자리를 만들지 못한다 — 흔들 것이 없으면 그 성격은 이 개체의 것이 아니다.
      if (available === null) continue;
      const keys = keysFor(available, tune.target);
      if (!keys.includes(tune.key)) {
        violateInstance(
          out,
          subject,
          'phantom-tune',
          `${tunePath}.key`,
          `이 개체에게 ${TUNE_LABELS[tune.target]} 「${tune.key}」 자리가 없다 — 성격은 있는 값을 흔들 뿐 새 자리를 만들지 못한다 (있는 것: ${keys.length === 0 ? '없다' : keys.join(', ')})`,
        );
      }
    }
  }
}

/** 성격을 한 줄로 접는다 — 개체 카드용. */
export function traitSummary(traits: readonly Trait[]): string {
  if (traits.length === 0) return '기울기가 없다';
  return traits
    .map(
      (trait) =>
        `${trait.name} (${trait.tunes.map((tune) => `${tune.key} ×${String(tune.scale)}`).join(', ')})`,
    )
    .join(' · ');
}
