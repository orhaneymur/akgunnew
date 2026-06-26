import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../lib/api';
import { useAppNavigationOptional } from '../context/AppNavigationContext';
import type { NavigateOptions, PageId } from '../lib/navigation';

type EditingInvoice = { id: number; type: string };

export function useInvoiceEditorFromUrl(
  pageId: PageId,
  routeOptions: NavigateOptions | undefined,
  initialEditInvoiceId?: number
) {
  const navigation = useAppNavigationOptional();
  const [editingInvoice, setEditingInvoice] = useState<EditingInvoice | null>(null);

  useEffect(() => {
    if (!initialEditInvoiceId) {
      setEditingInvoice(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await axios.get<{
          success: boolean;
          data: { id: number; type: string };
        }>(`${API_BASE}/api/sales/invoices/${initialEditInvoiceId}`);
        if (cancelled || !response.data.success) return;
        const { id, type } = response.data.data;
        if (['SATIS', 'ALIS', 'IADE'].includes(type)) {
          setEditingInvoice({ id, type });
        } else {
          setEditingInvoice(null);
        }
      } catch {
        if (!cancelled) setEditingInvoice(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialEditInvoiceId]);

  const openEditor = useCallback(
    (inv: { id: number; type: string }) => {
      if (!['SATIS', 'ALIS', 'IADE'].includes(inv.type)) {
        return false;
      }
      setEditingInvoice({ id: inv.id, type: inv.type });
      navigation?.navigateTo(pageId, {
        ...routeOptions,
        editInvoiceId: inv.id,
      });
      return true;
    },
    [navigation, pageId, routeOptions]
  );

  const closeEditor = useCallback(() => {
    if (navigation) {
      navigation.goBack();
    } else {
      setEditingInvoice(null);
    }
  }, [navigation]);

  return { editingInvoice, openEditor, closeEditor, setEditingInvoice };
}
