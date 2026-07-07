# ROADMAP — 구현 현황 + 다음 단계

이 문서가 **현재 상태의 원본**이다 — 매 세션 갱신한다. 세션 진행 방식은 [../SKILL.md](../SKILL.md),
목표·원칙은 [../CLAUDE.md](../CLAUDE.md), 설계 근거·구조는 [DESIGN.md](DESIGN.md). 단계의
**완료 기준**을 통과하면 체크(✅)하고 결정·함정은 DESIGN.md 에 반영한다. 순서는 권장이며
독립 단계는 건너뛸 수 있다. 완료 기준은 가능한 한 `test/` 하니스로 재현 가능하게 쓴다.

## 구현 현황

각 레이어는 독립 데모를 가진다 (레이어 = 데모). L0~L6 모두 ✅ 구현 완료. 설계 근거·구조 상세는 [DESIGN.md](DESIGN.md).

| 층 | 의도 | 구현 (파일 · 심볼) | 데모 | 알려진 한계 |
|---|---|---|---|---|
| L0 렌더 | GPU 상주 3DGS 래스터 | engine.js 파이프라인, wgsl KEY/SORT/RENDER | 모든 프리셋 | bitonic O(N log²N) — radix 후보 |
| L1 자율 | 이웃 없는 per-splat 규칙 | wgsl SIM (cohesion/flow/updraft), 필멸 세대 교대 | 불·숲의 정령 | flow 는 발산 있는 가짜 curl |
| L2 이웃 | 응집/분리/점성 → 형태 창발 | wgsl SIM `E.binding` 블록 + dense grid | 슬라임·물 | in-place 갱신 지터, SLOTS 초과 누락(의도) |
| L3 골격 | shape matching + 본드 파단/재흡수 | wgsl CLUSTER, engine `_initGolem` | 돌골렘 | 본드 Jacobi 혼재 — 더블 버퍼 후보 |
| L4 성장 | rest 부착 + birth 성장 시계 + 연소 | wgsl SIM `E.growRate` 조기 경로, `_initTree` | 나무 | — |
| L5 상호작용 | 다중 개체 + 공유 격자 창발 | Entity 테이블, `heatEmit`, `setScene` | 불×나무 | 개체 8 상한 |
| L6 뼈대 살 | 뼈대의 순수 함수로 살이 자란다 | skeleton.js(IR/FK/문법/FBX), wgsl SIM `E.fleshK`, `_initFleshCloud`, OVERLAY | 히키토(+FBX 드롭) | 관절 이음새 단차, 부피 보존 없음, Evaluator 없음 |

S 트랙(무대)·E 트랙(에디터)의 완료 상태는 아래 각 트랙 절의 ✅ 표시를 원본으로 삼는다.

## R1 — 살 이음새·부피 (L6 품질)

- **왜**: 친화가 뼈 단위라 관절에서 이웃 뼈 살이 겹치거나 벌어진다. 관절 굽힘 시 부피 감각도 없다.
- **구현 지점**: `wgsl.js` SIM L6 블록 (성장 자리 계산), 필요 시 `engine.js _initFleshCloud` (친화 배정).
- **방법 후보**: 관절 근처(t≈0 or 1) 스플랫은 부모/자식 뼈 자리를 t 로 혼합; 굽힘각 기반 자리 반경 보정(bulge 근사).
- **완료 기준**: `node test/render-shot.js out.png walk` 에서 어깨·무릎 이음새 단차가 눈에 안 띄고, idle/walk/wave 모두 방울 재발 없음.

## R2 — Evaluator (정량 로깅)

- **왜**: 지금은 눈 검증뿐. hikito harness 매핑의 Evaluator 축이 비어 있다 (Planner=뼈대, Generator=grammar 는 있음).
- **구현 지점**: `test/` 에 지표 스크립트 추가 (스플랫 buffer readback 기반).
- **지표 후보**: 뼈대 커버리지(뼈별 스플랫 수 분포), 자리 오차 RMS, 실루엣 대비, 자기충돌 부피.
- **완료 기준**: 한 커맨드로 클립별 지표 JSON 출력, R1 이후 회귀 감시에 사용 가능.

## R3 — Detail 층 (스타일 2차 정의)

- **왜**: 자리 스프링 살은 매끄러워 날카로운 특징(손가락 마디, 얼굴, 뿔)이 없다.
- **방법 후보**: 뼈대 세분화(가상 뼈), 자리에 detail 변위(시드 노이즈를 grammar 로 제어), 유전자화.
- **완료 기준**: 히키토 프리셋에서 손/얼굴 부위가 실루엣으로 구분(사진), grammar 값만으로 스타일 변형 가능.

## R4 — 메시화 + 자동 스킨 웨이트 (UE5 다리)

- **왜**: hikito-flesh 로드맵 1번의 이 프로젝트 버전 — 바인드 포즈 살을 메시로 굽고,
  정점 웨이트를 "어느 뼈 친화 스플랫이 근처인가"에서 자동 도출하면 스키닝이 공짜.
- **완료 기준**: 바인드 포즈 → 메시(+웨이트) 내보내기, UE5 에서 Mixamo 클립으로 재생 확인.

## S 트랙 — Spark 지형 무대 (worldlabs Marble)

상세 계획·아키텍처·리스크는 [PLAN-SparkTerrain.md](PLAN-SparkTerrain.md) 참조. 무대(외부 생성
3DGS 지형, Spark 렌더) 위에 생명(기존 WebGPU 배양)이 사는 2층 세계 — R 트랙과 독립 진행 가능.

- ✅ **S1 — 무대 로더 + 카메라 동기**: `vendor/spark/`(spark 2.1.0 + three 0.180 ESM 격리) +
  `js/stage.js`(무대 탭: URL/드롭/정합 노브, `?world=` 딥링크) + WebGPU 캔버스 premultiplied
  투명 합성. 검증: `node test/stage-shot.js` — 절차 지형 fixture(PLY) 위 생명 오버레이 사진.
  함정: SparkRenderer 는 자동 생성이 아니다 — scene 에 명시적으로 추가해야 그려진다.
- ✅ **S2 — collider GLB → heightfield → 시뮬 바닥**: `js/heightfield.js`(최소 GLB 파서 + 최대
  높이 베이크, three 무의존) → `engine.setHeightfield`(r32float 텍스처) → SIM 바닥을
  `terrainH()` bilinear + 법선 반사로 교체 (평면 폴백 = 기존 거동과 일치). emitter y 는 지상고로
  해석(지형 높이 가산) — 나무가 능선에 뿌리내린다. 정합 노브 변경 시 재베이크(디바운스).
  검증: `node test/terrain-shot.js` — 침투 0% + 바닥 포락선 지형 밀착(0.10 vs 평면 0.32) +
  슬라임 경사 정착·불×나무 골짜기 사진. 한계: 골짜기가 격자 바닥(y=-0.8) 아래면 L2 이웃
  규칙이 꺼진다 — S5 시뮬 버블에서 해소.
- ✅ **S3 — 오클루전 합성**: collider 를 depth-only prepass 로(OCC 셰이더, 무대 정합 변환 공유)
  → 렌더 FS 가 뷰 거리 vs 선형화 깊이를 비교해 soft fade(마진 0.15). 스플랫 VS 가 NDC z 를
  0 고정하므로 viewZ 를 varying 으로 전달하는 것이 핵심. 검증: `node test/occlusion-shot.js` —
  능선 가림 시점에서 생명 픽셀 60501→3202 (5%), 전후 사진. 남김: fog 톤 정합(무대·생명 공용
  안개)은 시각 폴리시 항목으로 보류 → T5 에 합류.
- ✅ **S4 — LoD + 스트리밍 인프라 + 샘플 지형**: SparkRenderer `enableLod` + 예산
  `lodSplatCount`(1.5M), SplatMesh `lod:true`(브라우저 Tiny-LoD, UI 토글·`?lod=`) —
  오프라인 Bhatt-LoD 베이커는 Spark repo 의 Rust 도구라 npm 미제공, `.rad` 는 로드 경로만
  준비(포맷 지원 + Range 서버). `tools/serve.py`(stdlib Range 서버)로 run.sh/run.bat 교체,
  test 서버도 Range 지원. `tools/gen-sample-terrain.js` → `assets/worlds/sample-terrain.{ply,glb}`
  (2.3MB 커밋) — 무대 탭 [샘플 지형] 버튼이 무대+collider 를 한 번에 로드 (오프라인 동작).
  검증: `node test/range-server.js`(9/9) + stage-shot sample+lod=1. 남김: 실제 Marble 대용량
  월드/.rad 에서의 fps·점진 로드 실측 (실에셋 필요 — swiftshader 하니스로는 무의미) → T6 에 합류.
- ✅ **S5 — 상호작용 심화**: ① 낙재(落灰) — 나무가 다 타는 순간 일부가 시드 확률로 가지에서
  분리(life 음수 플래그 — 나무 초기값 1e9)되어 불씨로 떨어지고 지면에 붙어 그을음 흔적이 되며,
  재생 시계가 차면 가지로 복귀. 렌더 변경 없음(재 색은 기존 fuel 채널 유도). ② 시뮬 버블 —
  gridOrigin 은 이미 프레임 유니폼이라 카메라 타깃 추종만 배선(`opts.gridCenter`, 격자는 매
  프레임 재구축이라 이동 안전), heightfield 베이크 영역도 타깃을 따라 재베이크(2u 이동 시,
  재시드 없음). 부수 수정: 나무 뿌리가 emitter y 무시하고 y=0 고정이던 것을 지형 높이로.
  검증: `node test/ash-shot.js`(연소 963·분리 519·정착 335) + `node test/bubble-shot.js`
  (격자 밖 [7,*,7] 슬라임 — 버블 시 휴지 간격 2.2배 = L2 생존) + 회귀 없음.

## T 트랙 — 오픈월드 지형 (광활·확장성·다채로움)

상세 계획·현황 진단·리스크는 [PLAN-OpenWorldTerrain.md](PLAN-OpenWorldTerrain.md) 참조 (상태: **제안** —
확정 시 여기서 단계를 관리). 현재 지형은 유한 단일 패치(반폭 ≤15m, 단일 fBm·단일 팔레트) —
MMORPG 급으로 가려면 월드 함수·청크 스트리밍·바이옴·스캐터가 필요하다. R·E 트랙과 독립 진행 가능.

- ✅ **T1 — 월드 함수**: `terrain-gen.js` 를 순수 무한 도메인 `world(x,z)` 로 확장 — 저주파
  2채널(온도·습도) → 4 육상 바이옴(평야/산악/사막/설원) 소프트맥스 경계 보간 + domain warp
  + ridged multifractal 혼합 + 바이옴 팔레트 + `waterY`(높이 기반 수역). `create(params)` 는
  "월드의 한 창"(`cx,cz` 중심)으로 재정의 — 창 좌표가 곧 월드 좌표라 원점이 달라도 겹침이
  자동 일치(봉합 코드 불필요). 창의 `height()` 는 시뮬 격자 바닥용 `-0.72` 클램프 유지,
  `world.heightAt()` 은 클램프 없는 순수 원본(버블 y 추종은 T3). 에디터 디테일 패널에 바이옴
  토글·바이옴 크기·수위 노브 + 범위 상한 40m(단일창 바이옴 미리보기). 노드 require 가능
  (window/module 양쪽). 검증: `node test/biome-shot.js` — ① 원점 다른 두 창 겹침 height/biome/
  color diff 0 (순수 Node) + ② 4바이옴 파노라마 렌더 색족 ≥4 판정 사진. 편의 부수: 에디터 기본
  시드 7→8(완만한 평야 창). 남김: 창 PLY 스플랫 지터는 여전히 인덱스 기반 — 타일 경계 정합
  (같은 월드좌표=같은 스플랫)은 T2 청크 스트리밍에서.
- ✅ **T2 — 청크 무대 스트리밍**: 절차 월드를 정사각 타일(19.2m)로 나눠 카메라 타깃 중심의
  링을 로드 — 근접 링(ring 0) 풀 밀도(64²), 외곽 링(ring 1) 저밀도(32²), 링 밖 dispose.
  타일 PLY 는 `world.tilePly(x0,z0,size,G)` 로 브라우저에서 즉석 생성(오프라인 동작). 이음새
  정합: 스플랫을 **전역 셀 격자**에 배치하고 지터를 셀 인덱스(월드 좌표) 해시로 셀 내부에
  가둔다 — 이웃 타일과 셀이 겹치지도 벌어지지도 않아 같은 밀도 타일끼리 이음새가 없다.
  `stage.js` 가 타일 Map·링 정책·SplatMesh 부착/폐기를 관리(`startTileWorld`/`updateTileCenter`/
  `tileStats`), `frame()` 이 카메라 타깃을 따라 링 갱신(중심 타일 불변 시 즉시 반환). `?tiles=<seed>`
  딥링크 + index.html 에 terrain-gen.js 동봉. 검증: `node test/world-pan-shot.js` — 직진 팬 중
  타일 교체(합집합 45>25) + 메시 25·스플랫 53k 상한 유지(O(시야반경)) + 중앙밴드 지형 100%
  (틈 없음) 사진. 남김: near↔far 링 경계의 밀도 불연속 이음새(외곽·원거리라 fog 로 가려질
  것 — T5)는 미봉합. Marble 실에셋은 사전 분할 타일(.spz/.rad)을 같은 링 정책으로 → T6.
- ✅ **T3 — 시뮬 바닥 가상화 + 버블 y 추종**: ① `heightfield.bakeFn(heightFn, region)` — 절차
  월드의 시뮬 바닥을 height 함수에서 창 위로 직접 굽는다(triSoup 순회 없음, O(창)). ② 실에셋용
  `buildIndex`/`bakeIndexed` — collider 삼각형을 월드 XZ 버킷으로 인덱싱해 창에 걸린 것만
  순회(O(창), 나이브 bake 와 창 안 diff 0, 순회 3%). ③ `engine.bubbleCenter(target)` — 격자 y
  중심을 카메라 밑 지형 높이+0.8 로 추종(평면 폴백은 타깃 y 그대로 = 기존 불변), app.js·editor.js
  가 gridCenter 로 사용. terrain-gen floor 클램프 -0.72→-3.0(버블 추종 후 느슨한 안전 하한 —
  고저차 큰 산·계곡 가능). 검증: `node test/terrain-bubble-shot.js` — 원점 ≈70u 3m 분지에서
  침투 0%·계곡 바닥 정착(사발내 100%)·L2 생존(확산 0.27 vs 버블 고정 0.08) + 버킷 인덱스 diff 0.
  전 프리셋 회귀(terrain/ash/editor/render/bubble/occlusion/stage/app-smoke) 없음. 남김: L4 rest·L6
  자리 등 y 절대 가정은 없었음(격자 매 프레임 재구축) — 회귀로 확인.
- **T4 — 스캐터·개체 스트리밍**: 청크 시드 결정론 스폰 테이블 + 엔진 슬롯 증분 교체(거리순 활성).
  완료 기준: 이동 중 능선마다 나무 등장·소멸, 불×나무가 임의 좌표에서 성립.
- **T5 — 물 + 원거리 폴리시**: 수면 타일 + 무대·생명 공용 fog (**S3 잔여 합류**). 완료 기준:
  호수 파노라마 — 수면·안개 톤 양층 일치.
- **T6 — 실측·예산**: 실 Marble/.rad + 청크 월드 fps·메모리 HUD (**S4 잔여 합류**). 완료 기준:
  데스크톱 60fps 수치 기록.

## W 트랙 — 이미지 컨셉 → 월드 (한 이미지에서 유사한 상호작용 월드)

상세 제안·설계 근거·리스크는 [PLAN-WorldFromImage.md](PLAN-WorldFromImage.md) 참조 (상태: **진행 중** — W1
완료, 다음은 W2. 여기서 단계를 관리). C 트랙(이미지→캐릭터 게놈) 방법론의 월드 판 — 컨셉 이미지 한 장을
월드 게놈(지형·바이옴·수역·대기·생명)으로 번역해 T 트랙 스트리밍 월드 위에 배양한다. 의존: W1 선행·독립,
W2·W3 은 W1 뒤, W4 는 W2+W3, W5 는 T4, W6 은 T5.

- ✅ **W1 — 월드 게놈의 데이터화**: `terrain-gen.js` 의 하드코딩 `BIOMES`/`WATER_COL` 을 게놈 필드로
  승격 — `world(genome)` 이 `genome.biomeSet`/`water` 를 있으면 소비, 없으면 기본 프리셋. `WATER_ID` 는
  바이옴 수(`biomeSet.length`)로 유도해 바이옴 개수가 프리셋마다 달라도 성립(기본 4). `P.biomes`(불리언
  토글)와 충돌 없도록 배열은 `biomeSet` 신규 필드. `PRESETS`/`preset(name)`(깊은 복사) 신규 — `temperate`
  (현행 상수와 바이트 동일)·`ashen`(3바이옴·붉은 팔레트·물 없음). 검증: `node test/world-genome.js`(순수
  Node) — ① temperate 프리셋 경유가 현행 플랫 기본과 diff 0(회귀) + ② ashen 이 평균색거리 0.295·육상
  바이옴 완전 분리(다채로움). `node test/biome-shot.js`(회귀, 연속성 diff 0·렌더색족 4/4·exit 0) +
  `node test/preset-shot.js ashen`(용암능선 파노라마 사진). 남김: 대기·생명은 W6·W5, 스타일 프로파일
  검증기는 W2.
- **W2 — 월드 스타일 프로파일**: 진폭·바이옴 수·채도·수위 울타리 + `validate(genome)` 검증기(반려).
  완료 기준: 프로파일 안 통과·극단 반려 판정 하니스.
- **W3 — 컨셉 검증 하니스**: `test/concept-shot.js` — 게놈 → 대조용 대표 파노라마. 완료 기준: 규격 PNG 산출.
- **W4 — 이미지 → 월드 게놈 추출기 v0**: `tools/world-extract` — LLM vision(프로파일 제약) → 게놈 + 검증 +
  에디터 후보정. 완료 기준: 이미지 1장 → "같은 월드" concept-shot, 후보정 ≤5 슬라이더.
- **W5 — 생명/스캐터 연동** (**T4 의존**): 게놈 생명 층 = 스폰 테이블. 완료 기준: 이동 중 컨셉대로 개체 등장.
- **W6 — 대기·물 정합** (**T5 의존**): 게놈 대기 층 = fog·스카이·수면. 완료 기준: 무드 재현 사진.

## C 트랙 — 캐릭터 배양 (이미지 컨셉 → 게놈 → 살)

상세 제안·설계 근거·리스크는 [PLAN-CharacterGenesis.md](PLAN-CharacterGenesis.md) 참조 (상태: **진행 중** —
C1~C3(형태·채색) 완료, 다음은 C4 부속. 여기서 단계를 관리한다). 오픈월드 MMORPG 캐릭터를 이미지 몇 장에서 게놈(형태·채색·재질·부속
데이터)으로 번역해 표준 스켈레톤 위에 배양한다 — 클립 무수정 재사용, 스타일은 프로파일×공용 유도로 통일.

- ✅ **C1 — 문법의 데이터화**: `radiusForName`(기본 문법) × **게놈 배율**(형태 게놈 ①). 새 모듈
  `js/genome.js`(`HktGenesisGenome`) — 부위 그룹 분류(이름 기반, rig-agnostic)·스타일 프로파일
  (반지름 배율 0.5~2.2·스텝 0.1 스냅)·`radiusScale(genome, name)`. skeleton.js `pose(...,genome)` 5번째
  인자로 세그먼트 `ra/rb` 에 곱한다(항등/미지정 부위 → 배율 1). app.js·editor.js 는 `skel.genome`
  (기본 항등) 배선, 에디터 디테일 패널에 부위 반지름 슬라이더(E 트랙 유전자 슬라이더 확장). 검증:
  `node test/genome-shot.js` — ① pose(없음)≡pose(항등) 세그먼트 bit-exact(회귀 0, CPU 결정론) +
  ② 머리 1.6× 게놈이 walk 무수정 재생 중 머리밴드 확산 RMS 1.5×↑(실루엣 차이) 사진. 남김: 길이
  배율·힙 보정은 C2, 채색/재질/부속은 C3~C4.
- ✅ **C2 — 수동 게놈 2종**: 형태 게놈 ① 에 **길이 배율** 추가(morph 엔트리 `{r, l}`) — FK offset 에
  곱해 클립 회전과 직교 유지. **힙 보정**: 대표 발에서 루트까지 `offset.y×(1−길이배율)` 누적으로
  루트 y 를 올려 발을 지면에 붙인다. 수동 게놈 `GENOMES`(덩치=굵고 짧은 다리 l0.72 / 호리호리=가늘고
  긴 팔다리 l1.32) + 에디터 체형 프리셋·부위 굵기/길이 슬라이더. 검증: `node test/genome-body-shot.js`
  — ① 항등/덩치/호리호리 모두 walk·idle·wave 발 최저 y 지면 근방(힙 보정, CPU 결정론) + ② 같은 walk
  에서 덩치(1.6)<호리호리(1.9) 키·상단 y 대비 사진. **애니메이션 보존의 증명 사진**. 남김: 단면
  편평도(morph ③번째 축)는 미구현 — 필요 시 후속. ExternalSkeleton(FBX)은 길이 배율 미적용(반지름만).
- ✅ **C3 — 부위 채색**: 채색 게놈 ②. 뼈 그룹 → 램프 양 끝(colorA/colorB). 스플랫은 이미 제 뼈
  (`rest.w`)를 알므로, 렌더에 `rest`+`boneGroup`(뼈→그룹 id)+`groupColors`(그룹 램프) 바인딩을
  더해 살(`fleshK>0`)의 `mix(colorA,colorB,heat)` 를 **그룹별 램프**로 바꾼다. 램프 *양 끝만*
  게놈이 정하고 보간 factor(heat=속도·변형률)는 유도 유지 → 절대 원칙 1 불변. palette 미지정
  부위·개체는 개체 기본색 폴백(회귀 0). genome.js `groupColors`/`GROUP_IDS`(engine `GROUP_COUNT`
  동기), 에디터 부위 색 피커. 검증: `node test/genome-color-shot.js` — ① palette(머리 빨강·몸통
  초록·다리 파랑) 밴드 색상(hue) 크게 구분 + ② 무팔레트 밴드 색상 동일(속도 유도만) 사진. 남김:
  개체별 팔레트(현재 그룹 램프 전역 1벌)는 C7 다개체에서.
- **C4 — 부속 리그**: 가상 뼈 스프링 체인(꼬리/뿔/귀/망토) — 클립 데이터 무수정. 완료 기준: walk 중 꼬리 지연 추종 사진.
- **C5 — 이미지 → 게놈 추출기 v0**: `tools/` + LLM vision + 스타일 프로파일 검증기. 완료 기준: 이미지 2장 → 후보정 ≤5 슬라이더로 3클립 통과.
- **C6 — 게놈 오버레이**: 장비 = 차분 게놈 합성 + 결정화 채널(θ 양자화·면 음영·에지 — 경질 인공물). 완료 기준: 맨몸(출렁)/갑옷(강직 판금) 비교 사진.
- **C7 — 스폰 웜스타트 + 다개체**: 즉시 성체 + 개체별 뼈대. 완료 기준: 게놈 다른 2명이 한 장면에서 각자 클립 재생. 대량화는 T4 합류.

권장 선행 R1(이음새), 합류 R3(detail)·R2(Evaluator)·T4(개체 스트리밍).

## E 트랙 — 에디터 (작업 확인 도구, R 트랙과 독립)

- ✅ **E1 — 에디터 셸 + 3기둥**: `editor.html`+`js/editor.js` — 게임 에디터형 레이아웃
  (툴바/아웃라이너/뷰포트/디테일/타임라인). ① 지형 생성: `js/terrain-gen.js`(시드 fBm,
  단일 height 원본) → 무대 PLY(Spark `load(File)`) + collider 수프 → heightfield/오클루더
  (GLB 왕복 없음, 항등 정합). ② 오브젝트 배치: 배치 모드 클릭(광선-지형 이분법)·마커
  드래그·아웃라이너/디테일(유전자 슬라이더 라이브), 개체 수 2^k 는 void 개체 패딩.
  ③ 애니메이션: 스켈레톤(origin 배치, 발 높이 지형 유도) + 타임라인(재생/스크럽/배속,
  외부 클립은 mixer.setTime). 검증: `node test/editor-shot.js` — 지형+개체5(슬라이스 8)
  +히키토 walk 합성 사진 + 판정. 남김(E2 후보): 장면 저장/불러오기(JSON), 개체별 스켈레톤,
  실행 취소(undo), 기즈모 회전/스케일.

## R5 — 엔진 일반 큐 (L6 무관, 독립)

- ~~장면 편집기 (개체 추가/배치 UI)~~ → E1 에서 구현 · 슬라임의 포식(질량 이전)
- 진짜 curl noise (발산 무) · GPU radix sort 로 bitonic 대체
- L2 위치 더블 버퍼 · L3 본드 더블 버퍼 (지터/정합이 문제 될 때)

## 완료 이력

- ✅ L0~L5 (README 로드맵 참조)
- ✅ L6 뼈대 살: Skeleton IR + 살 문법 + 성장 자리 스프링 + 뼈대 오버레이 + Mixamo FBX 드롭 + 패널 탭 (PR #486)
