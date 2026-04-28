// Copyright Hkt Studios, Inc. All Rights Reserved.

#include "SHktAnimCapturePanel.h"

#include "HktAnimCaptureFunctionLibrary.h"

#include "Animation/AnimSequence.h"
#include "AssetRegistry/AssetData.h"
#include "Camera/CameraTypes.h"
#include "Camera/HktCameraModeBase.h"
#include "DesktopPlatformModule.h"
#include "Engine/SkeletalMesh.h"
#include "Framework/Application/SlateApplication.h"
#include "IDesktopPlatform.h"
#include "PropertyCustomizationHelpers.h"
#include "ThumbnailRendering/ThumbnailManager.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SComboBox.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Text/STextBlock.h"

#define LOCTEXT_NAMESPACE "HktAnimCapture"

namespace HktAnimCapturePanelPrivate
{
	static TSharedRef<SWidget> MakeRow(const FText& Label, TSharedRef<SWidget> Field)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0,0,8,0)
			[ SNew(STextBlock).Text(Label).MinDesiredWidth(150.f) ]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
			[ Field ];
	}

	static const TArray<TSharedPtr<EHktAnimCaptureCameraPreset>>& GetPresetOptions()
	{
		static TArray<TSharedPtr<EHktAnimCaptureCameraPreset>> Options;
		if (Options.Num() == 0)
		{
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::RtsView));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::ShoulderView));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::IsometricOrtho));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::IsometricGame));
			Options.Add(MakeShared<EHktAnimCaptureCameraPreset>(EHktAnimCaptureCameraPreset::Custom));
		}
		return Options;
	}

	static FText PresetToText(EHktAnimCaptureCameraPreset Preset)
	{
		switch (Preset)
		{
		case EHktAnimCaptureCameraPreset::RtsView:        return LOCTEXT("Preset_Rts",   "RTS View");
		case EHktAnimCaptureCameraPreset::ShoulderView:   return LOCTEXT("Preset_Sh",    "Shoulder View");
		case EHktAnimCaptureCameraPreset::IsometricOrtho: return LOCTEXT("Preset_IsoO",  "Isometric Ortho");
		case EHktAnimCaptureCameraPreset::IsometricGame:  return LOCTEXT("Preset_IsoG",  "Isometric Game");
		case EHktAnimCaptureCameraPreset::Custom:         return LOCTEXT("Preset_Cust",  "Custom");
		}
		return FText::GetEmpty();
	}

	static FText IntText(int32 V) { return FText::AsNumber(V); }
	static FText FloatText(float V) { return FText::FromString(FString::SanitizeFloat(V)); }
}

void SHktAnimCapturePanel::Construct(const FArguments& InArgs)
{
	using namespace HktAnimCapturePanelPrivate;

	// 디폴트 설정 적용 (IsometricOrtho).
	Settings.NumDirections = 8;
	Settings.OutputWidth = 256;
	Settings.OutputHeight = 256;
	Settings.CaptureFPS = 10.0f;
	Settings.PixelToWorld = 2.0f;
	Settings.FrameDurationMs = 100.0f;
	Settings.bLooping = true;
	Settings.bAutoBuildAtlas = true;
	Settings.bTransparentBackground = true;
	ApplyPresetToCustomFields(Settings.CameraPreset);

	const FSlateFontInfo HeaderFont = FCoreStyle::GetDefaultFontStyle("Bold", 13);

	ChildSlot
	[
		SNew(SBorder).Padding(12)
		[
			SNew(SScrollBox)

			+ SScrollBox::Slot()
			[
				SNew(SVerticalBox)

				// === 헤더 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock).Font(FCoreStyle::GetDefaultFontStyle("Bold", 14))
					.Text(LOCTEXT("Title", "HKT Animation Capture"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,0,0,8)
				[
					SNew(STextBlock).Text(LOCTEXT("Hint",
						"SkeletalMesh + AnimSequence 를 8(또는 1·4)방향에서 캡처하여 PNG 시퀀스로 저장. "
						"옵션으로 즉시 Sprite Atlas DataAsset 까지 생성."))
					.AutoWrapText(true)
				]

				// === 모델 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("MeshLbl", "Skeletal Mesh"),
					SNew(SObjectPropertyEntryBox)
						.AllowedClass(USkeletalMesh::StaticClass())
						.ObjectPath(this, &SHktAnimCapturePanel::GetSkeletalMeshPath)
						.OnObjectChanged(this, &SHktAnimCapturePanel::OnSkeletalMeshChanged)
						.AllowClear(true)
						.DisplayUseSelected(true)
						.DisplayBrowse(true)
						.DisplayThumbnail(true)
						.ThumbnailPool(UThumbnailManager::Get().GetSharedThumbnailPool())
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("AnimLbl", "Anim Sequence"),
					SNew(SObjectPropertyEntryBox)
						.AllowedClass(UAnimSequence::StaticClass())
						.ObjectPath(this, &SHktAnimCapturePanel::GetAnimSequencePath)
						.OnObjectChanged(this, &SHktAnimCapturePanel::OnAnimSequenceChanged)
						.AllowClear(true)
						.DisplayUseSelected(true)
						.DisplayBrowse(true)
						.DisplayThumbnail(true)
						.ThumbnailPool(UThumbnailManager::Get().GetSharedThumbnailPool())
				) ]

				// === 식별 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("TagLbl", "Character Tag"),
					SAssignNew(CharacterTagBox, SEditableTextBox)
						.Text(FText::FromString(Settings.CharacterTag))
						.HintText(LOCTEXT("TagHint", "Sprite.Character.Knight"))
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("ActionLbl", "Action Id"),
					SAssignNew(ActionIdBox, SEditableTextBox)
						.Text(FText::FromString(Settings.ActionId))
						.HintText(LOCTEXT("ActionHint", "idle / walk / run / attack"))
				) ]

				// === 카메라 프리셋 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("CameraSec", "Camera"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("CamModeLbl", "Camera Mode BP"),
					SNew(SObjectPropertyEntryBox)
						.AllowedClass(UHktCameraModeBase::StaticClass())
						.ObjectPath(this, &SHktAnimCapturePanel::GetCameraModeAssetPath)
						.OnObjectChanged(this, &SHktAnimCapturePanel::OnCameraModeAssetChanged)
						.AllowClear(true)
						.DisplayUseSelected(true)
						.DisplayBrowse(true)
						.DisplayThumbnail(true)
						.ThumbnailPool(UThumbnailManager::Get().GetSharedThumbnailPool())
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,2,0,4)
				[
					SNew(STextBlock)
					.Text(LOCTEXT("CamModeHint",
						"BP 지정 시 인게임 Framing(Projection/FOV/OrthoWidth/Pitch/ArmLength/SocketOffset)을 그대로 사용. "
						"미지정 시 아래 프리셋/Custom 값 사용."))
					.AutoWrapText(true)
					.ColorAndOpacity(FSlateColor::UseSubduedForeground())
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("PresetLbl", "Camera Preset"),
					SNew(SComboBox<TSharedPtr<EHktAnimCaptureCameraPreset>>)
						.OptionsSource(&GetPresetOptions())
						.OnGenerateWidget_Lambda([](TSharedPtr<EHktAnimCaptureCameraPreset> P)
						{
							return SNew(STextBlock).Text(PresetToText(*P));
						})
						.OnSelectionChanged_Lambda([this](TSharedPtr<EHktAnimCaptureCameraPreset> P, ESelectInfo::Type)
						{
							if (P.IsValid())
							{
								Settings.CameraPreset = *P;
								ApplyPresetToCustomFields(*P);
								if (PitchBox.IsValid())      PitchBox->SetText(FloatText(Settings.Pitch));
								if (FovBox.IsValid())        FovBox->SetText(FloatText(Settings.FieldOfView));
								if (OrthoWidthBox.IsValid()) OrthoWidthBox->SetText(FloatText(Settings.OrthoWidth));
								if (ArmLengthBox.IsValid())  ArmLengthBox->SetText(FloatText(Settings.ArmLength));
							}
						})
						.InitiallySelectedItem(GetPresetOptions()[2])  // IsoOrtho
						[
							SNew(STextBlock)
							.Text_Lambda([this]() { return PresetToText(Settings.CameraPreset); })
						]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("PitchLbl", "Pitch (deg)"),
						SAssignNew(PitchBox, SEditableTextBox).Text(FloatText(Settings.Pitch))) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("YawOffLbl", "Yaw Offset (deg)"),
						SAssignNew(YawOffsetBox, SEditableTextBox).Text(FloatText(Settings.YawOffset))) ]
					+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("FovLbl", "FOV (Persp)"),
						SAssignNew(FovBox, SEditableTextBox).Text(FloatText(Settings.FieldOfView))) ]
					+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("OrthoLbl", "Ortho Width"),
						SAssignNew(OrthoWidthBox, SEditableTextBox).Text(FloatText(Settings.OrthoWidth))) ]
					+ SUniformGridPanel::Slot(0,2)[ MakeRow(LOCTEXT("ArmLbl", "Arm Length"),
						SAssignNew(ArmLengthBox, SEditableTextBox).Text(FloatText(Settings.ArmLength))) ]
				]

				// === 캡처 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("CapSec", "Capture"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("WLbl", "Output Width (px)"),
						SAssignNew(WidthBox, SEditableTextBox).Text(IntText(Settings.OutputWidth))) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("HLbl", "Output Height (px)"),
						SAssignNew(HeightBox, SEditableTextBox).Text(IntText(Settings.OutputHeight))) ]
					+ SUniformGridPanel::Slot(0,1)[ MakeRow(LOCTEXT("NDirLbl", "Num Directions (1/4/8)"),
						SAssignNew(NumDirBox, SEditableTextBox).Text(IntText(Settings.NumDirections))) ]
					+ SUniformGridPanel::Slot(1,1)[ MakeRow(LOCTEXT("FpsLbl", "Capture FPS"),
						SAssignNew(FpsBox, SEditableTextBox).Text(FloatText(Settings.CaptureFPS))) ]
					+ SUniformGridPanel::Slot(0,2)[ MakeRow(LOCTEXT("FCntLbl", "Frame Count (0=Auto)"),
						SAssignNew(FrameCountBox, SEditableTextBox).Text(IntText(Settings.FrameCount))) ]
					+ SUniformGridPanel::Slot(1,2)[ MakeRow(LOCTEXT("StartLbl", "Start Time (sec)"),
						SAssignNew(StartTimeBox, SEditableTextBox).Text(FloatText(Settings.StartTime))) ]
					+ SUniformGridPanel::Slot(0,3)[ MakeRow(LOCTEXT("EndLbl", "End Time (0=Full)"),
						SAssignNew(EndTimeBox, SEditableTextBox).Text(FloatText(Settings.EndTime))) ]
					+ SUniformGridPanel::Slot(1,3)[ MakeRow(LOCTEXT("PadLbl", "Crop Padding (px)"),
						SAssignNew(CropPaddingBox, SEditableTextBox).Text(IntText(Settings.CropPaddingPx))) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bTransparentBackground ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bTransparentBackground = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("BgChk", "Transparent Background")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bAutoCropToContent ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bAutoCropToContent = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("CropChk", "Auto Crop To Content")) ]
					]
				]

				// === 출력 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,8,0,4)
				[
					SNew(STextBlock).Font(HeaderFont)
					.Text(LOCTEXT("OutSec", "Output"))
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("DiskLbl", "Disk Output Dir"),
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f)
					[ SAssignNew(DiskOutDirBox, SEditableTextBox)
						.Text(FText::FromString(Settings.DiskOutputDir))
						.HintText(LOCTEXT("DiskHint", "비워두면 <Project>/Saved/SpriteGenerator/AnimCapture/...")) ]
					+ SHorizontalBox::Slot().AutoWidth().Padding(4,0,0,0)
					[ SNew(SButton).Text(LOCTEXT("Browse", "Browse..."))
						.OnClicked(this, &SHktAnimCapturePanel::OnBrowseDiskOutputDir) ]
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[ MakeRow(LOCTEXT("AssetLbl", "Asset Output Dir (UE)"),
					SAssignNew(AssetOutDirBox, SEditableTextBox)
						.Text(FText::FromString(Settings.AssetOutputDir))
				) ]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SUniformGridPanel).SlotPadding(FMargin(4))
					+ SUniformGridPanel::Slot(0,0)[ MakeRow(LOCTEXT("P2WLbl", "PixelToWorld"),
						SAssignNew(PixelToWorldBox, SEditableTextBox).Text(FloatText(Settings.PixelToWorld))) ]
					+ SUniformGridPanel::Slot(1,0)[ MakeRow(LOCTEXT("FrDurLbl", "FrameDuration (ms)"),
						SAssignNew(FrameDurationBox, SEditableTextBox).Text(FloatText(Settings.FrameDurationMs))) ]
				]

				+ SVerticalBox::Slot().AutoHeight().Padding(0,4)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bLooping ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bLooping = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("LoopChk", "Looping")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth().Padding(0,0,16,0)
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bMirrorWestFromEast ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bMirrorWestFromEast = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("MirrorChk", "Mirror W from E")) ]
					]
					+ SHorizontalBox::Slot().AutoWidth()
					[
						SNew(SCheckBox)
						.IsChecked(Settings.bAutoBuildAtlas ? ECheckBoxState::Checked : ECheckBoxState::Unchecked)
						.OnCheckStateChanged_Lambda([this](ECheckBoxState S){ Settings.bAutoBuildAtlas = (S==ECheckBoxState::Checked); })
						[ SNew(STextBlock).Text(LOCTEXT("AtlasChk", "Auto-Build Sprite Atlas after capture")) ]
					]
				]

				// === 캡처 버튼 ===
				+ SVerticalBox::Slot().AutoHeight().Padding(0,16,0,4)
				[
					SNew(SButton)
					.HAlign(HAlign_Center)
					.ContentPadding(FMargin(24,8))
					.Text(LOCTEXT("CapBtn", "Capture Animation"))
					.OnClicked(this, &SHktAnimCapturePanel::OnCaptureClicked)
				]

				// === 결과 로그 ===
				+ SVerticalBox::Slot().FillHeight(1.f).Padding(0,8,0,0)
				[
					SAssignNew(ResultBox, SMultiLineEditableTextBox)
					.IsReadOnly(true)
					.AllowMultiLine(true)
					.HintText(LOCTEXT("ResHint", "캡처 결과 JSON 이 여기 표시됩니다"))
				]
			]
		]
	];
}

void SHktAnimCapturePanel::OnSkeletalMeshChanged(const FAssetData& Asset)
{
	Settings.SkeletalMesh = TSoftObjectPtr<USkeletalMesh>(Asset.ToSoftObjectPath());
}

void SHktAnimCapturePanel::OnAnimSequenceChanged(const FAssetData& Asset)
{
	Settings.AnimSequence = TSoftObjectPtr<UAnimSequence>(Asset.ToSoftObjectPath());
}

void SHktAnimCapturePanel::OnCameraModeAssetChanged(const FAssetData& Asset)
{
	Settings.CameraModeAsset = TSoftObjectPtr<UHktCameraModeBase>(Asset.ToSoftObjectPath());
}

FString SHktAnimCapturePanel::GetSkeletalMeshPath() const
{
	return Settings.SkeletalMesh.IsNull() ? FString() : Settings.SkeletalMesh.ToString();
}

FString SHktAnimCapturePanel::GetAnimSequencePath() const
{
	return Settings.AnimSequence.IsNull() ? FString() : Settings.AnimSequence.ToString();
}

FString SHktAnimCapturePanel::GetCameraModeAssetPath() const
{
	return Settings.CameraModeAsset.IsNull() ? FString() : Settings.CameraModeAsset.ToString();
}

void SHktAnimCapturePanel::ApplyPresetToCustomFields(EHktAnimCaptureCameraPreset Preset)
{
	switch (Preset)
	{
	case EHktAnimCaptureCameraPreset::RtsView:
		Settings.ProjectionMode = ECameraProjectionMode::Perspective;
		Settings.FieldOfView = 90.0f;  Settings.Pitch = -60.0f;  Settings.ArmLength = 2000.0f;
		break;
	case EHktAnimCaptureCameraPreset::ShoulderView:
		Settings.ProjectionMode = ECameraProjectionMode::Perspective;
		Settings.FieldOfView = 90.0f;  Settings.Pitch = -15.0f;  Settings.ArmLength = 300.0f;
		break;
	case EHktAnimCaptureCameraPreset::IsometricOrtho:
		Settings.ProjectionMode = ECameraProjectionMode::Orthographic;
		Settings.OrthoWidth = 2500.0f; Settings.Pitch = -30.0f;  Settings.ArmLength = 2000.0f;
		break;
	case EHktAnimCaptureCameraPreset::IsometricGame:
		Settings.ProjectionMode = ECameraProjectionMode::Perspective;
		Settings.FieldOfView = 20.0f;  Settings.Pitch = -55.0f;  Settings.ArmLength = 2500.0f;
		break;
	case EHktAnimCaptureCameraPreset::Custom:
	default:
		break;
	}
}

FReply SHktAnimCapturePanel::OnBrowseDiskOutputDir()
{
	IDesktopPlatform* DP = FDesktopPlatformModule::Get();
	if (!DP) return FReply::Handled();

	const FString Current = DiskOutDirBox.IsValid() ? DiskOutDirBox->GetText().ToString() : FString();
	FString OutPath;
	const bool bOK = DP->OpenDirectoryDialog(
		FSlateApplication::Get().FindBestParentWindowHandleForDialogs(AsShared()),
		TEXT("Select Capture Output Directory"),
		Current.IsEmpty() ? FPaths::ProjectSavedDir() : Current,
		OutPath);
	if (bOK && DiskOutDirBox.IsValid())
	{
		DiskOutDirBox->SetText(FText::FromString(OutPath));
	}
	return FReply::Handled();
}

void SHktAnimCapturePanel::RebuildSettingsFromUI()
{
	auto GetStr = [](const TSharedPtr<SEditableTextBox>& Box) -> FString {
		return Box.IsValid() ? Box->GetText().ToString() : FString();
	};
	auto GetInt = [&](const TSharedPtr<SEditableTextBox>& Box, int32 Def) -> int32 {
		const FString S = GetStr(Box);
		return S.IsEmpty() ? Def : FCString::Atoi(*S);
	};
	auto GetFlt = [&](const TSharedPtr<SEditableTextBox>& Box, float Def) -> float {
		const FString S = GetStr(Box);
		return S.IsEmpty() ? Def : FCString::Atof(*S);
	};

	Settings.CharacterTag    = GetStr(CharacterTagBox);
	Settings.ActionId        = GetStr(ActionIdBox);
	Settings.DiskOutputDir   = GetStr(DiskOutDirBox);
	Settings.AssetOutputDir  = GetStr(AssetOutDirBox);

	Settings.OutputWidth     = FMath::Max(16,  GetInt(WidthBox,  Settings.OutputWidth));
	Settings.OutputHeight    = FMath::Max(16,  GetInt(HeightBox, Settings.OutputHeight));
	Settings.NumDirections   = FMath::Clamp(GetInt(NumDirBox, Settings.NumDirections), 1, 8);
	Settings.FrameCount      = FMath::Max(0,   GetInt(FrameCountBox, Settings.FrameCount));
	Settings.CaptureFPS      = FMath::Max(0.1f, GetFlt(FpsBox, Settings.CaptureFPS));
	Settings.StartTime       = FMath::Max(0.0f, GetFlt(StartTimeBox, Settings.StartTime));
	Settings.EndTime         = FMath::Max(0.0f, GetFlt(EndTimeBox, Settings.EndTime));

	Settings.Pitch           = GetFlt(PitchBox,      Settings.Pitch);
	Settings.YawOffset       = GetFlt(YawOffsetBox,  Settings.YawOffset);
	Settings.FieldOfView     = GetFlt(FovBox,        Settings.FieldOfView);
	Settings.OrthoWidth      = GetFlt(OrthoWidthBox, Settings.OrthoWidth);
	Settings.ArmLength       = GetFlt(ArmLengthBox,  Settings.ArmLength);

	Settings.PixelToWorld    = GetFlt(PixelToWorldBox,  Settings.PixelToWorld);
	Settings.FrameDurationMs = GetFlt(FrameDurationBox, Settings.FrameDurationMs);
	Settings.CropPaddingPx   = FMath::Max(0, GetInt(CropPaddingBox, Settings.CropPaddingPx));
}

FReply SHktAnimCapturePanel::OnCaptureClicked()
{
	RebuildSettingsFromUI();

	const FString Result = UHktAnimCaptureFunctionLibrary::CaptureAnimation(Settings);
	if (ResultBox.IsValid())
	{
		ResultBox->SetText(FText::FromString(Result));
	}
	return FReply::Handled();
}

#undef LOCTEXT_NAMESPACE
