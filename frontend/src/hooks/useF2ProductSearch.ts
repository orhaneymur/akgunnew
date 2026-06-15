import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE, ensureArray } from '../lib/api';

export type F2ProductContext = 'sales' | 'purchase' | 'return';

export type F2Product = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  costPrice: number;
  costUsd?: number;
  priceTl: number;
  priceUsd: number;
  lastPartyPriceTl?: number | null;
  lastPartyPriceUsd?: number | null;
  lastSoldPrice?: number | null;
  lastSoldPriceUsd?: number | null;
};

type ProductsResponse = {
  success: boolean;
  data: F2Product[];
  totalCount: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 100;

export function useF2ProductSearch(options: {
  open: boolean;
  f2Trigger?: number;
  context: F2ProductContext;
  partyId?: number | null;
  exchangeRate: number;
}) {
  const { open, f2Trigger = 0, context, partyId, exchangeRate } = options;

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<F2Product[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const resetSearch = useCallback(() => {
    setSearchQuery('');
    setResults([]);
    setFocusedIndex(-1);
    setPage(1);
    setTotalCount(0);
    setHasMore(false);
  }, []);

  const openSearch = useCallback(() => {
    resetSearch();
  }, [resetSearch]);

  const closeSearch = useCallback(() => {
    resetSearch();
  }, [resetSearch]);

  useEffect(() => {
    if (f2Trigger > 0) {
      openSearch();
    }
  }, [f2Trigger, openSearch]);

  const fetchPage = useCallback(
    async (pageNumber: number, query: string, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params: Record<string, string> = {
          page: String(pageNumber),
          limit: String(PAGE_SIZE),
          context,
          exchangeRate: String(exchangeRate),
        };
        const trimmed = query.trim();
        if (trimmed) params.search = trimmed;
        if (partyId) params.customerId = String(partyId);

        const response = await axios.get<ProductsResponse>(`${API_BASE}/api/sales/products`, {
          params,
        });

        if (response.data.success) {
          const batch = ensureArray(response.data.data);
          setResults((prev) => (append ? [...prev, ...batch] : batch));
          setTotalCount(response.data.totalCount);
          setPage(response.data.page);
          setHasMore(response.data.page * response.data.limit < response.data.totalCount);
          setFocusedIndex((prev) => (append ? prev : batch.length > 0 ? 0 : -1));
        }
      } catch {
        if (!append) {
          setResults([]);
          setTotalCount(0);
          setHasMore(false);
          setFocusedIndex(-1);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [context, exchangeRate, partyId]
  );

  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = searchQuery.trim();

    debounceRef.current = setTimeout(() => {
      void fetchPage(1, trimmed, false);
    }, trimmed ? 250 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, searchQuery, partyId, fetchPage]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  const loadMore = useCallback(() => {
    if (!open || loading || loadingMore || !hasMore) return;
    void fetchPage(page + 1, searchQuery.trim(), true);
  }, [open, loading, loadingMore, hasMore, fetchPage, page, searchQuery]);

  const handleListScroll = useCallback(() => {
    const element = listRef.current;
    if (!element || loadingMore || !hasMore) return;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 48) {
      loadMore();
    }
  }, [loadMore, loadingMore, hasMore]);

  const navigateFocus = useCallback(
    (delta: number) => {
      setFocusedIndex((prev) => {
        if (results.length === 0) return -1;
        const current = prev < 0 ? 0 : prev;
        const next = Math.max(0, Math.min(current + delta, results.length - 1));
        if (next >= results.length - 10 && hasMore && !loadingMore && !loading) {
          void fetchPage(page + 1, searchQuery.trim(), true);
        }
        return next;
      });
    },
    [results.length, hasMore, loadingMore, loading, page, searchQuery, fetchPage]
  );

  return {
    searchQuery,
    setSearchQuery,
    results,
    focusedIndex,
    setFocusedIndex,
    loading,
    loadingMore,
    totalCount,
    hasMore,
    searchInputRef,
    listRef,
    openSearch,
    closeSearch,
    handleListScroll,
    navigateFocus,
    resetSearch,
  };
}
