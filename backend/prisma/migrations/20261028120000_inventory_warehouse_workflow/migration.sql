-- Extend the inventory balance table without changing existing CRM, sales,
-- purchase/vendor or manufacturing service tables.
ALTER TABLE `inventory_stocks`
  ADD COLUMN `reserved_stock` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `item_type` VARCHAR(40) NOT NULL DEFAULT 'FINISHED_GOOD',
  ADD COLUMN `bin_location` VARCHAR(100) NULL,
  ADD COLUMN `average_cost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `product_id` CHAR(36) NULL,
  ADD COLUMN `bin_id` CHAR(36) NULL;

CREATE TABLE `inventory_warehouses` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `code` VARCHAR(40) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `address` TEXT NULL,
  `contact_name` VARCHAR(150) NULL,
  `contact_phone` VARCHAR(40) NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_warehouses_company_id_code_key`(`company_id`, `code`),
  UNIQUE INDEX `inventory_warehouses_company_id_name_key`(`company_id`, `name`),
  INDEX `inventory_warehouses_company_id_status_idx`(`company_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Link existing warehouse balances to Product Master by company + SKU.
UPDATE `inventory_stocks` AS s
INNER JOIN `products` AS p ON p.`company_id` = s.`company_id` AND p.`sku` = s.`sku`
SET s.`product_id` = p.`id`, s.`item_type` = 'FINISHED_GOOD'
WHERE s.`product_id` IS NULL;

-- Products that only had the legacy Product.stock balance become visible in
-- the new warehouse ledger without duplicating an existing SKU balance.
INSERT INTO `inventory_stocks` (
  `id`, `company_id`, `product_id`, `sku`, `name`, `warehouse`, `stock`,
  `reserved_stock`, `reorder_level`, `uom`, `item_type`, `average_cost`,
  `created_at`, `updated_at`
)
SELECT
  UUID(), p.`company_id`, p.`id`, p.`sku`, p.`name`, 'Main Warehouse', p.`stock`,
  0, 10, p.`uom`, 'FINISHED_GOOD', p.`purchase_price`, NOW(3), NOW(3)
FROM `products` AS p
WHERE NOT EXISTS (
  SELECT 1 FROM `inventory_stocks` AS s
  WHERE s.`company_id` = p.`company_id` AND s.`sku` = p.`sku`
);

-- Existing balances get a usable default physical warehouse automatically.
INSERT INTO `inventory_warehouses` (
  `id`, `company_id`, `code`, `name`, `is_default`, `status`, `created_at`, `updated_at`
)
SELECT UUID(), companies.`company_id`, 'MAIN', 'Main Warehouse', true, 'ACTIVE', NOW(3), NOW(3)
FROM (SELECT DISTINCT `company_id` FROM `inventory_stocks`) AS companies
WHERE NOT EXISTS (
  SELECT 1 FROM `inventory_warehouses` AS w
  WHERE w.`company_id` = companies.`company_id` AND w.`name` = 'Main Warehouse'
);

CREATE TABLE `inventory_movements` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `stock_id` CHAR(36) NULL,
  `movement_no` VARCHAR(60) NOT NULL,
  `movement_type` VARCHAR(50) NOT NULL,
  `sku` VARCHAR(60) NOT NULL,
  `item_name` VARCHAR(180) NOT NULL,
  `warehouse` VARCHAR(100) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `balance_after` INTEGER NOT NULL,
  `uom` VARCHAR(30) NOT NULL DEFAULT 'PCS',
  `unit_cost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `reference_type` VARCHAR(50) NULL,
  `reference_id` CHAR(36) NULL,
  `reference_no` VARCHAR(60) NULL,
  `reason` VARCHAR(180) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(150) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_movements_company_id_movement_no_key`(`company_id`, `movement_no`),
  INDEX `inventory_movements_company_id_sku_created_at_idx`(`company_id`, `sku`, `created_at`),
  INDEX `inventory_movements_company_id_movement_type_created_at_idx`(`company_id`, `movement_type`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_bins` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `warehouse_id` CHAR(36) NOT NULL,
  `code` VARCHAR(60) NOT NULL,
  `aisle` VARCHAR(60) NULL,
  `rack` VARCHAR(60) NULL,
  `description` VARCHAR(180) NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_bins_warehouse_id_code_key`(`warehouse_id`, `code`),
  INDEX `inventory_bins_company_id_status_idx`(`company_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_transfers` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `transfer_no` VARCHAR(60) NOT NULL,
  `from_warehouse` VARCHAR(120) NOT NULL,
  `to_warehouse` VARCHAR(120) NOT NULL,
  `items` JSON NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'IN_TRANSIT',
  `notes` TEXT NULL,
  `dispatched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `received_at` DATETIME(3) NULL,
  `created_by` VARCHAR(150) NULL,
  `received_by` VARCHAR(150) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_transfers_company_id_transfer_no_key`(`company_id`, `transfer_no`),
  INDEX `inventory_transfers_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_fulfillments` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `sales_order_id` CHAR(36) NOT NULL,
  `order_no` VARCHAR(60) NOT NULL,
  `customer` VARCHAR(180) NOT NULL,
  `requested_items` JSON NOT NULL,
  `shortage_items` JSON NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_CHECK',
  `notes` TEXT NULL,
  `processed_at` DATETIME(3) NULL,
  `fulfilled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_fulfillments_sales_order_id_key`(`sales_order_id`),
  INDEX `inventory_fulfillments_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_material_requests` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `fulfillment_id` CHAR(36) NOT NULL,
  `request_no` VARCHAR(60) NOT NULL,
  `product_sku` VARCHAR(60) NOT NULL,
  `product_name` VARCHAR(180) NOT NULL,
  `requested_qty` INTEGER NOT NULL,
  `uom` VARCHAR(30) NOT NULL DEFAULT 'PCS',
  `raw_materials` JSON NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'MATERIAL_LIST_PENDING',
  `notes` TEXT NULL,
  `issued_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_material_requests_company_id_request_no_key`(`company_id`, `request_no`),
  INDEX `inventory_material_requests_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_procurement_requests` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `material_request_id` CHAR(36) NOT NULL,
  `request_no` VARCHAR(60) NOT NULL,
  `sku` VARCHAR(60) NOT NULL,
  `item_name` VARCHAR(180) NOT NULL,
  `required_qty` INTEGER NOT NULL,
  `received_qty` INTEGER NOT NULL DEFAULT 0,
  `uom` VARCHAR(30) NOT NULL DEFAULT 'PCS',
  `vendor_name` VARCHAR(180) NULL,
  `unit_cost` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING_PURCHASE',
  `expected_date` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `received_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_procurement_requests_company_id_request_no_key`(`company_id`, `request_no`),
  INDEX `inventory_procurement_requests_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_production_receipts` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `material_request_id` CHAR(36) NOT NULL,
  `receipt_no` VARCHAR(60) NOT NULL,
  `product_sku` VARCHAR(60) NOT NULL,
  `product_name` VARCHAR(180) NOT NULL,
  `produced_qty` INTEGER NOT NULL,
  `waste_qty` INTEGER NOT NULL DEFAULT 0,
  `waste_reason` VARCHAR(180) NULL,
  `raw_material_consumed` JSON NULL,
  `returned_materials` JSON NULL,
  `warehouse` VARCHAR(100) NOT NULL DEFAULT 'Main Warehouse',
  `notes` TEXT NULL,
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_production_receipts_material_request_id_key`(`material_request_id`),
  UNIQUE INDEX `inventory_production_receipts_company_id_receipt_no_key`(`company_id`, `receipt_no`),
  INDEX `inventory_production_receipts_company_id_received_at_idx`(`company_id`, `received_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_warehouses` ADD CONSTRAINT `inventory_warehouses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_stocks` ADD INDEX `inventory_stocks_product_id_idx`(`product_id`);
ALTER TABLE `inventory_stocks` ADD INDEX `inventory_stocks_bin_id_idx`(`bin_id`);
ALTER TABLE `inventory_stocks` ADD CONSTRAINT `inventory_stocks_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_bins` ADD CONSTRAINT `inventory_bins_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_bins` ADD CONSTRAINT `inventory_bins_warehouse_id_fkey` FOREIGN KEY (`warehouse_id`) REFERENCES `inventory_warehouses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_stocks` ADD CONSTRAINT `inventory_stocks_bin_id_fkey` FOREIGN KEY (`bin_id`) REFERENCES `inventory_bins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_transfers` ADD CONSTRAINT `inventory_transfers_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_stock_id_fkey` FOREIGN KEY (`stock_id`) REFERENCES `inventory_stocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `inventory_fulfillments` ADD CONSTRAINT `inventory_fulfillments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_fulfillments` ADD CONSTRAINT `inventory_fulfillments_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_material_requests` ADD CONSTRAINT `inventory_material_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_material_requests` ADD CONSTRAINT `inventory_material_requests_fulfillment_id_fkey` FOREIGN KEY (`fulfillment_id`) REFERENCES `inventory_fulfillments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_procurement_requests` ADD CONSTRAINT `inventory_procurement_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_procurement_requests` ADD CONSTRAINT `inventory_procurement_requests_material_request_id_fkey` FOREIGN KEY (`material_request_id`) REFERENCES `inventory_material_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_production_receipts` ADD CONSTRAINT `inventory_production_receipts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_production_receipts` ADD CONSTRAINT `inventory_production_receipts_material_request_id_fkey` FOREIGN KEY (`material_request_id`) REFERENCES `inventory_material_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
