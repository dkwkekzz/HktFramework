// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Rendering/HktVoxelMaterialLUT.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"

FRHITexture* UHktVoxelMaterialLUT::GetMaterialLUTRHI() const
{
	if (MaterialLUT && MaterialLUT->GetResource())
	{
		return MaterialLUT->GetResource()->TextureRHI;
	}
	return nullptr;
}

void UHktVoxelMaterialLUT::EnsureTableInitialized()
{
	if (!bTableInitialized)
	{
		// 기본값: 기존 하드코딩과 동일 (Roughness=0.8, Metallic=0.0, Specular=0.5)
		for (int32 i = 0; i < 256; i++)
		{
			MaterialTable[i].Roughness = 0.8f;
			MaterialTable[i].Metallic = 0.0f;
			MaterialTable[i].Specular = 0.5f;
		}
		bTableInitialized = true;
	}
}

void UHktVoxelMaterialLUT::SetMaterial(uint16 TypeID, float Roughness, float Metallic, float Specular)
{
	EnsureTableInitialized();
	const uint8 Index = static_cast<uint8>(TypeID % 256);
	MaterialTable[Index].Roughness = FMath::Clamp(Roughness, 0.0f, 1.0f);
	MaterialTable[Index].Metallic = FMath::Clamp(Metallic, 0.0f, 1.0f);
	MaterialTable[Index].Specular = FMath::Clamp(Specular, 0.0f, 1.0f);
}

void UHktVoxelMaterialLUT::BuildLUTTexture()
{
	EnsureTableInitialized();

	if (!MaterialLUT)
	{
		MaterialLUT = NewObject<UTexture2D>(this, TEXT("HktMaterialLUT"));
	}

	// 256×1 RGBA8: R=Metallic, G=Specular, B=Roughness, A=Reserved
	const int32 Width = 256;
	const int32 Height = 1;

	FTexturePlatformData* PlatformData = new FTexturePlatformData();
	PlatformData->SizeX = Width;
	PlatformData->SizeY = Height;
	PlatformData->PixelFormat = PF_B8G8R8A8;

	FTexture2DMipMap* Mip = new FTexture2DMipMap();
	PlatformData->Mips.Add(Mip);
	Mip->SizeX = Width;
	Mip->SizeY = Height;

	Mip->BulkData.Lock(LOCK_READ_WRITE);
	FColor* TexData = reinterpret_cast<FColor*>(Mip->BulkData.Realloc(Width * Height * sizeof(FColor)));

	for (int32 i = 0; i < Width; i++)
	{
		// UE5 GBuffer 관례: GBufferB = (Metallic, Specular, Roughness, ?)
		// PF_B8G8R8A8 → B=R채널, G=G채널, R=B채널 (BGRA 순서)
		const FHktMaterialEntry& Entry = MaterialTable[i];
		TexData[i] = FColor(
			FMath::RoundToInt32(Entry.Roughness * 255.0f),  // R → 셰이더에서 .r로 접근
			FMath::RoundToInt32(Entry.Specular * 255.0f),   // G → 셰이더에서 .g로 접근
			FMath::RoundToInt32(Entry.Metallic * 255.0f),   // B → 셰이더에서 .b로 접근
			255                                              // A → Reserved
		);
	}

	Mip->BulkData.Unlock();

	MaterialLUT->SetPlatformData(PlatformData);
	MaterialLUT->Filter = TF_Nearest;
	MaterialLUT->SRGB = false;  // 리니어 데이터
	MaterialLUT->AddressX = TA_Clamp;
	MaterialLUT->AddressY = TA_Clamp;
	MaterialLUT->UpdateResource();

	UE_LOG(LogTemp, Log, TEXT("[HktMaterialLUT] Built 256x1 material LUT texture"));
}

void UHktVoxelMaterialLUT::CreateDefaultTerrainLUT()
{
	EnsureTableInitialized();

	// Air(0) = 기본값 유지
	//                          Roughness  Metallic  Specular
	SetMaterial(1,  /* Grass */   0.90f,    0.00f,    0.20f);
	SetMaterial(2,  /* Dirt  */   0.95f,    0.00f,    0.15f);
	SetMaterial(3,  /* Stone */   0.70f,    0.00f,    0.40f);
	SetMaterial(4,  /* Sand  */   0.95f,    0.00f,    0.10f);
	SetMaterial(5,  /* Water */   0.05f,    0.00f,    0.90f);  // 매끈 + 강한 반사
	SetMaterial(6,  /* Snow  */   0.85f,    0.00f,    0.60f);  // 약간 반짝
	SetMaterial(7,  /* Ice   */   0.10f,    0.00f,    0.85f);  // 매끈 + 반사
	SetMaterial(8,  /* Gravel*/   0.92f,    0.00f,    0.20f);
	SetMaterial(9,  /* Clay  */   0.80f,    0.00f,    0.30f);
	SetMaterial(10, /* Bedrock*/  0.65f,    0.00f,    0.35f);

	BuildLUTTexture();

	UE_LOG(LogTemp, Log, TEXT("[HktMaterialLUT] Created default terrain PBR mappings"));
}
