  /* ⑤d 복제(R-주형 자기복제, step-0015) — kTemplate=0 이면 통째로 건너뜀(회귀 0, G·복제 불변 → 해시 가법 skip).
   * SPINE §다섯째 축(유전): 저장(R)의 *씨앗 끝* — 자기복제하는 R-배치(genotype)가 제 사본의 결정화를 *촉매*한다.
   *   복제 = E→R 쌍 거래(닫힌 장부, ⑤결정화와 같은 경계) + 유전형 태그 G 복사. 복제오류(geneMu)=변이, 기질(E) 경쟁=선택
   *   → 다윈 동역학이 substrate 위에서 돈다(genotype = 복제된 R-패턴; 다양성은 *병렬 필드 아닌 속성*=태그 G 에 — 단일 척추).
   *   유전은 *이산* 정보다(연속 필드는 번져 정보를 못 지킨다 — Schrödinger "비주기 결정") — G 는 Uint8 이산 태그, R 은 담체.
   * 표현형: fit(tag) = geneFit0 + geneFitStep·(tag−1) = 복제 propensity(0~1). 높은 태그가 빨리 복제 → 선택이 평균 적합도를
   *   올린다(geneFitStep=0 이면 중립=드리프트). genotype→phenotype 맵은 authored type 분기가 아니다 — E 동역학은 태그로
   *   안 갈리고(필드는 여전히 E), 복제 *속도*만 태그의 함수다. 활성도(E flux)는 여전히 측정으로 환원(척추 체크 2).
   * 국소(척추 체크 3): 주형은 제 4이웃(von Neumann)만 본다(전역 조율자 0). tick 시작 스냅샷(Gbuf)에서 주형을 읽어
   *   같은 tick scan-order 연쇄 폭주를 막는다 — 한 tick = 한 세대. 빈 칸(G==0) 경쟁은 scan 먼저 온 주형이 차지(국소 자원경쟁).
   * 순환(척추 체크 4): 풍화(⑤ kWeather)가 R 을 깎아 R < geneClear 면 G=0(기질이 사라지면 유전 정보도 소멸 — 정보는 저장
   *   극단에만; 소산 극단 불꽃은 흐름이 패턴을 지운다). 빠른 복제(개체 척도) + 느린 풍화(세계 척도) = 유전 정보의 순환.
   * 장부: 복제는 E→R 쌍 거래뿐(G 태그는 거래 0 — 정보지 에너지 아님). sumE+M+R+… 식 불변(잔차 동일). */
  var GENE_VN = [[0, -1], [0, 1], [-1, 0], [1, 0]];   // 복제 이웃(4-근방) — scan 순서 고정(결정론·먼저 온 주형이 빈칸 차지)
  function replicate(sim) {
    var p = sim.p; if (p.kTemplate === 0) return;   // off: replicate no-op. geneInit 은 *건드리지 않는다* — A(읽기전용 측정·재베이스라인 필요)와 달리 G 는 *지속 상태*다:
                                                    //   spawnGene 으로 심은 G 가 있으면(geneInit=true) kTemplate 을 꺼도 그 유전형이 해시에 남아야 한다(faithful fingerprint, sticky).
                                                    //   kTemplate=0·미파종이면 geneInit 기본 false 유지 → G skip(과거 골든 std@/endo@/cwd@/fsm@/flux@ 불변).
    sim.geneInit = true;
    var E = sim.E, R = sim.R, G = sim.G, Gb = sim.Gbuf, W = p.W, H = p.H, N = W * H;
    var rate = p.geneRate, gThr = p.geneThresh, mu = p.geneMu, nG = p.geneTypes;
    var f0 = p.geneFit0, fStep = p.geneFitStep, gClr = p.geneClear, seed = sim.seed, tick = sim.tick;
    var reps = 0, muts = 0, i;
    /* 0. 유전 소거(풍화로 기질 사라진 칸의 태그 제거) + tick 시작 주형 스냅샷(Gb) — 같은 tick 연쇄 폭주 방지(한 tick=한 세대). */
    for (i = 0; i < N; i++) { if (G[i] !== 0 && R[i] < gClr) G[i] = 0; Gb[i] = G[i]; }
    /* 1. 복제 — 각 주형(Gb≠0 & R≥gThr)이 4이웃 빈칸(G==0, 기질 E≥rate)에 propensity=fit 로 침착·태그 복사(±변이). */
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        i = y * W + x;
        var g = Gb[i]; if (g === 0 || R[i] < gThr) continue;
        var fit = f0 + fStep * (g - 1); if (fit > 1) fit = 1; else if (fit < 0) fit = 0;
        for (var d = 0; d < 4; d++) {
          var nx = (x + GENE_VN[d][0] + W) % W, ny = (y + GENE_VN[d][1] + H) % H, j = ny * W + nx;
          if (G[j] !== 0) continue;            // 이미 태그(live) — 먼저 온 주형이 차지(국소 자원경쟁, scan 순서)
          if (E[j] < rate) continue;           // 기질 부족 — 복제할 E 가 없다(자원 문턱 → 경쟁=선택)
          var h = K.tumbleHash(nx, ny, tick, seed);
          if ((h >>> 16) * (1 / 65536) >= fit) continue;   // 발화 propensity = 적합도(표현형) — 고비트
          E[j] -= rate; R[j] += rate;          // E→R 쌍 거래(닫힌 장부 — 결정화와 같은 경계)
          var tag = g, mb = h & 0xffff;
          if (mb * (1 / 65536) < mu) {         // 복제오류 = 변이(시드 의사난수) — ±1 이웃 태그로(wrap)
            tag = ((g - 1 + ((mb & 1) ? 1 : nG - 1)) % nG) + 1; muts++;
          }
          G[j] = tag; reps++;
        }
      }
    }
    sim.geneReps += reps; sim.geneMut += muts;   // 누적 복제·변이(통계 — 장부 무관)
  }

  /* ⑧b 생명 유전(inherit, step-0016) — kInherit=0 이면 통째로 건너뜀(회귀 0, a.g 불변 → lifeGeneInit false → 해시 가법 skip).
   * SPINE §다섯째 축 "유전↔생명 결합": step-0015 가 유전을 R(저장 극단)에 깔았다("유전이 개체보다 먼저"). 이 법칙은 그 genotype 을
   *   *생명의 대사 엔진(m)에 단단히 묶는다* — 생명 = 자기복제 광물(genotype)을 소산 엔진(대사)에 묶어 활성도 *가운데* 선 것(SPINE 결정2;
   *   주요 전이 사다리 복제분자→…→개체 의 다음 칸). 별의 *느슨한* 혈통(metallicity)과 달리 생명은 *단단한* 자기복제 — 유무가 아니라 결합의 단단함.
   * 세 결합(모두 국소 — 전역 조율자 0):
   *   (1) 부트스트랩(획득) — 유전형 없는 생명이 제가 선 칸의 R-genotype(G[center])을 *읽어* 제 유전형으로 삼는다(생명은 광물 유전자에서
   *       부트스트랩, Cairns-Smith). step-0015 의 *이산* 태그를 그대로 읽는다 — 새 유전 시스템이 아니라 같은 genotype 의 *담체 이동*(R→생명).
   *   (2) 상속 — 분열 자식(bornTick==tick)이 *인접 부모*(occ, 자식은 늘 부모의 4이웃에 태어난다)의 태그를 물려받는다(±변이=복제오류).
   *       reproduce(⑧, 동결)를 안 건드린다 — 자식을 점유로 찾아 inherit 가 태그를 박는다(stigmergic, 부모 위치가 매개).
   *   (3) 표현형→대사 — fit(태그)=geneFit0+geneFitStep·(태그−1) 가 낮으면 차등 대사세(inheritCost·(1−fit)·m, m→metabolized 쌍 거래,
   *       crowd 와 같은 소산 경계). 고적합이 덜 내 *생명 개체군에서* 선택된다(R 위 선택을 넘어 *생명 자신*이 적응 — meanFit 상승).
   * 척추: 새 *필드* 없음(a.g 는 생명 *속성* — 다양성은 병렬 필드 아닌 속성, 단일 척추) · authored 분기 없음(대사 *세율*만 태그의 함수,
   *   E 동역학·활성도는 태그로 안 갈림 — 활성도 환원) · 국소 문턱(부트스트랩=내 칸 G, 상속=인접 부모, 표현형=내 m) · 닫힌 장부(표현형세=쌍 거래).
   * ⑧b: ⑧reproduce 뒤(자식이 있어야 상속) · ⑨flux 앞(flux 가 net dE/dt 잰다 — inherit 는 m 만 바꿔 E 불변, 순서 무관하나 측정 앞이 옳다). */
  function inherit(sim) {
    var p = sim.p; if (p.kInherit === 0) { sim.lifeGeneInit = false; return; }   // off: a.g 미작동·해시 skip(과거 골든 불변). geneInit 처럼 sticky 아님 — a.g 는 에이전트가 휘발(사망 시 사라짐)이라 매 tick 게이트로 충분.
    if (!p.life || !sim.agents.length) { sim.lifeGeneInit = true; return; }      // 켜졌으면 lifeGeneInit on(씨앗 a.g 가 해시에 들도록) — 개체 없어도 유지.
    sim.lifeGeneInit = true;
    var ag = sim.agents, G = sim.G, W = p.W, H = p.H, tick = sim.tick, seed = sim.seed;
    var nG = p.geneTypes, mu = p.inheritMu, f0 = p.geneFit0, fStep = p.geneFitStep, cost = p.inheritCost;
    /* occ: *이미 유전형을 가진* 생명의 점유 칸 → 태그(자식이 인접 부모를 찾는 매개). reproduce 는 자식을 배열 끝에 append 하고
     * 태그를 안 박으므로(동결), inherit 시작 시점에 a.g 가 박힌 개체 = 부모(이전 tick 산 것 + 갓 심은 씨앗). 자식(a.g 미설정)은 제외.
     * bornTick 으로 거르지 않는다 — 씨앗을 tick T 에 심고 같은 tick 에 번식하면 bornTick==tick 이라 부모가 빠지는 함정을 피한다. */
    var occ = sim.inheritOcc; if (!occ) occ = sim.inheritOcc = new Map(); else occ.clear();
    for (var k = 0; k < ag.length; k++) { var a0 = ag[k]; if (a0.g) occ.set(a0.center, a0.g); }
    var muts = 0;
    for (var k2 = 0; k2 < ag.length; k2++) {
      var a = ag[k2];
      if (!a.g) {                                  // 유전형 없음 — 상속(갓 태어난 자식) 또는 부트스트랩(기질에서 획득)
        var got = 0;
        if (a.bornTick === tick) {                 // 갓 태어남 → 인접 부모(occ)에서 상속(자식은 늘 부모의 4이웃)
          for (var d = 0; d < 4; d++) {
            var nx = (a.x + GENE_VN[d][0] + W) % W, ny = (a.y + GENE_VN[d][1] + H) % H, pg = occ.get(ny * W + nx);
            if (pg) { got = pg; break; }
          }
          if (got) {                               // 복제오류 = 변이(시드 의사난수, 저비트)
            var hh = K.tumbleHash(a.x, a.y, tick, seed);
            if ((hh & 0xffff) * (1 / 65536) < mu) { got = ((got - 1 + ((hh & 1) ? 1 : nG - 1)) % nG) + 1; muts++; }
          }
        }
        if (!got) got = G[a.center];               // 부트스트랩 — 제가 선 R-genotype 을 읽어 제 유전형으로(생명↔광물 결합). 무유전 기질이면 0(다음 tick 재시도).
        a.g = got || 0;
      }
      if (a.g) {                                   // 표현형 → 대사: 저적합일수록 차등 대사세(선택). 닫힌 장부(crowd 와 같은 소산 경계).
        var fit = f0 + fStep * (a.g - 1); if (fit > 1) fit = 1; else if (fit < 0) fit = 0;
        var tax = cost * (1 - fit) * a.m; if (tax > a.m) tax = a.m;
        a.m -= tax; sim.metabolized += tax;
      }
    }
    sim.inheritMut += muts;                        // 누적 생명 변이(통계 — 장부 무관)
  }
