# CLAUDE.md — HktSplatLife

**캐릭터(동적) 배양** 단독 프로젝트 — WebGPU 전용, 무대(환경) 없음. 이 문서는 **얇게** 유지한다:
목표·지켜야 할 사항·작업 방식만 담는다. 현황·명제·작업 상태는 [STATE.md](STATE.md).
(계보: HktSplatGenesis 의 생명 절반에서 분리했으나, 이제 이 프로젝트는 **자립**한다 — 설계 근거를
외부 문서에 의존하지 않는다.)

## 목표

- **대규모 상용 오픈월드 MMORPG 수준의 캐릭터 품질**을 지향한다.
- **스켈레톤은 그대로 쓰고 살(스플랫)만 얹는다.** 표준 스켈레탈 애니메이션이 뼈대를 구동하고,
  살은 그 위에 자라 뼈 포즈를 따라간다 — 이 분리로 3DGS 의 애니메이션 이슈를 **완전히 해결**한다.
  (버텍스 스키닝·모프 없이 뼈대가 움직이면 살이 지연 추종한다 = 살의 출렁임이 곧 애니메이션.)

## 지켜야 할 사항

### 절대 원칙

1. **렌더 속성 직접 생성 금지** — 공분산·색·불투명도는 반드시 시뮬 상태(pos/vel/energy)와
   유전자로부터 셰이더에서 유도한다. "모양을 그리는" 코드가 생기면 이 프로젝트의 존재 이유가 사라진다.
2. **스켈레톤은 원본을 훼손하지 않는다** — 뼈대는 표준 FK 로만 구동하고, 살은 뼈 포즈의 순수
   함수(SDF 자리)로 매 프레임 유도한다. 바인드 포즈 저장·스플랫-뼈 스키닝 없음.
3. **개체 정의 = 유전자 벡터** — 새 존재는 새 코드 경로가 아니라 새 게놈 값(+필요 시 국소 규칙)으로.
4. **GPU 상주** — 시뮬→정렬→렌더 사이 CPU 왕복 금지. 상태 readback 은 디버그 한정.

### 불변 조건 (깨지면 화면이 즉시 무너짐)

- 스플랫 수 N = **2의 거듭제곱** (바이토닉 정렬 전제), 슬라이스 256 배수.
- 셰이더↔엔진 **바이트 일치**: `Splat` 48B=`SPLAT_STRIDE` 12 float · `Entity` 192B(48, R1 재질 +
  F1 이펙트 포함) · `Cluster` 96B(24) · `CamParams` 256B(fog+조명) · 격자 상수(GD=64, SLOTS=16) ·
  `CLUSTER_K`=256 · `GROUP_COUNT`=14(=genome.js GROUP_IDS 길이) · F1 이벤트 슬롯 `MAX_FX`=16 ×
  `FX_STRIDE` 12 float(=vec4 3개, wgsl.js `FX_SLOTS` 와 동기) — `wgsl.js`↔`engine.js`↔`genome.js`
  ↔`fx.js` 동기 필수.
- L6 살 뼈 세그먼트 상한 `MAX_BONES`=512 (render 셰이더 `rest.w` clamp 511u 와 동기).
- L6 살 = 자리 스프링 + 친화 분포 + 임계 감쇠 전제 — 셋 중 하나라도 무너지면 살이 방울로 붕괴한다.
- F1 이펙트 이벤트 `t0` 는 **> 0** 이어야 한다 (`t0 <= 0` = 비활성 슬롯 규약). 이펙트 스플랫의
  `life` 는 수명이 아니라 *세대 도장*(제가 태어난 이벤트의 t0) — 다른 용도로 쓰면 재발생이 깨진다.
- 정렬 far→near (back-to-front), 블렌딩 premultiplied over.

### 컨벤션

- **WebGPU 전용** — 무대(Spark)·렌더 조정층(director) 코드 없음.
- **외부 FBX 리그 지원** — Mixamo FBX 를 드롭/샘플 로드하면 살(히키토)의 뼈대를 그 클립이
  구동한다(built-in 스켈레톤은 기본값·폴백). `vendor/`(three r147 UMD + FBXLoader + fflate)는
  **FBX 파싱/FK 입력 전용** — 렌더·시뮬은 여전히 자체 WebGPU(절대 원칙 불변). 동봉 로코모션
  샘플: `assets/anim/{walk,run,idle,jump,attack,samba}.fbx`(Mixamo). 검증: `test/fbx-shot.js`.
  주의: 애니메이션-only FBX(스킨 메시 없음)는 `ExternalSkeleton` 이 뼈 world 위치로 바운드를
  잡아 정규화한다 — `Box3.setFromObject` 만 쓰면 size.y=0 → scale 폭주로 화면 밖으로 날아간다.
- 무-빌드 classic `<script>` 전역 네임스페이스(`HktGenesisEngine`/`HktGenesisWGSL`/`HktMat`/
  `HktGenesisSkeleton` 등), 빌드 스텝 없음, 주석 한국어.
- 튜닝 노브는 하드코딩 금지 — 게놈 슬라이더(`GENE_DEFS`)로 노출 (UE CVar 관례의 웹 대응).
- **이펙트도 세포다** — 이펙트 = 게놈(무엇인가) + 이벤트(언제·어디서). 스프라이트 시트·키프레임
  커브·"모양을 그리는" 코드 없음. 새 이펙트는 `js/fx.js` `FX_PRESETS` 에 게놈 한 줄로 추가하고,
  코드(셰이더·엔진·UI)는 손대지 않는다. 발생점(anchor)만 게임 쪽(앱)이 정한다.

## 작업 방식

1. 세션 시작 시 [STATE.md](STATE.md) 를 읽어 현재 명제·작업 상태를 확인한다.
2. 한 번에 하나의 명제(feature)만 다룬다 — 구현/논의 후 STATE.md 의 상태를 갱신한다.
3. 검증은 `test/life-shot.js` 로 픽셀 임계 + GPU 오류 0 을 판정한다 (살이 뼈대를 덮는가).
   이펙트는 시간축 현상이라 `test/fx-shot.js` 로 판정한다 (켜지는가 · 꺼지는가 · 게놈만으로 갈리는가).
4. 세부 설계·함정의 원본은 코드 주석(특히 `wgsl.js` SIM L6, `skeleton.js` 살 문법)이다.
