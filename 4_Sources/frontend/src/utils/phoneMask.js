
export const formatPhone = (value) => {
  // Удаляем всё, кроме цифр
  const digits = value.replace(/\D/g, '');
  
  // Обрабатываем префикс: убираем 8 или 7 в начале, оставляем чистые 10 цифр
  let cleaned = digits;
  if (cleaned.startsWith('8')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('7')) cleaned = cleaned.slice(1);
  cleaned = cleaned.slice(0, 10); 
  
  // Формируем маску по шагам
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return `+7 (${cleaned}`;
  if (cleaned.length <= 6) return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  if (cleaned.length <= 8) return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
};

/**
 * Извлекает только цифры из отформатированного номера
 * @param {string} value - Значение из инпута (может быть в формате +7 (...))
 * @returns {string} - Только цифры (для сохранения в стейт и валидации)
 */
export const cleanPhone = (value) => {
  const digits = value.replace(/\D/g, '');
  let cleaned = digits;
  if (cleaned.startsWith('8')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('7')) cleaned = cleaned.slice(1);
  return cleaned.slice(0, 10);
};