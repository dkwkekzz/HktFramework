// MaterialOperation 모델·재생 (06-phase4 §4.1~4.2, 원본 §17).
//
// 의미론: Operation 은 베이크 입력의 **중간 버퍼에 대한 순수 변환**이다.
// replayOperations 가 로그를 순서대로 적용해 부품별 상태 필드/스탬프 목록을 만들고,
// 베이크(channels.js)는 그 결과만 본다. 자체 난수는 반드시 op 자신의 `seed` 에서 파생하므로
// (전역 seed 오염 금지) 로그 중간 삽입·삭제·재정렬에도 나머지 op 결과가 불변이다.
//
// 상태 필드 표현 (D-15): 선택자별로 저장 형태가 다르다.
//   edge/ridge 선택자는 공간 경계가 없으므로 **스칼라**로 쌓고 프래그먼트에서 정점 보간된
//   edgeWeight/ridgeWeight 와 곱한다(저해상 필드에 구우면 의미값 해상도를 잃는다).
//   local_uv 선택자만 uvLocal 저해상 필드에 축적한다. 어느 쪽이든 Operation 수가 늘어도
//   베이크 비용은 불변 — 06 §4.2 의 목적은 그대로다.

import { clamp01, smoothstep } from "../core/math.js";
import {
  DEFAULT_SCRATCH_SPEC, SCRATCH_DIRECTIONS, generateScratchStamps, buildScratchGrid,
} from "./scratch.js";
import { getMask, MASK_IDS } from "./masks.js";

export const PART_NAMES = ["blade", "guard", "grip", "pommel"];
export const FIELD_CHANNELS = ["polish", "oxidation", "dirt"];
export const SELECTOR_TYPES = ["edge", "ridge", "local_uv"];
export const OPERATION_TYPES = [
  "assign_material", "polish", "oxidize", "dirt", "scratch", "engrave",
];
/** 필드형 Operation 타입 → 상태 채널 (06 §4.2). */
const FIELD_OP_CHANNEL = { polish: "polish", oxidize: "oxidation", dirt: "dirt" };

/** 부품당 상태 필드 해상도 (uvLocal 공간, 06 §4.2). */
export const FIELD_SIZE = 256;
/** local_uv 사각 영역의 경계 falloff (06 §4.2). */
export const FIELD_FALLOFF = 0.05;

/**
 * 부품별 metric 축의 의미 — mesh/*.js 의 uvMetric 정의에서 따온다.
 * 칼날 = [호길이, 둘레], 손잡이·폼멜 = [둘레, 길이].
 * 가드 앞/뒷면은 평면 윤곽 좌표라 둘레 주기가 없다(측면만 둘레지만 아일랜드가 분리됨).
 */
export const PART_METRIC_AXES = [
  { lengthAxis: "u", perimeterAxis: "v" }, // blade
  { lengthAxis: "u", perimeterAxis: null }, // guard
  { lengthAxis: "v", perimeterAxis: "u" }, // grip
  { lengthAxis: "v", perimeterAxis: "u" }, // pommel
];

export const OPERATIONS_FORMAT_VERSION = 1;

// ── 생성·검증 ──────────────────────────────────────────────────────────────

const isNumber = (x) => typeof x === "number" && Number.isFinite(x);
const isRange = (x) => Array.isArray(x) && x.length === 2 && isNumber(x[0]) && isNumber(x[1]);

function requirePart(op) {
  const id = op.targetPartId;
  if (!Number.isInteger(id) || id < 0 || id >= PART_NAMES.length) {
    throw new Error(`targetPartId 가 올바르지 않다: ${id}`);
  }
  return id;
}

function normalizeSelector(selector) {
  const s = selector ?? { type: "edge" };
  if (!SELECTOR_TYPES.includes(s.type)) throw new Error(`알 수 없는 selector: ${s.type}`);
  if (s.type !== "local_uv") return { type: s.type };
  const b = s.bounds;
  if (!b || !isNumber(b.u0) || !isNumber(b.v0) || !isNumber(b.u1) || !isNumber(b.v1)) {
    throw new Error("local_uv selector 에는 bounds {u0,v0,u1,v1} 가 필요하다");
  }
  return {
    type: "local_uv",
    bounds: {
      u0: Math.min(b.u0, b.u1), u1: Math.max(b.u0, b.u1),
      v0: Math.min(b.v0, b.v1), v1: Math.max(b.v0, b.v1),
    },
  };
}

/** 임의 입력 → 검증된 Operation. 알 수 없는 필드는 버린다(직렬화 왕복이 안정). */
export function normalizeOperation(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Operation 이 객체가 아니다");
  const type = raw.type;
  if (!OPERATION_TYPES.includes(type)) throw new Error(`알 수 없는 Operation: ${type}`);
  const targetPartId = requirePart(raw);
  switch (type) {
    case "assign_material":
      if (typeof raw.primitiveId !== "string") throw new Error("assign_material 에는 primitiveId 가 필요하다");
      return { type, targetPartId, primitiveId: raw.primitiveId };
    case "polish":
    case "oxidize":
    case "dirt":
      return {
        type, targetPartId,
        selector: normalizeSelector(raw.selector),
        strength: isNumber(raw.strength) ? raw.strength : 0.5,
      };
    case "scratch": {
      const d = DEFAULT_SCRATCH_SPEC;
      const direction = SCRATCH_DIRECTIONS.includes(raw.direction) ? raw.direction : d.direction;
      const op = {
        type, targetPartId,
        count: Number.isInteger(raw.count) && raw.count >= 0 ? raw.count : d.count,
        lengthRange: isRange(raw.lengthRange) ? raw.lengthRange.slice() : d.lengthRange.slice(),
        widthRange: isRange(raw.widthRange) ? raw.widthRange.slice() : d.widthRange.slice(),
        depthRange: isRange(raw.depthRange) ? raw.depthRange.slice() : d.depthRange.slice(),
        direction,
        seed: Number.isInteger(raw.seed) ? raw.seed >>> 0 : d.seed,
      };
      // region 은 선택 — 없으면 재생 시 부품 metric bbox 를 쓴다
      if (raw.region) {
        const r = raw.region;
        if (!isNumber(r.minU) || !isNumber(r.maxU) || !isNumber(r.minV) || !isNumber(r.maxV)) {
          throw new Error("scratch region 은 {minU,maxU,minV,maxV} 여야 한다");
        }
        op.region = { minU: r.minU, maxU: r.maxU, minV: r.minV, maxV: r.maxV };
      }
      return op;
    }
    case "engrave": {
      const maskId = raw.maskId ?? MASK_IDS[0];
      if (!MASK_IDS.includes(maskId)) throw new Error(`알 수 없는 engrave 마스크: ${maskId}`);
      const t = raw.transform ?? {};
      const offset = Array.isArray(t.offset) && t.offset.length === 2 ? t.offset.slice() : [0.5, 0.5];
      const scale = Array.isArray(t.scale) && t.scale.length === 2 ? t.scale.slice() : [0.3, 0.3];
      if (!(scale[0] > 0) || !(scale[1] > 0)) throw new Error("engrave transform.scale 은 양수여야 한다");
      return {
        type, targetPartId, maskId,
        transform: { offset, scale, rotation: isNumber(t.rotation) ? t.rotation : 0 },
        depth: isNumber(raw.depth) ? raw.depth : 0.3,
      };
    }
    default:
      throw new Error(`알 수 없는 Operation: ${type}`);
  }
}

export const normalizeOperations = (list) => (list ?? []).map(normalizeOperation);

// ── 직렬화 (operations.json) ───────────────────────────────────────────────

export function serializeOperations(operations) {
  return JSON.stringify(
    { version: OPERATIONS_FORMAT_VERSION, operations: normalizeOperations(operations) },
    null, 2,
  );
}

export function parseOperations(text) {
  const raw = typeof text === "string" ? JSON.parse(text) : text;
  const list = Array.isArray(raw) ? raw : raw?.operations;
  if (!Array.isArray(list)) throw new Error("operations.json 형식이 아니다");
  return normalizeOperations(list);
}

// ── 상태 필드 ──────────────────────────────────────────────────────────────

const emptyAccum = () => ({ edge: 0, ridge: 0, field: null });

/** local_uv 사각 영역을 falloff 와 함께 필드에 가산 (06 §4.2). */
function addRectToField(accum, bounds, strength) {
  if (!accum.field) accum.field = new Float32Array(FIELD_SIZE * FIELD_SIZE);
  const f = FIELD_FALLOFF;
  const field = accum.field;
  const lo = (x) => Math.max(0, Math.floor((x - f) * FIELD_SIZE));
  const hi = (x) => Math.min(FIELD_SIZE - 1, Math.ceil((x + f) * FIELD_SIZE));
  for (let j = lo(bounds.v0); j <= hi(bounds.v1); j++) {
    const v = (j + 0.5) / FIELD_SIZE;
    const wv = smoothstep(bounds.v0 - f, bounds.v0 + f, v) * smoothstep(bounds.v1 + f, bounds.v1 - f, v);
    if (wv <= 0) continue;
    for (let i = lo(bounds.u0); i <= hi(bounds.u1); i++) {
      const u = (i + 0.5) / FIELD_SIZE;
      const wu = smoothstep(bounds.u0 - f, bounds.u0 + f, u) * smoothstep(bounds.u1 + f, bounds.u1 - f, u);
      if (wu <= 0) continue;
      field[j * FIELD_SIZE + i] += strength * wu * wv;
    }
  }
}

/** 저해상 필드 bilinear 샘플 (uvLocal 공간). */
export function sampleField(field, u, v) {
  if (!field) return 0;
  const x = clamp01(u) * FIELD_SIZE - 0.5;
  const y = clamp01(v) * FIELD_SIZE - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const c = (i) => (i < 0 ? 0 : i >= FIELD_SIZE ? FIELD_SIZE - 1 : i);
  const a = field[c(y0) * FIELD_SIZE + c(x0)];
  const b = field[c(y0) * FIELD_SIZE + c(x0 + 1)];
  const cc = field[c(y0 + 1) * FIELD_SIZE + c(x0)];
  const d = field[c(y0 + 1) * FIELD_SIZE + c(x0 + 1)];
  return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + d) * fx * fy;
}

/**
 * 상태 채널 누적값 — 프래그먼트가 부르는 유일한 진입점 (D-15).
 * 비어 있으면 정확히 0 을 돌려준다(Phase 3 산출물 비트 동일성 보장).
 */
export function sampleAccum(accum, frag) {
  return accum.edge * frag.edgeWeight
    + accum.ridge * frag.ridgeWeight
    + sampleField(accum.field, frag.uvLocalU, frag.uvLocalV);
}

// ── 재생 ───────────────────────────────────────────────────────────────────

export function emptyPartOps() {
  return {
    material: null,
    polish: emptyAccum(),
    oxidation: emptyAccum(),
    dirt: emptyAccum(),
    scratchStamps: [],
    scratchGrid: null,
    engravings: [],
  };
}

/**
 * 부품별 metric bbox — 주 아일랜드(islandId 0)만 본다.
 * 칼날 rootCap 처럼 원점 중심의 보조 아일랜드가 범위를 오염시키지 않게.
 * @param merged mergeForValidation 결과
 */
export function computePartMetricBounds(merged) {
  const bounds = PART_NAMES.map(() => ({
    minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity,
  }));
  const { partId, islandId } = merged.attributes;
  for (let i = 0; i < partId.length; i++) {
    if (islandId[i] !== 0) continue;
    const b = bounds[partId[i]];
    const u = merged.uvMetric[i * 2], v = merged.uvMetric[i * 2 + 1];
    if (u < b.minU) b.minU = u;
    if (u > b.maxU) b.maxU = u;
    if (v < b.minV) b.minV = v;
    if (v > b.maxV) b.maxV = v;
  }
  for (const b of bounds) {
    if (!Number.isFinite(b.minU)) { b.minU = 0; b.maxU = 1; b.minV = 0; b.maxV = 1; }
  }
  return bounds;
}

/**
 * 로그 재생 — 순서대로 적용해 부품별 베이크 입력을 만든다 (06 §4.1).
 * @param operations Operation[] (정규화 전이어도 됨)
 * @param ctx {{ metricBounds: computePartMetricBounds 결과 }}
 * @returns {{ byPart: ReturnType<emptyPartOps>[], count: number }}
 */
export function replayOperations(operations, ctx = {}) {
  const ops = normalizeOperations(operations);
  const byPart = PART_NAMES.map(() => emptyPartOps());
  const metricBounds = ctx.metricBounds
    ?? PART_NAMES.map(() => ({ minU: 0, maxU: 1, minV: 0, maxV: 1 }));

  for (const op of ops) {
    const target = byPart[op.targetPartId];
    if (op.type === "assign_material") {
      target.material = op.primitiveId; // 마지막 배정이 이긴다
      continue;
    }
    const channel = FIELD_OP_CHANNEL[op.type];
    if (channel) {
      const accum = target[channel];
      if (op.selector.type === "edge") accum.edge += op.strength;
      else if (op.selector.type === "ridge") accum.ridge += op.strength;
      else addRectToField(accum, op.selector.bounds, op.strength);
      continue;
    }
    if (op.type === "scratch") {
      const partBounds = metricBounds[op.targetPartId];
      const region = op.region ?? partBounds;
      const axes = PART_METRIC_AXES[op.targetPartId];
      // seam 주기는 **부품 전체** 둘레 — op.region 이 부분 영역이어도 주기는 변하지 않는다
      const perimeter = axes.perimeterAxis === "u"
        ? { lo: partBounds.minU, hi: partBounds.maxU }
        : axes.perimeterAxis === "v" ? { lo: partBounds.minV, hi: partBounds.maxV } : null;
      const stamps = generateScratchStamps(op, region, axes, perimeter);
      for (const s of stamps) target.scratchStamps.push(s);
      continue;
    }
    if (op.type === "engrave") {
      const { offset, scale, rotation } = op.transform;
      target.engravings.push({
        mask: getMask(op.maskId),
        offset, scale, rotation, depth: op.depth,
        cos: Math.cos(rotation), sin: Math.sin(rotation),
        // 회전 사각형의 외접원 — 프래그먼트 즉시 기각용
        radius: 0.5 * Math.hypot(scale[0], scale[1]),
      });
    }
  }

  for (const part of byPart) {
    part.scratchGrid = buildScratchGrid(part.scratchStamps);
  }
  return { byPart, count: ops.length };
}
