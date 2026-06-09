export function getApiMessageId(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }
  return numericId;
}

export function getLastApiMessageId(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const id = getApiMessageId(messages[index]?.id);
    if (id) {
      return id;
    }
  }
  return null;
}

export function isNetworkSendError(error) {
  return !navigator.onLine || error?.status === 0 || error?.isNetworkError;
}
