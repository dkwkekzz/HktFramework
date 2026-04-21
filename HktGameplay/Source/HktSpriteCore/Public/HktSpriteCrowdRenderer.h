// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktCoreDefs.h"
#include "GameplayTagContainer.h"
#include "HktSpriteTypes.h"
#include "HktSpriteCrowdRenderer.generated.h"

class UHierarchicalInstancedStaticMeshComponent;
class UStaticMesh;
class UMaterialInterface;
class UHktSpritePartTemplate;

/**
 * FHktSpriteEntityUpdate — 한 엔터티, 한 프레임의 스프라이트 갱신 입력.
 * HktSpriteCore Processor가 구성하여 전달.
 */
struct FHktSpriteEntityUpdate
{
	/** 엔터티 루트(Body pivot) 월드 위치 */
	FVector WorldLocation = FVector::ZeroVector;

	/** 카메라 기준 8방향 */
	EHktSpriteFacing Facing = EHktSpriteFacing::S;

	/** 현재 재생 중 액션의 FName (PartTemplate.Actions 키와 대응) */
	FName ActionId;

	/** 해당 AnimState가 시작된 VM tick */
	int64 AnimStartTick = 0;

	/** 현재 렌더 프레임의 VM tick (히트스톱 시 고정) */
	int64 NowTick = 0;

	/** 1 tick 당 ms (예: 30Hz → ~33.33) */
	float TickDurationMs = 1000.f / 30.f;

	/** AttackSpeed 등 외부 플레이 속도 배율 */
	float PlayRate = 1.f;

	/** 틴트 오버라이드 (팔레트와 곱해짐) */
	FLinearColor TintOverride = FLinearColor::White;

	/** 0=기본 팔레트. 8-color palette system에서 행 번호. */
	int32 PaletteIndex = 0;
};

/**
 * UHktSpriteCrowdRenderer — HISM 기반 2D 스프라이트 크라우드 렌더러.
 *
 * 구조:
 *   - (PartSlot, PartTag) 조합마다 전용 UHierarchicalInstancedStaticMeshComponent 하나.
 *   - 메쉬는 단일 Quad, 머티리얼은 Y-axis billboard + Custom Primitive Data 16슬롯.
 *   - 엔터티 한 명이 최대 7개 슬롯(Body/Head/Weapon/Shield/3 Headgear)을 차지.
 *
 * 비동기 파츠 로드:
 *   - UHktAssetSubsystem::LoadAssetAsync로 UHktSpritePartTemplate 획득 후 캐시.
 *   - 로드 완료 전까지는 해당 슬롯 skip. 로드 완료 시 다음 UpdateEntity에서 스폰.
 */
UCLASS(ClassGroup=(HktSprite), meta=(BlueprintSpawnableComponent))
class HKTSPRITECORE_API UHktSpriteCrowdRenderer : public UActorComponent
{
	GENERATED_BODY()

public:
	UHktSpriteCrowdRenderer();

	/** 모든 파츠가 공유하는 빌보드 쿼드 메쉬 (2-tri plane, pivot 하단 중심) */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UStaticMesh> QuadMesh;

	/** Y-axis billboard + CPD 16슬롯 소비 머티리얼 (모든 아틀라스가 DynamicMI 파생) */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite")
	TObjectPtr<UMaterialInterface> SpriteMaterialTemplate;

	/** 픽셀 크기를 월드 단위로 환산할 때 적용하는 글로벌 스케일. 기본 1. */
	UPROPERTY(EditAnywhere, Category="HKT|Sprite", meta=(ClampMin="0.01"))
	float GlobalWorldScale = 1.f;

	/** 엔터티 등록. 이미 등록된 경우 no-op. */
	void RegisterEntity(FHktEntityId Id);

	/** 엔터티 모든 인스턴스 제거. */
	void UnregisterEntity(FHktEntityId Id);

	/** Loadout 반영. 변경된 슬롯만 다시 스폰/제거. 비동기 로드는 내부에서 처리. */
	void SetLoadout(FHktEntityId Id, const FHktSpriteLoadout& Loadout);

	/** 엔터티의 이번 프레임 트랜스폼/프레임 갱신. */
	void UpdateEntity(FHktEntityId Id, const FHktSpriteEntityUpdate& Update);

	/** 모든 인스턴스/캐시 초기화. */
	void ClearAll();

private:
	// --- 키/상태 ---
	struct FSpritePartKey
	{
		EHktSpritePartSlot Slot = EHktSpritePartSlot::Body;
		FGameplayTag PartTag;

		bool operator==(const FSpritePartKey& O) const { return Slot == O.Slot && PartTag == O.PartTag; }
	};
	friend FORCEINLINE uint32 GetTypeHash(const FSpritePartKey& K)
	{
		return HashCombine(GetTypeHash(static_cast<uint8>(K.Slot)), GetTypeHash(K.PartTag));
	}

	/** 엔터티의 한 슬롯에 배정된 인스턴스 */
	struct FSlotInstance
	{
		FGameplayTag PartTag;
		FSpritePartKey Key;
		int32 InstanceIndex = INDEX_NONE;
		bool bPending = false;  // 템플릿 비동기 로드 대기 중
	};

	struct FEntityState
	{
		FHktSpriteLoadout Loadout;
		TStaticArray<FSlotInstance, (int32)EHktSpritePartSlot::MAX> Slots;
		bool bActive = false;
	};

	// --- HISM 풀 ---
	// FSpritePartKey는 non-USTRUCT라 UPROPERTY TMap 키로 쓸 수 없음.
	// GC 루팅은 AllHISMs 배열이 담당, 실제 룩업은 PartHISMs TMap이 담당.
	UPROPERTY(Transient)
	TArray<TObjectPtr<UHierarchicalInstancedStaticMeshComponent>> AllHISMs;

	TMap<FSpritePartKey, UHierarchicalInstancedStaticMeshComponent*> PartHISMs;

	// --- 로드된 PartTemplate 캐시 (FGameplayTag는 USTRUCT이므로 reflection OK) ---
	UPROPERTY(Transient)
	TMap<FGameplayTag, TObjectPtr<UHktSpritePartTemplate>> TemplateCache;

	TMap<FHktEntityId, FEntityState> Entities;

	/** 동일 태그에 대해 로딩 중임을 표시. 완료 후 제거. */
	TSet<FGameplayTag> PendingTemplateLoads;

	/** 파츠 스폰: 템플릿이 로드돼 있으면 HISM 인스턴스 생성, 아니면 비동기 로드 스케줄. */
	void AssignPartSlot(FHktEntityId Id, EHktSpritePartSlot Slot, FGameplayTag PartTag);

	/** 파츠 제거: 해당 슬롯 인스턴스 제거 (HISM 자체는 유지). */
	void ClearPartSlot(FHktEntityId Id, EHktSpritePartSlot Slot);

	UHierarchicalInstancedStaticMeshComponent* GetOrCreateHISM(const FSpritePartKey& Key, UHktSpritePartTemplate* Template);

	void RequestTemplateLoad(FGameplayTag Tag);

	/** 로드 완료된 파츠를 보류 슬롯에 스폰. */
	void ResolvePendingSlots();

	/**
	 * HISM 인스턴스를 제거하면서 swap-and-pop으로 인덱스가 바뀐 마지막 인스턴스를
	 * 참조하던 모든 FSlotInstance의 InstanceIndex를 remap.
	 */
	void RemoveInstanceAndRemap(const FSpritePartKey& Key, int32 InstanceIndex);

	/** 주어진 엔터티/슬롯의 CPD(16슬롯)를 계산하고 적용. */
	void ApplySlotInstanceTransform(FHktEntityId Id, EHktSpritePartSlot Slot, const FHktSpriteEntityUpdate& Update,
		UHktSpritePartTemplate* Template, FSlotInstance& Inst);

	/** Body의 현재 프레임에서 해당 슬롯이 부착될 앵커 오프셋(픽셀)을 구함. 없으면 ZeroVector2. */
	static FVector2f ResolveChildAnchor(EHktSpritePartSlot Slot, const struct FHktSpriteFrame& BodyFrame);

	/** 슬롯별 Z-bias 기본값(파츠 간 겹침 순서). */
	static int32 GetSlotZBiasDefault(EHktSpritePartSlot Slot);
};
