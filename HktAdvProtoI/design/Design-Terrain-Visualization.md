# Design — 지형 시각화 (지면 구역 장치)

status: IMPLEMENTED — `SceneGroundZone` 이 섰고(engine/view-kernel/scene · renderer)
C-TERRAIN-001 의 Stage 8 이 그것으로 검증을 닫았다.
최종 모양은 04 의 `engine_contract` 가 정했다 — 원만, `rect`·폴리곤은 빼고,
`intensity` 는 다음 Cycle 의 예고를 위해 지금 넣었다.
재현: `CHROMIUM_PATH=<크로뮴> npm run terrain:shot -- <png>`

## 목적

땅이 법칙을 지니면(`master/frontier/terrain.md` SELECTED) 그것이 화면에서 읽혀야 한다.
이 문서는 그 시각화를 **어느 레인이 무엇으로 세우는가**를 정한다 — 기반/컨텐츠 분리
(Design-System-Content-Separation.md)와 설계 반전 ⑤(capability 는 엔진, 결정은 팩)를
지형에 적용한 것이다.

## 요구 분해 — 무엇이 보여야 하는가

FR-THE-GROUND-HAS-A-LAW 의 Observable Result 를 화면 요구로 분해하면 넷이다.

| # | 보여야 하는 것 | 기존 capability 로 되는가 |
|---|---|---|
| ① | 법칙이 걸린 자리의 **범위**가 땅 위에 보인다 | ✗ — 지면 구역 프리미티브가 없다 |
| ② | 예외 자리(멎는 곳)의 **범위**가 구분되어 보인다 | ✗ — 같은 결손 |
| ③ | 지금 내 몸에 어느 법칙이 작용 중인가 + 사유 | ○ — `SceneSelf.lines` · HUD · surface row |
| ④ | 값이 줄어드는 것 / 멎는 것 | ○ — HUD counter + progress |

ENGINE 에 새로 필요한 능력은 정확히 하나다 — **지면 위 구역을 그린다**.
나머지는 전부 기존 능력 위의 데이터다.

## 소유 분해 — 누가 무엇으로 세우는가

```text
ENGINE 레인          SceneGroundZone 프리미티브 + 렌더러 구현. 의미 없음(meaning-free) —
                     "법칙"도 "예외"도 모른다. 범위·색·테두리를 그릴 뿐이다
C-TERRAIN-001        관찰 계약 — protocol/gameview-terrain.ts · semantic-id-terrain.ts
  (WORLD·TERRAIN)      신규 도메인 파일. 무엇을 싣는지는 Stage 4(04)가 확정한다
                       (DC-WORLD-OWNS-THE-SURFACE-LIST)
                     세계 구현 — 자리 정의 · drain 규칙 · 예외 판정 (Stage 6.
                       선례: GuardedGround · cp-run-drain · DepositState · WORLD_BOUNDS)
                     표현 결정 — view/terrain-presentation.ts: 법칙 의미코드 → 색·문구·
                       intensity. 사유 코드 → HUD 줄 (Stage 7)
VIEW 레인 (V-NNN)    등장하지 않는다 — 관찰 계약이 바뀌는 작업이라 전부 Cycle 소유다
```

view 는 판정을 스스로 계산하지 않는다 — 작용 중인가·안인가는 세계가 보낸 값 그대로,
view 는 스타일만 정한다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

## ENGINE — SceneGroundZone

`engine/view-kernel/scene/scene-state.ts` 에 더하는 프리미티브. **초안이다** — 최종
모양은 04 가 관찰 표면을 확정한 뒤 그에 맞춰 굳힌다.

```ts
/** 지면 위 구역 하나 — 무엇의 구역인지 이 형도 그리는 쪽도 모른다 (설계 반전 ⑤) */
export interface SceneGroundZone {
  id: string;
  shape: { kind: 'circle'; center: { x: number; z: number }; radius: number }
       | { kind: 'rect'; min: { x: number; z: number }; max: { x: number; z: number } };
  fill?: { color: number; opacity: number };
  edge?: { color: number; opacity: number; width: number };
  /** 0..1 — 맥동·강조. "지금 작용 중"을 팩이 이 값으로 표현한다 */
  intensity?: number;
  /** 형식화 완료된 구역 이름 — 없으면 안 그린다 */
  label?: string;
}
// SceneState 에 zones: SceneGroundZone[] 추가 — 기존 필드 뒤에 append
```

폴리곤 shape 는 요구가 실제로 생길 때 더한다 — 지금 넣지 않는다.

### 렌더러 구현

`heightAt(x,z)` 를 샘플링하는 **반투명 오버레이 메시**로 그린다 — 구역마다 지형을
따라가는 링+채움 메시를 지면에서 조금(+0.02) 띄워 올린다. 스프라이트·트레일·라벨이
지면에 붙는 기존 관용구와 같다.

기각한 대안:

```text
지형 vertex color 다시 칠하기   싸지만 segments 해상도에 묶이고 경계가 뭉개진다 —
                               예외 자리처럼 작은 원을 못 그린다
프로젝션 데칼                   품질은 최고지만 이 단계 요구 대비 과하다
```

### Fallback

렌더러의 기존 규칙(미지원 지시도 field 로 그려 게임을 멈추지 않는다)을 그대로 잇는다 —
`zones` 가 없거나 비면 아무것도 그리지 않고 게임은 돈다. 그래서 ENGINE 산출이 늦어도
Cycle 은 멈추지 않는다(③④는 HUD 로 이미 읽힌다). 다만 Stage 8 검증("어디에 서 있는가가
결과를 바꾼다"가 화면에서 읽히는가)은 ①②를 요구하므로 **검증 전에는 합류해야 한다**.

## 진행 순서

```text
1. C-TERRAIN-001 Stage 1–4      04 가 관찰 표면을 확정할 때까지 ENGINE 은 착수하지 않는다
                                — 프리미티브 모양이 04 에 정확히 맞아야 재작업이 없다
2. ENGINE 착수 (기반 트랙 작업)  Stage 5(Human 리뷰)·Stage 6(World 구현)이 도는 창이
                                ENGINE 의 작업 시간이다
3. Stage 7 View 구현            ENGINE 산출을 소비. 아직이면 zones 매핑까지 해 두고
                                fallback(안 그림)으로 진행한다
4. Stage 8 검증                 ①②③④ 전부 화면에서 — 이 시점엔 ENGINE 합류 필수
```

발견 경로는 배차판이다 — `LANES.md` 의 ENGINE·WORLD·TERRAIN 줄과 충돌표
(WORLD·TERRAIN ↔ ENGINE)가 이 문서로 오는 참조를 지닌다. 착수 세션은 works.md 규칙대로
자기 줄의 상태(RUNNING · 작업 ID)만 갱신하면 된다. ENGINE 의 기존 부채(표시 문구 →
사유 코드 회수)와 이 작업은 방향이 같으므로 한 세션이 순서대로 둘 다 지나가도 자연스럽다.

## 하지 않는 것

```text
여덟 대지형·바이옴 아트      법칙 하나 · 예외 하나로 축이 서는지만 본다 (frontier "이 기능이 아닌 것")
예고 시각화(퍼지는 무늬)     FR-THE-LAND-SHOWS-BEFORE-IT-TAKES 의 몫 — 다만 intensity 필드를
                            지금 넣어 두면 다음 Cycle 이 엔진 수정 없이 예고 강도를 실을 수 있다
미니맵 · 경고 UI            세계의 사실이 아닌 화면의 친절은 이 트랙이 금지한 방향이다
Cycle 안에서 engine/ 편집    경계는 npm run boundary:check 가 강제한다 (works.md 승격 규칙)
```
