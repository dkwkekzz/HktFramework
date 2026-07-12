# feature-0019 — 렌더 분리: 세계 속성 → ViewModel → 렌더(속성 그대로)

> 상태: 🟢 검증됨 (step 1) · 작업 방식: [CLAUDE.md](../CLAUDE.md)
> 배경: 렌더 영역을 이후 완전히 다른 모듈로 교체할 수 있게 완전 분리해야 한다. 또 에너지 흐름 표현
> (열의 폭발·파이어볼·열의 흐름·에너지 발산)은 지금 대충이어도 이후 다채롭고 풍성하게 그릴 **기반**이 있어야 한다.
> 이 feature 는 그 파이프라인을 세우고, 법칙을 [CLAUDE.md](../CLAUDE.md) 불변 원칙 ③ 로 못 박는다.

## 명제

**렌더는 `세계 속성 → ViewModel → 렌더(속성 그대로)` 로만 그린다.** ViewModel 이 세계(미러 원장 +
스냅샷 + 로컬 sim)를 읽어 렌더 무관한 **Scene 데이터**(정규화된 세계 속성 + 타입 있는 이펙트 서술자)를
만들고, 렌더러는 그 Scene 만 **그대로** 소비한다. 렌더러는 세계 규칙을 재유도하지 않는 순수·교체 가능한
소비자다 — Scene 계약이 곧 교체 seam 이다. 미래의 리치 렌더 모듈(WebGL·파티클…)은 같은 Scene 을 받아
다르게 그린다.

## 왜 가르는가 (불변 원칙 ②·③)

리팩터 전 `client/render.js` 하나가 세 가지 다른 사건을 뭉치고 있었다 — **주체가 다르다**:

| 층 | 무엇 | 주체 | 소속 |
|---|---|---|---|
| **세계 규칙 해석** | 표적·acting·활력(vit)·phase 를 세계 상태에서 유도 | 세계(ViewModel) | `viewmodel.js` |
| **표현 매핑** | 의미(활력·종·cause)를 색·모양·아이콘·라벨로 | 렌더러 | `render.js` |
| **투영·드로잉** | 카메라·원근·캔버스 | 렌더러 | `render.js` |

특히 render.js 가 서버 `#desireTarget` 로직을 클라에서 **재구현**(`#desireTargetPos`·`#desireActing`)해
"드로잉이 시뮬 규칙을 복제"하는 개념 오류가 있었다. ViewModel 로 이관해 **미리 계산된 속성**
(`creature.target`·`creature.motive.acting`)으로 노출하니, 렌더러는 규칙을 모른 채 속성만 그린다.

## 이펙트 채널 — 에너지 흐름의 기반 (권위 tx 에서 파생)

에너지 흐름 이펙트(발산·폭발·연소·용해·파괴·열의 흐름·포식 흐름)는 **권위 OPS tx**
(`{from,to,amount,cause}`)에서 파생한 **타입 있는 서술자**로 노출한다 — 서버·프로토콜 변경 0.

- `ViewEffect = { type, cause, pos, from, to, amount, magnitude }`.
- `type` = `cause` + POOL 접두로 분류: `emission`(발산)·`explosion`(폭발)·`combustion`·`melt`·
  `shatter`·`flow`(열·반응·복사)·`transfer`(채집·강탈).
- **공간 해석**: pool id 접두(`C:`/`I:`/`B:`/`H:`/`M:`)로 종류, seq 로 개체 → 스냅샷 맵에서 pos.
  착탄으로 스냅샷에서 빠진 파이어볼 등은 ViewModel 이 유지하는 **pool→lastPos 캐시**로 마지막 위치를 잡는다.
- **지금은 대충, 이후 풍성하게**: step 1 은 이펙트를 **데이터로 채우고 테스트로만 검증**한다(현 시각 동일 유지
  → shot 회귀 통과). 리치 공간 VFX(폭발 섬광·발산 muzzle·열 파티클)는 후속 step 이 같은 서술자를 소비해 얹는다.

## 최종 목적 (측정 가능)

1. **렌더러 순수화**: `render.js` 는 `state`·`sim`·`ledger` 를 직접 읽지 않고 `Scene` 만 소비한다(교체 가능).
2. **재유도 제거**: 세계 규칙 해석(표적·acting·활력·phase)이 ViewModel 에 있고, 렌더러엔 없다.
3. **이펙트 기반**: 권위 tx → 타입 있는 이펙트 서술자(pos 해석·lastPos 캐시)가 파생된다(테스트로 재현).
4. **시각 불변**: 분리 후에도 화면 픽셀이 동일하다 — `npm run shot*` 이 리팩터 전과 같은 PNG.

## Scene 계약 (렌더 무관 데이터)

```
Scene = {
  self:      { id, pos, altitude, name, energy, capacity, hasCreature, creature, desire },
  players:   [{ id, pos, name, energy, capacity, isSelf }],
  creatures: [{ id, pos, energy, capacity, vitality, size, starving, starveT, faction,
                motive:{ name, acting, stack }, target:{ pos }|null }],
  crystals:  [{ id, pos, energy, magnitude, species, raw, crafted, tier, burning, heat }],
  field:     [{ cell:{cx,cy,cz}, magnitude, phase }],
  fireballs: [{ id, pos, energy, size }],
  effects:   [{ type, cause, pos, from, to, amount, magnitude }],
  world:     { total, src, sink, material, crystal, creature, checksum, bytesPerSec },
  txFeed:    [{ cause, amount, from:{kind,id,name}, to:{kind,id,name}, dir }],
}
```

## step 로드맵 (한 step = 한 커밋)

| step | 목표 | 검증 |
|---|---|---|
| **1** ✅ | Scene 계약 + `viewmodel.js` 신설, 세계 규칙 해석·재유도 전량 이관, 렌더러는 Scene 만 소비. **시각 동일**. 이펙트 채널은 데이터로 채우고 테스트로 검증(렌더 미적용). | `npm test`(+`viewmodel.test.js`) · `npm run shot`·`shot:blast` 픽셀 동일 |
| 2 | 폭발(0013 규칙 D) 공간 VFX — `effects` 의 `explosion` 서술자를 착탄점 섬광/충격파로 대충 렌더 | shot:detonate 새 기준 |
| 3 | 발산 muzzle·열의 흐름(flow) 파티클 — 같은 채널 소비 | shot:blast 갱신 |

## step 로그

| step | 한 일 | 검증 |
|---|---|---|
| 1 | **렌더 분리 파이프라인.** `client/viewmodel.js`(`ViewModel.build(t)→Scene`) 신설 — render.js 의 세계→시각 파생 전량 + `#desireTargetPos`/`#desireActing` 이관 + pool→pos 해석 + OPS tx→`effects` 파생 + pool→lastPos 캐시. `render.js` 는 `draw(scene)` 로 축소 — 카메라·투영·드로잉·표현 매핑(색·아이콘·라벨)만 남고 원시 상태 접근·규칙 재유도 제거, 클릭 피킹은 Scene 개체 히트테스트. `state.js` 에 이펙트 tx 버퍼(`effectTx`·`drainEffectTx`) 추가(txFeed 캡과 별개). `main.js` 가 `scene=viewmodel.build(t); render.draw(scene)` 로 결선. 드로잉 식은 픽셀 동일 유지. | `npm test` **204/204**(+`viewmodel.test.js` 5종: Scene 정규화 속성·표적/acting 선계산·이펙트 파생(발산=emission·폭발=explosion·pos 해석)·lastPos 캐시·tx 피드 종류/방향). **시각(PNG)**: `npm run shot`(craftchain — 생명체 오라·마칭앤츠 표적선·제조 결정·HUD·tx 라벨 동일)·`npm run shot:blast`(파이어볼 비행·`[발산]`/`[폭발]` tx 라벨이 `B:` 원 id 로 동일) — 리팩터 전과 픽셀 동일. |

## 검증 (항상 가능)

```bash
npm test            # test/viewmodel.test.js — Scene 정규화 속성·표적/acting 선계산·이펙트 파생·lastPos 캐시·tx 피드
npm run shot        # 시각(craftchain) — 분리 후에도 화면 동일(생명체·결정·오라·표적선·HUD·tx 피드)
npm run shot:blast  # 시각(발산·폭발) — 파이어볼 비행 + tx 피드 발산/폭발 라벨 동일
```
