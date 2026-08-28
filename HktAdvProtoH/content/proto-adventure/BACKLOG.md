# View Backlog — VIEW 레인의 남은 할일

**살아 있는 문서다** — 아직 하지 않은 화면 작업과 관찰 결손 REPORT 만 담는다.
착수하면 상태를 IN PROGRESS 로, 닫히면 항목을 **지운다** — 완료의 기록은 커밋이다
(`HktAdvProtoH: VIEW <슬러그> — …`). 완료·경위를 여기 쌓지 않는다 (CLAUDE.md 원칙 20).

항목이 생기는 길은 셋이다 — 형식과 규칙은 guides/view-work.md 소유:

```text
주입      Human 이 지목한 UX 기획서(content/proto-adventure/design/Design-View-*.md)를 번역해 쪼갠 것
직접      Human 이 그 자리에서 준 목표
이관      Cycle 08 이 "다음으로 넘기는 것" 으로 남긴 화면 몫 · 아래 REPORT 의 후속
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

### drag-and-drop — 끌어다 놓는다
    출처   UX 문서 §4.2 · §11 VUX-IE-03
    목표   물건을 자리로 끌어다 놓으면 걸리고, 화면 밖에 놓는 것은 버리기가 아니라
           취소이며, 가능한 자리만 강조되되 최종 판정은 세계가 한다
    크기   중간
    의존   **기반 동반** — 겹침 표면 능력에 끌기·놓기가 없다 (`SurfaceHandlers` 에
           `onDrag`·`onDrop` 0건). 팩은 칸의 마디를 만지지 못하므로 화면에 놓을 자리가
           서 있는 것만으로는 성립하지 않는다 (V-018 세션이 코드로 쟀다)
    상태   PROPOSED
    주     가방 자리 사이의 이동은 여기 없다 — 세계에 번호 붙은 자리가 없다

### responsive-workspace — 좁은 폭에서도 무너지지 않는다
    출처   UX 문서 §2.3
    목표   1100px 아래에서 장비와 가방이 탭으로 접히고 상세가 옆에서 열리며,
           어느 폭에서도 행동과 사유가 잘리지 않는다
    크기   작음
    의존   **기반 동반** — 접을 두 열은 섰지만(V-017) `1100px 아래에서` 를 팩이 알 수 없다.
           결정 Layer 에 화면 폭이 오지 않는다 (`innerWidth`·`matchMedia` 0건) —
           폭으로 갈리는 일은 그리는 쪽(CSS)의 몫이다
    상태   PROPOSED
    주     720px 미만은 문서가 지원 대상 밖으로 둔다.
           **접히는 자리를 이 항목이 정한다** — 지금은 창 폭 1013~1100 사이에서
           접힌다 (V-017 REPORT ①). 문서의 1100 에 맞출지, 지금의 수를 그대로 둘지

### contrast-and-zoom — 읽을 수 있게 남는다
    출처   UX 문서 §8
    목표   본문과 배경이 WCAG AA 대비를 넘고, 200% 확대에서 행동 버튼과 상세가
           겹치거나 잘리지 않는다
    크기   작음
    의존   **기반 동반(대부분)** — 표면·HUD 의 색과 배경은 `index.html` 의 그리기 규칙이
           지닌다. 팩이 쥔 색은 셋뿐이다 (`sprites` · `terrain-presentation` · `swing-presentation`)
    상태   PROPOSED

### escape-hint-in-the-field — 글자 자리에서 `Esc` 가 무엇을 하는지 말한다
    출처   V-015 REPORT ①
    목표   캐럿이 이름 칸에 있는 동안 안내 줄이 `닫기 Esc` 대신 그 자리에서 참인 말을
           보인다 (`Esc` 는 먼저 이 자리를 빠져나온다)
    크기   아주 작음
    의존   **기반 동반** — 팩은 캐럿이 지금 그 자리에 있는지 알 수 없다. 쥔 것은
           "한 프레임 전에 청했다"(`claimFocus`)뿐이다. 겹침 표면 능력이 칸·줄의
           초점은 되돌려 알리지만(`onFocusCell` · `onFocusRow`) 글자 자리는 알리지 않는다
    상태   PROPOSED
    주     세계 관찰의 결손이 아니다 — Frontier 재료가 아니라 ENGINE 레인의 일이다.
           그만한 값어치가 있는지는 Human 판단 대기

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
이 파일의 몫이 아니다 (근거: V-001 REPORT ①~⑤ — git 이력).

### skill-activation-progress — 거는 동안 어디쯤인지 보인다
    출처   UX 문서 §5 · §3 (하단 진행 표시)
    목표   기술을 거는 동안 그 칸에서 준비·나가는 중·마무리가 갈려 보이고,
           끝나면 표시가 사라진다
    크기   작음
    의존   **계약** — 구간은 `entities[].actionPhase` 에만 있고 **어느 기술의 구간인지**를
           말하는 값이 없다 (`interactions[]` 에 phase 0건). 몸의 구간을 마지막으로 부른
           기술에 붙이는 것은 화면의 짐작이다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
           그리고 `phase-presentation` 의 결정 2 가 **판정·후딜에는 아무것도 붙이지
           않는다**고 이미 정해 두었다 — 그 결정을 뒤집을지가 이 항목의 앞선 물음이다.
           Frontier 재료다 (V-018 세션이 코드로 쟀다)
    상태   PROPOSED
    주     복합 Activation(Cast·Charge·Hold·Combo·Toggle)은 여기 없다 — 세계에 없다.
           **이 항목은 §5 중 지금 세계로 참인 부분만**이다

### skill-focus-order — 자판만으로 고르고 실행한다
    출처   UX 문서 §9 (포커스 순서 `대상 → Skill Bar → 상세 → 오버레이`) · V-009 REPORT ①
    목표   Tab 으로 그 차례대로 옮겨 다니고, 슬롯에서 Enter 로 실행되며,
           표면을 닫으면 열기 전 자리로 돌아온다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     **표면 안의 차례는 섰다** — 기반이 Tab 을 표면 안에서 감고(무리마다 한 자리),
           실려 온 초점이 곧 브라우저의 초점이며, 표면을 닫으면 열기 전 자리로 돌아온다.
           `L` 은 이제 지름길로 남는다 (V-009 가 짚은 자리는 닫혔다).
           남은 것은 표면 **밖**의 차례(`대상 → Skill Bar → 상세 → 오버레이`)와,
           칸·줄에서 `Enter` 가 그 자리를 누르는 길이다. 뒤엣것은 지금 팩의 `invoke`
           바인딩이 하며 링과 같은 자리를 가리키지만, Tab 으로 링과 다른 자리에 서 있을
           때는 갈라진다 — 기반이 `onFocusCell` · `onFocusRow` 로 그 옮김을 알려 주므로
           팩이 링을 따라 옮길지 여기서 정한다

### reduced-motion — 흔들림을 끄면 읽을 것이 남는다
    출처   UX 문서 §9 (애니메이션 감소 설정)
    목표   `prefers-reduced-motion` 에서 이동 Trail 과 화면 흔들림이 사라지고,
           그 자리를 위치 외곽선과 사건 줄 강조가 대신한다
    크기   작음
    의존   **기반 동반** — `prefers-reduced-motion` 은 매체 질의이고 팩은 그것을 읽지 못한다
           (`matchMedia` 0건). Trail 은 팩과 기반 양쪽에 있으나 켜고 끄는 판단이 그리는 쪽이다
    상태   PROPOSED
    주     지금 걸린 것은 `.sf` transition 하나뿐이다 — 이펙트·Trail 은 대응이 없다

### skill-bar-responsive — 좁은 폭에서 띠가 무너지지 않는다
    출처   UX 문서 §2.3 · V-006 REPORT
    목표   1100px 아래에서 슬롯 띠가 두 줄로 접히고, 어느 폭에서도 이름과 상태가
           잘리지 않으며, 손가락 버튼 띠와 같은 자리를 다투지 않는다
    크기   작음
    의존   **기반 동반** — 슬롯 띠의 배치는 `index.html` 의 그리기 규칙이 지니고,
           팩은 화면 폭을 알지 못한다 (위 `responsive-workspace` 와 같은 사유)
    상태   PROPOSED
    주     720px 미만은 문서가 지원 대상 밖으로 둔다.
           V-006 이 480×900 에서 **손가락 버튼 띠와 기술 슬롯 띠가 겹치는 것**을 보았다

## 전투 (이관 — C-COMBAT-001)

이관 출처: `cycles/C-COMBAT-001-where-your-power-sits/08-verification.md` 의
"HUMAN PLAY 보조". 둘 다 세계도 계약도 요구하지 않는다 — 세계는 넷과 그 몫·가부·사유를
이미 보내고 있고, 화면이 그것을 **어디에 어떻게 두는가**만 남았다.

### exchange-second-step-shows — 바꿔 걸기의 둘째 걸음이 보인다
    출처   V-020 검증에서 재현하지 못한 갈래
    목표   `,` 로 물건을 고른 뒤 걸린 줄이 `바꿔 걸기 — <물건> · 자리 번호를 누른다` 로
           바뀌는 것이 화면에서 확인된다
    크기   아주 작음
    의존   없음 — 코드는 섰다 (`armed-presentation.ts`). **검증만 남았다**
    상태   PROPOSED
    주     이 갈래는 아직 아무 검증도 받지 못했다 (눈으로도 검사로도).
           소지품 표면을 거치지 않는 지름길 순서를 재현할 길을 함께 찾는다

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

## 전투 사정 (이관 — C-COMBAT-003)

이관 출처: `cycles/C-COMBAT-003-the-world-decides-what-is-possible/07-view-implementation.md`
NOTES ③ · 08 의 "VIEW 레인으로 넘기는 것". 세계도 계약도 요구하지 않는다 —
세계는 이미 보내고 있고, 화면이 그것을 **어떻게 펼쳐 보이게 하는가**만 남았다.

### condition-in-the-breakdown — 참인 사정이 한 방의 경위에 실린다
    출처   C-COMBAT-003 07 NOTES ③ · 08 VIEW 레인으로 넘기는 것
           C-COMBAT-004 07 NOTES ⑤ — 그 목록에 표식이 하나 더 늘었다 (조건 셋)
    목표   떠오르는 타격 결과의 경위에서 "이 한 방이 왜 76 인가" 가 닫힌다 —
           어느 사정이 참이어서 계수가 얼마나 커졌는지가 읽힌다
    크기   작음
    의존   없음 — **세계는 이미 보내고 있다** (`strikes[].breakdown.conditions`).
           관찰 계약을 넓힐 필요가 없으므로 온전히 VIEW 레인의 일이다
    상태   PROPOSED
    주     `growth-cause-in-the-breakdown` 과 **같은 줄에서 만난다.** 그 줄은 이미
           방식 · 관통 · 치명 · 막기 · 배분을 지고 있어, 셋째 항을 그냥 더하면 C025 가
           띠에서 겪은 실패(한 줄이 세 배로 길어짐)를 결과 표시에서 되풀이한다.
           **둘을 함께 잡고 0 인 항을 접는 규칙을 한 번에 세우는 것**이 값이 싸다

### skill-slot-crowds-the-keyboard — 기술이 늘수록 부를 자리가 없다
    출처   C-COMBAT-003 07 INPUT → ACTION REQUEST · 08 Master Gap ③
           C-COMBAT-004 08 Master Gap ② — **시한이 왔다**
    목표   기술을 부르는 데 글자 키 하나씩을 쓰지 않는다 — 띠의 칸을 숫자로 부르거나,
           그에 준하는 길이 선다
    크기   보통
    의존   없음 (띠는 이미 눌러서 부를 수 있다 — C025). 다만 `skill-focus-order` 와
           같은 자리를 건드리므로 **그것과 함께 잡는다**
    상태   PROPOSED
    주     기반이 W·A·S·D·화살표·Z·X·R·T·C·V·`/` 를, 팩이
           E·F·G·H·Q·Y·B·N·M·I·U·J·K·L·Shift 를 쓴다.
           C-COMBAT-003 이 `O` 를, C-COMBAT-004 가 `P` 를 썼다 — **글자 키가 남지 않았다.**
           사슬 B 에 후보 셋이 남았고 그중 계약은 조작이 둘 이상일 수 있으므로,
           **다음 Cycle 은 키 없는 기술을 세운다.** 막힘은 아니다 (띠는 눌러서도
           부른다 — C025) 그러나 시한은 지났다

## 관찰 결손 REPORT

VIEW 작업이 발견한 **세계 관찰의 결손** — 무엇이 안 실려 와서 무엇을 못 보여줬는가
(항목당 2~4줄 · 출처 슬러그). Human 판단 대기이며, 진짜면 다음 NEXT 가 Frontier
후보 재료로 소비하고 그 자리에서 지운다. 지금 항목 없음.
