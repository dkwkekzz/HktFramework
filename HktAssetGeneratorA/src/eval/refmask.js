// 참조 마스크 유틸 — 다각형 라소 → 비트마스크 래스터 + RLE 인코딩 (07-phase5 §5.1).
// 입력물 가공이라 결정성 계약 대상은 아니지만(§5.1), 순수 계산으로 두어 Node 테스트를 받는다.
// DOM·Canvas 금지 (02-architecture §2 — src/eval 은 순수 계산).

/**
 * 단순 다각형(자기 교차 없음 가정)을 even-odd 스캔라인으로 채운 비트맵.
 * 픽셀 중심(x+0.5, y+0.5) 샘플링. 좌표계는 호출자 것(이미지 픽셀 그대로).
 * @param polygon [x,y][] — 닫힌 윤곽 (마지막→처음 엣지 자동)
 * @returns Uint8Array(width*height) — 행 우선, 1 = 내부
 */
export function rasterizePolygonMask(polygon, width, height) {
  const mask = new Uint8Array(width * height);
  const n = polygon.length;
  if (n < 3) return mask;
  for (let y = 0; y < height; y++) {
    const sy = y + 0.5;
    // 스캔라인과 교차하는 엣지의 x 절편 수집 (수평 엣지는 half-open 규칙으로 자연 제외)
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x0, y0] = polygon[i];
      const [x1, y1] = polygon[(i + 1) % n];
      if (y0 <= sy === y1 <= sy) continue; // 같은 쪽 — 교차 없음 (half-open: [min,max) )
      xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5));
      const to = Math.min(width - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = from; x <= to; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

/**
 * 이진 마스크 → RLE. 0 런부터 시작하는 런 길이 나열 (COCO 유사).
 * 예: [0,0,1,1,1,0] → [2,3,1]. 첫 픽셀이 1 이면 선행 0-런 = 0.
 */
export function encodeMaskRLE(mask) {
  const runs = [];
  let current = 0;
  let run = 0;
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i] ? 1 : 0;
    if (v === current) {
      run++;
    } else {
      runs.push(run);
      current = v;
      run = 1;
    }
  }
  runs.push(run);
  return runs;
}

/** RLE → Uint8Array(length). 런 합이 length 와 다르면 오류. */
export function decodeMaskRLE(runs, length) {
  const mask = new Uint8Array(length);
  let pos = 0;
  let value = 0;
  for (const run of runs) {
    if (value === 1) mask.fill(1, pos, pos + run);
    pos += run;
    value ^= 1;
  }
  if (pos !== length) throw new Error(`RLE 길이 불일치: ${pos} ≠ ${length}`);
  return mask;
}

/**
 * referenceSpec 직렬화 형태 (원본 §5.2 의 웹 대응 — 07-phase5 §5.1).
 * @param annotation {{ image:{width,height,name,view}, maskPolygon:[x,y][],
 *                      landmarks:{name,x,y}[] }}
 */
export function buildReferenceSpec(annotation) {
  const { image, maskPolygon, landmarks } = annotation;
  const mask = rasterizePolygonMask(maskPolygon, image.width, image.height);
  return {
    version: 1,
    image: { name: image.name ?? "", width: image.width, height: image.height, view: image.view },
    // 카메라 MVP 가정: side 직교 투영, 검 축 = tip·root 랜드마크 (07-phase5 §5.1)
    camera: { projection: "orthographic", view: image.view, axisFrom: "root", axisTo: "tip" },
    objectMask: { encoding: "rle", runs: encodeMaskRLE(mask), width: image.width, height: image.height },
    maskPolygon,
    landmarks,
    manuallyConfirmed: {
      objectMask: maskPolygon.length >= 3,
      bladeEndpoints: landmarks.some((l) => l.name === "tip") && landmarks.some((l) => l.name === "root"),
      partBoundaries: ["guardTop", "guardBottom", "gripBottom"].every(
        (name) => landmarks.some((l) => l.name === name)),
      camera: image.view === "side",
    },
  };
}

/** referenceSpec 의 마스크를 Uint8Array 로 복원. */
export function decodeReferenceMask(spec) {
  const { runs, width, height } = spec.objectMask;
  return decodeMaskRLE(runs, width * height);
}
