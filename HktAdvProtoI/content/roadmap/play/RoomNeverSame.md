# RoomNeverSame — 같은 방은 두 번 없다, 숲의 네 철

상태: **승인 대기** (제안 전부 확정 후보로 채웠다 — 아래 "확정 후보". Human 질문은 셋뿐). 주입 원문과 제안은
[L2-World-Time.md](../L2-World-Time.md) 가 소유한다.
선행: [RuleBoundRoom.md](RuleBoundRoom.md) 가 Region State 를, [RoomBearsMaterial.md](RoomBearsMaterial.md) 가 원천과
흔적을 먼저 세운다 — 철이 바꿀 것이 있어야 철이 보인다.

## 0. Row

**기반 층 L2 — 세계 자체 (세계 절반 ② 부속 둘째).** 이 Play 가 증명하는 축: *세계는 시계를 가지고 Region 은 위상을
가진다. 같은 방에 다른 때 다시 오면 다른 방이다. 그 사이에 남이 다녀갔고 그것도 보인다. 그리고 어떤 것은 여럿이 함께
있어야만 일어난다.*

놓는 미지 — 새 지역이 아니라 **세계의 시계**(고요 · 스밈 · 긴 밤 · 뒤척임)와 **압도적 존재 둘의 경로**
(천공고래 · 맹목의 사냥꾼 — 정식 이름, 2층에서는 현상). 컨텐츠 층에 행 하나를 놓는다: **M4 천공고래의 길**
(하늘을 지나는 현상과 떨어진 비늘 — 생물이 되는 것은 3층).

미증명 넷 중 **①②④** 에 닿는다 ([L2-World-Time.md](../L2-World-Time.md) §6). ③ 은 3층 · 7층의 것이다.

```text
이 Play 가 세우는 것    세계 시계(낮밤 · 철) · Region 위상 덧씌움(태그 · 활성 · 출현 · 자국) · 소란(집단 원인) ·
                      발자국(track) · 압도적 존재의 경로와 시간표 · 세계 사건 원천(고래 비늘)
이 Play 가 세우지 않는 것  시간이 몸에 하는 일(3층) · 생물의 행동(3층) · 압도적 존재와의 접촉이 몸에 하는 일(3·5층) ·
                      날씨(두지 않는다) · 걷는 숲의 나무 이동(그 Region 의 Play)
```

## 1. References

- [L2-World-Time.md](../L2-World-Time.md) — 제안 전체. §2.3 네 철 · §2.4 위상 넷 · §2.5 소란 · §2.6 경로 · §2.7 발자국 · §3 데이터 계약 · §4 검사 ㉓~㉖ · 원칙 T1~T8
- [L2-World-Concept.md](../L2-World-Concept.md) §5 "장기간의 밤"(정식 기후 위험) · §9 천공고래(그림자 · 개화 · 떨어진 비늘 · 포식자가 모여든다) · §11 맹목의 사냥꾼(시각 없음 · 진동 · 정지하면 못 찾는다) · §12 걷는 숲 · §13 깊이
- [L2-World-Material.md](../L2-World-Material.md) M5(시간 조건) · M7(EVENT_SCARCE) · §6.2 `occurrence.timeOrCycle` · §6.3 carrier FALLING · WORLD_EVENT 역할
- [RuleBoundRoom.md](RuleBoundRoom.md) — RULE_MAZE_CONNECTION 의 압력 = 소란의 첫 사례 · W9 Region State · W12 덧씌움 · W13 activation
- [RoomBearsMaterial.md](RoomBearsMaterial.md) — Source 일곱과 흔적 · D3 회복 상수(철과 맞물린다)
- [RegionGraphRooms.md](RegionGraphRooms.md) — 방 여섯 · Connector · presence layer 의 빈 자리

## 2. Play Goal

**관찰자가 숲 가장자리에 고요에 왔다가, 스밈에 다시 와서 같은 방의 흙이 붉어지고 못 보던 자국이 온 것을 보고,
긴 밤에 그때만 열리는 문을 지나 눈 없는 것의 경로를 피해 걷고, 뒤척임 뒤에 원천이 옮겨 가고 자기 자국이 묻힌 것을
보며, 그 사이 다른 관찰자들이 다녀간 발자국과 그들이 함께 올린 소란으로 숲이 깨어난 것을 본다.**

완료 확인 다섯:

```text
① 같은 Region 의 관찰 결과가 철마다 다르다 — 고요 · 스밈 · 긴 밤 각각에서 태그 · 활성 · 출현 중 하나 이상이 다르다
② 긴 밤에만 열리는 Connector 를 실제로 건넌다. 낮에는 거절 사유 코드(not-this-season)
③ 뒤척임 뒤 MIGRATORY 원천의 자리가 옮겨 있고 이전 철의 자국(무너진 노두 · 발자국)이 묻혀 있다
④ 관찰자 하나로는 소란 임계를 못 넘고, 셋이 같은 방에서 함께 하면 넘는다 — 넘은 뒤 방의 위상이 바뀐 것이 화면에 보인다
⑤ 천공고래가 지나간 뒤 비늘 원천이 생기고, 맹목의 사냥꾼의 경로가 긴 밤에 outer 까지 내려온 것이 presence 로 보인다.
   world:observe --report 의 ㉓~㉖ 가 통과한다
```

## 3. Experience Intent

```text
Start   방은 한 번 보면 안 것이다. 지도는 그리면 끝난다. 남이 있든 없든 내 세계는 같다.
End     방은 때마다 다른 방이고, 어떤 때는 위험하고 어떤 때만 열린다. 내가 없는 동안에도 세계는 돌았고
        남이 다녀갔고, 여럿이 함께 있어야만 일어나는 일이 있다. 지도는 그릴 수 있어도 "언제" 는 배워야 한다.
```

## 4. Breath

```text
익숙함 → 어긋남 → 예감 → 밤 → 열림 → 피함 → 뒤척임 → 남의 자취 → 함께 → 때를 안다
```

- **익숙함** — 고요. 숲 가장자리는 지난번 그대로다. 허물 무더기, 옅은 붉은 흙.
- **어긋남** — 며칠 뒤 다시 오니 흙이 더 붉다. 강가에 못 보던 자국이 있다. 밤이 길어졌다. 스밈이다.
- **예감** — 숲 안쪽에서만 열리던 조건부 원천이 가장자리에서 열린다. 위험도 같이 왔다는 것을 안다 — 같은 원인이니까.
- **밤** — 해가 뜨지 않는다. 보이는 범위가 좁다. 대신 붉은 흙이 어둠에서 빛난다 — 흔적의 종류가 바뀐다.
- **열림** — 숲 안쪽의 닫혀 있던 문 하나가 열려 있다. 긴 밤에만 열리는 문이다.
- **피함** — 눈 없는 것의 경로가 outer 까지 내려와 있다. presence 가 땅 위에 보인다. 서 있으면 지나간다 — 진동에만 반응하니까.
- **뒤척임** — 새벽. 노두는 다른 마디에 서 있고, 내가 낸 구덩이는 묻혔다. 길 하나가 닫히고 하나가 열렸다.
- **남의 자취** — 내가 없던 사이의 발자국들. 누구인지는 모른다. 방향과 얼마나 됐는지만.
- **함께** — 세 관찰자가 광석 지대에서 함께 캔다. 소란이 임계를 넘고 숲이 깨어난다 — 둥지의 경로가 넓어진다. 혼자서는 안 되던 일이다.
- **때를 안다** — "긴 밤 직전 스밈의 마지막 밤, 광석 지대에 셋이서." 지도가 아니라 **때**가 지식이 된다.

## 5. Play Structure

### 5.1 익숙함 · 어긋남 — 시계와 스밈 (태그 덧씌움)

```text
존재   WorldClock (전역 · 스냅샷). FOREST_EDGE 의 RegionSpec.phases.SEEP — depthOverlay: 강가 area 를 wild 로,
       hazardExtend: 둥지 쪽 경로 area
상태   season: STILL → SEEP. 그 Region 의 유효 depth 태그가 덧씌워진다 (컴파일 결과는 그대로 — W12)
관찰   HUD 에 때(낮/밤 · 철) · 흙의 붉기(Material 의 soil-stain 세기에 철 배율) · 없던 track · 밤의 길이
추론   "같은 방인데 더 깊어졌다. 미지가 이쪽으로 왔다"
반응   조건부 원천(Material RIVER_SILT 류)이 가장자리에서 열린다 — 위험과 같이 (Concept §6)
```

### 5.2 밤 · 열림 · 피함 — 긴 밤 (활성 덧씌움 · 관찰 범위 · 경로)

```text
존재   phases.LONG_NIGHT — connectorActivation: FOREST_DEEP 의 문 하나 active(긴 밤만) ·
       presenceRoutes: BLIND_HUNTER_ROUTE (FOREST_DEEP → FOREST_EDGE 로 내려오는 presence 곡선)
       phases.NIGHT — observeRangeScale
상태   dayPhase 가 NIGHT 에 고정된 하루. 관찰 InRange 가 좁다 (유도 사실 — 계약 불변)
관찰   문의 표식이 "열림" · 경로 area 가 hazard/creature 로 읽힌다 · 붉은 흙이 어둠에서 빛난다 (흔적 종류 전환)
추론   "이 문은 이때만 열린다. 이 길은 이때 위험하다. 움직이지 않으면 지나간다" (Concept §11)
반응   건넌다 / 멈춘다. 몸에 무엇이 오는가는 3층 — 이 Play 의 사냥꾼은 지나가는 경로일 뿐이다
```

긴 밤에 열리는 문이 **어디로** 이어지는가는 이 Play 가 정하지 않는다 — 문 너머는 경계(region-not-built)로 둔다.
Rooms 확정 5 와 같은 방식이다. 열리는 문이 있다는 것이 증명이지, 그 너머가 증명이 아니다.

### 5.3 뒤척임 — 자국이 묻히고 원천이 옮겨 간다

```text
존재   phases.onTurn — burySigns · migrateSources: [ORE_OUTCROP] · Connector 활성 집합의 교대 (데이터)
상태   seasonTurn 이벤트 한 번. Region State 의 자국(collapsed · track · 옅어진 흔적) 초기화, MIGRATORY 원천은
       뿌리 곡선의 다음 마디로. Material 의 회복 상수(D3)와 별개로 **한 번에** 재배열된다 — 세계가 뒤척인 것이다
관찰   어제의 구덩이가 없다 · 노두가 다른 자리에 · 길 하나가 닫히고 하나가 열렸다 · 발자국이 전부 사라졌다
추론   "세계가 다시 짜였다. 남이 낸 자국도 내 것도 묻혔다 — 이 방은 두 번 같지 않다"
반응   지도를 다시 그린다 — 대신 규칙(어느 철에 무엇이)은 그대로다. 외울 것은 자리가 아니라 때다
```

Material M8 과의 관계: 채취의 자국은 **세계 과정(회복)으로 옅어지고, 뒤척임으로 묻힌다.** 둘 다 타이머가 아니다 —
하나는 거목의 축적이고 하나는 세계의 뒤척임이다. "아무 반응 없이 같은 좌표에 다시 나타난다" 는 여전히 없다.

### 5.4 남의 자취 — track

```text
존재   trace layer 의 track — Region State 의 최근 통과 목록 (자리 · 방향 · 나이). 관찰자 이름은 없다
상태   몸이 지나가면 track 이 남고 초 단위로 옅어진다. 뒤척임이 묻는다
관찰   발자국 표식 (방향 · 진하기) · HUD 사유 코드(track-fresh / track-old)
추론   "내가 없는 동안 누가 저쪽으로 갔다. 최근이다"
반응   따라가거나 피한다 — 남의 행동이 내 정보다 (Concept §14 의 2층 몫)
```

### 5.5 함께 — 소란 (집단 원인)

```text
존재   RegionState.disturbance — 모든 Region 의 값. 미로의 pressure 가 이것의 첫 사례다 (일반화 — RuleBoundRoom W11 재사용)
상태   채취 · 타격 · 건너기가 값을 올린다. 고요에서만 가라앉는다. 임계에서 phase: DORMANT → AWAKE —
       숲이 깨어나면 둥지 경로 presence 가 넓어지고(태그) 조건부 원천의 조건이 바뀐다(출현)
조건   임계 = 한 몸이 한 철 안에 채울 수 없는 값 (확정 후보 5). 관찰자 셋이 같은 방에서 함께 캐면 넘는다
관찰   HUD 에 소란(counter + progress — 미로의 pressure 표시 재사용) · 깨어난 뒤 표식 변화 · 사유 코드(forest-awake)
추론   "혼자서는 못 넘는다. 여럿이 있어야 세계가 이렇게 된다 — 그리고 여럿이 비워야 다시 잠든다"
반응   모이거나 흩어진다. 세계의 어떤 상태가 여럿의 합이라는 것을 안다
```

### 5.6 지나가는 것 — 천공고래 (세계 사건)

```text
존재   PresenceRoute SKY_WHALE_ROUTE — 낮 · 시간표(철 바퀴 N 번에 한 번) · path: WHITE_KING_DOMAIN → FOREST_EDGE →
       FOREST_DEEP → RED_EYE_TREE 의 presence 곡선. leavesBehind: WHALE_SCALE_FALL (Source · carrier PHENOMENON ·
       role WORLD_EVENT · seed 고래 비늘 WHALE_SCALE)
상태   지나는 동안 그 Region 의 위상이 "그늘" (태그 덧씌움 · 관찰 범위 축소) · 소란이 오른다 (포식자가 모여든다 — Concept §9)
       지나간 뒤 비늘 원천이 경로 위 임의 마디에 선다 (seed 로 결정론) · 개발 명령 표면으로 부를 수 있다
관찰   그림자가 방을 덮는다 (SceneGroundZone 전체 intensity) · 지나간 자리에 비늘 · 소란 표시가 오른다
추론   "이건 싸우는 게 아니라 때를 맞추는 것이다. 지나간 뒤에 가야 한다"
반응   따라간다 — 비늘을 캔다 (Material 의 채취 그대로). 몸에 무엇이 오는가는 3층 · 5층
```

### 5.7 때를 안다 — 관찰 계약

```text
HUD              때 (낮/밤 · 철 · 남은 시간은 싣지 않는다 — 하늘과 흙이 말한다 T8)
사유 코드          not-this-season · forest-awake · track-fresh/old · whale-shadow · turn-happened
관찰 결과 불변     WorldClock 은 전역 · 관찰자 이름은 track 에 없다 · 시각은 관찰자마다 같다 (T1)
```

## 6. Required Capability

### Existing (재사용)

```text
Rooms 전부 · Land 의 E6~E9 · W15 · V7 · Rule 의 W9(Region State) · W11(압력 시스템 → 소란으로 일반화) · W12(덧씌움) ·
W13(activation 조건) · V6 · Material 의 W17~W24 (원천 · 흔적 · 회복 · Flow) · 채광 · 다중 관찰자 · 세계 영속 ·
개발 명령 표면 · engine/world-kernel/clock (dt 누적) · SceneGroundZone.intensity
```

### Required — 세계

```text
W25  WorldClock — 전역 State. dt 누적 → dayPhase · season · seasonCycle. 스냅샷에 실린다. 세계 초 상수 (헤더)
W26  Region 위상 덧씌움 — RegionSpec.phases 를 읽어 유효 depth 태그 · hazard 확장 · Connector activation ·
     Source occurrence 조건을 시각으로 판정한다. 재컴파일 없음 (T4)
W27  뒤척임 — seasonTurn 이벤트에 onTurn 을 적용: 자국 묻기 · MIGRATORY 원천 이동 · 활성 집합 교대
W28  소란 — RegionState.disturbance. 미로의 pressure 시스템을 일반화한 시스템 하나 (Scope: 모든 Region).
     임계 전이 DORMANT/AWAKE 와 그 결과(태그 · 출현)
W29  track — 몸의 통과가 Region State 에 남고 초 단위로 옅어진다. 관찰자 id 는 싣지 않는다
W30  PresenceRoute — 시간표대로 경로 위를 옮겨 가는 현상 하나. 지나는 Region 에 effectWhilePassing, 지난 뒤 leavesBehind.
     개발 명령으로 호출 가능 (시험)
W31  밤의 관찰 범위 — 투영의 InRange 에 observeRangeScale (유도 사실 — 관찰 계약 불변)
W32  투영 — HUD 에 때 · 소란 · 사유 코드 다섯 · 경로 area · track
```

### Required — 표현

```text
V13  때 — HUD 문구(낮/밤 · 철) · 하늘/바닥 색의 철 배율 (terrain-presentation 에 season 열 — 데이터)
V14  덧씌움 표현 — 유효 depth 로 색을 고른다 (V1 의 표 그대로, 입력만 유효 태그) · hazard 확장 area
V15  track 표식 (방향 · 진하기) · 경로 area (presence) · 고래 그림자 (SceneGroundZone intensity)
V16  뒤척임 순간의 연출 — 화면 전체 맥동 한 번 · 사유 코드 문구
```

### Required — 기구 (ENGINE 레인 C — 작다)

```text
E13  검사 ㉓~㉖ — phases · PresenceRoute 참조 무결성 · 철별 요약 · "어느 철에도 갈 곳 하나 이상"
E14  world:observe --at <season>/<dayPhase> — 덧씌움 결과 래스터 (컴파일러 불변)
E15  없음이 목표 — presence 곡선은 Land 의 curve op 그대로. 새 layer 없음
```

### 불변 조건 — 코드 변경 없이 폴리싱

```text
철의 길이 · 낮밤 비율 · 소란 임계 · 어느 문이 어느 철에 열리는가 · 어느 area 가 스밈에 깊어지는가 ·
경로의 시간표와 path · 비늘이 서는 마디
    → RegionSpec.phases · PresenceRoute 데이터 · 헤더 상수
철을 하나 더 만든다 · 새 압도적 존재를 놓는다
    → 데이터 한 줄 (규칙은 철의 이름을 모른다 — T4)
```

## 7. Cycle Breakdown

```text
[ ] C015 — 세계에 시계가 선다: WorldClock(낮밤 · 철 · 바퀴) + 밤의 관찰 범위 + HUD 의 때 + 하늘/바닥의 철 배율.
           같은 방을 낮과 밤에 본다 — 보이는 범위와 흔적의 종류가 다르다. 고요 → 스밈 → 긴 밤 → 뒤척임이 돈다 (덧씌움은 아직)
[ ] C016 — 철이 방을 바꾼다: RegionSpec.phases 덧씌움 넷 — 스밈의 depth/hazard 덧씌움 · 긴 밤에만 열리는 문 ·
           철 조건 Source 출현 · 뒤척임의 자국 묻기와 원천 이동. 같은 방에 세 철에 세 번 온다
[ ] C017 — 여럿의 누적과 남의 자취: 소란(미로 압력의 일반화) + 임계 전이(숲이 깨어난다) + track.
           관찰자 하나로는 안 넘고 셋이면 넘는다 · 내가 없던 사이의 발자국
[ ] C018 — 지나가는 것: PresenceRoute 둘 — 맹목의 사냥꾼(긴 밤 · 경로가 outer 로) · 천공고래(낮 · 그림자 · 비늘 원천 ·
           소란) + 개발 명령으로 부르기 + world:observe --at 과 검사 ㉓~㉖
```

각 항목은 작다 · 플레이 가능 · World 변화 분명 · 관찰 가능 · 검증 가능 · 재사용 가능. 순서는 의존성(시계 → 덧씌움 →
누적 → 경로)이자 Breath 의 순서(익숙함·어긋남 → 밤·열림·뒤척임 → 남의 자취·함께 → 때를 안다)다.

---

## 확정 후보 (승인 게이트에서 확정 — 전부 제안값 · Human 이 언제든 뒤집는다)

```text
 1. 철은 넷 — 고요(STILL) · 스밈(SEEP) · 긴 밤(LONG_NIGHT) · 뒤척임(TURN). 뒤척임은 철이 아니라 전이 사건이다.
    이름은 문명권이 안에서 느끼는 것에서 지었다 (Region §5.2 — 하늘과 때에는 이름을 붙인다).
    "긴 밤" 은 정식 문구 "장기간의 밤"(Concept §5) 을 철로 읽은 것이다.
 2. 철은 날씨가 아니라 미지의 가까움이다 — 스밈에 깊이의 경계가 한 단계 바깥으로 번진다. 날씨는 두지 않는다.
 3. 시간 상수 (세계 초 · 헤더 · 결정론) — 낮 240 s · 밤 120 s → 하루 360 s.
    고요 3일(18분) · 스밈 2일(12분) · 긴 밤 1일(6분 · 밤만) · 뒤척임 60 s → 한 바퀴 약 37분.
    근거: Material D3 의 회복 상수(60~240 s)와 같은 자리 — 한 세션에 한 바퀴를 본다. 물길 불어남(240 s)이 하루에 한 번 남짓.
 4. 밤의 관찰 범위 = 낮의 절반 (observeRangeScale 0.5). 긴 밤은 하루 내내 이 값.
 5. 소란 — 채취 +10 · 타격 +5 · 건너기 +3 · 이동 0. 고요에서만 −0.5/s. 임계 300 · 깨어남 뒤 고요 한 철을 비워야 잠든다.
    한 몸이 한 철에 못 넘는 근거: 원천 일곱의 채취 단위 합이 14 (Material D4) — 혼자서는 140 이 상한이다.
    미로의 pressure(P = 120 · 이동 거리)는 그대로 두고 소란의 특수 사례로 **읽기만** 한다 — RuleBoundRoom 확정 1 불변.
 6. 긴 밤에만 열리는 문 — FOREST_DEEP 에 하나 (anchor 새로 · 너머는 경계 region-not-built). 어디로 이어지는지는 정하지 않는다.
 7. 스밈의 덧씌움 — FOREST_EDGE 의 강가 area 가 wild 로, 둥지 쪽 경로 area 가 hazard/creature 로. 데이터다.
 8. 뒤척임 — 자국(collapsed · track · 옅어진 흔적) 전부 묻힘 · ORE_OUTCROP 다음 마디로 · Connector 활성 집합 교대 (데이터 표).
    높이는 바뀌지 않는다 (T6). 걷는 숲의 나무 이동은 그 Region 의 Play.
 9. 천공고래 — 낮에 백왕령 → 숲 가장자리 → 숲 안쪽 → 거목 순으로 지나는 presence 경로. 철 바퀴 셋에 한 번 (약 2시간 —
    "수년에 한 번" 의 프로토타입 값). 개발 명령으로 부른다. 떨어진 비늘 = Material Seed **고래 비늘**(WHALE_SCALE ·
    WORLD_EVENT · EVENT_SCARCE · 채취 단위 1). 성질은 Concept §9 그대로: 하늘에서 떨어진다(FALLING) · 특정 식물이 그 곁에서 핀다.
    쓰임은 정하지 않는다 (S10).
10. 맹목의 사냥꾼 — 긴 밤에만 FOREST_DEEP → FOREST_EDGE 로 내려오는 presence 경로. 소란이 높은 방 쪽으로 휜다(진동).
    지나간 자리에 By-product 원천(먹이 잔해 — Material 의 광식충 허물 계통) 하나. 몸에 무엇을 하는가는 3층 · 5층.
11. track 은 관찰자 이름을 싣지 않는다 — 방향과 나이만. 60 s 로 옅어지고 뒤척임이 묻는다.
12. 자리와 번호 — 2층 다섯째. Rule · Material 뒤. Cycle 은 C015~C018.
13. 컨텐츠 층 새 행 — M4 천공고래의 길 (현상 · 비늘). 맹목의 사냥꾼은 행을 놓지 않는다 — 경로만 있고 남기는 것은 M3 계통이다.
```

## Human 질문

컨셉에서 유도할 수 없어 Human 만 답할 수 있는 것 셋. 답이 없으면 후보값으로 간다 (괄호).

```text
1. 철 이름 넷 — 고요 · 스밈 · 긴 밤 · 뒤척임. 이 결을 원하는가, 아니면 더 낯선 쪽(예: 문명권이 아예 이름을 못 붙인
   것으로 두고 "첫째 때 · 둘째 때" 로 세는가)? (후보: 위 넷 — 안에서 느끼는 말이 세계관에 맞다)
2. 철의 바퀴는 세계에 하나인가, Region 마다 어긋나는가 — 숲의 긴 밤과 황야의 긴 밤이 같은 밤인가?
   (후보: 하나 — T1. Region 마다 어긋나면 "여럿이 같은 세계" 가 약해진다)
3. 낮이 아예 없는 하루(긴 밤)를 둘 것인가, 밤이 아주 긴 하루로 둘 것인가?
   (후보: 낮이 없다 — "장기간의 밤" 원문 그대로. 새벽이 곧 뒤척임이라 극이 선다)
```
