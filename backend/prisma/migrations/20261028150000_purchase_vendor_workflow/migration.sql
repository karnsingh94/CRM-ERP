-- Extend the existing vendor master without removing existing supplier records.
ALTER TABLE `vendors`
    ADD COLUMN `vendor_code` VARCHAR(40) NULL,
    ADD COLUMN `tax_id` VARCHAR(60) NULL,
    ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `payment_terms` VARCHAR(100) NULL DEFAULT '30 Days',
    ADD COLUMN `lead_time_days` INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX `vendors_company_id_vendor_code_key` ON `vendors`(`company_id`, `vendor_code`);
DROP INDEX `vendors_company_id_category_created_at_idx` ON `vendors`;
CREATE INDEX `vendors_company_id_category_status_created_at_idx` ON `vendors`(`company_id`, `category`, `status`, `created_at`);

CREATE TABLE `purchase_requests` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `request_no` VARCHAR(60) NOT NULL,
    `request_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `required_by` DATETIME(3) NULL,
    `department` VARCHAR(120) NULL,
    `requested_by` VARCHAR(150) NULL,
    `purpose` TEXT NULL,
    `items` JSON NOT NULL,
    `source_type` VARCHAR(50) NULL,
    `source_ref` VARCHAR(100) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_QUOTATION',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_requests_company_id_request_no_key`(`company_id`, `request_no`),
    INDEX `purchase_requests_company_id_status_request_date_idx`(`company_id`, `status`, `request_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_quotations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `vendor_id` CHAR(36) NOT NULL,
    `quote_no` VARCHAR(60) NOT NULL,
    `vendor_quote_no` VARCHAR(80) NULL,
    `quote_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `valid_until` DATETIME(3) NULL,
    `items` JSON NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `freight_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `delivery_days` INTEGER NOT NULL DEFAULT 7,
    `payment_terms` VARCHAR(100) NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'RECEIVED',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_quotations_company_id_quote_no_key`(`company_id`, `quote_no`),
    UNIQUE INDEX `purchase_quotations_request_id_vendor_id_key`(`request_id`, `vendor_id`),
    INDEX `purchase_quotations_company_id_status_quote_date_idx`(`company_id`, `status`, `quote_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_orders` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `request_id` CHAR(36) NOT NULL,
    `quotation_id` CHAR(36) NOT NULL,
    `vendor_id` CHAR(36) NOT NULL,
    `po_number` VARCHAR(60) NOT NULL,
    `order_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_date` DATETIME(3) NULL,
    `items` JSON NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `freight_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `delivery_address` TEXT NULL,
    `payment_terms` VARCHAR(100) NULL,
    `terms` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'ISSUED',
    `issued_by` VARCHAR(150) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_orders_quotation_id_key`(`quotation_id`),
    UNIQUE INDEX `purchase_orders_company_id_po_number_key`(`company_id`, `po_number`),
    INDEX `purchase_orders_company_id_status_order_date_idx`(`company_id`, `status`, `order_date`),
    INDEX `purchase_orders_vendor_id_order_date_idx`(`vendor_id`, `order_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_receipts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `grn_no` VARCHAR(60) NOT NULL,
    `warehouse` VARCHAR(120) NOT NULL,
    `items` JSON NOT NULL,
    `received_qty` INTEGER NOT NULL DEFAULT 0,
    `accepted_qty` INTEGER NOT NULL DEFAULT 0,
    `rejected_qty` INTEGER NOT NULL DEFAULT 0,
    `qc_status` VARCHAR(40) NOT NULL DEFAULT 'PASSED',
    `received_by` VARCHAR(150) NULL,
    `notes` TEXT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `purchase_receipts_company_id_grn_no_key`(`company_id`, `grn_no`),
    INDEX `purchase_receipts_company_id_qc_status_received_at_idx`(`company_id`, `qc_status`, `received_at`),
    INDEX `purchase_receipts_order_id_received_at_idx`(`order_id`, `received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_returns` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `receipt_id` CHAR(36) NOT NULL,
    `return_no` VARCHAR(60) NOT NULL,
    `items` JSON NOT NULL,
    `total_qty` INTEGER NOT NULL DEFAULT 0,
    `reason` TEXT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'PENDING_DISPATCH',
    `credit_note_no` VARCHAR(80) NULL,
    `notes` TEXT NULL,
    `dispatched_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_returns_company_id_return_no_key`(`company_id`, `return_no`),
    INDEX `purchase_returns_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_bills` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `bill_no` VARCHAR(60) NOT NULL,
    `vendor_invoice_no` VARCHAR(80) NOT NULL,
    `invoice_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_date` DATETIME(3) NULL,
    `taxable_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `other_charges` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `status` VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
    `payment_reference` VARCHAR(100) NULL,
    `paid_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_bills_order_id_key`(`order_id`),
    UNIQUE INDEX `purchase_bills_company_id_bill_no_key`(`company_id`, `bill_no`),
    UNIQUE INDEX `purchase_bills_company_id_vendor_invoice_no_key`(`company_id`, `vendor_invoice_no`),
    INDEX `purchase_bills_company_id_status_due_date_idx`(`company_id`, `status`, `due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_requests` ADD CONSTRAINT `purchase_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_quotations` ADD CONSTRAINT `purchase_quotations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_quotations` ADD CONSTRAINT `purchase_quotations_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_quotations` ADD CONSTRAINT `purchase_quotations_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `purchase_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_quotation_id_fkey` FOREIGN KEY (`quotation_id`) REFERENCES `purchase_quotations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_receipts` ADD CONSTRAINT `purchase_receipts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_receipts` ADD CONSTRAINT `purchase_receipts_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `purchase_receipts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_bills` ADD CONSTRAINT `purchase_bills_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_bills` ADD CONSTRAINT `purchase_bills_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
