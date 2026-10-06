type RecordSaveActions = {
  saveRecords: () => void;
  rememberCategory: () => void;
  showSuccess: () => void;
  navigate: () => void;
};

/** Only a failed record write may throw and allow the form to retry. */
export function commitRecordSave(actions: RecordSaveActions) {
  actions.saveRecords();

  for (const followUp of [actions.rememberCategory, actions.showSuccess]) {
    try {
      followUp();
    } catch {
      // Preferences and notifications are optional once the records are saved.
    }
  }

  try {
    actions.navigate();
    return { navigated: true };
  } catch {
    // Keep the committed form locked even if navigation cannot complete.
    return { navigated: false };
  }
}
