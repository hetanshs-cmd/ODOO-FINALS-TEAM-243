import React, { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { productService, adminService, isForbiddenError } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiProduct } from '../services/apiTypes';

export { ReportsPage } from './ReportsPage';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setForbidden(false);
    setError(null);
    Promise.all([productService.getAll(), adminService.productCategories.list()])
      .then(([productList, categories]) => {
        if (cancelled) return;
        setProducts(productList);
        setCategoryNames(Object.fromEntries(categories.map((c) => [c.id, c.name])));
      })
      .catch((err) => {
        if (cancelled) return;
        if (isForbiddenError(err)) {
          setForbidden(true);
        } else {
          setError(err instanceof ApiError ? err.message : 'Failed to load products.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Product Catalog"
        description="Products and pricing that govern commercial deal creation."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Products' }]}
      />

      {loading ? (
        <p className="text-xs text-slate-500">Loading products…</p>
      ) : forbidden ? (
        <p className="text-xs text-slate-500">
          Your role doesn't have access to the product catalog. Contact an administrator.
        </p>
      ) : error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Card key={p.id} title={p.name} subtitle={p.sku ?? undefined} padding="md">
              <div className="text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Category:</span>
                  <span className="font-semibold text-slate-800">
                    {(p.category_id && categoryNames[p.category_id]) || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-semibold text-slate-800">
                    {String(p.product_type ?? '—')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Base Price:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{Number(p.base_price ?? 0).toLocaleString()}
                  </span>
                </div>
                {typeof p.description === 'string' && p.description && (
                  <p className="text-slate-500 pt-2 border-t border-slate-100 text-[11px] leading-relaxed">
                    {p.description}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
