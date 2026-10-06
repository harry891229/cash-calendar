export type SettingsSectionId =
  | "budget"
  | "categories"
  | "recurring"
  | "backup"
  | "data"
  | "about";

type SettingsDirectoryGroup = {
  id: string;
  title: string;
  entries: ReadonlyArray<{ id: SettingsSectionId; title: string }>;
};

export const SETTINGS_DIRECTORY: ReadonlyArray<SettingsDirectoryGroup> = [
  {
    id: "bookkeeping",
    title: "記帳設定",
    entries: [
      { id: "budget", title: "每月預算" },
      { id: "categories", title: "分類管理" },
      { id: "recurring", title: "固定收支" },
    ],
  },
  {
    id: "storage",
    title: "資料管理",
    entries: [
      { id: "backup", title: "備份與還原" },
      { id: "data", title: "資料管理" },
    ],
  },
  {
    id: "app",
    title: "關於",
    entries: [{ id: "about", title: "App 資訊" }],
  },
];

export function getSettingsSectionTitle(section: SettingsSectionId | null) {
  if (section === null) return "設定";
  return SETTINGS_DIRECTORY.flatMap((group) => group.entries).find(
    (entry) => entry.id === section
  )!.title;
}
