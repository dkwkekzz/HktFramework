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
  //   salt: 독립 노이즈 채널용 접두(기본 ''→fnv1a(i+','+j) 와 동일·하위호환). 다른 salt = *완전 독립* 장(다축 바이옴).
  function latticeVal(i, j, salt) {
    let h = fnv1a(i + ',' + j);
    if (salt) {                                                       // 채널 분리 — 좌표해시 ⊕ salt해시 후 강한 avalanche(FNV 접두 믹싱은 약해 상관 잔존)
      h = (h ^ fnv1a('' + salt)) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
      h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
      h = (h ^ (h >>> 16)) >>> 0;
    }
    return h / 4294967296;                                            // salt 없음/'' → fnv1a(i+','+j)/2^32 (기존과 동일·하위호환)
  }
  // Ken Perlin smootherstep — C² 연속 보간 가중(격자 이음매에서 기울기까지 매끄럽게).
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 값 노이즈 — 정수 격자에 난수 배치 + smootherstep bilinear 보간 → 공간 상관 있는 매끄러운 장 [0,1).
  //   백색 잡음과 달리 *인접 (x,y) 가 닮음* → 봉우리·계곡이 뭉쳐 발현(코히어런트 지형). 순수·경로 무관.
  //   salt(기본 ''): 독립 채널 — 다른 salt 는 다른 lattice 난수 → *무상관* 장(같은 좌표여도 독립). salt='' → 기존과 동일.
  function valueNoise2D(x, y, salt) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = smoother(xf), v = smoother(yf);
    const top = lerp(latticeVal(xi, yi, salt), latticeVal(xi + 1, yi, salt), u);
    const bot = lerp(latticeVal(xi, yi + 1, salt), latticeVal(xi + 1, yi + 1, salt), u);
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
    const salt = opts.salt;                                            // 독립 채널(기본 undefined→''·하위호환)
    for (let o = 0; o < oct; o++) { sum += amp * valueNoise2D(x * freq, y * freq, salt); norm += amp; amp *= gain; freq *= lac; }
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

  // --- 절차적 장 다축화(바이옴) — 단일 노이즈(0074)를 *독립 다축*(온도·습도) 장으로 (0074 → 0090·가법) ---

  // 다축 바이옴 장 — 두 개의 *독립* fBm 축(온도·습도)을 *제너릭* 2D 분류로 묶는다(바이옴=두 스칼라의 2D 칸).
  //   0074 fieldNoise 는 *단일* 노이즈축(높이)만 봤다 — 실세계 바이옴은 ≥2 독립 축(온도·습도)의 *교차*다(춥고 습함=
  //   툰드라·덥고 건조=사막…). 핵심: 두 축이 *서로 무상관*이어야 진짜 2D(같은 노이즈를 두 번 쓰면 1D 대각선뿐).
  //   두 fBm 을 *다른 salt*(독립 lattice 채널)로 뽑아 *무상관*시킨다 — 좌표 오프셋 방식(같은 노이즈의 다른 패치)은
  //   윈도우마다 spurious 상관이 들쭉날쭉이라 salt 가 근본 해결. 바이옴은 (temp,humidity)→정수 칸의 *제너릭 양자화*
  //   (타입 하드코딩 0·biome=칸 인덱스일 뿐) — "사막/툰드라" 이름은 호출자(렌더)의 몫.
  //   opts: { scale(0.08), nTemp(3), nHum(3), tempSalt('T'), humSalt('H'), elevSalt('E'), lapse(0), latAmp(0), latPeriod(256), elevFn(null), …fbm }
  //   ── 실제 지형 고도 결합(0092 → 0095·가법): 0092 의 고도는 *별도 노이즈*였다(실제 지형 높이장과 분리·정직한 한계).
  //      elevFn(i,j)->[0,1] 를 주면 고도축을 *그 함수*(예: 랜드폼을 고른 바로 그 높이장)로 대체 — 높은 땅이 곧 찬 바이옴이
  //      되어 *산이 차고 험준*(능선 랜드폼)해진다(자기일관). elevFn 없음 → 내부 노이즈(0092 동일). lapse=0 → 미사용(회귀 0).
  //   반환: (i,j) -> { temp∈[0,1), humidity∈[0,1), elev∈[0,1), warm∈[0,1), effTemp∈[0,1), biome∈[0,nTemp*nHum) }. 순수·경로 무관·결정론.
  //   ── 고도×바이옴 결합(0090 → 0092·가법): 실세계에서 같은 위도(=같은 base temp)라도 *높은 곳은 더 춥다*(기온 감률·
  //      lapse rate) — 그래서 적도 산봉우리에 만년설/툰드라가 생긴다. 세 번째 *독립* fBm 축(elev·elevSalt='E')을 뽑아
  //      effTemp = clamp01(temp − lapse·elev) 로 *유효 온도*를 낮춘다 → 분류는 effTemp 로(고지대=찬 바이옴 칸으로 이동).
  //      세 축 모두 무상관(salt 분리)·각 축 공간 상관(코히어런트). lapse=0 → effTemp=temp → biome byte 0090 동일(회귀 0).
  //   ── 위도 온도대(0092 → 0093·가법): 온도는 *순수 잡음*이 아니라 *위도*에 강하게 묶인다 — 적도는 덥고 극지는 춥다.
  //      결정론적 위도 인자 warm(j)=½(1+cos(2π·j/latPeriod)) ∈[0,1](적도행=1·극행=0)를 잡음에 blend:
  //      tBand = (1−latAmp)·temp + latAmp·warm. 그러면 같은 경도줄을 따라 *기후대 띠*(열대→온대→한대)가 창발한다.
  //      잡음(국소 변이)+위도(대역 구조)의 합 = 진짜 지구 기후. latAmp=0 → tBand=temp → 0092/0090 byte 동일(회귀 0).
  function biomeField(opts) {
    opts = opts || {};
    const scale = opts.scale != null ? opts.scale : 0.08;
    const nT = opts.nTemp != null ? opts.nTemp : 3, nH = opts.nHum != null ? opts.nHum : 3;
    const tSalt = opts.tempSalt != null ? opts.tempSalt : 'T', hSalt = opts.humSalt != null ? opts.humSalt : 'H';
    const eSalt = opts.elevSalt != null ? opts.elevSalt : 'E', lapse = opts.lapse != null ? opts.lapse : 0;
    const latAmp = opts.latAmp != null ? opts.latAmp : 0, latPeriod = opts.latPeriod != null ? opts.latPeriod : 256;
    const elevFn = opts.elevFn || null;
    const tOpts = Object.assign({}, opts, { salt: tSalt }), hOpts = Object.assign({}, opts, { salt: hSalt });
    const eOpts = Object.assign({}, opts, { salt: eSalt });
    const q = (v, n) => { let k = Math.floor(v * n); return k < 0 ? 0 : (k >= n ? n - 1 : k); };
    const cl01 = (v) => v < 0 ? 0 : (v >= 1 ? 0.999999 : v);
    const TAU = Math.PI * 2;
    return function (i, j) {
      const temp = fbm(i * scale, j * scale, tOpts);
      const humidity = fbm(i * scale, j * scale, hOpts);
      const warm = latAmp !== 0 ? 0.5 * (1 + Math.cos(TAU * j / latPeriod)) : temp;   // 위도 인자(적도=1·극=0)·latAmp=0→미사용
      const tBand = latAmp !== 0 ? (1 - latAmp) * temp + latAmp * warm : temp;        // 잡음+위도대 blend(회귀 0)
      const elev = lapse !== 0 ? (elevFn ? cl01(elevFn(i, j)) : fbm(i * scale, j * scale, eOpts)) : 0;   // 실제 지형 또는 내부 노이즈·lapse=0→미사용

      const effTemp = lapse !== 0 ? cl01(tBand - lapse * elev) : tBand;  // 위도대 보정 후 고지대일수록 유효 온도 ↓
      return { temp, humidity, elev, warm, effTemp, biome: q(effTemp, nT) * nH + q(humidity, nH) };
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

  return { fnv1a, hashIndex, valueNoise2D, fbm, fieldNoise, biomeField, streamChunks, VERSION: 6 };
});
