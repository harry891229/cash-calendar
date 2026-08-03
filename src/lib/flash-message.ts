export const FLASH_MESSAGE_KEY = "cashCalendarFlashMessage";

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

  if (message) {
    storage.removeItem(FLASH_MESSAGE_KEY);
  }

  return message;
}
