/** Veritabanı depo adları → ekranda gösterilen etiketler */
export const DEPOT_LABELS: Record<string, string> = {
  MERKEZ_DEPO: 'Merkez Depo',
  CIN_IADE_DEPO: 'Çin İade Deposu',
  ARIZALI_DEPO: 'Çin İade Deposu',
};

export const WAREHOUSE_DEPOT_NAMES = [
  'MERKEZ_DEPO',
  'CIN_IADE_DEPO',
  'ARIZALI_DEPO',
] as const;

export function depotLabel(name: string): string {
  return DEPOT_LABELS[name] ?? name;
}

export function isWarehouseDepot(name: string): boolean {
  return (WAREHOUSE_DEPOT_NAMES as readonly string[]).includes(name);
}
