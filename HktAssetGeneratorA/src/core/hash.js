// FNV-1a 해시 — 결정성 게이트의 기준 (02-architecture §5-3).
// 해시 대상은 TypedArray 의 바이트 표현 — little-endian 플랫폼 전제(현행 전 대상 플랫폼).

/** 문자열 → 32bit FNV-1a. deriveSeed 의 scope 해시에 사용. */
export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

/** 바이트 → 64bit FNV-1a hex 문자열(16자리). 누적용 상태를 반환하는 내부 버전. */
function fnv1a64Accumulate(state, bytes) {
  let h = state;
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i]);
    h = (h * FNV64_PRIME) & MASK64;
  }
  return h;
}

/** @param {Uint8Array} bytes */
export function fnv1a64(bytes) {
  return fnv1a64Accumulate(FNV64_OFFSET, bytes).toString(16).padStart(16, "0");
}

const toBytes = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);

/** TypedArray 여러 개를 순서 고정으로 연결 해시. */
export function hashArrays(arrays) {
  let h = FNV64_OFFSET;
  for (const arr of arrays) h = fnv1a64Accumulate(h, toBytes(arr));
  return h.toString(16).padStart(16, "0");
}

// GeneratedMesh 해시의 배열 순서 — 이 순서 자체가 규약이다. 변경 시 generatorVersion 을 올릴 것.
const MESH_ATTRIBUTE_ORDER = [
  "partId", "islandId", "longitudinal", "perimeter",
  "edgeWeight", "ridgeWeight", "fullerWeight", "contactWeight",
  "curvature", "cavity",
];

/** @param mesh GeneratedMesh (02-architecture §4) */
export function hashMesh(mesh) {
  const arrays = [
    mesh.positions, mesh.normals, mesh.tangents, mesh.indices,
    mesh.uvLocal, mesh.uvAtlas, mesh.uvMetric,
  ];
  for (const key of MESH_ATTRIBUTE_ORDER) arrays.push(mesh.attributes[key]);
  return hashArrays(arrays);
}
