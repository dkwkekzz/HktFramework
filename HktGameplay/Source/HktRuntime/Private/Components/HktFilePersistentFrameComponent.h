// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "HktServerRuleInterfaces.h"
#include "HktFilePersistentFrameComponent.generated.h"

/**
 * IHktPersistentTickProvider - 영구 프레임 번호 배치 할당 인터페이스
 *
 * Hi-Lo 알고리즘 기반으로 DB/스토리지에서 프레임 번호 범위를 예약받습니다.
 * 구현체: 파일(개발용), Redis, SQL 등 - 교체 가능하도록 인터페이스로 분리.
 */
class IHktPersistentTickProvider
{
public:
    virtual ~IHktPersistentTickProvider() = default;

    virtual void ReserveBatch(int64 BatchSize, TFunction<void(int64 NewMaxFrame)> Callback) = 0;
};

/**
 * FHktFilePersistentFrameProvider - 파일 기반 영구 프레임 번호 제공자
 *
 * Saved/HktPersistentFrame.json에 GlobalFrameCounter를 저장합니다.
 * UHktFilePersistentFrameComponent 내부에서 사용.
 */
class HKTRUNTIME_API FHktFilePersistentFrameProvider : public IHktPersistentTickProvider
{
public:
    FHktFilePersistentFrameProvider();
    virtual void ReserveBatch(int64 BatchSize, TFunction<void(int64 NewMaxFrame)> Callback) override;

private:
    FString GetFilePath() const;
};

/**
 * UHktFilePersistentFrameComponent - IHktFrameManager 구현 (파일 기반 영구 프레임)
 *
 * 역할:
 *   - Hi-Lo 배치 할당으로 영구 프레임 번호 제공
 *   - 내부 FHktFilePersistentFrameProvider로 Saved/HktPersistentFrame.json 사용
 */
UCLASS(ClassGroup=(HktRuntime), meta=(BlueprintSpawnableComponent))
class HKTRUNTIME_API UHktFilePersistentFrameComponent : public UActorComponent, public IHktFrameManager
{
    GENERATED_BODY()

public:
    UHktFilePersistentFrameComponent();

    virtual bool IsInitialized() const override;
    virtual int64 GetFrameNumber() const override;
    virtual void AdvanceFrame() override;

protected:
    virtual void BeginPlay() override;

private:
    void ReserveNextBatch();

    UPROPERTY(EditDefaultsOnly, Category = "Hkt|PersistentTick", meta = (ClampMin = "1000", ClampMax = "1000000"))
    int64 BatchSize = 36000;

    int64 ReservedMaxFrame = 0;
    int64 CurrentFrame = 0;
    bool bIsReservePending = false;
    bool bIsInitialized = false;

    TUniquePtr<IHktPersistentTickProvider> Provider;
};
