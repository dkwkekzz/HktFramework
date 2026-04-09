// Copyright Hkt Studios, Inc. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"

/**
 * FHktTestResult — 단일 테스트 결과
 */
struct FHktTestResult
{
    FString TestName;
    bool bPassed = false;
    FString Message;

    static FHktTestResult Pass(const FString& InName)
    {
        return { InName, true, TEXT("OK") };
    }

    static FHktTestResult Fail(const FString& InName, const FString& InMessage)
    {
        return { InName, false, InMessage };
    }
};

/**
 * FHktTestReport — 테스트 실행 결과 집계
 */
struct FHktTestReport
{
    TArray<FHktTestResult> Results;

    int32 TotalCount() const { return Results.Num(); }

    int32 PassCount() const
    {
        int32 Count = 0;
        for (const auto& R : Results)
        {
            if (R.bPassed) ++Count;
        }
        return Count;
    }

    int32 FailCount() const { return TotalCount() - PassCount(); }
    bool AllPassed() const { return FailCount() == 0; }

    void Add(const FHktTestResult& Result) { Results.Add(Result); }
    void Append(const FHktTestReport& Other) { Results.Append(Other.Results); }
};
