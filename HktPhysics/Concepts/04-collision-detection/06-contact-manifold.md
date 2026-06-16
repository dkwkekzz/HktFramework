# [04·2.6] Contact manifold 생성 (Contact Manifold)

> narrow phase 의 "충돌함 + 법선 + 침투"를, 솔버가 안정적 적층(stacking)에 쓸 **여러 접촉점**으로 정리하고, 프레임 간 보존해 warm start 를 가능케 한다. *04 가 05 와 만나는 가장 중요한 접점.*
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [03-sat.md](03-sat.md) · [05-epa-mpr.md](05-epa-mpr.md)

---

narrow phase([03-sat](03-sat.md)/[05-epa-mpr](05-epa-mpr.md))가 "충돌함 + 법선 + 침투"를 줘도, 솔버([05](../05-constraint-solving.md))는 **안정적 적층(stacking)**을 위해 면-면 접촉의 **여러 접촉점**이 필요하다. 한 점만 주면 박스가 그 점을 축으로 비틀거린다(rocking).

**manifold = {접촉점들, 공유 법선, 점별 침투깊이}.** 접촉 특징에 따라 점 수가 갈린다 — 면-면은 4점(박스), 엣지-면은 2점, 점 접촉은 1점이 흔하다.

**clipping (Sutherland–Hodgman)**

면-면 접촉에서 다중 접촉점을 뽑는 표준 절차:
1. SAT 의 최소 겹침 축으로 **reference face**(한 형상의 충돌 면)와 **incident face**(상대 형상에서 그 법선에 가장 마주보는 면)를 정한다.
2. incident face 를 reference face 의 **옆면(side plane)**으로 잘라(clip) 겹치는 다각형만 남긴다.
3. 그 다각형 정점 중 reference face **아래로 침투한 것**만 접촉점으로 채택.

SAT 기반 박스 충돌의 표준 manifold 생성법이다(Box2D 가 교과서적).

**manifold persistence / contact caching (warm start 의 토대)**

프레임마다 접촉을 처음부터 만들지 않는다:
- 이전 프레임 접촉점을 **id(형상 feature 조합)로 매칭**해 누적·갱신하고, 낡은(분리된) 점은 제거한다.
- 보존한 접촉에 **이전 프레임의 충격량(impulse)을 초깃값으로 재사용 = warm start** → [05](../05-constraint-solving.md) 솔버 수렴이 극적으로 빨라지고 적층이 안정된다.

> warm start 가 동작하려면 접촉점 id(feature id)가 프레임 간 **안정적·결정론적**이어야 한다. feature id 가 프레임마다 흔들리면 매칭 실패(캐시 미스) → 솔버가 매 프레임 차갑게 시작 → 지터·붕괴. 이 결정론적 id 생성이 04 함정의 핵심(아래·[04 §5](../04-collision-detection.md#5-함정--결정론-체크리스트)).

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **접촉점 feature id 불안정**: id 가 흔들리면 warm start 캐시 미스 → 솔버 cold start → 지터/붕괴.
- **결정론**: manifold 점을 **객체 id 기준 안정 정렬**, feature id 를 결정론적으로 생성(→ [12](../12-determinism-networking.md)).
- **clipping 수치 degenerate**: 거의 평행한 면·얇은 다각형에서 clip 결과가 0~중복 정점이 될 수 있어 epsilon 정리 필요.

**다음**: [07-ccd](07-ccd.md) — discrete 스냅샷이 놓치는 고속 물체의 tunneling 을 막는 연속 충돌 감지.
