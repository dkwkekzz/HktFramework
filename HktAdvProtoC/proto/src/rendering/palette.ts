// 키 → 시각 언어 매핑표 (기획서 §42-8 / Phase-8 §8.3)
//
// 빌더가 넘긴 **키**를 색·글리프로 옮기는 표다. 여기 있는 값은 전부 표현의 선택이며,
// 아이콘 스타일 교체는 이 표의 교체일 뿐이다 — 빌더·코어에는 한 줄의 변경도 없다(§8.0).
//
// 반대로 이 파일에 `if (danger > 50)` 같은 **수치 해석은 없다.** 그 판단은 이미 빌더가 키로 바꿔 보냈다.

const FALLBACK_COLOR = "#9aa0a6";

/**
 * 위험도·상태·사건 색상 키.
 * 어두운 바탕 위에서 개체가 도형으로 읽히는 게임풍 팔레트 — 지역은 가라앉고 개체·사건이 떠오른다.
 */
export const COLORS: Record<string, string> = {
  "danger-low": "#3f9d6d",
  "danger-mid": "#c9a83f",
  "danger-high": "#d07a33",
  "danger-extreme": "#d64a38",
  "climate-cold": "#2e4a66",
  "climate-arid": "#5d4d33",
  "climate-wild": "#2e523a",
  "climate-settled": "#4d4638",
  "climate-temperate": "#3a5244",
  "state-normal": "#5aa7e8",
  "state-afraid": "#a98be0",
  "state-hostile": "#e0563f",
  "state-critical": "#ff4433",
  "event-closed": "#8a8f98",
  // 지도의 무대 장치 — 배경·그림자·이름표도 표의 항목일 뿐이다
  "map-bg": "#131a26",
  "marker-shadow": "#05070c",
  "marker-rim": "#0b0f16",
  "marker-highlight": "#ffffff",
  label: "#dfe6f2",
  "label-dim": "#93a0b5",
  "gauge-back": "#1b2331",
  "gauge-ok": "#57d98f",
  "gauge-low": "#e0523c",
};

export function colorOf(key: string): string {
  return COLORS[key] ?? FALLBACK_COLOR;
}

/** 심볼 키 → 글리프 (§42-8 캐릭터 아이콘 — 에셋 저작 없이 글리프로, §43) */
export const GLYPHS: Record<string, string> = {
  "symbol-player": "◉",
  "symbol-agent": "●",
  "symbol-beast": "▲",
  "symbol-faction": "▣",
  "symbol-resource": "◇",
  "symbol-place": "▪",
  "symbol-unknown": "?",
};

export function glyphOf(key: string): string {
  const direct = GLYPHS[key];
  if (direct !== undefined) return direct;
  // 종족 심볼(`symbol-species.human`)은 표에 없으면 종족 첫 글자를 쓴다 — 새 종족이 생겨도 그려진다
  if (key.startsWith("symbol-species.")) {
    const name = key.slice("symbol-species.".length);
    return (name[0] ?? "●").toUpperCase();
  }
  if (key.startsWith("event.")) return "✦";
  return "●";
}

/**
 * 관찰 채널 → 시각 언어 (§8.3 파문·잔광·아이콘).
 * 채널마다 다른 언어를 주는 것이 "능력 효과·사건 연출"의 전부다 — 별도 연출 스크립트는 없다.
 */
export interface ChannelStyle {
  /** ripple=파문, glow=잔광, icon=아이콘 */
  shape: "ripple" | "glow" | "icon";
  color: string;
  glyph: string;
}

export const CHANNEL_STYLES: Record<string, ChannelStyle> = {
  sight: { shape: "glow", color: "#f4d67a", glyph: "◌" },
  sound: { shape: "ripple", color: "#7fb3d5", glyph: "◜" },
  smell: { shape: "glow", color: "#a8c686", glyph: "≈" },
  vibration: { shape: "ripple", color: "#c39bd3", glyph: "∿" },
  energy_sense: { shape: "ripple", color: "#76d7c4", glyph: "✧" },
  trace: { shape: "icon", color: "#b7950b", glyph: "⌇" },
  talk: { shape: "icon", color: "#5499c7", glyph: "❝" },
  report: { shape: "icon", color: "#7d6608", glyph: "✉" },
};

export function channelStyleOf(key: string): ChannelStyle {
  return CHANNEL_STYLES[key] ?? { shape: "glow", color: FALLBACK_COLOR, glyph: "·" };
}
