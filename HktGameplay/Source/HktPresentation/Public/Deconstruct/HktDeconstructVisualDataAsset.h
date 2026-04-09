// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "DataAssets/HktActorVisualDataAsset.h"
#include "HktDeconstructTypes.h"
#include "HktDeconstructVisualDataAsset.generated.h"

class UNiagaraSystem;
class UStaticMesh;
class UMaterialInterface;

/**
 * Deconstruction 비주얼 설정용 DataAsset.
 * UHktActorVisualDataAsset를 상속하여 ActorClass + Deconstruct 데이터를 하나의 에셋에 통합.
 * 1개 엔티티에 1개 DataAsset만 필요.
 *
 * IdentifierTag 예시: "Entity.Character.Boss", "Entity.Character.DeconstructDefault"
 */
UCLASS(BlueprintType)
class HKTPRESENTATION_API UHktDeconstructVisualDataAsset : public UHktActorVisualDataAsset
{
	GENERATED_BODY()

public:
	/** Deconstruction Niagara System (NS_HktDeconstruct) */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Deconstruct")
	TObjectPtr<UNiagaraSystem> DeconstructSystem;

	/** 내부 발광 Material (M_HktDeconstruct_CoreGlow). SkeletalMesh에 적용. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Deconstruct")
	TObjectPtr<UMaterialInterface> CoreGlowMaterial;

	/**
	 * Element별 색상 팔레트.
	 * 배열 크기 = EHktDeconstructElement::Count (5).
	 * Fire, Ice, Lightning, Void, Nature 순서.
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Deconstruct|Palette",
		meta = (TitleProperty = "{Primary}"))
	TArray<FHktDeconstructPalette> ElementPalettes;

	/** 보간/매핑/연출 튜닝 파라미터. 에디터에서 유닛별로 조정 가능. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Deconstruct|Tuning")
	FHktDeconstructTuning Tuning;

	/**
	 * Element별 GeoFragment 메시.
	 * Fire=SM_HktGeo_CustomShard, Ice=SM_HktGeo_Octahedron,
	 * Lightning=SM_HktGeo_Tetrahedron, Void=SM_HktGeo_Icosahedron,
	 * Nature=SM_HktGeo_CustomShard
	 */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "HKT|Deconstruct|Fragment")
	TArray<TObjectPtr<UStaticMesh>> FragmentMeshes;

	/** 지정된 Element에 대한 팔레트 반환. DataAsset에 없으면 하드코딩 기본값 사용. */
	FHktDeconstructPalette GetPalette(EHktDeconstructElement Element) const
	{
		const int32 Idx = static_cast<int32>(Element);
		if (ElementPalettes.IsValidIndex(Idx))
		{
			return ElementPalettes[Idx];
		}
		return HktDeconstructDefaults::GetDefaultPalette(Element);
	}

	/** 지정된 Element에 대한 Fragment 메시 반환. 없으면 nullptr. */
	UStaticMesh* GetFragmentMesh(EHktDeconstructElement Element) const
	{
		const int32 Idx = static_cast<int32>(Element);
		if (FragmentMeshes.IsValidIndex(Idx))
		{
			return FragmentMeshes[Idx];
		}
		return nullptr;
	}
};
