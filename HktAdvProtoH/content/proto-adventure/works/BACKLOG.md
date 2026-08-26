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

### equipment-panel — 걸어 둔 것을 같은 자리에서 본다
    출처   UX 문서 §2.2 · §11 VUX-IE-02
    목표   작업 공간 안에서 걸어 둔 여섯 자리와 지닌 것이 나란히 갈라져 보이고,
           자리를 골라 걸고 풀 수 있다
    크기   중간
    의존   없음 — equipment 관찰이 이미 실려 온다 (C023)
    상태   PROPOSED

### slot-key-hint — 칸이 자기 번호를 지닌다
    출처   UX 문서 §3 (우상: 장착 중 표식 또는 입력 힌트) · V-010 REPORT ①
    목표   작업 공간의 물건 칸에도 부르는 번호가 붙어, 두 걸음 지름길(`B` → 번호)이
           그 자리에서 읽힌다
    크기   아주 작음
    의존   없음 — 번호는 `view/key-registry.ts` 의 `SLOT_KEY_LABELS` 가 이미 낸다
    상태   PROPOSED
    주     `장착 중` 표식은 여기 없다 — 걸린 것은 가방에서 빠지므로 중복 표시할 것이
           없다 (문서의 P4 와 같은 결론). 희귀도 테두리도 여기 없다 — 계약에 없다

### tip-flip-at-the-edge — 곁말이 가장자리에서 접힌다
    출처   V-011 REPORT ②
    목표   격자의 마지막 줄에서도 곁말이 잘리지 않고 반대 방향으로 접힌다
    크기   아주 작음
    의존   **기반 동반** — 어느 쪽이 남았는지 재는 일은 겹침 표면 능력의 몫이다
    상태   PROPOSED

### drag-and-drop — 끌어다 놓는다
    출처   UX 문서 §4.2 · §11 VUX-IE-03
    목표   물건을 자리로 끌어다 놓으면 걸리고, 화면 밖에 놓는 것은 버리기가 아니라
           취소이며, 가능한 자리만 강조되되 최종 판정은 세계가 한다
    크기   중간
    의존   equipment-panel — 놓을 자리가 화면에 있어야 한다
    상태   PROPOSED
    주     가방 자리 사이의 이동은 여기 없다 — 세계에 번호 붙은 자리가 없다

### responsive-workspace — 좁은 폭에서도 무너지지 않는다
    출처   UX 문서 §2.3
    목표   1100px 아래에서 장비와 가방이 탭으로 접히고 상세가 옆에서 열리며,
           어느 폭에서도 행동과 사유가 잘리지 않는다
    크기   작음
    의존   equipment-panel — 접을 두 열이 있어야 한다
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
