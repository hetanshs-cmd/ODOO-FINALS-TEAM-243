-- Migration: 015_billing_invoices.sql
-- Description: Invoices and invoice line items. Supports one-time billing
--              (from a sales order/quotation) and recurring billing (from
--              a subscription's billing schedule, hence the nullable FKs).
-- Depends on: 004_customers.sql, 011_sales_orders.sql, 006_quotations.sql, 005_products.sql

CREATE TABLE invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number    VARCHAR(50) NOT NULL UNIQUE,
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id    UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    quotation_id      UUID REFERENCES quotations(id) ON DELETE SET NULL,
    invoice_type      VARCHAR(20) NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    subtotal          NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_total    NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
    total             NUMERIC(14,2) NOT NULL DEFAULT 0,
    due_date          DATE,
    issued_at         TIMESTAMPTZ,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_invoices_type CHECK (invoice_type IN ('ONE_TIME', 'RECURRING')),
    CONSTRAINT chk_invoices_status CHECK (
        status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID')
    ),
    CONSTRAINT chk_invoices_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_invoices_discount_total CHECK (discount_total >= 0),
    CONSTRAINT chk_invoices_tax_total CHECK (tax_total >= 0),
    CONSTRAINT chk_invoices_total CHECK (total >= 0)
);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_sales_order_id ON invoices(sales_order_id);
CREATE INDEX idx_invoices_quotation_id ON invoices(quotation_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE invoice_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
    description   VARCHAR(255) NOT NULL,
    quantity      NUMERIC(12,2) NOT NULL,
    unit_price    NUMERIC(14,2) NOT NULL,
    tax           NUMERIC(14,2) NOT NULL DEFAULT 0,
    total         NUMERIC(14,2) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_invoice_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_invoice_items_tax CHECK (tax >= 0),
    CONSTRAINT chk_invoice_items_total CHECK (total >= 0)
);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_product_id ON invoice_items(product_id);
CREATE TRIGGER trg_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
