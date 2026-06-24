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
| `design/` | **설계 문서** — 닫은 step 아닌 *앞으로의 아키텍처 계획*. 후속 step 이 참조해 구현한다(트랙은 하나). | 비정기 |
| ┗ [design/sphere-world.md](design/sphere-world.md) | **구체 세계 설계(진행 방향·권위)** — 세계를 한 원소=자유 구체로 재정립. 합치기/쪼개기=적응 LOD. 로드맵 SW1~SW5 | |
| ┗ [design/environment.md](design/environment.md) | **환경 설계(오픈월드·권위)** — sphere-world 위에 *딛고 다닐 광활한 환경*(산·바다·강)을 같은 원소로. 로드맵 TW1~TW4 | |
| ┗ [design/merge-dna.md](design/merge-dna.md) | **병합·형태 DNA 설계(권위)** — 뭉친 원소를 한 개체로 병합(수박게임)하되 형태는 정규화된 hash 로 세계 사전에서 공유. 로드맵 M1~M4 |
| ┗ [design/scene-unify.md](design/scene-unify.md) | **장면 통일 설계(작업 방식 개선·권위)** — capture.js↔viewer 를 *시나리오 1벌*로 일원화(per-step capture.js 폐지)·verify=새 법칙만(보존·결정론은 공용 가드). engine·물리 불변(확인용 트랙). 로드맵 U1~U4·**닫은 step 소급 안 함** | |
| `engine/` | **세계(법칙·시뮬) src** — 한 곳에서 관리, step마다 가법적 확장. *확인용 코드 금지* | step마다 |
| `viewer.html` · `viewer/` | **확인용** — 뷰어 + 렌더(`viewer/htj-render.js`) + **시나리오 SSOT**(`viewer/scenes/step_NNNN.js` — viewer 라이브·헤드리스 캡처가 함께 읽는 한 벌·[design/scene-unify.md](design/scene-unify.md)) | step마다 |
| `tools/` | **확인용 도구** — 범용 헤드리스 캡처(`htj-render-capture.js` — 시나리오 1벌→PNG·per-step capture.js 대체) · PNG 헬퍼(`htj-capture.js`) · verify 공용 가드(`htj-verify-lib.js` — 보존·결정론·항등) · 등록 가드(`check-viewer.js`) | 거의 불변 |
| `steps/step_NNNN/` | **한 step = 한 폴더**. 모든 step 은 `steps/` 아래. 그 step 의 산출물을 담는다(닫은 뒤 불변): | step마다 추가 |
| ┗ `steps/step_NNNN/step_NNNN.md` | 논의·구현·검증·발견 전문 + 쉽게 풀어 쓴 설명 + 다음 연결 | |
| ┗ `steps/step_NNNN/verify.js` | 그 step 법칙의 수치 검증 — 순수·영구. 이후에도 항상 통과해야 함 | |
| ┗ `steps/step_NNNN/capture.png` | 그 step 의 viewer 시뮬레이션 캡처 — 눈 검증 증거 | |

> **세계 ↔ 확인용 분리 (단방향 의존)**: `engine/` 는 세계 그 자체(법칙)다. `viewer*` 는 그것을 *확인*하기 위한 도구일 뿐 — `viewer` 는 `engine` 을 *읽기만* 하고, `engine` 은 `viewer` 를 절대 모른다. 세계는 viewer 없이도 굴러가고 검증된다(`verify.js` 는 `engine/` 만 의존). 렌더 방식을 바꿔도 세계는 불변이어야 한다.

> step 작업은 `htj-step` 스킬로 시작한다("HTJ step 진행" / "다음 step").

## 버그 수정 정책 — 닫은 step 도 *버그 한정* 수정한다

"닫은 step 폴더(코드·verify·문서)는 불변"은 **가법 확장**(새 법칙=새 step)에만 적용되는 원칙이다. **버그(수치 발산·보존 위배·잘못된 기대값 등)를 고칠 때는 새 step 으로 우회하지 않고 *기존(닫은) step* 의 코드·verify·문서를 직접 수정한다.** 이후 같은 상황도 동일하게 처리한다. 수정 시: ① 무엇이 왜 틀렸는지 해당 step 문서에 「버그 수정」 노트로 남기고 ② verify 를 올바른 기대값으로 교정(필요하면 영구 회귀 가드를 추가)하고 ③ 닫기 전 전 step verify 재실행으로 회귀 0 을 확인하고 ④ `STATE.md` 격차/인덱스를 갱신한다. (선례: step_0012 "에너지 소멸" = `advect` CFL 음수밀도 폭주 → CFL 서브스텝 가드, `step_0008` verify 의 폭주-크기 단언 교정.)
