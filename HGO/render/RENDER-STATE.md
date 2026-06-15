# RENDER-STATE — 살아있는 현재 (render 트랙)

> "지금 어느 렌즈까지 왔고 다음 렌즈는 무엇인가"의 **단일 진실 원천(SSOT)**.
> 렌즈 척추·입력 계약·author 금지선은 [RENDER.md](RENDER.md) · 시뮬 존재론은 [../SPINE.md](../SPINE.md) · 시뮬 현재는 [../atom/STATE.md](../atom/STATE.md).
>
> **구조 규칙(에이전트 효율)**: 고정 크기 대시보드. §1~5 는 렌즈 닫을 때마다 **덮어쓴다(rewrite)** — 누적 금지. 오직 §6 INDEX 만 **literal 1줄/렌즈** append. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 ⛔blocked(시뮬 선행).

---

## 1. NOW

- **닫힌 렌즈**: **렌즈-001 (L-λ)** — *광자가 색으로 빛난다.* atom 스냅샷(`sim.photons[].lambda`)을 읽어 가시광 스펙트럼 곡선으로 번역(`render/engine/spectral.js`). 짧은 λ=고에너지=보라 ↔ 긴 λ=저에너지=빨강 — 색을 author 하지 않고 λ 에서 읽음. 측정된 λ 범위를 가시광 창(400~700nm)에 로그 정규화(창은 데이터에서 *잼*). 그리기는 `render/engine/render.js` 가 구현, **단일 뷰어 `atom/viewer.html`** 이 그 모듈을 load 해 `draw()` 위임(별도 뷰어 없음 — SPINE §6.1).
- **한 줄 상태**: 트랙이 깨어났다 — 시뮬이 내보낸 빛(step-0002 방출)이 처음으로 *눈에 보이는 색*이 됐다. 원자는 어둑한 광원, 광자는 색 빛, 측정 스펙트럼선은 하단 띠로. 시뮬 코어 알리바이 성립(atom 엔진·STATE·steps·골든 diff 0; viewer.html 만 하네스 배선).
- **다음**: §2 — **L-line**(누적 스펙트럼 분광 띠) 또는 시뮬이 광자 방향을 내보내면 **L-recoil**.

---

## 2. NEXT

> 렌더는 시뮬과 직교 — 큰 호는 [RENDER.md](RENDER.md) §4 렌즈 로스터가 SSOT. 여기선 *다음 한 렌즈*만.

### 다음 렌즈 후보 (▶ 가능한 것만)

- **L-line (정제 — 즉시 가능)**: 누적 광자를 전이선별로 빈도 집계해 *실측 분광기 띠*(세기=해당 선 광자 수)로 그린다. 현재 `render.js` 스트립은 *유무*만 보임 → 세기·빈도까지. 새 시뮬 양 불필요(읽기 정제).
- **⛔ L-recoil (blocked)**: 광자에 진행 *방향*이 생겨야(시뮬이 p=E/c 운동량 반동을 내보낸 뒤 — atom STATE §2 후보 ②). 방향 없이 빛 줄기를 author 하지 말 것(연성 author 금지, RENDER §3).
- **⛔ L-T (blocked)**: 흑체 온도색은 시뮬이 *열/온도*를 의미 있게 굴린 뒤(현재 자유 운동만 — 온도가 정적). 속도→색은 atom 뷰어가 이미 함; 렌더는 *방출색*에 집중.

> **게이트 규율**: blocked 렌즈는 시뮬 선행 양이 atom 트랙에 실릴 때까지 시작하지 않는다. 그동안은 가능 칸(L-line)만.

---

## 3. OPEN GAPS — 열린 격차

| 마커 | 격차 | 상태 |
|---|---|---|
| ✅ | **빛이 안 보인다(시뮬은 방출하나 화면 0)** | 렌즈-001 해소 — λ→스펙트럼 색. 전문은 RENDER §4. |
| 🟡 | **스펙트럼 띠가 유무만(세기 없음)** | `render.js` 스트립이 선의 존재만 표시. L-line 이 빈도·세기로 정제. |
| ⛔ | **광자가 공간을 안 난다(방향·전파 없음)** | 시뮬이 광자를 정적 점으로만 둠(atom step-0002 한계). L-recoil/전파는 시뮬 선행. |
| ⬜ | **장면이 step-0002 하나뿐** | 빛 있는 장면이 하나. 시뮬이 새 발광 장면을 더하면 자동 노출(viewer 가 SCENES 읽음). |

---

## 4. DURABLE CONSTRAINTS — 모든 렌즈가 지킬 정전 사실

- **시뮬 알리바이**: 렌더 diff 는 `render/`(+ 스킬)에만. `atom/` 비변경 → 골든 해시 비트 불변. 커밋 전 `git status` 확인.
- **author 0**: 색·이펙트는 시뮬 양의 함수일 뿐(RENDER §3). 종류별 색 박기·없는 분포 합성 금지.
- **정규화는 측정**: 화면 창(λ→nm·속도→hue)은 데이터에서 *잰* 범위로. 손으로 박은 임계 금지.
- **읽기 전용 로드**: atom 엔진은 `require`/`<script src=../atom/...>` 로 *읽기만*. 시뮬 객체(atoms·photons)에 렌더 필드 쓰지 않음(섬광 등은 렌더 전용 병렬 배열).
- **한 커밋 = 한 렌즈**: 더 떠올라도 다음 렌즈로 전가.

---

## 5. 소유 / 불가침 (SPINE §7)

- **소유**: `render/` 폴더 (`RENDER.md` · `RENDER-STATE.md` · `engine/spectral.js` · `engine/render.js` · `validate/smoke.js`). **render 는 viewer.html 을 두지 않는다** — 단일 뷰어는 atom 소유.
- **불가침**: 시뮬 코어(`atom/engine/*`·`atom/STATE.md`·`atom/steps/*`·골든) · `../SPINE.md` · `../CLAUDE.md` — 읽기만. **예외**: `atom/viewer.html`(공유 하네스) 은 render 모듈 load 한 줄 배선만 허용(RENDER §6). 스킬은 `.claude/skills/hgo-render-step/`.

---

## 6. INDEX — 렌즈 검증 현황 (유일하게 append, **literal 1줄/렌즈**)

> 규칙: 한 행 = `렌즈 | 읽은 양→번역 | 통과 + 핵심 수치 1개`. *문단 금지* — 전문은 이 문서 아님(렌더는 step 문서 없음, 렌즈는 가볍다).

렌즈-001 (L-λ) | 광자 lambda → 가시광 스펙트럼 색 + 측정 스펙트럼 띠 (render.js 그리기, 단일 뷰어 atom/viewer.html 위임) | 스모크 PASS(광자 51·선 3·λ[1.333,20.571]·순서 보존) · 시뮬 코어 alibi diff 0 · 눈 검증 ⏳(사용자 브라우저)
