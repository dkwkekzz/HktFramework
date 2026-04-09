// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "HktServerRuleInterfaces.h"
#include "HktClientRuleInterfaces.h"
#include "HktRuleSubsystem.generated.h"

/**
 * Rule 인스턴스를 제공하는 서브시스템.
 * Core <- Rule <- Runtime 의존에서 Runtime이 인터페이스를 얻기 위해 사용.
 */
UCLASS()
class HKTRULE_API UHktRuleSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	static UHktRuleSubsystem* Get(UWorld* World);

	IHktServerRule* GetServerRule() { return ServerRule.Get(); }
	IHktClientRule* GetClientRule() { return ClientRule.Get(); }

	FHktOnSystemMessage& OnSystemMessage() { return SystemMessageDelegate; }

	/** 새 ClientRule 인스턴스 생성 — 각 PlayerController가 독립 인스턴스를 소유 */
	TUniquePtr<IHktClientRule> CreateClientRule();

private:
	TUniquePtr<IHktServerRule> ServerRule;
	TUniquePtr<IHktClientRule> ClientRule;
	FHktOnSystemMessage SystemMessageDelegate;
};
