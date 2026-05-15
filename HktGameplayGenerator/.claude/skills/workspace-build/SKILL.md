---
name: workspace-build
description: I-0008 — {Saved}/Workspace 트리에 놓인 2D 어셋 재료(atlas / frame sequence / video / static PNG)를 GameplayTag 단위로 자동 분류·등록하고 Paper2D DataAsset 까지 빌드하는 스텝.
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: [workspace_root] [force]
---

# workspace_build 스텝 실행

I-0008 의도를 따라 — 사용자가 워크스페이스에 재료를 떨어뜨리기만 하면, 자동으로 GameplayTag 를 등록하고 적절한 빌더를 호출해 인게임 DataAsset 까지 만든다.

## 인자

- `$1` — workspace_root (선택, 비우면 `{Saved}/Workspace/`)
- `$2` — force (선택, "true" 면 manifest 무시 강제 재빌드)

## 워크스페이스 컨벤션

```
{Root}/
  Paper2D/
    Paper2D.Entity.Character.Mage/         ← 폴더명 = GameplayTag (점 또는 _ 표기 혼용 허용)
      Animations/
        Idle/
          atlas_S.png                       ← Source=Atlas (Paper2D 빌더에 직접 전달)
          atlas_N.png
        Walk/
          N/ frame_001.png ...              ← Source=FrameSequence (방향별 시퀀스)
          S/ frame_001.png ...
        Cast.mp4                            ← Source=Video (단일 영상 → ffmpeg 추출)
    Paper2D.Prop.Tree.Oak/
      tree.png                              ← Mode=StaticVisual (단일 PNG → 정적 visual)
  HISM/                                     (1차 범위 외 — 미구현)
```

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
- `success: true` + `outputs[]`: UE 컨텐츠 경로 (DA_PaperVisual_*, DA_PaperCharacter_*, T_PaperAtlas_*, PFB_*)
- `skipped: true`: manifest fresh — 건너뜀
- `success: false` + `error`: 빌드 실패 — 원인 보고

### 4. (선택) 후속 검증

빌드 산출 자산이 실제로 ContentBrowser 에 노출됐는지 `list_assets` / `get_asset_info` 로 추가 확인 가능.

## 빌드 후 산출물 (Paper2D)

- `/Game/Generated/PaperSprites/{SafeTag}/DA_PaperVisual_{SafeTag}` — `UHktPaperActorVisualDataAsset` (런타임 SpawnEntity 진입점)
- `/Game/Generated/PaperSprites/{SafeTag}/DA_PaperCharacter_{SafeTag}` — `UHktPaperCharacterTemplate`
- `/Game/Generated/PaperSprites/{SafeTag}/PFB_*` — 방향별 `UPaperFlipbook`
- `/Game/Generated/PaperSprites/{SafeTag}/T_PaperAtlas_*` — `UTexture2D` (atlas)

## GameplayTag 자동 등록

미등록 태그는 `Config/Tags/HktWorkspaceTags.ini` 에 누적 기록되며 native 등록도 동시 수행 — 에디터 재시작 후에도 인식 보존. 기존 ini 에 이미 있으면 skip.

## 실패 처리

- 개별 Tag 실패 시 해당 항목만 건너뛰고 계속 진행 (results[] 의 success: false 로 표시).
- 모든 항목 실패 시 에러 메시지 보고하고 사용자에게 워크스페이스 형식 가이드 안내.
- `mode == Unknown` 다수 발견 시: 위 컨벤션 가이드를 사용자에게 보여줘 형식 정렬 권유.
