ALTER TABLE `company_employees`
    ADD COLUMN `permissions` JSON NULL;

CREATE TABLE `service_work_items` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `service_id` BIGINT NOT NULL,
    `created_by_id` BIGINT NULL,
    `created_by_name` VARCHAR(180) NOT NULL,
    `assigned_to_id` BIGINT NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE') NOT NULL DEFAULT 'TODO',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `due_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_work_items_company_id_service_id_status_idx`(`company_id`, `service_id`, `status`),
    INDEX `service_work_items_assigned_to_id_status_idx`(`assigned_to_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `service_work_updates` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `work_item_id` BIGINT NOT NULL,
    `author_id` BIGINT NULL,
    `author_name` VARCHAR(180) NOT NULL,
    `status` ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE') NULL,
    `progress` INTEGER NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `service_work_updates_work_item_id_created_at_idx`(`work_item_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `service_work_items`
    ADD CONSTRAINT `service_work_items_company_id_fkey`
        FOREIGN KEY (`company_id`) REFERENCES `client_admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `service_work_items_service_id_fkey`
        FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `service_work_items_created_by_id_fkey`
        FOREIGN KEY (`created_by_id`) REFERENCES `company_employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `service_work_items_assigned_to_id_fkey`
        FOREIGN KEY (`assigned_to_id`) REFERENCES `company_employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `service_work_updates`
    ADD CONSTRAINT `service_work_updates_work_item_id_fkey`
        FOREIGN KEY (`work_item_id`) REFERENCES `service_work_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `service_work_updates_author_id_fkey`
        FOREIGN KEY (`author_id`) REFERENCES `company_employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
