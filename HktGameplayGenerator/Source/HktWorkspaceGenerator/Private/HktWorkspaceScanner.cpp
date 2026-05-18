// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceScanner.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceSettings.h"

#include "GameplayTagsManager.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"

namespace
{
	using HktWorkspaceConventions::IsDirectionName;

	bool IsImageExt(const FString& Ext)
	{
		const FString Lower = Ext.ToLower();
		return Lower == TEXT("png") || Lower == TEXT("tga") || Lower == TEXT("jpg")
			|| Lower == TEXT("jpeg") || Lower == TEXT("bmp") || Lower == TEXT("webp");
	}

	bool IsVideoExt(const FString& Ext)
	{
		const FString Lower = Ext.ToLower();
		return Lower == TEXT("mp4") || Lower == TEXT("mov") || Lower == TEXT("mkv")
			|| Lower == TEXT("webm") || Lower == TEXT("avi");
	}

	void ListSubdirs(const FString& Dir, TArray<FString>& Out)
	{
		Out.Reset();
		IFileManager::Get().FindFiles(Out, *(Dir / TEXT("*")), /*Files*/false, /*Dirs*/true);
	}

	void ListFiles(const FString& Dir, const FString& Wildcard, TArray<FString>& Out)
	{
		Out.Reset();
		IFileManager::Get().FindFiles(Out, *(Dir / Wildcard), /*Files*/true, /*Dirs*/false);
	}
}

FString FHktWorkspaceScanner::CategoryToString(EHktWorkspaceCategory Cat)
{
	switch (Cat)
	{
		case EHktWorkspaceCategory::Paper2D: return TEXT("Paper2D");
		case EHktWorkspaceCategory::HISM:    return TEXT("HISM");
		default:                              return TEXT("Unknown");
	}
}

EHktWorkspaceCategory FHktWorkspaceScanner::CategoryFromString(const FString& Name)
{
	if (Name.Equals(TEXT("Paper2D"), ESearchCase::IgnoreCase)) return EHktWorkspaceCategory::Paper2D;
	if (Name.Equals(TEXT("HISM"),    ESearchCase::IgnoreCase)) return EHktWorkspaceCategory::HISM;
	return EHktWorkspaceCategory::Unknown;
}

FString FHktWorkspaceScanner::NormalizeTagFromFolderName(const FString& FolderName)
{
	// 혼용 허용 — '.' 이미 있으면 그대로, 없으면 '_' 를 '.' 로 치환.
	// 둘 다 섞여 있어도 GameplayTag 는 점 표기여야 하므로 일관성을 위해 모든 '_' → '.'.
	FString Out = FolderName;
	Out.ReplaceInline(TEXT("_"), TEXT("."));
	// 양끝/중복 . 정리.
	while (Out.RemoveFromStart(TEXT(".")));
	while (Out.RemoveFromEnd(TEXT(".")));
	while (Out.ReplaceInline(TEXT(".."), TEXT(".")));
	return Out;
}

FString FHktWorkspaceScanner::AnimNameToAnimTag(const FString& AnimName)
{
	// 규약:
	//  - 폴더명이 이미 점/언더스코어 표기로 계층을 표현하면 그대로 점 표기로 변환
	//    (예: "Anim_FullBody_Locomotion_Idle" → "Anim.FullBody.Locomotion.Idle",
	//         "Anim_Action_Strike"            → "Anim.Action.Strike")
	//  - 단순 단어이면 sprite_tools.py 의 _action_name_to_anim_tag 호환 매핑 적용
	//    (Idle/Walk/Run/Fall → Anim.FullBody.Locomotion.X, 그 외 → Anim.FullBody.X)
	const bool bHasHierarchy =
		AnimName.Contains(TEXT(".")) || AnimName.Contains(TEXT("_"));

	if (bHasHierarchy)
	{
		return NormalizeTagFromFolderName(AnimName);
	}

	const FString Lower = AnimName.ToLower();
	const bool bLocomotion = (Lower == TEXT("idle") || Lower == TEXT("walk")
		|| Lower == TEXT("run") || Lower == TEXT("fall"));

	FString Cap = Lower;
	if (!Cap.IsEmpty())
	{
		Cap[0] = FChar::ToUpper(Cap[0]);
	}

	if (bLocomotion)
	{
		return FString::Printf(TEXT("Anim.FullBody.Locomotion.%s"), *Cap);
	}
	return FString::Printf(TEXT("Anim.FullBody.%s"), *Cap);
}

bool FHktWorkspaceScanner::InspectTagFolder(
	EHktWorkspaceCategory Category,
	const FString& TagFolderPath,
	FHktWorkspaceTagEntry& InOutEntry)
{
	InOutEntry.Mode = EHktWorkspaceTagMode::Unknown;
	InOutEntry.Anims.Reset();
	InOutEntry.StaticImagePath.Reset();

	if (!IFileManager::Get().DirectoryExists(*TagFolderPath))
	{
		return false;
	}

	// 새 규칙 (2026-05):
	//   - Tag 폴더 직속 서브폴더 ≥ 1  →  Character (각 서브폴더 = anim, 폴더명 → AnimTag)
	//   - Tag 폴더 직속 서브폴더 0  + 직속 이미지 ≥ 1  →  StaticVisual
	//   - `Animations/` 래퍼는 더 이상 강제하지 않음. 이전 트리(`Animations/Idle/...`) 도
	//     상위에 `Animations` 라는 단일 서브폴더가 보이고, 그 내부가 anim 폴더로 잡혀
	//     동작이 깨질 수 있어 명시적으로 호환 분기를 둠.

	TArray<FString> RootSubdirs;
	ListSubdirs(TagFolderPath, RootSubdirs);
	RootSubdirs.Sort();

	// `.` 으로 시작하는 폴더는 빌더 캐시/메타 (`.cache/` 등) — 스캐너 제외.
	RootSubdirs.RemoveAll([](const FString& S) { return S.StartsWith(TEXT(".")); });

	// 호환 분기: 직속 서브폴더가 정확히 "Animations" 하나뿐이면 그 안을 anim 컨테이너로 취급.
	FString AnimContainer = TagFolderPath;
	if (RootSubdirs.Num() == 1 && RootSubdirs[0].Equals(TEXT("Animations"), ESearchCase::IgnoreCase))
	{
		AnimContainer = TagFolderPath / RootSubdirs[0];
		ListSubdirs(AnimContainer, RootSubdirs);
		RootSubdirs.Sort();
	}

	if (RootSubdirs.Num() > 0)
	{
		InOutEntry.Mode = EHktWorkspaceTagMode::Character;

		for (const FString& AnimName : RootSubdirs)
		{
			const FString AnimPath = AnimContainer / AnimName;

			TArray<FString> Subdirs;
			ListSubdirs(AnimPath, Subdirs);

			// 1) Direction 서브폴더(N/NE/...) 가 있으면 방향별 FrameSequence.
			TArray<FString> DirSubdirs;
			for (const FString& S : Subdirs)
			{
				if (IsDirectionName(S))
				{
					DirSubdirs.Add(S);
				}
			}

			// 2) atlas_{Dir}.{png|...} 파일이 있으면 방향별 Atlas.
			TArray<FString> AtlasFiles;
			ListFiles(AnimPath, TEXT("atlas_*.*"), AtlasFiles);

			// 3) 그 외 이미지 = 단일방향 프레임 시퀀스 후보.
			TArray<FString> AllImages;
			ListFiles(AnimPath, TEXT("*.*"), AllImages);
			TArray<FString> FrameFiles;
			for (const FString& F : AllImages)
			{
				if (!IsImageExt(FPaths::GetExtension(F))) continue;
				if (F.StartsWith(TEXT("atlas_"), ESearchCase::IgnoreCase)) continue;
				if (F.StartsWith(TEXT("."))) continue; // 숨김/메타 파일 제외
				FrameFiles.Add(F);
			}
			FrameFiles.Sort();

			// 4) anim 폴더 직속 영상.
			TArray<FString> VideoFiles;
			for (const FString& F : AllImages)
			{
				if (IsVideoExt(FPaths::GetExtension(F))) VideoFiles.Add(F);
			}

			FHktWorkspaceAnimInput AnimInput;
			AnimInput.Name       = AnimName;
			AnimInput.AnimTag    = AnimNameToAnimTag(AnimName);
			AnimInput.FolderPath = AnimPath;

			if (AtlasFiles.Num() > 0)
			{
				AnimInput.Source = EHktWorkspaceAnimSource::Atlas;
				for (const FString& File : AtlasFiles)
				{
					const FString Ext  = FPaths::GetExtension(File);
					const FString Stem = FPaths::GetBaseFilename(File); // atlas_S
					if (!IsImageExt(Ext))
					{
						continue;
					}
					int32 UnderIdx = INDEX_NONE;
					if (Stem.FindChar(TCHAR('_'), UnderIdx) && UnderIdx + 1 < Stem.Len())
					{
						const FString DirToken = Stem.Mid(UnderIdx + 1);
						if (IsDirectionName(DirToken))
						{
							AnimInput.Directions.Add(DirToken.ToUpper());
							AnimInput.SourcePaths.Add(AnimPath / File);
						}
					}
				}
			}
			else if (DirSubdirs.Num() > 0)
			{
				AnimInput.Source = EHktWorkspaceAnimSource::FrameSequence;
				for (const FString& DirToken : DirSubdirs)
				{
					AnimInput.Directions.Add(DirToken.ToUpper());
					AnimInput.SourcePaths.Add(AnimPath / DirToken);
				}
			}
			else if (VideoFiles.Num() > 0)
			{
				// anim 폴더 안의 .mp4 → Video (8방향 추출).
				AnimInput.Source = EHktWorkspaceAnimSource::Video;
				AnimInput.SourcePaths.Add(AnimPath / VideoFiles[0]);
			}
			else if (FrameFiles.Num() > 0)
			{
				// 단일방향 frame sequence — anim 폴더 자체를 1-row strip atlas 로 묶음.
				// 가로 칸 수 = 프레임 수 (자동 결정). 명시적 grid 가 필요한 경우
				// anim_meta.json 에 columns 를 적어두면 빌더가 우선 적용.
				AnimInput.Source = EHktWorkspaceAnimSource::FrameSequence;
				AnimInput.Directions.Add(TEXT("S"));
				AnimInput.SourcePaths.Add(AnimPath);
			}
			else
			{
				UE_LOG(LogHktWorkspace, Warning,
					TEXT("[Scanner] anim 폴더 형식 미인식(빈/이미지 없음): %s"), *AnimPath);
				continue;
			}

			InOutEntry.Anims.Add(MoveTemp(AnimInput));
		}

		// AnimContainer 직속 영상은 별도 anim 한 개로 추가 (legacy `Animations/Cast.mp4` 호환).
		TArray<FString> ContainerVideos;
		ListFiles(AnimContainer, TEXT("*.*"), ContainerVideos);
		for (const FString& File : ContainerVideos)
		{
			if (!IsVideoExt(FPaths::GetExtension(File))) continue;

			FHktWorkspaceAnimInput AnimInput;
			AnimInput.Name       = FPaths::GetBaseFilename(File);
			AnimInput.AnimTag    = AnimNameToAnimTag(AnimInput.Name);
			AnimInput.Source     = EHktWorkspaceAnimSource::Video;
			AnimInput.FolderPath = AnimContainer;
			AnimInput.SourcePaths.Add(AnimContainer / File);
			InOutEntry.Anims.Add(MoveTemp(AnimInput));
		}

		return InOutEntry.Anims.Num() > 0;
	}

	// 서브폴더 0 → StaticVisual 후보 — 직속 이미지 1장.
	TArray<FString> RootFiles;
	ListFiles(TagFolderPath, TEXT("*.*"), RootFiles);
	TArray<FString> ImageFiles;
	for (const FString& F : RootFiles)
	{
		if (IsImageExt(FPaths::GetExtension(F)))
		{
			if (F.StartsWith(TEXT(".workspace.meta"))) continue;
			ImageFiles.Add(F);
		}
	}

	if (ImageFiles.Num() == 0)
	{
		UE_LOG(LogHktWorkspace, Warning,
			TEXT("[Scanner] Tag 폴더 비어있음(이미지/서브폴더 모두 없음): %s"), *TagFolderPath);
		return false;
	}

	InOutEntry.Mode = EHktWorkspaceTagMode::StaticVisual;
	InOutEntry.StaticImagePath = TagFolderPath / ImageFiles[0];
	if (ImageFiles.Num() > 1)
	{
		UE_LOG(LogHktWorkspace, Warning,
			TEXT("[Scanner] StaticVisual 폴더에 다수 PNG — 첫 번째만 사용: %s"), *InOutEntry.StaticImagePath);
	}
	return true;
}

bool FHktWorkspaceScanner::ScanPaper2D(const FString& Paper2DRoot, TArray<FHktWorkspaceTagEntry>& OutEntries)
{
	return ScanCategoryRoot(EHktWorkspaceCategory::Paper2D, Paper2DRoot, OutEntries);
}

bool FHktWorkspaceScanner::ScanCategoryRoot(
	EHktWorkspaceCategory Category,
	const FString& CategoryRoot,
	TArray<FHktWorkspaceTagEntry>& OutEntries)
{
	if (!IFileManager::Get().DirectoryExists(*CategoryRoot))
	{
		return false;
	}

	TArray<FString> TagSubdirs;
	ListSubdirs(CategoryRoot, TagSubdirs);
	TagSubdirs.Sort();

	UGameplayTagsManager& TagsMgr = UGameplayTagsManager::Get();

	const int32 BeforeNum = OutEntries.Num();
	for (const FString& FolderName : TagSubdirs)
	{
		FHktWorkspaceTagEntry Entry;
		Entry.Category   = Category;
		Entry.FolderName = FolderName;
		Entry.TagString  = NormalizeTagFromFolderName(FolderName);
		Entry.FolderPath = CategoryRoot / FolderName;

		const FGameplayTag Existing = TagsMgr.RequestGameplayTag(FName(*Entry.TagString), /*ErrorIfNotFound*/false);
		Entry.bTagPreRegistered = Existing.IsValid();

		if (!InspectTagFolder(Entry.Category, Entry.FolderPath, Entry))
		{
			continue;
		}

		OutEntries.Add(MoveTemp(Entry));
	}
	return OutEntries.Num() > BeforeNum;
}

bool FHktWorkspaceScanner::ScanAll(const FString& WorkspaceRoot, TArray<FHktWorkspaceTagEntry>& OutEntries)
{
	const FString Root = WorkspaceRoot.IsEmpty()
		? UHktWorkspaceSettings::ResolveWorkspaceRoot() : WorkspaceRoot;

	if (!IFileManager::Get().DirectoryExists(*Root))
	{
		UE_LOG(LogHktWorkspace, Warning, TEXT("[Scanner] Root 없음: %s"), *Root);
		return false;
	}

	bool bAny = false;

	// Paper2D
	{
		const FString Sub = Root / TEXT("Paper2D");
		if (IFileManager::Get().DirectoryExists(*Sub))
		{
			bAny |= ScanPaper2D(Sub, OutEntries);
		}
	}

	// HISM — Paper2D 와 동일 디렉터리 컨벤션. InspectTagFolder 로 Mode/Anims 채움.
	{
		const FString Sub = Root / TEXT("HISM");
		if (IFileManager::Get().DirectoryExists(*Sub))
		{
			bAny |= ScanCategoryRoot(EHktWorkspaceCategory::HISM, Sub, OutEntries);
		}
	}

	return bAny;
}
