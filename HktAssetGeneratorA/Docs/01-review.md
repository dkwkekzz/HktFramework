# 01 — 원본 설계 검토 (2026-07-29)

[00-original-design.md](00-original-design.md) 에 대한 기술 검토.
여기서 확정된 결정(D-1 ~ D-12)이 [02-architecture.md](02-architecture.md) 이후 모든 문서의 근거다.
**후속 세션은 이 문서의 결정 번호(D-n)를 기준으로 원본과 수정판의 차이를 추적한다.**

## 총평

핵심 베팅 — "범용 이미지→3D를 포기하고, 도메인 생성기가 메시와 의미 UV를 동시에 만들며,
PBR 은 결정적 합성으로 만든다" — 는 건전하다. 사실상 Houdini 절차 생성 + Substance 스타일
합성을 웹으로 옮긴 검증된 패턴이며, 실패 확률이 높은 부분(자동 언랩·멀티뷰 일관성·PBR 역추정)을
전부 스코프 밖으로 밀어낸 것이 최대 강점이다.

- **Phase 1~4 는 순수 공학** — 리스크 거의 없음. 이 리포의 기존 웹 트랙(HktCreature 등)과
  같은 규모로 브라우저만으로 완성 가능.
- **유일한 연구성 리스크는 Phase 5**(참조 이미지 형상 최적화) — 병목은 최적화 알고리즘이
  아니라 분할·랜드마크·카메라 추정의 입력 품질. 수동 어노테이션 경로를 정식화하면 해소.
- 단, 원본에는 **자기 자신의 validator 에 걸려 빌드가 항상 실패하는 내부 모순**이 있어
  그대로 구현하면 안 된다. 아래 결정으로 수정한다.

## 결정 목록 (수정판에 반영됨)

### D-1. 가드 앞/뒷면 UV 분리 (치명 — 원본 §9 vs §13 모순)

원본 §9 는 "뒷면: 동일한 2D 윤곽 좌표"인데 §13 `assertValidUV` 는 overlap > 0 이면 throw.
앞/뒷면이 같은 Atlas 좌표를 쓰면 정의상 100% overlap → 가드는 항상 빌드 실패.
겹침을 허용하면 Engrave 문양이 양면에 동시에 찍히고 AO 도 오염된다.

**결정**: 가드 Atlas 영역을 앞면/뒷면/측면 3개 서브영역으로 분할한다. 겹침 예외를 만들지
않는다 — "overlap 0" 은 무조건 조건으로 유지. 상세: [04-phase2](04-phase2-parts-assembly.md) §3.

### D-2. 칼끝(tip)·폼멜 폴은 명시적 폴-팬 구조 (치명 — 원본 §7 vs §13 모순)

`tipScale → 0` 이면 마지막 링 정점들이 한 점으로 모여 3D degenerate 삼각형이 생기고,
`countDegenerateUVTriangles > 0 → throw` 와 충돌. `closeBladeRoot/Tip` 캡의 UV 도
Local UV `[t,s]` 체계 밖이라 미정의였다.

**결정**: 칼끝은 마지막 링을 스케일 축소하는 방식이 아니라 **폴 정점 1개 + 팬 삼각형**으로
명시적으로 닫는다. 폴 정점은 UV 상에서 마지막 링의 각 s 구간 중점마다 복제한다(원뿔 언랩과
동일 — 폴 정점이 UV 에서 퍼짐). 뿌리 캡은 탱 소켓에 가려지므로 캡 대신 소형 원판 팬 + Atlas
전용 소영역. degenerate 판정 기준을 명문화한다(3D 와 UV 를 각각, epsilon 포함 —
[02-architecture](02-architecture.md) §6). 상세: [03-phase1](03-phase1-blade.md) §5.

### D-3. UV overlap 검사의 정의 명문화

인접 삼각형은 공유 엣지에서 항상 "겹침"으로 검출된다. 정의 없이는 overlap 0 이 달성 불가능한
기준이 된다.

**결정**: overlap = "정점/엣지를 공유하지 않는 두 삼각형의 내부 교차 면적 > epsilon".
정의·epsilon·알고리즘은 [02-architecture](02-architecture.md) §6 에 고정.

### D-4. 베이크는 CPU 결정적 래스터라이저 (아키텍처 — 원본 §3 vs §18-19 모순 해소)

원본은 pipeline-server(Node.js)에 `THREE.WebGLRenderer` + WebGL2 베이커를 둔다.
Node 에는 WebGL2 구현이 사실상 없다(headless-gl 은 WebGL1, 유지보수 저조).
또 GPU 래스터라이즈는 드라이버·하드웨어별로 비트 단위 동일성이 없어 §31.5 의
"동일 seed = 동일 텍스처 해시" 테스트가 크로스 머신에서 깨진다.

**결정**: 텍스처 베이크는 **자체 CPU 래스터라이저**로 구현한다. UV 공간 베이크는 2D 삼각형
래스터라이즈 + 프래그먼트 함수 평가일 뿐이라 GPU 없이 어렵지 않고, 결정성이 공짜로 확보되며,
브라우저(Web Worker)와 Node(테스트/CI) 양쪽에서 동일 코드가 돈다. 1024² × 5채널 CPU 베이크는
Worker 에서 수 초 수준. GPU 는 **미리보기 렌더에만** 사용(결정성 요구 없음).
원본의 GLSL 셰이더(§18)는 TS 프래그먼트 함수의 사양서로 계승한다.
상세: [05-phase3](05-phase3-material-bake.md).

### D-5. 긁힘은 Canvas 2D 스트로크가 아니라 캡슐 SDF 스탬핑 (결정성)

`OffscreenCanvas` stroke 의 안티앨리어싱은 브라우저/플랫폼별로 달라 seed 가 같아도 픽셀
해시가 어긋난다.

**결정**: 긁힘·마모 스탬프는 자체 캡슐 SDF(선분까지의 거리 함수) 평가로 높이 필드에 직접
기록한다. 상세: [06-phase4](06-phase4-surface-state.md) §3.

### D-6. 하드 엣지 노멀 분리 (품질 — 원본 누락)

`recalculateNormals()` 가 링 정점을 평균 스무딩하면 diamond 단면의 날(edge)과 능선(ridge)이
뭉개져 검이 튜브처럼 렌더된다. seam 정점을 UV 때문에 복제한 것과 같은 이유로 노멀도 분리해야
한다.

**결정**: `ProfilePoint` 에 `crease: boolean` 을 추가하고, crease 포인트에서 정점을 복제해
스무딩 그룹을 나눈다(각도 임계 자동 검출이 아니라 **프로파일이 명시** — 의미 UV 철학과 동일).
상세: [03-phase1](03-phase1-blade.md) §3.

### D-7. AO = cavity/contact 근사로 명시 (정직한 스코프)

UV 공간 프래그먼트 평가로는 부품 간 차폐(가드가 칼날 뿌리를 가리는 것)를 계산할 수 없다 —
3D 레이캐스트가 필요하다.

**결정**: MVP 의 AO 채널 = `cavity` + `fullerWeight` + 부품 접합부 `contactWeight` 기반
해석적 근사. 진짜 레이캐스트 AO 는 Phase 7 의 선택 항목. 상세: [05-phase3](05-phase3-material-bake.md) §6.

### D-8. Atlas 텍셀 밀도 종횡비 보정

칼날은 길이 ~1m : 둘레 ~10cm 의 극단적 종횡비인데 `[1.0 × 0.5]` 영역에 그대로 넣으면 방향별
텍셀 밀도가 5~10배 차이 나 자체 `texelDensityDeviation` 검사에 걸린다.

**결정**: 부품별 Atlas 영역은 유지하되, Local→Atlas 매핑에서 **부품의 실측 표면 종횡비**로
영역 내 배치를 보정한다(칼날은 가로로 눕힌 긴 스트립). 밀도 편차 지표는 방향별로 정의.
상세: [04-phase2](04-phase2-parts-assembly.md) §4.

### D-9. 탄젠트 기준 UV = Atlas UV, GLB 커스텀 속성 스트립

UV 가 3종이라 탄젠트 기준이 미정의였다. 런타임 노멀맵은 Atlas UV 로 샘플링되므로 탄젠트도
Atlas UV 기준으로 계산한다(MikkTSpace 방식 근사). `partId`·`edgeWeight` 등 의미 속성은 베이크
후에는 불필요하므로 GLB 내보내기 전에 스트립한다(GLTFExporter 가 `_PARTID` 등 비표준 속성으로
내보내 파일만 커짐).

### D-10. Metric UV seam 완화

`valueNoise(uvMetric)` 은 둘레 seam 에서 불연속. 원본의 "seam 을 덜 보이는 위치에 고정"을
1차 완화로 쓰되, 둘레 방향 노이즈는 주기 함수 버전(둘레 길이로 mod)을 제공한다.
상세: [05-phase3](05-phase3-material-bake.md) §4.

### D-11. Phase 5 는 수동 어노테이션을 정식 MVP 경로로

IoU 0.9 의 병목은 최적화가 아니라 분할·랜드마크·카메라 추정의 입력 품질이다. 원본에 이미
`manuallyConfirmed` 가 있다.

**결정**: Phase 5 MVP = 사용자가 웹 UI 에서 실루엣 마스크·칼날 양 끝점·부품 경계를 직접
찍는다(수 분 작업). AI 자동 추정은 Phase 6 으로 이동. 실루엣 비교는 텍스처가 필요 없으므로
CPU 에서 삼각형을 2D 직교 투영해 마스크를 만든다 — 렌더러 불필요, 서버 불필요, 결정적.
최적화는 랜덤 탐색 대신 Nelder-Mead(+ 재시작). 상세: [07-phase5](07-phase5-reference-fit.md).

### D-12. 구조 축소 — 모노레포가 아니라 리포 관례의 단일 트랙 폴더

원본 §4 의 apps 2개 + packages 7개 + Python 워커는 코드가 없는 시점의 조기 추상화다.
Phase 1~4 는 서버조차 필요 없다 — 전부 브라우저에서 돌고, 저장은 다운로드/localStorage 로 충분.

**결정**: 이 리포의 웹 트랙 관례(HktCreature 등)를 따라 **단일 폴더 + Vite + three.js +
무-프레임워크(ES 모듈) + vitest** 로 시작한다. `src/` 하위 디렉터리가 원본 packages 의 논리
경계를 대신한다(경계는 유지, 패키지화는 유예). 서버·AI 워커 도입 기준은
[08-phase6-plus](08-phase6-plus.md) 에 명시. React/Zustand 도 MVP 에서 제외 — 패널 UI 는
기존 트랙처럼 순수 DOM + 슬라이더로 충분하다.

## 결정성의 잔여 조건 (테스트 전제)

- JS Float64 연산(IEEE 754)은 엔진 내 결정적. 단 `Math.cos` 등 초월함수는 엔진 구현 의존 —
  실무상 같은 V8 메이저 버전이면 안정. **golden 해시 테스트는 package.json `engines` 로 Node
  버전을 고정하고 CI 와 로컬이 같은 버전을 쓴다는 전제를 명시**한다.
- 브라우저 실행 결과와 Node 실행 결과의 해시 일치는 **보장 목표가 아니다**(둘 다 V8 이라
  실제로는 일치할 가능성이 높지만, 보장은 Node 경로만). golden 기준은 Node(vitest) 실행.
- 해시 대상은 자체 결정 코드 경로의 산출물만: 메시 버퍼, CPU 베이크 텍스처. GPU 미리보기
  렌더는 해시하지 않는다.

## 원본에서 그대로 계승하는 것

5원칙 전부, MVP 범위(§2), 도메인 모델(§5 — 단 `GeneratedMesh` 는 crease/캡 반영 확장),
3종 UV 체계(§6), 링 스윕/Extrude/Lathe 생성법(§7~10), 소켓 조립(§11), 고정 Atlas 철학(§12),
MaterialGraph·Primitive·Operation(§14~17), 셰이딩 수식(§18 — TS 로 이식),
Normal 높이필드 변환(§20), AI 문양 검증 파이프라인(§22), 이중 평가(§23), 테스트 전략(§31),
로드맵 골격(§32), 생물 확장 원칙(§33), 해결하는 것/않는 것(§34~35).
