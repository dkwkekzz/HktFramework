// §7 불변 명제의 하드 계약 (G-12) — 수정 라운드는 헌법을 고칠 수 없다
import { describe, expect, it } from "vitest";
import { buildManualWorld } from "../content/manual-world";
import { assertImmutableAxiomsPreserved } from "./RepairLoop";

describe("§7 불변 명제 (G-12)", () => {
  it("같은 명제는 통과한다", () => {
    const world = buildManualWorld(42);
    expect(() => assertImmutableAxiomsPreserved(world, structuredClone(world))).not.toThrow();
  });

  it("불변 명제를 바꾸면 즉시 중단이다", () => {
    const before = buildManualWorld(42);
    const after = structuredClone(before);
    after.axioms[0]!.statement = "모든 생명은 흩어지려 한다.";
    expect(() => assertImmutableAxiomsPreserved(before, after)).toThrowError(/불변 명제를 바꿨다/);
  });

  it("불변 명제를 지우면 즉시 중단이다", () => {
    const before = buildManualWorld(42);
    const after = structuredClone(before);
    after.axioms = after.axioms.slice(1);
    expect(() => assertImmutableAxiomsPreserved(before, after)).toThrowError(/불변 명제를 지웠다/);
  });

  it("불변이 아닌 명제는 수정 라운드가 다듬을 수 있다", () => {
    const before = structuredClone(buildManualWorld(42));
    before.axioms[0]!.immutable = false;
    const after = structuredClone(before);
    after.axioms[0]!.statement = "다듬은 문장";
    expect(() => assertImmutableAxiomsPreserved(before, after)).not.toThrow();
  });
});
