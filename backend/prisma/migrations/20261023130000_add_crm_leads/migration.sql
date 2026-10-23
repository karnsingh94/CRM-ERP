CREATE TABLE `crm_leads` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `company` VARCHAR(180) NULL,
  `email` VARCHAR(180) NOT NULL,
  `phone` VARCHAR(40) NULL,
  `source` VARCHAR(100) NOT NULL DEFAULT 'Website Inquiry',
  `value` DECIMAL(15, 2) NULL,
  `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST') NOT NULL DEFAULT 'NEW',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `crm_leads_company_id_status_created_at_idx` (`company_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `crm_leads_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `Admins` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
