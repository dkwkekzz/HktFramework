// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVoxelPalette.h"
#include "HktVoxelSkinLog.h"
#include "Engine/Texture2D.h"

void UHktVoxelPaletteManager::SetActivePalette(int32 PaletteRow)
{
	ActivePaletteRow = FMath::Clamp(PaletteRow, 0, PALETTE_HEIGHT - 1);
}

FLinearColor UHktVoxelPaletteManager::GetPaletteColor(int32 PaletteRow, int32 ColorIndex) const
{
	// TODO: Phase 2 — 텍스처에서 직접 읽기
	// 프로토타입에서는 하드코딩된 기본 색상 반환
	static const FLinearColor DefaultColors[8] = {
		FLinearColor(0.2f, 0.2f, 0.2f),  // 0: 어두운 회색
		FLinearColor(0.4f, 0.3f, 0.2f),  // 1: 갈색
		FLinearColor(0.3f, 0.6f, 0.2f),  // 2: 녹색
		FLinearColor(0.2f, 0.3f, 0.7f),  // 3: 파랑
		FLinearColor(0.7f, 0.2f, 0.2f),  // 4: 빨강
		FLinearColor(0.8f, 0.7f, 0.2f),  // 5: 노랑
		FLinearColor(0.9f, 0.9f, 0.9f),  // 6: 흰색
		FLinearColor(0.1f, 0.1f, 0.1f),  // 7: 검정
	};

	ColorIndex = FMath::Clamp(ColorIndex, 0, PALETTE_WIDTH - 1);
	return DefaultColors[ColorIndex];
}

UTexture2D* UHktVoxelPaletteManager::CreateDefaultPaletteTexture()
{
	UTexture2D* Texture = UTexture2D::CreateTransient(PALETTE_WIDTH, PALETTE_HEIGHT, PF_B8G8R8A8);
	if (!Texture)
	{
		UE_LOG(LogHktVoxelSkin, Error, TEXT("Failed to create default palette texture"));
		return nullptr;
	}

	Texture->Filter = TF_Nearest;  // 포인트 필터링 — 복셀 팔레트에 필수
	Texture->SRGB = true;
	Texture->AddressX = TA_Clamp;
	Texture->AddressY = TA_Clamp;

	// 텍스처 데이터 채우기
	FTexture2DMipMap& Mip = Texture->GetPlatformData()->Mips[0];
	void* TextureData = Mip.BulkData.Lock(LOCK_READ_WRITE);
	uint8* Pixels = static_cast<uint8*>(TextureData);

	for (int32 Row = 0; Row < PALETTE_HEIGHT; Row++)
	{
		for (int32 Col = 0; Col < PALETTE_WIDTH; Col++)
		{
			FLinearColor Color = GetPaletteColor(Row, Col);
			FColor SRGBColor = Color.ToFColor(true);

			int32 Idx = (Row * PALETTE_WIDTH + Col) * 4;
			Pixels[Idx + 0] = SRGBColor.B;
			Pixels[Idx + 1] = SRGBColor.G;
			Pixels[Idx + 2] = SRGBColor.R;
			Pixels[Idx + 3] = SRGBColor.A;
		}
	}

	Mip.BulkData.Unlock();
	Texture->UpdateResource();

	PaletteTexture = Texture;
	UE_LOG(LogHktVoxelSkin, Log, TEXT("Created default palette texture (%dx%d)"), PALETTE_WIDTH, PALETTE_HEIGHT);

	return Texture;
}
