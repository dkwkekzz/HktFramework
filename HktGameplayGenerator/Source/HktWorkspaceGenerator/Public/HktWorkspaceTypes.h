// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.generated.h"

// ============================================================================
// I-0008 — 2D 어셋 자동 제작 Workspace
//
// 디렉터리 컨벤션 (2026-05 개정):
//   {Root}/
//     Paper2D/
//       {Paper2D.X.Y.Z}/                   ← 폴더명 = GameplayTag (점 또는 _ 표기 혼용)
//         {AnimName}/                      ← Tag 폴더 직속 서브폴더 1개라도 있으면 Character 모드
//           atlas_S.png  atlas_N.png  ...   ← (a) 방향별 Atlas (이미 패킹된 PNG)
//           N/ frame_001.png ...            ← (b) 방향별 FrameSequence
//           S/ frame_001.png ...
//           frame_001.png  frame_002.png    ← (c) 단일방향 FrameSequence — 빌더가 1-row strip atlas 로 묶음
//           Cast.mp4                        ← (d) 영상 — ffmpeg 으로 8방향 추출
//           anim_meta.json                  (선택 — columns/rows override)
//         tree.png                          ← StaticVisual — 직속 이미지 1장 + 서브폴더 0
//         entity_meta.json                  (선택 — 모든 entity 공용 사이드카)
//         .workspace.meta.json              (산출 — manifest)
//
//   AnimName → AnimTag 매핑:
//     - 폴더명에 `_` 또는 `.` 가 있으면 그대로 점 표기로 변환
//       ("Anim_Action_Strike" → "Anim.Action.Strike")
//     - 단순 단어이면 sprite_tools.py 호환 매핑 적용
//       (Idle/Walk/Run/Fall → Anim.FullBody.Locomotion.X, 그 외 → Anim.FullBody.X)
//
//   호환 분기:
//     - Tag 폴더 직속이 정확히 `Animations/` 폴더 하나뿐인 구버전 트리도 그대로 인식.
//
//     HISM/                                 ← Paper2D 와 동일 디렉터리 컨벤션.
//                                              빌드 산출: UHktHISMSpriteVisualAsset (Character/StaticVisual)
//                                                       + UHktHISMSpriteAnimationDataAsset (Character anim)
//
// ============================================================================

/** Workspace 카테고리 — 최상위 폴더명. */
UENUM()
enum class EHktWorkspaceCategory : uint8
{
	Unknown,
	Paper2D,
	HISM,
};

/** 단일 anim 입력 소스 형식. */
UENUM()
enum class EHktWorkspaceAnimSource : uint8
{
	None,
	/** atlas_{Dir}.png 가 이미 있음 — Paper2D 빌더에 그대로 전달. */
	Atlas,
	/** {Dir}/frame_*.png 시퀀스 — atlas 로 inline 패킹 필요. */
	FrameSequence,
	/** 단일 영상 — ffmpeg 로 atlas 추출. */
	Video,
};

/** 캐릭터/정적 분기. */
UENUM()
enum class EHktWorkspaceTagMode : uint8
{
	Unknown,
	/** Animations/ 가 있음 — 캐릭터 빌드 경로. */
	Character,
	/** 단일 PNG 한 장 — 정적 visual 빌드 경로. */
	StaticVisual,
};

/** 한 anim 의 입력 정보. */
USTRUCT()
struct FHktWorkspaceAnimInput
{
	GENERATED_BODY()

	/** 워크스페이스에 명시된 anim 이름 ("Idle", "Walk", ...). */
	UPROPERTY()
	FString Name;

	/** 해석된 anim 태그 ("Anim.FullBody.Locomotion.Idle" 등). */
	UPROPERTY()
	FString AnimTag;

	UPROPERTY()
	EHktWorkspaceAnimSource Source = EHktWorkspaceAnimSource::None;

	/** atlas / framesequence 모드에서 감지된 방향들 ("N","S","E",...). 영상은 비어있음. */
	UPROPERTY()
	TArray<FString> Directions;

	/** Source 별 입력 절대 경로:
	 *   Atlas         — Directions[i] 와 1:1 매칭되는 atlas_{Dir}.png 들
	 *   FrameSequence — Directions[i] 별 디렉터리 (frame_*.png 가 들어있음)
	 *   Video         — 영상 파일 한 개 (배열 길이 1)
	 */
	UPROPERTY()
	TArray<FString> SourcePaths;

	/** 워크스페이스 내 anim 폴더 절대 경로 — 사이드카(`anim_meta.json`) 위치.
	 *  SourcePaths 로부터 역산 시 source 타입별 분기가 필요해 스캐너에서 명시 채움. */
	UPROPERTY()
	FString FolderPath;
};

/** 한 Tag 폴더 = 1 산출물. */
USTRUCT()
struct FHktWorkspaceTagEntry
{
	GENERATED_BODY()

	UPROPERTY()
	EHktWorkspaceCategory Category = EHktWorkspaceCategory::Unknown;

	/** 폴더명 원본 (예: "Paper2D_Entity_Character_Mage" 또는 "Paper2D.Entity.Character.Mage"). */
	UPROPERTY()
	FString FolderName;

	/** 정규화된 GameplayTag 문자열 ("Paper2D.Entity.Character.Mage"). */
	UPROPERTY()
	FString TagString;

	/** 절대 경로 — {Root}/Paper2D/{FolderName}. */
	UPROPERTY()
	FString FolderPath;

	UPROPERTY()
	EHktWorkspaceTagMode Mode = EHktWorkspaceTagMode::Unknown;

	/** Character 모드 — 발견된 anim 들. */
	UPROPERTY()
	TArray<FHktWorkspaceAnimInput> Anims;

	/** StaticVisual 모드 — 입력 PNG 절대 경로. */
	UPROPERTY()
	FString StaticImagePath;

	/** Tag 가 사전 등록되어 있는가. false 면 빌드 전에 등록 필요. */
	UPROPERTY()
	bool bTagPreRegistered = false;
};

// ============================================================================
// 컨벤션 헬퍼 — 본 모듈 + Paper2D / SpriteGenerator 가 모두 동일 규약을 공유.
// 8 방향 + enum→string 매핑 한 곳에 모음.
// ============================================================================
namespace HktWorkspaceConventions
{
	constexpr int32 NumDirections = 8;

	inline const TCHAR* const* GetDirectionNames()
	{
		static const TCHAR* const Names[NumDirections] = {
			TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
			TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
		};
		return Names;
	}

	inline const TCHAR* GetDirectionName(int32 DirIdx)
	{
		return GetDirectionNames()[FMath::Clamp(DirIdx, 0, NumDirections - 1)];
	}

	inline bool IsDirectionName(const FString& Name)
	{
		const TCHAR* const* Names = GetDirectionNames();
		for (int32 i = 0; i < NumDirections; ++i)
		{
			if (Name.Equals(Names[i], ESearchCase::IgnoreCase)) return true;
		}
		return false;
	}

	inline const TCHAR* AnimSourceToString(EHktWorkspaceAnimSource S)
	{
		switch (S)
		{
			case EHktWorkspaceAnimSource::Atlas:         return TEXT("atlas");
			case EHktWorkspaceAnimSource::FrameSequence: return TEXT("frame_sequence");
			case EHktWorkspaceAnimSource::Video:         return TEXT("video");
			default:                                      return TEXT("none");
		}
	}

	inline const TCHAR* TagModeToString(EHktWorkspaceTagMode M)
	{
		switch (M)
		{
			case EHktWorkspaceTagMode::Character:    return TEXT("Character");
			case EHktWorkspaceTagMode::StaticVisual: return TEXT("StaticVisual");
			default:                                  return TEXT("Unknown");
		}
	}
}
