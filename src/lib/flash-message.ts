export const FLASH_MESSAGE_KEY = "cashCalendarFlashMessage";
export const FLASH_TOAST_DURATION_MS = 2500;

export function saveFlashMessage(
  message: string,
  storage: Pick<Storage, "setItem"> = sessionStorage
) {
  storage.setItem(FLASH_MESSAGE_KEY, message);
}

export function consumeFlashMessage(
  storage: Pick<Storage, "getItem" | "removeItem"> = sessionStorage
) {
  const message = storage.getItem(FLASH_MESSAGE_KEY);

  if (message !== null) {
    storage.removeItem(FLASH_MESSAGE_KEY);
  }

  return message;
}

/** Start one page's toast and return cleanup for navigation or unmount. */
export function startFlashToast(
  onMessage: (message: string | null) => void,
  storage: Pick<Storage, "getItem" | "removeItem"> = sessionStorage
) {
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let visible = false;

  // Consume only when the display step runs. A cancelled mount (including
  // React Strict Mode's effect replay) must leave the pending message intact.
  const showTimer = setTimeout(() => {
    const message = consumeFlashMessage(storage);
    onMessage(message);
    if (!message) return;

    visible = true;
    hideTimer = setTimeout(() => {
      visible = false;
      onMessage(null);
    }, FLASH_TOAST_DURATION_MS);
  }, 0);

  return () => {
    clearTimeout(showTimer);
    if (hideTimer !== undefined) clearTimeout(hideTimer);
    // Cancelling the hide timer must also clear the message it owned.
    if (visible) {
      visible = false;
      onMessage(null);
    }
  };
}
