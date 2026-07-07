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
- ✅ **T4 — 스캐터·개체 스트리밍**: ① 결정론 스폰 테이블 `js/scatter.js`(`HktGenesisScatter.candidates`) —
  월드 함수 위에서 좌표·시드 해시(Math.random 금지)로 후보를 뽑고 바이옴·경사·수위로 거른다
  (바이옴별 나무 밀도 = 다채로움, 창 무관 = 스트리밍 연속성). ② 엔진 슬롯 증분 교체
  `engine.respawnEntity(ei, genes)` — 장면 전체 재초기화(setScene) 없이 한 개체 슬롯의
  splat/rest/cluster 슬라이스만 오프셋 부분 업로드(레이아웃 불변 = 바이트 일치 유지, 교체 안 된
  슬롯은 계속 시뮬 = 재시드 없음). setScene 은 공유 헬퍼 `_sliceInit` 로 리팩터. ③ `ScatterStream` —
  카메라 타깃 거리순 상위 k 스폰만 슬롯(≤8)에 활성, 멀어진 슬롯은 가까워진 스폰으로 교체(이미
  활성인 스폰은 안 건드림). 일부 나무 곁 모닥불 스폰(호스트 나무와 같은 셀)으로 공유 격자에서
  불×나무가 임의 좌표에서 창발. 검증: `node test/world-scatter-shot.js` — ⓪ 원점 다른 두 창 겹침
  스폰 위치 diff 0(순수 Node) + ① +x 직진 중 슬롯 교체(합집합 13>최대 활성 7)·활성 상한 유지 +
  ② 원점 119u 임의 좌표의 스트리밍 나무+모닥불 연소(나무 가열 100% vs 불 없는 대조군 0%) 사진.
  전 프리셋 회귀(app-smoke/bubble/ash/editor-multi/render/world-pan) 없음. 편의: `js/scatter.js` 를
  index.html 에 동봉(모듈 전역 노출). **앱 배선 완료**: 무대 탭 "오픈월드" 버튼이 T2 타일+T5 수면/fog+
  T4 스캐터를 한 번에 켠다(`app.js startOpenWorld` + tick 이 카메라 따라 heightfield 굽고 스폰 갱신) —
  `test/openworld-shot.js` 로 네 요소(지형·수면·나무·하늘톤) 한 프레임 합성 실증. W5(게놈 생명 스캐터)의 선행.
- ✅ **T5 — 물 + 원거리 폴리시** (**S3 잔여 합류**): ① 수면 타일 — `world.waterTilePly` 가 waterY
  평면의 반투명 수면 스플랫을 지형이 수위 밑인 셀에만(심도 기반 청록→남색 팔레트) 굽고, stage.js 가
  지형 타일과 함께 스트리밍(마른 타일은 물 메시 없음). ② 무대·생명 공용 sky/fog 톤 — Spark 스플랫은
  three fog 미지원이라 **무대 fog = clear 색**(지평선), **생명 fog = 렌더 FS**(viewZ 로 fogColor 페이드,
  camUB 160→192B + CamParams fog/fogRange). stage 가 톤의 단일 원본(`getSkyFog`), app 이 그 값을
  engine.frame({fog}) 로 넘겨 두 층이 지평선에서 같은 색으로 만난다. **색공간 정합**: 무대(three)는
  clear 를 linear→sRGB 인코딩하므로 화면에 톤이 그대로 나오도록 linear(톤)을 넣는다(생명 비-sRGB
  캔버스는 톤 raw 사용). ③ fog 는 tile 월드에서만 켜짐 — 단일 데모(비-tile)는 기존 어두운 clear 불변.
  검증: `node test/world-water-shot.js` — ⓪ 수면 타일 재생성 diff 0(순수 Node) + ① 호수 파노라마
  (수면 메시 12·수면 픽셀 13k·하늘밴드 μ가 공용 sky 톤과 거리 0.5) + ② 생명 fog on/off(sky색 거리
  113<317, 근경 초록→원경 sky색 그라데이션) 사진. 회귀 없음(app-smoke/world-pan/scatter/render/ash/
  bubble). **앱 배선 완료**: 무대 탭 "오픈월드" 버튼(위 T4 참조)이 수면·sky/fog 를 함께 켠다. 남김:
  근접 저각에서 flat 수면/지형 surfel 이 뭉개짐(스타일 폴리시 — 조감 각을 가파르게 하면 완화) · 무대
  지형의 *점진적* fog(스플랫 착색)은 Spark 셰이더 미지원이라 clear-지평선 방식으로 대체.
- **T6 — 실측·예산**: 실 Marble/.rad + 청크 월드 fps·메모리 HUD (**S4 잔여 합류**). 완료 기준:
  데스크톱 60fps 수치 기록.

## W 트랙 — 이미지 컨셉 → 월드 (한 이미지에서 유사한 상호작용 월드)

상세 제안·설계 근거·리스크는 [PLAN-WorldFromImage.md](PLAN-WorldFromImage.md) 참조 (상태: **진행 중** — W1~W4·W6
완료(이미지→게놈→검증→걷는 월드→대기 루프 성립) + **W-Q 컨셉 퀄리티 격차 W-Q1~4 완료**(물 얼룩→호수·게놈
생명 층+Bake 식생·Bake 셰이딩·구름 vista — 아래 W-Q 절). 남은: W-Q2c(승격 훅) + W5 앱 tick 배선. 여기서 단계를
관리). C 트랙(이미지→
캐릭터 게놈) 방법론의 월드 판 — 컨셉 이미지 한 장을 월드 게놈(지형·바이옴·수역·대기·생명)으로 번역해 T
트랙 스트리밍 월드 위에 배양한다. 의존: W1 선행·독립, W2·W3 은 W1 뒤, W4 는 W2+W3, W5 는 T4, W6 은 T5.

- ✅ **W1 — 월드 게놈의 데이터화**: `terrain-gen.js` 의 하드코딩 `BIOMES`/`WATER_COL` 을 게놈 필드로
  승격 — `world(genome)` 이 `genome.biomeSet`/`water` 를 있으면 소비, 없으면 기본 프리셋. `WATER_ID` 는
  바이옴 수(`biomeSet.length`)로 유도해 바이옴 개수가 프리셋마다 달라도 성립(기본 4). `P.biomes`(불리언
  토글)와 충돌 없도록 배열은 `biomeSet` 신규 필드. `PRESETS`/`preset(name)`(깊은 복사) 신규 — `temperate`
  (현행 상수와 바이트 동일)·`ashen`(3바이옴·붉은 팔레트·물 없음). 검증: `node test/world-genome.js`(순수
  Node) — ① temperate 프리셋 경유가 현행 플랫 기본과 diff 0(회귀) + ② ashen 이 평균색거리 0.295·육상
  바이옴 완전 분리(다채로움). `node test/biome-shot.js`(회귀, 연속성 diff 0·렌더색족 4/4·exit 0) +
  `node test/preset-shot.js ashen`(용암능선 파노라마 사진). 남김: 대기·생명은 W6·W5, 스타일 프로파일
  검증기는 W2.
- ✅ **W2 — 월드 스타일 프로파일**: `js/world-profile.js`(`HktGenesisWorldProfile`) — 진폭·기복·바이옴
  수·ampMul·채도(상한만, 설선 저채도 허용)·수위(relief 포락 동적)·바이옴 중심 최소 거리 울타리 +
  `validate(genome)→{ok, violations}`. 벗어난 값은 클램프가 아니라 반려(이상치 재추출, C 트랙 원칙).
  존재하는 필드만 검사(생략=기본 프리셋 폴백=위반 아님). `preset-shot.js` 가 JSON 게놈을 렌더 전
  검증(판정에 프로파일 포함). 검증: `node test/world-profile.js`(순수 Node, 10/10) — ① temperate·
  ashen·최소 게놈·W4 v0 breeze-meadow 전부 통과 + ② 과진폭·바이옴 초과·과채도·퇴화 중복·수위 이탈·
  과ampMul 반려(위반 필드 확인).
- ✅ **W3 — 컨셉 검증 하니스**: `test/concept-shot.js` — 게놈 JSON + 원본 이미지 → 좌(컨셉)·우(생성 파노라마)
  2패널 대조 카드 PNG. 렌더 전 W2 검증 + 두 패널 내용 판정(빈 카드 방지). 검증: breeze-meadow ×
  IMG_5669 → 프로파일 OK·생성 지형 364k·원본 486k·오류 0·exit 0 (색족 일치 카드, 우상단 검정=미구현
  하늘 W6 노출).
- ✅ **W4 — 이미지 → 월드 게놈 추출기 v0**: `tools/world-extract/extract.js` — 이미지 → Anthropic vision
  (`claude-opus-4-8`) → 게놈 JSON. 스타일 프로파일(W2)을 프롬프트 제약으로 주고 반환 게놈을 `validate` 로
  검증해 벗어나면 위반을 되먹여 재시도(최대 3회, 클램프 아닌 반려). 라이브는 `ANTHROPIC_API_KEY` 필요,
  `HKT_EXTRACT_MOCK` 목 모드로 파이프라인 검증. 검증: `node test/world-extract.js`(순수 Node, 3/3) —
  프로파일 안 게놈 저장·_meta + 과진폭 게놈 반려·미저장. **수동 v0 실증**(키 없이도): LLM vision 이 컨셉
  이미지를 게놈(`genomes/breeze-meadow.json`, 3바이옴+청록 수역)으로 번역 → 후보정 1회 → 초록 초원+청록
  호수 렌더(색족·물 일치, `concept-shot` 대조 카드). **걷는 월드로도 실증**: `stage.js` `?tilesGenome=<url>` +
  `world-pan-shot.js [out] [seed] [genome.json]` — 추출 게놈이 T2 스트리밍(`world(genome)`)으로 흘러 걷는 월드
  (타일교체 45>25·스플랫 53k 상한·이음새 100%·exit 0). 남김: 라이브 vision 실측(키)·대기/스캐터는 W6·W5.
- **W5 — 생명/스캐터 연동** (**T4 완료로 선행 해소**): 게놈 생명 층 = 스폰 테이블(바이옴·경사·수위 조건).
  완료 기준: 이동 중 컨셉대로 개체 등장·소멸. T4 가 슬롯 증분 교체(`engine.respawnEntity`)와 결정론 스폰
  테이블(`js/scatter.js`)을 깔았으므로, W5 는 게놈이 스폰 규칙(종·밀도·바이옴 조건)을 정하도록 `scatter`
  후보 생성에 게놈 층을 물리면 된다 — 큰 엔진 확장이 아니라 게놈→스폰 규칙 매핑.
- ✅ **W6 — 대기·물 정합** (**T5 완료로 선행 해소**): 게놈 대기 층 `mood`(skyTop/skyHorizon + 선택
  fogColor/fogStart/fogEnd)를 데이터화. ① 무대 하늘 — `stage.js` 가 카메라를 따라오는 큰 구(BackSide)에
  skyTop(천정)→skyHorizon(지평선) **월드 y 방향** 세로 그라데이션을 굽는다(스크린 배경 텍스처의 aspect
  cover 왜곡 회피, 실제 지평선과 정합). 지평선 톤 = fog 톤이라 두 층이 지평선에서 이어진다. mood 에
  skyTop/skyHorizon 이 있을 때만 돔을 세운다 — 없으면(구 sky 필드/무-mood) 기존 flat clear 유지(T5 회귀
  안전). 셰이더 유니폼은 linear, `colorspace_fragment` 로 출력 sRGB 인코딩(clear srgbToLinear 관례와 동일).
  ② `setMood(mood)` 단일 진입 — `startTileWorld` 가 소비하고(걷는 게놈 월드 자동), concept/preset-shot 이
  단일 파노라마에도 배선. ③ `world-profile.js` 에 대기 밴드(하늘/fog 색 채도 상한·fog 거리 순서) + validate.
  ④ 프리셋 mood(temperate 파랑·ashen 붉음) + breeze-meadow.json mood + extract.js 스키마·프롬프트 동기.
  검증: `node test/concept-shot.js <genome> <img>` — 우패널 상단 하늘 검정비율 0%(=채워짐)·μ가 skyHorizon
  톤과 일치 + 대조 카드 사진. `node test/preset-shot.js ashen`(붉은 하늘 파노라마). 순수 Node: world-genome
  (mood 담김·깊은복사 독립·색족 대비)·world-profile(mood accept/reject) 회귀 없음. 브라우저 회귀 없음
  (world-water 하늘톤 0.5·world-pan·biome·openworld 21.1·stage·app-smoke).

### W-Q — 컨셉 퀄리티 격차 (사진 대비 진단)

**왜**: W1~W6 은 지형·바이옴·물·대기 **게놈 파이프라인**을 완성했지만, 컨셉 사진(원신/BotW 풍 vista)과
`test/concept-shot.js` 우패널을 나란히 놓으면 격차가 크다. concept-shot 은 그중에서도 **맨 지형 파노라마**
(`plyBytes` — 스캐터·수면 메시·구름 없음)만 굽는다. 원인을 영향 큰 순서로:
① **생명(나무·바위·건물) 부재** — 스캐터(W5/T4) 영역이라 지형 게놈에서 제외. 사진 풍부함의 절반. → W5.
② **물 얼룩(speckle)** — 수몰 판정이 고주파 `reliefAt` 을 그대로 써서 고립 pit 마다 파란 점이 흩뿌려지고,
   물 스플랫을 울퉁불퉁한 지형 높이에 두어 낱개로 보였다(+ breeze `waterY 0.06` 이 base 0.5 대비 너무 낮아
   물이 거의 안 참). → **W-Q1 에서 해결**.
③ **구름·태양 부재** — W6 은 skyTop→skyHorizon 그라데이션 돔만. 뭉게구름 미구현. → W-Q3.
④ **surfel 뭉개짐** — 평평한 가우시안을 스치는 저각에서 봐 흐릿(스플랫 근본 한계). 조감각·detail 로 완화. → R3/T5.

- ✅ **W-Q1 — 물 얼룩 → 연결 호수**: 수몰 판정(`terrain-gen.js isWater`)을 **저주파 macro 포락**
  (`macroReliefAt` — 옥타브 2·ridged 포함·파장 동일) 기준으로 바꿔 고립 고주파 웅덩이 speckle 을 없애고,
  bakers(`plyBytes`·`tilePly`·`waterTilePly`)가 물 셀을 **평평한 수면(y=waterY)** 으로 굽게 해 분지 바닥
  요철을 수면 아래로 잠근다 = 매끄러운 호수(물가 shallow→중앙 deep 색 심도는 실제 `reliefAt` 기준 유지).
  `reliefAt` 은 `reliefCore(oct, withRidged, scaleBoost)` 로 리팩터(거동 불변, macro 와 코어 공유).
  게놈 `breeze-meadow.waterY` 0.06→0.18(분지가 차게). **함정**: macro 에 ridged 를 빼면 능선 협곡에 고인 물
  (temperate 시드7 호수)이 사라진다(회귀) — ridged 포함·파장 동일이 필수(파장 늘리면 다른 노이즈장 봐 실
  분지 놓침). 검증: `concept-shot`(breeze) 흩뿌린 얼룩 → 청록 호수 · `world-water-shot` 수면 14250px(무회귀)
  · world-genome(temperate 바이트 동일)·biome·preset(ashen)·world-pan·app-smoke 회귀 없음.
- **W-Q2 — 식생 밀도 = Bake + 근처 승격** (= W5 + 정적 식생): 사진처럼 초원을 나무로 **채우려면** 시뮬
  개체(`MAX_ENTITIES=8`)로는 불가 — 8 상한은 "동시 **시뮬**되는 생명"의 한계이고(스플랫 풀 N 을 8 슬라이스로
  등분, `eid = i/sliceSize`), 이는 하드웨어 벽이 아니라 **개체당 스플랫 해상도 예산**이다(N 고정, 정렬
  O(N log²N)). **결정: 밀도는 상한을 올려서가 아니라 Bake 로 푼다.** 정적으로 구운 식생 스플랫은 우리
  시뮬 풀(8슬라이스·바이토닉)을 안 거치고 지형 PLY 에 실려 Spark(무대)가 그리므로 개수 제한이 사실상 없다.
  구조는 "**전부 Bake 로 세계를 채우고, 카메라 근처 몇 개만 8 슬롯으로 승격(promote)해 살아있게**":
  - ✅ **W-Q2a — 게놈 생명 층**: 스폰 규칙(종·바이옴별 밀도·크기·색)의 **단일 원본**. `scatter.js candidates`
    의 하드코딩 `BIOME_TREE` 표를 `genome.life` 가 대체(있으면 소비, 없으면 기본 = 무회귀). rock 종 추가(Bake
    전용 — `ScatterStream` 이 시뮬 승격에서 필터). `genesFor` 가 `life.treeSize` 소비. `world-profile.js` 생명
    밴드 검증 + `breeze-meadow.json` life 층. 검증: `world-life.js`(순수 Node 9/9 — 게놈 밀도→바이옴별 나무 수
    meadow 120≫highland 11, life 없음→rock 0 무회귀, 겹침 diff 0 연속성, 생명밴드 accept/reject).
  - ✅ **W-Q2b — Bake 식생 레이어(v0, 파노라마 + 타일 스트리밍)**: `js/vegetation.js`(`HktGenesisVegetation`) —
    `scatter.candidates`(게놈 생명 층 공유)로 나무(기둥+수관 램프)·바위(회색 타원) 정적 스플랫을 굽는다(좌표
    해시 결정론 = 스트리밍 연속성). `bakePanorama`(단일 창)·`bakeTile`(타일)·`mergePly`(지형+식생 한 PLY).
    ① 파노라마: `concept-shot` 이 지형 PLY 에 식생을 합쳐 로드 → **우패널 초원이 나무 893그루로 채워짐**(완료
    기준 충족). ② **걷는 월드**: `stage.js loadTile` 이 **근접 링(0)만** 식생 타일 메시를 붙인다(외곽 링은
    fog 로 소실 = LoD, 예산 절약) — `disposeTile`/`tileStats`(veg 카운트) 동기. 원경은 "생성된 씬"(무대 예외 —
    승인 하이브리드). 검증: `concept-shot`(breeze) 초원 채움 · `openworld-shot`(걷는 월드 나무 배치) · `world-pan`
    (default+breeze 게놈 걷는 월드 — 이음새 100%·스플랫 상한 무회귀) · `world-life.js`(순수 Node 9/9). 회귀:
    world-scatter·app-smoke·world-genome·world-profile 없음.
    남김: **v1**(시뮬 배양 나무 스냅샷 인스턴싱 — 원칙 정합) · 외곽 링 저밀도 식생(현재 미배치) · 자동차폐/조명
    (렌더 이슈, 보류) · 나무 외형(v0 절차 블롭 — 브로콜리감).
  - **W-Q2c — 승격 훅**: 근처 Bake 스폰을 8 슬롯 시뮬로 승격(불×나무 상호작용), 멀어지면 강등. `ScatterStream`
    확장. v0 는 하드컷(경계 팝 허용), 후속에 크로스페이드. **왜 이 구조**: 8 상한 = 상호작용 전용, 밀도 =
    Bake — Bake 하면 상태 유도(성장·연소·바람)가 얼어붙어 "죽으므로", 상호작용하는 것만 시뮬로 남긴다.
- ✅ **W-Q4 — 지형 Bake 셰이딩**: 스플랫은 런타임 조명이 없어(SH 0차 = 상수색) 절차 지형이 무광 평면으로
  보인다("점에 색만 찍은" 품질). 우리는 지형을 *생성*하므로 bake 시점에 명암을 색에 굽는다 — `terrain-gen.js`
  `shadeAt`(reliefAt 유한차분 법선 → diffuse(N·태양) + ambient 0.52, 태양·앰비언트는 `P.sun`/`mood.sun` 로
  덮음)를 `plyBytes`·`tilePly` 의 `f_dc` 에 곱한다. 수면은 균일(1 — 심도색 유지, 바닥 요철이 수면 명암으로
  새는 것 방지). 식생도 스폰 자리의 지면 명암을 곱해 통합(`vegetation.js splatsFor` — 그늘 슬로프 나무는
  어둡게 + 수관 위쪽 살짝 밝게). `colorAt`/`heightAt` 불변이라 world-genome(바이트 동일)·biome(색족 4/4)·
  world-life(9/9) 무회귀. 완료 기준: 우패널 지형에 능선 음영·입체감(무광 평면 탈피). 남김: **물 스페큘러/프레넬**
  (시점 의존 = SH0 원리상 불가 — 물을 생명 WebGPU 경로로 옮겨 FS 셰이딩이 정석) · 나무 자체 법선 음영 · 저각
  surfel 뭉개짐(스플랫 근본 한계, 조감각으로 완화 = W-Q3).
- ✅ **W-Q3 — 하늘 구름 + vista 카메라**: ① **구름** — `stage.js` 하늘 돔 셰이더(SKY_FRAG)에 fbm 절차 구름을
  더한다(시선을 하늘 평면에 투영 = 천정 뭉게·지평선 늘어남, 지평선 근처 소실로 fog 톤과 충돌 방지). `mood.cloud`
  (0..1 커버리지) opt-in — 없으면 cloudCov 0 = 구름 없음(temperate/ashen 프리셋 무회귀, world-water 하늘톤 0.5
  불변). `world-profile.js` 구름 밴드 검증 + `breeze-meadow.json` mood.cloud 0.55. ② **vista 카메라** — concept-shot
  시선을 지평선 위로(target y 0→38) 올려 상단에 하늘·구름 밴드가 드러나게(전엔 저각이라 프레임 top 이 지평선 밑 =
  구름 off-screen). 완료 기준 충족: 우패널이 구름 하늘 + 지평선 + 셰이딩 초원/호수/나무의 vista. 검증: `concept-shot`
  (breeze) 구름 vista 사진. 회귀: world-profile(14/14)·world-life(9/9)·world-water(하늘톤 0.5) 없음.
  남김: 구름 드리프트(정적 — 시간 유니폼)·중간 하늘 구름(현재 상단 밴드 위주)·저각 surfel 뭉개짐(스플랫 근본 한계).

> **다음 세션 진입점 (2026-07 기준)**: T1~T5·W6 완료(월드함수·청크·시뮬바닥·스캐터·물/fog·대기) + **W-Q 컨셉
> 퀄리티(W-Q1~4) 완료** — 컨셉 사진 대비 격차를 진단하고 대부분 메웠다. concept-shot 우패널이 "흩뿌린 물 얼룩의
> 벌거벗은 초원" → **구름 하늘 + 연결 호수 + Bake 식생으로 채워진 셰이딩 초원 vista** 로 왔다:
> ✅ W-Q1 물 얼룩→연결 호수(macro 포락+평평 수면) · ✅ W-Q2a/b 게놈 생명 층+Bake 식생(파노라마+걷는 타일 월드) ·
> ✅ W-Q4 지형/식생 Bake 셰이딩(무광 탈피) · ✅ W-Q3 fbm 구름+vista 카메라. **핵심 결정**: 밀도는 8-엔티티 상한을
> 올려서가 아니라 Bake(정적 무대 스플랫)로 풀고, 8 슬롯은 상호작용 생명 전용(DESIGN W-Q2 행).
> 남은 갈래:
> ① **W-Q2c (승격 훅)** — 근처 Bake 나무를 8 슬롯 시뮬로 승격(불×나무 상호작용), 멀어지면 강등. `ScatterStream`
>   확장. "밀도=Bake, 상호작용=시뮬" 구조의 마지막 조각. + **W5 앱 tick 스캐터 팔로 루프**(현재 openworld 버튼
>   경로만; 게놈 생명 스캐터를 앱 tick 에). 진입: `js/scatter.js`(ScatterStream)·`js/app.js` tick.
> ② **렌더 심화** — 나무 외형 v1(배양 나무 스냅샷 인스턴싱, 브로콜리감 해소) · 물 스페큘러/프레넬(시점 의존 →
>   물을 생명 WebGPU 경로로) · 구름 드리프트 · 저각 surfel 뭉개짐(근본 한계, 조감으로 완화).
> ③ **T6 (실측·예산)** — 실 Marble/.rad 대용량 월드 + fps·메모리 HUD (S4 잔여 합류). 실에셋 필요.
> 게놈 스키마 확장 시 `js/world-profile.js` 검증기·`test/world-genome.js`·`test/world-life.js` 회귀·
> `tools/world-extract/extract.js` 프롬프트 스키마를 함께 갱신할 것(mood·life 동기 유지).

## C 트랙 — 캐릭터 배양 (이미지 컨셉 → 게놈 → 살)

상세 제안·설계 근거·리스크는 [PLAN-CharacterGenesis.md](PLAN-CharacterGenesis.md) 참조 (상태: **진행 중** —
C1~C5(형태·채색·부속·추출기 v0) 완료, 다음은 C6 오버레이. 여기서 단계를 관리한다). 오픈월드 MMORPG 캐릭터를 이미지 몇 장에서 게놈(형태·채색·재질·부속
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
- ✅ **C4 — 부속 리그**: 부속 게놈 ④ — 가상 뼈 스프링 체인(꼬리/뿔/귀/망토). genome.js `chains()`
  (프로파일 울타리: 체인 ≤4·마디 1~8·길이/반지름/강성 범위, 감쇠 기본 임계 2√k) + `APPENDIX_PRESETS`,
  skeleton.js `AppendixRig`(강체 목표 스프링 추종 + 마디 길이 구속, CPU) — 실뼈 세그먼트 *뒤에* 고정
  순서 append 로 「세그먼트 순서 = 뼈 친화(rest.w) 인덱스」 규약 유지, 클립·FK 무수정. built-in 은
  절대 시간에서 dt 유도(시간 역행 = 재시드), FBX 는 증분 dt 그대로. `GROUP_IDS` 에 'appendix' 그룹
  ('other' 직전 삽입 — 'other'=마지막 규약 유지, engine `GROUP_COUNT` 11 동기), 에디터 부속 프리셋
  버튼(선택 시 세그먼트 수 변화 → 재시드). 검증: `node test/genome-append-shot.js` — ① 실뼈 세그
  bit-exact(클립 무수정) + ② walk 중 이탈각 요동·굽힘(지연 추종) + ③ 꼬리 위치에 초록 램프 살 성장
  사진. 남김: 망토(면형 부속)는 체인 1개로는 얇다 — 필요 시 평행 체인 묶음.
- ✅ **C5 — 이미지 → 게놈 추출기 v0**: `tools/genome-extract` — 컨셉 이미지를 게놈으로 *번역*
  (extract.js: LLM vision + 스타일 프로파일을 프롬프트 제약 + structured outputs 게놈 스키마,
  zero-dep Node fetch). 검증기(validate.js)가 울타리 밖 값을 클램프가 아니라 **반려**(exit 2,
  사유 목록은 재추출 프롬프트에 되먹임). `--mock` 으로 오프라인/CI 도 같은 검증·저장 경로.
  게놈 ③재질은 `genome.js applyMatter`(허용 유전자 부분집합만 차분 적용)로 소비, 에디터에
  게놈 JSON 내보내기/불러오기(후보정 그릇). 번역 태도는 프롬프트로 고정 — **과감한 비율**(±10%
  소극 번역 금지, 짧고 굵은 다리 = l 0.5~0.65 + r 1.3~1.6 급) + **옷 = 부위 그룹 램프의 색 구획**
  (상의→torso/shoulder, 하의→leg, 신발→foot; 맨살은 피부 램프). 검증:
  `node test/genome-extract-shot.js` — 옷 입은(조끼·반바지) 합성 컨셉 2장 → 추출(키 없으면 mock)
  → ① 반려 경로 ② 비율 번역(다리 길이·머리 반지름이 게놈 선언값과 CPU 정확 일치, 키 ×0.86)
  ③ 부속 세그 수 ④ 3클립 렌더 ⑤ 부위 색 구획(관절 투영 샘플의 중앙값 색상 = 게놈 램프 색상,
  조끼≠바지≠맨살 대비) 판정. 후보정 0 슬라이더로 3클립 통과(기준 ≤5). 남김: 옷 무늬·직물
  질감은 C6 결정화/R3 detail 소관(색 구획까지가 C5), 실이미지 대규모 검증·R2 Evaluator 연동은
  후속, 장기 거처는 HktGameplayGenerator 이관.
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
  +히키토 walk 합성 사진 + 판정. 남김(E2 후보): 장면 저장/불러오기(JSON),
  실행 취소(undo), 기즈모 회전/스케일.
- ✅ **E2 — 개체별 스켈레톤 (다중 히키토)**: 살(fleshK) 개체마다 제 emitter 위치에
  스켈레톤 인스턴스를 세운다 — 전에는 장면 공용 스켈레톤 1개라 2개 히키토가 한 덩어리로
  뭉쳤다(단일 boneBuf 공유). 인스턴스를 하나의 전역 뼈 테이블로 이어붙이고 개체별 `boneBase`
  로 뼈 친화(rest.w)를 제 구간의 절대 인덱스로 시드(셰이더 로직 무변, `MAX_BONES` 128→512).
  스켈레톤 정의(게놈·클립·통통함)는 여전히 공용 1벌 — "하나의 스켈레톤을 여러 캐릭터가 참조".
  검증: `node test/editor-multi-hikito-shot.js` — 히키토 2개 배치, 서로 다른 boneBase + 살 픽셀
  좌/우 분리(가운데 골짜기) 판정 사진.

## A 트랙 — 애니메이션 (입력 → 상태 → 클립, 단일 스켈레톤)

상세 설계·근거는 [PLAN-Animation.md](PLAN-Animation.md) 참조. L6 뼈대(세그먼트=살 입력) 위에 얹히는
순수 입력 계층 — 하나의 표준 스켈레톤을 입력으로 몬다. 새 모듈 `js/anim.js`(`HktGenesisAnim`),
skeleton.js·app.js·index.html·`test/_common.js` 배선. C·R 트랙과 독립.

- ✅ **A1 — 입력·상태·클립 3층**: ① `CharacterInput` — 입력 소스(키보드/에디터/AI/네트워크)를
  캐릭터에서 분리(연속 축 move + 1회성 트리거 jump/action). ② `CharacterStateMachine` — 선언적
  (직렬화 가능) 조건 DSL(`{axis,op,value}`/`{trigger}`/`{clipDone}`/`{after}`, 배열=AND·`any`=OR,
  함수 이스케이프)로 도는 상태 그래프 + 기본 휴머노이드 그래프(idle↔walk↔run + wave/jump 원샷).
  ③ `AnimationController` — 상태의 논리 클립을 built-in 절차 클립 / FBX 명명 클립으로 해석해 매
  프레임 세그먼트 산출. **FBX 설정**: `ExternalSkeleton` 다중 클립화(`clipNames`/`play(name,fade)`
  크로스페이드) + `useFbx` 가 상태를 클립 이름에 자동 배선(상태 이름 우선, 논리 클립명 폴백,
  Mixamo 접두어 흡수). built-in 절차 `jump` 원샷 추가(도약 포물선 + bell 무릎 당김) — FBX 없이도
  트리거 구동 실증. app.js: `입력 구동` 토글 + WASD 이동·Space 점프·Q 인사 키보드 주입 + 상태 HUD,
  소스 전환 시 뼈 친화 재시드. 검증: `node test/anim-shot.js` — ① 상태 전이(무입력→idle·이동→walk→run·
  정지→idle·wave/jump 트리거→원샷 후 clipDone 복귀) ② FBX 자동 배선(Mixamo 접두어 매핑) ③ 컨트롤러
  구동 세그먼트 위 살 배양 사진. 회귀: genome-shot(세그먼트 bit-exact 0)·app-smoke 무영향.
  한계: built-in↔FBX 소스 전환은 하드 컷(친화 재시드) — 같은 소스 안에서만 크로스페이드. 이동
  루트모션(발 미끄러짐)은 제자리 데모라 미대응(단일 스켈레톤 범위). 다개체 상태 머신은 C7 합류.
- ✅ **A1e — 에디터 개체별 애니 토글**: 살(fleshK) 개체 디테일 패널에 `입력 상태 머신 사용`
  체크박스 — 켠 개체만 제 컨트롤러(입력→상태→클립)로 독립 구동하고, 끈 개체는 장면 공용 클립
  (타임라인)을 따른다. 개체별 `이동 강도` 슬라이더(→moveMag)로 idle→walk→run 전이, 점프·인사
  버튼(트리거). 개체마다 제 Skeleton 인스턴스지만 정의(게놈·리그)는 공용이라 세그먼트 순서가
  같아 친화 호환(애니 개체는 제 컨트롤러 bind 로 시드 → 공용 클립이 external 이어도 정합).
  하니스 API `setObjectAnim`/`setObjectMove`/`triggerObject` + `debug().flesh[].anim`. 검증:
  `node test/editor-anim-shot.js` — 히키토 2개 중 우측만 애니 ON(이동 1.0→run)·좌측 공용 idle,
  ① 데이터(우 anim='run'·좌 anim=null·서로 다른 boneBase) ② 좌/우 분리 렌더 ③ 하체폭 run>idle
  (다리 스트라이드) 사진. 회귀: editor-shot·editor-multi-hikito 무영향(anim 필드 하위호환).

## R5 — 엔진 일반 큐 (L6 무관, 독립)

- ~~장면 편집기 (개체 추가/배치 UI)~~ → E1 에서 구현 · 슬라임의 포식(질량 이전)
- 진짜 curl noise (발산 무) · GPU radix sort 로 bitonic 대체
- L2 위치 더블 버퍼 · L3 본드 더블 버퍼 (지터/정합이 문제 될 때)

## 완료 이력

- ✅ L0~L5 (README 로드맵 참조)
- ✅ L6 뼈대 살: Skeleton IR + 살 문법 + 성장 자리 스프링 + 뼈대 오버레이 + Mixamo FBX 드롭 + 패널 탭 (PR #486)
