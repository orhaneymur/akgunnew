const ISTANBUL_TZ = 'Europe/Istanbul';

/** Fatura kayıt zamanı: seçilen tarih + İstanbul'daki şu anki saat */
export function buildInvoiceCreatedAt(invoiceDate?: string): Date {
  const datePart =
    invoiceDate?.trim() ||
    new Intl.DateTimeFormat('en-CA', { timeZone: ISTANBUL_TZ }).format(new Date());

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const pick = (type: string) =>
    timeParts.find((part) => part.type === type)?.value.padStart(2, '0') ?? '00';

  return new Date(
    `${datePart}T${pick('hour')}:${pick('minute')}:${pick('second')}+03:00`
  );
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
