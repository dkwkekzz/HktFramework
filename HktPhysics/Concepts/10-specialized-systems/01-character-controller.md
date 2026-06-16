# [10·2.1] 캐릭터 컨트롤러 (Character Controller)

> 플레이어/NPC 가 "물리적으로 정확한 강체"가 아니라 "반응성 좋은 게임플레이 객체"로 움직이게 하는 특화 솔버 — collide-and-slide, 계단 오르기, 경사 한계, 접지, 무빙 플랫폼.
> **상위 노드**: [10-specialized-systems.md](../10-specialized-systems.md) · **상위 지도**: [README.md](../README.md) · **의존**: [04-collision-detection](../04-collision-detection.md) (swept/raycast) · [01-kinematics](../01-kinematics.md) (운동학 바디)

---

캐릭터는 미끄러지지 않고 계단을 오르고, 벽에 부딪혀도 멈추지 않고 미끄러지며, 경사에서는 적당히 흘러내려야 한다. 이런 거동은 강체 솔버에 그냥 맡기면 나오지 않는다 — *특수 규칙을 끼워 넣은 전용 컨트롤러*가 필요하다.

## 두 가지 구현 철학

- **Kinematic(직접 이동, 운동학 바디)** — 캐릭터를 운동학 바디([01](../01-kinematics.md) 운동학 바디 참조)로 두고 *직접 위치를 명령*한다. 물리 솔버가 캐릭터에 힘을 가하지 않으며, 캐릭터가 일방적으로 세계를 밀어낸다. 이동 의도(desired velocity)를 받아 매 프레임 충돌을 풀며 위치를 갱신한다. 통제가 쉽고 결정적(deterministic)이라 대부분의 게임이 채택한다.
- **Dynamic(rigid body 캡슐)** — 캡슐 형태의 *진짜 동역학 강체*에 힘/임펄스를 가해 이동한다. 환경과 양방향 상호작용(상자를 밀고 밀림)이 자연스럽지만, 미끄러짐·기울어짐·끼임을 추가 구속(upright constraint 등)으로 잡아야 해 통제가 어렵다.

대부분의 상용 게임은 kinematic 을 기본으로 하고, 필요한 곳(밀리는 상자 등)만 동역학 상호작용을 흉내 낸다.

## Collide-and-slide (충돌 후 미끄러짐)

kinematic 컨트롤러의 심장. 원하는 이동 벡터를 충돌면을 따라 *투영(project)* 하여 벽에 부딪혀도 멈추지 않고 미끄러지게 한다. 한 번이 아니라 **여러 번 반복 투영**(보통 3~5회)하여 코너(두 벽이 만나는 곳)에서 끼이지 않게 한다.

```
function CollideAndSlide(pos, velocity, maxIters):
    remaining = velocity
    for i in 0..maxIters:
        hit = SweepCapsule(pos, remaining)        # swept 충돌 [04]
        if not hit:
            pos += remaining
            break
        pos += remaining * hit.t                   # 충돌 지점까지 이동
        # 충돌면 법선으로 잔여 이동을 투영(미끄러짐 평면에 사영)
        leftover = remaining * (1 - hit.t)
        remaining = leftover - dot(leftover, hit.normal) * hit.normal
        if length(remaining) < epsilon: break
    return pos
```

투영의 핵심은 잔여 이동에서 *충돌 법선 방향 성분을 빼는 것*(`leftover - dot(leftover, n) * n`) — 곧 [01-vectors](../00-foundations/01-vectors.md) 의 사영(projection)이다. 법선 방향 속도를 제거하면 벽을 파고들지 않고 벽면을 따라 흐른다.

## 지면 처리 규칙

- **Step offset(계단 오르기)** — 작은 턱(예: 0.3~0.4m 이하)은 충돌로 막지 않고 *위로 들어올린 뒤 전진, 다시 내려놓는* 시퀀스(up-sweep → forward-sweep → down-sweep)로 자연스럽게 오른다. **세 단계를 모두** 지켜야 한다 — down-sweep 을 빠뜨리면 캐릭터가 공중에 뜨거나 경사에서 튄다.
- **Slope limit(경사 한계)** — 지면 법선과 up 벡터의 각도가 한계(예: 45°)를 넘으면 "걸을 수 있는 바닥"이 아니라 "벽/미끄럼면"으로 취급해 미끄러져 내려가게 한다. 판정은 `dot(groundNormal, up)` 를 한계각의 코사인과 비교한다.
- **Ground detection(접지 판정)** — 캐릭터 발밑으로 짧은 sweep/ray 를 쏴 접지 여부·지면 법선을 얻는다. 점프 가능 여부, 중력 적용, 경사 처리의 기준이 된다. 미세한 틈에서 깜빡이는 것을 막으려 약간의 hysteresis(접지 유지 거리)를 둔다.
- **무빙 플랫폼(moving platform)** — 접지한 플랫폼의 프레임 간 변환(delta transform)을 캐릭터에 *부모처럼 적용*해 함께 실려 가게 한다. 회전 플랫폼은 위치뿐 아니라 **회전 delta** 도 캐릭터 위치에 반영해야 한다 — 안 그러면 회전 플랫폼 위에서 캐릭터가 미끄러진다. 또 플랫폼 적용 시점(캐릭터 갱신 전/후)에 따라 한 프레임 어긋남(jitter)이 생기므로 결정론·재현성에서 까다로운 지점이다.

## 실무

- **Jolt — `CharacterVirtual`** : 코어 강체와 분리된 kinematic 캐릭터 컨트롤러. collide-and-slide, step/slope, 무빙 플랫폼, 다른 캐릭터 간 상호작용을 내장. 결정론을 중시하는 모던 구현의 기준선.
- **UE5 Chaos — Character Movement** : UE는 전통적으로 `CharacterMovementComponent`(완전 커스텀 kinematic, 네트워크 예측 내장)를 쓰며, Mover/Chaos 기반 캐릭터로 이행 중.

---

**관련 함정** (전체 체크리스트는 [10-specialized-systems §5](../10-specialized-systems.md#5-함정--결정론-체크리스트)):
- **Collide-and-slide 반복 횟수**: 너무 적으면 코너에서 끼이고(stuck), 너무 많으면 비용↑·미세 떨림(jitter). 잔여 속도 epsilon 컷오프로 무한 진동을 막는다.
- **Step offset down-sweep 누락**: up→forward 만 하고 down-sweep 을 빠뜨리면 공중에 뜨거나 튄다. 3단을 모두 지킨다.
- **무빙 플랫폼 회전·타이밍**: 회전 delta 누락 시 미끄러짐, 적용 시점 어긋남 시 한 프레임 jitter.
- **Raycast/sweep 비결정성**: ground sweep 이 broad-phase 순회 순서·부동소수점([00](../00-foundations.md))에 민감 → 질의 순서 고정, fixed timestep 안에서만 ([12](../12-determinism-networking.md)).

**다음**: [02-vehicle-dynamics](02-vehicle-dynamics.md) — 차체 하나에 바퀴 4개의 힘을 합산하는 차량 솔버.
