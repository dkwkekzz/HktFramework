// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteGeneratorFunctionLibrary.h"
#include "HktSpritePartTemplate.h"
#include "HktSpriteTypes.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Editor.h"
#include "Engine/Texture2D.h"
#include "Factories/TextureFactory.h"
#include "GameplayTagsManager.h"
#include "Misc/FileHelper.h"
#include "Misc/PackageName.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"

DEFINE_LOG_CATEGORY_STATIC(LogHktSpriteGenerator, Log, All);

// ============================================================================
// 헬퍼
// ============================================================================

namespace HktSpriteGen
{
	static FString MakeResult(bool bSuccess, const TMap<FString, FString>& Fields)
	{
		FString Json;
		TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Json);
		W->WriteObjectStart();
		W->WriteValue(TEXT("success"), bSuccess);
		for (const auto& P : Fields) W->WriteValue(P.Key, P.Value);
		W->WriteObjectEnd();
		W->Close();
		return Json;
	}

	static FString MakeError(const FString& Msg)
	{
		UE_LOG(LogHktSpriteGenerator, Warning, TEXT("%s"), *Msg);
		return MakeResult(false, { {TEXT("error"), Msg} });
	}

	static EHktSpritePartSlot ParseSlot(const FString& S)
	{
		if (S.Equals(TEXT("Body"),        ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Body;
		if (S.Equals(TEXT("Head"),        ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Head;
		if (S.Equals(TEXT("Weapon"),      ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Weapon;
		if (S.Equals(TEXT("Shield"),      ESearchCase::IgnoreCase)) return EHktSpritePartSlot::Shield;
		if (S.Equals(TEXT("HeadgearTop"), ESearchCase::IgnoreCase)) return EHktSpritePartSlot::HeadgearTop;
		if (S.Equals(TEXT("HeadgearMid"), ESearchCase::IgnoreCase)) return EHktSpritePartSlot::HeadgearMid;
		if (S.Equals(TEXT("HeadgearLow"), ESearchCase::IgnoreCase)) return EHktSpritePartSlot::HeadgearLow;
		return EHktSpritePartSlot::Body;
	}

	/** Tag 문자열을 네이티브 등록해 FGameplayTag로 반환. 파일명 안전 변환까지. */
	static FGameplayTag EnsureTag(const FString& TagStr)
	{
		UGameplayTagsManager& TM = UGameplayTagsManager::Get();
		FGameplayTag Existing = TM.RequestGameplayTag(FName(*TagStr), /*ErrorIfNotFound*/ false);
		if (Existing.IsValid()) return Existing;
		// 태그 미등록이면 일시적으로 네이티브 추가 (세션 수명). 영구 등록은 프로젝트 DataTable 관리.
		return TM.AddNativeGameplayTag(FName(*TagStr));
	}

	static FString SanitizeForAssetName(const FString& In)
	{
		return In.Replace(TEXT("."), TEXT("_"));
	}

	static UTexture2D* ImportAtlasTexture(const FString& PngPath, const FString& PackagePath, const FString& AssetName)
	{
		TArray<uint8> FileData;
		if (!FFileHelper::LoadFileToArray(FileData, *PngPath))
		{
			UE_LOG(LogHktSpriteGenerator, Error, TEXT("아틀라스 PNG 읽기 실패: %s"), *PngPath);
			return nullptr;
		}

		UPackage* Package = CreatePackage(*PackagePath);
		if (!Package) return nullptr;
		Package->FullyLoad();

		UTextureFactory* Factory = NewObject<UTextureFactory>();
		Factory->AddToRoot();
		Factory->NoAlpha = false;
		Factory->bUseHashAsGuid = true;

		const uint8* BufBegin = FileData.GetData();
		const uint8* BufEnd   = FileData.GetData() + FileData.Num();
		UObject* Imported = Factory->FactoryCreateBinary(
			UTexture2D::StaticClass(), Package, FName(*AssetName),
			RF_Public | RF_Standalone, nullptr,
			*FPaths::GetExtension(PngPath), BufBegin, BufEnd, GWarn);
		Factory->RemoveFromRoot();

		UTexture2D* Tex = Cast<UTexture2D>(Imported);
		if (!Tex) return nullptr;

		// 스프라이트 아틀라스 표준 설정: 픽셀아트 Nearest, NoMipmap, UI 그룹 압축 X
		Tex->CompressionSettings = TC_EditorIcon;
		Tex->Filter              = TF_Nearest;
		Tex->MipGenSettings      = TMGS_NoMipmaps;
		Tex->LODGroup            = TEXTUREGROUP_UI;
		Tex->SRGB                = true;
		Tex->UpdateResource();

		Tex->MarkPackageDirty();
		const FString PkgFile = FPackageName::LongPackageNameToFilename(PackagePath, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		UPackage::SavePackage(Package, Tex, *PkgFile, SaveArgs);

		FAssetRegistryModule::AssetCreated(Tex);
		return Tex;
	}

	static void ParseFrame(const TSharedPtr<FJsonObject>& F, FHktSpriteFrame& Out)
	{
		Out.AtlasIndex       = static_cast<int32>(F->GetNumberField(TEXT("atlasIndex")));
		Out.PivotOffset.X    = static_cast<float>(F->GetNumberField(TEXT("pivotX")));
		Out.PivotOffset.Y    = static_cast<float>(F->GetNumberField(TEXT("pivotY")));

		double ScaleX = 1.0, ScaleY = 1.0;
		F->TryGetNumberField(TEXT("scaleX"), ScaleX);
		F->TryGetNumberField(TEXT("scaleY"), ScaleY);
		Out.Scale = FVector2f(static_cast<float>(ScaleX), static_cast<float>(ScaleY));

		double Rot = 0.0;
		F->TryGetNumberField(TEXT("rotation"), Rot);
		Out.Rotation = static_cast<float>(Rot);

		double ZBias = 0.0;
		F->TryGetNumberField(TEXT("zBias"), ZBias);
		Out.ZBias = static_cast<int32>(ZBias);

		const TSharedPtr<FJsonObject>* Tint = nullptr;
		if (F->TryGetObjectField(TEXT("tint"), Tint) && Tint && Tint->IsValid())
		{
			double R=1,G=1,B=1,A=1;
			(*Tint)->TryGetNumberField(TEXT("r"), R);
			(*Tint)->TryGetNumberField(TEXT("g"), G);
			(*Tint)->TryGetNumberField(TEXT("b"), B);
			(*Tint)->TryGetNumberField(TEXT("a"), A);
			Out.Tint = FLinearColor(R, G, B, A);
		}

		const TSharedPtr<FJsonObject>* Anchors = nullptr;
		if (F->TryGetObjectField(TEXT("childAnchors"), Anchors) && Anchors && Anchors->IsValid())
		{
			for (const auto& Pair : (*Anchors)->Values)
			{
				const TArray<TSharedPtr<FJsonValue>>* Arr = nullptr;
				if (Pair.Value.IsValid() && Pair.Value->TryGetArray(Arr) && Arr && Arr->Num() >= 2)
				{
					const float X = static_cast<float>((*Arr)[0]->AsNumber());
					const float Y = static_cast<float>((*Arr)[1]->AsNumber());
					Out.ChildAnchors.Add(FName(*Pair.Key), FVector2f(X, Y));
				}
			}
		}
	}
}

// ============================================================================
// McpBuildSpritePart
// ============================================================================

FString UHktSpriteGeneratorFunctionLibrary::McpBuildSpritePart(const FString& JsonSpec)
{
	using namespace HktSpriteGen;

	TSharedPtr<FJsonObject> Root;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonSpec);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		return MakeError(TEXT("JsonSpec parse failed"));
	}

	const FString TagStr   = Root->GetStringField(TEXT("tag"));
	const FString SlotStr  = Root->GetStringField(TEXT("slot"));
	const FString AtlasPng = Root->GetStringField(TEXT("atlasPngPath"));
	if (TagStr.IsEmpty() || AtlasPng.IsEmpty())
	{
		return MakeError(TEXT("tag / atlasPngPath required"));
	}
	if (!FPaths::FileExists(AtlasPng))
	{
		return MakeError(FString::Printf(TEXT("Atlas PNG not found: %s"), *AtlasPng));
	}

	const double CellW         = Root->GetNumberField(TEXT("cellW"));
	const double CellH         = Root->GetNumberField(TEXT("cellH"));
	double PixelToWorld        = 2.0;
	Root->TryGetNumberField(TEXT("pixelToWorld"), PixelToWorld);

	FString OutputDir = TEXT("/Game/Generated/Sprites");
	Root->TryGetStringField(TEXT("outputDir"), OutputDir);

	// --- 에셋 경로 계산 ---
	const FString SafeTag        = SanitizeForAssetName(TagStr);
	const FString AtlasName      = FString::Printf(TEXT("T_SpriteAtlas_%s"), *SafeTag);
	const FString TemplateName   = FString::Printf(TEXT("DA_SpritePart_%s"),  *SafeTag);
	const FString AtlasPackage   = FString::Printf(TEXT("%s/%s"), *OutputDir, *AtlasName);
	const FString TemplatePackage= FString::Printf(TEXT("%s/%s"), *OutputDir, *TemplateName);

	// --- 1. Atlas 텍스처 임포트 ---
	UTexture2D* AtlasTex = ImportAtlasTexture(AtlasPng, AtlasPackage, AtlasName);
	if (!AtlasTex)
	{
		return MakeError(TEXT("Atlas 텍스처 임포트 실패"));
	}

	// --- 2. DataAsset 패키지/오브젝트 생성 ---
	UPackage* TmplPkg = CreatePackage(*TemplatePackage);
	if (!TmplPkg) return MakeError(TEXT("DataAsset 패키지 생성 실패"));
	TmplPkg->FullyLoad();

	UHktSpritePartTemplate* Tmpl = NewObject<UHktSpritePartTemplate>(
		TmplPkg, FName(*TemplateName), RF_Public | RF_Standalone);
	if (!Tmpl) return MakeError(TEXT("UHktSpritePartTemplate 생성 실패"));

	Tmpl->IdentifierTag = EnsureTag(TagStr);
	Tmpl->PartSlot      = ParseSlot(SlotStr);
	Tmpl->Atlas         = AtlasTex;
	Tmpl->AtlasCellSize = FVector2f(static_cast<float>(CellW), static_cast<float>(CellH));
	Tmpl->PixelToWorld  = static_cast<float>(PixelToWorld);

	// --- 3. Actions 파싱 ---
	const TArray<TSharedPtr<FJsonValue>>* Actions = nullptr;
	if (Root->TryGetArrayField(TEXT("actions"), Actions) && Actions)
	{
		for (const TSharedPtr<FJsonValue>& V : *Actions)
		{
			const TSharedPtr<FJsonObject> A = V->AsObject();
			if (!A.IsValid()) continue;

			FHktSpriteAction Action;
			Action.ActionId = FName(*A->GetStringField(TEXT("id")));

			double FrameDur = 100.0;
			A->TryGetNumberField(TEXT("frameDurationMs"), FrameDur);
			Action.FrameDurationMs = static_cast<float>(FrameDur);

			bool bLoop = true, bMirror = true;
			A->TryGetBoolField(TEXT("looping"), bLoop);
			A->TryGetBoolField(TEXT("mirrorWestFromEast"), bMirror);
			Action.bLooping = bLoop;
			Action.bMirrorWestFromEast = bMirror;

			FString OnComplete;
			if (A->TryGetStringField(TEXT("onCompleteTransition"), OnComplete) && !OnComplete.IsEmpty())
			{
				Action.OnCompleteTransition = FName(*OnComplete);
			}

			const TArray<TSharedPtr<FJsonValue>>* PerFrame = nullptr;
			if (A->TryGetArrayField(TEXT("perFrameDurationMs"), PerFrame) && PerFrame)
			{
				for (const auto& F : *PerFrame) Action.PerFrameDurationMs.Add(static_cast<float>(F->AsNumber()));
			}

			const TArray<TSharedPtr<FJsonValue>>* Dirs = nullptr;
			if (A->TryGetArrayField(TEXT("framesByDirection"), Dirs) && Dirs)
			{
				Action.FramesByDirection.Reserve(Dirs->Num());
				for (const TSharedPtr<FJsonValue>& DirV : *Dirs)
				{
					FHktSpriteDirectionFrames DirFrames;
					const TArray<TSharedPtr<FJsonValue>>* FrameArr = nullptr;
					if (DirV.IsValid() && DirV->TryGetArray(FrameArr) && FrameArr)
					{
						DirFrames.Frames.Reserve(FrameArr->Num());
						for (const TSharedPtr<FJsonValue>& FV : *FrameArr)
						{
							const TSharedPtr<FJsonObject> FO = FV->AsObject();
							if (!FO.IsValid()) continue;
							FHktSpriteFrame Frame;
							ParseFrame(FO, Frame);
							DirFrames.Frames.Add(Frame);
						}
					}
					Action.FramesByDirection.Add(MoveTemp(DirFrames));
				}
			}

			Tmpl->Actions.Add(Action.ActionId, Action);
		}
	}

	// --- 4. 패키지 저장 ---
	Tmpl->MarkPackageDirty();
	const FString TmplFile = FPackageName::LongPackageNameToFilename(TemplatePackage, FPackageName::GetAssetPackageExtension());
	FSavePackageArgs SaveArgs;
	SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
	if (!UPackage::SavePackage(TmplPkg, Tmpl, *TmplFile, SaveArgs))
	{
		return MakeError(TEXT("DataAsset 패키지 저장 실패"));
	}
	FAssetRegistryModule::AssetCreated(Tmpl);

	UE_LOG(LogHktSpriteGenerator, Log, TEXT("SpritePart 빌드 완료: Tag=%s Slot=%s Atlas=%s Template=%s"),
		*TagStr, *SlotStr, *AtlasPackage, *TemplatePackage);

	return MakeResult(true, {
		{ TEXT("tag"),            TagStr },
		{ TEXT("atlasAssetPath"), FString::Printf(TEXT("%s.%s"), *AtlasPackage,    *AtlasName)    },
		{ TEXT("dataAssetPath"),  FString::Printf(TEXT("%s.%s"), *TemplatePackage, *TemplateName) },
	});
}
