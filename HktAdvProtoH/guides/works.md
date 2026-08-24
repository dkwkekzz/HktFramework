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
| **VIEW** | 관찰만을 위한 화면 작업 — 이미 관찰에 실린 것을 더 잘 보이게 한다. 세계·관찰 계약 불변 | `view/` · `works/V-*` | `V-NNN` → `works/` | `advprotoh-view` · guides/view-work.md |
| **MASTER** | WHY → OPTIONS → NEED → NEXT · Inject · Constraint 정비 | `master/` (graph · constraints · frontier · overlay · open-questions) | — → `master/HISTORY.md` | `advprotoh-master` · guides/master-*.md — **main 위 직렬, 한 번에 하나** |
| **FEEDBACK** | 닫힌 Cycle 을 Master 에 반영 | `master/` 공유 파일 + `master/feedback/` | `feedback/<CycleId>.md` | guides/master-feedback.md — **병합 뒤 최신 main 위 직렬** |
| **ENGINE (기반)** | 커널 · physics · view-kernel · protocol-core | `engine/` | — (git history) | 기반 트랙 전용 — 컨텐츠(`content/`) 불변. 경계는 `npm run boundary:check` 가 강제 |
| **PROCESS (공정)** | 공정 자체의 정비 — Guide · 도구 · 스킬 | `guides/` · `tools/` · `.claude/skills/advprotoh-*` · CLAUDE.md | — (git history) | **한 번에 하나** — 공정을 바꾸는 동안 다른 레인을 새로 띄우지 않는다 |

WORLD 트랙 사이의 규칙(트랙 = 도메인 · Cycle 번호공간 · Frontier/Feedback 파일 소유)은
`master/frontier/README.md` 병렬 규칙이 소유한다. 이 문서는 레인 **사이**의 경계만 긋는다.

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
Cycle 이 발견한 Master 결손      → 08-verification.md 의 MASTER GAP / FEEDBACK (기존 규칙)
누구든 발견한 공정 결손           → 보고 → PROCESS 레인
```
