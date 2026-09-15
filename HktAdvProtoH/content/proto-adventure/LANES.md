# LANES — 레인 배차판

**살아 있는 문서다** — 레인 **사이**의 지금 상태만 담는다. 레인 **안**의 할일은 각 레인의
소유 파일(frontier/<트랙>.md · BACKLOG.md · Cycle Artifact)이 담고, 여기 중복하지
않는다. 완료·경위를 여기 쌓지 않는다 (CLAUDE.md 원칙 20). 규칙과 갱신 방법의 단일 출처는
[guides/works.md](../../guides/works.md) 의 "배차판" 절이다.

관찰: `npm run lanes` 가 이 판과 저장소의 실제 상태(Cycle Stage · SELECTED · 미처리
Feedback · BACKLOG)를 겹쳐 `LANES.html` 로 그린다. `npm run lanes:check` 는 판이 실제와
어긋나는 곳만 보고한다.

브라우저에서 보는 고정 링크는 하나다 — **main 의 판**을 가리키며 바뀌지 않는다.
갱신 규칙(언제 덮어쓰고 언제 덮어쓰지 않는가)의 단일 출처는
[master/README.md](master/README.md) 의 "고정 링크" 절이고, 거기 셋이 함께 적혀 있다.

    https://claude.ai/code/artifact/ca6a873b-1e46-4ac6-8db7-54edd562fae3

세션 시작 프롬프트는 언제나 이 한 줄이다:

    "AdvProtoH 배차판(LANES.md) 보고 열린 레인 하나 진행해"

## 레인

상태 어휘는 넷이다.

    OPEN      지금 세션을 띄울 수 있다
    RUNNING   세션이 잡고 있다 — "지금" 칸에 작업 ID 를 적는다
    BLOCKED   다른 레인의 결과를 기다린다 — "기다리는 것" 이 사라졌는지는
              착수하려는 세션이 스스로 확인하고, 사라졌으면 OPEN 으로 고쳐 잡는다
    HUMAN     Human 결정을 기다린다 — 결정이 오면 OPEN

| 레인 | 상태 | 지금 | 기다리는 것 |
|---|---|---|---|
| FEEDBACK | OPEN | 미처리 **0건** — `C-COMBAT-003` · `C-COMBAT-004` 처리 완료 (MC-ABILITY-CONDITION · MC-AURA-ALLOCATION · MC-MARK → IMPLEMENTED · 후보 신규 둘 · WHO-DRIVES 일곱째 — feedback/ 두 파일). `npm run feedback:gate` | 없음 — 다만 **병합 뒤 최신 main 위에서** 돈다 (`graph/*.yaml` 은 공유 파일이다) |
| WORLD·ITEM | HUMAN | 후보 5 중 선택 대기 — Agent 추천 FR-THE-PLACES-ARE-NARROWER (+FR-SEE-BEFORE 얹기) | Human Select (frontier/item.md) |
| WORLD·COMBAT | HUMAN | 후보 넷 중 선택 대기 — **SELECTED 가 비었다.** 사슬 B 아래 두 칸 반영 끝 (조건 관문 · 표식 → Overlay IMPLEMENTED). 의존이 빈 것은 둘 — `FR-A-PROMISE-BINDS-BOTH`(크다 — `MP-BIND-BY-CONTRACT` 가 닫힌다) · `FR-TAKE-WHAT-MAKES-THEM-STRONG`(가장 싸다). 고르기 전에 볼 것 둘이 frontier "한눈에 보기" 아래 있다 — 키 자리 바닥 · 자율 존재 미개방(습성 문서 대기). `C-COMBAT-001` 은 여전히 Human Play 대기 (`U` → `2`) | Human Select (frontier/combat.md) |
| WORLD·TERRAIN | HUMAN | 다음 후보 선택 대기 — `C-TERRAIN-003-the-world-is-born-of-its-law` **COMPLETE** (Gate 14 는 Human 이 자동 증거를 받아들여 닫혔다 — 08 STATUS). 세계가 씨앗에서 태어난다 — 손배치 상수가 사라졌고 태어난 자리 위에서 순환이 변경 없이 돈다. MASTER FEEDBACK 반영 끝 — 세계 표 둘이 PARTIAL 로 섰다. 남은 후보는 다섯 (예고 `FR-THE-LAND-SHOWS-BEFORE-IT-TAKES` — 08 이 그대로 재추천 · 나르기 · Q71(b) 확장 둘 — `FR-LOSING-IS-A-PROCESS` 는 `MG-RESCUE-THE-TAKEN` 을 통째로 연다) | Human Select (frontier/terrain.md) |
| WORLD·GROWTH | HUMAN | 후보 2 중 선택 대기 — **SELECTED 가 비었다.** `C-GROWTH-001` COMPLETE · Feedback 반영 끝. Agent 추천 `FR-THE-SKILL-LEARNS-A-NEW-MOVE`(쓰던 기술이 새 수를 배운다) — 승인된 Constraint 하나를 세계에서 닫는 유일한 후보이고 바닥이 선 지금 얹히는 비용이 가장 작다. **FC 주입이 셋째를 열었다** — `FR-YOUR-BODY-HAS-A-FORM`(몸이 형태를 가진다). 그것이 서면 캐릭터의 차이가 값의 차이뿐인 상태가 처음으로 깨진다 | Human Select (frontier/growth.md) |
| WORLD·KNOWLEDGE | HUMAN | **트랙이 방금 섰다** — 후보 일곱 중 선택 대기. 전투 지식(CK) 주입으로 판단이라는 층이 세워졌다. 의존이 빈 것은 `FR-WHAT-YOU-KNOW-FIGHTS-WITH-YOU`(배운 것이 몸의 판단이 된다) 하나이며 나머지 여섯이 전부 그것을 전제한다 — 이 트랙에는 고민할 순서가 없다. **철회된 대응 층이 돌아올 자리이기도 하다** (CK §15) | Human Select (frontier/knowledge.md) |
| VIEW | OPEN | 다음은 `exchange-second-step-shows` (아주 작음 — 코드는 섰고 **검증만 남았다**) 또는 `allocation-list-crowds-the-top`. 의존이 빈 것은 그 둘과 `growth-*` 둘이다. 남은 막힌 것은 **기반 동반**(`drag-and-drop` · 폭으로 갈리는 셋 · 색)이거나 **Frontier 재료**(`skill-activation-progress`)다 | 없음 |
| MASTER | OPEN | **자원 카탈로그(RC) 주입 끝 + Q73~Q75 판정·BT 자원 24종 완료** — IP · IT · IM 이 growth/items 에 섰다 (grants 는 전부 기존 MC · 새 MC 0). Q36(곡괭이) 닫힘 — IT-MINING-PICK. RC §23 이음매 셋은 Q73(좌표)·Q74(이름 정본=BT)·Q75(회복 조합 단일) 로 닫혔다 (HISTORY). **BT §16 세계 골격 주입 끝** — 열한 고리 중 열이 노드로 섰고(순환·지형·생존 압력·적응·자원·피난처·정착·증거 일곱이 신규), 대응표가 `graph/world-state.yaml` 머리에 있다. Q68(a)·Q69(b) 닫힘 — 순환이 이제 `MG-EXPLORE-BEIRA` 를 낳는다. 다음은 OPTIONS Q35 (몸이 아닌 존재를 요구하는 Possibility) — 이제 스킬 실행 형태의 빈 다섯 칸만 막는다. **계열별 요정 Layer 0(FC) 주입도 끝났다** — Origin Class 여섯(`growth/classes/`) · Constraint 넷 승인 · 갈래가 여럿인 나무 · 관문 넷 검사 · Q71(b) 확장(Capability 6 · Possibility 4) · Frontier 후보 넷. **Q72 닫힘(a)** — 전투법 정의의 자리가 `growth/knowledge/`(CK-*) 로 섰고 `MK-HOW-TO-FIGHT-IT` 이 graph 에서 내렸다 (앎 MK-* 는 사실만 담는다) | 없음 — 미처리 Feedback 은 FEEDBACK 레인이 진다 |
| ENGINE | OPEN | **열린 것이 없다** — 마지막 하나(패널 겹침)가 **자리판**으로 닫혔다: 열 셋 × 위아래 여섯 자리에 놓고(`engine/view-kernel/hud/hud-layout.ts` 의 `place`), 겹침은 배치의 실수가 아니라 불가능이 되었다. HUD 패널과 슬롯 띠가 같은 판을 쓰고, 조립(`index.html`)에는 모양만 남았다. `npm run hud:shot` 이 폭 셋(560×420 · 1280×800 · 손가락 820×480)에서 겹침 0 · 화면 밖 0 을 잰다. 앞서 선 넷은 그대로다: 자판이 표면 안을 다니는 길 · 겹침 표면의 자리 잡기 · 지면 구역 장치 · 조립의 눌림 배분(V-021 `dispatchKey`) | 없음 |
| PROCESS | OPEN | **Q67 이 열렸다** — 병렬 레인이 공유하는 두 자리가 어긋난다 (Q 번호공간이 레인 소유가 아니다 · `frontier/README.md` 트랙 표가 낡는다). 마지막으로 닫은 것 둘: `arises_from` 이 어떤 생성 뷰에도 그려지지 않던 것 (`tools/master-graph/` — SCHEMA 가 "세계의 인과 척추" 라 부르면서도 간선이 아니었다) · `lanes:check` 가 Human 관문에 선 트랙을 상시 어긋남으로 세던 것 (`tools/lanes/build.ts`) | 없음 **이번 합류에서 ① 이 또 났다** — main 이 BT §16 주입에 Q68 · Q69 를 썼고 이 브랜치가 FC 주입에 Q68~Q72 를 썼다. 둘 다 닫힌 질문이라 HISTORY 안에서만 겹치며, 열린 것은 Q72 하나뿐이라 옮기지 않았다 · **Q76 이 열렸다** — 조립(`app/` · `content/active*.ts`)이 어느 레인의 것인지 레인 표에 없다 (V-021 REPORT ①: 그 자리를 고쳐야 했고 규칙이 없어 기반 트랙으로 보고 진행했다). **Q68 → Q73 → Q76 으로 두 번 옮겨 적혔다** — 양쪽이 이미 쓴 번호였고, Q73~Q75 도 이 브랜치가 RC 이음매 판정에 이미 썼다 (①의 세 번째 재발 · 이 합류가 open-questions.md 에 Q76 으로 실체를 세웠다) |

## 레인 사이 충돌 — 순서가 아니라 파일이 겹치는 곳

표의 "기다리는 것" 이 잡지 못하는, 동시에 돌 때의 겹침만 적는다.

| 겹침 | 지금의 판단 |
|---|---|
| VIEW 의 장비 구획 ↔ WORLD·ITEM | 장비 구획이 V-012 로 섰다 — 이제 겹치는 것은 **고른 것 구획**이다. ITEM 의 후보 `FR-SEE-BEFORE-YOU-WEAR`(걸기 전에 안다)가 골라지면 그 Cycle 이 미리 본 값을 그 자리에 싣는다. **둘 다 자기 영역 끝에 더하고 기존 줄을 옮기지 않는다** |
| WORLD·TERRAIN ↔ WORLD·ITEM | **지금은 겹치지 않는다** — 고른 것이 `FR-THE-LAND-KEEPS-WHAT-IT-TAKES`(땅이 거둔 것을 간직한다)라 아이템 파일에 닿지 않는다. 겹치는 것은 셋째 후보(FR-WHAT-KEEPS-YOU-ALIVE-IS-CARRIED)이며, 그것을 고를 때 ITEM 이 무엇을 도는 중인지 먼저 본다 |
| WORLD·TERRAIN ↔ VIEW | 땅은 화면에 보여야 하므로 이 Cycle 이 `view/` 를 건드린다. VIEW 의 다음 항목(drag-and-drop)은 소지품 표면 안의 일이라 자리가 다르지만 표면 상태·HUD 에서 스칠 수 있다 — **둘 다 자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙과 같다) |
| WORLD·GROWTH ↔ WORLD·TERRAIN | 둘 다 `world/semantic/actor.ts` 에 몸의 새 자리를 더한다 (성장은 쌓이는 것, 땅은 거두어 가는 것). **자기 영역 끝에 추가만 하고 기존 줄을 옮기지 않는다** (frontier/README.md 공유 지점 규칙). 둘 다 관찰 계약을 넓히므로 `gameview-*` 도메인 파일도 각자 자기 파일에만 더한다 |
| **WORLD·GROWTH ↔ WORLD·COMBAT** | **겹친다 — 순서는 정해졌다: COMBAT 이 먼저다** (Human 지시). 둘 다 `world/semantic/combat.ts` 의 **유효 값 계산**(`effectiveStat`)에 항을 더한다 — 성장은 자란 값을, 배분은 지금 몰아 둔 곳을. 같은 함수 안이라 끝에 추가하는 것으로 갈라지지 않는다. **GROWTH 를 잡는 세션은 C-COMBAT-001 이 main 에 들어간 뒤 최신 main 위에서 시작한다** — 그때 `effectiveStat` 은 이미 세 항이고 성장이 넷째가 된다. 자기 줄(OPEN)은 그 세션이 스스로 고친다 (works.md 쓰기 규칙) |
| WORLD·COMBAT ↔ VIEW | 상층 후보 열이 전부 전투 HUD 에 자리를 요구한다 (지금의 배분 · 대답 가능 여부 · 기회). VIEW 와 같은 파일(`hud-presentation.ts` · `combat-presentation.ts`)에서 만나므로 위와 같은 규칙 — 자기 영역 끝에 추가만 한다 |
| WORLD·TERRAIN ↔ ENGINE | **겹치지 않는다** — 지면 구역 장치(`SceneGroundZone`)가 서서 C-TERRAIN-001 의 Stage 7·8 이 그것으로 닫혔다. 다음 지형 Cycle 이 새 프리미티브를 요구하면 그때 같은 자리에서 다시 만난다: [design/Design-Terrain-Visualization.md](../../design/Design-Terrain-Visualization.md) |
| WORLD·KNOWLEDGE ↔ WORLD·COMBAT | 첫 후보가 전투법으로 무엇을 세우느냐에 따라 `Actor.Allocation`(C-COMBAT-001)에 닿을 수 있다. **배분을 쓰지 않는 전투법으로 시작하면 겹치지 않는다** — 억제/우선의 대상을 스킬 가부로 잡으면 C007 이래의 얼개만 쓴다 (frontier/knowledge.md 첫 후보의 "주"). 그리고 지식이 상대의 규칙을 읽는 갈래는 COMBAT 의 조건 관문이 서면 두꺼워진다 — 막는 의존은 아니다 |
| WORLD·KNOWLEDGE ↔ WORLD·GROWTH | 지식의 깊이와 성장의 숙련 축이 같은 형태다 ("쓴 것이 쌓여 무엇이 열린다") — **먼저 서는 쪽의 형태를 뒤가 재사용한다**. 그리고 전투 지식의 자리 수가 성장의 여섯째 축이 되었으므로(Q65(b) · `MS-GROWTH-SOURCE` 의 KNOWLEDGE-CAPACITY) 자리가 자라는 일은 GROWTH 와 함께 본다 |
| 기반의 문구 ↔ VIEW 의 문구 표 | 기반이 새 문구 코드를 부르면 팩의 `view/code-text.ts` 에 줄이 는다 — 그 한 줄이 겹치는 전부다. 코드의 단일 출처는 `engine/view-kernel/presentation/text-codes.ts` 의 `ENGINE_TEXT_CODES` 이고, 덮이지 않은 것은 팩의 검사(`view/tests/engine-text.spec.ts`)가 어느 자리인지 가리킨다 |
| VIEW 의 skill-focus-order ↔ ENGINE | **기반 쪽은 섰다** — 표면 안의 차례는 겹침 표면 능력이 지닌다 (Tab 이 안에서 감기고, Tab 자리는 무리마다 하나이며, 실려 온 초점이 곧 브라우저의 초점이다). 팩 키(`L`)는 이제 지름길로 남는다. 표면 **밖**의 차례(대상 → Skill Bar → 상세 → 오버레이)는 여전히 VIEW 의 몫이다 |

## HUMAN 대기

Human 이 답하면 풀리는 것들이다. 답의 자리는 괄호가 가리킨다.

| 무엇 | 풀리는 것 |
|---|---|
| WORLD·ITEM 후보 선택 (frontier/item.md SELECTED) | WORLD·ITEM 레인 착수 |
| WORLD·TERRAIN 다음 후보 선택 (frontier/terrain.md SELECTED) | WORLD·TERRAIN 레인 착수. 08 의 재추천은 예고 `FR-THE-LAND-SHOWS-BEFORE-IT-TAKES` — 부채(불공정)는 남았고 예고할 대상이 태어난 세계 전체가 되었다 |
| WORLD·GROWTH 다음 후보 선택 (frontier/growth.md SELECTED) | WORLD·GROWTH 레인 착수. 둘 중 의존이 빈 것은 둘 다이며, 바닥(쌓인다)이 선 지금 값이 싼 쪽은 `FR-THE-SKILL-LEARNS-A-NEW-MOVE` 다 |
| WORLD·KNOWLEDGE 첫 후보 선택 (frontier/knowledge.md SELECTED) | WORLD·KNOWLEDGE 레인 착수. 의존이 빈 것은 `FR-WHAT-YOU-KNOW-FIGHTS-WITH-YOU` 하나다 — 나머지 여섯이 전부 그것을 전제하므로 고를 것이 사실상 하나다 |
| WORLD·COMBAT 다음 후보 선택 (frontier/combat.md SELECTED) | WORLD·COMBAT 레인 착수. 의존이 빈 것은 `FR-A-PROMISE-BINDS-BOTH` 하나다 — **다른 것보다 크다**는 것을 알고 고르는 것이 Human 의 몫이다 (master-frontier Do 6) |
| Q66 — 갈래를 노드의 완결로 판정하는가 플레이의 성립으로 판정하는가 (open-questions.md) | Overlay 를 읽는 법 · Frontier 가 무엇을 결손으로 세는가 |
| Q67 — 병렬 레인이 공유하는 두 자리가 어긋난다 (open-questions.md · PROCESS) | Q 번호 충돌과 `frontier/README.md` 트랙 표의 낡음이 되풀이되는 것을 막는다. 이번 합류에서 둘 다 실제로 났다 |
| `CC-THE-RULE-DOES-NOT-ASK-WHO-DRIVES` 승격 여부 (candidates/) | 규칙이 조종 주체를 묻지 않는 것이 원칙이 되는가 — 다섯 Cycle 이 같은 판단을 반복했다. `DC-GROWTH-DIFFERENCE-IS-BEHAVIOR` 와 합칠지도 함께 |
| `CC-ORDER-IS-THE-ADDRESS` 승격 여부 (candidates/) | 순서로 짚는 것이 원칙이 되는가 — DC-WORLD-OWNS-THE-SURFACE-LIST 와 합칠지도 함께 |
| C-COMBAT-003 의 Overlay 판정 하나 (08-verification MASTER FEEDBACK) | `MC-AURA-ALLOCATION` 을 IMPLEMENTED 로 볼 것인가 — semantic("무엇을 할 수 있는가를 가른다")으로 읽으면 닫혔고, detail 의 예 둘(인지 축도 관문이 된다)을 요구로 읽으면 아직 PARTIAL 이다. Q66 과 같은 종류의 물음이다 |
| `CC-THE-LIST-IS-THE-JUDGE-TOO` 승격 여부 (08-verification MASTER FEEDBACK) | 세계가 목록을 소유한다는 규율이 **투영뿐 아니라 판정에도** 걸리는가 — 이번에 `isSkillKind` 가 목록 대신 이름 셋을 적어 두어 새 기술이 시작은 되고 칼끝을 만들지 않았다. 관찰 둘째다 (C018 이 첫째). 기존 `DC-WORLD-OWNS-THE-SURFACE-LIST` 의 scope 를 넓힐지도 함께 |
| **키 자리가 바닥났다** (C-COMBAT-004 Master Gap ②) | 글자 키가 남지 않았다 — `O`(C-COMBAT-003) · `P`(C-COMBAT-004) 로 끝. 사슬 B 에 후보 셋이 남았으므로 **다음 Cycle 은 키 없는 기술을 세운다**. 막힘은 아니다 (띠는 눌러서도 부른다) — `BACKLOG.md` 의 `skill-slot-crowds-the-keyboard` 가 VIEW/ENGINE 레인에서 그 자리를 기다린다 |
| **자율 존재의 판단이 두 번 같은 자리에서 걸렸다** (C-COMBAT-003 Gap ① · C-COMBAT-004 Gap ①) | `Design-Creature-Behavior-R0.md` 승인이 이 트랙의 다음 층을 가른다 — 사슬 B 의 남은 셋(계약 · 규칙 관찰 · 봉인)이 전부 "상대가 무엇을 하는가" 를 전제하므로, 그 문서가 서지 않으면 **반쪽만 검증되는 층**을 쌓게 된다 |
| C-COMBAT-001 Human Play — 손으로 `U` → 숫자를 눌러 보기 | Stage 8 STATUS 가 COMPLETE 로 닫힌다 (Feedback 은 이미 반영됐다). 봐야 할 것은 이제 **하나**다 (나머지 둘은 08 의 HUMAN PLAY 보조가 재어 BACKLOG 로 넘겼다): 상대를 절반 아래로 때렸을 때 뜨는 `[몸]` 이, 표시가 셋까지 앞에 붙은 이름(`[적대] 준비! [몸]Wanderer 1 ?`)에서 교전 중에 읽히는가 |
| C-GROWTH-001 의 Master Gap ① (08-verification.md) | `GBC-GAIN-LEVEL` 의 `capability_reach.effective` 가 실제보다 넓다 — "기력 · 기본 이동" 은 이 Cycle 이 닿지 않았다. 좁힐 것인가, 그 셋에 유효 값 자리를 여는 것을 후보로 세울 것인가 |
| **C-GROWTH-001 의 Master Gap ③** — 잘 터뜨린 판이 덜 쌓는다 (feedback/C-GROWTH-001…md) | 한 마리의 벌이가 18~21 로 흔들리고 열 판 중 둘은 넘어뜨리고도 첫 문턱에 못 닿는다. 선택지 셋: (a) 그대로 둔다 — Goal 이 적은 길(쓰러뜨리고 캐면)은 어느 판에서도 넘는다 (b) 쓰러뜨림을 14 → 16 (c) 치기의 몫을 0 으로 두고 **끝난 일**만 센다. 수치는 Human 소유다 (원칙 19) |
| C-COMBAT-001 의 PARTIAL 판정 — `MP-EXPLOIT-OPEN-BODY` (08-verification.md MASTER FEEDBACK) | 어디까지로 볼 것인가 — 플레이로는 갈래가 성립하나 노드는 덜 찼다. Master(Human)가 정한다. (`MC-AURA-ALLOCATION` 쪽은 world_shape 전 문장 실측으로 IMPLEMENTED 로 닫혔다 — feedback/C-COMBAT-003-…md) |
| PROCESS | OPEN | **Q67 이 열렸다** — 병렬 레인이 공유하는 두 자리가 어긋난다 (Q 번호공간이 레인 소유가 아니다 · `frontier/README.md` 트랙 표가 낡는다). 마지막으로 닫은 것 둘: `arises_from` 이 어떤 생성 뷰에도 그려지지 않던 것 (`tools/master-graph/` — SCHEMA 가 "세계의 인과 척추" 라 부르면서도 간선이 아니었다) · `lanes:check` 가 Human 관문에 선 트랙을 상시 어긋남으로 세던 것 (`tools/lanes/build.ts`) | 없음 |
| 문서의 분류 다섯에 `도구` 를 더할 것인가 (Design-View-Inventory-Equipment-UX-D1 §6) | 곡괭이가 `기타` 대신 자기 칸을 얻는다 (V-008 REPORT) |
| Q37 — 자리에 이름을 줄 것인가 (open-questions.md) | FR-ARRANGE-WHAT-YOU-CARRY 존치/삭제 |
| Design-Creature-Behavior-R0.md 승인 | Inject → MC-PREDICT · MC-OBSERVE 습성 해금 |
| Layer 1 설계 문서 (계열별 상위 형태) | 여섯 CL-* 의 `transitions_to` 가 채워진다. 갈래는 여럿으로 정해졌으므로(Q69(b)) 계열마다 몇 갈래를 세울지가 그 문서의 첫 결정이다. 계열별 성장·스킬 세부 문서(백왕 구판 둘은 Human 이 철회 — HISTORY)도 새 판이 오면 여기로 온다 |
