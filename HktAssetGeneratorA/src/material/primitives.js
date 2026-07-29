// 기본 머티리얼 라이브러리 — 자산마다 새로 만들지 않는 공유 물질 (원본 §15 + LEATHER).
// 색은 sRGB 공간에서 저작한다 (pack 단계에서 그대로 8bit 기록 — 05-phase3 §3.5).

export const CARBON_STEEL = {
  id: "carbon_steel",
  baseColor: [0.62, 0.64, 0.66],
  metallic: 1.0,
  roughness: 0.36,
  oxidationColor: [0.30, 0.18, 0.11], // 갈색 녹
  dirtColor: [0.22, 0.19, 0.15],
  microNormal: { type: "directional", scale: 160, strength: 0.08, stretch: 10, seedOffset: 19 },
  colorVariation: { type: "fbm", scale: 12, strength: 0.05, seedOffset: 31 },
  rules: {
    edgePolishResponse: 0.25,
    cavityOxidationResponse: 0.55,
    moistureRoughnessResponse: -0.2,
    scratchNormalResponse: 0.4,
  },
};

export const BRONZE = {
  id: "bronze",
  baseColor: [0.71, 0.48, 0.25],
  metallic: 1.0,
  roughness: 0.42,
  oxidationColor: [0.30, 0.52, 0.42], // 녹청(파티나)
  dirtColor: [0.24, 0.20, 0.14],
  microNormal: { type: "fbm", scale: 90, strength: 0.06, seedOffset: 67 },
  colorVariation: { type: "fbm", scale: 8, strength: 0.08, seedOffset: 71 },
  rules: {
    edgePolishResponse: 0.32,
    cavityOxidationResponse: 0.7,
    moistureRoughnessResponse: -0.18,
    scratchNormalResponse: 0.35,
  },
};

export const LEATHER = {
  id: "leather",
  baseColor: [0.44, 0.28, 0.17],
  metallic: 0.0,
  roughness: 0.75,
  oxidationColor: [0.25, 0.16, 0.10], // 가죽은 산화 대신 때·마모 어둡기로 해석
  dirtColor: [0.20, 0.15, 0.10],
  microNormal: { type: "fbm", scale: 60, strength: 0.12, seedOffset: 101 },
  colorVariation: { type: "fbm", scale: 6, strength: 0.12, seedOffset: 103 },
  rules: {
    edgePolishResponse: 0.0,
    cavityOxidationResponse: 0.15,
    moistureRoughnessResponse: -0.35,
    scratchNormalResponse: 0.2,
  },
};

export const MATERIAL_PRIMITIVES = {
  carbon_steel: CARBON_STEEL,
  bronze: BRONZE,
  leather: LEATHER,
};

/** 기본 SurfaceState (원본 §14). */
export const DEFAULT_SURFACE_STATE = {
  polish: 0.5,
  oxidation: 0.15,
  dirt: 0.15,
  moisture: 0,
  scratchAmount: 0,
  impactAmount: 0,
};

/**
 * 기본 MaterialGraph — 부품별 물질 배정 (원본 §14 SwordMaterialGraph 의 MVP 형).
 * @param p {{ blade?, guard?, grip?, pommel?: primitiveId, state?: SurfaceState }}
 */
export function makeMaterialGraph(p = {}) {
  const state = { ...DEFAULT_SURFACE_STATE, ...(p.state ?? {}) };
  const instance = (primitiveId) => ({
    primitiveId,
    colorTint: [1, 1, 1],
    roughnessOffset: 0,
    normalStrength: 1,
    state: { ...state },
    seed: 0, // compile 에서 프로젝트 seed 로 파생
  });
  return {
    materials: {
      blade: instance(p.blade ?? "carbon_steel"),
      guard: instance(p.guard ?? "bronze"),
      grip: instance(p.grip ?? "leather"),
      pommel: instance(p.pommel ?? "bronze"),
    },
    decorations: [],
    surfaceOperations: [], // Phase 4
  };
}
