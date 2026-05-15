// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "HktWorkspaceTypes.generated.h"

// ============================================================================
// I-0008 — 2D 어셋 자동 제작 Workspace
//
// 디렉터리 컨벤션:
//   {Root}/
//     Paper2D/
//       {Paper2D.X.Y.Z}/                   ← 폴더명 = GameplayTag (점 또는 _ 표기 혼용)
//         Animations/                      ← (optional) 캐릭터 모드
//           Idle/                          ← anim 이름 → AnimTag 해석
//             atlas_S.png                   ← Source=Atlas (이미 패킹된 PNG)
//             atlas_N.png
//             atlas_meta.json               (선택)
//           Walk/
//             N/ frame_001.png ...          ← Source=FrameSequence (방향별 시퀀스)
//             S/ frame_001.png ...
//           Cast.mp4                        ← Source=Video (단일 영상)
//         tree.png                          ← Source=StaticImage (정적 1장)
//         character_meta.json               (선택)
//         .workspace.meta.json              (산출 — manifest)
//     HISM/                                 ← 카테고리 확장 슬롯 (1차에서는 인터페이스만)
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
