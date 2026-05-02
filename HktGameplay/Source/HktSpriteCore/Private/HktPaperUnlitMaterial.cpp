// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktPaperUnlitMaterial.h"
#include "HktSpriteCoreLog.h"
#include "Materials/Material.h"
#include "Materials/MaterialInterface.h"

namespace HktPaperUnlitMaterial
{
	const FName TextureParamName = TEXT("Texture");

	const TCHAR* PackagePath     = TEXT("/HktGameplay/Materials/M_HktPaperUnlit");
	const TCHAR* AssetObjectPath = TEXT("/HktGameplay/Materials/M_HktPaperUnlit.M_HktPaperUnlit");
	const TCHAR* MaterialName    = TEXT("M_HktPaperUnlit");

	UMaterialInterface* GetDefault()
	{
		static TWeakObjectPtr<UMaterialInterface> Cached;
		if (Cached.IsValid())
		{
			return Cached.Get();
		}

		// 플러그인 콘텐츠에 쿠킹된 에셋 로드 — Editor / Shipping 양쪽에서 동작.
		// 에셋은 HktPaper2DGenerator(Editor) 가 빌드·저장해 커밋한다.
		if (UMaterialInterface* Loaded =
			LoadObject<UMaterialInterface>(nullptr, AssetObjectPath, nullptr, LOAD_Quiet | LOAD_NoWarn))
		{
			Cached = Loaded;
			return Loaded;
		}

		UE_LOG(LogHktSpriteCore, Warning,
			TEXT("[HktPaperUnlitMaterial] 기본 머티리얼(%s)을 해결하지 못했다. "
			     "에디터에서 `HktPaperSprite.BuildUnlitMaterial` 콘솔 명령을 실행하라."),
			AssetObjectPath);
		return UMaterial::GetDefaultMaterial(MD_Surface);
	}
}
