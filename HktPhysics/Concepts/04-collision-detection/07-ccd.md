# [04·2.7] CCD — 연속 충돌 감지 (Continuous Collision Detection)

> discrete 충돌은 프레임 끝 위치 **한 스냅샷**만 검사한다 — 빠른 물체는 한 스텝에 얇은 벽을 *건너뛰어*(tunneling) 충돌이 통째로 누락된다. CCD 는 *경로 전체*를 검사해 이를 막는다.
> **상위 노드**: [04-collision-detection.md](../04-collision-detection.md) · **상위 지도**: [README.md](../README.md) · **의존**: [04-gjk.md](04-gjk.md)(거리 질의) · [03-time-integration.md](../03-time-integration.md)

---

**tunneling(터널링) 조건**: 물체 이동거리 > 자기 두께. 총알·얇은 벽·고속 입자에서 발생한다. discrete 검사는 시작·끝 스냅샷 사이를 안 보므로, 한 스텝에 벽을 통과한 물체는 양 끝 어디서도 안 겹쳐 충돌이 사라진다.

**기법들** (정확·비쌈 → 근사·저렴 순으로 이해하면 좋다)

- **swept volume(쓸린 부피)**: 시작→끝 사이를 형상이 쓸고 간 부피를 만들어 그것과 충돌 검사. 정확하나 비싸다.
- **ray / shape cast**: 작은 물체는 광선(또는 형상) 캐스트로 경로 상 첫 충돌 시각(TOI, Time Of Impact)을 찾는다. 가속 구조([11](../11-spatial-structures.md))의 캐스트 질의를 재사용.
- **conservative advancement (CA)**: GJK 의 거리 질의([04-gjk](04-gjk.md))를 이용. 현재 분리거리만큼은 충돌 없이 전진해도 안전 → 그만큼 시간을 진행, 다시 거리 재고 반복하여 **최초 접촉 시각(TOI)**을 안전하게 좁힌다(Brian Mirtich). 물체를 TOI 까지만 적분한다.
- **speculative contacts (보수적 접근의 대세)**: 형상을 *부풀린* AABB 로 미리 접촉 후보를 잡고, 솔버에 "이 거리 이상 다가오지 말라"는 구속을 **미리** 넣는다. swept volume 도 별도 TOI 루프도 없이 *기존 솔버가* 침투를 막음 → 구현 단순·저비용·다중 동시 충돌에 강함. 단점: 너무 일찍 멈춰 보이는 **"ghost contact"**(공중 정지) 아티팩트 → 부풀림 거리(margin)·속도 임계 튜닝 필요. (Erin Catto GDC, Box2D/대다수 모던 엔진.)
- **sub-stepping**: 한 프레임을 작은 스텝으로 쪼개 매 sub-step 마다 discrete 검사. CCD 대용이자 솔버 정확도 향상. 비용은 sub-step 수배.

**비용/언제 켜는가** — CCD 는 비싸다. 보통 **선택적**으로: 고속 동적 객체(총알·발사체)에만 켜고, 일반 객체는 discrete + speculative 로 둔다. 엔진은 per-body "CCD enabled" 플래그 + 속도 임계로 게이팅한다.

---

**관련 함정** (전체 체크리스트는 [04-collision-detection §5](../04-collision-detection.md#5-함정--결정론-체크리스트)):
- **CCD 비용 폭발**: 전역 CCD 는 대량 객체에서 TOI 루프가 캐스케이드(한 TOI 가 다음을 유발)되며 프레임을 잡아먹는다 → per-body 게이팅 + speculative 기본화.
- **margin 튜닝의 양날**: margin 이 크면 ghost contact(공중 정지), 작으면 tunneling/지터. 속도·크기에 맞춰 조정.
- **fixed timestep 결합**: sub-stepping·TOI 는 고정 timestep([03](../03-time-integration.md))과 결정론([12](../12-determinism-networking.md))에 직결 — 스텝 분할 순서가 결정론적이어야 한다.

**다음**: 허브로 돌아가 [04-collision-detection.md](../04-collision-detection.md) 의 실무(§4)·함정(§5) 으로. CCD 의 출력(TOI·접촉)은 [05-constraint-solving](../05-constraint-solving.md) 의 입력이 된다.
