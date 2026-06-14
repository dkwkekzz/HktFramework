---
name: hgo-atom-step
description: HGO 원자 트랙 step 한 바퀴(읽기→법칙·장면→검증→갱신→닫기)를 토큰·시간 효율적으로 실행한다. 사용자가 "HGO step 진행/다음 step/원자 step"을 요청하면 사용.
---

# HGO 원자 트랙 step 루프 — 토큰 효율 실행 절차

규칙의 권위는 `HGO/CLAUDE.md`(목표)·`HGO/SPINE.md`(척추·검증 4기둥·척추 체크 4항·단일 뷰어 원칙 §6.1)·`HGO/STATE.md`(현재·다음)다. 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HGO/`. 기질: **JS 결정론 샌드박스**(단일 `viewer.html` + 헤드리스 verify) — UE5/MMO 통합은 net 트랙(휴면) 몫.

## 1. 읽기 — 허용 목록만 (그 외 읽지 마라)

**필독 3종**: `HGO/CLAUDE.md` · `HGO/SPINE.md` · `HGO/STATE.md` (전체).

**읽기 금지**(STATE 가 명시 지시할 때만 예외): 옛 `steps/step-NNNN.md` 문서들(STATE 가 현재의 SSOT) · render/net 트랙 파일(`RENDER*`·`NET*` — 직교 트랙).

**큰 코드 파일은 부분 읽기만**: `engine/hgo-*.js`·`engine/scenes.js` 전체 읽기 금지 — Grep 으로 `LAW_ORDER`·`DEFAULTS`·직전 법칙/장면 1개만 찾아 offset/limit 로 해당 구간만. 새 항은 직전 항의 형식을 따른다.

## 2. 더할 것은 둘뿐 — 복사·누적 폐기 (이 트랙의 핵심 원칙)

**옛 방식(HWS)처럼 step 마다 `panel.js`·`html`·`verify.js` 를 복사해 쌓지 않는다.** 뷰어·검증기·골든은 **공용 1벌**이고 step 마다 복제하지 않는다. 한 step 이 더하는 것은 *append-only* 둘뿐:

1. **법칙** — `engine/hgo-laws.js` 에 법칙 1개 + 노브 + `LAW_ORDER` 한 자리(§3).
2. **장면(scene)** — `engine/scenes.js` 에 이 step 의 장면 기술자 한 항(~10줄): `{ id:'step-NNNN', init(초기 원자 배치), knobs(강조 노브), watch(관찰 지표), assert(가설 수치) }`. **이 한 항이 검증·골든 해시·시각화 셋 모두의 단일 출처다**(DRY).

그 외 산출물은 `steps/step-NNNN.md`(마크다운 기록) 하나뿐. **복사되는 html·panel·verify 는 0개.**

> **부트스트랩(원자 기반 구축 — step-0001 전후)**: 공용 하네스가 아직 없다. 기반 step 들이 *한 번* 만든다: `engine/`(hgo-kernel·hgo-laws·hgo-sim) · `engine/scenes.js`(장면 레지스트리) · `engine/verify.js`(공용 헤드리스 검증, 장면 id 인자) · `viewer.html`(단일 뷰어 — step 선택기·노브 자동 생성) · `engine/validate/*`(골든 해시). 이후 step 은 이 하네스를 *건드리지 않고* 위 두 항만 더한다.

## 3. 구현 — 법칙 1개 + 노브 + 순서 + 장면 1항

`engine/hgo-laws.js` 에 Edit 로 **상호작용 법칙 1개 + 노브 1개 + 실행 순서 한 자리**(노브=0 → early-return = 회귀 0). 이어 `engine/scenes.js` 에 이 법칙을 *보여주는* 장면 한 항을 Edit 로 추가. 보존 장부/golden 확장은 *미존재 시 no-op* 가법만. 원소·분자는 author 분기 아닌 *측정*으로(척추 체크 4항).

## 4. 검증 — 공용 헤드리스 + 단일 뷰어

- `node engine/verify.js step-NNNN` — 공용 검증기가 그 장면으로 **4기둥**(회귀 0·닫힌 장부 Q·B·L·E·결정론) + 장면의 **가설 assert** 를 수치 출력. 문서의 모든 수치는 이 출력 그대로. *per-step verify.js 복사 없음.*
- `node engine/validate/verify-sim-engine.js`(풀 골든 런)는 오래 걸린다 — `run_in_background` 로 돌려놓고 그동안 step 문서·장면을 진행. 법칙 고칠 때마다 포그라운드 대기 금지. 닫기 직전 1회 최종 PASS 확인.
- **시각화**: `viewer.html` 를 열고 step 선택 → 그 장면이 결정론적으로 돌며 "여기서 뭘 했는지"를 보여줌(결정론 + 동결 장면이라 옛 step 도 비트까지 재현). step 문서는 `viewer.html#step-NNNN` 로 링크만 단다.

## 5. 갱신 — STATE.md 는 Edit 로만

- **STATE.md 전체 Write 금지** — 바뀐 절(§1 NOW·§2 NEXT·§3·§4 추가분·§5·§7 append)만 개별 Edit.
- 크기 예산: STATE ≤ 30KB · §1 NOW 항목당 ≤ 6줄(상세는 step 문서로) · §7 은 literal 1줄. 초과 시 SPINE §6 "누적 함정"부터 정리.
- `step-NNNN.md` 예산 ≤ 14KB — 발견/한계 전문은 여기(STATE 아님). **"쉽게 풀어 쓴 설명" 절 필수**(비전문가도 따라올 수 있게·수치는 말로). `viewer.html#step-NNNN` 링크 포함.

## 6. 닫기 체크리스트

1. 검증 4기둥(SPINE §9) + 척추 체크 4항(SPINE §5) 전부 통과 (`engine/verify.js step-NNNN` 출력 인용)
2. 풀 골든 런 PASS (회귀 0 알리바이 — 0002~)
3. `step-NNNN.md` "쉽게 풀어 쓴 설명" 절 + 뷰어 링크 포함·수치=verify 출력
4. STATE.md §1~6 Edit + §7 1줄 append
5. 닫은 step 파일은 이후 불변 (장면은 `scenes.js` 에 동결로 남아 뷰어가 영구 재현)

## 7. 활성 게이트 점검 (휴면 트랙 깨우기)

step 을 닫을 때, SPINE §7 활성 게이트가 충족됐는지 본다: **방출(요건3)이 실리면** render 트랙을, **결정론·보존이 안정되고 공유 상태가 풍부해지면** net 트랙을 깨울 때다. 깨움은 *별도 세션*이 그 트랙 SKILL+STATE 를 만들며 시작한다 — 이 atom 트랙에선 STATE §2 에 "render 활성 게이트 도달" 한 줄만 남기고 전가한다.

## 금지 사항 (비용 함정)

- **step 마다 panel·html·verify 를 복사하지 않는다** — 공용 1벌(viewer.html·verify.js)이고 step 은 장면 한 항만 더한다.
- 옛 step 문서·아카이브를 "참고로" 읽지 않는다 — STATE 가 현재의 SSOT.
- 같은 파일을 반복해서 통째로 다시 읽지 않는다(이미 컨텍스트에 있다).
- verify 풀 런을 포그라운드로 기다리며 놀지 않는다.
- 한 step 에 두 조각 이상 넣지 않는다 — 나머지는 다음 step 으로 전가.
- render/net 트랙 파일을 만지지 않는다(직교·휴면 — 시뮬 불가침).
