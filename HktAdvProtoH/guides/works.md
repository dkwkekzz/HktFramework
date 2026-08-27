# Works Guide — 작업 레인의 단일 출처

모든 세션은 시작할 때 **자기 작업이 어느 레인인지** 정하고, 그 레인의 쓰기 범위 밖을
편집하지 않는다. 병렬 안전은 규율이 아니라 **쓰기 범위의 겹침 없음**이 보장한다.

```text
한 레인 = 동시에 한 세션    레인을 병렬로 띄우는 것은 Human 이고, 같은 레인을 두 세션이
                           동시에 돌지 않는 것도 Human 이 보장한다. 레인 안은 언제나 직렬 —
                           그래서 레인 소유의 번호공간·파일은 충돌할 수 없다
쓰기 범위 밖은 읽기만        판정·참조를 위해 읽는 것은 자유다. 고치고 싶으면 그 레인의
                           작업으로 넘긴다 (아래 레인 판정)
```

## 레인

| 레인 | 무엇을 하는가 | 쓰기 범위 | ID · 기록 | 공정 (스킬 · Guide) |
|---|---|---|---|---|
| **WORLD 트랙** (ITEM · COMBAT · …) | 선택된 Frontier 를 8 Stage 로 닫는다 — 세계의 Capability 가 는다 | `cycles/C-<TRACK>-*` · `world/` · `view/` · `protocol/` · `motions/` | `C-<TRACK>-NNN` → `cycles/` | `advprotoh-cycle` · guides/cycle-definition.md ~ verification.md |
| **VIEW** | 관찰만을 위한 화면 작업 — 이미 관찰에 실린 것을 더 잘 보이게 한다. 세계·관찰 계약 불변 | `view/` · `works/` | `V-NNN` → `works/` · **할일: `works/BACKLOG.md`** (UX 기획서 주입 = 번역) | `advprotoh-view` · guides/view-work.md |
| **MASTER** | WHY → OPTIONS → NEED → NEXT · Inject · Constraint 정비 | `master/` (graph · constraints · frontier · overlay · open-questions) | — → `master/HISTORY.md` | `advprotoh-master` · guides/master-*.md — **main 위 직렬, 한 번에 하나** |
| **FEEDBACK** | 닫힌 Cycle 을 Master 에 반영 | `master/` 공유 파일 + `master/feedback/` | `feedback/<CycleId>.md` | guides/master-feedback.md — **병합 뒤 최신 main 위 직렬** |
| **ENGINE (기반)** | 커널 · physics · view-kernel · protocol-core | `engine/` | — (git history) | 기반 트랙 전용 — 컨텐츠(`content/`) 불변. 경계는 `npm run boundary:check` 가 강제 |
| **PROCESS (공정)** | 공정 자체의 정비 — Guide · 도구 · 스킬 | `guides/` · `tools/` · `.claude/skills/advprotoh-*` · CLAUDE.md | — (git history) | **한 번에 하나** — 공정을 바꾸는 동안 다른 레인을 새로 띄우지 않는다 |

WORLD 트랙 사이의 규칙(트랙 = 도메인 · Cycle 번호공간 · Frontier/Feedback 파일 소유)은
`master/frontier/README.md` 병렬 규칙이 소유한다. 이 문서는 레인 **사이**의 경계만 긋는다.

## 배차판 — 레인 사이 상태의 단일 출처

레인 **사이**의 지금 상태(열림 · 막힘 · Human 대기 · 레인 간 충돌 판단)는 활성 팩 루트의
`LANES.md` 가 소유한다. 이 문서(works.md)가 레인의 **정의**를 소유하고, 배차판은 그
레인들의 **지금**을 소유한다 — 레인 안의 할일(frontier 후보 · BACKLOG 항목 · Cycle Stage)은
각 레인의 소유 파일에 있고 배차판에 중복하지 않는다.

```text
세션 시작    배차판을 읽고 OPEN 레인 하나를 잡는다 — 자기 줄의 상태를 RUNNING 으로,
            "지금" 칸에 작업 ID(C-… · V-… 등)를 적는다. BLOCKED/HUMAN 레인을 잡으려면
            "기다리는 것" 이 실제로 사라졌는지 스스로 확인하고 OPEN 으로 고쳐 잡는다
세션 종료    자기 줄을 다음 상태로 갱신한다 — 남은 일이 있으면 OPEN + "지금" 갱신,
            다른 레인을 기다리면 BLOCKED + "기다리는 것", Human 결정이 필요하면 HUMAN
            (필요하면 "HUMAN 대기" 절에 한 줄). 완료 경위는 적지 않는다 (원칙 20)
쓰기 규칙    **자기 레인 줄만 고친다** — 한 레인 = 한 세션이므로 자기 줄은 충돌하지 않는다.
            다른 레인 줄은 그 레인이 스스로 고친다 (막힘 해제도 착수자가 확인하고 고친다)
관찰         npm run lanes 가 판 + 실제 상태(Cycle Stage · SELECTED · 미처리 Feedback ·
            BACKLOG)를 LANES.html 로 겹쳐 그린다 (생성물 — 커밋하지 않는다).
            npm run lanes:check 가 판과 실제의 어긋남을 잡는다 — 세션 시작·종료 시 돌린다
```

축이 셋이다 — 배차판(레인 상태) · 흐름(기획서 → master → 후보 → Cycle → Feedback,
`npm run lanes` 가 그린다) · 의미(Goal → Possibility → Capability, `npm run master:graph`
가 소유). 새 관찰 축이 필요하면 도구에 절을 더하지, 레인의 작업 방식을 바꾸지 않는다.

## 레인 판정 — 특히 VIEW 와 WORLD

경계에서 헷갈리는 것은 사실상 하나다: 화면 작업이 View 인가 Cycle 인가.

```text
VIEW 다        world/ 와 관찰 계약(protocol/)을 한 줄도 바꾸지 않는다.
               이미 GameView 에 실려 오는 것을 배치·표기·강조·조작감으로 더 잘 보이게 한다
Cycle 이다     "보여줄 것이 부족해서" 세계의 관찰을 늘리고 싶다 — 그것은 화면 편의가
               아니라 세계의 관찰 확장이다 (예: 미리 본 유효 값 = FR-SEE-BEFORE-YOU-WEAR).
               Frontier → Cycle 경로로 승격한다
```

판정이 끝난 뒤에도 View 작업은 Constraint 의 적용을 받는다 — Master 가 관리하지 않는
것과 원칙이 면제되는 것은 다르다 (특히 DC-WORLD-OWNS-THE-SURFACE-LIST: view 는 사유·
판정·유효 값을 스스로 계산하지 않는다).

같은 형태의 승격이 다른 레인에도 있다.

```text
VIEW → WORLD 트랙     관찰 계약을 바꾸고 싶다 (위)
WORLD → ENGINE        팩의 시스템으로 안 되고 기반 솔버·커널을 고쳐야 한다 —
                      Cycle 안에서 engine/ 을 고치지 않고 기반 트랙 작업으로 분리한다
WORLD/VIEW → MASTER   상위 의미와 어긋난다 — MASTER GAP 으로 반환 (CLAUDE.md "막혔을 때")
아무 레인 → PROCESS   공정·Guide·도구 자체가 틀렸다 — 그 자리에서 고치지 않고 보고한다
```

## 레인이 공유하는 파일에서

`protocol/gameview.ts` 와 `protocol/semantic-id.ts` 는 **도메인 파일로 갈라져 있다** —
타입·식별자는 `gameview-combat.ts` / `gameview-item.ts` · `semantic-id-{core,combat,item}.ts`
가 소유하고 트랙은 **자기 도메인 파일에만** 더한다. 인덱스 둘은 재수출·조립만 하며,
소비처는 언제나 인덱스 하나만 import 한다. 새 트랙이 서면 자기 도메인 파일을 만든다.

그래도 남는 공유 지점에서는 **추가만 하고, 자기 도메인 영역 끝에 붙인다** — 기존 줄을
옮기거나 재배열하지 않는다.

```text
world/index.ts               세계 조립 — SYSTEMS 배열의 순서가 결정론을 소유하므로
                             분할하지 않는다. 시스템·상태 필드를 더할 때만 닿는다
gameview.ts 의 스냅샷 조립    새 관찰 목록을 스냅샷에 다는 한 줄
semantic-id.ts 의 재수출      새 도메인 파일을 다는 한 줄
```

## 발견의 밸브 — 한 방향

레인 밖에서 발견한 결손은 그 자리에서 고치지 않고 **보고만** 한다. 보고는 밸브를 타고
소유 레인으로 흐른다.

```text
VIEW 가 발견한 세계 관찰의 결손   → works/V-*.md 의 REPORT 절 → Human → (진짜면) Frontier 후보
Cycle 이 남긴 화면 몫            → works/BACKLOG.md 항목 (VIEW 레인의 할일로 이관)
Cycle 이 발견한 Master 결손      → 08-verification.md 의 MASTER GAP / FEEDBACK (기존 규칙)
누구든 발견한 공정 결손           → 보고 → PROCESS 레인
```

## 보고 — 레인마다 무엇을 보여야 하는가

작업이 끝나면 **그 레인의 말로** 보고한다. 설계 사유를 길게 적는 것은 보고가 아니다 —
읽는 사람이 "무엇이 생겼는가" 를 그 자리에서 알 수 있어야 한다. 사유는 코드 주석과
기록 문서가 이미 지닌다.

```text
ENGINE       **무엇을 모듈로 뺐는가** — 새 파일 · 인터페이스(형과 주입 지점) ·
             기반에서 사라진 것의 수. "능력이 늘었다" 가 아니라
             "이 함수가 이 인자를 받는다" 로 적는다
VIEW         **화면에서 무엇이 달라졌는가** — 이전 → 지금을 나란히.
             실제로 띄워 밟은 걸음과 그때 화면에 뜬 글자를 그대로 옮긴다.
             찍은 화면이 있으면 그것이 본문이다
WORLD 트랙    Playable Result / Observable Result (08-verification 이 이미 그 형식이다)
MASTER       무엇이 후보로 서고 무엇이 닫혔는가 — 그래프의 상태 변화
PROCESS      어느 문서의 어느 규칙이 바뀌었는가
```

네 레인 공통으로, **못 한 것과 재현하지 못한 것을 같은 자리에 적는다.** 검사로만
확인하고 눈으로 보지 못했으면 그렇게 적는다 — 보고는 자랑이 아니라 다음 사람이
이어받는 자리이고, 확인하지 않은 것을 확인한 것처럼 적으면 그 자리가 무너진다.

