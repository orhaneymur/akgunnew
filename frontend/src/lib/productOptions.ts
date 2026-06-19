export const APPEARANCE_OPTIONS = [
  { value: 'CITALI', label: 'Çıtalı' },
  { value: 'CITASIZ', label: 'Çıtasız' },
] as const;

export const QUALITY_OPTIONS = [
  { value: 'A_KALITE', label: 'A Kalite' },
  { value: 'A_PLUS', label: 'A Plus' },
  { value: 'ORJINAL', label: 'Orjinal' },
  { value: 'REVIZYON_ORJINAL', label: 'Revizyon Orjinal' },
  { value: 'SERVIS_ORJINAL', label: 'Servis Orjinal' },
  { value: 'OLED', label: 'OLED' },
] as const;

export function appearanceLabel(value: string | null | undefined): string {
  if (!value) return '';
  return APPEARANCE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function qualityLabel(value: string | null | undefined): string {
  if (!value) return '';
  return QUALITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
