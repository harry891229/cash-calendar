export type SettingsSectionState = {
  categories: boolean;
  recurring: boolean;
};

export function createDefaultSettingsSectionState(): SettingsSectionState {
  return { categories: false, recurring: false };
}

export function toggleSettingsSection(
  state: SettingsSectionState,
  section: keyof SettingsSectionState
): SettingsSectionState {
  return { ...state, [section]: !state[section] };
}
