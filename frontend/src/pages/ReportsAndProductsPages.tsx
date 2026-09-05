import React from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { useDealStore } from '../hooks/useDealStore';

export { ReportsPage } from './ReportsPage';

export const ProductsPage: React.FC = () => {
  const { products } = useDealStore();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Product Catalog"
        description="Products, pricing tiers, and category discount ceilings that govern commercial deal creation."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Products' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <Card key={p.id} title={p.name} subtitle={p.sku} padding="md">
            <div className="text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="font-semibold text-slate-800">{p.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Base Price:</span>
                <span className="font-mono font-semibold text-slate-900">${(p.basePrice ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount Ceiling:</span>
                <span className="font-mono text-emerald-700 font-bold">{p.discountCeilingPercent}%</span>
              </div>
              <p className="text-slate-500 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                {p.description}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
