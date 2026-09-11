# STATE — 지금 어디에 서 있는가

살아 있는 문서 — **현재 상태만** (CLAUDE.md 원칙 10). 경위는 git history 가 소유한다.

```text
목적    새 세션과 Human 이 이 한 장으로 "어느 트랙이 어디까지 왔고 다음이 무엇인지" 를 안다. 할 일의 큐는 TODO.md.
기능    §0 트랙과 순서(전체) · §1 design 관점 · §2 판정 관점 · §3 cycle 관점 · §4 코드
상세    DESIGN.md(기획서 → Cycle 덮임 · 남은 것 · 판정 질문 · 결정 대기 · 다음에 자를 기획서) · CYCLES.md(레인 · 기획서 없는 다음 Cycle · 부채) · ../codemap/(코드)
갱신    Cycle 목록 승인 · Cycle 이 main 에 합쳐짐 · 예심 · 판정 반영 — 그때마다 그 트랙 줄만 고친다. 닫힌 것은 지운다.
```

## 0. 트랙과 순서

트랙은 셋이다. 각 트랙은 자기 줄의 순서대로 가고, 트랙 사이의 의존은 아래 그림이 말한다.

| 트랙 | 주체 | 지났다 | **지금** | 다음 | 그 다음 |
|---|---|---|---|---|---|
| Human — 지목 · 승인 · 판정 · 주입 | Human | L0 · L1 · L2 아홉 · M1~M8 · L7 주입 · C001~C031 기획서 여섯의 판정 반영 · Foundation 지목 · Foundation Cycle 목록 승인 (Q1~Q9 제안대로 · 기반 집중) · L3-Subject-Body 지목 · Cycle 목록 승인 (C039~C042 · 질문 여섯 권장대로) | **판정 셋** — 협곡 · 생명 · 요구와 가능성 (컨텐츠 행 — 실주행) · **"C039 진행"** (3층 첫 Cycle 실현 시작) | 판정 답의 반영 · 지목 — 후보 3 · 3.5 | HundredRooms 미지 백 줄의 이름 · 4~7층은 층이 열릴 때 |
| Cycle — spec 제안 → 동결 → 실현 → 마감 | AI (advprotoi-spec → advprotoi-cycle) | C001~C038 (기획서 열 · Foundation 닫힘) · C039~C042 spec (L3-Subject-Body — 승인 · C039 동결) | **C039 실현 대기** — "C039 진행" | C040 → C041 → C042 (초안 — 자기 차례에 동결) | 3층 예심(기반 질문 서넛) → 기반 검토 |
| ENGINE — 게임 명사 없는 기구 | AI | Region 작성기 **T1~T6 다 실측** (열세 질문 · 미지 한 줄이 사람 손 없이 선다 · 목록 일곱 줄이 배치→판정 표면→승인까지 돈다) | — | **Human 의 미지 백 줄**을 기다린다 (TODO §1) | 큰 Region 이 올 때 chunk 적재 |

```text
순서 — 트랙 사이의 의존 (왼쪽이 먼저 · 병행은 나란히)

  Foundation (C034~C038) — C034~C037 · C038(결손 다섯) ──→ 기반 검토 실측 ──→ 결정 확정 ──→ **닫힘** (2층 Foundation 이 섰다)
  (지금) L3-Subject-Body 승인됨 (C039~C042 spec · 질문 여섯 답) ──→ Human "C039 진행" ──→ C039 → C040 → C041 → C042 ──→ 예심(기반) ──→ 기반 검토 ──→ 3층 닫힘
  Human 기획서 지목(후보 3 · 3.5) ──→ AI 가 Cycle 전부의 spec (C043~) ──→ Human "C### 진행" ──→ Cycle → … ──→ 예심 ──→ 판정
                                                                                                          └─ 아니오 → GAP 회수 → 그 기획서에 Cycle
  Human 판정 협곡 · 생명 · 요구와 가능성 ──→ 예: 행 닫힘 / 아니오: GAP 회수 ──→ Cycle ──→ 판정
  ENGINE T1~T6 다 실측 (닫힘 — 목록 한 벌이 배치 → 판정 표면 → 승인까지 돈다) ──→ **Human 이 미지 백 줄의 이름** ──→ HundredRooms(후보 4) ──→ "C### 진행" ──→ Cycle (코드 diff 0)

  기획서 순서     (1 Foundation — 닫힘) → 2 주체와 몸(3층 — L3-Subject-Body · C039~C042 승인 · 진행) ∥ 3 Rooms GAP 회수  →  4 HundredRooms  →  6 · 7 · 8 · 9 (4 · 5 · 6 · 7층)
  층의 순서       2층 닫힘(판정 셋 + 후보 3) → 3층(C039~C042) → 4층 → 5층 → 6층 → 7층 — **이 차례대로 간다**(확정). 앞당길 일이 생기면 그때 Human 이 뒤집는다.
```

한 Cycle = 브랜치 `cycle/C###` = 세션 하나. **말할 것: "C039 진행"**(3층 첫 Cycle 실현) · "<기획서> 로 spec 써"(다음 spec 제안 — 후보 3 · 3.5) · 판정 셋의 답.
기획서가 채팅으로 오면 `advprotoi-inject` 가 먼저 보존한다. `advprotoi-spec` 이 그 기획서의 Cycle 전부를 spec 으로 쓰고 Human 반환에서 멈추고, "C### 진행" 부터 `advprotoi-cycle` 이 동결 → 실현 → 마감을 이어 돌리며 UNRESOLVED · GAP 에서만 멈춘다.
Cycle 의 종류는 행이 가른다 — 기반 Cycle(L<N>)은 제공 · 작동 · 손잡이로 닫고 경험은 데이터로 내린다 · 컨텐츠 Cycle(M<N>)은 실주행으로 닫는다 ([Design-CycleExecutionWorkflow §21](../design/Design-CycleExecutionWorkflow.md)).

## 1. design 관점 — 어떤 기획서가 얼마나 반영되었는가

상세 [DESIGN.md](DESIGN.md).

| 층 | 상태 | 한 줄 |
|---|---|---|
| 0 게임 방향 · 1 세계의 문법 | 확정 | 판단 기준 · 코드가 이미 그 위. L0 미증명 넷은 컨텐츠 행 · 3층 · 7층 · 실주행이 채운다 |
| 2 세계 자체 | **다음** | 기획 열 문서가 다 코드에 있고 Foundation 은 닫혔다. 판정 셋(컨텐츠 행 M5·M6·M7) · Rooms GAP 둘(후보 3) · 도구 하나(HundredRooms)가 남았다 |
| 3 주체와 몸 | **진행** (2층 판정과 병행) | 기획서는 L3-Subject-Body 하나 — Cycle 목록 C039~C042 승인 · 질문 여섯 답 기입 · C039 동결. 코드는 아직 없다 — "C039 진행" 이 첫 실현 (DESIGN §3 L3-Subject-Body) |
| 4 · 5 · 6 | 미주입 | 각 층의 대기 기획서(L4-Item-Gem · L4-Item-Craft · L5-Combat-Emergent · L6-Skill-Class)가 입력이다 — Foundation · L7 의 몫은 옮겼고, 2층 나머지 일곱 문서의 뒤 층 절은 3층 주입 때 옮긴다 (DESIGN §3) |
| 7 성장 | 미주입 (원문 확정) | L7 원문의 7층 몫 + L7-Growth-Experience(Foundation §7.5) |
| 자리 없는 것 | Human 결정 | 다중 플레이어의 충분조건 · 사회 · 번식 · 절벽 낙하 — 9층인가 3~7층인가 (DESIGN §4) |

컨텐츠 행: M1 (후보 3 → 닫힘) · M2 · M3 · M4 닫힘 · **M5 · M6 · M7 판정 대기**(컨텐츠 행이라 실주행이 잣대다) · M8 은 3층이 닫힌 뒤 Human 이 이름을 줄 때 (추위의 값도 그 행이 놓는다).
Foundation 은 기반 층이라 잣대가 달랐다 — 실주행이 아니라 **기반으로서 제공되는가**이고 실측으로 닫혔다 (DESIGN §3 Foundation 절).

## 2. 판정 관점 — Human 이 답할 것이 남은 기획서

상세 [DESIGN.md §3](DESIGN.md) 그 기획서 절 — 판정 질문(컨텐츠 행) · 결정 대기(닫힌 것의 값 · 규칙). 다음에 자를 기획서는 [DESIGN.md §5](DESIGN.md).

| 기획서 | Cycle | 남은 것 |
|---|---|---|
| Region (M1 방들의 그래프) | C001~C004 | 판정 끝 — GAP 둘 → 후보 3 · 결정 대기 |
| Tool(땅) · Region(M2) · Material(M3) · Time(M4) · Observation-Surface · Tool-Scale(도구) | C005~C018 · C026~C028 | 닫힘 — 결정 대기 스물넷 |
| M5-FrostCanyon | C019~C021 | **판정 대기** — Frost-1~6 |
| Life (M6 붉은 알집) | C022~C025 | **판정 대기** — Life-1~6 |
| Access (M7 열을 저장하는 결정) | C029~C031 | **판정 대기** — Access-1~5 |
| Foundation | C034~C037 · C038 | **닫힘** — 기반 검토 · 결정 확정 · 남은 것 없음 |
| L3-Subject-Body (3층 — 기반) | C039~C042 | **승인됨 · 진행** — 질문 여섯 답 기입 · 결정 대기 없음 · 기반 검토는 C042 마감 뒤 |
| (다음) 후보 3 · 3.5 | C043~ | **제안 전** — "<기획서> 로 spec 써" |

## 3. cycle 관점 — 지금 돌 수 있는 것

상세 [CYCLES.md §1](CYCLES.md) — 레인 표 · 병렬 규칙 · 공학 부채.

| 레인 | 지금 | 기다리는 것 |
|---|---|---|
| L3-Subject-Body | **C039** 동결 — 실현 가능 | "C039 진행" |
| (다음 기획서) | Cycle 전부의 spec (C043~) | Human 이 후보 3 · 3.5 를 지목 |
| ENGINE B | — (T1~T6 다 실측) | **Human 이 미지 백 줄의 이름을** |

## 4. 코드

코드에 있는 것은 [../codemap/](../codemap/README.md) — `ENGINE.md`(기반 모듈 API) · `CONTENT.md`(컨텐츠 코드 구조) · `README.md`(실행 · 검증 손잡이). 코드에 아직 없는 축은 [DESIGN.md §6](DESIGN.md).
