// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelTileAtlas.h"
#include "Engine/Texture2DArray.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"

// ============================================================================
// RHI 접근
// ============================================================================

FRHITexture* UHktVoxelTileAtlas::GetTileArrayRHI() const
{
	if (TileArray && TileArray->GetResource())
	{
		return TileArray->GetResource()->TextureRHI;
	}
	return nullptr;
}

FRHITexture* UHktVoxelTileAtlas::GetTileIndexLUTRHI() const
{
	if (TileIndexLUT && TileIndexLUT->GetResource())
	{
		return TileIndexLUT->GetResource()->TextureRHI;
	}
	return nullptr;
}

// ============================================================================
// CPU 매핑
// ============================================================================

void UHktVoxelTileAtlas::EnsureMappingInitialized()
{
	if (!bMappingInitialized)
	{
		FMemory::Memset(TileMappingTable, 255, sizeof(TileMappingTable));
		bMappingInitialized = true;
	}
}

void UHktVoxelTileAtlas::SetTileMapping(uint16 TypeID, uint8 TopSlice, uint8 SideSlice, uint8 BottomSlice)
{
	EnsureMappingInitialized();
	const uint8 Row = static_cast<uint8>(TypeID % 256);
	TileMappingTable[Row][0] = TopSlice;
	TileMappingTable[Row][1] = SideSlice;
	TileMappingTable[Row][2] = BottomSlice;
}

void UHktVoxelTileAtlas::BuildLUTTexture()
{
	EnsureMappingInitialized();

	if (!TileIndexLUT)
	{
		TileIndexLUT = NewObject<UTexture2D>(this, TEXT("HktTileIndexLUT"));
	}

	// 3×256 R8 텍스처 (Width=3, Height=256)
	const int32 Width = 3;
	const int32 Height = 256;

	FTexturePlatformData* PlatformData = new FTexturePlatformData();
	PlatformData->SizeX = Width;
	PlatformData->SizeY = Height;
	PlatformData->PixelFormat = PF_G8;

	FTexture2DMipMap* Mip = new FTexture2DMipMap();
	PlatformData->Mips.Add(Mip);
	Mip->SizeX = Width;
	Mip->SizeY = Height;

	Mip->BulkData.Lock(LOCK_READ_WRITE);
	uint8* TexData = static_cast<uint8*>(Mip->BulkData.Realloc(Width * Height));

	for (int32 Row = 0; Row < Height; Row++)
	{
		for (int32 Col = 0; Col < Width; Col++)
		{
			TexData[Row * Width + Col] = TileMappingTable[Row][Col];
		}
	}

	Mip->BulkData.Unlock();

	TileIndexLUT->SetPlatformData(PlatformData);
	TileIndexLUT->Filter = TF_Nearest;
	TileIndexLUT->SRGB = false;
	TileIndexLUT->AddressX = TA_Clamp;
	TileIndexLUT->AddressY = TA_Clamp;
	TileIndexLUT->UpdateResource();
}

// ============================================================================
// 디버그 유틸
// ============================================================================

void UHktVoxelTileAtlas::CreateDebugTileArray(int32 NumSlices)
{
	NumSlices = FMath::Clamp(NumSlices, 1, 256);

	if (!TileArray)
	{
		TileArray = NewObject<UTexture2DArray>(this, TEXT("HktDebugTileArray"));
	}

	const int32 TileSize = 64;

	// 고유 색상 팔레트 (TypeID 디버그용)
	static const FColor DebugColors[] = {
		FColor(100, 180,  60),  // 0: Grass-top (초록)
		FColor(140, 100,  50),  // 1: Grass-side (흙+잔디)
		FColor(120,  80,  40),  // 2: Dirt (흙)
		FColor(150, 150, 150),  // 3: Stone (돌)
		FColor(220, 200, 130),  // 4: Sand (모래)
		FColor( 60, 120, 200),  // 5: Water (물)
		FColor(240, 240, 250),  // 6: Snow (눈)
		FColor(180, 220, 240),  // 7: Ice (얼음)
		FColor(160, 140, 120),  // 8: Gravel (자갈)
		FColor(180, 140, 100),  // 9: Clay (점토)
		FColor( 60,  60,  60),  // 10: Bedrock (기반암)
		FColor(200,  80,  80),  // 11: Debug red
		FColor( 80, 200,  80),  // 12: Debug green
		FColor( 80,  80, 200),  // 13: Debug blue
		FColor(200, 200,  80),  // 14: Debug yellow
		FColor(200,  80, 200),  // 15: Debug magenta
	};
	const int32 NumDebugColors = UE_ARRAY_COUNT(DebugColors);

	// Source 이미지 배열 생성
	TArray<FColor> AllPixels;
	AllPixels.SetNum(TileSize * TileSize * NumSlices);

	for (int32 Slice = 0; Slice < NumSlices; Slice++)
	{
		const FColor BaseColor = DebugColors[Slice % NumDebugColors];
		const FColor DarkColor(
			FMath::Max(0, BaseColor.R - 30),
			FMath::Max(0, BaseColor.G - 30),
			FMath::Max(0, BaseColor.B - 30),
			255);

		for (int32 Y = 0; Y < TileSize; Y++)
		{
			for (int32 X = 0; X < TileSize; X++)
			{
				// 8×8 체크무늬 패턴
				const bool bChecker = ((X / 8) + (Y / 8)) % 2 == 0;
				// 타일 가장자리 1px 라인
				const bool bBorder = (X == 0 || Y == 0 || X == TileSize - 1 || Y == TileSize - 1);

				FColor Pixel;
				if (bBorder)
				{
					Pixel = FColor(40, 40, 40, 255);
				}
				else
				{
					Pixel = bChecker ? BaseColor : DarkColor;
				}

				AllPixels[Slice * TileSize * TileSize + Y * TileSize + X] = Pixel;
			}
		}
	}

	// Texture2DArray 소스 데이터 설정
	TileArray->SourceTextures.Empty();

	// 프로시저럴 Texture2DArray: 직접 PlatformData 빌드
	FTexturePlatformData* PlatformData = new FTexturePlatformData();
	PlatformData->SizeX = TileSize;
	PlatformData->SizeY = TileSize;
	PlatformData->SetNumSlices(NumSlices);
	PlatformData->PixelFormat = PF_B8G8R8A8;

	FTexture2DMipMap* Mip = new FTexture2DMipMap();
	PlatformData->Mips.Add(Mip);
	Mip->SizeX = TileSize;
	Mip->SizeY = TileSize;
	Mip->SizeZ = NumSlices;

	const int32 TotalBytes = TileSize * TileSize * NumSlices * sizeof(FColor);
	Mip->BulkData.Lock(LOCK_READ_WRITE);
	void* TexData = Mip->BulkData.Realloc(TotalBytes);
	FMemory::Memcpy(TexData, AllPixels.GetData(), TotalBytes);
	Mip->BulkData.Unlock();

	TileArray->SetPlatformData(PlatformData);
	TileArray->Filter = TF_Bilinear;
	TileArray->SRGB = true;
	TileArray->AddressX = TA_Wrap;
	TileArray->AddressY = TA_Wrap;
	TileArray->UpdateResource();

	UE_LOG(LogTemp, Log, TEXT("[HktTileAtlas] Created debug Texture2DArray: %d slices, %dx%d"),
		NumSlices, TileSize, TileSize);
}

void UHktVoxelTileAtlas::CreateDebugLUT()
{
	EnsureMappingInitialized();

	// HktTerrainType 매핑 — Top/Side/Bottom 슬라이스
	// Air(0) = 255 (unmapped)
	// Grass(1): Top=0(잔디), Side=1(흙+잔디), Bottom=2(흙)
	// Dirt(2): Top=2, Side=2, Bottom=2
	// Stone(3): Top=3, Side=3, Bottom=3
	// Sand(4): Top=4, Side=4, Bottom=4
	// Water(5): Top=5, Side=5, Bottom=5
	// Snow(6): Top=6, Side=6, Bottom=6
	// Ice(7): Top=7, Side=7, Bottom=7
	// Gravel(8): Top=8, Side=8, Bottom=8
	// Clay(9): Top=9, Side=9, Bottom=9
	// Bedrock(10): Top=10, Side=10, Bottom=10

	SetTileMapping(0, 255, 255, 255);  // Air: unmapped
	SetTileMapping(1, 0, 1, 2);        // Grass: top=잔디, side=흙+잔디, bottom=흙
	SetTileMapping(2, 2, 2, 2);        // Dirt: 전면 흙
	SetTileMapping(3, 3, 3, 3);        // Stone
	SetTileMapping(4, 4, 4, 4);        // Sand
	SetTileMapping(5, 5, 5, 5);        // Water
	SetTileMapping(6, 6, 6, 6);        // Snow
	SetTileMapping(7, 7, 7, 7);        // Ice
	SetTileMapping(8, 8, 8, 8);        // Gravel
	SetTileMapping(9, 9, 9, 9);        // Clay
	SetTileMapping(10, 10, 10, 10);    // Bedrock

	BuildLUTTexture();

	UE_LOG(LogTemp, Log, TEXT("[HktTileAtlas] Created debug LUT with terrain type mappings"));
}
