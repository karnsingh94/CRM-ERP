-- DropForeignKey
ALTER TABLE `admin_module_access` DROP FOREIGN KEY `client_module_access_client_admin_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_module_access` DROP FOREIGN KEY `client_module_access_module_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_module_access` DROP FOREIGN KEY `client_module_access_service_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_service_access` DROP FOREIGN KEY `client_service_access_client_admin_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_service_access` DROP FOREIGN KEY `client_service_access_service_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_sub_module_access` DROP FOREIGN KEY `client_sub_module_access_client_admin_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_sub_module_access` DROP FOREIGN KEY `client_sub_module_access_module_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_sub_module_access` DROP FOREIGN KEY `client_sub_module_access_service_id_fkey`;

-- DropForeignKey
ALTER TABLE `admin_sub_module_access` DROP FOREIGN KEY `client_sub_module_access_sub_module_id_fkey`;

-- DropForeignKey
ALTER TABLE `admins` DROP FOREIGN KEY `client_admins_created_by_fkey`;

-- AddForeignKey
ALTER TABLE `Admins` ADD CONSTRAINT `Admins_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `super_admins`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_service_access` ADD CONSTRAINT `Admin_service_access_client_admin_id_fkey` FOREIGN KEY (`client_admin_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_service_access` ADD CONSTRAINT `Admin_service_access_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_module_access` ADD CONSTRAINT `Admin_module_access_client_admin_id_fkey` FOREIGN KEY (`client_admin_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_module_access` ADD CONSTRAINT `Admin_module_access_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_module_access` ADD CONSTRAINT `Admin_module_access_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_sub_module_access` ADD CONSTRAINT `Admin_sub_module_access_client_admin_id_fkey` FOREIGN KEY (`client_admin_id`) REFERENCES `Admins`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_sub_module_access` ADD CONSTRAINT `Admin_sub_module_access_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_sub_module_access` ADD CONSTRAINT `Admin_sub_module_access_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Admin_sub_module_access` ADD CONSTRAINT `Admin_sub_module_access_sub_module_id_fkey` FOREIGN KEY (`sub_module_id`) REFERENCES `sub_modules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `Admin_module_access_client_admin_id_service_id_module_id_key` ON `Admin_module_access`(`client_admin_id`, `service_id`, `module_id`);
DROP INDEX `client_module_access_client_admin_id_service_id_module_id_key` ON `admin_module_access`;

-- RedefineIndex
CREATE UNIQUE INDEX `Admin_service_access_client_admin_id_service_id_key` ON `Admin_service_access`(`client_admin_id`, `service_id`);
DROP INDEX `client_service_access_client_admin_id_service_id_key` ON `admin_service_access`;

-- RedefineIndex
CREATE UNIQUE INDEX `Admin_sub_module_access_client_admin_id_service_id_module_id_key` ON `Admin_sub_module_access`(`client_admin_id`, `service_id`, `module_id`, `sub_module_id`);
DROP INDEX `client_sub_module_access_client_admin_id_service_id_module_i_key` ON `admin_sub_module_access`;

-- RedefineIndex
CREATE UNIQUE INDEX `Admins_email_key` ON `Admins`(`email`);
DROP INDEX `client_admins_email_key` ON `admins`;
