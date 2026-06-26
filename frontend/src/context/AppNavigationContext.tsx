import { createContext, useContext } from 'react';
import type { NavigateFn } from '../lib/navigation';

type AppNavigationValue = {
  navigateTo: NavigateFn;
  navigateToCustomer: (customerId: number) => void;
  goBack: () => void;
};

export const AppNavigationContext = createContext<AppNavigationValue | null>(null);

export function useAppNavigation(): AppNavigationValue {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error('useAppNavigation App içinde kullanılmalıdır.');
  }
  return ctx;
}

export function useAppNavigationOptional(): AppNavigationValue | null {
  return useContext(AppNavigationContext);
}
