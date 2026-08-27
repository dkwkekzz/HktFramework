# View Backlog — VIEW 레인의 남은 할일

**살아 있는 문서다** — 아직 하지 않은 화면 작업만 담는다. 착수하면 상태에 V 번호를 적고,
닫히면 항목을 **지우고** 기록은 `works/V-NNN-<name>.md` 가 소유한다. 완료·경위를 여기
쌓지 않는다 (CLAUDE.md 원칙 20).

항목이 생기는 길은 셋이다 — 형식과 규칙은 guides/view-work.md 소유:

```text
주입      Human 이 지목한 UX 기획서(content/proto-adventure/design/Design-View-*.md)를 번역해 쪼갠 것
직접      Human 이 그 자리에서 준 목표
이관      Cycle 08 이 "다음으로 넘기는 것" 으로 남긴 화면 몫 · V 작업 REPORT 의 후속
```

계약(`protocol/`)이나 세계(`world/`)를 요구하는 항목은 여기 올리지 않는다 —
그것은 VIEW 할일이 아니라 Frontier 재료다 (guides/works.md 레인 판정).

## 할일

주입 출처는 둘이다 — 문서마다 절을 나눈다.

    VUX-IE-D1   content/proto-adventure/design/Design-View-Inventory-Equipment-UX-D1.md   가진 것을 다루는 화면
    VUX-SK-D1   content/proto-adventure/design/Design-View-Skill-UX-D1.md                 기술을 걸고 읽는 화면

## 가진 것 (VUX-IE-D1)

주입 출처: `content/proto-adventure/design/Design-View-Inventory-Equipment-UX-D1.md` (VUX-IE-D1).
그 문서의 §11 이 다섯으로 쪼갠 것 중 **첫째(VUX-IE-01 가방을 연다)는 C026 으로 닫혔다.**
아래는 그 문서에 남아 있는 화면 요구를 번역한 것이며, 순서는 §11 의 권장 순서를 따른다.

**계약·세계를 요구하는 요구사항은 여기 없다** — 미리보기 · 자리 사이 이동 · 겹친 묶음
나누기 · 세계 정렬 · 희귀도 · 검색 태그. 그 여섯은 Frontier 재료이며 이 파일의 몫이
아니다 (guides/works.md 레인 판정 · 주입 보고).

### panels-do-not-overlap — 패널이 서로 위에 포개지지 않는다
    출처   C-TERRAIN-002 08 "못 한 것" ① (Cycle 이관)
    목표   디버그 패널과 self 패널이 겹쳐 글자가 포개지는 것을 없앤다.
           작은 화면(560×420)에서 특히 심하다 — 두 Cycle 의 검증 그림이 모두 그렇다.
    크기   보통
    의존   **기반 동반** — 패널의 자리와 겹침은 `engine/view-kernel/hud/hud.ts` 가
           소유한다 (`hud-panel` · `hud-self` · `hud-linkpanel` 의 배치). 팩의 `view/` 는
           무엇을 어떤 글자로 낼지만 정하고 어디에 놓을지는 정하지 않는다
    비고   Cycle 이 만든 문제가 아니다. C-TERRAIN-001 의 그림도 같았고, 이제 땅의 줄이
           늘어 더 눈에 걸린다. 관찰은 이미 다 와 있고 **읽기가 막힌 것**이다.
           **처음 이 항목을 "의존 없음" 으로 적은 것은 틀렸다** — 코드를 짚어 보니
           자리 잡기가 기반 소유였다. ENGINE 의 ② (겹침 표면의 자리 잡기)와 같은 자리다
    상태   PROPOSED

### escape-leaves-the-field — 글자 자리에서 나오는 길
    출처   V-013 REPORT ② · UX 문서 §2.1 · §8
    목표   이름 칸에 초점이 있어도 `Esc` 가 그 자리를 빠져나가거나 표면을 닫는다
    크기   아주 작음
    의존   **기반 동반** — 겹침 표면이 `INPUT` 에서 Escape 를 비켜 주고, 비켜 준 것을
           받는 자리가 없다 (`engine/view-kernel/hud/surface.ts`)
    상태   PROPOSED

### tip-flip-at-the-edge — 곁말이 가장자리에서 접힌다
    출처   V-011 REPORT ②
    목표   격자의 마지막 줄에서도 곁말이 잘리지 않고 반대 방향으로 접힌다
    크기   아주 작음
    의존   **기반 동반** — 어느 쪽이 남았는지 재는 일은 겹침 표면 능력의 몫이다
    상태   PROPOSED

### workspace-two-columns — 장비와 가방이 나란히 놓인다
    출처   UX 문서 §2.2 · §2.3 · V-012 REPORT ②
    목표   1100px 이상에서 걸어 둔 것과 지닌 것이 좌우 두 열로 서고, 어느 폭에서도
           구획의 차례(도구 → 장비 → 가방 → 상세)가 흐트러지지 않는다
    크기   작음
    의존   **기반 동반** — 겹침 표면 능력이 구획을 세로로만 쌓는다.
           나란히 놓는 일은 그 능력의 몫이다
    상태   PROPOSED

### drag-and-drop — 끌어다 놓는다
    출처   UX 문서 §4.2 · §11 VUX-IE-03
    목표   물건을 자리로 끌어다 놓으면 걸리고, 화면 밖에 놓는 것은 버리기가 아니라
           취소이며, 가능한 자리만 강조되되 최종 판정은 세계가 한다
    크기   중간
    의존   없음 — 놓을 자리가 화면에 섰다 (V-012)
    상태   PROPOSED
    주     가방 자리 사이의 이동은 여기 없다 — 세계에 번호 붙은 자리가 없다

### responsive-workspace — 좁은 폭에서도 무너지지 않는다
    출처   UX 문서 §2.3
    목표   1100px 아래에서 장비와 가방이 탭으로 접히고 상세가 옆에서 열리며,
           어느 폭에서도 행동과 사유가 잘리지 않는다
    크기   작음
    의존   workspace-two-columns — 접을 두 열이 먼저 서야 한다
    상태   PROPOSED
    주     720px 미만은 문서가 지원 대상 밖으로 둔다

### contrast-and-zoom — 읽을 수 있게 남는다
    출처   UX 문서 §8
    목표   본문과 배경이 WCAG AA 대비를 넘고, 200% 확대에서 행동 버튼과 상세가
           겹치거나 잘리지 않는다
    크기   작음
    의존   없음
    상태   PROPOSED

### gamepad-input — 패드로도 같은 의미에 닿는다
    출처   UX 문서 §4.1 (Gamepad 열)
    목표   D-pad/Stick 으로 고르고 A/X/Y/B 로 같은 의미 행동이 실행된다
    크기   중간
    의존   **눈검증 수단** — 패드 없이는 목표 문장을 확인할 수 없다
    상태   PROPOSED

## 기술 (VUX-SK-D1)

주입 출처: `content/proto-adventure/design/Design-View-Skill-UX-D1.md` (VUX-SK-D1).
그 문서 §13 이 다섯으로 쪼갠 것 중 **첫째(VUX-SK-01 지금 쓸 Skill 과 사유를 읽고
하나를 실행한다)는 V-001 로 닫혔다.** 아래는 그 문서에 남아 있는 화면 요구의 번역이다.

**계약·세계를 요구하는 요구사항은 여기 없다** — 조준(Anchor 넷) · 복합 Activation
(Cast·Charge·Hold·Combo·Toggle) · Spatial Presence · 재사용 대기 · 한 실행을 묶는
`executionId`. 그 다섯은 세계에 개념 자체가 없어(`grep` 0건) Frontier 재료이며
이 파일의 몫이 아니다 (근거: `works/V-001-what-you-can-do-and-why-not.md` REPORT ①~⑤).

### skill-activation-progress — 거는 동안 어디쯤인지 보인다
    출처   UX 문서 §5 · §3 (하단 진행 표시)
    목표   기술을 거는 동안 그 칸에서 준비·나가는 중·마무리가 갈려 보이고,
           끝나면 표시가 사라진다
    크기   작음
    의존   없음 — `entities[].actionPhase`(startup·active·recovery)와 `progress` 가
           이미 실려 온다 (C019)
    상태   PROPOSED
    주     복합 Activation(Cast·Charge·Hold·Combo·Toggle)은 여기 없다 — 세계에 없다.
           **이 항목은 §5 중 지금 세계로 참인 부분만**이다

### skill-execution-log — 방금 무슨 일이 있었는지 되짚는다
    출처   UX 문서 §2.2 · §7 · §12 · §13 VUX-SK-05
    목표   겹쳐 뜨는 표면에서 최근 타격·무산·끊김이 시간순으로 서고, 한 줄을 고르면
           그 대상별 피해 산정 경위가 읽힌다
    크기   중간
    의존   겹침 표면 capability (있음 — `engine/view-kernel/hud/surface.ts`)
    상태   PROPOSED
    주     **실행 묶음 Tree 는 여기 없다.** `executionId` 가 계약에 없어 "이 타격들이
           한 번의 실행이다" 를 화면이 만들 수 없다 (V-001 REPORT ⑤).
           개별 사건은 이미 전부 온다 — `strikes` · `contacts` · `cancels` · `breakdown`

### skill-slot-icon — 글자를 읽지 않고도 칸이 갈린다
    출처   UX 문서 §3 (중앙: Skill 표현)
    목표   칸마다 그 기술을 나타내는 표식이 서고, 표에 없는 기술은 일반 표식으로
           서되 칸이 사라지지 않는다
    크기   아주 작음
    의존   없음 — 무엇으로 그릴지는 화면의 결정이다 (`interaction-presentation`)
    상태   PROPOSED

### skill-focus-order — 자판만으로 고르고 실행한다
    출처   UX 문서 §9 (포커스 순서 `대상 → Skill Bar → 상세 → 오버레이`) · V-009 REPORT ①
    목표   Tab 으로 그 차례대로 옮겨 다니고, 슬롯에서 Enter 로 실행되며,
           표면을 닫으면 열기 전 자리로 돌아온다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     슬롯은 이미 button 이라 초점이 닿고 링이 그려진다 — 없는 것은 **정해진 차례**다
           (`tabindex` 0건). 차례를 세우는 자리가 기반이면 ENGINE 동반이 필요하다.
           V-009 가 같은 자리를 다시 짚었다 — 겹침 표면의 글자 자리에 Tab 으로는 한 번에
           닿지 못한다 (지금은 `L` 이 지름길이며, 차례가 서면 그것은 지름길로 남는다)

### reduced-motion — 흔들림을 끄면 읽을 것이 남는다
    출처   UX 문서 §9 (애니메이션 감소 설정)
    목표   `prefers-reduced-motion` 에서 이동 Trail 과 화면 흔들림이 사라지고,
           그 자리를 위치 외곽선과 사건 줄 강조가 대신한다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     지금 걸린 것은 `.sf` transition 하나뿐이다 — 이펙트·Trail 은 대응이 없다

### skill-bar-responsive — 좁은 폭에서 띠가 무너지지 않는다
    출처   UX 문서 §2.3 · V-006 REPORT
    목표   1100px 아래에서 슬롯 띠가 두 줄로 접히고, 어느 폭에서도 이름과 상태가
           잘리지 않으며, 손가락 버튼 띠와 같은 자리를 다투지 않는다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     720px 미만은 문서가 지원 대상 밖으로 둔다.
           V-006 이 480×900 에서 **손가락 버튼 띠와 기술 슬롯 띠가 겹치는 것**을 보았다

## 전투 (이관 — C-COMBAT-001)

이관 출처: `cycles/C-COMBAT-001-where-your-power-sits/08-verification.md` 의
"HUMAN PLAY 보조". 둘 다 세계도 계약도 요구하지 않는다 — 세계는 넷과 그 몫·가부·사유를
이미 보내고 있고, 화면이 그것을 **어디에 어떻게 두는가**만 남았다.

### allocation-armed-shows — 두 걸음의 첫 걸음이 화면에 남는다
    출처   C-COMBAT-001 08 HUMAN PLAY 보조 ①
    목표   `U`(또는 B·N·M·,)를 누른 뒤 "지금 무엇의 번호를 기다리는 중인지" 가
           화면에 서고, 다시 누르거나 `Esc` 로 물러나면 사라진다
    크기   작음
    의존   없음 — `view/bindings.ts` 가 `armedAction()` 을 이미 내보내고 있다.
           지금 그것을 읽는 자리가 팩에 하나도 없다 (검색 0건)
    상태   PROPOSED
    주     배분만의 문제가 아니다 — B·N·M·, 가 같은 얼개이며 C026 의 주석이 이미
           같은 결손을 적어 두었다 (소지품은 `I` 표면으로 메웠고 배분에는 그 자리가 없다).
           **표면을 하나 더 여는 것이 유일한 답은 아니다** — 지름길은 지름길로 남기고
           걸린 상태만 보이면 된다

### allocation-list-crowds-the-top — 배분 넷이 위 패널을 삼키지 않는다
    출처   C-COMBAT-001 08 HUMAN PLAY 보조 ②
    목표   배분 넷이 서 있어도 위 패널의 나머지(고른 대상 · 걸린 것 · 자리 · 소지품 ·
           행동 · 세계 시간 · 함께)가 배분 뒤로 밀리지 않는다
    크기   작음
    의존   없음 — 무엇을 어디에 둘지는 결정 Layer 의 몫이다
           (`view/allocation-presentation.ts` · `view/hud-presentation.ts`)
    상태   PROPOSED
    주     실측(1440×900): 넷의 폭 합 1480px · 패널 폭 1400px → 두 줄을 채우고
           패널이 세 줄(y 23 · 54 · 85)로 선다. 글자 17px 로 본문보다 크다.
           **넷을 줄이는 것은 답이 아니다** — 못 가는 것도 사유와 함께 실려야 한다
           (04 allocations.meaning · DC-WORLD-OWNS-THE-SURFACE-LIST)

## 성장 (이관 — C-GROWTH-001)

이관 출처: `cycles/C-GROWTH-001-what-you-did-makes-you/07-view-implementation.md` 의
NOTES · 08 의 "Works 로 넘긴 화면 몫". 둘 다 세계도 계약도 요구하지 않는다 —
세계는 이미 보내고 있고, 화면이 그것을 **어떻게 보이게 하는가**만 남았다.

### growth-cause-in-the-breakdown — 자란 몫이 한 방의 경위에 실린다
    출처   C-GROWTH-001 07 NOTES · 08 Works 로 넘긴 화면 몫 ①
    목표   속성 관찰(`inspect`)을 켰을 때 타격 경위 줄에 배분의 몫과 나란히
           **단계가 보탠 몫**이 읽힌다 — "이 한 방이 왜 22 인가" 가 한 줄에서 닫힌다
    크기   작음
    의존   없음 — **세계는 이미 보내고 있다** (`strikes[].breakdown.*.fromGrowth`).
           관찰 계약을 넓힐 필요가 없으므로 온전히 VIEW 레인의 일이다
    상태   PROPOSED
    주     지금 경위 줄이 이미 길다. 배분의 몫과 자란 몫을 그냥 나란히 쓰면 한 줄이
           두 줄이 되므로, 0 인 항을 접는 규칙이 함께 필요하다

### growth-step-is-a-moment — 오른 순간이 눈에 걸린다
    출처   C-GROWTH-001 07 NOTES · 08 Works 로 넘긴 화면 몫 ②
    목표   단계가 오른 순간이 놓치기 어렵게 보인다 — 지금은 self 패널의 줄 하나가
           1.2초 서 있다 사라지므로, 싸우는 중에는 그 순간을 지나치기 쉽다
    크기   작음
    의존   없음 — 판정은 이미 있다 (`view/growth-presentation.ts` 의 `justLeveled`)
    상태   PROPOSED
    주     이펙트로 갈 경우 **예산 일곱 중 무엇을 뺄지 함께 정한다** (F1 규칙 ③).
           이펙트가 아니어도 된다 — 줄의 강조나 토스트도 같은 문을 쓴다
