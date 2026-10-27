import {
  normalizeDigits,
  normalizeDocument,
  normalizeEmail,
  normalizePhone,
  normalizeSearchText,
} from './normalize';

describe('CRM-07 comparison normalization', () => {
  it('folds accents, case and repeated whitespace deterministically', () => {
    expect(normalizeSearchText('  MÁRIA   Joana ')).toBe('maria joana');
    expect(normalizeSearchText('Maria Joana')).toBe('maria joana');
  });

  it('normalizes email casing and surrounding whitespace', () => {
    expect(normalizeEmail('contact@example.com')).toBe('contact@example.com');
  });

  it('compares formatted phone numbers by digits and equates Brazilian +55', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321');
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321');
    expect(normalizeDigits('11 98765-4321')).toBe('11987654321');
  });

  it('compares CPF/CNPJ by digits without changing their display values', () => {
    expect(normalizeDocument('12.345.678/0001-90')).toBe('12345678000190');
    expect(normalizeDocument('12345678000190')).toBe('12345678000190');
  });
});
