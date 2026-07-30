// §35 지표 기준선 고정 (Phase-6 §6.2)
// 실행: npx vite-node src/scripts/baseline-simulation.ts
//
// 수동 세계(Phase 1~4 완성본)의 30일 측정치를 그대로 굳힌다. 이후 생성 세계는 이 값을 합격선으로 판정한다.
// 코어나 수동 콘텐츠를 바꿔 지표가 달라지면 이 스크립트로 다시 고정하고, 무엇이 왜 달라졌는지 남긴다.
import { writeFileSync } from "node:fs";
import { runSimulationTest } from "../generation/SimulationTester";

const worldSeed = 42;
const days = 30;
const result = await runSimulationTest({ worldSeed, days });

const document = {
  source:
    "Phase 6 — 수동 세계(Phase 1~4 완성본)의 무개입 30일 측정치. §35 다양성·깊이 합격선의 근거. " +
    "2차 재검증 F-3·F-4·F-5(§23 채널 4종·§24 배신 기억·§21 방어 행동)로 세계가 바뀌어 재고정",
  worldId: result.worldId,
  worldSeed,
  days,
  diversityScore: result.diversityScore,
  depthScore: result.depthScore,
  changesPerDay: result.metrics.changesPerDay,
  uniqueActionTypes: result.metrics.uniqueActionTypes,
  uniqueEventTypes: result.metrics.uniqueEventTypes,
  totalEvents: result.totalEvents,
};

const target = new URL("../content/manual-world/simulation-baseline.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(`기준선 고정: 다양성 ${document.diversityScore.toFixed(2)} · 깊이 ${document.depthScore.toFixed(2)} · 일평균 change ${document.changesPerDay.toFixed(0)}`);
console.log(`판정 ${result.verdicts.filter((v) => v.ok).length}/${result.verdicts.length} 통과 · ${target.pathname}`);
