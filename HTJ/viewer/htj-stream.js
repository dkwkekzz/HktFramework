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
  //   ── 강수장(0093 → 0097·가법): 비(강수)는 *별도 축이 아니라* 이미 가진 두 축의 함수다 — 공기가 머금는 수분(humidity)이
  //      많고 따뜻할수록(effTemp) 비가 많다(열대우림). 반대로 건조(낮은 humidity)하거나 추우면(증발↓·툰드라/사막) 적다.
  //      precip = clamp01( humidity^0.7 · (precipFloor + (1−precipFloor)·effTemp) ) — *순수 derived 측정*(새 노이즈 0·
  //      타입 하드코딩 0). 강은 이 강수가 지형을 따라 흘러 모이는 곳에서 창발한다(0098 flowField). precip 은 항상 계산되며
  //      *가법*(반환 객체에 키 추가일 뿐) — 기존 소비자(biome·effTemp)는 불변이라 0090~0096 byte 회귀 0.
  function biomeField(opts) {
    opts = opts || {};
    const scale = opts.scale != null ? opts.scale : 0.08;
    const nT = opts.nTemp != null ? opts.nTemp : 3, nH = opts.nHum != null ? opts.nHum : 3;
    const tSalt = opts.tempSalt != null ? opts.tempSalt : 'T', hSalt = opts.humSalt != null ? opts.humSalt : 'H';
    const eSalt = opts.elevSalt != null ? opts.elevSalt : 'E', lapse = opts.lapse != null ? opts.lapse : 0;
    const latAmp = opts.latAmp != null ? opts.latAmp : 0, latPeriod = opts.latPeriod != null ? opts.latPeriod : 256;
    const elevFn = opts.elevFn || null;
    const precipFloor = opts.precipFloor != null ? opts.precipFloor : 0.3;   // 추워도 남는 최소 강수 비율(0=완전히 온도 의존)
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
      const precip = cl01(Math.pow(humidity, 0.7) * (precipFloor + (1 - precipFloor) * effTemp));  // 습하고 따뜻할수록 비↑(derived)
      return { temp, humidity, elev, warm, effTemp, precip, biome: q(effTemp, nT) * nH + q(humidity, nH) };
    };
  }

  // --- 흐름 누적(0097 → 0098) — 강수가 지형을 따라 흘러 모이면 *강*이 창발한다(D8 최급강하 라우팅·확인용 트랙) ---
  //
  //   0097 은 *어디에 비가 오나*(precip)를 냈다. 비는 가만히 있지 않고 *중력 따라 낮은 곳으로 흐른다* — 지류가 모여 본류가
  //   되며 한 줄기 강이 된다. 이 함수는 유한 창(window) 위에서 각 셀의 비를 *가장 가파른 내리막 이웃*(8방향 D8)으로 흘려
  //   누적한다(고→저 정렬 후 한 번 훑기). 누적이 큰 셀 = 물이 모인 *강/유역*. 강이라는 *타입을 박지 않는다* — 일반 높이장에
  //   라우팅을 돌린 *측정*일 뿐(높이장이 지형이든 무엇이든·타입 0). 순수·결정론·렌더 의존 0.
  //
  //   opts: { elevFn(i,j)->높이, rainFn(i,j)->비량(기본 1), x0, y0, W, H } — (x0,y0) 좌상단 grid 원점·W×H 창.
  //   반환: { acc:Float64Array(W*H), down:Int32Array(W*H 내리막 셀 인덱스·-1=sink), rain:총 강수,
  //          sinkAccum:국소 최저점에 고인 물·borderOut:창 밖으로 나간 물, maxAcc, meanAcc }
  //   보존: sinkAccum + borderOut === Σrain (모든 빗방울은 결국 sink 에 고이거나 창을 빠져나간다).
  function flowAccumulation(opts) {
    opts = opts || {};
    const elevFn = opts.elevFn, rainFn = opts.rainFn || (() => 1);
    const x0 = opts.x0 || 0, y0 = opts.y0 || 0, W = opts.W || 64, H = opts.H || 64;
    const N = W * H;
    const elev = new Float64Array(N), acc = new Float64Array(N), down = new Int32Array(N);
    let rainTotal = 0;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = r * W + c, e = elevFn(x0 + c, y0 + r); elev[k] = e;
      const w = rainFn(x0 + c, y0 + r); acc[k] = w; rainTotal += w;
    }
    // 각 셀의 D8 최급강하 이웃(자신보다 낮은 이웃 중 *경사 최대*). 없으면 sink(-1). 창 밖으로 내려가면 OUT(-2).
    const OUT = -2;
    const dist = (dc, dr) => (dc && dr) ? Math.SQRT1_2 : 1;   // 대각선은 거리 √2 → 경사 정규화
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const k = r * W + c, e = elev[k]; let best = -1, bestSlope = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const nc = c + dc, nr = r + dr;
        let ne; if (nc < 0 || nc >= W || nr < 0 || nr >= H) ne = elevFn(x0 + nc, y0 + nr); else ne = elev[nr * W + nc];
        if (ne >= e) continue;
        const slope = (e - ne) * dist(dc, dr);
        if (slope > bestSlope) { bestSlope = slope; best = (nc < 0 || nc >= W || nr < 0 || nr >= H) ? OUT : nr * W + nc; }
      }
      down[k] = best;
    }
    // 고→저 순서로 한 번 훑으며 물을 내리막으로 밀어준다(위상 정렬 대용·DAG 라 안전).
    const order = Array.from({ length: N }, (_, k) => k).sort((a, b) => elev[b] - elev[a]);
    let sinkAccum = 0, borderOut = 0;
    for (const k of order) {
      const d = down[k];
      if (d === -1) sinkAccum += acc[k];           // 국소 최저점 — 물이 고인다(호수 씨앗·0100)
      else if (d === OUT) borderOut += acc[k];      // 창 밖으로 나감
      else acc[d] += acc[k];                        // 내리막 셀로 합류(누적 = 상류 면적)
    }
    let maxAcc = 0, sumAcc = 0;
    for (let k = 0; k < N; k++) { if (acc[k] > maxAcc) maxAcc = acc[k]; sumAcc += acc[k]; }
    return { acc, down, elev, W, H, x0, y0, rain: rainTotal, sinkAccum, borderOut, maxAcc, meanAcc: sumAcc / N };
  }

  // --- 호수 채움(0098 → 0100) — 흐름이 빠져나가지 못하는 *분지(pit)* 는 물이 차올라 *호수*가 된다(priority-flood·확인용 트랙) ---
  //
  //   0098 흐름 누적은 국소 최저점(sink)에 물을 *고이게만* 했다(채우진 않음). 실제로 분지는 물이 차올라 *유출구(spill)* 높이
  //   까지 *평평한 수면*을 이룬다 — 호수. 이 함수는 priority-flood(Barnes 2014)로 각 셀의 *수면 높이(filled)* 를 구한다:
  //   창 경계(유출)에서 가장 낮은 곳부터 안으로 번지며 filled[이웃]=max(지형[이웃], 현재 수면). 그러면 분지는 유출구 높이의
  //   *평평한 수면* 으로 차고(depth=filled−지형>0=호수), 경사면은 채워지지 않는다(depth=0). 호수 *타입*을 박지 않는다 —
  //   일반 높이장에 채움 알고리즘을 돌린 *측정*일 뿐(타입 0). 순수·결정론·렌더 의존 0.
  //
  //   opts: { elevFn(i,j)->높이, x0, y0, W, H } — 창 경계 = 물이 빠지는 유출구(경계 높이로 spill).
  //   반환: { filled, terrain, depth:Float64Array(filled−terrain), W,H,x0,y0, lakeCells, maxDepth, volume(Σdepth) }
  //   성질: filled ≥ terrain 어디서나(물은 더하기만)·분지는 평평 수면(같은 호수=같은 filled)·순수 경사=호수 0.
  function lakeFill(opts) {
    opts = opts || {};
    const elevFn = opts.elevFn, x0 = opts.x0 || 0, y0 = opts.y0 || 0, W = opts.W || 64, H = opts.H || 64;
    const N = W * H;
    const terrain = new Float64Array(N), filled = new Float64Array(N), closed = new Uint8Array(N);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) terrain[r * W + c] = elevFn(x0 + c, y0 + r);
    // 최소 힙(수면 높이 오름차순) — [level, idx].
    const heap = [];
    const hpush = (l, i) => { heap.push([l, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } };
    const hpop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let p = 0; for (; ;) { let l = 2 * p + 1, rr = 2 * p + 2, s = p; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (rr < heap.length && heap[rr][0] < heap[s][0]) s = rr; if (s === p) break; const t = heap[s]; heap[s] = heap[p]; heap[p] = t; p = s; } } return top; };
    // 경계(유출구)부터 — 경계 셀의 수면 = 자기 지형(밖으로 자유 배수).
    for (let c = 0; c < W; c++) { for (const r of [0, H - 1]) { const k = r * W + c; if (!closed[k]) { closed[k] = 1; filled[k] = terrain[k]; hpush(terrain[k], k); } } }
    for (let r = 0; r < H; r++) { for (const c of [0, W - 1]) { const k = r * W + c; if (!closed[k]) { closed[k] = 1; filled[k] = terrain[k]; hpush(terrain[k], k); } } }
    const nb4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    while (heap.length) {
      const [level, k] = hpop(); const c = k % W, r = (k - c) / W;
      for (const [dc, dr] of nb4) {
        const nc = c + dc, nr = r + dr; if (nc < 0 || nc >= W || nr < 0 || nr >= H) continue;
        const nk = nr * W + nc; if (closed[nk]) continue;
        closed[nk] = 1; filled[nk] = Math.max(terrain[nk], level);    // 이웃 수면 = max(지형, 흘러온 수면) → 분지는 유출구 높이로
        hpush(filled[nk], nk);
      }
    }
    const depth = new Float64Array(N); let lakeCells = 0, maxDepth = 0, volume = 0;
    for (let k = 0; k < N; k++) { const d = filled[k] - terrain[k]; depth[k] = d; if (d > 1e-9) { lakeCells++; volume += d; if (d > maxDepth) maxDepth = d; } }
    return { filled, terrain, depth, W, H, x0, y0, lakeCells, maxDepth, volume };
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

  return { fnv1a, hashIndex, valueNoise2D, fbm, fieldNoise, biomeField, flowAccumulation, lakeFill, streamChunks, VERSION: 9 };
});
