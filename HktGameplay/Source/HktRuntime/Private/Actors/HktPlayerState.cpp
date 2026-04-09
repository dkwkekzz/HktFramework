#include "HktPlayerState.h"
#include "Net/UnrealNetwork.h"

//-----------------------------------------------------------------------------
// AHktPlayerState
//-----------------------------------------------------------------------------

AHktPlayerState::AHktPlayerState()
{
}

void AHktPlayerState::BeginPlay()
{
	Super::BeginPlay();
}

void AHktPlayerState::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	Super::EndPlay(EndPlayReason);
}

void AHktPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
}
