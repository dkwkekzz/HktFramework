// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "HktVFXIntent.h"

// ============================================================================
// FHktVFXIntent::ToNaturalLanguage() — LLM 프롬프트용 자연어 변환
// ============================================================================
FString FHktVFXIntent::ToNaturalLanguage() const
{
    // Custom 타입이면 CustomDescription을 그대로 사용
    if (EventType == EHktVFXEventType::Custom && !CustomDescription.IsEmpty())
    {
        FString Result = CustomDescription;
        if (StyleKeywords.Num() > 0)
        {
            Result += TEXT("\nStyle keywords: ") + FString::Join(StyleKeywords, TEXT(", "));
        }
        Result += FString::Printf(TEXT("\nIntensity: %.0f%%, Radius: %.0f units, Duration: %.1fs"),
            Intensity * 100.f, Radius, Duration);
        return Result;
    }

    // --- 이벤트 타입 → 자연어 ---
    FString EventDesc;
    switch (EventType)
    {
    case EHktVFXEventType::Explosion:       EventDesc = TEXT("an explosion"); break;
    case EHktVFXEventType::ProjectileHit:   EventDesc = TEXT("a projectile impact"); break;
    case EHktVFXEventType::ProjectileTrail: EventDesc = TEXT("a projectile trail"); break;
    case EHktVFXEventType::AreaEffect:      EventDesc = TEXT("a persistent area effect on the ground"); break;
    case EHktVFXEventType::Buff:            EventDesc = TEXT("a positive buff aura surrounding a character"); break;
    case EHktVFXEventType::Debuff:          EventDesc = TEXT("a negative debuff effect on a character"); break;
    case EHktVFXEventType::Heal:            EventDesc = TEXT("a healing effect rising upward"); break;
    case EHktVFXEventType::Summon:          EventDesc = TEXT("a summoning portal or emergence effect"); break;
    case EHktVFXEventType::Teleport:        EventDesc = TEXT("a teleportation effect with disappear and appear phases"); break;
    case EHktVFXEventType::Shield:          EventDesc = TEXT("a protective shield or barrier around a character"); break;
    case EHktVFXEventType::Channel:         EventDesc = TEXT("a channeling or casting effect at the hands"); break;
    case EHktVFXEventType::Death:           EventDesc = TEXT("a death or destruction effect"); break;
    case EHktVFXEventType::LevelUp:         EventDesc = TEXT("a level-up celebration effect"); break;
    default:                                EventDesc = TEXT("a visual effect"); break;
    }

    // --- 속성 → 자연어 ---
    FString ElementDesc;
    switch (Element)
    {
    case EHktVFXElement::Fire:      ElementDesc = TEXT("fire element (red, orange, yellow flames, embers, heat distortion)"); break;
    case EHktVFXElement::Ice:       ElementDesc = TEXT("ice element (cyan, white, blue crystals, frost, snowflakes, cold mist)"); break;
    case EHktVFXElement::Lightning: ElementDesc = TEXT("lightning element (bright white-blue, electric arcs, sparks, flash)"); break;
    case EHktVFXElement::Water:     ElementDesc = TEXT("water element (blue, transparent droplets, splashes, bubbles, flowing streams)"); break;
    case EHktVFXElement::Earth:     ElementDesc = TEXT("earth element (brown, gray rocks, dust, debris, cracks in ground)"); break;
    case EHktVFXElement::Wind:      ElementDesc = TEXT("wind element (white, pale green swirls, leaves, speed lines, air distortion)"); break;
    case EHktVFXElement::Dark:      ElementDesc = TEXT("dark/shadow element (purple, black, void energy, shadowy tendrils, corruption)"); break;
    case EHktVFXElement::Holy:      ElementDesc = TEXT("holy/light element (golden, white, divine rays, halos, radiant glow)"); break;
    case EHktVFXElement::Poison:    ElementDesc = TEXT("poison element (green, sickly yellow, toxic bubbles, dripping acid, fumes)"); break;
    case EHktVFXElement::Arcane:    ElementDesc = TEXT("arcane/magic element (purple, blue energy, runes, geometric patterns, mystical orbs)"); break;
    case EHktVFXElement::Physical:  ElementDesc = TEXT("physical element (neutral tones, stone chunks, metal shards, dust impact)"); break;
    case EHktVFXElement::Nature:    ElementDesc = TEXT("nature element (green, brown, leaves, petals, vines, natural growth)"); break;
    default:                        ElementDesc = TEXT("neutral magical energy"); break;
    }

    // --- 강도 설명 ---
    FString IntensityDesc;
    if (Intensity <= 0.2f)
        IntensityDesc = TEXT("very subtle and minimal");
    else if (Intensity <= 0.4f)
        IntensityDesc = TEXT("light and understated");
    else if (Intensity <= 0.6f)
        IntensityDesc = TEXT("moderate, standard intensity");
    else if (Intensity <= 0.8f)
        IntensityDesc = TEXT("strong and impressive");
    else
        IntensityDesc = TEXT("maximum intensity, dramatic and overwhelming");

    // --- 표면 설명 ---
    FString SurfaceDesc;
    switch (SurfaceType)
    {
    case EHktVFXSurfaceType::Stone: SurfaceDesc = TEXT(" The effect hits a stone surface, creating rock debris and dust."); break;
    case EHktVFXSurfaceType::Metal: SurfaceDesc = TEXT(" The effect hits a metal surface, creating sparks and metallic fragments."); break;
    case EHktVFXSurfaceType::Wood:  SurfaceDesc = TEXT(" The effect hits a wooden surface, creating splinters and wood chips."); break;
    case EHktVFXSurfaceType::Dirt:  SurfaceDesc = TEXT(" The effect hits dirt/ground, kicking up earth and dust clouds."); break;
    case EHktVFXSurfaceType::Sand:  SurfaceDesc = TEXT(" The effect hits sand, creating sand particles and a sandy cloud."); break;
    case EHktVFXSurfaceType::Water: SurfaceDesc = TEXT(" The effect hits a water surface, creating splashes and ripples."); break;
    case EHktVFXSurfaceType::Snow:  SurfaceDesc = TEXT(" The effect hits snow, scattering snowflakes and creating a powder burst."); break;
    case EHktVFXSurfaceType::Grass: SurfaceDesc = TEXT(" The effect hits a grassy surface, with grass blades and soil particles."); break;
    default:                        SurfaceDesc = TEXT(""); break;
    }

    // --- 조합 ---
    FString Result = FString::Printf(
        TEXT("Design %s with %s\n"
             "Intensity: %s (%.0f%%)\n"
             "Effect radius: %.0f Unreal units (cm), Duration: %.1f seconds\n"
             "Source power level: %.0f%%"),
        *EventDesc,
        *ElementDesc,
        *IntensityDesc,
        Intensity * 100.f,
        Radius,
        Duration,
        SourcePower * 100.f
    );

    if (!SurfaceDesc.IsEmpty())
    {
        Result += TEXT("\n") + SurfaceDesc;
    }

    // 스타일 키워드
    if (StyleKeywords.Num() > 0)
    {
        Result += TEXT("\nAdditional style: ") + FString::Join(StyleKeywords, TEXT(", "));
    }

    // 커스텀 설명 추가 (Custom 타입이 아니더라도 보충 설명으로 활용)
    if (!CustomDescription.IsEmpty())
    {
        Result += TEXT("\nAdditional notes: ") + CustomDescription;
    }

    return Result;
}
