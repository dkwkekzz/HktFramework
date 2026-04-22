// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktSpriteBillboardMaterial.h"
#include "HktSpriteCoreLog.h"
#include "Materials/Material.h"
#include "Materials/MaterialInterface.h"
#include "UObject/Package.h"

namespace HktSpriteBillboardMaterial
{
	const FName AtlasParamName     = TEXT("Atlas");
	const FName AtlasSizeParamName = TEXT("AtlasSize");

	const TCHAR* PackagePath     = TEXT("/HktGameplay/Materials/M_HktSpriteYBillboard");
	const TCHAR* AssetObjectPath = TEXT("/HktGameplay/Materials/M_HktSpriteYBillboard.M_HktSpriteYBillboard");
	const TCHAR* MaterialName    = TEXT("M_HktSpriteYBillboard");

	UMaterialInterface* GetDefault()
	{
		static TWeakObjectPtr<UMaterialInterface> Cached;
		if (Cached.IsValid())
		{
			return Cached.Get();
		}

		// 플러그인 콘텐츠에 쿠킹된 에셋 로드 — Editor / Shipping 양쪽에서 동작.
		// 에셋은 HktSpriteGenerator(Editor 모듈)가 빌드·저장해 커밋한다.
		if (UMaterialInterface* Loaded =
			LoadObject<UMaterialInterface>(nullptr, AssetObjectPath, nullptr, LOAD_Quiet | LOAD_NoWarn))
		{
			Cached = Loaded;
			return Loaded;
		}

		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("[HktSpriteBillboardMaterial] 기본 머티리얼(%s)을 해결하지 못했다. "
			     "에디터에서 `HktSprite.BuildBillboardMaterial` 콘솔 명령을 실행하거나, "
			     "UHktSpriteCrowdRenderer::SpriteMaterialTemplate을 명시 할당하라."),
			AssetObjectPath);
		return UMaterial::GetDefaultMaterial(MD_Surface);
	}
}
