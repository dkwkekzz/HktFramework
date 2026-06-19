# HTJ — 스스로 굴러가는 세계 (라우터)

> 이 문서는 **목표·작업 방식·인덱스만** 보관하는 얇은 진입점이다. "지금 어디까지"의 권위는 [STATE.md](STATE.md), step 실행 절차의 권위는 `.claude/skills/htj-step/SKILL.md` 다. **step 작업 전 [STATE.md](STATE.md) 필독.**

## 프로젝트의 목표

실세계의 만물이 물리 법칙으로 설명되듯, **정해진 규칙으로 스스로 굴러가는 세계**를 만든다.

그러한 방식으로 아이템·캐릭터 등을 표현할 수 있는 **복잡계**가 등장할 수 있다. 그 세계는 충분히 복잡하여 플레이어는 다양한 상호작용을 할 수 있다.

핵심은 **author 하지 않는다**는 것이다 — 아이템·캐릭터를 타입으로 박아 넣는 것이 아니라, 더 낮은 층위의 규칙이 굴러간 *결과로 창발*하게 한다.

## 작업 방식

**아주 간단한 법칙부터 시작하여 점진적으로 세계를 구축한다.** 한 번에 도달하지 않는다 — 큰 목표를 향해 작은 실행 단위(step)로 나아가고, 상태 파일([STATE.md](STATE.md))이 "지금 어디까지"를 한 곳에 기록한다.

step 한 바퀴의 실행 절차(논의→구현→검증→기록)는 `htj-step` 스킬이 권위다 — `.claude/skills/htj-step/SKILL.md` 참조. step 작업은 그 스킬로 시작한다("HTJ step 진행" / "다음 step").

**git**: 로컬 환경에서 작업 시 별도 브랜치를 만들지 않는다 — `main` 에 작업하고 commit·push 한다. (원격 실행 환경에서는 지정 브랜치 규칙을 따른다.)

## 인덱스

| 파일 | 역할 | 갱신 주기 |
|---|---|---|
| `CLAUDE.md` (이 문서) | 목표 · 작업 방식 · 인덱스 | 거의 불변 |
| [STATE.md](STATE.md) | 지금 어디까지 · 다음 할 일 · step별 한 줄 요약 | step마다 |
| `.claude/skills/htj-step/SKILL.md` | step 한 바퀴(논의→구현→검증→기록)를 실행하는 절차 | 거의 불변 |
| `engine/` | **세계(법칙·시뮬) src** — 한 곳에서 관리, step마다 가법적 확장. *확인용 코드 금지* | step마다 |
| `viewer.html` · `viewer/` | **확인용** — 세계를 보여주는 뷰어 + 렌더(`viewer/htj-render.js`) + 헤드리스 캡처(`viewer/capture.js`) | step마다 |
| `step_NNNN/` | **한 step = 한 폴더**. 그 step 의 모든 산출물을 담는다(닫은 뒤 불변): | step마다 추가 |
| ┗ `step_NNNN/step_NNNN.md` | 논의·구현·검증·발견 전문 + 쉽게 풀어 쓴 설명 + 다음 연결 | |
| ┗ `step_NNNN/verify.js` | 그 step 법칙의 수치 검증 — 순수·영구. 이후에도 항상 통과해야 함 | |
| ┗ `step_NNNN/capture.png` | 그 step 의 viewer 시뮬레이션 캡처 — 눈 검증 증거 | |

> **세계 ↔ 확인용 분리 (단방향 의존)**: `engine/` 는 세계 그 자체(법칙)다. `viewer*` 는 그것을 *확인*하기 위한 도구일 뿐 — `viewer` 는 `engine` 을 *읽기만* 하고, `engine` 은 `viewer` 를 절대 모른다. 세계는 viewer 없이도 굴러가고 검증된다(`verify.js` 는 `engine/` 만 의존). 렌더 방식을 바꿔도 세계는 불변이어야 한다.

> step 작업은 `htj-step` 스킬로 시작한다("HTJ step 진행" / "다음 step").
