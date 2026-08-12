# VOCABULARY.md — GameView 공개 시각 어휘

**Cycle 트랙이 읽는 유일한 GameView 문서.** View Definition 은 이 문서에 ✅ 로 공개된 어휘만 binding 할 수 있다.

상태: ✅ 공개(사용 가능) · 🔨 구현 중 · ⏳ 로드맵(미착수) · — 계획 없음

필요한 어휘가 ⏳ 이거나 없으면: 기존 ✅ Primitive 조합으로 우회하거나, [proposals/](proposals/) 에 Capability Proposal 을 생성한다. GameView 내부 코드를 직접 수정하지 않는다.

## 1. Scene / Camera

| 어휘 | 파라미터 | 상태 |
|---|---|---|
| Scene | create / tick / dispose | ⏳ |
| Camera | position, target, zoom, orbit / pan·orbit·zoom 입력 | ⏳ |
| Entity Selection | pick(screen→entity id), focus | ⏳ |

## 2. 3D Primitive

| 어휘 | 파라미터 | 상태 |
|---|---|---|
| Terrain | surface(heightmap/plane), material, position, scale | ⏳ |
| Plane | position, size, color | ⏳ |
| Box | position, size, color | ⏳ |
| Line3D | points[], color, width | ⏳ |
| Point | position, size, color | ⏳ |

## 3. Billboard / 2D Primitive

| 어휘 | 파라미터 | 상태 |
|---|---|---|
| SpriteBillboard | position, size, anchor, sprite(catalog key), facing, opacity, layer, visible | ⏳ |
| TextBillboard | position, text, size, color | ⏳ |
| IconBillboard | position, icon(catalog key), size | ⏳ |
| Circle | center, radius, color, fill | ⏳ |
| Rectangle | position, size, color, fill | ⏳ |
| Triangle | position, size, rotation, color | ⏳ |
| Polygon | points[], color, fill | ⏳ |
| Line2D | points[], color, width | ⏳ |
| Text | position, text, size, color | ⏳ |

## 4. Composition

| 어휘 | 파라미터 | 상태 |
|---|---|---|
| Group | children[], position, layer | ⏳ |
| Attach (parent/child) | parent, offset, anchor | ⏳ |

## 5. Visual Library v0

| 어휘 | 파라미터 | 상태 |
|---|---|---|
| CharacterBillboard | position, sprite, label? | ⏳ |
| ResourceMarker | position, sprite | ⏳ |
| NameLabel | attach, text | ⏳ |
| ValueBar | attach, value, max | ⏳ |
| SelectionRing | attach or center, radius | ⏳ |
| FloatingText | position, text, duration | ⏳ |
| RangeIndicator | center, radius | ⏳ |

## 6. Animation Vocabulary v0

| 어휘 | 파라미터 | 상태 |
|---|---|---|
| move / moveOffset | target, to/offset, duration | ⏳ |
| rotate / rotateToward | target, to/other, duration | ⏳ |
| scale | target, to, duration | ⏳ |
| fade | target, to, duration | ⏳ |
| pulse | target, magnitude, duration | ⏳ |
| flash | target, color, duration | ⏳ |
| shake | target, magnitude, duration | ⏳ |
| spawn / despawn | target | ⏳ |
| sequence / parallel / repeat / wait | steps[] | ⏳ |

## 7. Visual Asset Catalog

| 어휘 | 설명 | 상태 |
|---|---|---|
| Catalog 등록/조회 | key → sprite asset. World 는 key 만 안다 | ⏳ |

## 8. 소비 방법

(첫 어휘 공개 시 GameView 트랙이 여기에 import 경로·초기화 예시를 기록한다.)
