// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelTerrainStyleSet.h"
#include "HktVoxelTerrainLog.h"
#include "Rendering/HktVoxelTileAtlas.h"
#include "Rendering/HktVoxelMaterialLUT.h"
#include "Engine/Texture2D.h"
#include "Engine/Texture2DArray.h"
#include "UObject/Class.h"

#if WITH_EDITOR
#include "HktVoxelTerrainBakeLibrary.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"
#include "Modules/ModuleManager.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"
#include "Misc/PackageName.h"
#endif

// ============================================================================
// Runtime — ApplyTo
// ============================================================================

void UHktVoxelTerrainStyleSet::ApplyTo(UHktVoxelTileAtlas* Atlas, UHktVoxelMaterialLUT* MaterialLUT) const
{
	if (!Atlas)
	{
		UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[StyleSet] ApplyTo: Atlas is null"));
		return;
	}

	Atlas->TileArray = TileArray;
	Atlas->NormalArray = NormalArray;

	for (const FHktBakedTileMapping& Mapping : TileMappings)
	{
		Atlas->SetTileMapping(
			static_cast<uint16>(Mapping.TypeID),
			Mapping.TopSlice, Mapping.SideSlice, Mapping.BottomSlice);
	}
	Atlas->BuildLUTTexture();

	if (MaterialLUT)
	{
		for (const FHktBakedMaterialEntry& Entry : Materials)
		{
			MaterialLUT->SetMaterial(
				static_cast<uint16>(Entry.TypeID),
				Entry.Roughness, Entry.Metallic, Entry.Specular);
		}
		MaterialLUT->BuildLUTTexture();
	}

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[StyleSet] Applied — TileArray=%s, NormalArray=%s, %d mappings, %d materials"),
		TileArray ? *TileArray->GetName() : TEXT("(null)"),
		NormalArray ? *NormalArray->GetName() : TEXT("(null)"),
		TileMappings.Num(), Materials.Num());
}

// ============================================================================
// Editor — Import & Bake
// ============================================================================

#if WITH_EDITOR

namespace
{
	// 파싱 결과: 파일명을 의미 단위로 쪼갠 메타.
	struct FStyleAssetNameParse
	{
		// EHktTerrainType 식별자명 (예: "Grass", "Stone"). 공백/대시 제거됨.
		FString TypeName;

		// "Top" | "Side" | "Bottom" | (빈 문자열 = unspecified = side)
		FString Face;

		// 그리드 아틀라스: COLS, ROWS (둘 다 >0 일 때만 아틀라스로 간주).
		int32 AtlasCols = 0;
		int32 AtlasRows = 0;

		// 노멀맵 (_N 접미).
		bool bNormal = false;

		bool IsAtlas() const { return AtlasCols > 0 && AtlasRows > 0; }
	};

	// "T_" 또는 "M_" 같은 콘텐츠 브라우저 접두 제거.
	FString StripContentPrefix(const FString& In)
	{
		static const TCHAR* Prefixes[] = { TEXT("T_"), TEXT("t_") };
		for (const TCHAR* P : Prefixes)
		{
			if (In.StartsWith(P))
			{
				return In.RightChop(FCString::Strlen(P));
			}
		}
		return In;
	}

	// 파일 경로의 stem 만 파싱. 인식 실패 시 OutParse.TypeName 이 빈 문자열.
	bool ParseAssetName(const FString& AssetName, FStyleAssetNameParse& OutParse)
	{
		FString Name = StripContentPrefix(AssetName);

		// _N 접미 (Normal) 분리.
		if (Name.EndsWith(TEXT("_N")) || Name.EndsWith(TEXT("_n")))
		{
			OutParse.bNormal = true;
			Name = Name.LeftChop(2);
		}

		// _Atlas_<COLS>x<ROWS> 토큰 탐지.
		const FString AtlasToken = TEXT("_Atlas_");
		const int32 Found = Name.Find(AtlasToken, ESearchCase::IgnoreCase, ESearchDir::FromEnd);
		if (Found != INDEX_NONE)
		{
			const FString TypeStr = Name.Left(Found);
			const FString DimStr = Name.RightChop(Found + AtlasToken.Len());
			int32 XPos = INDEX_NONE;
			if ((DimStr.FindChar(TEXT('x'), XPos) || DimStr.FindChar(TEXT('X'), XPos))
				&& !TypeStr.IsEmpty())
			{
				const int32 Cols = FCString::Atoi(*DimStr.Left(XPos));
				const int32 Rows = FCString::Atoi(*DimStr.RightChop(XPos + 1));
				if (Cols > 0 && Rows > 0)
				{
					OutParse.TypeName = TypeStr;
					OutParse.AtlasCols = Cols;
					OutParse.AtlasRows = Rows;
					return true;
				}
			}
		}

		// _Top / _Side / _Bottom 접미 분리.
		static const TCHAR* Faces[] = { TEXT("_Top"), TEXT("_Side"), TEXT("_Bottom") };
		for (const TCHAR* FaceSuffix : Faces)
		{
			if (Name.EndsWith(FaceSuffix, ESearchCase::IgnoreCase))
			{
				const int32 Len = FCString::Strlen(FaceSuffix);
				OutParse.Face = FString(FaceSuffix).RightChop(1); // strip leading "_"
				OutParse.TypeName = Name.LeftChop(Len);
				return !OutParse.TypeName.IsEmpty();
			}
		}

		// Plain "<TypeName>" → side-only.
		OutParse.TypeName = Name;
		return !OutParse.TypeName.IsEmpty();
	}

	// "Grass" 또는 "Grass - Flower" (DisplayName) → EHktTerrainType 매핑.
	bool ResolveTerrainType(const FString& TypeName, EHktTerrainType& OutType)
	{
		const UEnum* EnumPtr = StaticEnum<EHktTerrainType>();
		if (!EnumPtr) { return false; }

		// 1) 식별자명 매칭 (예: "Grass", "StoneMossy"). 대소문자 무시.
		for (int32 i = 0; i < EnumPtr->NumEnums() - 1; i++)
		{
			const FString Identifier = EnumPtr->GetNameStringByIndex(i);
			if (Identifier.Equals(TypeName, ESearchCase::IgnoreCase))
			{
				OutType = static_cast<EHktTerrainType>(EnumPtr->GetValueByIndex(i));
				return true;
			}
		}

		// 2) DisplayName 매칭 — 공백/괄호 제거 후 비교 (예: "Grass-Flower" 또는 "GrassFlower").
		auto Normalize = [](const FString& In)
		{
			FString Out = In;
			Out.ReplaceInline(TEXT(" "), TEXT(""));
			Out.ReplaceInline(TEXT("-"), TEXT(""));
			Out.ReplaceInline(TEXT("_"), TEXT(""));
			Out.ReplaceInline(TEXT("("), TEXT(""));
			Out.ReplaceInline(TEXT(")"), TEXT(""));
			return Out;
		};
		const FString NormQuery = Normalize(TypeName);
		for (int32 i = 0; i < EnumPtr->NumEnums() - 1; i++)
		{
			const FText Display = EnumPtr->GetDisplayNameTextByIndex(i);
			const FString NormDisplay = Normalize(Display.ToString());
			if (NormDisplay.Equals(NormQuery, ESearchCase::IgnoreCase))
			{
				OutType = static_cast<EHktTerrainType>(EnumPtr->GetValueByIndex(i));
				return true;
			}
		}

		return false;
	}

	// 한 BlockStyle 의 face 슬롯에 텍스처를 채운다 (BaseColor / Normal).
	void AssignTextureToFace(
		FHktVoxelBlockStyle& Style,
		const FString& Face,
		bool bNormal,
		UTexture2D* Texture)
	{
		if (Face.Equals(TEXT("Top"), ESearchCase::IgnoreCase))
		{
			(bNormal ? Style.TopNormal : Style.TopTexture) = Texture;
		}
		else if (Face.Equals(TEXT("Bottom"), ESearchCase::IgnoreCase))
		{
			(bNormal ? Style.BottomNormal : Style.BottomTexture) = Texture;
		}
		else // "Side" or "" — 단일 텍스처는 전 면 공유로 처리.
		{
			(bNormal ? Style.SideNormal : Style.SideTexture) = Texture;
			if (Face.IsEmpty())
			{
				// 단일 texture: Top/Bottom 이 비어있을 때만 채워 명시 face 를 덮어쓰지 않음.
				if (bNormal)
				{
					if (!Style.TopNormal) { Style.TopNormal = Texture; }
					if (!Style.BottomNormal) { Style.BottomNormal = Texture; }
				}
				else
				{
					if (!Style.TopTexture) { Style.TopTexture = Texture; }
					if (!Style.BottomTexture) { Style.BottomTexture = Texture; }
				}
			}
		}
	}

	// FStyleAssetNameParse 의 AtlasCols×AtlasRows 셀 인덱스를 face 이름으로 매핑.
	// 한 셀=Side, 두 셀=Top/Side, 세 셀 이상=Top/Side/Bottom (나머지 무시).
	bool MapAtlasCellToFace(int32 CellIndex, int32 TotalCells, FString& OutFace)
	{
		if (TotalCells <= 1)
		{
			OutFace = TEXT("Side");
			return CellIndex == 0;
		}
		if (TotalCells == 2)
		{
			switch (CellIndex)
			{
			case 0: OutFace = TEXT("Top"); return true;
			case 1: OutFace = TEXT("Side"); return true;
			default: return false;
			}
		}
		switch (CellIndex)
		{
		case 0: OutFace = TEXT("Top"); return true;
		case 1: OutFace = TEXT("Side"); return true;
		case 2: OutFace = TEXT("Bottom"); return true;
		default: return false;
		}
	}

	// 아틀라스 한 셀을 잘라 새 UTexture2D 자산을 만들어 저장한다.
	// 저장 경로: <AtlasDir>/_Split/<TypeName>/<Face>[_N].uasset
	UTexture2D* CreateSplitTextureAsset(
		UTexture2D* AtlasTex,
		const FString& AtlasContentDir,
		const FString& TypeName,
		const FString& Face,
		bool bNormal,
		int32 CellX, int32 CellY, int32 CellW, int32 CellH)
	{
		if (!AtlasTex) { return nullptr; }

		FTextureSource& Src = AtlasTex->Source;
		if (!Src.IsValid())
		{
			UE_LOG(LogHktVoxelTerrain, Warning,
				TEXT("[Import] %s: Source data 없음 — atlas split 불가 (cooked asset?)"),
				*AtlasTex->GetName());
			return nullptr;
		}

		const ETextureSourceFormat SrcFmt = Src.GetFormat();
		if (SrcFmt != TSF_BGRA8)
		{
			UE_LOG(LogHktVoxelTerrain, Warning,
				TEXT("[Import] %s: TextureSource format=%d (TSF_BGRA8=2 만 지원) — atlas split skip"),
				*AtlasTex->GetName(), (int32)SrcFmt);
			return nullptr;
		}

		TArray64<uint8> SrcBytes;
		if (!Src.GetMipData(SrcBytes, /*BlockIndex=*/0, /*LayerIndex=*/0, /*MipIndex=*/0))
		{
			UE_LOG(LogHktVoxelTerrain, Warning,
				TEXT("[Import] %s: Source mip0 데이터 읽기 실패 — atlas split 불가"),
				*AtlasTex->GetName());
			return nullptr;
		}

		const int32 SrcW = Src.GetSizeX();
		const int32 SrcH = Src.GetSizeY();
		const int32 BPP = 4; // TSF_BGRA8

		if (CellX < 0 || CellY < 0 || CellX + CellW > SrcW || CellY + CellH > SrcH)
		{
			UE_LOG(LogHktVoxelTerrain, Warning,
				TEXT("[Import] %s: 셀 영역(%d,%d %dx%d) 가 소스(%dx%d) 밖 — skip"),
				*AtlasTex->GetName(), CellX, CellY, CellW, CellH, SrcW, SrcH);
			return nullptr;
		}

		TArray<uint8> CellBytes;
		CellBytes.SetNumUninitialized(CellW * CellH * BPP);
		for (int32 Row = 0; Row < CellH; Row++)
		{
			const uint8* SrcRow = SrcBytes.GetData() + ((CellY + Row) * SrcW + CellX) * BPP;
			uint8* DstRow = CellBytes.GetData() + Row * CellW * BPP;
			FMemory::Memcpy(DstRow, SrcRow, CellW * BPP);
		}

		// 자산 패키지 생성.
		const FString SplitDir = AtlasContentDir / TEXT("_Split") / TypeName;
		const FString AssetName = bNormal ? (Face + TEXT("_N")) : Face;
		const FString PackagePath = SplitDir / AssetName;

		UPackage* Package = CreatePackage(*PackagePath);
		if (!Package)
		{
			UE_LOG(LogHktVoxelTerrain, Warning, TEXT("[Import] CreatePackage 실패: %s"), *PackagePath);
			return nullptr;
		}
		Package->FullyLoad();

		// 동일 경로에 자산이 이미 있다면 재사용 (소스 갱신).
		UTexture2D* NewTex = FindObject<UTexture2D>(Package, *AssetName);
		if (!NewTex)
		{
			NewTex = NewObject<UTexture2D>(Package, *AssetName, RF_Public | RF_Standalone);
		}

		NewTex->Source.Init(CellW, CellH, 1, 1, TSF_BGRA8, CellBytes.GetData());
		NewTex->SRGB = bNormal ? false : AtlasTex->SRGB;
		NewTex->LODGroup = AtlasTex->LODGroup;
		NewTex->CompressionSettings = bNormal ? TC_Normalmap : AtlasTex->CompressionSettings;
		NewTex->AddressX = TA_Wrap;
		NewTex->AddressY = TA_Wrap;
		NewTex->UpdateResource();
		NewTex->PostEditChange();
		NewTex->MarkPackageDirty();

		FAssetRegistryModule::AssetCreated(NewTex);

		const FString Filename = FPackageName::LongPackageNameToFilename(
			PackagePath, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Public | RF_Standalone;
		UPackage::SavePackage(Package, NewTex, *Filename, SaveArgs);

		return NewTex;
	}

	// 한 BlockStyle 슬롯을 인덱스로 찾거나 추가한다.
	FHktVoxelBlockStyle& GetOrAddBlockStyle(
		TArray<FHktVoxelBlockStyle>& Styles, EHktTerrainType Type)
	{
		for (FHktVoxelBlockStyle& S : Styles)
		{
			if (S.BlockType == Type) { return S; }
		}
		FHktVoxelBlockStyle New;
		New.BlockType = Type;
		const UEnum* EnumPtr = StaticEnum<EHktTerrainType>();
		if (EnumPtr)
		{
			New.DisplayName = EnumPtr->GetDisplayNameTextByValue(
				static_cast<int64>(Type)).ToString();
		}
		const int32 Idx = Styles.Add(MoveTemp(New));
		return Styles[Idx];
	}
}

void UHktVoxelTerrainStyleSet::ImportFromDirectory()
{
	const FString ContentDir = SourceDirectory.Path;
	if (ContentDir.IsEmpty() || !ContentDir.StartsWith(TEXT("/")))
	{
		UE_LOG(LogHktVoxelTerrain, Error,
			TEXT("[Import] SourceDirectory '%s' 가 잘못됨 — '/Game/...' 형식 필요"), *ContentDir);
		return;
	}

	FAssetRegistryModule& ARM = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(TEXT("AssetRegistry"));
	IAssetRegistry& AR = ARM.Get();

	// 디렉토리 스캔 보장 (콜드 스타트 시 비동기 상태일 수 있음).
	AR.ScanPathsSynchronous({ ContentDir }, /*bForceRescan=*/false);

	FARFilter Filter;
	Filter.bRecursivePaths = true;
	Filter.PackagePaths.Add(FName(*ContentDir));
	Filter.ClassPaths.Add(UTexture2D::StaticClass()->GetClassPathName());

	TArray<FAssetData> Assets;
	AR.GetAssets(Filter, Assets);

	if (Assets.Num() == 0)
	{
		UE_LOG(LogHktVoxelTerrain, Warning,
			TEXT("[Import] '%s' 디렉토리에 Texture2D 자산이 없음"), *ContentDir);
		return;
	}

	// _Split 하위는 import 결과 (재귀 import 방지).
	const FString SplitSubDir = ContentDir / TEXT("_Split");

	int32 NumAtlases = 0;
	int32 NumSingle = 0;
	int32 NumSkipped = 0;

	for (const FAssetData& AssetData : Assets)
	{
		const FString PackagePath = AssetData.PackagePath.ToString();
		if (PackagePath.StartsWith(SplitSubDir))
		{
			continue; // 우리가 만든 파편은 다시 처리하지 않음.
		}

		const FString AssetName = AssetData.AssetName.ToString();
		FStyleAssetNameParse Parse;
		if (!ParseAssetName(AssetName, Parse) || Parse.TypeName.IsEmpty())
		{
			NumSkipped++;
			continue;
		}

		EHktTerrainType TerrainType;
		if (!ResolveTerrainType(Parse.TypeName, TerrainType))
		{
			UE_LOG(LogHktVoxelTerrain, Verbose,
				TEXT("[Import] %s: TypeName '%s' 가 EHktTerrainType 와 매칭되지 않음 — skip"),
				*AssetName, *Parse.TypeName);
			NumSkipped++;
			continue;
		}

		UTexture2D* SourceTex = Cast<UTexture2D>(AssetData.GetAsset());
		if (!SourceTex)
		{
			NumSkipped++;
			continue;
		}

		FHktVoxelBlockStyle& Style = GetOrAddBlockStyle(BlockStyles, TerrainType);

		if (Parse.IsAtlas())
		{
			// 그리드 셀별 sub-texture 자산 생성.
			const int32 SrcW = SourceTex->Source.GetSizeX();
			const int32 SrcH = SourceTex->Source.GetSizeY();
			const int32 CellW = SrcW / Parse.AtlasCols;
			const int32 CellH = SrcH / Parse.AtlasRows;
			if (CellW <= 0 || CellH <= 0)
			{
				UE_LOG(LogHktVoxelTerrain, Warning,
					TEXT("[Import] %s: 셀 크기 0 (atlas=%dx%d, source=%dx%d) — skip"),
					*AssetName, Parse.AtlasCols, Parse.AtlasRows, SrcW, SrcH);
				NumSkipped++;
				continue;
			}

			const int32 TotalCells = Parse.AtlasCols * Parse.AtlasRows;
			// PackagePath 는 자산이 속한 콘텐츠 디렉토리.
			const FString SplitParent = AssetData.PackagePath.ToString();

			for (int32 Cell = 0; Cell < TotalCells; Cell++)
			{
				FString Face;
				if (!MapAtlasCellToFace(Cell, TotalCells, Face)) { continue; }

				const int32 Col = Cell % Parse.AtlasCols;
				const int32 Row = Cell / Parse.AtlasCols;
				UTexture2D* Sub = CreateSplitTextureAsset(
					SourceTex, SplitParent, Parse.TypeName, Face, Parse.bNormal,
					Col * CellW, Row * CellH, CellW, CellH);
				if (Sub)
				{
					AssignTextureToFace(Style, Face, Parse.bNormal, Sub);
				}
			}
			NumAtlases++;
		}
		else
		{
			AssignTextureToFace(Style, Parse.Face, Parse.bNormal, SourceTex);
			NumSingle++;
		}
	}

	MarkPackageDirty();

	UE_LOG(LogHktVoxelTerrain, Log,
		TEXT("[Import] '%s' 디렉토리 임포트 완료 — single=%d, atlas=%d, skipped=%d, BlockStyles=%d"),
		*ContentDir, NumSingle, NumAtlases, NumSkipped, BlockStyles.Num());
}

void UHktVoxelTerrainStyleSet::Bake()
{
	if (UHktVoxelTerrainBakeLibrary::BakeStyleSet(this))
	{
		UE_LOG(LogHktVoxelTerrain, Log,
			TEXT("[StyleSet] Bake 성공 — '%s' (%d slices)"),
			*GetName(), SliceCount);
	}
}

#endif // WITH_EDITOR
