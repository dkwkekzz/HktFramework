# RENDER-STATE — 살아있는 현재 (render 트랙)

> "지금 어느 렌즈까지 왔고 다음 렌즈는 무엇인가"의 **단일 진실 원천(SSOT)**.
> 렌즈 척추·입력 계약·author 금지선은 [RENDER.md](RENDER.md) · 시뮬 존재론은 [../SPINE.md](../SPINE.md) · 시뮬 현재는 [../atom/STATE.md](../atom/STATE.md).
>
> **구조 규칙(에이전트 효율)**: 고정 크기 대시보드. §1~5 는 렌즈 닫을 때마다 **덮어쓴다(rewrite)** — 누적 금지. 오직 §6 INDEX 만 **literal 1줄/렌즈** append. 마커: ✅해소 🟡부분 🔴열림 ⬜백로그 ⛔blocked(시뮬 선행).

---

## 1. NOW

- **닫힌 렌즈**: **렌즈-005 (L-recoil)** — *빛이 어디로 가는지 본다.* 게이트 해제: atom 트랙이 step-0003(recoil, p=E/c)·step-0004(propagate, 운동량 방향 직진)를 실어 광자가 *진행 방향*(`px,py`)을 내보낸다 → blocked 해제. 렌더가 그 운동량을 *읽어* **빛 줄기(이방성)**로: 줄기 방향=운동량 방향, 길이∝`|p|/maxP`(측정 정규화). `measureMaxMomentum`·`photonStreak(p,cam,maxP,worldLen)`(순수·헤드리스 검증) + `drawPhoton` 이 머리(밝음)→자취(투명) 그라디언트 줄기. **px=py=0 광자(방출만 한 step-0002)는 방향이 없어 줄기 author 0**(점만). (직전 **렌즈-004 L-line**: 분광 띠 세기 정제 — 눈 검증 ⏳.)
- **한 줄 상태**: 광자가 *날아가는 방향*으로 빛 줄기가 늘어난다(운동량 큰 광자는 긴 줄기) — propagate 장면에서 빛의 흐름이 보인다. 방향은 시뮬이 내보낸 px,py 를 읽을 뿐(연성 author 0). 알리바이 성립(**atom/ diff 0** — diff 는 `render/`(engine·validate)만).
- **다음**: §2 — 가능 정제 칸 소진. 다음 author 없는 렌즈는 시뮬 선행 대기(흡수·전파 트레일 누적, 온도/열, 결합).

---

## 2. NEXT

> 렌더는 시뮬과 직교 — 큰 호는 [RENDER.md](RENDER.md) §4 렌즈 로스터가 SSOT. 여기선 *다음 한 렌즈*만.

### 다음 렌즈 후보 (▶ 가능한 것만)

- **L-recoil — ✅ 렌즈-005 닫힘**: 운동량(px,py) → 빛 줄기. 후속 정제 여지: *전파 트레일*(출생 rx0,ry0→현 위치 전체 자취 — 이미 데이터 있음, 단 광자 무한 누적(atom 🔴)이 정리된 뒤라야 줄기가 안 폭주) · 도플러 색이동 시각화.
- **L-line (정제) — ✅ 렌즈-004 닫힘**: 전이선별 빈도 집계 완료. 후속: 선폭(도플러/자연폭)·로그 세기축 — 시뮬이 그 양을 내보낸 뒤.
- **⛔ L-T (blocked)**: 흑체 온도색은 시뮬이 *열/온도*를 의미 있게 굴린 뒤(현재 자유 운동만 — 온도가 정적). 속도→색은 atom 뷰어가 이미 함; 렌더는 *방출색*에 집중.
- **⛔ L-bond (blocked)**: 결합(연결 성분) → 분자 윤곽. 시뮬이 쿨롱·결합(Phase C)을 실은 뒤.

> **게이트 규율**: 즉시 가능 정제 칸(L-line 빈도·L-recoil 방향)을 모두 소진. 남은 렌즈(L-T 온도·L-bond 결합, L-recoil 트레일)는 *시뮬 선행*을 기다린다 — 근사 author 금지(RENDER §3). atom 트랙이 광자 소멸(step-0007)·열·결합을 실으면 그때 깬다.

---

## 3. OPEN GAPS — 열린 격차

| 마커 | 격차 | 상태 |
|---|---|---|
| ✅ | **빛이 안 보인다(시뮬은 방출하나 화면 0)** | 렌즈-001 해소 — λ→스펙트럼 색. 전문은 RENDER §4. |
| ✅ | **세계가 평면뿐(입체감 0)** | 렌즈-002 해소 — 평면 z=0 세계를 원근 3D 무대로(음영 구·궤도 카메라·바닥 격자). z author 0. 눈 검증 PASS. |
| ✅ | **카메라가 고정(자동 선회뿐, 시점 조절 불가)** | 렌즈-003 해소 — 마우스 인터랙티브 카메라(드래그 회전·휠 줌·우/Shift드래그 팬). `camState`+`attachControls`. |
| ✅ | **스펙트럼 띠가 유무만(세기 없음)** | 렌즈-004 해소 — `measureLines` 가 전이선별 빈도 집계, 밝기=빈도/maxCount(측정 정규화). 강한 전이=밝고 약한 전이=흐리게. |
| ✅ | **광자가 공간을 안 난다(방향·전파 없음)** | 렌즈-005 해소 — atom step-0003 recoil·0004 propagate 가 운동량(px,py)을 실음. 빛 줄기=운동량 방향, 길이∝\|p\|(측정). px=py=0 이면 줄기 0(author 0). |
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

- **소유**: `render/` 폴더 (`RENDER.md` · `RENDER-STATE.md` · `engine/spectral.js` · `engine/render.js` · `validate/smoke.js`). **render 는 viewer.html 을 두지 않는다** — 단일 뷰어는 트랙 밖 공유 셸 `HGO/viewer.html`.
- **불가침**: `atom/`(시뮬 코어·`STATE.md`·`steps/`·골든) · `../SPINE.md` · `../CLAUDE.md` — 읽기만(atom/ 진짜 diff 0). **공유 셸** `HGO/viewer.html` 은 render 그리기 위임 배선만 허용(RENDER §6). 스킬은 `.claude/skills/hgo-render-step/`.

---

## 6. INDEX — 렌즈 검증 현황 (유일하게 append, **literal 1줄/렌즈**)

> 규칙: 한 행 = `렌즈 | 읽은 양→번역 | 통과 + 핵심 수치 1개`. *문단 금지* — 전문은 이 문서 아님(렌더는 step 문서 없음, 렌즈는 가볍다).

렌즈-001 (L-λ) | 광자 lambda → 가시광 스펙트럼 색 + 측정 스펙트럼 띠 (render.js 그리기, 공용 뷰어 HGO/viewer.html 위임) | 스모크 PASS(광자 51·선 3·λ[1.333,20.571]·순서 보존) · atom/ diff 0 · 눈 검증 ⏳(사용자 브라우저)
렌즈-002 (L-3d) | 평면 세계(z=0) → 원근 3D 무대(음영 구·발광 빌보드·바닥 격자·궤도 카메라) — 위치=sim(rx,ry,0) 그대로, z author 0 | 스모크 PASS(중심→(280,280)·평면 depth>0·Δdepth 원근) · atom/ diff 0 · 눈 검증 PASS(사용자 브라우저 — "3d로 보이는건 성공")
렌즈-003 (L-cam) | 인터랙티브 카메라 — 드래그=궤도·휠=줌·우/Shift드래그=팬(`camState`+`attachControls`, 공용 뷰어 1줄 위임). 자동 선회(tick) 폐기. 프레젠테이션 한 항(시뮬 무관) | 스모크 PASS(궤도 Δpx=126·회전해도 타깃 중앙 고정·줌 스케일 변경) · atom/ diff 0 · 눈 검증 ⏳(사용자 브라우저)
렌즈-004 (L-line) | 광자 from→to 별 빈도 집계 → 분광 띠 세기(밝기=빈도/maxCount, 측정 정규화). 유무→세기 정제, 새 시뮬 양 0(`measureLines`) | 스모크 PASS(선 3·빈도합 51/51 보존·maxCount=24 측정·λ오름차순) · atom/ diff 0 · 눈 검증 ⏳(사용자 브라우저)
렌즈-005 (L-recoil) | 광자 운동량(px,py) → 빛 줄기/이방성(길이∝\|p\|/maxP 측정, 머리→자취 그라디언트). 게이트 해제(step-0003·0004). px=py=0 → 줄기 0(author 0). `measureMaxMomentum`·`photonStreak` | 스모크 PASS(방향 38/38·maxP 0.737·줄기 Δpx 20·축=운동량 정렬·무방향→null) · atom/ diff 0 · 눈 검증 ⏳(사용자 브라우저)
