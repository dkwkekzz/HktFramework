// §41 첫 세계를 생성해 보고서를 찍는다 (Phase-5 구현 스텝 6)
// 실행: npx vite-node src/scripts/generate-first-world.ts [-- --seed=42]
import { FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { compileWorld } from "../generation/CompilerPipeline";
import { RecordedTextGenerationPort } from "../generation/RecordedTextGenerationPort";

const seedArg = process.argv.find((value) => value.startsWith("--seed="));
const worldSeed = seedArg === undefined ? 42 : Number(seedArg.split("=")[1]);

const port = new RecordedTextGenerationPort(FIRST_WORLD_CORPUS);
const result = await compileWorld({
  port,
  seedInput: FIRST_WORLD_SEED_INPUT,
  worldSeed,
  worldId: FIRST_WORLD_ID,
});

console.log(`\n=== 세계 생성 컴파일러 15단계 — 시드 ${worldSeed} ===\n`);
for (const step of result.steps) {
  const mark = step.status === "failed" ? "✗" : step.status === "reused" ? "=" : "✓";
  console.log(
    `${mark} ${String(step.index).padStart(2)} ${step.title.padEnd(12)} ${step.summary}` +
      (step.taskIds.length > 0 ? `  (호출 ${step.taskIds.length})` : ""),
  );
}

const definition = result.definition;
console.log(`\n생성 호출 ${port.calls.length}회 · 최대 입력 ${port.maxInputBytes}B · 심볼 ${result.symbols.size}개`);
console.log(
  `정의: 명제 ${definition.axioms.length} · 상태 ${definition.stateSchemas.length} · 규칙 ${definition.ruleDefinitions.length} · ` +
    `지역 ${definition.spaces.regions.length} · 장소 ${definition.spaces.locations.length} · 자원 ${definition.resources.length} · ` +
    `종족 ${definition.species.length} · 조직 ${definition.factions.length} · 능력 ${definition.abilitySystem?.abilities.length ?? 0} · ` +
    `목적 그래프 ${definition.goalTemplates.length} · 행동 ${definition.actionDefinitions.length} · 사건 패턴 ${definition.eventPatterns.length} · ` +
    `개체 ${definition.bootstrap.entities.length}`,
);

if (result.issues.length > 0) {
  console.log(`\n검증 이슈 ${result.issues.length}건`);
  for (const issue of result.issues.slice(0, 40)) {
    console.log(`  [${issue.level}] ${issue.code} ${issue.targetId}: ${issue.message}`);
  }
  process.exitCode = 1;
}
