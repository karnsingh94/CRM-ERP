-- AlterTable
ALTER TABLE `product_categories` MODIFY COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `product_pricings` MODIFY COLUMN `updated_at` DATETIME(3) NOT NULL;

-- CreateTable
CREATE TABLE `dispatch_orders` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `dispatch_no` VARCHAR(60) NOT NULL,
    `sales_order_id` CHAR(36) NULL,
    `sales_order_no` VARCHAR(60) NULL,
    `customer_id` CHAR(36) NULL,
    `customer_name` VARCHAR(180) NOT NULL,
    `customer_gstin` VARCHAR(20) NULL,
    `shipping_address` TEXT NULL,
    `billing_address` TEXT NULL,
    `dispatch_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    `fulfillment_type` VARCHAR(30) NOT NULL DEFAULT 'FULL',
    `warehouse_id` CHAR(36) NULL,
    `warehouse_name` VARCHAR(120) NULL,
    `carrier_name` VARCHAR(120) NULL,
    `tracking_no` VARCHAR(100) NULL,
    `vehicle_no` VARCHAR(40) NULL,
    `driver_name` VARCHAR(120) NULL,
    `driver_phone` VARCHAR(40) NULL,
    `eway_bill_no` VARCHAR(60) NULL,
    `eway_bill_date` DATETIME(3) NULL,
    `eway_bill_valid_till` DATETIME(3) NULL,
    `invoice_no` VARCHAR(60) NULL,
    `invoice_date` DATETIME(3) NULL,
    `total_packages` INTEGER NOT NULL DEFAULT 1,
    `total_gross_weight_kg` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `total_net_weight_kg` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `total_dispatched_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `total_dispatched_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `gate_pass_id` CHAR(36) NULL,
    `gate_pass_no` VARCHAR(60) NULL,
    `dispatched_at` DATETIME(3) NULL,
    `dispatched_by_id` CHAR(36) NULL,
    `delivered_at` DATETIME(3) NULL,
    `delivered_by_id` CHAR(36) NULL,
    `pod_attachment_url` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dispatch_orders_company_id_status_dispatch_date_idx`(`company_id`, `status`, `dispatch_date`),
    INDEX `dispatch_orders_company_id_sales_order_id_idx`(`company_id`, `sales_order_id`),
    INDEX `dispatch_orders_company_id_customer_id_idx`(`company_id`, `customer_id`),
    INDEX `dispatch_orders_company_id_tracking_no_idx`(`company_id`, `tracking_no`),
    UNIQUE INDEX `dispatch_orders_company_id_dispatch_no_key`(`company_id`, `dispatch_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispatch_order_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `dispatch_order_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NULL,
    `sku` VARCHAR(80) NOT NULL,
    `product_name` VARCHAR(180) NOT NULL,
    `uom` VARCHAR(20) NOT NULL DEFAULT 'PCS',
    `ordered_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `dispatched_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `unit_price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `gross_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `hsn_code` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dispatch_order_items_company_id_dispatch_order_id_idx`(`company_id`, `dispatch_order_id`),
    INDEX `dispatch_order_items_company_id_product_id_idx`(`company_id`, `product_id`),
    INDEX `dispatch_order_items_company_id_sku_idx`(`company_id`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispatch_item_batch_allocations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `dispatch_order_item_id` CHAR(36) NOT NULL,
    `inventory_batch_id` CHAR(36) NOT NULL,
    `batch_no` VARCHAR(80) NOT NULL,
    `allocated_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `unit_cost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dispatch_item_batch_allocations_company_id_dispatch_order_it_idx`(`company_id`, `dispatch_order_item_id`),
    INDEX `dispatch_item_batch_allocations_company_id_inventory_batch_i_idx`(`company_id`, `inventory_batch_id`),
    INDEX `dispatch_item_batch_allocations_company_id_batch_no_idx`(`company_id`, `batch_no`),
    UNIQUE INDEX `dispatch_item_batch_allocations_dispatch_order_item_id_inven_key`(`dispatch_order_item_id`, `inventory_batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispatch_packages` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `dispatch_order_id` CHAR(36) NOT NULL,
    `package_number` INTEGER NOT NULL,
    `package_code` VARCHAR(60) NOT NULL,
    `box_type` VARCHAR(50) NULL,
    `length_cm` DECIMAL(10, 2) NULL,
    `width_cm` DECIMAL(10, 2) NULL,
    `height_cm` DECIMAL(10, 2) NULL,
    `weight_gross_kg` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `weight_net_kg` DECIMAL(10, 4) NOT NULL DEFAULT 0,
    `barcode` VARCHAR(100) NULL,
    `item_details` JSON NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dispatch_packages_company_id_dispatch_order_id_idx`(`company_id`, `dispatch_order_id`),
    INDEX `dispatch_packages_company_id_package_code_idx`(`company_id`, `package_code`),
    UNIQUE INDEX `dispatch_packages_dispatch_order_id_package_number_key`(`dispatch_order_id`, `package_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dispatch_trackings` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `dispatch_order_id` CHAR(36) NOT NULL,
    `event_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(50) NOT NULL,
    `location` VARCHAR(150) NULL,
    `carrier_status` VARCHAR(100) NULL,
    `remarks` TEXT NULL,
    `recorded_by` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dispatch_trackings_company_id_dispatch_order_id_idx`(`company_id`, `dispatch_order_id`),
    INDEX `dispatch_trackings_company_id_status_event_date_idx`(`company_id`, `status`, `event_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_returns` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `rma_no` VARCHAR(60) NOT NULL,
    `dispatch_order_id` CHAR(36) NULL,
    `dispatch_no` VARCHAR(60) NULL,
    `sales_order_id` CHAR(36) NULL,
    `sales_order_no` VARCHAR(60) NULL,
    `customer_id` CHAR(36) NULL,
    `customer_name` VARCHAR(180) NOT NULL,
    `customer_phone` VARCHAR(40) NULL,
    `customer_email` VARCHAR(120) NULL,
    `request_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
    `return_reason` VARCHAR(100) NOT NULL,
    `reason_details` TEXT NULL,
    `total_returned_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `total_returned_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `pickup_address` TEXT NULL,
    `receiving_warehouse_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `approved_by_id` CHAR(36) NULL,
    `received_at` DATETIME(3) NULL,
    `received_by_id` CHAR(36) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_returns_company_id_status_request_date_idx`(`company_id`, `status`, `request_date`),
    INDEX `customer_returns_company_id_dispatch_order_id_idx`(`company_id`, `dispatch_order_id`),
    INDEX `customer_returns_company_id_customer_id_idx`(`company_id`, `customer_id`),
    UNIQUE INDEX `customer_returns_company_id_rma_no_key`(`company_id`, `rma_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_return_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `customer_return_id` CHAR(36) NOT NULL,
    `dispatch_order_item_id` CHAR(36) NULL,
    `product_id` CHAR(36) NULL,
    `sku` VARCHAR(80) NOT NULL,
    `product_name` VARCHAR(180) NOT NULL,
    `uom` VARCHAR(20) NOT NULL DEFAULT 'PCS',
    `return_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `received_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `unit_price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `return_reason` VARCHAR(100) NULL,
    `condition_on_arrival` VARCHAR(50) NULL,
    `inspected_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_RECEIPT',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_return_items_company_id_customer_return_id_idx`(`company_id`, `customer_return_id`),
    INDEX `customer_return_items_company_id_product_id_idx`(`company_id`, `product_id`),
    INDEX `customer_return_items_company_id_sku_idx`(`company_id`, `sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_return_inspections` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `inspection_no` VARCHAR(60) NOT NULL,
    `customer_return_id` CHAR(36) NOT NULL,
    `customer_return_item_id` CHAR(36) NOT NULL,
    `sku` VARCHAR(80) NOT NULL,
    `inspected_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `restock_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `rework_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `reject_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `scrap_qty` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `target_warehouse_id` CHAR(36) NULL,
    `restock_batch_id` CHAR(36) NULL,
    `restock_batch_no` VARCHAR(80) NULL,
    `inventory_movement_id` CHAR(36) NULL,
    `qc_findings` TEXT NULL,
    `disposition` VARCHAR(50) NOT NULL,
    `inspected_by` VARCHAR(120) NOT NULL,
    `inspection_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(40) NOT NULL DEFAULT 'COMPLETED',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_return_inspections_company_id_customer_return_id_idx`(`company_id`, `customer_return_id`),
    INDEX `customer_return_inspections_company_id_customer_return_item__idx`(`company_id`, `customer_return_item_id`),
    INDEX `customer_return_inspections_company_id_sku_idx`(`company_id`, `sku`),
    UNIQUE INDEX `customer_return_inspections_company_id_inspection_no_key`(`company_id`, `inspection_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_credit_notes` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `credit_note_no` VARCHAR(60) NOT NULL,
    `customer_return_id` CHAR(36) NULL,
    `sales_order_id` CHAR(36) NULL,
    `sales_invoice_id` CHAR(36) NULL,
    `customer_id` CHAR(36) NULL,
    `customer_name` VARCHAR(180) NOT NULL,
    `customer_gstin` VARCHAR(20) NULL,
    `original_invoice_no` VARCHAR(60) NULL,
    `original_invoice_date` DATETIME(3) NULL,
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `cgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `sgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `igst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `restocking_fee_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `restocking_fee_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `net_credit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `settlement_type` VARCHAR(50) NOT NULL DEFAULT 'LEDGER_CREDIT',
    `status` VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    `approved_at` DATETIME(3) NULL,
    `approved_by_id` CHAR(36) NULL,
    `applied_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_credit_notes_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
    INDEX `customer_credit_notes_company_id_customer_return_id_idx`(`company_id`, `customer_return_id`),
    INDEX `customer_credit_notes_company_id_customer_id_idx`(`company_id`, `customer_id`),
    INDEX `customer_credit_notes_company_id_sales_invoice_id_idx`(`company_id`, `sales_invoice_id`),
    UNIQUE INDEX `customer_credit_notes_company_id_credit_note_no_key`(`company_id`, `credit_note_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_years` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `is_locked` BOOLEAN NOT NULL DEFAULT false,
    `locked_at` DATETIME(3) NULL,
    `locked_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_years_company_id_is_current_is_locked_idx`(`company_id`, `is_current`, `is_locked`),
    UNIQUE INDEX `financial_years_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounting_periods` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `financial_year_id` CHAR(36) NOT NULL,
    `period_name` VARCHAR(50) NOT NULL,
    `period_code` VARCHAR(20) NOT NULL,
    `period_number` INTEGER NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `is_closed` BOOLEAN NOT NULL DEFAULT false,
    `closed_at` DATETIME(3) NULL,
    `closed_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `accounting_periods_company_id_is_closed_idx`(`company_id`, `is_closed`),
    UNIQUE INDEX `accounting_periods_company_id_financial_year_id_period_numbe_key`(`company_id`, `financial_year_id`, `period_number`),
    UNIQUE INDEX `accounting_periods_company_id_period_code_key`(`company_id`, `period_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_groups` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `group_name` VARCHAR(120) NOT NULL,
    `group_code` VARCHAR(50) NOT NULL,
    `category` VARCHAR(30) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `account_groups_company_id_category_status_idx`(`company_id`, `category`, `status`),
    UNIQUE INDEX `account_groups_company_id_group_code_key`(`company_id`, `group_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `account_masters` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `group_id` CHAR(36) NOT NULL,
    `account_code` VARCHAR(60) NOT NULL,
    `account_name` VARCHAR(180) NOT NULL,
    `normal_balance` VARCHAR(10) NOT NULL,
    `opening_debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `opening_credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `current_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `is_control_account` BOOLEAN NOT NULL DEFAULT false,
    `control_type` VARCHAR(40) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `account_masters_company_id_group_id_status_idx`(`company_id`, `group_id`, `status`),
    INDEX `account_masters_company_id_control_type_idx`(`company_id`, `control_type`),
    UNIQUE INDEX `account_masters_company_id_account_code_key`(`company_id`, `account_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_accounts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `bank_name` VARCHAR(120) NOT NULL,
    `account_holder_name` VARCHAR(180) NOT NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `masked_account_number` VARCHAR(50) NULL,
    `ifsc_code` VARCHAR(30) NOT NULL,
    `branch_name` VARCHAR(120) NULL,
    `account_type` VARCHAR(30) NOT NULL DEFAULT 'CURRENT',
    `account_id` CHAR(36) NULL,
    `opening_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `current_balance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `overdraft_limit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bank_accounts_company_id_status_idx`(`company_id`, `status`),
    UNIQUE INDEX `bank_accounts_company_id_account_number_key`(`company_id`, `account_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoices` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `invoice_no` VARCHAR(60) NOT NULL,
    `invoice_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_date` DATETIME(3) NULL,
    `financial_year_id` CHAR(36) NULL,
    `accounting_period_id` CHAR(36) NULL,
    `customer_id` CHAR(36) NOT NULL,
    `customer_name` VARCHAR(180) NOT NULL,
    `customer_gstin` VARCHAR(20) NULL,
    `billing_address` TEXT NULL,
    `shipping_address` TEXT NULL,
    `sales_order_id` CHAR(36) NULL,
    `dispatch_order_id` CHAR(36) NULL,
    `is_inter_state` BOOLEAN NOT NULL DEFAULT false,
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `cgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `sgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `igst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `other_charges` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `paid_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `outstanding_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `voucher_id` CHAR(36) NULL,
    `irn` VARCHAR(120) NULL,
    `ack_no` VARCHAR(80) NULL,
    `ack_date` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sales_invoices_company_id_status_invoice_date_idx`(`company_id`, `status`, `invoice_date`),
    INDEX `sales_invoices_company_id_customer_id_idx`(`company_id`, `customer_id`),
    INDEX `sales_invoices_company_id_dispatch_order_id_idx`(`company_id`, `dispatch_order_id`),
    UNIQUE INDEX `sales_invoices_company_id_invoice_no_key`(`company_id`, `invoice_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_invoice_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NULL,
    `dispatch_order_item_id` CHAR(36) NULL,
    `sku` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NULL,
    `hsn_code` VARCHAR(20) NULL,
    `uom` VARCHAR(20) NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(15, 3) NOT NULL,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `discount_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `taxable_amount` DECIMAL(15, 2) NOT NULL,
    `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `cgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `sgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `igst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL,

    INDEX `sales_invoice_items_company_id_invoice_id_idx`(`company_id`, `invoice_id`),
    INDEX `sales_invoice_items_company_id_product_id_idx`(`company_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_vouchers` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `voucher_no` VARCHAR(60) NOT NULL,
    `voucher_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `voucher_type` VARCHAR(30) NOT NULL,
    `financial_year_id` CHAR(36) NULL,
    `accounting_period_id` CHAR(36) NULL,
    `reference_type` VARCHAR(50) NULL,
    `reference_id` CHAR(36) NULL,
    `reference_no` VARCHAR(80) NULL,
    `narration` TEXT NULL,
    `total_debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `is_reversal` BOOLEAN NOT NULL DEFAULT false,
    `reversal_of_voucher_id` CHAR(36) NULL,
    `posted_at` DATETIME(3) NULL,
    `posted_by_id` CHAR(36) NULL,
    `posted_by_name` VARCHAR(180) NULL,
    `created_by_id` CHAR(36) NULL,
    `created_by_name` VARCHAR(180) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `journal_vouchers_company_id_voucher_date_voucher_type_status_idx`(`company_id`, `voucher_date`, `voucher_type`, `status`),
    INDEX `journal_vouchers_company_id_reference_type_reference_id_idx`(`company_id`, `reference_type`, `reference_id`),
    UNIQUE INDEX `journal_vouchers_company_id_voucher_no_key`(`company_id`, `voucher_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_voucher_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `voucher_id` CHAR(36) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `sequence_no` INTEGER NOT NULL DEFAULT 1,
    `debit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `customer_id` CHAR(36) NULL,
    `vendor_id` CHAR(36) NULL,
    `invoice_id` CHAR(36) NULL,
    `bill_id` CHAR(36) NULL,
    `narration` TEXT NULL,

    INDEX `journal_voucher_items_company_id_voucher_id_idx`(`company_id`, `voucher_id`),
    INDEX `journal_voucher_items_company_id_account_id_idx`(`company_id`, `account_id`),
    INDEX `journal_voucher_items_company_id_customer_id_idx`(`company_id`, `customer_id`),
    INDEX `journal_voucher_items_company_id_vendor_id_idx`(`company_id`, `vendor_id`),
    INDEX `journal_voucher_items_company_id_invoice_id_idx`(`company_id`, `invoice_id`),
    INDEX `journal_voucher_items_company_id_bill_id_idx`(`company_id`, `bill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_receipts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `payment_receipt_no` VARCHAR(60) NOT NULL,
    `payment_type` VARCHAR(30) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `vendor_id` CHAR(36) NULL,
    `payment_mode` VARCHAR(30) NOT NULL DEFAULT 'BANK',
    `amount` DECIMAL(15, 2) NOT NULL,
    `unallocated_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `payment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bank_account_id` CHAR(36) NULL,
    `cheque_reference_no` VARCHAR(100) NULL,
    `cheque_date` DATETIME(3) NULL,
    `financial_year_id` CHAR(36) NULL,
    `accounting_period_id` CHAR(36) NULL,
    `voucher_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_receipts_company_id_payment_type_status_payment_date_idx`(`company_id`, `payment_type`, `status`, `payment_date`),
    INDEX `payment_receipts_company_id_customer_id_idx`(`company_id`, `customer_id`),
    INDEX `payment_receipts_company_id_vendor_id_idx`(`company_id`, `vendor_id`),
    UNIQUE INDEX `payment_receipts_company_id_payment_receipt_no_key`(`company_id`, `payment_receipt_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `payment_receipt_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NULL,
    `bill_id` CHAR(36) NULL,
    `target_type` VARCHAR(30) NOT NULL DEFAULT 'SALES_INVOICE',
    `allocated_amount` DECIMAL(15, 2) NOT NULL,
    `allocation_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_allocations_company_id_payment_receipt_id_idx`(`company_id`, `payment_receipt_id`),
    INDEX `payment_allocations_company_id_target_type_status_idx`(`company_id`, `target_type`, `status`),
    INDEX `payment_allocations_company_id_invoice_id_idx`(`company_id`, `invoice_id`),
    INDEX `payment_allocations_company_id_bill_id_idx`(`company_id`, `bill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_debit_notes` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `debit_note_no` VARCHAR(60) NOT NULL,
    `vendor_id` CHAR(36) NOT NULL,
    `purchase_bill_id` CHAR(36) NULL,
    `job_work_reconciliation_id` CHAR(36) NULL,
    `financial_year_id` CHAR(36) NULL,
    `debit_note_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `cgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `sgst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `igst_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `reason` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `voucher_id` CHAR(36) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vendor_debit_notes_company_id_vendor_id_status_idx`(`company_id`, `vendor_id`, `status`),
    UNIQUE INDEX `vendor_debit_notes_company_id_debit_note_no_key`(`company_id`, `debit_note_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_transactions` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `bank_account_id` CHAR(36) NOT NULL,
    `transaction_date` DATETIME(3) NOT NULL,
    `value_date` DATETIME(3) NULL,
    `reference_no` VARCHAR(100) NULL,
    `external_ref` VARCHAR(120) NULL,
    `statement_batch_id` VARCHAR(60) NULL,
    `description` TEXT NULL,
    `debit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `running_balance` DECIMAL(15, 2) NULL,
    `import_source` VARCHAR(50) NULL DEFAULT 'MANUAL',
    `reconciliation_status` VARCHAR(30) NOT NULL DEFAULT 'UNRECONCILED',
    `matched_voucher_id` CHAR(36) NULL,
    `reconciliation_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bank_transactions_company_id_bank_account_id_transaction_dat_idx`(`company_id`, `bank_account_id`, `transaction_date`),
    INDEX `bank_transactions_company_id_bank_account_id_reference_no_idx`(`company_id`, `bank_account_id`, `reference_no`),
    INDEX `bank_transactions_company_id_bank_account_id_reconciliation__idx`(`company_id`, `bank_account_id`, `reconciliation_status`),
    UNIQUE INDEX `bank_transactions_company_id_bank_account_id_external_ref_key`(`company_id`, `bank_account_id`, `external_ref`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_reconciliations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `bank_account_id` CHAR(36) NOT NULL,
    `statement_date` DATETIME(3) NOT NULL,
    `statement_closing_balance` DECIMAL(15, 2) NOT NULL,
    `ledger_closing_balance` DECIMAL(15, 2) NOT NULL,
    `difference_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    `reconciled_by_id` CHAR(36) NULL,
    `reconciled_by_name` VARCHAR(180) NULL,
    `reconciled_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bank_reconciliations_company_id_bank_account_id_statement_da_idx`(`company_id`, `bank_account_id`, `statement_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank_reconciliation_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `reconciliation_id` CHAR(36) NOT NULL,
    `bank_transaction_id` CHAR(36) NOT NULL,
    `voucher_id` CHAR(36) NULL,
    `voucher_item_id` CHAR(36) NULL,
    `matched_amount` DECIMAL(15, 2) NOT NULL,
    `clearance_date` DATETIME(3) NULL,
    `match_type` VARCHAR(30) NOT NULL DEFAULT 'EXACT',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `bank_reconciliation_items_company_id_bank_transaction_id_idx`(`company_id`, `bank_transaction_id`),
    INDEX `bank_reconciliation_items_company_id_voucher_id_idx`(`company_id`, `voucher_id`),
    INDEX `bank_reconciliation_items_company_id_voucher_item_id_idx`(`company_id`, `voucher_item_id`),
    UNIQUE INDEX `bank_reconciliation_items_reconciliation_id_bank_transaction_key`(`reconciliation_id`, `bank_transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tally_ledger_mappings` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `tally_ledger_name` VARCHAR(180) NOT NULL,
    `tally_parent_group` VARCHAR(120) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tally_ledger_mappings_company_id_account_id_key`(`company_id`, `account_id`),
    UNIQUE INDEX `tally_ledger_mappings_company_id_tally_ledger_name_key`(`company_id`, `tally_ledger_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tally_sync_batches` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `batch_no` VARCHAR(60) NOT NULL,
    `batch_type` VARCHAR(30) NOT NULL,
    `total_count` INTEGER NOT NULL DEFAULT 0,
    `success_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    `error_summary` TEXT NULL,
    `external_batch_ref` VARCHAR(120) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tally_sync_batches_company_id_batch_type_status_idx`(`company_id`, `batch_type`, `status`),
    UNIQUE INDEX `tally_sync_batches_company_id_batch_no_key`(`company_id`, `batch_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tally_voucher_mappings` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `sync_batch_id` CHAR(36) NULL,
    `voucher_id` CHAR(36) NOT NULL,
    `tally_guid` VARCHAR(120) NULL,
    `export_status` VARCHAR(30) NOT NULL DEFAULT 'EXPORTED',
    `error_message` TEXT NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tally_voucher_mappings_company_id_tally_guid_idx`(`company_id`, `tally_guid`),
    UNIQUE INDEX `tally_voucher_mappings_company_id_voucher_id_key`(`company_id`, `voucher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_designations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `department_id` CHAR(36) NULL,
    `level` INTEGER NULL DEFAULT 1,
    `min_salary` DECIMAL(15, 2) NULL,
    `max_salary` DECIMAL(15, 2) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_designations_company_id_department_id_idx`(`company_id`, `department_id`),
    UNIQUE INDEX `employee_designations_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_profiles` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_id` CHAR(36) NULL,
    `employee_code` VARCHAR(60) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NULL,
    `display_name` VARCHAR(200) NOT NULL,
    `gender` VARCHAR(20) NULL,
    `date_of_birth` DATE NULL,
    `date_of_joining` DATE NOT NULL,
    `confirmation_date` DATE NULL,
    `probation_end_date` DATE NULL,
    `resignation_date` DATE NULL,
    `relieving_date` DATE NULL,
    `employment_status` VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    `employment_type` VARCHAR(40) NOT NULL DEFAULT 'FULL_TIME',
    `department_id` CHAR(36) NULL,
    `designation_id` CHAR(36) NULL,
    `reporting_manager_id` CHAR(36) NULL,
    `work_email` VARCHAR(180) NULL,
    `personal_email` VARCHAR(180) NULL,
    `phone` VARCHAR(40) NULL,
    `emergency_contact_name` VARCHAR(150) NULL,
    `emergency_contact_phone` VARCHAR(40) NULL,
    `blood_group` VARCHAR(10) NULL,
    `marital_status` VARCHAR(20) NULL,
    `current_address` TEXT NULL,
    `permanent_address` TEXT NULL,
    `bank_name` VARCHAR(100) NULL,
    `bank_branch` VARCHAR(100) NULL,
    `bank_ifsc` VARCHAR(30) NULL,
    `bank_account_masked` VARCHAR(30) NULL,
    `bank_account_encrypted` TEXT NULL,
    `pan_masked` VARCHAR(20) NULL,
    `pan_encrypted` TEXT NULL,
    `aadhaar_masked` VARCHAR(20) NULL,
    `aadhaar_encrypted` TEXT NULL,
    `uan_number` VARCHAR(30) NULL,
    `esic_number` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_profiles_employee_id_key`(`employee_id`),
    INDEX `employee_profiles_company_id_department_id_idx`(`company_id`, `department_id`),
    INDEX `employee_profiles_company_id_designation_id_idx`(`company_id`, `designation_id`),
    INDEX `employee_profiles_company_id_reporting_manager_id_idx`(`company_id`, `reporting_manager_id`),
    INDEX `employee_profiles_company_id_employment_status_idx`(`company_id`, `employment_status`),
    UNIQUE INDEX `employee_profiles_company_id_employee_code_key`(`company_id`, `employee_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_kyc` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `pan_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `pan_verified_at` DATETIME(3) NULL,
    `pan_verified_by_id` CHAR(36) NULL,
    `aadhaar_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `aadhaar_verified_at` DATETIME(3) NULL,
    `aadhaar_verified_by_id` CHAR(36) NULL,
    `bank_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `bank_verified_at` DATETIME(3) NULL,
    `bank_verified_by_id` CHAR(36) NULL,
    `overall_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `verified_at` DATETIME(3) NULL,
    `verified_by_id` CHAR(36) NULL,
    `rejection_reason` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_kyc_employee_profile_id_key`(`employee_profile_id`),
    INDEX `employee_kyc_company_id_overall_status_idx`(`company_id`, `overall_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_documents` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `document_type` VARCHAR(60) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `document_number` VARCHAR(100) NULL,
    `file_url` TEXT NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_size` INTEGER NULL,
    `file_type` VARCHAR(100) NULL,
    `attachment_id` CHAR(36) NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_at` DATETIME(3) NULL,
    `verified_by_id` CHAR(36) NULL,
    `expiry_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_documents_company_id_employee_profile_id_document_t_idx`(`company_id`, `employee_profile_id`, `document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_policies` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `shift_name` VARCHAR(100) NOT NULL,
    `shift_code` VARCHAR(50) NOT NULL,
    `start_time` VARCHAR(10) NOT NULL,
    `end_time` VARCHAR(10) NOT NULL,
    `is_overnight` BOOLEAN NOT NULL DEFAULT false,
    `grace_minutes` INTEGER NOT NULL DEFAULT 15,
    `break_duration_minutes` INTEGER NOT NULL DEFAULT 60,
    `half_day_threshold_hours` DECIMAL(4, 2) NOT NULL DEFAULT 4.00,
    `full_day_threshold_hours` DECIMAL(4, 2) NOT NULL DEFAULT 8.00,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shift_policies_company_id_shift_code_key`(`company_id`, `shift_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_shift_rosters` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `shift_id` CHAR(36) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `is_weekly_off` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_shift_rosters_company_id_employee_profile_id_start__idx`(`company_id`, `employee_profile_id`, `start_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_attendances` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `shift_id` CHAR(36) NULL,
    `first_in_time` DATETIME(3) NULL,
    `last_out_time` DATETIME(3) NULL,
    `total_work_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `break_hours` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `overtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `late_minutes` INTEGER NOT NULL DEFAULT 0,
    `early_exit_minutes` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PRESENT',
    `is_regularized` BOOLEAN NOT NULL DEFAULT false,
    `regularization_id` CHAR(36) NULL,
    `source` VARCHAR(30) NOT NULL DEFAULT 'BIOMETRIC',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_attendances_company_id_attendance_date_status_idx`(`company_id`, `attendance_date`, `status`),
    UNIQUE INDEX `daily_attendances_company_id_employee_profile_id_attendance__key`(`company_id`, `employee_profile_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_regularizations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `attendance_date` DATE NOT NULL,
    `requested_in_time` DATETIME(3) NULL,
    `requested_out_time` DATETIME(3) NULL,
    `reason` TEXT NOT NULL,
    `approval_request_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `approved_by_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_regularizations_company_id_employee_profile_id_at_idx`(`company_id`, `employee_profile_id`, `attendance_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_types` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `is_paid` BOOLEAN NOT NULL DEFAULT true,
    `is_encashable` BOOLEAN NOT NULL DEFAULT false,
    `allow_half_day` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_types_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_policies` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `leave_type_id` CHAR(36) NOT NULL,
    `annual_quota` DECIMAL(5, 2) NOT NULL,
    `accrual_frequency` VARCHAR(30) NOT NULL DEFAULT 'MONTHLY',
    `max_carry_forward` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `min_notice_days` INTEGER NOT NULL DEFAULT 0,
    `sandwich_rule_enabled` BOOLEAN NOT NULL DEFAULT false,
    `effective_from` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_policies_company_id_leave_type_id_idx`(`company_id`, `leave_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_leave_balances` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `leave_type_id` CHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `opening_balance` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `accrued` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `used` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `encashed` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `current_balance` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_leave_balances_company_id_employee_profile_id_leave_key`(`company_id`, `employee_profile_id`, `leave_type_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `leave_type_id` CHAR(36) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_half_day` BOOLEAN NOT NULL DEFAULT false,
    `half_day_session` VARCHAR(20) NULL,
    `days_count` DECIMAL(4, 2) NOT NULL,
    `reason` TEXT NOT NULL,
    `approval_request_id` CHAR(36) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `approved_by_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leave_requests_company_id_employee_profile_id_start_date_idx`(`company_id`, `employee_profile_id`, `start_date`),
    INDEX `leave_requests_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `biometric_devices` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `device_name` VARCHAR(120) NOT NULL,
    `device_serial` VARCHAR(100) NOT NULL,
    `device_model` VARCHAR(80) NULL,
    `ip_address` VARCHAR(60) NULL,
    `port` INTEGER NULL DEFAULT 4370,
    `location` VARCHAR(150) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    `last_ping_at` DATETIME(3) NULL,
    `last_sync_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `biometric_devices_company_id_device_serial_key`(`company_id`, `device_serial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `biometric_punch_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `device_id` CHAR(36) NULL,
    `employee_profile_id` CHAR(36) NULL,
    `biometric_user_id` VARCHAR(80) NOT NULL,
    `punch_time` DATETIME(3) NOT NULL,
    `punch_type` VARCHAR(30) NOT NULL DEFAULT 'CHECK_IN',
    `verification_mode` VARCHAR(30) NULL,
    `is_processed` BOOLEAN NOT NULL DEFAULT false,
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `biometric_punch_logs_company_id_is_processed_punch_time_idx`(`company_id`, `is_processed`, `punch_time`),
    INDEX `biometric_punch_logs_company_id_employee_profile_id_punch_ti_idx`(`company_id`, `employee_profile_id`, `punch_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_components` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` VARCHAR(30) NOT NULL,
    `calculation_type` VARCHAR(50) NOT NULL DEFAULT 'FLAT',
    `is_taxable` BOOLEAN NOT NULL DEFAULT true,
    `is_statutory` BOOLEAN NOT NULL DEFAULT false,
    `ledger_account_id` CHAR(36) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_components_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_structures` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` TEXT NULL,
    `components_json` JSON NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `salary_structures_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_salary_assignments` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `salary_structure_id` CHAR(36) NOT NULL,
    `ctc_annual` DECIMAL(15, 2) NOT NULL,
    `ctc_monthly` DECIMAL(15, 2) NOT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `revision_reason` VARCHAR(255) NULL,
    `components_breakdown` JSON NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_salary_assignments_company_id_employee_profile_id_e_idx`(`company_id`, `employee_profile_id`, `effective_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_batches` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `batch_number` VARCHAR(60) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `period_start_date` DATE NOT NULL,
    `period_end_date` DATE NOT NULL,
    `total_employees` INTEGER NOT NULL DEFAULT 0,
    `total_gross` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_deductions` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_net` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_employer_pf` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `total_employer_esi` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    `approval_request_id` CHAR(36) NULL,
    `voucher_id` CHAR(36) NULL,
    `processed_by_id` CHAR(36) NULL,
    `processed_at` DATETIME(3) NULL,
    `posted_to_gl_at` DATETIME(3) NULL,
    `disbursed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_batches_company_id_status_idx`(`company_id`, `status`),
    UNIQUE INDEX `payroll_batches_company_id_month_year_key`(`company_id`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payroll_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `payroll_batch_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `working_days` DECIMAL(4, 2) NOT NULL,
    `paid_days` DECIMAL(4, 2) NOT NULL,
    `lop_days` DECIMAL(4, 2) NOT NULL DEFAULT 0.00,
    `overtime_hours` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `gross_earned` DECIMAL(15, 2) NOT NULL,
    `total_deductions` DECIMAL(15, 2) NOT NULL,
    `net_payable` DECIMAL(15, 2) NOT NULL,
    `earnings_breakdown` JSON NOT NULL,
    `deductions_breakdown` JSON NOT NULL,
    `employer_pf` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `employer_esi` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payroll_items_company_id_employee_profile_id_idx`(`company_id`, `employee_profile_id`),
    UNIQUE INDEX `payroll_items_payroll_batch_id_employee_profile_id_key`(`payroll_batch_id`, `employee_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_payslips` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `payroll_item_id` CHAR(36) NOT NULL,
    `employee_profile_id` CHAR(36) NOT NULL,
    `payslip_number` VARCHAR(80) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `gross_amount` DECIMAL(15, 2) NOT NULL,
    `deductions_amount` DECIMAL(15, 2) NOT NULL,
    `net_amount` DECIMAL(15, 2) NOT NULL,
    `net_amount_in_words` VARCHAR(255) NULL,
    `snapshot_json` JSON NOT NULL,
    `download_token` VARCHAR(100) NOT NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_payslips_payroll_item_id_key`(`payroll_item_id`),
    UNIQUE INDEX `employee_payslips_download_token_key`(`download_token`),
    INDEX `employee_payslips_company_id_download_token_idx`(`company_id`, `download_token`),
    UNIQUE INDEX `employee_payslips_company_id_employee_profile_id_month_year_key`(`company_id`, `employee_profile_id`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `statutory_rules` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `rule_type` VARCHAR(50) NOT NULL,
    `effective_from` DATE NOT NULL,
    `effective_to` DATE NULL,
    `config_json` JSON NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `statutory_rules_company_id_rule_type_effective_from_idx`(`company_id`, `rule_type`, `effective_from`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_plants` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `plant_type` VARCHAR(60) NOT NULL DEFAULT 'ROOFTOP_INDUSTRIAL',
    `capacity_dc_kw` DECIMAL(10, 2) NOT NULL,
    `capacity_ac_kw` DECIMAL(10, 2) NOT NULL,
    `commission_date` DATE NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    `location_address` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `pincode` VARCHAR(20) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `grid_voltage` VARCHAR(60) NULL,
    `monthly_target_kwh` DECIMAL(12, 2) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solar_plants_company_id_status_idx`(`company_id`, `status`),
    INDEX `solar_plants_company_id_plant_type_idx`(`company_id`, `plant_type`),
    UNIQUE INDEX `solar_plants_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_inverters` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `inverter_code` VARCHAR(60) NOT NULL,
    `make` VARCHAR(100) NOT NULL,
    `model` VARCHAR(120) NOT NULL,
    `serial_number` VARCHAR(100) NOT NULL,
    `rated_capacity_kw` DECIMAL(10, 2) NOT NULL,
    `max_dc_power_kw` DECIMAL(10, 2) NULL,
    `mppt_channels` INTEGER NOT NULL DEFAULT 1,
    `strings_per_mppt` INTEGER NULL,
    `ip_address` VARCHAR(50) NULL,
    `modbus_address` INTEGER NULL,
    `gateway_id` VARCHAR(100) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'OFFLINE',
    `efficiency_percent` DECIMAL(5, 2) NULL,
    `last_telemetry_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solar_inverters_company_id_plant_id_idx`(`company_id`, `plant_id`),
    INDEX `solar_inverters_company_id_status_idx`(`company_id`, `status`),
    UNIQUE INDEX `solar_inverters_company_id_plant_id_serial_number_key`(`company_id`, `plant_id`, `serial_number`),
    UNIQUE INDEX `solar_inverters_company_id_plant_id_inverter_code_key`(`company_id`, `plant_id`, `inverter_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_panel_strings` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `inverter_id` CHAR(36) NULL,
    `string_id` VARCHAR(60) NOT NULL,
    `modules_count` INTEGER NOT NULL,
    `module_model` VARCHAR(120) NULL,
    `module_wattage_w` INTEGER NOT NULL,
    `total_wattage_wp` INTEGER NULL,
    `tilt_degrees` DECIMAL(5, 2) NULL,
    `azimuth_degrees` DECIMAL(5, 2) NULL,
    `orientation` VARCHAR(50) NULL,
    `mppt_index` INTEGER NULL,
    `vmp_rated` DECIMAL(8, 2) NULL,
    `imp_rated` DECIMAL(8, 2) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solar_panel_strings_company_id_plant_id_idx`(`company_id`, `plant_id`),
    INDEX `solar_panel_strings_company_id_inverter_id_idx`(`company_id`, `inverter_id`),
    UNIQUE INDEX `solar_panel_strings_company_id_plant_id_string_id_key`(`company_id`, `plant_id`, `string_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_plant_api_configs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(60) NOT NULL,
    `base_url` VARCHAR(255) NULL,
    `auth_type` VARCHAR(40) NOT NULL DEFAULT 'API_KEY',
    `encrypted_api_key` TEXT NULL,
    `encrypted_api_secret` TEXT NULL,
    `encrypted_access_token` TEXT NULL,
    `encrypted_refresh_token` TEXT NULL,
    `token_expires_at` DATETIME(3) NULL,
    `polling_interval_minutes` INTEGER NOT NULL DEFAULT 15,
    `is_polling_enabled` BOOLEAN NOT NULL DEFAULT false,
    `last_polled_at` DATETIME(3) NULL,
    `webhook_token` VARCHAR(100) NULL,
    `webhook_secret` VARCHAR(128) NULL,
    `is_webhook_enabled` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(30) NOT NULL DEFAULT 'INACTIVE',
    `last_sync_status` VARCHAR(50) NULL,
    `last_sync_error` TEXT NULL,
    `last_sync_at` DATETIME(3) NULL,
    `total_readings_count` BIGINT NOT NULL DEFAULT 0,
    `extra_config_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solar_plant_api_configs_plant_id_key`(`plant_id`),
    UNIQUE INDEX `solar_plant_api_configs_webhook_token_key`(`webhook_token`),
    INDEX `solar_plant_api_configs_company_id_provider_idx`(`company_id`, `provider`),
    INDEX `solar_plant_api_configs_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_telemetry_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `inverter_id` CHAR(36) NOT NULL,
    `timestamp` DATETIME(0) NOT NULL,
    `current_power_kw` DECIMAL(10, 2) NOT NULL,
    `daily_energy_kwh` DECIMAL(12, 2) NOT NULL,
    `total_energy_kwh` DECIMAL(14, 2) NOT NULL,
    `grid_voltage_v` DECIMAL(8, 2) NULL,
    `grid_current_a` DECIMAL(8, 2) NULL,
    `frequency_hz` DECIMAL(6, 2) NULL,
    `power_factor` DECIMAL(4, 3) NULL,
    `dc_power_kw` DECIMAL(10, 2) NULL,
    `dc_voltage_v` DECIMAL(8, 2) NULL,
    `dc_current_a` DECIMAL(8, 2) NULL,
    `temperature_c` DECIMAL(6, 2) NULL,
    `irradiance_wm2` DECIMAL(8, 2) NULL,
    `ambient_temp_c` DECIMAL(6, 2) NULL,
    `inverter_status` VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    `raw_payload_json` JSON NULL,
    `is_simulated` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `solar_telemetry_logs_company_id_plant_id_timestamp_idx`(`company_id`, `plant_id`, `timestamp`),
    INDEX `solar_telemetry_logs_company_id_timestamp_idx`(`company_id`, `timestamp`),
    INDEX `solar_telemetry_logs_plant_id_timestamp_idx`(`plant_id`, `timestamp`),
    UNIQUE INDEX `solar_telemetry_logs_inverter_id_timestamp_key`(`inverter_id`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_inverter_alarms` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `inverter_id` CHAR(36) NOT NULL,
    `alarm_code` VARCHAR(60) NOT NULL,
    `severity` VARCHAR(30) NOT NULL DEFAULT 'WARNING',
    `category` VARCHAR(60) NULL,
    `description` VARCHAR(255) NOT NULL,
    `triggered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `acknowledged_at` DATETIME(3) NULL,
    `acknowledged_by` VARCHAR(150) NULL,
    `acknowledgement_notes` TEXT NULL,
    `resolved_at` DATETIME(3) NULL,
    `resolved_by` VARCHAR(150) NULL,
    `resolution_notes` TEXT NULL,
    `ticket_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solar_inverter_alarms_company_id_plant_id_status_idx`(`company_id`, `plant_id`, `status`),
    INDEX `solar_inverter_alarms_inverter_id_status_idx`(`inverter_id`, `status`),
    INDEX `solar_inverter_alarms_company_id_severity_status_idx`(`company_id`, `severity`, `status`),
    INDEX `solar_inverter_alarms_company_id_triggered_at_idx`(`company_id`, `triggered_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_cleaning_schedules` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `array_block` VARCHAR(100) NOT NULL,
    `frequency` VARCHAR(40) NOT NULL DEFAULT 'MONTHLY',
    `last_cleaned_date` DATE NULL,
    `next_due_date` DATE NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    `inspector_id` CHAR(36) NULL,
    `inspector_name` VARCHAR(150) NULL,
    `completed_at` DATETIME(3) NULL,
    `water_used_liters` DECIMAL(10, 2) NULL,
    `soiling_loss_estimated_percent` DECIMAL(5, 2) NULL,
    `cleaning_method` VARCHAR(60) NULL,
    `inspection_remarks` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solar_cleaning_schedules_company_id_plant_id_status_idx`(`company_id`, `plant_id`, `status`),
    INDEX `solar_cleaning_schedules_company_id_next_due_date_idx`(`company_id`, `next_due_date`),
    INDEX `solar_cleaning_schedules_inspector_id_idx`(`inspector_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_maintenance_tickets` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `plant_id` CHAR(36) NOT NULL,
    `inverter_id` CHAR(36) NULL,
    `ticket_no` VARCHAR(60) NOT NULL,
    `category` VARCHAR(60) NOT NULL,
    `priority` VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
    `subject` VARCHAR(180) NOT NULL,
    `description` TEXT NOT NULL,
    `assigned_technician_id` CHAR(36) NULL,
    `technician_name` VARCHAR(150) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    `spare_parts_details` JSON NULL,
    `root_cause` TEXT NULL,
    `action_taken` TEXT NULL,
    `resolution_notes` TEXT NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solar_maintenance_tickets_company_id_plant_id_status_idx`(`company_id`, `plant_id`, `status`),
    INDEX `solar_maintenance_tickets_inverter_id_idx`(`inverter_id`),
    INDEX `solar_maintenance_tickets_assigned_technician_id_idx`(`assigned_technician_id`),
    INDEX `solar_maintenance_tickets_company_id_priority_status_idx`(`company_id`, `priority`, `status`),
    UNIQUE INDEX `solar_maintenance_tickets_company_id_ticket_no_key`(`company_id`, `ticket_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `dispatch_orders` ADD CONSTRAINT `dispatch_orders_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_orders` ADD CONSTRAINT `dispatch_orders_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_orders` ADD CONSTRAINT `dispatch_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_orders` ADD CONSTRAINT `dispatch_orders_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_order_items` ADD CONSTRAINT `dispatch_order_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_order_items` ADD CONSTRAINT `dispatch_order_items_dispatch_order_id_fkey` FOREIGN KEY (`dispatch_order_id`) REFERENCES `dispatch_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_order_items` ADD CONSTRAINT `dispatch_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_item_batch_allocations` ADD CONSTRAINT `dispatch_item_batch_allocations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_item_batch_allocations` ADD CONSTRAINT `dispatch_item_batch_allocations_dispatch_order_item_id_fkey` FOREIGN KEY (`dispatch_order_item_id`) REFERENCES `dispatch_order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_item_batch_allocations` ADD CONSTRAINT `dispatch_item_batch_allocations_inventory_batch_id_fkey` FOREIGN KEY (`inventory_batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_packages` ADD CONSTRAINT `dispatch_packages_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_packages` ADD CONSTRAINT `dispatch_packages_dispatch_order_id_fkey` FOREIGN KEY (`dispatch_order_id`) REFERENCES `dispatch_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_trackings` ADD CONSTRAINT `dispatch_trackings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dispatch_trackings` ADD CONSTRAINT `dispatch_trackings_dispatch_order_id_fkey` FOREIGN KEY (`dispatch_order_id`) REFERENCES `dispatch_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_returns` ADD CONSTRAINT `customer_returns_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_returns` ADD CONSTRAINT `customer_returns_dispatch_order_id_fkey` FOREIGN KEY (`dispatch_order_id`) REFERENCES `dispatch_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_returns` ADD CONSTRAINT `customer_returns_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_returns` ADD CONSTRAINT `customer_returns_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_returns` ADD CONSTRAINT `customer_returns_receiving_warehouse_id_fkey` FOREIGN KEY (`receiving_warehouse_id`) REFERENCES `inventory_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_items` ADD CONSTRAINT `customer_return_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_items` ADD CONSTRAINT `customer_return_items_customer_return_id_fkey` FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_items` ADD CONSTRAINT `customer_return_items_dispatch_order_item_id_fkey` FOREIGN KEY (`dispatch_order_item_id`) REFERENCES `dispatch_order_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_items` ADD CONSTRAINT `customer_return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_inspections` ADD CONSTRAINT `customer_return_inspections_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_inspections` ADD CONSTRAINT `customer_return_inspections_customer_return_id_fkey` FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_inspections` ADD CONSTRAINT `customer_return_inspections_customer_return_item_id_fkey` FOREIGN KEY (`customer_return_item_id`) REFERENCES `customer_return_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_inspections` ADD CONSTRAINT `customer_return_inspections_target_warehouse_id_fkey` FOREIGN KEY (`target_warehouse_id`) REFERENCES `inventory_warehouses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_return_inspections` ADD CONSTRAINT `customer_return_inspections_restock_batch_id_fkey` FOREIGN KEY (`restock_batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_notes` ADD CONSTRAINT `customer_credit_notes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_notes` ADD CONSTRAINT `customer_credit_notes_customer_return_id_fkey` FOREIGN KEY (`customer_return_id`) REFERENCES `customer_returns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_notes` ADD CONSTRAINT `customer_credit_notes_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_notes` ADD CONSTRAINT `customer_credit_notes_sales_invoice_id_fkey` FOREIGN KEY (`sales_invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_credit_notes` ADD CONSTRAINT `customer_credit_notes_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_years` ADD CONSTRAINT `financial_years_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_financial_year_id_fkey` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_groups` ADD CONSTRAINT `account_groups_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_groups` ADD CONSTRAINT `account_groups_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `account_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_masters` ADD CONSTRAINT `account_masters_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `account_masters` ADD CONSTRAINT `account_masters_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `account_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `account_masters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_dispatch_order_id_fkey` FOREIGN KEY (`dispatch_order_id`) REFERENCES `dispatch_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_financial_year_id_fkey` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_accounting_period_id_fkey` FOREIGN KEY (`accounting_period_id`) REFERENCES `accounting_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_items` ADD CONSTRAINT `sales_invoice_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_items` ADD CONSTRAINT `sales_invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_items` ADD CONSTRAINT `sales_invoice_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_invoice_items` ADD CONSTRAINT `sales_invoice_items_dispatch_order_item_id_fkey` FOREIGN KEY (`dispatch_order_item_id`) REFERENCES `dispatch_order_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_vouchers` ADD CONSTRAINT `journal_vouchers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_vouchers` ADD CONSTRAINT `journal_vouchers_financial_year_id_fkey` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_vouchers` ADD CONSTRAINT `journal_vouchers_accounting_period_id_fkey` FOREIGN KEY (`accounting_period_id`) REFERENCES `accounting_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_vouchers` ADD CONSTRAINT `journal_vouchers_reversal_of_voucher_id_fkey` FOREIGN KEY (`reversal_of_voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `account_masters`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_voucher_items` ADD CONSTRAINT `journal_voucher_items_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `purchase_bills`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `crm_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_receipt_id_fkey` FOREIGN KEY (`payment_receipt_id`) REFERENCES `payment_receipts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `purchase_bills`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_debit_notes` ADD CONSTRAINT `vendor_debit_notes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_debit_notes` ADD CONSTRAINT `vendor_debit_notes_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_debit_notes` ADD CONSTRAINT `vendor_debit_notes_purchase_bill_id_fkey` FOREIGN KEY (`purchase_bill_id`) REFERENCES `purchase_bills`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_debit_notes` ADD CONSTRAINT `vendor_debit_notes_job_work_reconciliation_id_fkey` FOREIGN KEY (`job_work_reconciliation_id`) REFERENCES `job_work_reconciliations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_debit_notes` ADD CONSTRAINT `vendor_debit_notes_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_reconciliation_id_fkey` FOREIGN KEY (`reconciliation_id`) REFERENCES `bank_reconciliations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliations` ADD CONSTRAINT `bank_reconciliations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliations` ADD CONSTRAINT `bank_reconciliations_bank_account_id_fkey` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliation_items` ADD CONSTRAINT `bank_reconciliation_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliation_items` ADD CONSTRAINT `bank_reconciliation_items_reconciliation_id_fkey` FOREIGN KEY (`reconciliation_id`) REFERENCES `bank_reconciliations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliation_items` ADD CONSTRAINT `bank_reconciliation_items_bank_transaction_id_fkey` FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliation_items` ADD CONSTRAINT `bank_reconciliation_items_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bank_reconciliation_items` ADD CONSTRAINT `bank_reconciliation_items_voucher_item_id_fkey` FOREIGN KEY (`voucher_item_id`) REFERENCES `journal_voucher_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tally_ledger_mappings` ADD CONSTRAINT `tally_ledger_mappings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tally_ledger_mappings` ADD CONSTRAINT `tally_ledger_mappings_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `account_masters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tally_sync_batches` ADD CONSTRAINT `tally_sync_batches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tally_voucher_mappings` ADD CONSTRAINT `tally_voucher_mappings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tally_voucher_mappings` ADD CONSTRAINT `tally_voucher_mappings_sync_batch_id_fkey` FOREIGN KEY (`sync_batch_id`) REFERENCES `tally_sync_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tally_voucher_mappings` ADD CONSTRAINT `tally_voucher_mappings_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_designations` ADD CONSTRAINT `employee_designations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_designations` ADD CONSTRAINT `employee_designations_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profiles` ADD CONSTRAINT `employee_profiles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profiles` ADD CONSTRAINT `employee_profiles_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `company_employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profiles` ADD CONSTRAINT `employee_profiles_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profiles` ADD CONSTRAINT `employee_profiles_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `employee_designations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profiles` ADD CONSTRAINT `employee_profiles_reporting_manager_id_fkey` FOREIGN KEY (`reporting_manager_id`) REFERENCES `employee_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_kyc` ADD CONSTRAINT `employee_kyc_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_kyc` ADD CONSTRAINT `employee_kyc_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_documents` ADD CONSTRAINT `employee_documents_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shift_policies` ADD CONSTRAINT `shift_policies_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_shift_rosters` ADD CONSTRAINT `employee_shift_rosters_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_shift_rosters` ADD CONSTRAINT `employee_shift_rosters_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_shift_rosters` ADD CONSTRAINT `employee_shift_rosters_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shift_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_attendances` ADD CONSTRAINT `daily_attendances_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_attendances` ADD CONSTRAINT `daily_attendances_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_attendances` ADD CONSTRAINT `daily_attendances_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shift_policies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_regularizations` ADD CONSTRAINT `attendance_regularizations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_regularizations` ADD CONSTRAINT `attendance_regularizations_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_types` ADD CONSTRAINT `leave_types_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_policies` ADD CONSTRAINT `leave_policies_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_policies` ADD CONSTRAINT `leave_policies_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leave_balances` ADD CONSTRAINT `employee_leave_balances_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leave_balances` ADD CONSTRAINT `employee_leave_balances_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_leave_balances` ADD CONSTRAINT `employee_leave_balances_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `biometric_devices` ADD CONSTRAINT `biometric_devices_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `biometric_punch_logs` ADD CONSTRAINT `biometric_punch_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `biometric_punch_logs` ADD CONSTRAINT `biometric_punch_logs_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `biometric_devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `biometric_punch_logs` ADD CONSTRAINT `biometric_punch_logs_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_components` ADD CONSTRAINT `salary_components_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_structures` ADD CONSTRAINT `salary_structures_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_assignments` ADD CONSTRAINT `employee_salary_assignments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_assignments` ADD CONSTRAINT `employee_salary_assignments_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_salary_assignments` ADD CONSTRAINT `employee_salary_assignments_salary_structure_id_fkey` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_batches` ADD CONSTRAINT `payroll_batches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_batches` ADD CONSTRAINT `payroll_batches_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `journal_vouchers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_payroll_batch_id_fkey` FOREIGN KEY (`payroll_batch_id`) REFERENCES `payroll_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payroll_items` ADD CONSTRAINT `payroll_items_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_payslips` ADD CONSTRAINT `employee_payslips_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_payslips` ADD CONSTRAINT `employee_payslips_payroll_item_id_fkey` FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_payslips` ADD CONSTRAINT `employee_payslips_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profiles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `statutory_rules` ADD CONSTRAINT `statutory_rules_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_plants` ADD CONSTRAINT `solar_plants_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_inverters` ADD CONSTRAINT `solar_inverters_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_inverters` ADD CONSTRAINT `solar_inverters_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_panel_strings` ADD CONSTRAINT `solar_panel_strings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_panel_strings` ADD CONSTRAINT `solar_panel_strings_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_panel_strings` ADD CONSTRAINT `solar_panel_strings_inverter_id_fkey` FOREIGN KEY (`inverter_id`) REFERENCES `solar_inverters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_plant_api_configs` ADD CONSTRAINT `solar_plant_api_configs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_plant_api_configs` ADD CONSTRAINT `solar_plant_api_configs_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_telemetry_logs` ADD CONSTRAINT `solar_telemetry_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_telemetry_logs` ADD CONSTRAINT `solar_telemetry_logs_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_telemetry_logs` ADD CONSTRAINT `solar_telemetry_logs_inverter_id_fkey` FOREIGN KEY (`inverter_id`) REFERENCES `solar_inverters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_inverter_alarms` ADD CONSTRAINT `solar_inverter_alarms_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_inverter_alarms` ADD CONSTRAINT `solar_inverter_alarms_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_inverter_alarms` ADD CONSTRAINT `solar_inverter_alarms_inverter_id_fkey` FOREIGN KEY (`inverter_id`) REFERENCES `solar_inverters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_inverter_alarms` ADD CONSTRAINT `solar_inverter_alarms_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `solar_maintenance_tickets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_cleaning_schedules` ADD CONSTRAINT `solar_cleaning_schedules_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_cleaning_schedules` ADD CONSTRAINT `solar_cleaning_schedules_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_cleaning_schedules` ADD CONSTRAINT `solar_cleaning_schedules_inspector_id_fkey` FOREIGN KEY (`inspector_id`) REFERENCES `company_employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_maintenance_tickets` ADD CONSTRAINT `solar_maintenance_tickets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_maintenance_tickets` ADD CONSTRAINT `solar_maintenance_tickets_plant_id_fkey` FOREIGN KEY (`plant_id`) REFERENCES `solar_plants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_maintenance_tickets` ADD CONSTRAINT `solar_maintenance_tickets_inverter_id_fkey` FOREIGN KEY (`inverter_id`) REFERENCES `solar_inverters`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_maintenance_tickets` ADD CONSTRAINT `solar_maintenance_tickets_assigned_technician_id_fkey` FOREIGN KEY (`assigned_technician_id`) REFERENCES `company_employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

