// §35 지표의 합격선 (Phase-6 §6.2 — "합격선은 수동 세계의 측정치를 기준선으로 삼아 결정한다")
//
// 다양성·깊이 점수(§35)에는 기획서가 정한 절대 기준이 없다. 그래서 임의 상수를 만들지 않고,
// **Phase 1~4 가 손으로 완성한 수동 세계**의 30일 측정치를 그대로 합격선으로 쓴다.
// 뜻은 하나다 — 생성된 세계는 최소한 손으로 만든 세계만큼은 살아 있어야 한다.
//
// 기준선 갱신: `npx vite-node src/scripts/baseline-simulation.ts`
import baselineDocument from "../content/manual-world/simulation-baseline.json";
import type { SimulationTestResult } from "./SimulationTester";

export interface SimulationBaseline {
  source: string;
  worldId: string;
  worldSeed: number;
  days: number;
  diversityScore: number;
  depthScore: number;
  changesPerDay: number;
  uniqueActionTypes: number;
  uniqueEventTypes: number;
  totalEvents: number;
}

export const SIMULATION_BASELINE = baselineDocument as unknown as SimulationBaseline;

export interface BaselineRow {
  item: string;
  baseline: number;
  actual: number;
  ok: boolean;
}

/** 측정치를 수동 세계 기준선과 맞춰 본다 — 낮으면 그대로 ✗ 로 남긴다 */
export function compareToSimulationBaseline(result: SimulationTestResult): BaselineRow[] {
  const row = (item: string, baseline: number, actual: number): BaselineRow => ({
    item,
    baseline,
    actual,
    // 소수 오차로 갈리지 않게 0.01 까지만 본다
    ok: Math.round(actual * 100) >= Math.round(baseline * 100),
  });
  return [
    row("다양성 점수", SIMULATION_BASELINE.diversityScore, result.diversityScore),
    row("깊이 점수", SIMULATION_BASELINE.depthScore, result.depthScore),
    row("일평균 change", SIMULATION_BASELINE.changesPerDay, result.metrics.changesPerDay),
    row("행동 종류", SIMULATION_BASELINE.uniqueActionTypes, result.metrics.uniqueActionTypes),
    row("사건 종류", SIMULATION_BASELINE.uniqueEventTypes, result.metrics.uniqueEventTypes),
  ];
}

export function baselineSummary(): string {
  const b = SIMULATION_BASELINE;
  return (
    `${b.worldId} 시드 ${b.worldSeed} ${b.days}일 — 다양성 ${b.diversityScore.toFixed(2)} · 깊이 ${b.depthScore.toFixed(2)} · ` +
    `일평균 change ${b.changesPerDay.toFixed(0)} · 행동 ${b.uniqueActionTypes}종 · 사건 ${b.uniqueEventTypes}종`
  );
}
