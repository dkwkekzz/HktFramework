// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "Slate/SHktVMEventPanel.h"
#include "HktVMEventRecorder.h"
#include "HktCoreEventLog.h"  // EHktLogSource
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SSearchBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Text/STextBlock.h"
#include "HAL/PlatformApplicationMisc.h"
#include "Misc/Paths.h"
#include "DesktopPlatformModule.h"

#define LOCTEXT_NAMESPACE "HktVMEventPanel"

// ── 컬러 팔레트 (SHktGameplayLogPanel 과 유사) ──
namespace VMEvtColors
{
    static const FLinearColor Time(0.5f, 0.5f, 0.55f);
    static const FLinearColor Frame(0.6f, 0.6f, 0.65f);
    static const FLinearColor Dim(0.4f, 0.4f, 0.4f);
    static const FLinearColor Message(0.88f, 0.88f, 0.88f);

    // Kind 색상
    static const FLinearColor KindEvent(0.95f, 0.75f, 0.3f);    // FHktEvent — 외부 인입
    static const FLinearColor KindPending(0.45f, 0.85f, 1.0f);  // FHktPendingEvent — 시뮬 내부
    static const FLinearColor KindPhysics(1.0f, 0.5f, 0.5f);    // FHktPhysicsEvent — 충돌

    // Phase 색상
    static const FLinearColor PhaseCreate(0.4f, 0.95f, 0.5f);
    static const FLinearColor PhaseConsume(0.6f, 0.8f, 1.0f);
    static const FLinearColor PhaseDiscard(0.8f, 0.4f, 0.4f);

    // Source 색상
    static const FLinearColor SourceServer(1.0f, 0.6f, 0.3f);
    static const FLinearColor SourceClient(0.3f, 0.85f, 0.85f);

    static const FLinearColor RecRed(0.95f, 0.25f, 0.25f);
    static const FLinearColor RecGreen(0.3f, 0.95f, 0.4f);
}

static FLinearColor GetKindColor(EHktVMEventKind Kind)
{
    switch (Kind)
    {
    case EHktVMEventKind::Event:        return VMEvtColors::KindEvent;
    case EHktVMEventKind::PendingEvent: return VMEvtColors::KindPending;
    case EHktVMEventKind::PhysicsEvent: return VMEvtColors::KindPhysics;
    default:                            return VMEvtColors::Message;
    }
}

static FLinearColor GetPhaseColor(EHktVMEventPhase Phase)
{
    switch (Phase)
    {
    case EHktVMEventPhase::Created:   return VMEvtColors::PhaseCreate;
    case EHktVMEventPhase::Consumed:  return VMEvtColors::PhaseConsume;
    case EHktVMEventPhase::Discarded: return VMEvtColors::PhaseDiscard;
    default:                          return VMEvtColors::Dim;
    }
}

static FLinearColor GetSourceColor(uint8 Source)
{
    return Source == static_cast<uint8>(EHktLogSource::Server)
        ? VMEvtColors::SourceServer
        : VMEvtColors::SourceClient;
}

static const TCHAR* GetSourceName(uint8 Source)
{
    return Source == static_cast<uint8>(EHktLogSource::Server) ? TEXT("Server") : TEXT("Client");
}

static FString FormatPayload(const FHktVMEventRecord& R)
{
    switch (R.Kind)
    {
    case EHktVMEventKind::Event:
        return FString::Printf(
            TEXT("Tag=%s | Src=%d Tgt=%d | EvtId=%d | Params=(%d,%d,%d,%d) | Loc=(%.0f,%.0f,%.0f) | UID=%lld"),
            R.EventTag.IsValid() ? *R.EventTag.ToString() : TEXT("?"),
            R.SourceEntity, R.TargetEntity, R.EventId,
            R.Param0, R.Param1, R.Param2, R.Param3,
            R.Location.X, R.Location.Y, R.Location.Z, R.PlayerUid);

    case EHktVMEventKind::PendingEvent:
        return FString::Printf(TEXT("Type=%s | Watched=%d | Hit=%d"),
            GetHktPendingTypeName(R.PendingType), R.WatchedEntity, R.HitEntity);

    case EHktVMEventKind::PhysicsEvent:
        return FString::Printf(TEXT("A=%d B=%d | Contact=(%.0f,%.0f,%.0f)"),
            R.SourceEntity, R.TargetEntity,
            R.ContactPoint.X, R.ContactPoint.Y, R.ContactPoint.Z);

    default: return FString();
    }
}

// ============================================================================
// Construct
// ============================================================================

void SHktVMEventPanel::Construct(const FArguments& InArgs)
{
    StartTime = FPlatformTime::Seconds();

    // 패널 열림 — 수집 활성화. (닫힐 때 SetActive(false) 는 소멸자에서.)
    FHktVMEventRecorder::Get().SetActive(true);

    ChildSlot
    [
        SNew(SVerticalBox)

        // ── 헤더: Active / Clear / Record / Save / Load / AutoScroll ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4.f)
        [
            SNew(SHorizontalBox)

            // Active 토글
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 8, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([]() -> ECheckBoxState
                {
                    return FHktVMEventRecorder::Get().IsActive() ? ECheckBoxState::Checked : ECheckBoxState::Unchecked;
                })
                .OnCheckStateChanged_Lambda([](ECheckBoxState S)
                {
                    FHktVMEventRecorder::Get().SetActive(S == ECheckBoxState::Checked);
                })
                [
                    SNew(STextBlock).Text(LOCTEXT("ActiveLabel", "Active"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 10))
                ]
            ]

            // Clear
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 8, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply
                {
                    FHktVMEventRecorder::Get().Clear();
                    AllRows.Reset();
                    FilteredRows.Reset();
                    ReadIndex = 0;
                    if (ListView.IsValid()) ListView->RequestListRefresh();
                    return FReply::Handled();
                })
                [ SNew(STextBlock).Text(LOCTEXT("ClearBtn", "Clear")) ]
            ]

            // ── Record 토글 ──
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply
                {
                    auto& Rec = FHktVMEventRecorder::Get();
                    if (Rec.IsRecording())
                    {
                        Rec.EndRecording();
                    }
                    else
                    {
                        Rec.BeginRecording();
                    }
                    return FReply::Handled();
                })
                .ToolTipText(LOCTEXT("RecordTooltip", "녹화 시작/종료 — 영구 버퍼에 누적"))
                [
                    SNew(STextBlock)
                    .Text_Lambda([]() -> FText
                    {
                        return FHktVMEventRecorder::Get().IsRecording()
                            ? LOCTEXT("RecStop", "■ Stop")
                            : LOCTEXT("RecStart", "● Record");
                    })
                    .ColorAndOpacity_Lambda([]() -> FSlateColor
                    {
                        return FHktVMEventRecorder::Get().IsRecording()
                            ? FSlateColor(VMEvtColors::RecRed)
                            : FSlateColor(VMEvtColors::RecGreen);
                    })
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                ]
            ]

            // Save Recording
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply
                {
                    const FString Path = FHktVMEventRecorder::Get().SaveRecordingToFile();
                    if (StatusText.IsValid())
                    {
                        StatusText->SetText(FText::FromString(Path.IsEmpty()
                            ? FString(TEXT("Save failed — 녹화 데이터 없음 또는 쓰기 실패"))
                            : FString::Printf(TEXT("Saved → %s"), *Path)));
                    }
                    return FReply::Handled();
                })
                .ToolTipText(LOCTEXT("SaveTooltip", "녹화된 데이터를 JSON 파일로 저장 (Saved/Logs/HktVMEventRecording_<stamp>.json)"))
                [ SNew(STextBlock).Text(LOCTEXT("SaveBtn", "Save Recording")) ]
            ]

            // Load Recording
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 12, 0)
            [
                SNew(SButton)
                .OnClicked_Lambda([this]() -> FReply
                {
                    IDesktopPlatform* DP = FDesktopPlatformModule::Get();
                    if (!DP) return FReply::Handled();
                    TArray<FString> OutFiles;
                    const FString DefaultDir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Logs"));
                    const bool bOpened = DP->OpenFileDialog(nullptr,
                        TEXT("Load VM Event Recording"), DefaultDir, FString(),
                        TEXT("HktVMEvent JSON|*.json|All Files|*.*"),
                        EFileDialogFlags::None, OutFiles);
                    if (bOpened && OutFiles.Num() > 0)
                    {
                        const bool bOk = FHktVMEventRecorder::Get().LoadRecordingFromFile(OutFiles[0]);
                        if (StatusText.IsValid())
                        {
                            StatusText->SetText(FText::FromString(bOk
                                ? FString::Printf(TEXT("Loaded %d records"), FHktVMEventRecorder::Get().GetRecordedCount())
                                : FString(TEXT("Load failed"))));
                        }
                    }
                    return FReply::Handled();
                })
                .ToolTipText(LOCTEXT("LoadTooltip", "이전 녹화 JSON 파일을 불러와 재생 모드로 검토"))
                [ SNew(STextBlock).Text(LOCTEXT("LoadBtn", "Load…")) ]
            ]

            // ── Kind 필터 ──
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowEvent ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowEvent = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("KindEvent", "Event"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::KindEvent))
                ]
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowPending ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowPending = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("KindPending", "Pending"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::KindPending))
                ]
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 12, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowPhysics ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowPhysics = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("KindPhysics", "Physics"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::KindPhysics))
                ]
            ]

            // ── Phase 필터 ──
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowCreated ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowCreated = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("PhaseCreate", "Create"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::PhaseCreate))
                ]
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowConsumed ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowConsumed = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("PhaseConsume", "Consume"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::PhaseConsume))
                ]
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 12, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowDiscarded ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowDiscarded = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("PhaseDiscard", "Discard"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::PhaseDiscard))
                ]
            ]

            // ── Source 필터 ──
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 4, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowServer ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowServer = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("Server", "Srv"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::SourceServer))
                ]
            ]
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 12, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bShowClient ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bShowClient = (S == ECheckBoxState::Checked); RebuildFilteredRows(); })
                [
                    SNew(STextBlock).Text(LOCTEXT("Client", "Cli"))
                    .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                    .ColorAndOpacity(FSlateColor(VMEvtColors::SourceClient))
                ]
            ]

            // Auto-Scroll
            + SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 12, 0)
            [
                SNew(SCheckBox)
                .IsChecked_Lambda([this]() { return bAutoScroll ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
                .OnCheckStateChanged_Lambda([this](ECheckBoxState S) { bAutoScroll = (S == ECheckBoxState::Checked); })
                [ SNew(STextBlock).Text(LOCTEXT("AutoScroll", "Auto-scroll")) ]
            ]

            // 상태 텍스트
            + SHorizontalBox::Slot().FillWidth(1.0f).VAlign(VAlign_Center)
            [
                SAssignNew(StatusText, STextBlock)
                .Font(FCoreStyle::GetDefaultFontStyle("Regular", 9))
                .ColorAndOpacity(FSlateColor(VMEvtColors::Dim))
            ]
        ]

        // ── 텍스트 / Entity 필터 ──
        + SVerticalBox::Slot()
        .AutoHeight()
        .Padding(4, 0, 4, 4)
        [
            SNew(SHorizontalBox)
            + SHorizontalBox::Slot().FillWidth(1.0f).Padding(0, 0, 4, 0)
            [
                SNew(SSearchBox)
                .HintText(LOCTEXT("FilterHint", "Filter (tag / note / payload)..."))
                .OnTextChanged_Lambda([this](const FText& T)
                {
                    FilterText = T.ToString();
                    RebuildFilteredRows();
                })
            ]
            + SHorizontalBox::Slot().AutoWidth()
            [
                SNew(SBox)
                .MinDesiredWidth(180.f)
                [
                    SNew(SSearchBox)
                    .HintText(LOCTEXT("EntityHint", "Entity IDs (1,2,3)"))
                    .OnTextChanged_Lambda([this](const FText& T)
                    {
                        EntityIdFilterText = T.ToString();
                        EntityIdFilter.Reset();
                        TArray<FString> Parts;
                        EntityIdFilterText.ParseIntoArray(Parts, TEXT(","), true);
                        for (const FString& P : Parts)
                        {
                            const FString Trim = P.TrimStartAndEnd();
                            if (!Trim.IsEmpty()) EntityIdFilter.Add(FCString::Atoi(*Trim));
                        }
                        RebuildFilteredRows();
                    })
                ]
            ]
        ]

        // ── 메인 리스트 ──
        + SVerticalBox::Slot()
        .FillHeight(1.0f)
        [
            SAssignNew(ListView, SListView<TSharedPtr<FHktVMEventRecord>>)
            .ListItemsSource(&FilteredRows)
            .OnGenerateRow(this, &SHktVMEventPanel::OnGenerateRow)
            .SelectionMode(ESelectionMode::Multi)
        ]
    ];

    // 0.1s 주기 폴링 — 링버퍼에서 신규 레코드 흡수.
    RegisterActiveTimer(0.1f, FWidgetActiveTimerDelegate::CreateLambda(
        [this](double, float) -> EActiveTimerReturnType
        {
            PollNewRecords();
            return EActiveTimerReturnType::Continue;
        }));
}

SHktVMEventPanel::~SHktVMEventPanel()
{
    // 패널 닫힘 — 수집 게이트 차단 (시뮬에서 매 호출 비용 회피).
    FHktVMEventRecorder::Get().SetActive(false);
}

FReply SHktVMEventPanel::OnKeyDown(const FGeometry& MyGeometry, const FKeyEvent& InKeyEvent)
{
    if (InKeyEvent.IsControlDown() && InKeyEvent.GetKey() == EKeys::C)
    {
        CopySelectedToClipboard();
        return FReply::Handled();
    }
    return SCompoundWidget::OnKeyDown(MyGeometry, InKeyEvent);
}

// ============================================================================
// Polling — RegisterActiveTimer 콜백
// ============================================================================

void SHktVMEventPanel::PollNewRecords()
{
    auto& Rec = FHktVMEventRecorder::Get();
    if (CachedVersion == Rec.GetVersion())
    {
        return;
    }
    CachedVersion = Rec.GetVersion();

    TArray<FHktVMEventRecord> NewOnes = Rec.Consume(ReadIndex);
    if (NewOnes.Num() == 0) return;

    AllRows.Reserve(AllRows.Num() + NewOnes.Num());
    int32 AddedToFiltered = 0;
    for (FHktVMEventRecord& R : NewOnes)
    {
        TSharedPtr<FHktVMEventRecord> Item = MakeShared<FHktVMEventRecord>(MoveTemp(R));
        AllRows.Add(Item);
        if (PassesFilter(*Item))
        {
            FilteredRows.Add(Item);
            ++AddedToFiltered;
        }
    }

    if (StatusText.IsValid())
    {
        StatusText->SetText(FText::FromString(FString::Printf(
            TEXT("Total=%d  Visible=%d  Recording=%s (%d)"),
            AllRows.Num(), FilteredRows.Num(),
            Rec.IsRecording() ? TEXT("ON") : TEXT("off"),
            Rec.GetRecordedCount())));
    }

    if (AddedToFiltered > 0 && ListView.IsValid())
    {
        ListView->RequestListRefresh();
        if (bAutoScroll && FilteredRows.Num() > 0)
        {
            ListView->RequestScrollIntoView(FilteredRows.Last());
        }
    }
}

bool SHktVMEventPanel::PassesFilter(const FHktVMEventRecord& Rec) const
{
    // Kind
    switch (Rec.Kind)
    {
    case EHktVMEventKind::Event:        if (!bShowEvent)   return false; break;
    case EHktVMEventKind::PendingEvent: if (!bShowPending) return false; break;
    case EHktVMEventKind::PhysicsEvent: if (!bShowPhysics) return false; break;
    }

    // Phase
    switch (Rec.Phase)
    {
    case EHktVMEventPhase::Created:   if (!bShowCreated)   return false; break;
    case EHktVMEventPhase::Consumed:  if (!bShowConsumed)  return false; break;
    case EHktVMEventPhase::Discarded: if (!bShowDiscarded) return false; break;
    }

    // Source
    if (Rec.Source == static_cast<uint8>(EHktLogSource::Server) && !bShowServer) return false;
    if (Rec.Source == static_cast<uint8>(EHktLogSource::Client) && !bShowClient) return false;

    // Entity ID
    if (EntityIdFilter.Num() > 0)
    {
        const bool bAny =
            (Rec.SourceEntity  >= 0 && EntityIdFilter.Contains(Rec.SourceEntity))  ||
            (Rec.TargetEntity  >= 0 && EntityIdFilter.Contains(Rec.TargetEntity))  ||
            (Rec.WatchedEntity >= 0 && EntityIdFilter.Contains(Rec.WatchedEntity)) ||
            (Rec.HitEntity     >= 0 && EntityIdFilter.Contains(Rec.HitEntity));
        if (!bAny) return false;
    }

    // 텍스트 필터
    if (!FilterText.IsEmpty())
    {
        const FString EventTagStr = Rec.EventTag.IsValid() ? Rec.EventTag.ToString() : FString();
        const FString Payload = FormatPayload(Rec);
        if (!EventTagStr.Contains(FilterText) && !Rec.Note.Contains(FilterText) && !Payload.Contains(FilterText))
        {
            return false;
        }
    }

    return true;
}

void SHktVMEventPanel::RebuildFilteredRows()
{
    FilteredRows.Reset();
    FilteredRows.Reserve(AllRows.Num());
    for (const TSharedPtr<FHktVMEventRecord>& Item : AllRows)
    {
        if (Item.IsValid() && PassesFilter(*Item))
        {
            FilteredRows.Add(Item);
        }
    }
    if (StatusText.IsValid())
    {
        auto& Rec = FHktVMEventRecorder::Get();
        StatusText->SetText(FText::FromString(FString::Printf(
            TEXT("Total=%d  Visible=%d  Recording=%s (%d)"),
            AllRows.Num(), FilteredRows.Num(),
            Rec.IsRecording() ? TEXT("ON") : TEXT("off"),
            Rec.GetRecordedCount())));
    }
    if (ListView.IsValid())
    {
        ListView->RequestListRefresh();
    }
}

void SHktVMEventPanel::CopySelectedToClipboard()
{
    if (!ListView.IsValid()) return;
    TArray<TSharedPtr<FHktVMEventRecord>> Selected = ListView->GetSelectedItems();
    if (Selected.Num() == 0) return;
    FString Buf;
    for (const TSharedPtr<FHktVMEventRecord>& R : Selected)
    {
        if (R.IsValid())
        {
            Buf += FormatRecordForCopy(*R);
            Buf += TEXT("\n");
        }
    }
    FPlatformApplicationMisc::ClipboardCopy(*Buf);
}

FString SHktVMEventPanel::FormatRecordForCopy(const FHktVMEventRecord& Rec)
{
    return FString::Printf(TEXT("[%s] frame=%llu sim=%lld src=%s kind=%s phase=%s | %s | note=%s"),
        *FString::Printf(TEXT("%.3fs"), Rec.Timestamp),
        Rec.FrameNumber, Rec.SimFrameNumber,
        GetSourceName(Rec.Source),
        GetHktVMEventKindName(Rec.Kind),
        GetHktVMEventPhaseName(Rec.Phase),
        *FormatPayload(Rec),
        *Rec.Note);
}

// ============================================================================
// Row 위젯
// ============================================================================

TSharedRef<ITableRow> SHktVMEventPanel::OnGenerateRow(TSharedPtr<FHktVMEventRecord> Item,
                                                     const TSharedRef<STableViewBase>& OwnerTable)
{
    typedef STableRow<TSharedPtr<FHktVMEventRecord>> RowType;
    if (!Item.IsValid())
    {
        return SNew(RowType, OwnerTable);
    }

    const FHktVMEventRecord& R = *Item;
    const double RelTime = R.Timestamp - StartTime;

    return SNew(RowType, OwnerTable)
    [
        SNew(SHorizontalBox)

        // Time
        + SHorizontalBox::Slot().AutoWidth().Padding(2, 1)
        [
            SNew(SBox).MinDesiredWidth(75.f)
            [
                SNew(STextBlock)
                .Text(FText::FromString(FString::Printf(TEXT("%8.3fs"), RelTime)))
                .Font(FCoreStyle::GetDefaultFontStyle("Mono", 9))
                .ColorAndOpacity(FSlateColor(VMEvtColors::Time))
            ]
        ]

        // SimFrame
        + SHorizontalBox::Slot().AutoWidth().Padding(2, 1)
        [
            SNew(SBox).MinDesiredWidth(70.f)
            [
                SNew(STextBlock)
                .Text(FText::FromString(R.SimFrameNumber >= 0
                    ? FString::Printf(TEXT("F%lld"), R.SimFrameNumber)
                    : FString::Printf(TEXT("uf%llu"), R.FrameNumber)))
                .Font(FCoreStyle::GetDefaultFontStyle("Mono", 9))
                .ColorAndOpacity(FSlateColor(VMEvtColors::Frame))
            ]
        ]

        // Source
        + SHorizontalBox::Slot().AutoWidth().Padding(2, 1)
        [
            SNew(SBox).MinDesiredWidth(45.f)
            [
                SNew(STextBlock)
                .Text(FText::FromString(GetSourceName(R.Source)))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(GetSourceColor(R.Source)))
            ]
        ]

        // Kind
        + SHorizontalBox::Slot().AutoWidth().Padding(2, 1)
        [
            SNew(SBox).MinDesiredWidth(70.f)
            [
                SNew(STextBlock)
                .Text(FText::FromString(GetHktVMEventKindName(R.Kind)))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(GetKindColor(R.Kind)))
            ]
        ]

        // Phase
        + SHorizontalBox::Slot().AutoWidth().Padding(2, 1)
        [
            SNew(SBox).MinDesiredWidth(70.f)
            [
                SNew(STextBlock)
                .Text(FText::FromString(GetHktVMEventPhaseName(R.Phase)))
                .Font(FCoreStyle::GetDefaultFontStyle("Bold", 9))
                .ColorAndOpacity(FSlateColor(GetPhaseColor(R.Phase)))
            ]
        ]

        // Payload (Tag/Params/Watched/…)
        + SHorizontalBox::Slot().FillWidth(1.0f).Padding(4, 1)
        [
            SNew(STextBlock)
            .Text(FText::FromString(FormatPayload(R)))
            .Font(FCoreStyle::GetDefaultFontStyle("Mono", 9))
            .ColorAndOpacity(FSlateColor(VMEvtColors::Message))
            .AutoWrapText(false)
        ]

        // Note
        + SHorizontalBox::Slot().AutoWidth().Padding(4, 1)
        [
            SNew(STextBlock)
            .Text(FText::FromString(R.Note))
            .Font(FCoreStyle::GetDefaultFontStyle("Italic", 9))
            .ColorAndOpacity(FSlateColor(VMEvtColors::Dim))
        ]
    ];
}

#undef LOCTEXT_NAMESPACE
