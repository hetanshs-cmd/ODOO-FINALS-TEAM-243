/**
 * DealFlow360 — New Quotation (real backend)
 *
 * The shared QuotationDetailPage is still wired to the in-memory mock
 * dealStore, so quotations "created" there never reach the API and never
 * show up in the (API-backed) QuotationsListPage. This page is a small,
 * self-contained create flow that talks to the real endpoints:
 *   POST /quotations            (header)
 *   POST /quotations/:id/items  (each line)
 *   POST /quotations/:id/submit (Create & Confirm only)
 * so a freshly created quotation is persisted and appears at the top of
 * the list immediately (the list sorts newest-first).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Send } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { useCustomers } from '../hooks/useCustomers';
import { productService, quotationService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiProduct } from '../services/apiTypes';
import { formatCurrency } from '../utils/formatters';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD'];

interface DraftLine {
  key: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

function newLine(): DraftLine {
  return {
    key: `L-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    product_id: '',
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_percent: 0,
    billing_type: 'ONE_TIME',
  };
}

// productService.getAll() returns the paginated envelope ({ items, ... })
// despite its array-shaped type; unwrap defensively either way.
function unwrapProducts(res: unknown): ApiProduct[] {
  if (Array.isArray(res)) return res as ApiProduct[];
  if (res && Array.isArray((res as { items?: unknown }).items)) {
    return (res as { items: ApiProduct[] }).items;
  }
  return [];
}

export const NewQuotationPage: React.FC = () => {
  const navigate = useNavigate();
  const { customers, loading: customersLoading } = useCustomers();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [productsBlocked, setProductsBlocked] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [validUntil, setValidUntil] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    productService
      .getAll()
      .then((res) => {
        if (!cancelled) setProducts(unwrapProducts(res as unknown));
      })
      .catch(() => {
        // Product listing is ADMIN-gated; non-admins get a 403. Header-only
        // draft creation still works — line items can be added later.
        if (!cancelled) setProductsBlocked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  const productOptions = useMemo(
    () => [
      { value: '', label: 'Select a product…' },
      ...products.map((p) => ({ value: p.id, label: p.sku ? `${p.name} (${p.sku})` : p.name })),
    ],
    [products],
  );

  const estimatedTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const gross = l.quantity * l.unit_price;
        const taxable = gross - (gross * l.discount_percent) / 100;
        return sum + taxable + (taxable * l.tax_percent) / 100;
      }, 0),
    [lines],
  );

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const handleProductPick = (key: string, productId: string) => {
    const p = productId ? productsById.get(productId) : undefined;
    const rawPrice = p ? (p.price ?? p.base_price) : undefined;
    const price = rawPrice !== undefined ? Number(rawPrice) || 0 : 0;
    const billingType =
      (p?.['product_type'] as string) === 'RECURRING' ? 'RECURRING' : 'ONE_TIME';
    updateLine(key, { product_id: productId, unit_price: price, billing_type: billingType });
  };

  const validLines = lines.filter((l) => l.product_id && l.quantity > 0);
  const canSubmit = !!customerId && !submitting;

  const persist = async (confirm: boolean) => {
    if (!customerId) {
      toast.warning('Customer required', 'Pick a customer before saving.');
      return;
    }
    if (confirm && validLines.length === 0) {
      toast.warning('Add a line item', 'A quotation needs at least one line item to confirm.');
      return;
    }

    setSubmitting(true);
    let created;
    try {
      created = await quotationService.create({
        customer_id: customerId,
        currency,
        valid_until: validUntil || null,
      });
    } catch (err) {
      setSubmitting(false);
      toast.error('Could not create quotation', err instanceof ApiError ? err.message : 'Unknown error.');
      return;
    }

    // Header is saved; from here failures leave a usable DRAFT behind, so we
    // surface the problem but still route to the list rather than risk a
    // double-submit on retry.
    try {
      for (const l of validLines) {
        await quotationService.addItem(created.id, {
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_percent: l.discount_percent || undefined,
          tax_percent: l.tax_percent || undefined,
          billing_type: l.billing_type,
        });
      }

      if (confirm) {
        await quotationService.submit(created.id);
        toast.success('Quotation confirmed', `${created.quotation_number} submitted for governance review.`);
      } else {
        toast.success('Draft saved', `${created.quotation_number} created.`);
      }
    } catch (err) {
      toast.warning(
        `Saved as draft ${created.quotation_number}`,
        err instanceof ApiError ? err.message : 'Some steps did not complete.',
      );
    }

    setSubmitting(false);
    navigate('/quotations');
  };

  return (
    <div className="space-y-3.5">
      <PageHeader
        title="New Quotation"
        description="Create a quotation against the operational database. It appears at the top of the quotations list right away."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Quotations', href: '/quotations' }, { label: 'New' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => navigate('/quotations')}
          >
            Back to List
          </Button>
        }
      />

      <div className="bg-white rounded-md border border-[#E5E7EB] shadow-2xs p-4 space-y-4 max-w-3xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label="Customer"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            options={[
              { value: '', label: customersLoading ? 'Loading…' : 'Select a customer…' },
              ...customers.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Valid Until"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <div className="border-t border-[#F3F4F6] pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#111827]">Line Items</h3>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              disabled={productsBlocked}
              onClick={() => setLines((prev) => [...prev, newLine()])}
            >
              Add Line
            </Button>
          </div>

          {productsBlocked ? (
            <p className="text-xs text-[#6B7280]">
              Product catalog is not available for your role — save the draft and add line items later.
            </p>
          ) : lines.length === 0 ? (
            <p className="text-xs text-[#6B7280]">No line items yet. A draft can be saved without them.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="text-[11px] text-[#6B7280] uppercase tracking-wider text-left">
                    <th className="py-1.5 pr-2 font-semibold">Product</th>
                    <th className="py-1.5 px-2 font-semibold w-16">Qty</th>
                    <th className="py-1.5 px-2 font-semibold w-28">Unit Price</th>
                    <th className="py-1.5 px-2 font-semibold w-20">Disc %</th>
                    <th className="py-1.5 px-2 font-semibold w-20">Tax %</th>
                    <th className="py-1.5 px-2 font-semibold w-28">Billing</th>
                    <th className="py-1.5 pl-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key} className="border-t border-[#F3F4F6]">
                      <td className="py-1.5 pr-2">
                        <Select
                          options={productOptions}
                          value={l.product_id}
                          onChange={(e) => handleProductPick(l.key, e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unit_price}
                          onChange={(e) => updateLine(l.key, { unit_price: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={l.discount_percent}
                          onChange={(e) =>
                            updateLine(l.key, { discount_percent: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={l.tax_percent}
                          onChange={(e) => updateLine(l.key, { tax_percent: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <Select
                          options={[
                            { value: 'ONE_TIME', label: 'One-time' },
                            { value: 'RECURRING', label: 'Recurring' },
                          ]}
                          value={l.billing_type}
                          onChange={(e) =>
                            updateLine(l.key, { billing_type: e.target.value as DraftLine['billing_type'] })
                          }
                        />
                      </td>
                      <td className="py-1.5 pl-2 text-right">
                        <button
                          type="button"
                          aria-label="Remove line"
                          onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-[#F3F4F6] pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#4B5563]">
            Estimated total:{' '}
            <strong className="font-mono text-[#111827]">{formatCurrency(estimatedTotal)}</strong>
            <span className="text-[#9CA3AF]"> — final figures are computed by the backend</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Save className="w-3.5 h-3.5" />}
              isLoading={submitting}
              disabled={!canSubmit}
              onClick={() => persist(false)}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              isLoading={submitting}
              disabled={!canSubmit || validLines.length === 0}
              onClick={() => persist(true)}
            >
              Create &amp; Confirm
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
