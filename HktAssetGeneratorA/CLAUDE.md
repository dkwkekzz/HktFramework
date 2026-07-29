# CLAUDE.md — HktAssetGeneratorA

이미지 감독 기반 **파라메트릭 3D 자산 생성** 웹 트랙 — 첫 도메인은 검(sword).
UE 빌드·타 플러그인과 무관(독립 웹 프로토타입). 이 문서는 **얇게** 유지한다 —
목표·지켜야 할 사항·작업 방식만. 현황·다음 작업은 [STATE.md](STATE.md),
설계 전체는 [Docs/](Docs/02-architecture.md).

## 목표

> **도메인 생성기가 메시와 의미 UV 를 동시에 만들고, 결정적 Material Compiler 가
> 물질·제작·손상 상태를 PBR 텍스처로 변환한다. AI 는 구조 선택과 제한된 장식 생성에만 쓴다.**

참조 검 이미지 1장 → 파라메트릭 검(칼날·가드·손잡이·폼멜) → 의미 UV → 절차 PBR →
GLB/KTX2. 성공 기준은 [Docs/00-original-design.md](Docs/00-original-design.md) §37.

## 지켜야 할 사항

### 절대 원칙 (원본 5원칙 + 결정성 계약)
1. **AI 는 정점·UV·완성 PBR 을 만들지 않는다** — 구조 판단과 흑백 장식 마스크만.
2. **자동 언랩 금지** — UV(Local/Atlas/Metric 3종)는 메시와 같은 파라미터 공간에서 동시 생성.
3. **외형 설계(DesignGraph)와 제작 이력(ProcessGraph/Operation)과 시각화(MaterialGraph)를 분리.**
4. **재현성**: 생성기 버전 + Spec + seed + Operation 로그 = 동일 메시·동일 텍스처.
5. **결정 경로(core/mesh/uv/material/bake/eval)에 GPU·Canvas 2D·`Math.random`·시간 API 금지** —
   메시 버퍼와 베이크 텍스처는 자체 CPU 코드로만. GPU(three.js)는 미리보기 전용.
   (근거·상세: [Docs/01-review.md](Docs/01-review.md) D-4·D-5, [Docs/02-architecture.md](Docs/02-architecture.md) §5)

### 불변 조건 (깨지면 빌드가 무너짐)
- UV overlap 0 · 비매니폴드 0 · degenerate 0 · padding ≥ 4텍셀 — 정의는 02-architecture §6
  이 유일한 기준(공유 엣지 인접은 overlap 이 아님, 개방 경계는 부품별 기대 개수와 일치).
- 가드 앞/뒷면/측면은 **별도 UV 아일랜드**(D-1). 칼끝·폼멜 폴은 **폴-팬 구조**(D-2).
- 하드 엣지(날·능선)는 **프로파일의 crease 플래그**로 스무딩 그룹 분리(D-6) — 각도 자동 검출 금지.
- 탄젠트는 Atlas UV 기준, Atlas 적용 후 재계산(D-9). GLB 내보내기 전 의미 속성 스트립.
- 단위 미터, +Y = 칼끝, CCW 감김. `uvMetric` 1단위 = 10cm(칼날·가드) / 5cm(손잡이·폼멜).
- 생성 알고리즘 변경 시 `generatorVersion` 을 올리고 golden 해시를 사유와 함께 갱신.

### 컨벤션
- Vite + three.js + vitest, ES 모듈, 무-프레임워크, 주석 한국어. `src/core`~`src/eval` 은
  DOM/three import 금지(순수 계산 — Node 테스트 대상).
- 튜닝 노브 하드코딩 금지 — 파라미터/슬라이더로 노출(UE CVar 관례의 웹 대응).
- 원본 설계([Docs/00-original-design.md](Docs/00-original-design.md))는 수정 금지.
  원본과 다르게 구현하는 모든 지점은 [Docs/01-review.md](Docs/01-review.md) 의 결정 번호(D-n)가
  근거여야 하고, 새 이탈이 필요하면 01-review 에 D-n 을 추가한 뒤 구현한다.

## 작업 방식
1. 세션 시작 시 [STATE.md](STATE.md) 로 현재 Phase·Step 확인 → 해당 Phase 문서
   (Docs/03~08)의 Step 사양대로 구현.
2. 한 번에 한 Step. 닫기 전 `npm run check`(vitest 전체 = 결정성·검증·golden 게이트) 통과
   + 시각 변경은 뷰어 캡처 확인. 완료 시 STATE.md 갱신.
3. Phase 문서와 02-architecture 가 어긋나면 02 가 우선 — 어긋남을 STATE.md 에 기록.
