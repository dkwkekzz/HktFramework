// "낡은 검" Operation 로그 프리셋 3종 (06-phase4 §4.5).
// 같은 검·같은 seed 에 로그만 갈아 끼워 표면을 다양화한다 — Phase 4 의 완료 조건 자체.
// partId: 0=칼날 1=가드 2=손잡이 3=폼멜.

export const AGED_PRESETS = [
  {
    name: "battle-worn",
    label: "전투 흔적",
    operations: [
      // 날은 갈려 반들, 몸통은 세로 긁힘
      { type: "polish", targetPartId: 0, selector: { type: "edge" }, strength: 0.55 },
      {
        type: "scratch", targetPartId: 0, count: 90, direction: "longitudinal",
        lengthRange: [0.4, 1.8], widthRange: [0.004, 0.014], depthRange: [0.12, 0.34], seed: 1017,
      },
      // 가로로 긋힌 충돌 자국 몇 개
      {
        type: "scratch", targetPartId: 0, count: 14, direction: "perpendicular",
        lengthRange: [0.08, 0.24], widthRange: [0.008, 0.022], depthRange: [0.22, 0.45], seed: 2029,
      },
      { type: "oxidize", targetPartId: 0, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 0.18, v1: 1 } }, strength: 0.35 },
      { type: "dirt", targetPartId: 1, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } }, strength: 0.3 },
      { type: "dirt", targetPartId: 2, selector: { type: "local_uv", bounds: { u0: 0, v0: 0.15, u1: 1, v1: 0.85 } }, strength: 0.45 },
    ],
  },
  {
    name: "rusted-relic",
    label: "녹슨 유물",
    operations: [
      { type: "oxidize", targetPartId: 0, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } }, strength: 0.75 },
      { type: "oxidize", targetPartId: 1, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } }, strength: 0.6 },
      { type: "oxidize", targetPartId: 3, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } }, strength: 0.6 },
      { type: "dirt", targetPartId: 0, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } }, strength: 0.4 },
      { type: "dirt", targetPartId: 2, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 1, v1: 1 } }, strength: 0.7 },
      {
        type: "scratch", targetPartId: 0, count: 140, direction: "random",
        lengthRange: [0.05, 0.5], widthRange: [0.006, 0.02], depthRange: [0.08, 0.3], seed: 3037,
      },
    ],
  },
  {
    name: "ceremonial",
    label: "의식용 각인",
    operations: [
      { type: "polish", targetPartId: 0, selector: { type: "edge" }, strength: 0.7 },
      { type: "polish", targetPartId: 0, selector: { type: "ridge" }, strength: 0.5 },
      {
        type: "engrave", targetPartId: 0, maskId: "rune-ansuz", depth: 0.4,
        transform: { offset: [0.22, 0.37], scale: [0.16, 0.22], rotation: 0 },
      },
      {
        type: "engrave", targetPartId: 0, maskId: "chevron-band", depth: 0.28,
        transform: { offset: [0.5, 0.37], scale: [0.3, 0.18], rotation: 0 },
      },
      {
        type: "engrave", targetPartId: 1, maskId: "cross-bottony", depth: 0.45,
        transform: { offset: [0.5, 0.5], scale: [0.4, 0.5], rotation: 0 },
      },
      { type: "dirt", targetPartId: 0, selector: { type: "local_uv", bounds: { u0: 0, v0: 0, u1: 0.12, v1: 1 } }, strength: 0.2 },
    ],
  },
];

export const findAgedPreset = (name) => AGED_PRESETS.find((p) => p.name === name) ?? null;
