export type InstallAvailability = {
  isStandalone: boolean;
  hasNativePrompt: boolean;
};

export function shouldShowInstallButton({
  isStandalone,
  hasNativePrompt,
}: InstallAvailability) {
  return !isStandalone && hasNativePrompt;
}

export function shouldShowInstallInstructions(isStandalone: boolean) {
  return !isStandalone;
}

export function shouldShowUpdatePrompt(
  hasWaitingWorker: boolean,
  hasShownPrompt: boolean
) {
  return hasWaitingWorker && !hasShownPrompt;
}

export function shouldReloadForControllerChange(
  updateWasRequested: boolean,
  reloadAlreadyRequested: boolean
) {
  return updateWasRequested && !reloadAlreadyRequested;
}

export function shouldRequestWorkerActivation(userConfirmed: boolean) {
  return userConfirmed;
}
