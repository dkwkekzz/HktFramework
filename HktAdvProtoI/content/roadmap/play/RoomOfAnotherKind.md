# RoomOfAnotherKind — 다른 갈래의 방, 빙결 협곡

상태: **승인됨** (Human 승인 1회 — 확정 후보 9 가 확정 사항이 되었다). Cycle Breakdown 의 체크박스만 앞으로 갱신된다.
미지는 [M5-FrostCanyon.md](../M5-FrostCanyon.md).
선행: [RoomBearsMaterial.md](RoomBearsMaterial.md)(재료 생태 계약) · [RoomNeverSame.md](RoomNeverSame.md)(철) — 이 Play 는
그 둘을 **다른 갈래**에 두 번째로 쓴다. 새 축을 요구하지 않는다.

## 0. Row

**컨텐츠 층 M5 — 빙결 협곡 (지역).** 요구 축 2 (①②·②-부속 둘). 이 Play 가 놓는 것: *세계에는 요구가 다른 방이 있다.
숲의 것으로는 협곡에서 안 되고, 협곡이 요구하는 재료는 협곡에 없다. 그리고 협곡의 철은 백왕령의 안전 조건에 닿는다.*

미증명 ③(성장 선택의 애착과 고민)의 **2층 몫**이다 — 고민 자체는 3층 · 7층이 만들지만, 고민이 생길 **세계의 갈래**가
먼저 있어야 한다. 그리고 Material M9(Region 을 넘는 흐름)와 Time 2.4(철이 안전 조건에 닿는다)가 처음으로 **두 Region 사이**에 선다.

## 1. References

- [M5-FrostCanyon.md](../M5-FrostCanyon.md) — 세계 사실 표 · 열 질문
- [L2-World-Concept.md](../L2-World-Concept.md) §5 위험 일곱 갈래 · §6 빙결 협곡 · §3.1 hazard 태그
- [L2-World-Material.md](../L2-World-Material.md) §5 계약 · M3 구배 · M9 Inflow/Outflow · Carrier ATMOSPHERE
- [L2-World-Time.md](../L2-World-Time.md) 2.3 스밈 · 2.4 태그 덧씌움 · 2.6 경로
- [RoomBecomesLand.md](RoomBecomesLand.md) §5.3 백왕령의 안전 조건 셋 (산맥 · 강 · 거목) — 이 Play 가 그중 산맥을 건드린다
- [RegionGraphRooms.md](RegionGraphRooms.md) 확정 5 — 얼음 협곡은 경계(region-not-built)였다

## 2. Play Goal

**관찰자가 백왕령의 고개를 넘어 얼음 협곡에 들어가, 숲과 다른 갈래의 위험(눈보라가 시야를 · 절벽이 통행을 · 결정화 광물이
접촉을)을 흔적으로 읽고, 빙정석의 원천 넷을 다른 Carrier 로 만나며, 협곡이 요구하는 것(열)이 협곡에 없음을 알고,
스밈에 협곡의 추위가 고개를 넘어 백왕령 북쪽 조건이 약해지는 것을 본다.**

완료 확인 넷:

```text
① 얼음 협곡 · 빙결 협곡이 방으로 서고 고개가 열린다. hazard 태그가 climate · terrain · matter 셋 — 숲과 겹치지 않는다
② 빙정석 원천 넷이 Carrier 넷(TERRAIN · ATMOSPHERE · RESIDUE · PHENOMENON)으로 서고, Trace 만으로 셋 이상에 닿는다
③ 스밈에 백왕령 북쪽 condition area(산맥)의 유효 태그가 약해진 것이 화면에 보인다 (Time 2.4 태그 덧씌움 — 두 Region 사이)
④ world:observe --report 가 두 Region 의 Opportunity 분포 · Carrier 분포 · Flow/Isolation 을 나란히 요약한다 (⑲⑳㉒)
```

## 3. Experience Intent

```text
Start   숲을 알면 세계를 안다. 재료는 많을수록 좋고, 어디서든 통한다.
End     협곡은 다른 질문을 한다. 숲에서 배운 것이 여기선 답이 아니고, 여기 것이 저기서 답이 된다.
        어느 쪽을 먼저 갈지, 무엇을 들고 갈지가 처음으로 갈린다 — 그리고 그 협곡의 추위는 내 집 문턱까지 온다.
```

## 4. Breath

```text
자신감 → 낯섦 → 눈멂 → 미끄러짐 → 닿음 → 결핍 → 되돌아봄 → 갈림
```

- **자신감** — 숲을 다 안다. 고개를 넘는다.
- **낯섦** — 흙이 아니라 서리다. 붉은 흔적이 아니라 **푸른** 빛이다. 같은 세계의 다른 문법.
- **눈멂** — 눈보라. 보이는 범위가 밤처럼 좁다 — 낮인데도. 흔적은 색이 아니라 **숨이 어는 자리**로 읽는다.
- **미끄러짐** — 절벽. 못 지나간다(traversable). 결정면에 닿으면 세계의 대답: 결정화된다(hazard/matter 표시 — 몸에 무엇을 하는가는 3층).
- **닿음** — 절벽의 빙정석. 눈보라가 실어 온 가루. 언 사체 곁의 결정. 넷 다 같은 것, 넷 다 다른 자리.
- **결핍** — 열을 저장하는 결정이 있으면 더 깊이 간다는 것을 안다. 협곡에는 없다.
- **되돌아봄** — 백왕령으로. 스밈이 왔다. 북쪽 산기슭의 조건이 옅다 — 협곡의 추위가 고개를 넘어왔다.
- **갈림** — "숲으로 다시 갈까, 협곡을 더 볼까. 무엇을 들고." 처음으로 두 갈래.

## 5. Play Structure

### 5.1 낯섦 · 눈멂 · 미끄러짐 — 다른 갈래의 위험 (태그가 다르다)

```text
존재   ICE_CANYON(outer · 고개 너머 첫 방) · FROST_CANYON(wild · 그 안) — 방 둘. Connector ICE_CANYON_PASS 활성 (Rooms 확정 5 의 경계가 방이 된다)
       space: stamp(절벽 — 급경사 traversable 0) · area(hazard/climate: 눈보라) · area(hazard/matter: 결정면) · area(hazard/terrain: 절벽)
상태   눈보라 area 안에서 관찰 InRange 가 좁다 (Time 의 observeRangeScale 을 area 조건으로 — 같은 기제)
관찰   서리 표면(surface 태그 frost — Land V8 표에 한 줄) · 푸른 빛 point · 숨이 어는 trace · 절벽 · 결정면
추론   "위험의 종류가 다르다. 숲은 무엇이 나를 노렸고, 여기는 세계 자체가 나를 깎는다" (Concept §5 기후 · 지형 · 물질)
반응   흔적을 색이 아니라 온도로 읽는다. 절벽은 돌아간다. 결정면은 피한다
```

### 5.2 닿음 — 빙정석의 원천 넷 (Material 계약 두 번째 적용)

Cause Network (확정 후보 2): **빙정석이 자라며 열을 먹는다 → 극저온 → 찬 공기가 협곡을 타고 내려와 눈보라 → 얼음 절벽 →
열이 귀해 체온을 쫓는 포식자.** 위험을 만든 것이 곧 재료다 (Concept §6 그대로).

| Source | Region | Carrier | 역할 | Trace | 채취 결과 | 회복 |
|---|---|---|---|---|---|---|
| `PASS_RIME` 고개의 서리 결정 | ICE_CANYON | PHENOMENON (서리) | Baseline | 숨이 어는 자리 · 서리 표면 | 서리가 걷힌다 | 밤마다 다시 낀다 (BASELINE) |
| `CLIFF_FROST_VEIN` 절벽의 결정면 | FROST_CANYON | TERRAIN | Risk | 푸른 빛 · 결정면 hazard | 깨진 면 — 그 칸이 결정화 hazard 로 남는다 | 열을 먹어 다시 자란다 — **옆 면**으로 (MIGRATORY) |
| `SNOW_DRIFT_DUST` 눈보라의 결정 가루 | FROST_CANYON | ATMOSPHERE | Conditional | 눈보라가 잦아든 뒤 쌓인 자리 | 흩어진다 | 다음 눈보라 (EVENT_SCARCE — 스밈 · 긴 밤에 잦다) |
| `FROZEN_REMAINS` 언 사체 곁의 결정 | FROST_CANYON | RESIDUE | By-product | 언 사체 · 그 둘레 서리 | 사체가 드러난다 | 포식자가 남기는 것 (2층: 경로가 지난 자리 — Time 2.6) |

같은 Seed(빙정석)의 네 순도 · 네 Carrier — 숲의 생체 광석과 같은 방식이고 Carrier 는 하나도 겹치지 않는다.

### 5.3 결핍 — 협곡이 요구하는 것은 협곡에 없다

```text
존재   FROST_DEPTH(deep)로의 문 — 긴 밤에만 열린다 (Time 2.4 ②). 그 너머는 경계
상태   문의 표식에 요구가 적힌다 — 세계의 대답: "체열이 감지된다" (Region §4.2). 2층에서는 표시다 — 몸이 어떻게 깎이는가는 3층
관찰   열을 저장하는 결정(HEAT_CRYSTAL)이 있어야 한다는 것을 문의 사유 코드로 안다. 협곡 안에 그 원천은 없다 (확정 후보 4)
추론   "이 방이 요구하는 것은 저 방에 있다. 세계는 한 방에서 닫히지 않는다"
반응   되돌아간다 — 갈림의 자리
```

### 5.4 되돌아봄 — 철이 두 Region 사이에 선다

```text
존재   Time 2.4 ① 태그 덧씌움을 **두 Region 사이**에 — FROST_CANYON.phases.SEEP.outflow: 찬 공기가 ICE_CANYON_PASS 를 넘어
       WHITE_KING_DOMAIN 북쪽 condition area(산맥 — Land §5.3)의 유효 태그를 약하게 한다 (Material Flow 의 carrier WIND)
상태   스밈 · 긴 밤 동안 백왕령 북쪽 조건 area 가 "옅음" — safe-by: ridge 의 사유 코드가 약해진다
관찰   백왕령 북쪽 산기슭에 서리 · HUD 사유 코드(condition-weak: ridge · 협곡의 추위)
추론   "안전은 조건이고, 조건은 철을 탄다. 백왕령도 언제나 안전한 것은 아니다" (W2 + T2)
반응   없음 — 관찰로 증명된다. 사람이 실제로 위험해지는 것은 3층
```

이것이 Isolation Reason 의 반대편이다 — 숲의 계통은 산맥이 막지만(Material 확정 5), **추위는 산맥을 넘는다.** 백왕령의 조건 셋 중
산맥 하나가 철에 흔들리는 것이 이 Play 의 마지막 장면이다.

## 6. Required Capability

```text
Existing   Rooms · Land(stamp · surface 표 · traversable · condition area) · Rule · Material(W17~W24) · Time(W25~W32) 전부
Required — 세계
  W33  방 둘 + 고개 활성 + FROST_DEPTH 경계 문(긴 밤 활성) — 데이터
  W34  hazard area 가 관찰 InRange 를 좁힌다 (눈보라) — Time W31 의 area 조건판
  W35  hazard/matter 접촉 표시 — 결정면 area 에 서면 사유 코드(crystallizing). 몸의 변화 없음 (3층)
  W36  Region 간 태그 덧씌움 — 한 Region 의 phases 가 다른 Region 의 area 를 가리킨다 (Time W26 확장 · Connector 를 통해서만)
  W37  빙정석 계통 데이터 — Seed 하나 · Source 넷 · Trace · 회복 · Isolation/Outflow
Required — 표현
  V17  서리 표면 · 푸른 빛 · 숨이 어는 trace · 눈보라 area · 결정면 — 표 한 줄씩
  V18  문구 — crystallizing · condition-weak · frost-vein-regrown
Required — 기구
  E16  없음이 목표 — 전부 Land · Material · Time 이 세운 기구의 데이터다. 검사 ㉒(Isolation/Flow)가 두 Region 을 본다
```

## 7. Cycle Breakdown

```text
[ ] C019 — 고개 너머 다른 갈래: 얼음 협곡 · 빙결 협곡 방 둘 + 고개 활성 + 위험 갈래 셋(눈보라 = 시야 · 절벽 = 통행 · 결정면 = 접촉 표시).
           숲과 겹치지 않는 hazard 태그
[ ] C020 — 추위의 재료 생태: 빙정석 원천 넷(Carrier 넷) + Trace + 회복(옆 면으로) + 협곡의 Isolation/Outflow.
           협곡이 요구하는 것(열 결정)이 협곡에 없다는 문
[ ] C021 — 추위가 고개를 넘는다: 스밈에 백왕령 북쪽 조건이 약해진다(Region 간 태그 덧씌움 · carrier WIND) +
           긴 밤의 빙결 심층 문 + 두 Region 나란한 보고
```

---

## 확정 사항 (Human 승인 — 전부 제안값이었고 Human 이 언제든 뒤집는다)

```text
1. 두 이름의 관계 — 합치지 않는다. 얼음 협곡(ICE_CANYON · outer)은 고개 너머 첫 방이고, 빙결 협곡(FROST_CANYON · wild)은
   그 안쪽, 빙결 심층(FROST_DEPTH · deep)은 긴 밤의 문 너머다. Rooms 가 숲을 가장자리 → 안쪽으로 나눈 것과 같다.
   두 이름이 다른 자리라는 Region §5.1 의 판단을 그대로 둔 채 이어 붙였다.
2. 추위의 원인 — 빙정석이 자라며 열을 먹는다. 위험을 만든 것이 곧 재료다 (Concept §6 의 문장을 원인으로 읽었다).
   이것이 이 Play 가 새로 놓는 유일한 세계 사실이다.
3. 빙정석의 관찰 가능한 성질 — 열을 먹는다(닿은 것을 식힌다 · 숨이 언다) · 푸르게 빛난다 · 열이 닿으면 자란다(그래서 옆 면으로 옮겨 간다).
   쓰임은 정하지 않는다 (S10).
4. 열을 저장하는 결정(HEAT_CRYSTAL)은 협곡에 없다 — 협곡이 요구하는 재료는 다른 Region 에서 난다. 어디서 나는가는 정하지 않는다
   (후보: 숲 계통 — "살아 있는 것 안에 쌓이는" 생체 광석의 성질과 맞물린다. 그 판단은 그 재료를 놓는 행이 한다).
5. Carrier 넷 — PHENOMENON(서리) · TERRAIN(결정면) · ATMOSPHERE(눈보라 가루) · RESIDUE(언 사체). 숲의 다섯과 하나도 겹치지 않는다.
6. 눈보라 = 낮에도 관찰 범위 절반 (Time 의 밤과 같은 값 · area 조건). 긴 밤의 눈보라는 그 절반의 절반.
7. 회복 — 서리 하루 · 결정면 180 s(옆 면으로 · 긴 밤에 두 배 빠르다) · 눈보라 가루 = 눈보라 뒤 · 언 사체 = 경로가 지난 뒤.
8. 채취 단위 — Baseline 3 · Risk 2 · Conditional 2 · By-product 1 (Material D4 와 같은 규칙).
9. 자리와 번호 — 컨텐츠 행 M5 · 요구 축 2. Material · Time 뒤. Cycle 은 C019~C021.
   붉은 황야(RED_WASTE)는 이번에 짓지 않는다 — 협곡 하나로 "갈래가 다르다" 는 증명된다.
```

## Human 질문

없음 — 컨셉에서 유도할 수 없는 것이 없었다. 확정 2(추위의 원인)와 4(열 결정의 원천)가 가장 큰 결정이었다.
