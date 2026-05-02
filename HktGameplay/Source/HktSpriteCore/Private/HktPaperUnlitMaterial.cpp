// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperUnlitMaterial.h"
#include "HktSpriteCoreLog.h"
#include "Materials/Material.h"
#include "Materials/MaterialInterface.h"

namespace HktPaperUnlitMaterial
{
	const FName TextureParamName = TEXT("Texture");

	// 엔진 Paper2D 플러그인이 제공하는 기본 Masked Unlit 머티리얼.
	// 경로: Plugins/2D/Paper2D/Content/MaskedUnlitSpriteMaterial.uasset
	const TCHAR* AssetObjectPath =
		TEXT("/Paper2D/MaskedUnlitSpriteMaterial.MaskedUnlitSpriteMaterial");

	UMaterialInterface* GetDefault()
	{
		static TWeakObjectPtr<UMaterialInterface> Cached;
		if (Cached.IsValid())
		{
			return Cached.Get();
		}
		if (UMaterialInterface* Loaded =
			LoadObject<UMaterialInterface>(nullptr, AssetObjectPath, nullptr, LOAD_Quiet | LOAD_NoWarn))
		{
			Cached = Loaded;
			return Loaded;
		}
		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("[HktPaperUnlitMaterial] Paper2D 기본 머티리얼(%s)을 해결하지 못했다 — "
			     "Paper2D 플러그인 활성화 여부를 확인하라."),
			AssetObjectPath);
		return UMaterial::GetDefaultMaterial(MD_Surface);
	}
}
