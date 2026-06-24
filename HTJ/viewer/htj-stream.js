// viewer/htj-stream.js — 제너릭 "무한 절차적 세계 → 관찰자 둘레 유한 창" 스트리밍 (TW4·확인용 렌더 도메인).
//
//   environment.md TW4 — 0069~0072 LOD 가 *발현/물리 비용*을 관찰 영역에 묶었다(가까이 fine·멀면 coarse). 그러나
//   세계 자체는 여전히 *유한한 손수 청크 목록*(작은 패치)이었다. 이 모듈은 그 마지막 스케일 레버를 푼다:
//   **세계 = 무한 절차적 장**(grid 좌표 (i,j) → DNA shapeHash 의 *순수 함수*) · viewer 는 관찰자 둘레 반경 안의
//   청크만 *materialize*(유한 작업집합). 관찰자가 아무리 멀리 가도 작업집합 크기 일정(∝반경²·세계 크기 무관) =
//   "끝없이 펼침·비용≠세계 크기"(0015/0034/0039/0069 측정 계보의 *세계 extent* 판).
//
//   순수·결정론·렌더 의존 0 — *어디에 무슨 청크가 있나*만(픽셀은 호출자·LOD/표면은 lodCloud/pointCloudSurface).
//   관찰자(camera)는 *확인용* 개념 → engine 모르는 viewer 도메인(세계↔확인용 단방향·engine 변경 0). 장(field)이
//   같은 (i,j)→같은 hash(경로 무관·재방문 동일)·K 형태를 무한 청크가 공유(dedup K≪N). UMD(브라우저·Node).
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTJStream = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // FNV-1a 32비트 — grid 좌표 등 결정론 해시(절차적 장의 씨앗).
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  // grid 좌표 → [0,K) 결정론 인덱스 — 무한 위치를 K 형태 팔레트에 사상(순수·경로 무관). 절차적 장의 *기본형*(백색 잡음).
  //   인접 셀이 무상관 → 봉우리·계곡이 흩어진다(공간 상관·바이옴 없음). 코히어런트 판은 fieldNoise(아래).
  function hashIndex(i, j, K) { return fnv1a(i + ',' + j) % K; }

  // --- 절차적 장 고도화(노이즈) — 백색 잡음 hashIndex 를 *공간 상관* 있는 매끄러운 장으로 (0073 → 0074·가법) ---

  // 정수 격자점의 결정론 난수값 [0,1) — 노이즈의 씨앗(같은 (i,j)→같은 값·경로 무관).
  function latticeVal(i, j) { return fnv1a(i + ',' + j) / 4294967296; }
  // Ken Perlin smootherstep — C² 연속 보간 가중(격자 이음매에서 기울기까지 매끄럽게).
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 값 노이즈 — 정수 격자에 난수 배치 + smootherstep bilinear 보간 → 공간 상관 있는 매끄러운 장 [0,1).
  //   백색 잡음과 달리 *인접 (x,y) 가 닮음* → 봉우리·계곡이 뭉쳐 발현(코히어런트 지형). 순수·경로 무관.
  function valueNoise2D(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = smoother(xf), v = smoother(yf);
    const top = lerp(latticeVal(xi, yi), latticeVal(xi + 1, yi), u);
    const bot = lerp(latticeVal(xi, yi + 1), latticeVal(xi + 1, yi + 1), u);
    return lerp(top, bot, v);                                          // ∈ [0,1)
  }

  // fractal Brownian motion — 여러 옥타브 값 노이즈 합 → *큰 윤곽(바이옴) + 작은 디테일*. 정규화로 [0,1) 유지.
  //   opts: { octaves(기본 4), lacunarity(주파수 배율·기본 2), gain(진폭 감쇠·기본 0.5), frequency(기본 1) }
  function fbm(x, y, opts) {
    opts = opts || {};
    const oct = opts.octaves != null ? opts.octaves : 4;
    const lac = opts.lacunarity != null ? opts.lacunarity : 2;
    const gain = opts.gain != null ? opts.gain : 0.5;
    let freq = opts.frequency != null ? opts.frequency : 1, amp = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += amp * valueNoise2D(x * freq, y * freq); norm += amp; amp *= gain; freq *= lac; }
    return norm > 0 ? sum / norm : 0;                                  // ∈ [0,1)
  }

  // 절차적 지형 장 — fBm 높이를 K 형태 팔레트에 사상(공간 상관·바이옴). hashIndex(백색 잡음)의 *코히어런트 판*.
  //   palette: 형태 hash 배열(높이 오름차순 권장 → 낮은 노이즈=분지·높은=봉우리). opts: { scale(격자→노이즈 좌표·작을수록 큰 패치·기본 0.08), …fbm }
  //   반환: (i,j) -> palette[idx] (streamChunks 의 shapeAt 로 그대로 사용). 순수·경로 무관.
  function fieldNoise(palette, opts) {
    opts = opts || {};
    const scale = opts.scale != null ? opts.scale : 0.08, K = palette.length;
    return function (i, j) {
      let idx = Math.floor(fbm(i * scale, j * scale, opts) * K);
      if (idx >= K) idx = K - 1; else if (idx < 0) idx = 0;
      return palette[idx];
    };
  }

  // 관찰자 둘레 유한 창 materialize — 무한 grid 중 반경 안 청크만 생성(작업집합 ∝ 반경²·관찰자 위치 무관).
  //   observer: {cx,cy}  opts: { spacing(청크 간격·기본 1), radius(materialize 반경·기본 spacing*3), z(평면 높이·기본 0),
  //     shapeAt(i,j)->hash|null(절차적 장·각 grid 셀의 DNA·null=빈 셀) }
  //   반환: { chunks:[{cx,cy,cz,gx,gy,shapeHash,radius,anchored}], count }
  function streamChunks(observer, opts) {
    opts = opts || {};
    const spacing = opts.spacing != null ? opts.spacing : 1;
    const radius = opts.radius != null ? opts.radius : spacing * 3;
    const z = opts.z != null ? opts.z : 0;
    const shapeAt = opts.shapeAt;
    const ox = observer ? (observer.cx || 0) : 0, oy = observer ? (observer.cy || 0) : 0;
    const r2 = radius * radius;
    const i0 = Math.floor((ox - radius) / spacing), i1 = Math.ceil((ox + radius) / spacing);
    const j0 = Math.floor((oy - radius) / spacing), j1 = Math.ceil((oy + radius) / spacing);
    const chunks = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = i * spacing, cy = j * spacing, dx = cx - ox, dy = cy - oy;
      if (dx * dx + dy * dy > r2) continue;                          // 반경 밖 = 아직 안 펼침
      const hash = shapeAt ? shapeAt(i, j) : null;
      if (hash === null || hash === undefined) continue;             // 빈 셀(절차적 장이 비움 가능)
      chunks.push({ cx, cy, cz: z, gx: i, gy: j, shapeHash: hash, radius: spacing * 0.5, anchored: true });
    }
    return { chunks, count: chunks.length };
  }

  return { fnv1a, hashIndex, valueNoise2D, fbm, fieldNoise, streamChunks, VERSION: 2 };
});
