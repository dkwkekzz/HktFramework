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

- **T1 — 월드 함수**: terrain-gen 을 무한 도메인 `world(x,z)`(바이옴 2채널 + domain warp + ridged
  + waterY)로 확장. 완료 기준: 원점 다른 두 패치의 겹침 영역 수치 일치 + 4바이옴 파노라마 샷.
- **T2 — 청크 무대 스트리밍**: 타일 PLY 즉석 생성 → SplatMesh 링 로드/언로드(근접 풀 밀도·외곽
  저밀도). 완료 기준: 직진 이동 중 타일 교체 + 스플랫 총량 상한 유지 + 이음새 없음(사진).
- **T3 — 시뮬 바닥 가상화**: height 직접 베이크(triSoup 경유 제거) + collider XZ 버킷 인덱스
  + 버블 y 지형 추종. 완료 기준: 원점 50u 밖에서 침투 0% + L2 생존 + 전 프리셋 회귀 없음.
- **T4 — 스캐터·개체 스트리밍**: 청크 시드 결정론 스폰 테이블 + 엔진 슬롯 증분 교체(거리순 활성).
  완료 기준: 이동 중 능선마다 나무 등장·소멸, 불×나무가 임의 좌표에서 성립.
- **T5 — 물 + 원거리 폴리시**: 수면 타일 + 무대·생명 공용 fog (**S3 잔여 합류**). 완료 기준:
  호수 파노라마 — 수면·안개 톤 양층 일치.
- **T6 — 실측·예산**: 실 Marble/.rad + 청크 월드 fps·메모리 HUD (**S4 잔여 합류**). 완료 기준:
  데스크톱 60fps 수치 기록.

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
