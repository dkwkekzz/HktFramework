// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "UObject/SoftObjectPath.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCrowdRenderer.generated.h"

class UHierarchicalInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UTexture2D;
class UHktSpriteCharacterTemplate;

/**
 * FHktSpriteEntityUpdate — 한 엔터티, 한 프레임의 스프라이트 갱신 입력.
 * HktSpriteCore Processor가 구성하여 전달.
 */
struct FHktSpriteEntityUpdate
{
	FVector WorldLocation = FVector::ZeroVector;
	EHktSpriteFacing Facing = EHktSpriteFacing::S;
	FGameplayTag AnimTag;
	int64 AnimStartTick = 0;
	int64 NowTick = 0;
	float TickDurationMs = 1000.f / 30.f;
	float PlayRate = 1.f;
	FLinearColor TintOverride = FLinearColor::White;
	int32 PaletteIndex = 0;
};

/**
 * UHktSpriteCrowdRenderer — HISM 기반 2D 스프라이트 크라우드 렌더러.
 *
 * 구조:
 *   - 하나의 아틀라스 텍스처(SoftObjectPath)당 HISM 하나.
 *   - 캐릭터가 애니마다 다른 아틀라스를 쓰면 엔터티 인스턴스는 현재 재생 중 애니의
 *     아틀라스 HISM으로 이동(migrate)한다.
 *   - 메쉬는 단일 Quad, 머티리얼은 Y-axis billboard + Custom Primitive Data 16슬롯.
 *   - 엔터티 한 명은 동시에 정확히 1개의 HISM 인스턴스에만 존재.
 */
UCLASS(ClassGroup=(HktSprite), meta=(BlueprintSpawnableComponent))
class HKTSPRITECORE_API UHktSpriteCrowdRenderer : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktSpriteCrowdRenderer();

	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UMaterialInterface> SpriteMaterialTemplate;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite", meta=(ClampMin="0.01"))
	float GlobalWorldScale = 1.f;

	void RegisterEntity(FHktEntityId Id);
	void UnregisterEntity(FHktEntityId Id);

	/** 엔터티의 캐릭터 태그를 지정/변경. 실제 HISM 배정은 첫 UpdateEntity에서 수행. */
	void SetCharacter(FHktEntityId Id, FGameplayTag CharacterTag);

	void UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update);
	void ClearAll();

private:
	/** 엔터티 1명의 렌더 상태 — 현재 속한 아틀라스 HISM + 인스턴스 인덱스. */
	struct FEntityState
	{
		FGameplayTag CharacterTag;
		FSoftObjectPath CurrentAtlasPath;  // 현재 들어가 있는 HISM의 키
		int32 InstanceIndex = INDEX_NONE;
		bool bActive = false;

		// 매 프레임 Update 실패(템플릿 로딩/아틀라스 null/범위초과 등)가 반복되므로
		// 상태 전이일 때만 로그를 남기기 위한 마지막 실패 코드.
		// 0=OK, 1=TemplateMissing, 2=AnimationNull, 3=AtlasNull, 4=InvalidCellSize,
		// 5=HISMCreateFailed, 6=InvalidDir, 7=InvalidFrame
		uint8 LastUpdateStatus = 0;
	};

	UPROPERTY(Transient)
	TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> AllHISMs;

	/** 아틀라스 SoftObjectPath → HISM (고유 아틀라스당 하나) */
	TMap<FSoftObjectPath, UHierarchicalInstancedStaticMeshComponent*> AtlasHISMs;

	UPROPERTY(Transient)
	TMap<FGameplayTag, TObjectPtr<UHktSpriteCharacterTemplate>> TemplateCache;

	TMap<FHktEntityId, FEntityState> Entities;

	TSet<FGameplayTag> PendingTemplateLoads;

	void RequestTemplateLoad(FGameplayTag Tag);

	UHierarchicalInstancedStaticMeshComponent* GetOrCreateHISM(const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex);

	/** swap-and-pop 제거 + InstanceIndex remap. */
	void RemoveInstanceAndRemap(const FSoftObjectPath& AtlasPath, int32 InstanceIndex);

	/**
	 * 애니별 아틀라스/셀크기 해석 — Animation 쪽이 비어있으면 Template 폴백.
	 * 반환 텍스처는 LoadSynchronous 결과. 실패 시 nullptr.
	 */
	static UTexture2D* ResolveAtlas(const FHktSpriteAnimation& Anim, UHktSpriteCharacterTemplate* Template,
		FSoftObjectPath& OutPath, FVector2f& OutCellSize);

	void ApplyEntityInstanceTransform(FHktEntityId Id, const FHktSpriteEntityUpdate& Update,
		UHktSpriteCharacterTemplate* Template, FEntityState& State);
};
