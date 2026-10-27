/**
 * CRM-07 comparison normalization. Stored values remain presentation values;
 * these functions produce deterministic comparison keys for search and
 * duplicate warnings without rewriting user-entered contact data.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Brazilian +55 prefix is equivalent to the same local 10/11 digit number. */
export function normalizePhone(value: string): string {
  const digits = normalizeDigits(value);
  const isBrazilian =
    digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
  return isBrazilian ? digits.slice(2) : digits;
}

/** CNPJ/CPF comparison keys contain digits only; input/display is preserved. */
export function normalizeDocument(value: string): string {
  return normalizeDigits(value);
}
