// 코드가 계산하는 파생값 (Phase-5 §5.1 각주 "AI 는 조건·프로필만 생성하고 배치 수치는 결정론 함수가 계산한다")
//
// 여기 있는 함수는 전부 순수 함수이거나 시드 RNG 만 쓴다. 같은 입력이면 항상 같은 세계가 나온다 —
// LLM 이 비결정적이어도 "같은 WorldDefinition + 같은 시드 → 같은 시뮬레이션"(§39, §44-12)이 깨지지 않는 이유다.
import { createRng } from "../shared/random";
import type { Position } from "../shared/state";

/** §13 — 위험·접근성·환경 안정성에서 희귀도를 계산한다. 기획서 공식 그대로 */
export function calculateResourceRarity(
  danger: number,
  accessibility: number,
  environmentalStability: number,
): number {
  return danger * 0.55 + (100 - accessibility) * 0.3 + (100 - environmentalStability) * 0.15;
}

/**
 * §16 절차 7 — 제약의 강도로 출력 범위를 계산한다.
 * 제약이 셀수록(severity 합), 대가가 클수록 출력 상한이 커진다. §11.4 증폭 규칙과 같은 방향이다.
 */
export function calculateAbilityOutputRange(
  restrictionSeverities: readonly number[],
  costAmounts: readonly number[],
  mastery: number,
): { min: number; max: number } {
  const severity = restrictionSeverities.reduce((sum, value) => sum + value, 0);
  const cost = costAmounts.reduce((sum, value) => sum + value, 0);
  const max = Math.round(severity * 0.8 + cost * 1.5 + mastery * 0.4);
  const min = Math.round(max * 0.2);
  return { min, max };
}

/** 능력의 대가 총량 — "강한 능력일수록 제약이나 대가가 증가한다"(§34) 검사의 입력 */
export function abilityCostWeight(
  restrictionSeverities: readonly number[],
  costAmounts: readonly number[],
): number {
  return (
    restrictionSeverities.reduce((sum, value) => sum + value, 0) +
    costAmounts.reduce((sum, value) => sum + value, 0) * 2
  );
}

export interface RegionBounds {
  width: number;
  height: number;
  depth: number;
}

/**
 * 지역 안의 좌표를 시드 RNG 로 뽑는다.
 * entityId 를 스트림 키로 쓰므로 배치 순서가 바뀌어도 같은 개체는 같은 자리에 놓인다.
 */
export function placeInRegion(
  worldSeed: number,
  entityId: string,
  regionId: string,
  bounds: RegionBounds,
  margin = 0.1,
): Position {
  const rng = createRng({ worldSeed, simulationStep: 0, entityId });
  const span = (size: number): number => size * margin + rng.next() * size * (1 - margin * 2);
  return {
    regionId,
    x: Math.round(span(bounds.width) * 10) / 10,
    y: Math.round(span(bounds.height) * 10) / 10,
    z: Math.round(span(bounds.depth) * 10) / 10,
  };
}

/** 특정 지점 주위에 흩뿌린다 (무리·군체·자원 노드) */
export function placeAround(
  worldSeed: number,
  entityId: string,
  center: Position,
  radius: number,
  bounds: RegionBounds,
): Position {
  const rng = createRng({ worldSeed, simulationStep: 0, entityId });
  const angle = rng.next() * Math.PI * 2;
  const distance = Math.sqrt(rng.next()) * radius;
  const clamp = (value: number, max: number): number =>
    Math.round(Math.min(Math.max(value, 0), max) * 10) / 10;
  return {
    regionId: center.regionId,
    x: clamp(center.x + Math.cos(angle) * distance, bounds.width),
    y: clamp(center.y + Math.sin(angle) * distance, bounds.height),
    z: clamp(center.z + (rng.next() - 0.5) * radius * 0.3, bounds.depth),
  };
}

/**
 * 자원 노드의 매장량 — 희귀도가 높을수록 적게, 지역의 풍요도가 높을수록 많게.
 * "특정 자원을 직접 배치하지 않는다. 지역의 조건으로부터 결정한다"(§13).
 */
export function deriveNodeAmount(baseAmount: number, rarity: number, worldSeed: number, entityId: string): number {
  const rng = createRng({ worldSeed, simulationStep: 0, entityId: `${entityId}#amount` });
  const scarcity = Math.max(0.15, 1 - rarity / 140);
  const jitter = 0.85 + rng.next() * 0.3;
  return Math.max(1, Math.round(baseAmount * scarcity * jitter));
}
