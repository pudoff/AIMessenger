export const MESSAGE_MAX_LENGTH = 4000;
export const MAX_ATTACHMENT_SIZE_BYTES = 1536 * 1024 * 1024;
export const MAX_ATTACHMENT_SIZE_LABEL = '1.5 ГБ';
export const ATTACHMENT_TOO_LARGE_MESSAGE = `Файл слишком большой. Макс. ${MAX_ATTACHMENT_SIZE_LABEL}`;

export function trimMessageToLimit(text, limit = MESSAGE_MAX_LENGTH) {
  return String(text || '').slice(0, limit);
}

export function isAttachmentTooLarge(file) {
  return Number(file?.size || 0) > MAX_ATTACHMENT_SIZE_BYTES;
}
