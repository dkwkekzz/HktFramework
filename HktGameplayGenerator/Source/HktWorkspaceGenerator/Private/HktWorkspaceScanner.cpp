// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktWorkspaceScanner.h"
#include "HktWorkspaceLog.h"
#include "HktWorkspaceSettings.h"

#include "GameplayTagsManager.h"
#include "HAL/FileManager.h"
#include "Misc/Paths.h"

namespace
{
	const TCHAR* const kDirNames[8] = {
		TEXT("N"), TEXT("NE"), TEXT("E"), TEXT("SE"),
		TEXT("S"), TEXT("SW"), TEXT("W"), TEXT("NW")
	};

	bool IsDirectionName(const FString& Name)
	{
		for (int32 i = 0; i < 8; ++i)
		{
			if (Name.Equals(kDirNames[i], ESearchCase::IgnoreCase))
			{
				return true;
			}
		}
		return false;
	}

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
	// sprite_tools.py 의 _action_name_to_anim_tag 와 동일 규약.
	const FString Lower = AnimName.ToLower();
	const bool bLocomotion = (Lower == TEXT("idle") || Lower == TEXT("walk")
		|| Lower == TEXT("run") || Lower == TEXT("fall"));

	// Capitalize 첫 글자.
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

	const FString AnimsDir = TagFolderPath / TEXT("Animations");
	const bool bHasAnimsDir = IFileManager::Get().DirectoryExists(*AnimsDir);

	if (bHasAnimsDir)
	{
		InOutEntry.Mode = EHktWorkspaceTagMode::Character;

		// Animations/ 하위 자식 디렉터리 = anim 후보.
		TArray<FString> AnimSubdirs;
		ListSubdirs(AnimsDir, AnimSubdirs);
		AnimSubdirs.Sort();

		for (const FString& AnimName : AnimSubdirs)
		{
			const FString AnimPath = AnimsDir / AnimName;

			// 1) Direction 서브폴더(N/NE/...) 가 있으면 FrameSequence.
			TArray<FString> Subdirs;
			ListSubdirs(AnimPath, Subdirs);
			TArray<FString> DirSubdirs;
			for (const FString& S : Subdirs)
			{
				if (IsDirectionName(S))
				{
					DirSubdirs.Add(S);
				}
			}

			// 2) atlas_{Dir}.{png|...} 파일이 있으면 Atlas.
			TArray<FString> AtlasFiles;
			ListFiles(AnimPath, TEXT("atlas_*.*"), AtlasFiles);

			FHktWorkspaceAnimInput AnimInput;
			AnimInput.Name    = AnimName;
			AnimInput.AnimTag = AnimNameToAnimTag(AnimName);

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
			else
			{
				// 폴더가 아예 비어 있거나 알 수 없는 형식 — 스킵.
				UE_LOG(LogHktWorkspace, Warning,
					TEXT("[Scanner] anim 폴더 형식 미인식: %s"), *AnimPath);
				continue;
			}

			InOutEntry.Anims.Add(MoveTemp(AnimInput));
		}

		// Animations/ 직속 파일이 영상이면 Video 소스로 anim 1개 추가.
		TArray<FString> VideoFiles;
		ListFiles(AnimsDir, TEXT("*.*"), VideoFiles);
		for (const FString& File : VideoFiles)
		{
			const FString Ext = FPaths::GetExtension(File);
			if (!IsVideoExt(Ext)) continue;

			FHktWorkspaceAnimInput AnimInput;
			AnimInput.Name    = FPaths::GetBaseFilename(File);
			AnimInput.AnimTag = AnimNameToAnimTag(AnimInput.Name);
			AnimInput.Source  = EHktWorkspaceAnimSource::Video;
			AnimInput.SourcePaths.Add(AnimsDir / File);
			InOutEntry.Anims.Add(MoveTemp(AnimInput));
		}

		return InOutEntry.Anims.Num() > 0;
	}

	// Animations/ 가 없으면 StaticVisual 후보 — 직속 PNG 1장.
	TArray<FString> RootFiles;
	ListFiles(TagFolderPath, TEXT("*.*"), RootFiles);
	TArray<FString> ImageFiles;
	for (const FString& F : RootFiles)
	{
		if (IsImageExt(FPaths::GetExtension(F)))
		{
			// manifest 파일/메타 제외.
			if (F.StartsWith(TEXT(".workspace.meta"))) continue;
			ImageFiles.Add(F);
		}
	}

	if (ImageFiles.Num() == 0)
	{
		UE_LOG(LogHktWorkspace, Warning,
			TEXT("[Scanner] Tag 폴더 비어있음(이미지/Animations 모두 없음): %s"), *TagFolderPath);
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
	if (!IFileManager::Get().DirectoryExists(*Paper2DRoot))
	{
		return false;
	}

	TArray<FString> TagSubdirs;
	ListSubdirs(Paper2DRoot, TagSubdirs);
	TagSubdirs.Sort();

	UGameplayTagsManager& TagsMgr = UGameplayTagsManager::Get();

	for (const FString& FolderName : TagSubdirs)
	{
		FHktWorkspaceTagEntry Entry;
		Entry.Category   = EHktWorkspaceCategory::Paper2D;
		Entry.FolderName = FolderName;
		Entry.TagString  = NormalizeTagFromFolderName(FolderName);
		Entry.FolderPath = Paper2DRoot / FolderName;

		const FGameplayTag Existing = TagsMgr.RequestGameplayTag(FName(*Entry.TagString), /*ErrorIfNotFound*/false);
		Entry.bTagPreRegistered = Existing.IsValid();

		if (!InspectTagFolder(Entry.Category, Entry.FolderPath, Entry))
		{
			// 빈/형식 미인식 폴더는 스킵 (warning 은 InspectTagFolder 에서 이미 출력).
			continue;
		}

		OutEntries.Add(MoveTemp(Entry));
	}
	return OutEntries.Num() > 0;
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

	// HISM — 1차에서는 미구현, 스캔만 (Mode/Anims 채우지 않음).
	{
		const FString Sub = Root / TEXT("HISM");
		if (IFileManager::Get().DirectoryExists(*Sub))
		{
			TArray<FString> TagSubdirs;
			ListSubdirs(Sub, TagSubdirs);
			for (const FString& FolderName : TagSubdirs)
			{
				FHktWorkspaceTagEntry Entry;
				Entry.Category   = EHktWorkspaceCategory::HISM;
				Entry.FolderName = FolderName;
				Entry.TagString  = NormalizeTagFromFolderName(FolderName);
				Entry.FolderPath = Sub / FolderName;
				Entry.Mode       = EHktWorkspaceTagMode::Unknown; // not yet implemented
				OutEntries.Add(MoveTemp(Entry));
				bAny = true;
			}
		}
	}

	return bAny;
}
