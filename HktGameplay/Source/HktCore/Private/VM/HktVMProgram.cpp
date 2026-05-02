// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVMProgram.h"
#include "HktVMInterpreter.h"
#include "HktWorldState.h"
#include "HktCoreEvents.h"

// ============================================================================
// FHktVMProgramRegistry
// ============================================================================

FHktVMProgramRegistry& FHktVMProgramRegistry::Get()
{
    static FHktVMProgramRegistry Instance;
    return Instance;
}

const FHktVMProgram* FHktVMProgramRegistry::FindProgram(const FGameplayTag& Tag) const
{
    FRWScopeLock ReadLock(Lock, SLT_ReadOnly);
    if (const TSharedRef<FHktVMProgram>* Found = Programs.Find(Tag))
    {
        return &Found->Get();
    }
    return nullptr;
}

void FHktVMProgramRegistry::RegisterProgram(TSharedRef<FHktVMProgram> Program)
{
    FRWScopeLock WriteLock(Lock, SLT_Write);
    FGameplayTag Tag = Program->Tag;
    if (Programs.Contains(Tag))
    {
        UE_LOG(LogTemp, Log, TEXT("FHktVMProgramRegistry: overwriting existing program for tag '%s' (JSON override?)"),
            *Tag.ToString());
    }
    Programs.Add(Tag, Program);
}

void FHktVMProgramRegistry::Clear()
{
    FRWScopeLock WriteLock(Lock, SLT_Write);
    Programs.Empty();
}

bool FHktVMProgramRegistry::ValidateEvent(const FHktWorldState& WorldState, const FHktEvent& Event) const
{
    const FHktVMProgram* Program = FindProgram(Event.EventTag);
    if (!Program)
        return true;

    // PreconditionCode 우선 실행
    if (Program->HasPreconditionCode())
    {
        return FHktVMInterpreter::ExecutePrecondition(
            Program->PreconditionCode, Program->PreconditionConstants,
            Program->PreconditionStrings, WorldState, Event);
    }

    // 기존 람다 fallback
    if (Program->Precondition)
    {
        return Program->Precondition(WorldState, Event);
    }

    return true;
}

