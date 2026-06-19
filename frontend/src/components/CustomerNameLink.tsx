import type { ReactNode } from 'react';
import { useAppNavigationOptional } from '../context/AppNavigationContext';

type CustomerNameLinkProps = {
  customerId: number;
  children: ReactNode;
  className?: string;
  stopPropagation?: boolean;
};

export default function CustomerNameLink({
  customerId,
  children,
  className = '',
  stopPropagation = false,
}: CustomerNameLinkProps) {
  const navigation = useAppNavigationOptional();

  if (!navigation || customerId <= 0) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation();
        navigation.navigateToCustomer(customerId);
      }}
      className={`text-left font-medium text-sky-700 hover:text-sky-900 hover:underline ${className}`}
      title="Müşteri kartını aç"
    >
      {children}
    </button>
  );
}
