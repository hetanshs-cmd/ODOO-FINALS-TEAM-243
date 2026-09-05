import React, { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import { useDealStore } from '../hooks/useDealStore';
import { Quotation, WarehouseSplitResult, WarehouseSplitAllocation } from '../types';
import {
  computeWarehouseSplit,
  getQuotationFulfillmentStatus,
  detectConsolidationOpportunity,
  getWarehouseAvailableStock,
} from '../domain/fulfillment';
import { canUserPerformAction } from '../domain/permissions';
import { WarehouseStockTable } from '../components/domain/WarehouseStockTable';
import { FulfillmentOverrideModal } from '../components/domain/FulfillmentOverrideModal';
import {
  ArrowLeft,
  Truck,
  Package,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Sliders,
  DollarSign,
  History,
  Building2,
  PlusCircle,
  ShieldAlert,
} from 'lucide-react';
import { toast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { useSalesOrder } from '../hooks/useSalesOrders';
import { useBackorders } from '../hooks/useBackorders';
import { fulfillmentService, backorderService, salesOrderService } from '../services';
import { ApiFulfillment } from '../services/apiTypes';
import { ApiError } from '../services/httpClient';

// ============================================================================
// SCREEN 7: FULFILLMENT & STOCK LIST PAGE
// ============================================================================

export const FulfillmentListPage: React.FC = () => {
  const { quotations, warehouses, products, activeFulfillmentSplits, restockWarehouse } = useDealStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'orders' | 'stock'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Orders eligible for fulfillment: Approved, Confirmed, Fulfillment, Completed
  const eligibleQuotations = useMemo(() => {
    return quotations.filter((q) =>
      ['Approved', 'Confirmed', 'Fulfillment', 'Completed'].includes(q.stage)
    );
  }, [quotations]);

  // Enrich quotations with canonical fulfillment status from domain engine
  const enrichedOrders = useMemo(() => {
    return eligibleQuotations.map((q) => {
      const savedSplit = activeFulfillmentSplits[q.id];
      const fulfillmentInfo = getQuotationFulfillmentStatus(q, savedSplit, warehouses);
      const physicalLines = q.lines.filter((l) => l.category === 'Hardware' && !l.isSubscription);
      const physicalQty = physicalLines.reduce((sum, l) => sum + l.quantity, 0);

      return {
        quotation: q,
        savedSplit,
        fulfillmentInfo,
        physicalLinesCount: physicalLines.length,
        physicalQty,
      };
    });
  }, [eligibleQuotations, activeFulfillmentSplits, warehouses]);

  // Filter based on search and status
  const filteredOrders = useMemo(() => {
    return enrichedOrders.filter(({ quotation: q, fulfillmentInfo }) => {
      // Status filter
      if (statusFilter !== 'all' && fulfillmentInfo.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = q.code.toLowerCase().includes(query);
        const matchesCustomer = q.customerName.toLowerCase().includes(query);
        const matchesRep = q.repName?.toLowerCase().includes(query) || false;
        const matchesSku = q.lines.some((l) => l.productId.toLowerCase().includes(query));
        if (!matchesCode && !matchesCustomer && !matchesRep && !matchesSku) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedOrders, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Title */}
      <PageHeader
        title="Fulfillment & Stock Management"
        description="Operational order routing, multi-facility warehouse stock matrix, and automated backorder management."
        breadcrumbs={[{ label: 'Workspace' }, { label: 'Fulfillment & Stock' }]}
      />

      {/* Main Tabs Strip (Odoo ERP Style) */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'orders'
              ? 'border-[#714B67] text-[#714B67] bg-purple-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Orders Awaiting Fulfillment
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'orders'
                ? 'bg-[#714B67] text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {enrichedOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'stock'
              ? 'border-[#714B67] text-[#714B67] bg-purple-50/40'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Warehouse Stock Ledger
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'stock'
                ? 'bg-[#714B67] text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {warehouses.length} Facilities
          </span>
        </button>
      </div>

      {/* TAB 1: ORDERS AWAITING FULFILLMENT */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Controls Bar: Filter Chips & Search */}
          <div className="bg-white p-3 border border-slate-200 rounded-sm shadow-2xs flex flex-wrap items-center justify-between gap-3">
            {/* Quick Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium mr-1">Status:</span>
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'ready', label: 'Ready' },
                { id: 'allocated', label: 'Allocated' },
                { id: 'backordered', label: 'Backordered' },
                { id: 'shipped', label: 'Shipped' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors font-medium cursor-pointer ${
                    statusFilter === chip.id
                      ? 'bg-[#714B67] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order ID, customer, rep, SKU..."
                className="text-xs border border-slate-300 rounded pl-8 pr-3 py-1.5 bg-white text-slate-800 focus:ring-1 focus:ring-[#714B67] outline-none w-64"
              />
            </div>
          </div>

          {/* Orders Dense DataTable */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3.5">Order / Quote ID</th>
                  <th className="py-2.5 px-3.5">Customer & Tier</th>
                  <th className="py-2.5 px-3.5">Sales Rep</th>
                  <th className="py-2.5 px-3.5">Physical Demand</th>
                  <th className="py-2.5 px-3.5">Fulfillment Status</th>
                  <th className="py-2.5 px-3.5">Fulfilling Facilities</th>
                  <th className="py-2.5 px-3.5 text-center">Shipments</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-500 italic">
                      No approved quotations match the current fulfillment filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(({ quotation: q, fulfillmentInfo, physicalLinesCount, physicalQty }) => {
                    const hasBackorder = fulfillmentInfo.backorderCount > 0;
                    return (
                      <tr
                        key={q.id}
                        onClick={() => navigate(`/fulfillment/${q.id}`)}
                        className="hover:bg-purple-50/30 transition-colors cursor-pointer"
                      >
                        {/* Order Code */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-blue-900">
                          {q.code}
                        </td>

                        {/* Customer */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900">{q.customerName}</div>
                          <span className="inline-block text-[10px] text-slate-500 uppercase font-mono">
                            {q.customerTier || 'Standard'} Tier
                          </span>
                        </td>

                        {/* Sales Rep */}
                        <td className="py-2.5 px-3.5 text-slate-600">
                          {q.repName || 'Alex Rivera'}
                        </td>

                        {/* Physical Items */}
                        <td className="py-2.5 px-3.5">
                          {physicalLinesCount > 0 ? (
                            <span className="font-mono text-slate-800">
                              <strong>{physicalQty}</strong> units ({physicalLinesCount} SKU)
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Digital / Services</span>
                          )}
                        </td>

                        {/* Fulfillment Status Badge */}
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                              fulfillmentInfo.variant === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : fulfillmentInfo.variant === 'warning'
                                ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
                                : fulfillmentInfo.variant === 'info'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {hasBackorder && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            {fulfillmentInfo.status === 'Allocated' && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {fulfillmentInfo.label}
                          </span>
                        </td>

                        {/* Allocated Facilities */}
                        <td className="py-2.5 px-3.5">
                          {fulfillmentInfo.warehousesUsed.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {fulfillmentInfo.warehousesUsed.map((wName, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono border border-slate-200"
                                >
                                  {wName.replace(' Distribution Center', '').replace(' Logistics Hub', '')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        {/* Shipments Count */}
                        <td className="py-2.5 px-3.5 text-center font-mono text-slate-700">
                          {fulfillmentInfo.warehousesUsed.length > 0
                            ? `${fulfillmentInfo.warehousesUsed.length} Shipments`
                            : '—'}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/fulfillment/${q.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#714B67] hover:text-[#5E3E56] hover:underline"
                          >
                            Route & Allocate →
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL WAREHOUSE STOCK MATRIX */}
      {activeTab === 'stock' && (
        <WarehouseStockTable
          warehouses={warehouses}
          products={products}
          onRestock={restockWarehouse}
        />
      )}
    </div>
  );
};

// ============================================================================
// SCREEN 8: FULFILLMENT DETAIL PAGE
// ============================================================================

export const FulfillmentDetailPage: React.FC = () => {
  // NOTE: like ApprovalDetailPage, the (not-yet-migrated) FulfillmentListPage
  // above navigates here with a mock quotation id (`/fulfillment/${q.id}`).
  // The real fulfillment flow is keyed on a SalesOrder, so this page resolves
  // the SalesOrder by its quotation_id field rather than requiring a route
  // change to the still-mock list page.
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [salesOrderId, setSalesOrderId] = useState<string | undefined>(undefined);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setResolving(true);
    salesOrderService
      .getAll({ quotation_id: id })
      .then((orders) => {
        if (cancelled) return;
        if (orders.length > 0) {
          setSalesOrderId(orders[0].id);
        } else {
          // Fall back to treating the route id itself as a sales order id,
          // in case a caller links here directly with one.
          setSalesOrderId(id);
        }
      })
      .catch(() => {
        if (!cancelled) setSalesOrderId(id);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { salesOrder, loading: soLoading, error: soError, refetch: refetchSalesOrder } = useSalesOrder(salesOrderId);
  const { backorders, loading: boLoading, refetch: refetchBackorders } = useBackorders(
    salesOrder ? { sales_order_id: salesOrder.id } : undefined
  );

  const [fulfillments, setFulfillments] = useState<ApiFulfillment[]>([]);
  const [fulfillmentsLoading, setFulfillmentsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [overrideModalFor, setOverrideModalFor] = useState<ApiFulfillment | null>(null);
  const [overrideText, setOverrideText] = useState('');

  const loadFulfillments = React.useCallback(() => {
    if (!salesOrder) return;
    setFulfillmentsLoading(true);
    fulfillmentService
      .listForSalesOrder(salesOrder.id)
      .then(setFulfillments)
      .catch(() => setFulfillments([]))
      .finally(() => setFulfillmentsLoading(false));
  }, [salesOrder]);

  React.useEffect(() => {
    loadFulfillments();
  }, [loadFulfillments]);

  const handleSuggest = async () => {
    if (!salesOrder) return;
    setIsActing(true);
    setActionError(null);
    try {
      await fulfillmentService.suggestFulfillment(salesOrder.id);
      toast.success('Fulfillment Suggested', 'A recommended warehouse allocation has been generated.');
      loadFulfillments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to suggest fulfillment.';
      setActionError(msg);
      toast.error('Allocation Error', msg);
    } finally {
      setIsActing(false);
    }
  };

  const handleAcceptSplit = async (fulfillmentId: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await fulfillmentService.acceptSplit(fulfillmentId);
      toast.success('Fulfillment Plan Confirmed', 'The recommended split has been accepted.');
      loadFulfillments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to accept warehouse split.';
      setActionError(msg);
      toast.error('Allocation Error', msg);
    } finally {
      setIsActing(false);
    }
  };

  const handleShip = async (fulfillmentId: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await fulfillmentService.ship(fulfillmentId);
      toast.success('Shipped', 'The fulfillment has been marked as shipped.');
      loadFulfillments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to ship fulfillment.';
      setActionError(msg);
      toast.error('Shipping Error', msg);
    } finally {
      setIsActing(false);
    }
  };

  const handleOverrideSave = async () => {
    if (!overrideModalFor) return;
    let allocations: unknown[];
    try {
      allocations = overrideText.trim() ? JSON.parse(overrideText) : [];
      if (!Array.isArray(allocations)) throw new Error('not an array');
    } catch {
      setActionError('Override allocations must be valid JSON array, e.g. [{"item_id":"...","warehouse_id":"...","quantity":5}]');
      return;
    }
    setIsActing(true);
    setActionError(null);
    try {
      await fulfillmentService.overrideSplit(overrideModalFor.id, allocations);
      toast.success('Split Overridden', 'The manual allocation override has been saved.');
      setOverrideModalFor(null);
      setOverrideText('');
      loadFulfillments();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to override warehouse split.';
      setActionError(msg);
      toast.error('Override Error', msg);
    } finally {
      setIsActing(false);
    }
  };

  const handleConsolidate = async (backorderId: string) => {
    setIsActing(true);
    setActionError(null);
    try {
      await backorderService.consolidate(backorderId);
      toast.success('Backorder Consolidated', 'The backorder has been consolidated against available stock.');
      await Promise.all([refetchBackorders(), refetchSalesOrder()]);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to consolidate backorder.';
      setActionError(msg);
      toast.error('Consolidation Error', msg);
    } finally {
      setIsActing(false);
    }
  };

  if (resolving || soLoading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading fulfillment record…</div>;
  }

  if (soError || !salesOrder) {
    return (
      <div className="p-8 text-center space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Sales Order Not Found</h3>
        <p className="text-xs text-slate-500">
          No sales order could be resolved for quotation/order id <strong>{id}</strong>
          {resolveError ? ` (${resolveError})` : ''}. A quotation must be converted to a sales order before fulfillment can be planned.
        </p>
        <Link
          to="/fulfillment"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-[#714B67] text-white"
        >
          <ArrowLeft className="w-3 h-3" /> Return to Fulfillment Queue
        </Link>
      </div>
    );
  }

  const totalPhysicalUnits = (salesOrder.items || []).reduce((sum, l) => sum + Number(l.quantity), 0);
  const totalFulfilled = (salesOrder.items || []).reduce((sum, l) => sum + Number(l.fulfilled_quantity || 0), 0);
  const totalBackordered = (salesOrder.items || []).reduce((sum, l) => sum + Number(l.backordered_quantity || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top Header Strip */}
      <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/fulfillment')}
              className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
              title="Return to Fulfillment List"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-slate-900">{salesOrder.order_number}</span>
                <span className="text-slate-400">/</span>
                {/* TODO: resolve customer display name once a customers directory hook lands. */}
                <span className="text-sm font-semibold text-slate-800 font-mono">{salesOrder.customer_id}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Order Date: <strong className="text-slate-700">{new Date(salesOrder.order_date).toLocaleDateString()}</strong>
              </div>
            </div>
          </div>
          <StatusBadge status={salesOrder.status} size="md" />
        </div>

        {/* KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Ordered Units</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{totalPhysicalUnits}</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Fulfilled Units</div>
            <div className="text-sm font-bold text-emerald-700 mt-0.5">{totalFulfilled} / {totalPhysicalUnits}</div>
          </div>
          <div className={`p-2.5 rounded border ${totalBackordered > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-[10px] uppercase ${totalBackordered > 0 ? 'text-amber-800' : 'text-slate-500'}`}>Backordered Units</div>
            <div className={`text-sm font-bold mt-0.5 ${totalBackordered > 0 ? 'text-amber-900 font-black' : 'text-slate-400'}`}>{totalBackordered}</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Grand Total</div>
            <div className="text-sm font-bold text-blue-900 mt-0.5">${Number(salesOrder.grand_total).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-5">
          {/* Fulfillments (each row = one warehouse allocation, the real
              backend's analog of the mock's multi-facility split table) */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#714B67]" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Warehouse Fulfillments</h3>
              </div>
              <button
                type="button"
                onClick={handleSuggest}
                disabled={isActing}
                className="px-3 py-1.5 text-xs font-bold rounded bg-[#714B67] hover:bg-[#5E3E56] text-white shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Suggest Fulfillment
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-800">{actionError}</div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5">Warehouse</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Items</th>
                    <th className="py-2.5 px-3.5">Scheduled</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-normal">
                  {fulfillmentsLoading ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading…</td></tr>
                  ) : fulfillments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        No fulfillments yet. Click &quot;Suggest Fulfillment&quot; to generate a recommended allocation.
                      </td>
                    </tr>
                  ) : (
                    fulfillments.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900">{f.warehouse_id}</td>
                        <td className="py-2.5 px-3.5"><StatusBadge status={f.status} size="sm" /></td>
                        <td className="py-2.5 px-3.5 text-right font-mono">{(f.items || []).length}</td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-600">
                          {f.scheduled_date ? new Date(f.scheduled_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAcceptSplit(f.id)}
                              disabled={isActing || f.status !== 'PENDING'}
                              className="px-2 py-1 text-[11px] font-semibold rounded border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOverrideModalFor(f);
                                setOverrideText('');
                                setActionError(null);
                              }}
                              disabled={isActing}
                              className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Override
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShip(f.id)}
                              disabled={isActing || f.status === 'SHIPPED' || f.status === 'DELIVERED'}
                              className="px-2 py-1 text-[11px] font-semibold rounded bg-[#714B67] text-white hover:bg-[#5E3E56] disabled:opacity-40"
                            >
                              Ship
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Line Items */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#714B67]" />
              Order Line Items
            </h4>
            <div className="border border-slate-200 rounded-sm overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Product ID</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                    <th className="py-2 px-3 text-right">Fulfilled</th>
                    <th className="py-2 px-3 text-right">Backordered</th>
                    <th className="py-2 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(salesOrder.items || []).map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-bold text-slate-900">{line.product_id}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{line.quantity}</td>
                      <td className="py-2 px-3 text-right text-emerald-700">{line.fulfilled_quantity}</td>
                      <td className="py-2 px-3 text-right text-amber-700">{line.backordered_quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-900">${Number(line.total).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Order Commercial Context
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer ID:</span>
                <span className="font-mono font-semibold text-slate-900">{salesOrder.customer_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quotation ID:</span>
                <span className="font-mono text-slate-700">{salesOrder.quotation_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Grand Total:</span>
                <span className="font-mono font-bold text-blue-900">${Number(salesOrder.grand_total).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <StatusBadge status={salesOrder.status} size="sm" />
              </div>
            </div>
          </div>

          {/* Backorders (new — GET /backorders + consolidate) */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Backorders
            </h4>
            {boLoading ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : backorders.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No open backorders for this order.</p>
            ) : (
              <div className="space-y-2 text-xs">
                {backorders.map((b) => (
                  <div key={b.id} className="border border-amber-200 bg-amber-50/50 rounded p-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-amber-950">{b.quantity} units — {b.status}</div>
                      {b.expected_date && (
                        <div className="text-[10px] text-amber-800">Expected: {new Date(b.expected_date).toLocaleDateString()}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConsolidate(b.id)}
                      disabled={isActing || b.status !== 'OPEN'}
                      className="px-2.5 py-1 text-[11px] font-bold rounded bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40"
                    >
                      Consolidate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Override Modal — plain JSON input against the real
          override-split endpoint. The mock-typed FulfillmentOverrideModal
          component (rich per-allocation UI) is coupled to the mock
          Quotation/Warehouse shapes and isn't reused here; a proper
          allocation-editing UI can replace this once the backend documents
          a stable allocations schema. */}
      <Modal
        isOpen={!!overrideModalFor}
        onClose={() => setOverrideModalFor(null)}
        title={`Override Split — ${overrideModalFor?.warehouse_id || ''}`}
        description="Provide the manual allocation override as JSON (advanced)."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOverrideModalFor(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleOverrideSave} disabled={isActing}>Save Override</Button>
          </div>
        }
      >
        <div className="space-y-2 text-xs">
          {actionError && <div className="p-2 bg-rose-50 border border-rose-200 rounded text-rose-800">{actionError}</div>}
          <textarea
            value={overrideText}
            onChange={(e) => setOverrideText(e.target.value)}
            placeholder='[{"item_id":"...","warehouse_id":"...","quantity":5}]'
            rows={6}
            className="w-full p-2.5 border border-slate-300 rounded font-mono text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#714B67]"
          />
        </div>
      </Modal>
    </div>
  );
};
