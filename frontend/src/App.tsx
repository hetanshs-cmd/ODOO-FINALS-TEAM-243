import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InternalShell } from './layouts/InternalShell';
import { PortalShell } from './layouts/PortalShell';
import { BackendLayout } from './layouts/BackendLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { QuotationsListPage, QuotationDetailPage } from './pages/QuotationsPages';
import { NewQuotationPage } from './pages/NewQuotationPage';
import { ApprovalsListPage, ApprovalDetailPage } from './pages/ApprovalsPages';
import { FulfillmentListPage, FulfillmentDetailPage } from './pages/FulfillmentPages';
import { SubscriptionsListPage, SubscriptionDetailPage } from './pages/SubscriptionsPages';
import { InvoicesListPage, InvoiceDetailPage } from './pages/InvoicesPages';
import { DealHealthPage } from './pages/DealHealthPage';
import { ReportsPage, ProductsPage } from './pages/ReportsAndProductsPages';
import { CommandCenterPage } from './pages/CommandCenterPage';
import { NegotiationsInboxPage } from './pages/NegotiationsInboxPage';

import {
  PortalQuotationPage,
  PortalMessagesPage,
  PortalProfilePage,
} from './pages/CustomerPortalPages';

import {
  AdminProductsConfigPage,
  AdminDiscountTiersPage,
  AdminWarehousesPage,
  AdminSubscriptionsPage,
  AdminUpsellRulesPage,
  AdminReportingConfigPage,
} from './pages/admin/AdminConfigPages';

import { ToastContainer } from './components/ui/Toast';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirect directly into Internal Workspace Dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Authentication Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Customer Portal Shell Routes */}
        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <PortalShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/portal/quotation" replace />} />
          <Route path="quotation" element={<PortalQuotationPage />} />
          <Route path="messages" element={<PortalMessagesPage />} />
          <Route path="profile" element={<PortalProfilePage />} />
        </Route>

        {/* Internal Operational Workspace Shell Routes */}
        <Route
          element={
            <ProtectedRoute requireInternal={true}>
              <InternalShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/quotations" element={<QuotationsListPage />} />
          <Route path="/quotations/new" element={<NewQuotationPage />} />
          <Route path="/quotations/:id" element={<QuotationDetailPage />} />

          <Route path="/approvals" element={<ApprovalsListPage />} />
          <Route path="/approvals/:id" element={<ApprovalDetailPage />} />

          <Route path="/fulfillment" element={<FulfillmentListPage />} />
          <Route path="/fulfillment/:id" element={<FulfillmentDetailPage />} />

          <Route path="/subscriptions" element={<SubscriptionsListPage />} />
          <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />

          <Route path="/invoices" element={<InvoicesListPage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />

          <Route path="/negotiations" element={<NegotiationsInboxPage />} />
          <Route path="/deal-health" element={<DealHealthPage />} />
          <Route path="/command-center" element={<CommandCenterPage />} />
          <Route path="/agent" element={<Navigate to="/command-center" replace />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductsPage />} />

          {/* Admin Configuration Routes embedded in Internal Workspace */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'Admin']}>
                <BackendLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/products" replace />} />
            <Route path="products" element={<AdminProductsConfigPage />} />
            <Route path="price-lists" element={<Navigate to="/admin/products" replace />} />
            <Route path="discount-tiers" element={<AdminDiscountTiersPage />} />
            <Route path="approval-chains" element={<Navigate to="/admin/discount-tiers" replace />} />
            <Route path="warehouses" element={<AdminWarehousesPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="subscription-plans" element={<Navigate to="/admin/subscriptions" replace />} />
            <Route path="upsell-rules" element={<AdminUpsellRulesPage />} />
            <Route path="reporting" element={<AdminReportingConfigPage />} />
          </Route>
        </Route>

        {/* 404 Catch-all fallback */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      {/* Global Notifications Mount */}
      <ToastContainer />
    </BrowserRouter>
  );
}
