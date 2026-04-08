import { AURORA_PRESETS, type AuroraPreset } from "@/app/stores/useThemeStore";

export interface PresetConfig {
  name: AuroraPreset;
  label: string;
}

export const PRESET_LIST: PresetConfig[] = AURORA_PRESETS.map((name) => ({
  name,
  label: name.charAt(0).toUpperCase() + name.slice(1),
}));
