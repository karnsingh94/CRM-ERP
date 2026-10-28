'use client';

import PurchaseModule from './PurchaseModule';

export default function GrnModule({ activeCompany, showToast, initialSubTab }) {
  return (
    <PurchaseModule
      activeCompany={activeCompany}
      showToast={showToast}
      initialSubTab={initialSubTab || 'receipts'}
    />
  );
}
