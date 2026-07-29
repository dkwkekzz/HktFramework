// golden 프리셋·해시 생성 — `npm run golden` (03-phase1 §1.8).
// 프리셋을 수정하면 이 스크립트를 다시 돌려 presets/hashes JSON 을 갱신하고,
// 생성 알고리즘이 바뀌었으면 generatorVersion 을 올린 커밋에 사유를 명시한다 (02 §5-6).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBladeMesh, makeStraightBladeDesign } from "../src/mesh/blade.js";
import { makeSwordDesign, buildSword, hashSword } from "../src/mesh/sword.js";
import { bakeSword } from "../src/bake/bake.js";
import { makeMaterialGraph } from "../src/material/primitives.js";
import { AGED_PRESETS } from "../src/material/presets.js";
import { hashMesh } from "../src/core/hash.js";
import { analyzeManifold, countDegenerate3DTriangles, signedVolume } from "../src/mesh/topology.js";
import { validateUVs, assertValidUV } from "../src/uv/validate.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GOLDEN_DIR = join(ROOT, "test", "golden");
const TEXTURE_SIZE = 1024;

const fuller = (start, end, width, depth) => ({ enabled: true, start, end, width, depth });

// 20종 — 직선 양날검 5 / 세검 4 / 대검 4 / 단날 직선검 3 / 판타지 4 (원본 §31.6 유형 커버)
const PRESETS = [
  // 직선 양날검 (arming/longsword 계열)
  { name: "arming-diamond", params: { length: 0.9, widthRoot: 0.055, widthMid: 0.048, widthTip: 0.03, thicknessRoot: 0.006, thicknessTip: 0.004, crossSection: "diamond", ridgeHeight: 0.5, tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 32, segCross: 16 } },
  { name: "arming-lenticular-fuller", params: { length: 0.92, widthRoot: 0.058, widthMid: 0.05, widthTip: 0.032, thicknessRoot: 0.0065, thicknessTip: 0.004, crossSection: "lenticular", ridgeHeight: 0, fuller: fuller(0.03, 0.55, 0.02, 0.0025), tipType: "spear", tipStart: 0.78, tipEndScale: 0.06, segLong: 36, segCross: 20 } },
  { name: "longsword-hex", params: { length: 1.15, widthRoot: 0.05, widthMid: 0.044, widthTip: 0.026, thicknessRoot: 0.007, thicknessTip: 0.0045, crossSection: "hexagonal", ridgeHeight: 0.3, tipType: "needle", tipStart: 0.75, tipEndScale: 0.04, segLong: 40, segCross: 16 } },
  { name: "longsword-diamond-fuller", params: { length: 1.2, widthRoot: 0.052, widthMid: 0.046, widthTip: 0.028, thicknessRoot: 0.0075, thicknessTip: 0.005, crossSection: "diamond", ridgeHeight: 0.6, fuller: fuller(0.05, 0.6, 0.018, 0.003), tipType: "spear", tipStart: 0.8, tipEndScale: 0.05, segLong: 44, segCross: 20 } },
  { name: "shortsword-lenticular", params: { length: 0.65, widthRoot: 0.05, widthMid: 0.046, widthTip: 0.034, thicknessRoot: 0.0055, thicknessTip: 0.004, crossSection: "lenticular", ridgeHeight: 0, tipType: "rounded", tipStart: 0.82, tipEndScale: 0.1, segLong: 28, segCross: 16 } },

  // 찌르기용 세검 (rapier/estoc 계열)
  { name: "rapier-diamond", params: { length: 1.05, widthRoot: 0.025, widthMid: 0.018, widthTip: 0.008, thicknessRoot: 0.007, thicknessTip: 0.004, crossSection: "diamond", ridgeHeight: 0.8, tipType: "needle", tipStart: 0.6, tipEndScale: 0.03, segLong: 48, segCross: 16 } },
  { name: "rapier-hex", params: { length: 1.1, widthRoot: 0.022, widthMid: 0.016, widthTip: 0.007, thicknessRoot: 0.0075, thicknessTip: 0.0045, crossSection: "hexagonal", ridgeHeight: 0.4, tipType: "needle", tipStart: 0.55, tipEndScale: 0.03, segLong: 48, segCross: 16 } },
  { name: "estoc-diamond", params: { length: 1.15, widthRoot: 0.03, widthMid: 0.02, widthTip: 0.009, thicknessRoot: 0.009, thicknessTip: 0.005, crossSection: "diamond", ridgeHeight: 1.0, tipType: "needle", tipStart: 0.5, tipEndScale: 0.035, segLong: 44, segCross: 16 } },
  { name: "smallsword-lenticular", params: { length: 0.8, widthRoot: 0.02, widthMid: 0.015, widthTip: 0.007, thicknessRoot: 0.006, thicknessTip: 0.0035, crossSection: "lenticular", ridgeHeight: 0, tipType: "needle", tipStart: 0.6, tipEndScale: 0.04, segLong: 40, segCross: 16 } },

  // 넓은 대검 (greatsword 계열)
  { name: "greatsword-diamond", params: { length: 1.5, widthRoot: 0.07, widthMid: 0.06, widthTip: 0.038, thicknessRoot: 0.009, thicknessTip: 0.006, crossSection: "diamond", ridgeHeight: 0.4, tipType: "spear", tipStart: 0.82, tipEndScale: 0.06, segLong: 52, segCross: 20 } },
  { name: "greatsword-hex-fuller", params: { length: 1.55, widthRoot: 0.072, widthMid: 0.062, widthTip: 0.04, thicknessRoot: 0.0095, thicknessTip: 0.006, crossSection: "hexagonal", ridgeHeight: 0.3, fuller: fuller(0.04, 0.5, 0.025, 0.0035), tipType: "spear", tipStart: 0.8, tipEndScale: 0.07, segLong: 56, segCross: 20 } },
  { name: "zweihander-flat", params: { length: 1.7, widthRoot: 0.065, widthMid: 0.058, widthTip: 0.036, thicknessRoot: 0.01, thicknessTip: 0.0065, crossSection: "flat", ridgeHeight: 0, tipType: "spear", tipStart: 0.85, tipEndScale: 0.08, segLong: 60, segCross: 16 } },
  { name: "claymore-lenticular", params: { length: 1.4, widthRoot: 0.068, widthMid: 0.06, widthTip: 0.04, thicknessRoot: 0.0085, thicknessTip: 0.0055, crossSection: "lenticular", ridgeHeight: 0, fuller: fuller(0.05, 0.45, 0.022, 0.003), tipType: "rounded", tipStart: 0.85, tipEndScale: 0.12, segLong: 48, segCross: 20 } },

  // 단날 직선검 (준대칭 — MVP 프로파일 대칭 범위 내 근사)
  { name: "backsword-flat", params: { length: 0.85, widthRoot: 0.042, widthMid: 0.04, widthTip: 0.03, thicknessRoot: 0.0065, thicknessTip: 0.0045, crossSection: "flat", ridgeHeight: 0, tipType: "spear", tipStart: 0.85, tipEndScale: 0.1, segLong: 32, segCross: 16 } },
  { name: "messer-flat-fuller", params: { length: 0.75, widthRoot: 0.045, widthMid: 0.043, widthTip: 0.032, thicknessRoot: 0.006, thicknessTip: 0.004, crossSection: "flat", ridgeHeight: 0, fuller: fuller(0.02, 0.6, 0.015, 0.002), tipType: "spear", tipStart: 0.82, tipEndScale: 0.09, segLong: 32, segCross: 16 } },
  { name: "tanto-hex", params: { length: 0.35, widthRoot: 0.03, widthMid: 0.028, widthTip: 0.022, thicknessRoot: 0.006, thicknessTip: 0.004, crossSection: "hexagonal", ridgeHeight: 0.2, tipType: "spear", tipStart: 0.8, tipEndScale: 0.1, segLong: 20, segCross: 16 } },

  // 단순 판타지 검
  { name: "fantasy-wide-diamond", params: { length: 1.1, widthRoot: 0.1, widthMid: 0.085, widthTip: 0.05, thicknessRoot: 0.012, thicknessTip: 0.007, crossSection: "diamond", ridgeHeight: 0.7, tipType: "spear", tipStart: 0.75, tipEndScale: 0.08, segLong: 40, segCross: 20 } },
  { name: "fantasy-cleaver-flat", params: { length: 0.95, widthRoot: 0.09, widthMid: 0.095, widthTip: 0.07, thicknessRoot: 0.011, thicknessTip: 0.008, crossSection: "flat", ridgeHeight: 0, tipType: "rounded", tipStart: 0.88, tipEndScale: 0.25, segLong: 36, segCross: 16 } },
  { name: "fantasy-needle-hex", params: { length: 1.3, widthRoot: 0.04, widthMid: 0.028, widthTip: 0.01, thicknessRoot: 0.009, thicknessTip: 0.004, crossSection: "hexagonal", ridgeHeight: 0.9, tipType: "needle", tipStart: 0.45, tipEndScale: 0.02, segLong: 52, segCross: 16 } },
  { name: "fantasy-broad-fuller", params: { length: 1.25, widthRoot: 0.085, widthMid: 0.075, widthTip: 0.045, thicknessRoot: 0.01, thicknessTip: 0.006, crossSection: "lenticular", ridgeHeight: 0, fuller: fuller(0.03, 0.7, 0.03, 0.004), tipType: "spear", tipStart: 0.8, tipEndScale: 0.06, segLong: 44, segCross: 24 } },
];

mkdirSync(GOLDEN_DIR, { recursive: true });

const presetsOut = [];
const hashesOut = {};
let failed = false;

for (const preset of PRESETS) {
  const design = makeStraightBladeDesign(preset.params);
  const mesh = buildBladeMesh(design, TEXTURE_SIZE);
  const man = analyzeManifold(mesh);
  const deg3 = countDegenerate3DTriangles(mesh);
  const vol = signedVolume(mesh);
  const uv = validateUVs(mesh, TEXTURE_SIZE);
  const triangles = mesh.indices.length / 3;
  const hash = hashMesh(mesh);
  const problems = [];
  if (man.nonManifoldEdges > 0) problems.push(`nonManifold=${man.nonManifoldEdges}`);
  if (man.boundaryEdges > 0) problems.push(`boundary=${man.boundaryEdges}`);
  if (deg3 > 0) problems.push(`deg3D=${deg3}`);
  if (vol <= 0) problems.push(`volume=${vol}`);
  if (triangles > 5000) problems.push(`triangles=${triangles}`);
  try { assertValidUV(uv); } catch (e) { problems.push(e.message); }
  if (problems.length) {
    failed = true;
    console.error(`FAIL ${preset.name}: ${problems.join(", ")}`);
  } else {
    console.log(`ok   ${preset.name}  tris=${triangles}  hash=${hash}`);
  }
  presetsOut.push({ name: preset.name, params: preset.params, design });
  hashesOut[preset.name] = { hash, triangles };
}

if (failed) {
  console.error("golden 생성 실패 — 위 문제를 해결할 것");
  process.exit(1);
}

writeFileSync(join(GOLDEN_DIR, "blade-presets.json"), JSON.stringify(presetsOut, null, 2));
writeFileSync(join(GOLDEN_DIR, "blade-hashes.json"), JSON.stringify(hashesOut, null, 2));
console.log(`\n${PRESETS.length}종 칼날 프리셋 → test/golden/ 갱신 완료`);

// ── 검 전체 프리셋 5종 (04-phase2 §2.6 — 원본 §31.6 유형 커버) ──────────────
const bladeParamsOf = (name) => PRESETS.find((p) => p.name === name).params;

const SWORD_PRESETS = [
  {
    name: "knight-arming",
    params: {
      blade: bladeParamsOf("arming-diamond"),
      guard: { shape: "bar", width: 0.18, thickness: 0.025, depth: 0.02, bevel: 0.004 },
      grip: {
        length: 0.13, startRadius: 0.014, endRadius: 0.012,
        wrapGeometry: { enabled: true, turns: 9, depth: 0.0012 },
      },
      pommel: { shape: "sphere", scale: 1.5 },
    },
  },
  {
    name: "duelist-rapier",
    params: {
      blade: bladeParamsOf("rapier-diamond"),
      guard: { shape: "oval", width: 0.12, thickness: 0.05, depth: 0.014, bevel: 0.002 },
      grip: { length: 0.11, startRadius: 0.012, endRadius: 0.011, crossSection: "ellipse", flatten: 0.75 },
      pommel: { shape: "teardrop", scale: 1.3 },
    },
  },
  {
    name: "war-greatsword",
    params: {
      blade: bladeParamsOf("greatsword-hex-fuller"),
      guard: { shape: "tapered", width: 0.26, thickness: 0.035, depth: 0.028, bevel: 0.005 },
      grip: { length: 0.3, startRadius: 0.016, endRadius: 0.014, crossSection: "octagon" },
      pommel: { shape: "scent-stopper", scale: 2.0 },
    },
  },
  {
    name: "soldier-backsword",
    params: {
      blade: bladeParamsOf("backsword-flat"),
      guard: { shape: "diamond", width: 0.15, thickness: 0.03, depth: 0.016, bevel: 0 },
      grip: { length: 0.12, startRadius: 0.013, endRadius: 0.012 },
      pommel: { shape: "disc", scale: 1.4 },
    },
  },
  {
    name: "fantasy-broad",
    params: {
      blade: bladeParamsOf("fantasy-broad-fuller"),
      guard: { shape: "tapered", width: 0.24, thickness: 0.04, depth: 0.03, bevel: 0.006 },
      grip: { length: 0.2, startRadius: 0.016, endRadius: 0.013 },
      pommel: { shape: "disc", scale: 1.8 },
    },
  },
];

// 부품별 기대 개방 경계 엣지 수 (02-architecture §6 — 개방 경계는 기대치와 일치해야 함)
const expectedBoundary = (partName, params) => {
  if (partName === "Grip") return 2 * (params.grip.segRadial ?? 16);
  if (partName === "Pommel") return params.pommel.radialSegments ?? 16;
  return 0; // Blade(캡+폴 닫힘), Guard(닫힌 솔리드)
};

const swordPresetsOut = [];
const swordHashesOut = {};

for (const preset of SWORD_PRESETS) {
  const design = makeSwordDesign(preset.params);
  const sword = buildSword(design, TEXTURE_SIZE);
  const problems = [];
  for (const part of sword.parts) {
    const man = analyzeManifold(part.mesh);
    if (man.nonManifoldEdges > 0) problems.push(`${part.name} nonManifold=${man.nonManifoldEdges}`);
    const expected = expectedBoundary(part.name, preset.params);
    if (man.boundaryEdges !== expected) problems.push(`${part.name} boundary=${man.boundaryEdges}≠${expected}`);
    if (countDegenerate3DTriangles(part.mesh) > 0) problems.push(`${part.name} deg3D`);
  }
  const uv = validateUVs(sword.merged, TEXTURE_SIZE);
  try { assertValidUV(uv); } catch (e) { problems.push(e.message); }
  if (sword.triangleCount > 15000) problems.push(`triangles=${sword.triangleCount}`);
  const hash = hashSword(sword);
  if (problems.length) {
    failed = true;
    console.error(`FAIL ${preset.name}: ${problems.join(", ")}`);
  } else {
    console.log(`ok   ${preset.name}  tris=${sword.triangleCount}  hash=${hash}`);
  }
  swordPresetsOut.push({ name: preset.name, params: preset.params, design });
  swordHashesOut[preset.name] = { hash, triangles: sword.triangleCount };
}

if (failed) {
  console.error("sword golden 생성 실패 — 위 문제를 해결할 것");
  process.exit(1);
}

writeFileSync(join(GOLDEN_DIR, "sword-presets.json"), JSON.stringify(swordPresetsOut, null, 2));
writeFileSync(join(GOLDEN_DIR, "sword-hashes.json"), JSON.stringify(swordHashesOut, null, 2));
console.log(`${SWORD_PRESETS.length}종 검 프리셋 → test/golden/ 갱신 완료`);

// ── 베이크 golden — knight-arming 256², seed 12345 (05-phase3 §3.7) ─────────
{
  const BAKE_SIZE = 256;
  const BAKE_SEED = 12345;
  const preset = swordPresetsOut.find((p) => p.name === "knight-arming");
  const sword = buildSword(preset.design, BAKE_SIZE);
  const graph = makeMaterialGraph();
  const t0 = performance.now();
  const baked = bakeSword({
    merged: sword.merged, design: preset.design, materialGraph: graph, seed: BAKE_SEED, size: BAKE_SIZE,
  });
  const elapsed = Math.round(performance.now() - t0);
  writeFileSync(join(GOLDEN_DIR, "bake-hashes.json"), JSON.stringify({
    "knight-arming": { hash: baked.hash, size: BAKE_SIZE, seed: BAKE_SEED },
  }, null, 2));
  console.log(`ok   bake knight-arming ${BAKE_SIZE}²  ${elapsed}ms  hash=${baked.hash}`);
  console.log("베이크 golden → test/golden/bake-hashes.json 갱신 완료");

  // ── 낡은 검 Operation 프리셋 3종 golden (06-phase4 §4.5) ──────────────────
  const agedOut = {};
  for (const aged of AGED_PRESETS) {
    const t1 = performance.now();
    const r = bakeSword({
      merged: sword.merged, design: preset.design, materialGraph: graph,
      seed: BAKE_SEED, size: BAKE_SIZE, operations: aged.operations,
    });
    if (r.hash === baked.hash) {
      failed = true;
      console.error(`FAIL aged ${aged.name}: 로그가 표면을 바꾸지 않는다 (해시가 기본과 동일)`);
    } else {
      console.log(`ok   aged ${aged.name} ${BAKE_SIZE}²  ${Math.round(performance.now() - t1)}ms  hash=${r.hash}`);
    }
    agedOut[aged.name] = { hash: r.hash, size: BAKE_SIZE, seed: BAKE_SEED, sword: "knight-arming" };
  }
  if (failed) {
    console.error("aged golden 생성 실패");
    process.exit(1);
  }
  writeFileSync(join(GOLDEN_DIR, "aged-hashes.json"), JSON.stringify(agedOut, null, 2));
  console.log("낡은 검 golden → test/golden/aged-hashes.json 갱신 완료");
}
