// §4 사용자 입력 4필드의 결과 책임 (G-11)
//
// title 은 사용자의 것이고, desiredExperiences/prohibitedElements 는 §33.2 seed-contract 감사가
// 문장 단위로 되묻는다. 세계는 자기 출처(metadata.seedInput)를 들고 다닌다.
import { describe, expect, it } from "vitest";
import { FIRST_WORLD_AUDIT_CORPUS, FIRST_WORLD_CORPUS, FIRST_WORLD_ID, FIRST_WORLD_SEED_INPUT } from "../content/first-world";
import { buildManualWorld } from "../content/manual-world";
import { auditWorld } from "./AiAudit";
import { compileWorld } from "./CompilerPipeline";
import { RecordedTextGenerationPort } from "./RecordedTextGenerationPort";

function compile(seedInput = FIRST_WORLD_SEED_INPUT) {
  return compileWorld({
    port: new RecordedTextGenerationPort(FIRST_WORLD_CORPUS),
    seedInput,
    worldSeed: 42,
    worldId: FIRST_WORLD_ID,
  });
}

describe("§4 사용자 입력의 결과 책임 (G-11)", () => {
  it("title 은 컴파일러가 아니라 사용자에게서 온다", async () => {
    const original = await compile();
    expect(original.definition.metadata.title).toBe("제약의 대륙");

    const renamed = await compile({ ...FIRST_WORLD_SEED_INPUT, title: "다른 이름의 대륙" });
    expect(renamed.definition.metadata.title).toBe("다른 이름의 대륙");

    const { title: _dropped, ...untitled } = FIRST_WORLD_SEED_INPUT;
    const anonymous = await compile(untitled);
    expect(anonymous.definition.metadata.title).toBe("이름 없는 세계");
  }, 60_000);

  it("세계가 자기 출처(seedInput)를 들고 다닌다", async () => {
    const compiled = await compile();
    expect(compiled.definition.metadata.seedInput?.themes).toEqual(FIRST_WORLD_SEED_INPUT.themes);
    expect(compiled.definition.metadata.seedInput?.desiredExperiences).toEqual(
      FIRST_WORLD_SEED_INPUT.desiredExperiences,
    );
    expect(compiled.definition.metadata.seedInput?.prohibitedElements).toEqual(
      FIRST_WORLD_SEED_INPUT.prohibitedElements,
    );
  }, 60_000);

  it("seed-contract 감사가 바란 경험·금지 요소를 문장 단위로 되묻는다", async () => {
    const compiled = await compile();
    const report = await auditWorld(compiled.definition, new RecordedTextGenerationPort(FIRST_WORLD_AUDIT_CORPUS));
    const contract = report.checks.find((check) => check.code === "audit.seed-contract")!;
    expect(contract.skipped).toBe(false);
    expect(contract.asked).toBe(
      (FIRST_WORLD_SEED_INPUT.desiredExperiences?.length ?? 0) +
        (FIRST_WORLD_SEED_INPUT.prohibitedElements?.length ?? 0),
    );
  }, 60_000);

  it("출처 없는 세계(수동 세계)에서는 건너뛰되 그 사실을 남긴다", async () => {
    const report = await auditWorld(buildManualWorld(42), new RecordedTextGenerationPort(FIRST_WORLD_AUDIT_CORPUS));
    const contract = report.checks.find((check) => check.code === "audit.seed-contract")!;
    expect(contract.skipped).toBe(true);
    expect(contract.error).toContain("seedInput");
  }, 60_000);
});
