# CLAUDE.md — HktSplatGenesis

캡처 없는 절차적/창발 3DGS 실험장. **스플랫 = 세포** — 시뮬 상태가 유일한 원본이고 렌더 속성은 항상 유도된다. `HktGaussianSplatWeb`(PLY 뷰어)과 별개 프로젝트지만 무-빌드 컨벤션과 EWA 렌더 수학을 공유한다.

## 작업 절차 (새 세션 진입 순서)

1. **[Docs/DESIGN.md](Docs/DESIGN.md)** — 구현 의도, 레이어 지도(의도→구현→검증→한계), 설계 결정.
2. **[Docs/ROADMAP.md](Docs/ROADMAP.md)** — 단계별 작업 큐 (목표·구현 지점·완료 기준). 여기서 다음 단계를 고른다.
3. 해당 코드 주석 — 세부 설계·함정의 원본.
4. 검증은 `test/` 하니스([test/README.md](test/README.md)) — 사진 없는 "동작함" 주장 금지.
5. 단계 완료 시 ROADMAP 체크, 새 결정·함정은 DESIGN 에 기록. 이 문서(CLAUDE.md)에는 쌓지 않는다.

## 절대 원칙

1. **렌더 속성 직접 생성 금지** — 공분산·색·불투명도는 반드시 시뮬 상태(pos/vel/age/energy)와 유전자로부터 셰이더에서 유도한다. "모양을 그리는" 코드가 생기는 순간 이 프로젝트의 존재 이유가 사라진다.
   단 하나의 예외 — **무대(stage)**: 외부 생성 3DGS 지형 월드(worldlabs Marble)는 Spark 레이어로 로드한다. 무대는 로드하고 생명은 배양한다 — 생명(우리 풀의 스플랫)에는 이 원칙이 그대로 적용된다. ([Docs/PLAN-SparkTerrain.md](Docs/PLAN-SparkTerrain.md))
2. **개체 정의 = 유전자 벡터** — 새 존재(슬라임/골렘/나무)는 새 코드 경로가 아니라 새 유전자 값 + (필요 시) 새 국소 규칙으로 만든다. 프리셋은 유전자 공간의 점일 뿐.
3. **GPU 상주** — 시뮬→정렬→렌더 사이 CPU 왕복 금지. 상태 readback 은 디버그 한정.

## 아키텍처

```
grid clear/build(64³, 셀당 16슬롯, 전 개체 공유) → sim(compute: L1 자율 + L2 이웃 + L4 성장/연소 + L5 발열 + L6 뼈대 살)
→ cluster(L3: 워크그룹=클러스터 256스플랫, shape matching + 본드 파단/재흡수)
→ key(뷰 깊이→단조 uint) → bitonic sort → EWA 인스턴스드 쿼드 (+ L6 뼈대 오버레이 라인/관절)
```

L4 나무는 sim 안의 조기 경로(`E.growRate > 0`): rest 버퍼가 (부착점, birth) 골격을 담고,
`misc.z/w` 가 (heat, fuel) 연소 상태. fuel 채널 도입으로 모든 init 은 `misc.w = 1` 필수
(0 이면 렌더가 재로 해석해 어두워진다).

L5: 유전자는 유니폼이 아니라 **Entity 테이블**(storage, 144B×8) — 스플랫 풀을 균등
슬라이스로 개체에 배정(`eid = i / sliceSize`, sliceSize 는 256 의 배수 필수 — CLUSTER 의
워크그룹 균일 조기 return 전제). 격자가 전 개체 공유라 다른 개체의 스플랫이 이웃으로
잡힌다 — `heatEmit` 유전자(불 정령)가 나무의 연소 전파 규칙에 그대로 물리는 이유.
격자 셀 크기는 전역 GRID_CELL(0.15) 고정, 개체 reach 는 이하로 클램프.

L6 히키토(hikito-flesh 이식): 살은 **뼈대의 순수 함수**. skeleton.js 의 뼈대(built-in FK 리그
+ FBX `ExternalSkeleton`, 이름 기반 살 문법)가 매 프레임 taper 캡슐 세그먼트(≤128)를 bones
storage 로 올리고, form 3 스플랫은 뼈 친화(rest.w) + 시드 성장 자리(축 t·방위 θ·깊이 u)를
*현재 포즈에서 유도*해 스프링 추종한다 — L4 rest 부착점과 같은 원리, 스키닝 없음. 세그먼트
**순서**가 친화 인덱스의 기준이라 모션 소스(built-in↔FBX)가 바뀌면 재시드 필수. 세부·설계
근거는 wgsl.js SIM L6 블록·skeleton.js·app.js 주석이 원본.

- `js/wgsl.js` — 셰이더 8종(+뼈대 오버레이). `Splat`(48B)=`SPLAT_STRIDE`(12 float), `SimParams`(64B, 전역만),
  `Entity`(144B)=`ENTITY_STRIDE`(36 float), `Cluster`(96B)=`CLUSTER_STRIDE`(24) — engine.js 와
  바이트 일치 필수. 격자 상수(GD=64, SLOTS=16)·클러스터 크기(K=256=CLUSTER_K)도 동기.
- `js/engine.js` — 버퍼/파이프라인/프레임 인코딩. 정렬 단계 (k,j) 는 256B 슬롯 테이블 + 동적 오프셋 (WebGPU 는 push constant 없음).
- `js/presets.js` — 유전자 스키마(`GENE_DEFS`)·프리셋(`PRESETS`)의 유일한 원본 (app.js 와 test/ 가 공유 — 드리프트 방지).
- `js/app.js` — UI·부트·루프. 유니폼 레이아웃 변경 시 wgsl.js/engine.js 양쪽 동기화.
- `js/math.js` — WebGPU 클립 규약(z∈[0,1]) 카메라. `HktGaussianSplatWeb` 의 GL 버전과 혼동 주의.
- `js/skeleton.js` — L6 뼈대: Skeleton IR + 절차 클립 FK + 살 문법 + ExternalSkeleton(FBX).
  살 힘은 wgsl.js SIM 의 fleshK 규칙 — 이 파일은 세그먼트라는 *입력* 만 만든다.
- `js/stage.js` — S 트랙 무대(ES module, import map 배선): Spark(WebGL2)로 외부 3DGS 월드를
  생명 캔버스 아래 별도 캔버스에 렌더, 오빗 카메라 뷰 파라미터만 미러(투영 행렬 공유 금지 —
  클립 규약이 다르다). 생명→무대 데이터 흐름 없음.
- `js/heightfield.js` — S2 충돌 지형: collider GLB(비압축) 파싱 + heightfield 베이크
  (three 무의존 — 생명 쪽 입력이라 vendor three 반입 금지). 시뮬은 무대를 이 텍스처로만 안다.

## 불변 조건 (깨지면 화면이 즉시 무너짐)

- 스플랫 수 N 은 **2의 거듭제곱** (바이토닉 정렬 전제, `setCount` 가 검증).
- L2 이웃 힘은 프레임 시작 시점 격자를 기준으로 하되 위치는 in-place 갱신(Jacobi/Gauss-Seidel 혼합) —
  프로토타입 허용 오차. 지터가 문제 되면 위치 더블 버퍼가 정석 (로드맵).
- 격자 셀 초과분(SLOTS 넘는 스플랫)은 이웃 힘에서 조용히 누락 — 우아한 저하가 의도.
- L3 본드는 이웃 클러스터 com 을 프레임 혼재(Jacobi 근사)로 읽고, 파단 판정도 클러스터별
  독립(비대칭 허용). 강한 정합이 필요해지면 본드 상태 더블 버퍼가 정석 (로드맵).
- 클러스터 회전은 Müller 반복 추출 — 이전 프레임 쿼터니언에서 시작하므로 quat 초기값은
  반드시 identity(0,0,0,1) 로 업로드할 것.
- 정렬 키: 카메라 앞 = 음수 뷰 z → orderable uint 오름차순 = **far→near** (back-to-front over 블렌딩 전제).
- 블렌딩 premultiplied over: FS 출력 `vec4(rgb*B, B)` + (one, one-minus-src-alpha).
- 렌더 VS 의 퇴화 처리: 컬 시 네 꼭짓점 동일 위치 반환 (discard 아님).
- L6 살은 자리 스프링 + 친화 분포 + 임계 감쇠 전제 — 전역 SDF 최근접 추종·L2 인력 우세·저감쇠
  중 무엇이든 살이 방울로 붕괴한다 (함정 3종 상세: wgsl.js SIM L6 주석, 프리셋 제약: app.js 히키토).

## 컨벤션

- classic `<script>` 전역 네임스페이스(`HktGenesisEngine`/`HktGenesisWGSL`/`HktMat`/`HktOrbitCamera`/`HktGenesisSkeleton`), 빌드 스텝 없음, 주석 한국어.
- `vendor/` 는 유일한 서드파티 예외 — ① three r147 UMD(+FBXLoader/fflate): **FBX 파싱/FK 전용**.
  ② `vendor/spark/`(S 트랙): Spark + three r180+ ESM — **무대 렌더 전용**, 모듈 스코프로 격리.
  두 three 사본 혼용 금지. 생명 렌더·시뮬 경로에서 three 사용 금지.
- 튜닝 노브는 하드코딩하지 않고 `GENE_DEFS` 슬라이더로 노출 (UE CVar 관례의 웹 대응).
- **문서 역할 분담** — CLAUDE.md: 위치·불변·컨벤션(얇게, 레이어당 한 문단). DESIGN.md: 의도·결정.
  ROADMAP.md: 다음 단계. 코드 주석: 세부·함정의 원본. 경위/서사는 커밋 메시지에만.
