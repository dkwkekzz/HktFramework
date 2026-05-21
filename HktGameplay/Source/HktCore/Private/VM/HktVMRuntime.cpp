// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVMRuntime.h"
#include "HktVMProgram.h"

FString FHktVMRuntime::GetDebugString() const
{
    const TCHAR* StatusNames[] = {
        TEXT("Ready"), TEXT("Running"), TEXT("Yielded"),
        TEXT("WaitingEvent"), TEXT("Completed"), TEXT("Failed")
    };

    return FString::Printf(
        TEXT("[VM] Tag=%s PC=%d Status=%s Self=%d Target=%d Spawned=%d"),
        Program ? *Program->Tag.ToString() : TEXT("null"),
        PC,
        StatusNames[static_cast<int32>(Status)],
        Registers[Reg::Self],
        Registers[Reg::Target],
        Registers[Reg::Spawned]
    );
}

// ============================================================================
// FHktVMRuntimePool
// ============================================================================

FHktVMRuntimePool::FHktVMRuntimePool()
{
    const int32 InitialCap = HktLimits::InitialVMPoolCapacity;
    Statuses.SetNumZeroed(InitialCap);
    PCs.SetNumZeroed(InitialCap);
    WaitFrameArr.SetNumZeroed(InitialCap);
    Generations.SetNumZeroed(InitialCap);
    Runtimes.SetNum(InitialCap);
    Contexts.SetNum(InitialCap);

    // grow 시 reallocation 빈도를 줄이기 위해 hard cap 까지 사전 예약.
    Statuses.Reserve(HktLimits::MaxVMPoolCapacity);
    PCs.Reserve(HktLimits::MaxVMPoolCapacity);
    WaitFrameArr.Reserve(HktLimits::MaxVMPoolCapacity);
    Generations.Reserve(HktLimits::MaxVMPoolCapacity);
    Runtimes.Reserve(HktLimits::MaxVMPoolCapacity);
    Contexts.Reserve(HktLimits::MaxVMPoolCapacity);
    FreeSlots.Reserve(HktLimits::MaxVMPoolCapacity);

    for (int32 i = InitialCap - 1; i >= 0; --i)
    {
        FreeSlots.Add(i);
        Statuses[i] = EVMStatus::Completed;
    }
}

int32 FHktVMRuntimePool::GrowOneSlot()
{
    const int32 NewIndex = Statuses.Num();
    if (NewIndex >= HktLimits::MaxVMPoolCapacity)
        return INDEX_NONE;

    Statuses.Add(EVMStatus::Completed);
    PCs.Add(0);
    WaitFrameArr.Add(0);
    Generations.Add(0);
    Runtimes.AddDefaulted();
    Contexts.AddDefaulted();
    return NewIndex;
}

FHktVMHandle FHktVMRuntimePool::Allocate()
{
    if (FreeSlots.Num() == 0)
    {
        const int32 NewIndex = GrowOneSlot();
        if (NewIndex == INDEX_NONE)
            return FHktVMHandle::Invalid();
        FreeSlots.Add(static_cast<uint32>(NewIndex));
    }

    uint32 Index = FreeSlots.Pop();

    FHktVMHandle Handle;
    Handle.Index = Index;
    Handle.Generation = Generations[Index];

    Statuses[Index] = EVMStatus::Ready;
    PCs[Index] = 0;
    WaitFrameArr[Index] = 0;

    FHktVMRuntime& Runtime = Runtimes[Index];
    Runtime.Program = nullptr;
    Runtime.Context = &Contexts[Index];
    Contexts[Index].Reset();
    Runtime.PC = 0;
    Runtime.Status = EVMStatus::Ready;
    Runtime.CreationFrame = 0;
    Runtime.WaitFrames = 0;
    Runtime.EventWait.Reset();
    Runtime.SpatialQuery.Reset();
    FMemory::Memzero(Runtime.Registers, sizeof(Runtime.Registers));

    return Handle;
}

void FHktVMRuntimePool::Free(FHktVMHandle Handle)
{
    if (!IsValid(Handle))
        return;

    uint32 Index = Handle.Index;
    Generations[Index]++;
    Statuses[Index] = EVMStatus::Completed;
    FreeSlots.Add(Index);
}

FHktVMRuntime* FHktVMRuntimePool::Get(FHktVMHandle Handle)
{
    if (!IsValid(Handle))
        return nullptr;
    return &Runtimes[Handle.Index];
}

const FHktVMRuntime* FHktVMRuntimePool::Get(FHktVMHandle Handle) const
{
    if (!IsValid(Handle))
        return nullptr;
    return &Runtimes[Handle.Index];
}

FHktVMContext* FHktVMRuntimePool::GetContext(FHktVMHandle Handle)
{
    if (!IsValid(Handle) || Handle.Index >= static_cast<uint32>(Contexts.Num()))
        return nullptr;
    return &Contexts[Handle.Index];
}

const FHktVMContext* FHktVMRuntimePool::GetContext(FHktVMHandle Handle) const
{
    if (!IsValid(Handle) || Handle.Index >= static_cast<uint32>(Contexts.Num()))
        return nullptr;
    return &Contexts[Handle.Index];
}

bool FHktVMRuntimePool::IsValid(FHktVMHandle Handle) const
{
    if (!Handle.IsValid() || Handle.Index >= static_cast<uint32>(Statuses.Num()))
        return false;
    return Generations[Handle.Index] == Handle.Generation;
}

int32 FHktVMRuntimePool::CountByStatus(EVMStatus Status) const
{
    int32 Count = 0;
    for (int32 i = 0; i < Runtimes.Num(); ++i)
    {
        if (Statuses[i] == Status)
            Count++;
    }
    return Count;
}

void FHktVMRuntimePool::Reset()
{
    FreeSlots.Reset();
    const int32 Cap = Statuses.Num();
    for (int32 i = Cap - 1; i >= 0; --i)
    {
        FreeSlots.Add(i);
        Statuses[i] = EVMStatus::Completed;
        Generations[i]++;
    }
}
