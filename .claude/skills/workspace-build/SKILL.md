---
name: workspace-build
description: I-0015 — {Saved}/Workspace 의 2D 어셋 재료를 GameplayTag 로 자동 분류·등록하고 Paper2D DataAsset 까지 빌드한다.
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: [workspace_root] [force]
---

# workspace_build 스텝 실행

[I-0015 (콘텐츠 자동화 및 에셋 파이프라인)](../../../Docs/intents/I-0015.md) 의도를 따라 — 사용자가 워크스페이스에 재료를 떨어뜨리기만 하면, 자동으로 GameplayTag 를 등록하고 적절한 빌더를 호출해 인게임 DataAsset 까지 만든다.

## 인자

- `$1` — workspace_root (선택, 비우면 `{Saved}/Workspace/`)
- `$2` — force (선택, "true" 면 manifest 무시 강제 재빌드)

## 워크스페이스 컨벤션 (2026-05 개정)

핵심 규칙:
- **Tag 폴더 직속 서브폴더가 하나라도 있으면 = Character 모드**, 각 서브폴더가 하나의 anim. 폴더명이 그대로 AnimTag.
- **Tag 폴더 직속 이미지만 있고 서브폴더 0 → StaticVisual 모드** (단일 PNG 사용).
- 더 이상 `Animations/` 래퍼를 강제하지 않음 (구버전 트리 호환은 유지).

```
{Root}/
  Paper2D/
    Entity_Character_Mage/                 ← 폴더명 = GameplayTag (점 또는 _ 혼용 허용)
      Anim_FullBody_Locomotion_Idle/       ← (a) 방향별 Atlas
        atlas_S.png  atlas_N.png  ...
      Anim_FullBody_Locomotion_Walk/       ← (b) 방향별 FrameSequence
        N/ frame_001.png ...
        S/ frame_001.png ...
      Anim_Action_Strike/                  ← (c) 단일방향 frame sequence
        frame_001.png  frame_002.png ...     →  1-row strip atlas 로 자동 패킹
                                              (가로 칸 = 프레임 수)
      Anim_Action_Cast/
        Cast.mp4                             ← (d) Video — ffmpeg 8방향 추출
      anim_meta.json                        (선택 — columns/rows override)
      entity_meta.json                      (선택 — frameDurationMs/pixelToWorld override; 모든 entity 공용)
    Entity_Natural_Oak/
      oak.png                               ← StaticVisual (서브폴더 0 + 이미지 1장)
  HISM/                                     (Paper2D 와 동일 컨벤션)
    Sprite_Character_Knight/
      Idle/  Walk/  Attack/                  ← Character — BuildSpriteAnim bridge
    Sprite_Prop_Tree_Oak/
      oak.png                                ← StaticVisual — EditorBuildHISMStaticVisual
```

### AnimName → AnimTag 매핑

- 폴더명에 `_` 또는 `.` 가 있으면 → 그대로 점 표기로 변환
  - `Anim_FullBody_Locomotion_Idle` → `Anim.FullBody.Locomotion.Idle`
  - `Anim_Action_Strike` → `Anim.Action.Strike`
- 단순 단어 → sprite_tools.py 호환 자동 매핑
  - `Idle`/`Walk`/`Run`/`Fall` → `Anim.FullBody.Locomotion.X`
  - 그 외 → `Anim.FullBody.X`

### 단일 atlas 입력의 grid 가 모호한 경우

단일 PNG 한 장만 anim 폴더에 있는데 그것이 이미 패킹된 시트(예: 8 컬럼)인지, 단일 프레임인지 빌더가 결정할 수 없으면:
1. `anim_meta.json` 에 `{"columns": N, "rows": M, "frameCount": K}` 를 적어두거나
2. 사용자에게 `가로 칸 수(columns)` 를 직접 묻고 진행

frame_*.png 시퀀스 입력은 항상 1-row strip 으로 묶이므로(가로 칸 수 = 프레임 수) 별도 입력 불필요.

## 실행 절차

### 1. 워크스페이스 스캔 (선행 인식)

MCP 도구 `list_workspace_tags` 호출:
- `workspace_root`: $1 (또는 빈 문자열)

응답의 `entries[]` 검토 — 각 항목별 다음을 확인:
- `category`: "Paper2D" / "HISM"
- `tag`: 정규화된 GameplayTag ("Paper2D.X.Y.Z")
- `mode`: "Character" / "StaticVisual" / "Unknown"
- `tagPreRegistered`: false 이면 빌드 시 ini 자동 등록 예정
- `upToDate`: true 이면 manifest 가 입력 해시와 일치 — skip 가능
- `anims[]`: anim 별 source / directions

`mode == Unknown` 인 항목이 있으면 사용자 입력 형식 점검 (필수 파일 누락 가능성 — 폴더 내용 확인 후 사용자에게 보고).

### 2. 일괄 빌드 또는 선별 빌드 결정

- 전부 빌드: `workspace_scan_and_build_all`
  - `workspace_root`: $1
  - `force`: $2 (기본 false — manifest fresh 면 skip)
- 일부 선별 빌드: 항목마다 `workspace_build_tag`
  - `category`: "Paper2D"
  - `tag_folder_name`: 폴더명 (entries[*].folderName)
  - `force`: 필요 시 true

### 3. 빌드 결과 보고

각 `results[]` 항목별로:
- `success: true` + `outputs[]`: UE 컨텐츠 경로 (DA_PaperVisual_*, DA_PaperAnimation_*, T_PaperAtlas_*, PFB_*)
- `skipped: true`: manifest fresh — 건너뜀
- `success: false` + `error`: 빌드 실패 — 원인 보고

### 4. (선택) 후속 검증

빌드 산출 자산이 실제로 ContentBrowser 에 노출됐는지 `list_assets` / `get_asset_info` 로 추가 확인 가능.

## 빌드 후 산출물 (Paper2D)

- `/Game/Generated/PaperSprites/{SafeTag}/DA_PaperVisual_{SafeTag}` — `UHktPaperActorVisualDataAsset` (런타임 SpawnEntity 진입점)
- `/Game/Generated/PaperSprites/{SafeTag}/DA_PaperAnimation_{SafeTag}` — `UHktPaperAnimationDataAsset`
- `/Game/Generated/PaperSprites/{SafeTag}/PFB_*` — 방향별 `UPaperFlipbook`
- `/Game/Generated/PaperSprites/{SafeTag}/T_PaperAtlas_*` — `UTexture2D` (atlas)

## GameplayTag 자동 등록

미등록 태그는 `Config/Tags/HktWorkspaceTags.ini` 에 누적 기록되며 native 등록도 동시 수행 — 에디터 재시작 후에도 인식 보존. 기존 ini 에 이미 있으면 skip.

## 실패 처리

- 개별 Tag 실패 시 해당 항목만 건너뛰고 계속 진행 (results[] 의 success: false 로 표시).
- 모든 항목 실패 시 에러 메시지 보고하고 사용자에게 워크스페이스 형식 가이드 안내.
- `mode == Unknown` 다수 발견 시: 위 컨벤션 가이드를 사용자에게 보여줘 형식 정렬 권유.
