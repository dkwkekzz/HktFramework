# 스프라이트 3-Stage 파이프라인 — Workspace 기반 폴더 구성 & 사용법

3 Stage 가 단일 **Workspace** 를 공유하며 컨벤션 경로로 자동 연결된다. 캐릭터 태그만 일치시키면 Stage 1·2·3 사이에 별도 입력 전달이 필요 없다.

---

## Workspace 정의

```
{ProjectSavedDir}/SpriteGenerator/{SafeChar}/      ← Workspace 루트
└── {SafeAnim}/
    ├── N/    frame_0001.png ...                  ← Stage 1 산출 (방향별 frame bundle)
    ├── NE/   ...
    ├── ... (8 방향)
    │
    ├── atlas_N.png                                 ← Stage 2 산출 (방향별 strip atlas PNG)
    ├── atlas_NE.png
    ├── ... (발견된 방향만)
    └── atlas_meta.json                             ← Stage 2 메타 (cellW/H/frameCount per Dir)
```

`{SafeChar}`, `{SafeAnim}` = GameplayTag 의 `.` 을 `_` 로 치환한 SafeName.

UE 컨텐트 사이드 (Stage 3 가 빌드 시 임포트):
```
/Game/Generated/Sprites/
├── T_SpriteAtlas_{SafeChar}_{SafeAnim}_{Dir}      ← Stage 3 가 Workspace PNG 를 즉석 임포트
└── DA_SpriteCharacter_{SafeChar}                   ← Stage 3 산출 (캐릭터당 1개, 누적 upsert)
```

---

## 데이터 모델

```
FHktSpriteAnimation
├── AtlasSlots : TArray<FHktSpriteAtlasSlot>   ← 분할 시 N개
│   └── FHktSpriteAtlasSlot { Atlas, CellSize }
└── Frames     : TArray<FHktSpriteFrame>
    └── FHktSpriteFrame { AtlasSlotIdx, AtlasIndex, ... }
```

---

## Tools Window — `HktSprite.Tools`

| 탭 | 단계 | 입력 | 산출 |
|---|---|---|---|
| **Video Extract** | Stage 1 | CharacterTag, AnimTag, Direction, VideoPath, ffmpeg 옵션 | `{Workspace}/{Anim}/{Dir}/frame_*.png` |
| **Atlas Pack** | Stage 2 | CharacterTag, (옵션) AnimTagFilter | `{Workspace}/{Anim}/atlas_{Dir}.png` + `atlas_meta.json` |
| **Sprite Builder** | Stage 3 | CharacterTag, PixelToWorld, (옵션) Animations[] {AnimTag, CellW, CellH} | UE Texture2D 임포트 + `DA_SpriteCharacter_{Char}` |

---

## Stage 1 — Video Extract

비디오 1개 → 단일 방향 frame bundle. 8 방향이 필요하면 Direction 을 바꿔 8 회 실행.

**입력 필드**: CharacterTag · AnimTag · Direction · VideoPath · FrameWidth/Height · FrameRate · MaxFrames · Start/EndTimeSec

**산출**: `{Workspace}/{SafeAnim}/{Dir}/frame_*.png`

같은 방향을 재추출하면 그 디렉터리만 정리하고 새로 채운다 (다른 방향 보존).

**API**: `EditorExtractVideoBundle(CharTag, AnimTag, DirIdx, VideoPath, ...)`

---

## Stage 2 — Atlas Pack

`{Workspace}/{Anim}/{Dir}/frame_*.png` 들을 방향별 1행 N열 strip atlas 로 패킹. UE 임포트는 하지 않는다 — 디스크 PNG + 메타 사이드카만.

**입력 필드**: CharacterTag · (옵션) AnimTagFilter

**산출**:
- `{Workspace}/{SafeAnim}/atlas_{Dir}.png` — strip atlas PNG (방향별)
- `{Workspace}/{SafeAnim}/atlas_meta.json` — `{ characterTag, animTag, directions: [{dir, cellW, cellH, frameCount}, ...] }`

**API**: `EditorPackDirectionalAtlases(CharTag, AnimTagFilter="")`

---

## Stage 3 — Sprite Builder (Directional)

Workspace 의 anim 폴더들을 자동 발견해 빌드. 각 anim 의 `atlas_{Dir}.png` 를 즉석 임포트하여 `T_SpriteAtlas_{Char}_{Anim}_{Dir}` Texture2D 를 만들고 `DA_SpriteCharacter_{Char}` 에 누적.

**입력 필드 (Common)**: CharacterTag · PixelToWorld

**입력 필드 (Animations 배열, 선택)**: AnimTag · CellWidth · CellHeight
- Animations 가 비어있으면 Workspace 의 모든 anim 폴더 자동 발견 (셀 크기 자동).
- 채워두면 해당 anim 만 명시 셀 크기로 빌드.

**셀 크기 결정 우선순위**:
1. 사용자 입력 (`CellWidth`, `CellHeight` > 0)
2. Stage 2 가 남긴 `atlas_meta.json` 의 cellW/cellH
3. atlas 종횡비 폴백 (CellH = AtlasH, CellW = AtlasW / FrameCount)

**동작**:
1. Workspace 8 방향 순회 → 이미 임포트된 Texture2D 가 있으면 LoadObject, 아니면 atlas_{Dir}.png 임포트.
2. 발견된 슬롯 수에 따라 `NumDirections` 양자화 (1 / 5 / 8).
3. `Frames[d * FPD + f]` 에 `AtlasSlotIdx = d`, `AtlasIndex = f`.
4. `DA_SpriteCharacter_{Char}` upsert — 호출한 anim 만 교체/추가.

5 방향 양자화 시 W/SW/NW 슬롯은 비워두고 `bMirrorWestFromEast = true` — 런타임이 E/SE/NE 를 flipX 로 처리.

**API**: `BuildSpriteAnim(CharTag, AnimTag, CellW=0, CellH=0, PixelToWorld=2.0)`

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| Stage 2: `"Bundle 루트 없음"` | Stage 1 미실행, 또는 CharacterTag SafeName 불일치 |
| Stage 3: `"Workspace 에 atlas_{Dir}.png 가 없음"` | Stage 2 미실행 — Atlas Pack 먼저 실행 |
| 일부 방향만 렌더링됨 | 해당 방향의 atlas_{Dir}.png 가 Workspace 에 없음. Stage 1/2 그 방향만 재실행 |
| 셀 종횡비가 틀어짐 | atlas_meta.json 손상 또는 Stage 1 의 ffmpeg 출력 해상도 불일치. anim entry 에 CellW/H 명시 |
| 셀 크기 불일치 경고 | 방향마다 strip 높이가 다름 — Stage 1 의 ffmpeg 해상도가 일관된지 확인 |

---

## 콘솔 커맨드

| 커맨드 | 동작 |
|---|---|
| `HktSprite.Tools` | Tools 창 오픈 (Builder 탭) |
| `HktSprite.Builder` | Tools 창 → Sprite Builder 탭 |
| `HktSprite.AnimCapture` | Tools 창 → Anim Capture 탭 |

---

## 관련 문서

- 데이터 모델 / 런타임 동작: [SpriteDataAssetSetupGuide.md](SpriteDataAssetSetupGuide.md)
- Crowd 렌더러 설계: [Design-HktSpriteNiagaraCrowdRenderer.md](Design-HktSpriteNiagaraCrowdRenderer.md)
