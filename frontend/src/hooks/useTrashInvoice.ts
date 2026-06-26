import { useCallback, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/api';

export function useTrashInvoice(onDone?: () => void) {
  const [trashing, setTrashing] = useState(false);

  const trashInvoice = useCallback(
    async (invoiceId: number, invoiceNo: string) => {
      const confirmed = window.confirm(
        `"${invoiceNo}" fişini silinen işlemlere taşımak istiyor musunuz?\n\nStok ve cari/kasa etkileri geri alınır. Kalıcı silmek için Silinen İşlemler ekranını kullanın.`
      );
      if (!confirmed) return false;

      setTrashing(true);
      try {
        const response = await axios.post<{
          success: boolean;
          message?: string;
        }>(`${API_BASE}/api/sales/invoices/${invoiceId}/trash`);
        if (!response.data.success) {
          throw new Error(response.data.message ?? 'Fiş silinemedi.');
        }
        onDone?.();
        return true;
      } catch (error) {
        const message =
          axios.isAxiosError(error) && error.response?.data?.message
            ? String(error.response.data.message)
            : error instanceof Error
              ? error.message
              : 'Fiş silinemedi.';
        window.alert(message);
        return false;
      } finally {
        setTrashing(false);
      }
    },
    [onDone]
  );

  return { trashInvoice, trashing };
}
