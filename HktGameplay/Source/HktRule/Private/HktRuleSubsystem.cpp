// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktRuleSubsystem.h"
#include "HktServerRule.h"
#include "HktClientRule.h"
#include "HktRuleLog.h"
#include "HktCoreEventLog.h"
#include "Engine/World.h"
#include "Engine/GameInstance.h"
#include "Async/Async.h"

DEFINE_LOG_CATEGORY(LogHktRule);

void UHktRuleSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	ServerRule = MakeUnique<FHktDefaultServerRule>();
	ClientRule = MakeUnique<FHktDefaultClientRule>();

	HKT_EVENT_LOG(HktLogTags::Rule, EHktLogLevel::Info, EHktLogSource::Server, TEXT("RuleSubsystem initialized"));
}

void UHktRuleSubsystem::Deinitialize()
{
	ServerRule.Reset();
	ClientRule.Reset();

	Super::Deinitialize();
}

UHktRuleSubsystem* UHktRuleSubsystem::Get(UWorld* World)
{
	if (!World) return nullptr;
	UGameInstance* GI = World->GetGameInstance();
	return GI ? GI->GetSubsystem<UHktRuleSubsystem>() : nullptr;
}

TUniquePtr<IHktClientRule> UHktRuleSubsystem::CreateClientRule()
{
	return MakeUnique<FHktDefaultClientRule>();
}

IHktServerRule* HktRule::GetServerRule(UWorld* World)
{
	if (!World) return nullptr;
	UHktRuleSubsystem* Subsystem = UHktRuleSubsystem::Get(World);
	return Subsystem ? Subsystem->GetServerRule() : nullptr;
}

IHktClientRule* HktRule::GetClientRule(UWorld* World)
{
	if (!World) return nullptr;
	UHktRuleSubsystem* Subsystem = UHktRuleSubsystem::Get(World);
	return Subsystem ? Subsystem->GetClientRule() : nullptr;
}

FHktOnSystemMessage& HktRule::GetSystemMessageDelegate(UWorld* World)
{
	static FHktOnSystemMessage Dummy;
	UHktRuleSubsystem* Sub = UHktRuleSubsystem::Get(World);
	return Sub ? Sub->OnSystemMessage() : Dummy;
}

void HktRule::ShowSystemMessage(UWorld* World, const FString& Message)
{
	if (!IsInGameThread())
	{
		AsyncTask(ENamedThreads::GameThread, [World, Message]()
		{
			HktRule::ShowSystemMessage(World, Message);
		});
		return;
	}

	UHktRuleSubsystem* Sub = UHktRuleSubsystem::Get(World);
	if (Sub)
	{
		Sub->OnSystemMessage().Broadcast(Message);
	}
}