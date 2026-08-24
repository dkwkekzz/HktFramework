# View Backlog — VIEW 레인의 남은 할일

**살아 있는 문서다** — 아직 하지 않은 화면 작업만 담는다. 착수하면 상태에 V 번호를 적고,
닫히면 항목을 **지우고** 기록은 `works/V-NNN-<name>.md` 가 소유한다. 완료·경위를 여기
쌓지 않는다 (CLAUDE.md 원칙 20).

항목이 생기는 길은 셋이다 — 형식과 규칙은 guides/view-work.md 소유:

```text
주입      Human 이 지목한 UX 기획서(design/Design-View-*.md)를 번역해 쪼갠 것
직접      Human 이 그 자리에서 준 목표
이관      Cycle 08 이 "다음으로 넘기는 것" 으로 남긴 화면 몫 · V 작업 REPORT 의 후속
```

계약(`protocol/`)이나 세계(`world/`)를 요구하는 항목은 여기 올리지 않는다 —
그것은 VIEW 할일이 아니라 Frontier 재료다 (guides/works.md 레인 판정).

## 할일

주입 출처는 둘이다 — 문서마다 절을 나눈다.

    VUX-IE-D1   design/Design-View-Inventory-Equipment-UX-D1.md   가진 것을 다루는 화면
    VUX-SK-D1   design/Design-View-Skill-UX-D1.md                 기술을 걸고 읽는 화면

## 가진 것 (VUX-IE-D1)

주입 출처: `design/Design-View-Inventory-Equipment-UX-D1.md` (VUX-IE-D1).
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

### pointer-input — 손가락 자리를 몰라도 닿는다
    출처   UX 문서 §4.1
    목표   좌클릭으로 고르고, 더블클릭으로 되는 행동 하나가 실행되고,
           우클릭으로 그 물건의 행동 목록이 열린다
    크기   중간
    의존   **ENGINE** — 표면 능력이 지금 `onClose` 하나만 낸다
           (`engine/view-kernel/hud/surface.ts` · 조립도 그것만 잇는다). 칸을 눌러도
           아무 일이 없으므로 VIEW 만으로는 성립하지 않는다 (V-003 착수 전 확인)
    상태   BLOCKED — ENGINE 이 칸·줄의 눌림을 내보내야 열린다
    주     **줄은 손가락으로 닿지 않는다** — 기반의 표면 능력에서 칸만 button 이고
           줄은 div 다 (`engine/view-kernel/hud/surface.ts`). 행동 줄도 확인 구획의
           두 줄도 자판으로만 고를 수 있다 (V-002 REPORT ②) — ENGINE 동반이 필요할 수 있다

### request-feedback — 보낸 것과 일어난 것을 가른다
    출처   UX 문서 §4.3 · §7
    목표   보낸 뒤 1초가 지나면 처리 중이 보이고, 거절되면 세계가 준 사유가 그 자리에서
           읽히며, 성공은 값이 옮겨 가는 것으로 이어진다
    크기   작음
    의존   없음 — 기다림과 사유는 이미 실려 온다 (C009 Request.Outcome)
    상태   PROPOSED
    주     **기술 슬롯 띠도 같은 자리다** (VUX-SK-D1 §8). V-001 이 그중 둘을 이미 세웠다 —
           거절 사유가 그 칸에 붙고, 걸어 둔 것이 `요청 중` 으로 보인다.
           남은 것은 **1초 뒤에야 처리 중을 보이는 규칙**과 5초 뒤 연결 상태 안내다

### view-sort-filter-search — 많은 것 중에서 찾는다
    출처   UX 문서 §6 · §11 VUX-IE-04
    목표   분류로 거르고 표시 이름으로 찾고 보기 순서를 바꿔도 자리 수는 그대로이며,
           걸린 것이 없으면 "조건에 맞는 아이템 없음" 이 뜬다
    크기   중간
    의존   없음
    상태   PROPOSED
    주     세계가 소유하는 정렬과 계약이 주는 검색 태그는 여기 없다 —
           둘 다 계약에 없으므로 **보기 정렬**과 **표시 이름 검색**만이다

### slot-visual-language — 칸 하나가 스스로 말한다
    출처   UX 문서 §3
    목표   수량이 숫자와 배경 명암으로 함께 읽히고, 새로 얻은 것에 표식이 붙었다가
           상세를 보면 사라진다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     희귀도 테두리는 여기 없다 — 문서 자신이 "정보가 계약에 있을 때만" 으로 달았고
           계약에 없다

### tooltip-on-focus — 손이 없어도 설명이 열린다
    출처   UX 문서 §8
    목표   Tooltip 이 Hover 뿐 아니라 Focus 에서도 열리고 Esc 로 닫힌다
    크기   작음
    의존   없음
    상태   PROPOSED

### key-panel-pack-keys — 팩의 키도 안내 패널에 선다
    출처   V-003 REPORT ①
    목표   오른쪽 안내 패널에 가진 것(I) · 덜어내기(B) · 걸기(N) · 풀기(M) ·
           바꿔 걸기(,) 가 서고, 표에서 키를 옮기면 그 줄도 함께 옮겨진다
    크기   작음
    의존   **ENGINE** — 그 패널은 기반이 그린다 (`engine/view-kernel/hud/hud.ts` 가
           엔진 기본 넷 + `scene.interactions` 만 세운다). 팩이 줄을 실어 보낼 자리가 없다
    상태   BLOCKED — ENGINE 이 팩의 안내 줄을 받아야 열린다
    주     재료는 이미 있다 — `view/key-registry.ts` 가 코드·표기·`what`(사람이 읽는 이름)을
           전부 쥔다

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

주입 출처: `design/Design-View-Skill-UX-D1.md` (VUX-SK-D1).
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
    출처   UX 문서 §9 (포커스 순서 `대상 → Skill Bar → 상세 → 오버레이`)
    목표   Tab 으로 그 차례대로 옮겨 다니고, 슬롯에서 Enter 로 실행되며,
           표면을 닫으면 열기 전 자리로 돌아온다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     슬롯은 이미 button 이라 초점이 닿고 링이 그려진다 — 없는 것은 **정해진 차례**다
           (`tabindex` 0건). 차례를 세우는 자리가 기반이면 ENGINE 동반이 필요하다

### reduced-motion — 흔들림을 끄면 읽을 것이 남는다
    출처   UX 문서 §9 (애니메이션 감소 설정)
    목표   `prefers-reduced-motion` 에서 이동 Trail 과 화면 흔들림이 사라지고,
           그 자리를 위치 외곽선과 사건 줄 강조가 대신한다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     지금 걸린 것은 `.sf` transition 하나뿐이다 — 이펙트·Trail 은 대응이 없다

### touch-reason — 손가락으로 하는 사람도 왜 안 되는지 안다
    출처   UX 문서 §8 · §4.1
    목표   손가락 버튼 띠에서도 못 쓰는 것의 사유가 글자로 보인다
    크기   작음
    의존   없음 — 사유는 이미 실려 온다
    상태   PROPOSED
    주     그 띠를 그리는 것은 `engine/view-kernel/hud/touch-pad.ts` 다 (지금 `available`
           을 `data-` 속성으로만 쓴다) — **ENGINE 레인 동반이 필요할 수 있다**

### skill-bar-responsive — 좁은 폭에서 띠가 무너지지 않는다
    출처   UX 문서 §2.3
    목표   1100px 아래에서 슬롯 띠가 두 줄로 접히고, 어느 폭에서도 이름과 상태가
           잘리지 않는다
    크기   작음
    의존   없음
    상태   PROPOSED
    주     720px 미만은 문서가 지원 대상 밖으로 둔다
