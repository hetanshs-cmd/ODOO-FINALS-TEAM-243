import React, { useState, useMemo, useEffect } from 'react';
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
import { useSalesOrders } from '../hooks/useSalesOrders';
import { useCustomers } from '../hooks/useCustomers';
import { useUsers } from '../hooks/useUsers';
import { warehouseService, productService } from '../services';
import { ApiWarehouse, ApiProduct } from '../services/apiTypes';
import { SalesOrder, SalesOrderStatus } from '../types';

// ============================================================================
// SCREEN 7: FULFILLMENT & STOCK LIST PAGE
// ============================================================================

// Real sales orders are a distinct entity from mock Quotations (see
// SalesOrder in types/index.ts); this list is now driven by the real
// GET /sales-orders endpoint via useSalesOrders instead of the mock
// quotation-stage filter.
const NON_CANCELLED_STATUSES: SalesOrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
];

export const FulfillmentListPage: React.FC = () => {
  const { salesOrders, loading } = useSalesOrders();
  const { customers } = useCustomers();
  const { users } = useUsers();
  const navigate = useNavigate();

  // Local fetch for warehouses/products (admin-gated resources; no
  // dedicated resource hook was in this migration's scope). Restock is
  // handled entirely inside the Stock tab below since the real API has no
  // restock endpoint — see the TODO there.
  const [warehouses, setWarehouses] = useState<ApiWarehouse[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  useEffect(() => {
    warehouseService.getAll().then((data) => setWarehouses(data as unknown as ApiWarehouse[])).catch(() => setWarehouses([]));
    productService.getAll().then((data) => setProducts(data as unknown as ApiProduct[])).catch(() => setProducts([]));
  }, []);

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const getCustomerName = (id: string) => customersById.get(id)?.name || id;
  const getRepName = (id: string) => usersById.get(id)?.name || 'Unassigned';

  const [activeTab, setActiveTab] = useState<'orders' | 'stock'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Orders eligible for fulfillment: everything except CANCELLED.
  const eligibleOrders = useMemo(
    () => salesOrders.filter((o) => NON_CANCELLED_STATUSES.includes(o.status)),
    [salesOrders]
  );

  // Filter based on search and status
  const filteredOrders = useMemo(() => {
    return eligibleOrders.filter((o) => {
      // Status filter
      if (statusFilter !== 'all' && o.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = o.order_number.toLowerCase().includes(query);
        const matchesCustomer = getCustomerName(o.customer_id).toLowerCase().includes(query);
        const matchesRep = getRepName(o.sales_rep_id).toLowerCase().includes(query);
        if (!matchesCode && !matchesCustomer && !matchesRep) {
          return false;
        }
      }

      return true;
    });
  }, [eligibleOrders, statusFilter, searchQuery, customersById, usersById]);

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
            {eligibleOrders.length}
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
                { id: 'pending', label: 'Pending' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'processing', label: 'Processing' },
                { id: 'partially_fulfilled', label: 'Partially Fulfilled' },
                { id: 'fulfilled', label: 'Fulfilled' },
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
                  <th className="py-2.5 px-3.5">Order Number</th>
                  <th className="py-2.5 px-3.5">Customer</th>
                  <th className="py-2.5 px-3.5">Sales Rep</th>
                  <th className="py-2.5 px-3.5 text-right">Order Value</th>
                  <th className="py-2.5 px-3.5">Fulfillment Status</th>
                  <th className="py-2.5 px-3.5">Order Date</th>
                  <th className="py-2.5 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-normal">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 italic">
                      Loading sales orders…
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-500 italic">
                      No sales orders match the current fulfillment filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const isBackordered = o.status === 'PARTIALLY_FULFILLED';
                    const isFulfilled = o.status === 'FULFILLED';
                    return (
                      <tr
                        key={o.id}
                        onClick={() => navigate(`/fulfillment/${o.id}`)}
                        className="hover:bg-purple-50/30 transition-colors cursor-pointer"
                      >
                        {/* Order Number */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-blue-900">
                          {o.order_number}
                        </td>

                        {/* Customer */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900">{getCustomerName(o.customer_id)}</div>
                        </td>

                        {/* Sales Rep */}
                        <td className="py-2.5 px-3.5 text-slate-600">
                          {getRepName(o.sales_rep_id)}
                        </td>

                        {/* Order Value */}
                        <td className="py-2.5 px-3.5 text-right font-mono text-slate-800">
                          ${(parseFloat(o.grand_total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Fulfillment Status Badge — driven directly by the
                            real SalesOrderStatus; per-facility split/backorder
                            detail requires a per-order fulfillments fetch,
                            left for the detail view (see TODO there). */}
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                              isFulfilled
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isBackordered
                                ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
                                : o.status === 'PROCESSING'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isBackordered && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                            {isFulfilled && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Order Date */}
                        <td className="py-2.5 px-3.5 text-slate-500 font-mono text-[11px]">
                          {o.order_date?.split('T')[0]}
                        </td>

                        {/* Action */}
                        <td className="py-2.5 px-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/fulfillment/${o.id}`);
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

      {/* TAB 2: WAREHOUSE FACILITIES — the real API has no per-product,
          per-warehouse stock ledger endpoint yet (only /admin/warehouses
          facility records), so the detailed inventory matrix is simplified
          to a facility list rather than fabricating stock numbers. Full
          facility CRUD lives on the Admin > Warehouses page. */}
      {activeTab === 'stock' && (
        <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
            Per-SKU stock levels are not yet exposed by the backend API (only
            facility records are). Manage facilities on{' '}
            <Link to="/admin/warehouses" className="text-[#714B67] font-semibold hover:underline">
              Admin → Warehouses
            </Link>
            .
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3.5">Facility Name / Code</th>
                <th className="py-2.5 px-3.5">Location</th>
                <th className="py-2.5 px-3.5 text-center">Shipping Cost Weight</th>
                <th className="py-2.5 px-3.5 text-center">Eligibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {warehouses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500 italic">
                    No facilities configured.
                  </td>
                </tr>
              ) : (
                warehouses.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      {w.name}{' '}
                      <span className="text-[11px] font-mono text-slate-500">{w.code || w.id}</span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600">{w.location || '—'}</td>
                    <td className="py-2.5 px-3.5 text-center font-mono">
                      {w.shipping_cost_weight ?? 1.0}x
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.active
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {w.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SCREEN 8: FULFILLMENT DETAIL PAGE
// ============================================================================

export const FulfillmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    currentUser,
    quotations,
    warehouses,
    activeFulfillmentSplits,
    timelineEvents,
    acceptWarehouseSplit,
    overrideWarehouseSplit,
    consolidateBackorderAction,
    restockWarehouse,
  } = useDealStore();

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState<boolean>(false);

  // Locate the quotation
  const quote = quotations.find((q) => q.id === id || q.code === id);

  // Role permissions
  const canManageFulfillment = quote
    ? canUserPerformAction(currentUser, 'manage_fulfillment', { quotation: quote }).allowed
    : false;
  const overridePermission = quote
    ? canUserPerformAction(currentUser, 'override_warehouse', { quotation: quote })
    : { allowed: false, reason: 'Restricted' };

  // Calculate live or saved fulfillment split
  const physicalLines = useMemo(() => {
    if (!quote) return [];
    return quote.lines.filter((l) => l.category === 'Hardware' && !l.isSubscription);
  }, [quote]);

  const totalPhysicalUnits = useMemo(() => {
    return physicalLines.reduce((sum, l) => sum + l.quantity, 0);
  }, [physicalLines]);

  // Current split (either already saved/accepted or recommended by domain engine)
  const splitResult: WarehouseSplitResult = useMemo(() => {
    if (!quote) {
      return {
        strategy: 'Empty',
        allocations: [],
        totalShipments: 0,
        estimatedCost: 0,
        backorderedLines: [],
      };
    }
    const saved = activeFulfillmentSplits[quote.id];
    if (saved) return saved;
    return computeWarehouseSplit(quote.lines, warehouses);
  }, [quote, activeFulfillmentSplits, warehouses]);

  // Overall fulfillment badge
  const fulfillmentStatus = useMemo(() => {
    if (!quote) return null;
    const saved = activeFulfillmentSplits[quote.id];
    return getQuotationFulfillmentStatus(quote, saved, warehouses);
  }, [quote, activeFulfillmentSplits, warehouses]);

  // Check for proactive consolidation opportunity (Test M / N)
  const consolidationOpportunity = useMemo(() => {
    if (!splitResult || splitResult.backorderedLines.length === 0) return null;
    return detectConsolidationOpportunity(splitResult.backorderedLines, warehouses);
  }, [splitResult, warehouses]);

  // Handle Accepting Recommended Split
  const handleAcceptSplit = () => {
    if (!quote) return;
    if (!canManageFulfillment) {
      toast.error('Permission Denied', 'Operations, Finance, or Admin authorization required to accept split.');
      return;
    }

    try {
      acceptWarehouseSplit(quote.id, splitResult);
      toast.success(
        'Fulfillment Plan Confirmed',
        `Stock reserved across ${splitResult.totalShipments} facility location(s). Order stage moved to Fulfillment.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to accept warehouse split.';
      toast.error('Allocation Error', msg);
    }
  };

  // Handle Consolidation
  const handleConsolidate = () => {
    if (!quote || !consolidationOpportunity) return;
    if (!canManageFulfillment) {
      toast.error('Permission Denied', 'Operations or Finance authorization required.');
      return;
    }

    try {
      consolidateBackorderAction(
        quote.id,
        consolidationOpportunity.productId!,
        consolidationOpportunity.quantity!,
        consolidationOpportunity.warehouseId!
      );
      toast.success(
        'Backorder Consolidated',
        `Allocated ${consolidationOpportunity.quantity} units from ${consolidationOpportunity.warehouseName}. Backorder cleared!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to consolidate backorder.';
      toast.error('Consolidation Error', msg);
    }
  };

  // Demo Restock Trigger
  const handleSimulateRestock = () => {
    if (!quote) return;
    // Find backordered product or first physical product
    const targetProduct =
      splitResult.backorderedLines[0]?.productId || physicalLines[0]?.productId || 'PROD-LP14';
    // Restock Mumbai Distribution Center by +25 units
    restockWarehouse('WH-MUMBAI', targetProduct, 25);
    toast.info(
      'Demo Restock Simulated',
      `Added +25 units of ${targetProduct} to Mumbai Distribution Center. Inventory ledger updated.`
    );
  };

  if (!quote) {
    return (
      <div className="p-8 text-center space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Quotation Not Found</h3>
        <p className="text-xs text-slate-500">The requested quotation does not exist or has been removed.</p>
        <Link
          to="/fulfillment"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-[#714B67] text-white"
        >
          <ArrowLeft className="w-3 h-3" /> Return to Fulfillment Queue
        </Link>
      </div>
    );
  }

  const isAccepted = !!activeFulfillmentSplits[quote.id];
  const totalAllocated = splitResult.allocations.reduce((sum, a) => sum + a.quantityFulfilled, 0);
  const totalBackordered = splitResult.backorderedLines.reduce((sum, b) => sum + b.backordered, 0);

  // Relevant timeline events for this quotation
  const quoteEvents = timelineEvents.filter((ev) => ev.quotationId === quote.id);

  return (
    <div className="space-y-5">
      {/* Top Header Strip with Status Bar */}
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
                <span className="font-mono text-base font-bold text-slate-900">{quote.code}</span>
                <span className="text-slate-400">/</span>
                <span className="text-sm font-semibold text-slate-800">{quote.customerName}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {quote.customerTier || 'Silver'} Tier
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Delivery Target: <strong className="text-slate-700">{quote.requestedDeliveryDate || 'Standard Logistics (18 Sep 2026)'}</strong> • Rep: {quote.repName || 'Alex Rivera'}
              </div>
            </div>
          </div>

          {/* Odoo Status Pipeline (Chevron Strip) */}
          <div className="flex items-center border border-slate-200 rounded overflow-hidden text-[11px] font-medium divide-x divide-slate-200">
            {['Draft', 'Pending Approval', 'Approved', 'Fulfillment', 'Shipped'].map((step) => {
              const isCurrent =
                (step === 'Fulfillment' && quote.stage === 'Fulfillment') ||
                (step === 'Approved' && (quote.stage === 'Approved' || quote.stage === 'Confirmed')) ||
                (step === 'Shipped' && quote.stage === 'Completed');
              const isPassed =
                step === 'Draft' ||
                (step === 'Pending Approval' && quote.stage !== 'Draft') ||
                (step === 'Approved' && ['Fulfillment', 'Completed'].includes(quote.stage));

              return (
                <div
                  key={step}
                  className={`px-3 py-1.5 transition-colors ${
                    isCurrent
                      ? 'bg-[#714B67] text-white font-semibold'
                      : isPassed
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-white text-slate-400'
                  }`}
                >
                  {step}
                </div>
              );
            })}
          </div>
        </div>

        {/* Smart Buttons KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Physical Demand</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {totalPhysicalUnits} <span className="text-xs font-normal text-slate-600">units</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Allocated Units</div>
            <div className="text-sm font-bold text-emerald-700 mt-0.5">
              {totalAllocated} / {totalPhysicalUnits}
            </div>
          </div>

          <div className={`p-2.5 rounded border ${totalBackordered > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-[10px] uppercase ${totalBackordered > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
              Backordered Units
            </div>
            <div className={`text-sm font-bold mt-0.5 ${totalBackordered > 0 ? 'text-amber-900 font-black' : 'text-slate-400'}`}>
              {totalBackordered}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Fulfillment Facilities</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {splitResult.totalShipments} <span className="text-xs font-normal text-slate-600">Shipments</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Freight & Handling</div>
            <div className="text-sm font-bold text-blue-900 mt-0.5">
              ${splitResult.estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* PROACTIVE BACKORDER CONSOLIDATION ALERT BANNER (Sections 40, 41, 42) */}
      {consolidationOpportunity && consolidationOpportunity.canConsolidate && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/50 rounded-sm shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Restock Consolidation Available
              </div>
              <p className="text-xs text-amber-900 mt-0.5 max-w-xl">
                {consolidationOpportunity.message ||
                  `${consolidationOpportunity.quantity} backordered units can now be fulfilled from ${consolidationOpportunity.warehouseName}. Consolidating here avoids an additional split.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConsolidate}
            className="px-3.5 py-1.5 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Consolidate Remaining Backorder
          </button>
        </div>
      )}

      {/* Grid: Left Column (Engine & Allocation) + Right Column (Order & Stock Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT COLUMN: 2 Cols wide */}
        <div className="lg:col-span-2 space-y-5">
          {/* Main Recommendation Engine Card */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#714B67]" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Recommended Warehouse Allocation
                </h3>
              </div>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-50 text-purple-900 border border-purple-200">
                Strategy: {splitResult.strategy}
              </span>
            </div>

            {/* Explainability Section: "Why this split?" */}
            <div className="p-4 bg-slate-50/40 border-b border-slate-100 text-xs text-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#714B67]" />
                Why this split?
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {splitResult.explanation ||
                  'Optimization evaluated inventory availability, minimizing facility splits, and applying configured freight cost weightings.'}
              </p>
            </div>

            {/* Allocation Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3.5">Fulfillment Facility</th>
                    <th className="py-2.5 px-3.5">SKU</th>
                    <th className="py-2.5 px-3.5 text-right">Available</th>
                    <th className="py-2.5 px-3.5 text-right font-bold text-slate-900">Allocated</th>
                    <th className="py-2.5 px-3.5 text-center">Shipments</th>
                    <th className="py-2.5 px-3.5 text-right">Base Freight</th>
                    <th className="py-2.5 px-3.5 text-right">Handling</th>
                    <th className="py-2.5 px-3.5 text-right font-bold">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-normal">
                  {splitResult.allocations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        No warehouse stock currently allocated.
                      </td>
                    </tr>
                  ) : (
                    splitResult.allocations.map((alloc, idx) => {
                      const wh = warehouses.find((w) => w.id === alloc.warehouseId);
                      const currentAvail = wh ? getWarehouseAvailableStock(wh, alloc.productId) : 0;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-800">{alloc.warehouseName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Cost Factor: {(wh?.shippingCostWeight || 1.0).toFixed(1)}x
                            </div>
                          </td>

                          <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-900">
                            {alloc.productId}
                          </td>

                          <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                            {currentAvail + (isAccepted ? alloc.quantityFulfilled : 0)} units
                          </td>

                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-800">
                            <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {alloc.quantityFulfilled}
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5 text-center font-mono text-slate-700">
                            1
                          </td>

                          <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                            ${alloc.shippingCost.toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3.5 text-right font-mono text-slate-600">
                            ${(alloc.handlingCost || 0).toFixed(2)}
                          </td>

                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                            ${(alloc.totalCost || alloc.shippingCost).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-mono text-xs border-t border-slate-200 font-semibold text-slate-800">
                    <td colSpan={3} className="py-2.5 px-3.5 text-slate-600">
                      Total Allocated / Required
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-emerald-800 font-bold">
                      {totalAllocated} / {totalPhysicalUnits}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {splitResult.totalShipments}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-600">
                      ${(splitResult.costBreakdown?.shippingCost || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-slate-600">
                      ${(splitResult.costBreakdown?.handlingCost || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right text-blue-900 font-bold">
                      ${splitResult.estimatedCost.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Backorder Callout Box if inventory is insufficient */}
            {totalBackordered > 0 && (
              <div className="p-3.5 bg-amber-50/90 border-t border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Partial Allocation Active — Backorder Generated</div>
                  <div className="text-[11px] text-amber-900">
                    Required: <strong>{totalPhysicalUnits}</strong> • Allocated from available stock: <strong>{totalAllocated}</strong> • Backordered:{' '}
                    <strong>{totalBackordered} units</strong>. The engine will proactively notify when restocked inventory allows consolidation.
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons Strip */}
            <div className="p-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  Manual Override
                </button>

                <button
                  type="button"
                  onClick={handleSimulateRestock}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-900 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Demo test utility: Inbounds +25 units to Mumbai Distribution Center"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#714B67]" />
                  Demo: Simulate Restock (+25 to Mumbai)
                </button>
              </div>

              <button
                type="button"
                onClick={handleAcceptSplit}
                disabled={!canManageFulfillment}
                className="px-4 py-1.5 text-xs font-bold rounded bg-[#714B67] hover:bg-[#5E3E56] text-white shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isAccepted ? 'Re-confirm Allocation' : 'Accept Recommended Split'}
              </button>
            </div>
          </div>

          {/* Physical Line Items Spec */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#714B67]" />
              Physical Line Items Requiring Fulfillment
            </h4>

            <div className="border border-slate-200 rounded-sm overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Product SKU</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                    <th className="py-2 px-3 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {physicalLines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-bold text-slate-900">{line.productId}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">{line.productName}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">{line.quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-600">${line.unitPrice.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-900">${line.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 1 Col wide */}
        <div className="space-y-5">
          {/* Commercial Order Summary */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
              Order Commercial Context
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-900">{quote.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tier:</span>
                <span className="font-mono text-slate-700">{quote.customerTier || 'Silver'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sales Representative:</span>
                <span className="text-slate-800">{quote.repName || 'Alex Rivera'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Commercial Total:</span>
                <span className="font-mono font-bold text-blue-900">
                  ${(quote.grandTotal ?? quote.totalAmount ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Workflow Stage:</span>
                <StatusBadge status={quote.stage} size="sm" />
              </div>
            </div>
          </div>

          {/* Fulfillment Audit Trail */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
              <History className="w-3.5 h-3.5 text-[#714B67]" />
              Fulfillment Audit Trail
            </h4>

            {quoteEvents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No fulfillment events logged yet.</p>
            ) : (
              <div className="space-y-3 text-xs">
                {quoteEvents
                  .slice()
                  .reverse()
                  .map((ev) => (
                    <div key={ev.id} className="border-l-2 border-[#714B67] pl-3 py-0.5 space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-semibold text-slate-700">{ev.actorName || 'System'}</span>
                      </div>
                      <div className="font-semibold text-slate-800 text-[11px] font-mono">
                        {ev.eventType}
                      </div>
                      <div className="text-slate-600 text-[11px] leading-tight font-sans">
                        {ev.note}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Override Modal */}
      <FulfillmentOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        quotation={quote}
        warehouses={warehouses}
        currentAllocations={splitResult.allocations}
        onSaveOverride={(newAllocs) => overrideWarehouseSplit(quote.id, newAllocs)}
        canOverride={overridePermission.allowed}
        permissionReason={overridePermission.reason}
      />
    </div>
  );
};
