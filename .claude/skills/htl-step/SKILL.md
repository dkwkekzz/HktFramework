---
name: htl-step
description: HTL step 한 바퀴(논의→구현→검증→기록)를 토큰·시간 효율적으로 실행한다. 정해진 규칙으로 스스로 굴러가는 세계를 step 단위로 점진 구축한다. 사용자가 "HTL step 진행/다음 step"을 요청하면 사용.
---

# HTL step 루프 — 실행 절차

규칙의 권위는 `HTL/CLAUDE.md`(목표·작업 방식)와 `HTL/STATE.md`(지금 어디까지). 이 스킬은 그 절차를 **토큰·시간 효율적으로** 실행하는 방법만 정한다. 작업 디렉토리: `HTL/`.

## 0. 읽기 — 허용 목록만

**필독**: `HTL/CLAUDE.md` · `HTL/STATE.md` (전체). STATE 가 현재의 SSOT 다.
**조건부**: 직전 step 의 `steps/step_NNNN/step_NNNN.md` 1개(직전 법칙 형식 참고용)만 기본으로 읽는다. 그 외 옛 step 문서는 *습관적으로* 통째로 훑지 말 것 — 다만 이번 step 이 특정 과거 법칙을 직접 건드리거나 그 발견에 의존한다면 **해당 step 문서를 짚어 읽는다**(필요하면 전체라도). STATE 가 SSOT 이지만, 거기에 없는 세부가 필요하면 출처 step 으로 내려가는 게 맞다.
**큰 코드 파일은 부분 읽기만**: `engine/` 의 법칙 파일이 커지면 Grep 으로 직전 법칙·진입점만 찾아 offset/limit 로 읽는다.

## 1. 논의 — step 의 의미를 먼저 확정

step 은 목적에 도달하기 위한 *의미*를 가져야 한다. 시작 시 사용자와 **무엇을 할지** 정한다:
- 이 step 이 세계를 어떻게 변형시키는가 (충분히 유의미한가)
- **무엇으로 검증 가능한가** — 검증 불가능한 step 은 step 이 아니다
- 무엇이 보존되고 무엇이 변하는가

결정되면 구현을 시작한다. 애매하면 멈추고 논의한다.

## 2. 구현 — 세계(engine)와 확인용(viewer) 분리

**세계 ↔ 확인용은 단방향 의존**: `engine/` = 세계(법칙) 그 자체 · `viewer*` = 그것을 확인하는 도구. `viewer` 는 `engine` 을 *읽기만* 하고, `engine` 은 `viewer`(렌더·캡처·캔버스)를 **절대 import/참조하지 않는다**. 렌더 방식을 바꿔도 세계는 불변이어야 한다.

- **법칙은 `engine/`** 한 곳. 새 법칙은 직전 법칙 형식을 따르고 **가법적**으로 추가(기존 동작 회귀 0 — 노브=0 → early-return 패턴 권장). engine 코드는 캔버스·DOM·렌더에 의존하지 않는다(Node 에서 그대로 돈다).
- **확인용은 `viewer.html` + `viewer/`** (렌더 `viewer/htl-render.js` · 캡처 `viewer/capture.js`). 이 step 의 세계가 보여질 시뮬레이션을 여기에 추가/갱신한다.

## 3. 검증 — verify.js (수치) + 시뮬레이션 캡처 (눈)

검증은 두 축이다. 둘 다 통과해야 step 을 닫는다.

**(a) 수치 — `steps/step_NNNN/verify.js`**
- 그 법칙을 **완전히** 검증한다 (`node HTL/steps/step_NNNN/verify.js`).
- verify 는 **자체로 온전·순수**해야 한다 — 외부 가변 상태에 의존하지 않고, 이후 어떤 step 을 진행해도 깨지지 않는다(영구 회귀 가드).
- 닫기 전 **이전 step 들의 verify 를 전부 재실행**해 회귀 0 을 확인한다. 깨지면 멈추고 사용자와 논의한다.
- 문서의 모든 수치는 verify 출력을 그대로 옮긴다.

**(b) 눈 — 시뮬레이션 캡처**
- `viewer.html` 에서 이 step 의 세계를 실제로 띄워 **화면을 캡처**한다 (headless 브라우저로 viewer 를 로드 → 대표 시점에서 스크린샷). 산출물: `steps/step_NNNN/capture.png`(필요 시 여러 프레임).
- 캡처가 *수치 검증의 가설과 일치하는지* 눈으로 확인한다 — 보존량이 퍼지는 모양, 패턴 창발 등 verify 가 주장하는 바가 화면에 실제로 보여야 한다. 어긋나면 멈추고 논의한다.
- 캡처 이미지는 `steps/step_NNNN/step_NNNN.md` 에 첨부/참조한다.

## 4. 기록 — steps/step_NNNN/ + STATE.md

**한 step = 한 폴더.** 그 step 의 모든 산출물(`step_NNNN.md`·`verify.js`·`capture.png`)은 `steps/step_NNNN/` 안에 모은다.

- `steps/step_NNNN/step_NNNN.md`: 논의·구현·검증·발견 전문 + **"쉽게 풀어 쓴 설명"** + 이 step 이 *목적에 어떤 의미를 남겼고 다음에 어떤 작업으로 연결되는지*.
- `STATE.md`: §1 NOW · §2 NEXT · §3 좌표 · §4 격차 · §5 시리즈 인덱스 1줄 append. **전체 Write 금지 — 바뀐 절만 Edit.**
- 닫은 `steps/step_NNNN/` 폴더(문서·verify)는 이후 **불변**.

## 5. 닫기 체크리스트

1. 이 step verify PASS + 이전 step verify 전부 재실행 PASS (회귀 0)
2. `viewer.html` 캡처(`steps/step_NNNN/capture.png`) 확보 + 화면이 verify 가설과 일치
3. `steps/step_NNNN/step_NNNN.md` "쉽게 풀어 쓴 설명" 포함 · 수치 = verify 출력 · 캡처 참조 · 다음 연결 명시
4. `STATE.md` §1~5 Edit
5. git: (로컬) `main` 에 commit·push / (원격) 지정 브랜치 규칙

## 금지 사항 (비용 함정)

- 검증 없는 step 을 닫지 않는다.
- 옛 step 문서를 *습관적으로* 통째로 훑지 않는다 — STATE 가 SSOT. (단, 이번 step 이 특정 과거 법칙·발견에 직접 의존하면 그 step 문서는 짚어 읽는다.)
- verify 를 다른 step 에 의존시키지 않는다 — 순수·독립.
- 한 step 에 법칙을 여러 개 욱여넣지 않는다 — 가장 단순한 단위 하나.
- `engine/`(세계) 안에 확인용(렌더·캡처·DOM) 코드를 넣지 않는다 — 세계는 viewer 없이도 돌아야 한다.
