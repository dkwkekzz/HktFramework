---
name: hgo-flux-step
description: HGO flux 트랙 step 한 바퀴(읽기→장면·측정→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 단일 국소 규칙은 step-0001 에 고정 — 한 step 은 법칙이 아니라 *창발 관찰*(장면+측정)을 더한다. 사용자가 "HGO flux step 진행/다음 flux step/flux step"을 요청하면 사용.
---

# HGO flux 트랙 step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HGO/CLAUDE.md`(목표)·`HGO/flux/SPINE.md`(단일 규칙 설계도·척도 분리·검증 4기둥·한 step 이 더하는 것 §5)·`HGO/flux/STATE.md`(현재·다음)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. **작업 디렉토리: `HGO/flux/`** — 이하 모든 상대 경로(`engine/`·`steps/`·`STATE.md`)는 이 트랙 폴더 기준. 뷰어는 트랙 밖 공유 `../viewer.html?track=flux`. 기질: **JS 결정론 샌드박스**(공유 뷰어 + 헤드리스 verify).

> **flux 의 결정적 차이(atom 과)**: 단일 규칙은 step-0001 에 *고정*이다. 한 step 은 *법칙을 추가하지 않는다* — **장면 1항 + 창발 측정 1개**만 더한다(SPINE §5). atom-step 의 "법칙 1개/step" 을 여기 가져오지 마라.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HGO/CLAUDE.md` · `HGO/flux/SPINE.md` · `HGO/flux/STATE.md` (전체).

**읽기 금지**(STATE 가 명시 지시할 때만 예외): 옛 `steps/step-NNNN.md` 문서들(STATE 가 현재의 SSOT) · atom/render/net 트랙 파일(`../atom/*`·`../render/*` — 직교 트랙·불가침) · `reviews/*`(리뷰 회고).

**큰 코드 파일은 부분 읽기만**: `engine/flux-*.js`·`engine/scenes.js` 전체 읽기 금지 — Grep 으로 `SCENES`·직전 장면 1개·규칙 함수만 찾아 offset/limit 로 해당 구간만. 새 장면은 직전 장면의 형식을 따른다. **규칙 함수(`flux-laws.js`)는 읽되 *고치지 마라*** — 정련은 §3 예외에서만.

## 2. 더할 것은 둘뿐 — 복사·누적 폐기 (이 트랙의 핵심 원칙)

뷰어·검증기·골든은 **공용 1벌**이고 step 마다 복제하지 않는다. 한 step 이 더하는 것은 *append-only* 둘뿐(SPINE §5):

1. **장면(scene)** — `engine/scenes.js` 에 이 step 의 장면 기술자 한 항(~10줄): `{ id:'step-NNNN', title, did(한 일 1줄), observe(관찰 1줄), desc(전문 기록), init(초기 q 배치), knobs(κ·θ·α 강조), watch(창발 지표), assert(가설 수치) }`. *어떤 척도/초기조건이 어떤 층을 드러내는가*의 한 실험. **이 한 항이 검증·골든 해시·시각화 셋 모두의 단일 출처다**(DRY).
   - **직관 설명 필수(`did`·`observe`)**: 뷰어가 `did`("한 일": 이 step 에서 무엇을 했나) 와 `observe`("관찰": 화면에서·watch 지표에서 무엇을 볼 수 있나) 를 라벨 붙여 *맨 위*에 보여준다 — 비전문가도 한눈에 따라오게 쉬운 한국어 1~2줄, 내부 약어(arc·§·ΣP 등) 지양. 기존 전문 `desc` 는 그대로 두되 뷰어의 "자세히" 토글 안으로 접힌다(전문성·친절함 둘 다 보존). 두 필드는 텍스트일 뿐 골든 해시·결정론에 무관(자유 편집·회귀 0).
2. **창발 측정(measure)** — 그 층을 *읽는* 지표(히스토그램·도메인 수·사태 크기 분포·기울기장·상관 길이). `engine/` 의 측정 유틸에 더하거나 장면 watch/assert 안에. **author 한 라벨이 아니라 측정**(SPINE §4·§9).

그 외 산출물은 `steps/step-NNNN.md`(마크다운 기록) 하나뿐. **복사되는 html·panel·verify 는 0개.**

> **부트스트랩(step-0001, 한 번만)**: 공용 하네스가 아직 없다. step-0001 이 *한 번* 만든다: `engine/flux-kernel.js`(이웃·유틸) · `engine/flux-laws.js`(**단일 규칙 1개** — SPINE §3 그대로) · `engine/flux-sim.js`(셀 상태+tick+RENDER.md §2 계약 스냅샷) · `engine/scenes.js`(레지스트리) · `engine/verify.js`(공용 헤드리스 검증) · `engine/validate/*`(골든) · `../viewer.html` 트랙 매니페스트에 `flux` 줄(이미 스캐폴드서 추가됨 — 엔진 파일만 채우면 굴러감). 엔진은 atom 과 동일하게 `HGO.kernel/laws/sim/scenes` 전역에 등록(뷰어 트랙 무관).

## 3. 구현 — 장면 1항 + 측정 1개 (법칙 *아님*)

`engine/scenes.js` 에 Edit 로 장면 한 항을 추가하고, 필요한 창발 측정 1개를 더한다. 노브는 규칙의 4 자유도(`κ·θ·α`·이웃 위상)만 — *새 노브를 남발하지 마라*(SPINE §3). 보존 장부/golden 확장은 *미존재 시 no-op* 가법만.

> **규칙 정련 예외(드물고 무거움)**: §검증 4기둥의 *창발 측정*이 "현 규칙으론 이 층이 원리적으로 불가능"을 **수치로 증명**할 때만 `flux-laws.js` 규칙 함수를 최소 정련(노브 추가가 아니라 함수 형태). 정련 시 **모든 과거 장면의 골든 해시 비트 재현**(회귀 0)을 풀 골든 런으로 확인. 규칙 수정은 STATE §2 에 가설로 먼저 올리고 별도 step 으로.

## 4. 검증 — 공용 헤드리스 + 공유 뷰어

- `node engine/verify.js step-NNNN` — 공용 검증기가 그 장면으로 **4기둥**(회귀 0·닫힌 장부 Σq·결정론·창발 측정 author 0) + 장면의 **가설 assert** 를 수치 출력. 문서의 모든 수치는 이 출력 그대로. *per-step verify.js 복사 없음.*
- `node engine/validate/...`(풀 골든 런)는 오래 걸린다 — `run_in_background` 로 돌려놓고 그동안 step 문서·장면을 진행. 닫기 직전 1회 최종 PASS 확인.
- **시각화**: 공유 `../viewer.html?track=flux` 를 열고 step 선택 → 그 장면이 결정론적으로 돌며 "여기서 무슨 층이 창발했는지"를 보여줌(결정론 + 동결 장면이라 옛 step 도 비트까지 재현). step 문서는 `../viewer.html?track=flux#step-NNNN` 로 링크만 단다.

## 5. 갱신 — STATE.md 는 Edit 로만

- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 20KB · §1 NOW 항목당 ≤ 6줄(상세는 step 문서로) · §7 은 literal 1줄.
- `step-NNNN.md` 예산 ≤ 14KB — 발견/한계 전문은 여기(STATE 아님). **"쉽게 풀어 쓴 설명" 절 필수**(비전문가도 따라올 수 있게·수치는 말로). `../viewer.html?track=flux#step-NNNN` 링크 포함.
- **장면 `did`·`observe` 채우기 필수**(§2.1): step 을 닫기 전 `scenes.js` 의 이 step 항에 "한 일"(`did`)·"관찰"(`observe`) 두 줄을 적는다 — step 문서의 "쉽게 풀어 쓴 설명"을 1~2줄로 압축한 것. 뷰어를 연 사람이 코드·문서 없이 화면만 보고 "뭘 했고 뭘 보면 되는지" 알 수 있어야 한다.

## 6. 닫기 체크리스트

1. 검증 4기둥(SPINE §9) 전부 통과 (`engine/verify.js step-NNNN` 출력 인용)
2. 풀 골든 런 PASS (회귀 0 알리바이 — 규칙 고정이므로 과거 장면 비트 불변)
3. `step-NNNN.md` "쉽게 풀어 쓴 설명" 절 + 뷰어 링크 포함·수치=verify 출력 · **장면 `did`·`observe` 두 줄 채움**(뷰어 직관 설명, §2.1)
4. STATE.md §1~5 Edit + §7 1줄 append
5. 닫은 step 파일은 이후 불변 (장면은 `scenes.js` 에 동결로 남아 뷰어가 영구 재현)

## 7. 창발 가설 점검 (SPINE §4 증명 추적)

step 을 닫을 때, 이번 장면이 SPINE §4 "단일 규칙 + 척도 분리 → 창발 층" 가설을 *얼마나 밀었는지* STATE §2 NEXT 또는 §3 OPEN GAPS 에 한 줄로 남긴다 — 어떤 층(동결·임계·확산·구조)이 *측정으로* 드러났나, 무엇이 아직 안 나왔나. 이 추적이 arc(SPINE §8) 우선순위를 정한다. *주의*: "이건 고체처럼 보인다" 같은 *라벨 author* 금지 — 층은 측정 지표(멱법칙 지수·도메인 수·상관 길이)가 정한다.

## 금지 사항 (비용·정합 함정)

- **법칙을 추가하지 않는다** — 규칙은 step-0001 고정. step 은 장면 1항 + 측정 1개만(SPINE §5). 규칙 정련은 §3 예외(측정이 강제할 때·회귀 0 의무)만.
- **노브를 남발하지 않는다** — 규칙의 4 자유도(κ·θ·α·이웃)가 전부. atom 의 ~120 노브 전철 금지.
- **종류 라벨을 author 하지 않는다** — 층은 측정으로(`if(고체)` 류 금지).
- step 마다 panel·html·verify 를 복사하지 않는다 — 공용 1벌, step 은 장면 한 항만.
- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT.
- atom/render/net 트랙 파일을 만지지 않는다(직교·불가침). 렌더러는 *읽기 계약*(RENDER.md §2)만 맞추면 불변 재사용.
- verify 풀 런을 포그라운드로 기다리며 놀지 않는다.
- 한 step 에 두 조각 이상 넣지 않는다 — 나머지는 다음 step 으로 전가.
