// Link Presentation — 이어짐의 수치와 신원을 "어떻게 보여줄지" 결정한다
// (결정 Layer 데이터).
//
// 04-gameview.spec.yaml 의 telemetry · binding 절(owner: observer)을 소비한다.
// 이 값들은 World Snapshot 에서 오지 않는다 — 관찰자 쪽에서 잰 것이므로 따로 해석한다.
// Capability(hud)는 여기서 만든 줄을 그대로 표시할 뿐 의미를 모른다.

import { RAW_CODE, type CodeTextFn } from './code-text';
import type { LinkTelemetry } from '../net/link-telemetry';

/**
 * 계량과 신원 줄의 이름을 부르는 문구 코드 — **말은 팩의 것이다** (문구 반전 ⑤).
 * 잰 값은 기반이 만들고(왕복 몇 ms 인가), 그 값을 뭐라 부르는지는 팩이 정한다.
 */
export const LINK_TEXT_CODES = [
  'link.round-trip',
  'link.arrival-rate',
  'link.since-last',
  'link.since-last.value',
  'link.sent',
  'link.reconnects',
  'binding.observer',
  'binding.character',
  'binding.world',
  'binding.world.in-process',
] as const;

export interface LinkLine {
  id: string;
  label: string;
  value: string;
  /** 값이 좋은지 나쁜지 — 표현(색)에 쓰인다. 게임 의미가 아니라 이어짐의 성질이다 */
  grade?: 'good' | 'warn' | 'bad';
}

export interface LinkBinding {
  observerId: string;
  characterId: string;
  worldAddress: string;
}

// 왕복 시간의 등급 경계 (ms). 표현 결정이므로 여기 둔다 — 세계의 값이 아니다.
const ROUNDTRIP_GOOD_MS = 120;
const ROUNDTRIP_WARN_MS = 350;
// 세계는 자기 시계로 꾸준히 내보낸다. 이보다 드물게 오면 사이가 막힌 것이다.
const ARRIVAL_GOOD_PER_SECOND = 20;
const ARRIVAL_WARN_PER_SECOND = 8;

/** 아직 잰 것이 없다 — 글자가 아니라 자리 표시다. 말이 아니므로 팩으로 가지 않는다 */
const UNKNOWN_VALUE = '—';

function gradeRoundTrip(ms: number | null): LinkLine['grade'] {
  if (ms === null) return undefined;
  if (ms <= ROUNDTRIP_GOOD_MS) return 'good';
  return ms <= ROUNDTRIP_WARN_MS ? 'warn' : 'bad';
}

function gradeArrival(rate: number): LinkLine['grade'] {
  if (rate >= ARRIVAL_GOOD_PER_SECOND) return 'good';
  return rate >= ARRIVAL_WARN_PER_SECOND ? 'warn' : 'bad';
}

/** telemetry 절 → 화면에 늘 떠 있는 줄들 (session.visibility: always) */
export function telemetryLines(
  telemetry: LinkTelemetry,
  textOf: CodeTextFn = RAW_CODE,
): LinkLine[] {
  const rtt = telemetry.roundTripMs;
  const since = telemetry.sinceLastObservationMs;

  return [
    {
      id: 'link.roundTrip',
      label: textOf('link.round-trip'),
      value: rtt === null ? UNKNOWN_VALUE : `${Math.round(rtt)}ms`,
      ...(gradeRoundTrip(rtt) ? { grade: gradeRoundTrip(rtt) } : {}),
    },
    {
      id: 'link.arrivalRate',
      label: textOf('link.arrival-rate'),
      value: `${telemetry.arrivalRatePerSecond.toFixed(1)}/s`,
      grade: gradeArrival(telemetry.arrivalRatePerSecond),
    },
    {
      id: 'link.sinceLast',
      label: textOf('link.since-last'),
      // 잰 것은 기반이고 그것을 어떤 문장으로 읽는지는 팩이다 — 값만 넘긴다
      value: since === null ? UNKNOWN_VALUE : textOf('link.since-last.value', `${Math.round(since)}`),
    },
    { id: 'link.sent', label: textOf('link.sent'), value: `${telemetry.sentCount}` },
    {
      id: 'link.reconnects',
      label: textOf('link.reconnects'),
      value: `${telemetry.reconnectCount}`,
      ...(telemetry.reconnectCount > 0 ? { grade: 'warn' as const } : {}),
    },
  ];
}

/** binding 절 → 무엇에 이어져 있는가. 새로 만드는 값이 없다 — 보이게 할 뿐이다 */
export function bindingLines(binding: LinkBinding, textOf: CodeTextFn = RAW_CODE): LinkLine[] {
  return [
    { id: 'binding.observerId', label: textOf('binding.observer'), value: binding.observerId },
    { id: 'binding.characterId', label: textOf('binding.character'), value: binding.characterId },
    {
      id: 'binding.worldAddress',
      label: textOf('binding.world'),
      value: binding.worldAddress || textOf('binding.world.in-process'),
    },
  ];
}
