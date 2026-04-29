// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktTerrainSubsystem.h"
#include "HktTerrainGenerator.h"
#include "HktTerrainLog.h"
#include "Engine/AssetManager.h"
#include "Engine/StreamableManager.h"
#include "Engine/World.h"
#include "HktCoreDataCollector.h"
#include "HAL/PlatformTime.h"

#if ENABLE_HKT_INSIGHTS
// Insights 카테고리 — HktGameplayDeveloper 의 인사이트 패널이 본 키들을 읽어 표시한다.
// 모든 카운터는 Subsystem 인스턴스 단위 (월드 단위) — 멀티 World 환경에선 마지막 갱신이 표시된다.
static const FString GHktTerrainInsightsCategory = TEXT("Terrain.Subsystem");

namespace
{
	void PublishCounter(const TCHAR* Key, int32 Value)
	{
		HKT_INSIGHT_COLLECT(GHktTerrainInsightsCategory, FString(Key),
			FString::Printf(TEXT("%d"), Value));
	}
	void PublishMs(const TCHAR* Key, double Ms)
	{
		HKT_INSIGHT_COLLECT(GHktTerrainInsightsCategory, FString(Key),
			FString::Printf(TEXT("%.3f ms"), Ms));
	}
	void PublishUs(const TCHAR* Key, double Us)
	{
		HKT_INSIGHT_COLLECT(GHktTerrainInsightsCategory, FString(Key),
			FString::Printf(TEXT("%.1f us"), Us));
	}
}
#endif // ENABLE_HKT_INSIGHTS

// 폴백 인자 출처 우선순위:
//   1. BakedAsset->GeneratorConfig
//   2. SetFallbackConfig 로 주입된 Config (예: AHktGameMode 가 ProjectSettings 기반으로 주입)
//   3. 컴파일 기본값 (FHktTerrainGeneratorConfig 의 in-class initializer)
//
// HktTerrain → HktRuntime 역의존 차단을 위해 ProjectSettings 는 Subsystem 이 직접 읽지 않고
// 호출자가 SetFallbackConfig 로 주입한다. 출처 추적은 EffectiveConfigSource 로 표현.

UHktTerrainSubsystem::UHktTerrainSubsystem() = default;

bool UHktTerrainSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	// Game / PIE / Editor 월드에서만 인스턴스화. Preview / Inactive 월드(에셋 썸네일,
	// 애니메이션 캡처 프리뷰 등)에서는 지형 데이터가 불필요하므로 생성을 건너뛴다.
	const UWorld* World = Cast<UWorld>(Outer);
	if (!World) return false;

	const EWorldType::Type Type = World->WorldType;
	return Type == EWorldType::Game
	    || Type == EWorldType::PIE
	    || Type == EWorldType::Editor;
}

UHktTerrainSubsystem* UHktTerrainSubsystem::Get(const UObject* WorldContext)
{
	if (!WorldContext) return nullptr;
	UWorld* World = WorldContext->GetWorld();
	if (!World) return nullptr;
	return World->GetSubsystem<UHktTerrainSubsystem>();
}

void UHktTerrainSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);
	UE_LOG(LogHktTerrain, Log, TEXT("UHktTerrainSubsystem Initialized for World '%s'"),
		*GetNameSafe(GetWorld()));
}

void UHktTerrainSubsystem::Deinitialize()
{
	if (PendingLoadHandle.IsValid())
	{
		PendingLoadHandle->CancelHandle();
		PendingLoadHandle.Reset();
	}

	ChunkCache.Reset();
	FallbackGenerator.Reset();
	BakedAsset = nullptr;
	bFallbackConfigCached = false;
	bInjectedFallbackConfigSet = false;

	UE_LOG(LogHktTerrain, Log,
		TEXT("UHktTerrainSubsystem Deinitialized — BakedHits=%d FallbackHits=%d"),
		BakedHitCount, FallbackHitCount);

	Super::Deinitialize();
}

void UHktTerrainSubsystem::LoadBakedAsset(
	const TSoftObjectPtr<UHktTerrainBakedAsset>& SoftRef,
	TFunction<void(UHktTerrainBakedAsset*)> OnLoaded)
{
	if (SoftRef.IsNull())
	{
		UE_LOG(LogHktTerrain, Warning,
			TEXT("LoadBakedAsset: SoftRef 가 null — 폴백 경로만 동작합니다."));
		if (OnLoaded) OnLoaded(nullptr);
		return;
	}

	const double LoadStartSec = FPlatformTime::Seconds();

	// 이미 로드된 자산이면 즉시 콜백 (캐시 무효화 책임은 호출자).
	if (UHktTerrainBakedAsset* Already = SoftRef.Get())
	{
		BakedAsset = Already;
		ChunkCache.Reset();
		FallbackGenerator.Reset();
		bFallbackConfigCached = false;
		const double ElapsedMs = (FPlatformTime::Seconds() - LoadStartSec) * 1000.0;
		LastBakeLoadMs = ElapsedMs;
		UE_LOG(LogHktTerrain, Log,
			TEXT("LoadBakedAsset: '%s' 이미 로드됨 — 즉시 결합. ChunkCount=%d (%.3f ms)"),
			*GetNameSafe(Already), Already->Chunks.Num(), ElapsedMs);
		OnEffectiveConfigChanged.Broadcast(GetEffectiveConfig());
		PublishInsights();
		if (OnLoaded) OnLoaded(Already);
		return;
	}

	// 비동기 로드
	FStreamableManager& Streamable = UAssetManager::GetStreamableManager();
	TWeakObjectPtr<UHktTerrainSubsystem> WeakThis(this);

	PendingLoadHandle = Streamable.RequestAsyncLoad(
		SoftRef.ToSoftObjectPath(),
		FStreamableDelegate::CreateLambda([WeakThis, SoftRef, OnLoaded, LoadStartSec]()
		{
			UHktTerrainSubsystem* Self = WeakThis.Get();
			if (!Self) { if (OnLoaded) OnLoaded(nullptr); return; }

			UHktTerrainBakedAsset* Loaded = SoftRef.Get();
			Self->BakedAsset = Loaded;
			Self->ChunkCache.Reset();
			Self->FallbackGenerator.Reset();
			Self->bFallbackConfigCached = false;
			Self->PendingLoadHandle.Reset();

			const double ElapsedMs = (FPlatformTime::Seconds() - LoadStartSec) * 1000.0;
			Self->LastBakeLoadMs = ElapsedMs;

			if (Loaded)
			{
				UE_LOG(LogHktTerrain, Log,
					TEXT("LoadBakedAsset: '%s' 로드 완료 — ChunkCount=%d Region=[%s, %s] (%.3f ms)"),
					*GetNameSafe(Loaded), Loaded->Chunks.Num(),
					*Loaded->RegionMin.ToString(), *Loaded->RegionMax.ToString(), ElapsedMs);
			}
			else
			{
				UE_LOG(LogHktTerrain, Warning,
					TEXT("LoadBakedAsset: 비동기 로드 실패 — 폴백 경로만 동작합니다. (%.3f ms)"), ElapsedMs);
			}

			Self->OnEffectiveConfigChanged.Broadcast(Self->GetEffectiveConfig());
			Self->PublishInsights();
			if (OnLoaded) OnLoaded(Loaded);
		}),
		FStreamableManager::AsyncLoadHighPriority);
}

UHktTerrainBakedAsset* UHktTerrainSubsystem::LoadBakedAssetSync(
	const TSoftObjectPtr<UHktTerrainBakedAsset>& SoftRef)
{
	if (SoftRef.IsNull()) return nullptr;

	const double LoadStartSec = FPlatformTime::Seconds();
	UHktTerrainBakedAsset* Loaded = SoftRef.LoadSynchronous();
	BakedAsset = Loaded;
	ChunkCache.Reset();
	FallbackGenerator.Reset();
	bFallbackConfigCached = false;

	const double ElapsedMs = (FPlatformTime::Seconds() - LoadStartSec) * 1000.0;
	LastBakeLoadMs = ElapsedMs;

	if (Loaded)
	{
		UE_LOG(LogHktTerrain, Log,
			TEXT("LoadBakedAssetSync: '%s' — ChunkCount=%d (%.3f ms)"),
			*GetNameSafe(Loaded), Loaded->Chunks.Num(), ElapsedMs);
	}
	OnEffectiveConfigChanged.Broadcast(GetEffectiveConfig());
	PublishInsights();
	return Loaded;
}

FHktTerrainGeneratorConfig UHktTerrainSubsystem::GetEffectiveConfig() const
{
	if (BakedAsset)
	{
		return BakedAsset->GeneratorConfig.ToConfig();
	}
	if (bInjectedFallbackConfigSet)
	{
		return InjectedFallbackConfig;
	}
	return FHktTerrainGeneratorConfig{};
}

void UHktTerrainSubsystem::SetFallbackConfig(const FHktTerrainGeneratorConfig& InConfig)
{
	const bool bAlreadySet = bInjectedFallbackConfigSet;
	const bool bChanged = !bAlreadySet ||
		FMemory::Memcmp(&InConfig, &InjectedFallbackConfig, sizeof(FHktTerrainGeneratorConfig)) != 0;

	InjectedFallbackConfig      = InConfig;
	bInjectedFallbackConfigSet  = true;

	// BakedAsset 이 부재한 동안에만 effective Config 가 실제로 바뀐다.
	// BakedAsset 이 있으면 그 Config 가 우선이므로 알릴 필요 없음.
	if (bChanged && !BakedAsset)
	{
		// 폴백 Generator 캐시도 무효화 — 다음 호출에서 새 Config 로 재생성.
		FallbackGenerator.Reset();
		bFallbackConfigCached = false;
		OnEffectiveConfigChanged.Broadcast(GetEffectiveConfig());
	}
}

const FHktTerrainGenerator& UHktTerrainSubsystem::EnsureFallbackGenerator()
{
	const FHktTerrainGeneratorConfig EffectiveConfig = GetEffectiveConfig();

	const bool bConfigChanged =
		!bFallbackConfigCached ||
		FMemory::Memcmp(&EffectiveConfig, &FallbackConfigCached, sizeof(FHktTerrainGeneratorConfig)) != 0;

	if (!FallbackGenerator.IsValid() || bConfigChanged)
	{
		FallbackGenerator      = MakeUnique<FHktTerrainGenerator>(EffectiveConfig);
		FallbackConfigCached   = EffectiveConfig;
		bFallbackConfigCached  = true;
	}
	return *FallbackGenerator;
}

void UHktTerrainSubsystem::LogFallbackOriginOnce(const TCHAR* Origin)
{
	if (bFallbackOriginLogged) return;
	bFallbackOriginLogged = true;
	UE_LOG(LogHktTerrain, Log,
		TEXT("Terrain fallback Config 출처: %s — 첫 폴백 호출에서 1회만 출력."), Origin);
}

bool UHktTerrainSubsystem::AcquireChunk(const FIntVector& Coord,
                                        TArrayView<FHktTerrainVoxel> OutVoxels)
{
	const int32 Expected = GetVoxelsPerChunk();
	if (OutVoxels.Num() != Expected)
	{
		UE_LOG(LogHktTerrain, Error,
			TEXT("AcquireChunk: 출력 버퍼 크기 %d != 기대값 %d (Coord=%s)"),
			OutVoxels.Num(), Expected, *Coord.ToString());
		// 호출자 버그 방어 — zero-init 으로 안전한 디폴트 보장.
		FMemory::Memzero(OutVoxels.GetData(), sizeof(FHktTerrainVoxel) * OutVoxels.Num());
		return false;
	}

	const double AcquireStartSec = FPlatformTime::Seconds();

	// 1. 캐시 적중 — 메모이즈된 결과를 호출자 버퍼로 memcpy.
	if (TSharedPtr<FCachedChunk>* Existing = ChunkCache.Find(Coord))
	{
		(*Existing)->LastAccessTick = ++NextAccessTick;
		FMemory::Memcpy(OutVoxels.GetData(), (*Existing)->Voxels.GetData(),
		                sizeof(FHktTerrainVoxel) * Expected);
		++CacheHitCount;
		LastAcquireUs = (FPlatformTime::Seconds() - AcquireStartSec) * 1e6;
		PublishInsights();
		return true;
	}

	// 2. Baked 자산 조회 — 디컴프레스 직접 호출자 버퍼로.
	TSharedPtr<FCachedChunk> Entry = MakeShared<FCachedChunk>();
	Entry->Coord = Coord;
	Entry->Voxels.SetNumUninitialized(Expected);
	Entry->LastAccessTick = ++NextAccessTick;

	if (BakedAsset && BakedAsset->TryDecompressChunk(Coord, Entry->Voxels.GetData()))
	{
		Entry->bFromBaked = true;
		++BakedHitCount;
		FMemory::Memcpy(OutVoxels.GetData(), Entry->Voxels.GetData(),
		                sizeof(FHktTerrainVoxel) * Expected);
		ChunkCache.Add(Coord, Entry);
		EvictIfNeeded();
		LastAcquireUs = (FPlatformTime::Seconds() - AcquireStartSec) * 1e6;
		PublishInsights();
		return true;
	}

	// 3. 폴백 — 동일 Generator 로 즉시 생성 + 경고 로그
	UE_LOG(LogHktTerrain, Warning,
		TEXT("Chunk %s 베이크 미존재 — 런타임 생성 폴백"), *Coord.ToString());
	const TCHAR* OriginLabel = BakedAsset                 ? TEXT("BakedAsset->GeneratorConfig")
	                          : bInjectedFallbackConfigSet ? TEXT("Injected (e.g., ProjectSettings)")
	                                                       : TEXT("CompileDefault (FHktTerrainGeneratorConfig{})");
	LogFallbackOriginOnce(OriginLabel);

	const FHktTerrainGenerator& Gen = EnsureFallbackGenerator();
	Gen.GenerateChunk(Coord.X, Coord.Y, Coord.Z, Entry->Voxels.GetData());
	Entry->bFromBaked = false;
	++FallbackHitCount;
	FMemory::Memcpy(OutVoxels.GetData(), Entry->Voxels.GetData(),
	                sizeof(FHktTerrainVoxel) * Expected);
	ChunkCache.Add(Coord, Entry);
	EvictIfNeeded();
	LastAcquireUs = (FPlatformTime::Seconds() - AcquireStartSec) * 1e6;
	PublishInsights();
	return true;
}

void UHktTerrainSubsystem::ReleaseChunk(const FIntVector& Coord)
{
	ChunkCache.Remove(Coord);
}

void UHktTerrainSubsystem::EvictIfNeeded()
{
	if (ChunkCache.Num() <= MaxCachedChunks) return;

	// LRU: LastAccessTick 가장 작은 항목부터 축출
	const int32 ToRemove = ChunkCache.Num() - MaxCachedChunks;

	TArray<TPair<uint64, FIntVector>> Sorted;
	Sorted.Reserve(ChunkCache.Num());
	for (const auto& KV : ChunkCache)
	{
		Sorted.Emplace(KV.Value->LastAccessTick, KV.Key);
	}
	Sorted.Sort([](const TPair<uint64, FIntVector>& A, const TPair<uint64, FIntVector>& B)
	{
		return A.Key < B.Key;
	});

	for (int32 i = 0; i < ToRemove && i < Sorted.Num(); ++i)
	{
		ChunkCache.Remove(Sorted[i].Value);
	}
}

void UHktTerrainSubsystem::SamplePreview(
	int32 MinWorldX, int32 MinWorldY, int32 Width, int32 Height,
	FHktTerrainPreviewRegion& OutRegion)
{
	const FHktTerrainGenerator& Gen = EnsureFallbackGenerator();
	Gen.SamplePreviewRegion(MinWorldX, MinWorldY, Width, Height, OutRegion);
}

void UHktTerrainSubsystem::PublishInsights() const
{
#if ENABLE_HKT_INSIGHTS
	HKT_INSIGHT_COLLECT(GHktTerrainInsightsCategory, TEXT("BakedAsset"),
		BakedAsset ? GetNameSafe(BakedAsset) : FString(TEXT("None")));
	PublishCounter(TEXT("BakedHits"),    BakedHitCount);
	PublishCounter(TEXT("FallbackHits"), FallbackHitCount);
	PublishCounter(TEXT("CacheHits"),    CacheHitCount);
	PublishCounter(TEXT("CacheSize"),    ChunkCache.Num());
	PublishMs    (TEXT("LastBakeLoad"), LastBakeLoadMs);
	PublishUs    (TEXT("LastAcquire"),  LastAcquireUs);
	HKT_INSIGHT_COLLECT(GHktTerrainInsightsCategory, TEXT("FallbackOrigin"),
		bInjectedFallbackConfigSet
			? FString(TEXT("Injected"))
			: (BakedAsset ? FString(TEXT("BakedAsset")) : FString(TEXT("CompileDefault"))));
#endif
}
