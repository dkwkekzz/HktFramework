// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Containers/BitArray.h"
#include "GameplayTagContainer.h"
#include "HktCoreDefs.h"
#include "HktSpriteCrowdRenderer.h"   // FHktSpriteEntityUpdate, EHktSpriteUpdateStatus 재사용
#include "HktSpriteTypes.h"
#include "UObject/SoftObjectPath.h"
#include "HktSpriteNiagaraCrowdRenderer.generated.h"

class UNiagaraComponent;
class UNiagaraSystem;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UStaticMesh;
class UTexture2D;
class UHktSpriteCharacterTemplate;

/**
 * UHktSpriteNiagaraCrowdRenderer — Niagara Mesh Renderer 기반 크라우드 렌더러.
 *
 * 설계 문서: Docs/Design-HktSpriteNiagaraCrowdRenderer.md
 *
 * 기존 UHktSpriteCrowdRenderer(HISM)와 외부 API는 동일. 내부 구조만 다음과 같이 교체:
 *   - 1 atlas = 1 UNiagaraComponent (NS_HktSpriteAtlasCrowd 인스턴스)
 *   - 인스턴스 attribute는 NDI Array(User.Positions/Colors/DynParam0/DynParam1/Scales)로 푸시
 *   - 빌보드/모션벡터/UV는 머티리얼이 아니라 Niagara Mesh Renderer가 처리
 *
 * 본 컴포넌트는 PR-1 단계에서는 단독으로 등록되지 않는다 — Processor가 CVar
 * `hkt.Sprite.Renderer == 1`일 때만 사용 (PR-2에서 dispatch 추가).
 */
UCLASS(ClassGroup=(HktSprite), meta=(BlueprintSpawnableComponent))
class HKTSPRITECORE_API UHktSpriteNiagaraCrowdRenderer : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktSpriteNiagaraCrowdRenderer();

	// --- 외부 API (HISM 버전과 1:1 시그니처 일치) ---
	void RegisterEntity(FHktEntityId Id);
	void UnregisterEntity(FHktEntityId Id);
	void SetCharacter(FHktEntityId Id, FGameplayTag CharacterTag);
	void UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update);
	void ClearAll();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// --- 에디터 노출 옵션 ---

	/**
	 * NS_HktSpriteAtlasCrowd 템플릿. 비어 있으면 기본 경로
	 * `/HktGameplay/Niagara/NS_HktSpriteAtlasCrowd`를 시도한다.
	 */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TSoftObjectPtr<UNiagaraSystem> NiagaraSystemTemplate;

	/** WPO/CPD 제거된 머티리얼(M_HktSpriteAtlasUVOnly). MID로 wrap 후 atlas/AtlasSize 주입. */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UMaterialInterface> SpriteMaterialTemplate;

	UPROPERTY(EditAnywhere, Category="HKT|Sprite", meta=(ClampMin="0.01"))
	float GlobalWorldScale = 1.f;

	/** 컴포넌트 단위 Z-bias (cm). FHktSpriteEntityUpdate::ZBias와 합산. */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite|Depth")
	float ComponentZBias = 0.f;

private:
	/** Atlas 단위 인스턴스 풀 — NDI Array 푸시용 SoA. */
	struct FAtlasParticleArrays
	{
		TArray<FVector>      Positions;
		TArray<FLinearColor> Colors;
		TArray<FVector4>     DynParam0;   // (AtlasIdx, CellW_px, CellH_px, FlipV)
		TArray<FVector4>     DynParam1;   // (ZBias_cm, Palette, reserved, reserved)
		TArray<FVector>      Scales;      // (HalfW*2, 1, HalfH*2)
		bool                 bDirty = false;
	};

	struct FAtlasContext
	{
		TObjectPtr<UNiagaraComponent>          NiagaraComp;
		TObjectPtr<UMaterialInstanceDynamic>   MID;
		TWeakObjectPtr<UTexture2D>             AtlasTex;
		FAtlasParticleArrays                   Arrays;
		// PrimePending — HISM 경로의 propagation race 방어와 동일.
		uint64 PrimeRegisteredFrame = 0;
		bool   bPrimePending = false;
	};

	struct FEntityState
	{
		FGameplayTag    CharacterTag;
		FSoftObjectPath CurrentAtlasPath;
		int32           ParticleIndex = INDEX_NONE;
		bool            bActive = false;
		EHktSpriteUpdateStatus LastUpdateStatus = EHktSpriteUpdateStatus::OK;
	};

	UPROPERTY(Transient)
	TMap<FGameplayTag, TObjectPtr<UHktSpriteCharacterTemplate>> TemplateCache;

	TMap<FSoftObjectPath, FAtlasContext> Atlases;
	TMap<FHktEntityId, FEntityState> Entities;
	TSet<FGameplayTag> PendingTemplateLoads;

	void RequestTemplateLoad(FGameplayTag Tag);

	/** Atlas당 UNiagaraComponent + MID + 빈 SoA 풀 생성. */
	FAtlasContext* GetOrCreateAtlasContext(const FSoftObjectPath& AtlasPath, UTexture2D* AtlasTex);

	/** swap-and-pop 제거 + 마지막 인스턴스의 ParticleIndex remap. */
	void RemoveParticleAndRemap(const FSoftObjectPath& AtlasPath, int32 ParticleIndex);

	/** Frame 해석 + 검증 + 풀 슬롯 갱신/마이그레이션. */
	void ApplyEntityParticleData(FHktEntityId Id, const FHktSpriteEntityUpdate& Update,
		UHktSpriteCharacterTemplate* Template, FEntityState& State);

	/** 모든 dirty atlas의 NDI Array를 NiagaraComponent에 푸시. */
	void PushDirtyArraysToNiagara();

	/** SpriteMaterialTemplate이 비어 있으면 기본을 시도해 가져옴. */
	UMaterialInterface* ResolveBaseMaterial() const;

	/** NiagaraSystemTemplate이 비어 있으면 기본 경로 LoadSynchronous. */
	UNiagaraSystem* ResolveNiagaraSystem() const;
};
