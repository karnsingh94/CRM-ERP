ALTER TABLE `Admin_service_access`
  DROP FOREIGN KEY `client_service_access_client_admin_id_fkey`,
  DROP INDEX `client_service_access_client_admin_id_service_id_key`,
  DROP PRIMARY KEY,
  DROP COLUMN `id`,
  CHANGE COLUMN `client_admin_id` `admin_id` BIGINT NOT NULL,
  ADD PRIMARY KEY (`admin_id`, `service_id`),
  ADD CONSTRAINT `Admin_service_access_admin_id_fkey`
    FOREIGN KEY (`admin_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Admin_module_access`
  DROP FOREIGN KEY `client_module_access_client_admin_id_fkey`,
  DROP INDEX `client_module_access_client_admin_id_service_id_module_id_key`,
  DROP PRIMARY KEY,
  DROP COLUMN `id`,
  CHANGE COLUMN `client_admin_id` `admin_id` BIGINT NOT NULL,
  ADD PRIMARY KEY (`admin_id`, `service_id`, `module_id`),
  ADD CONSTRAINT `Admin_module_access_admin_id_fkey`
    FOREIGN KEY (`admin_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Admin_sub_module_access`
  DROP FOREIGN KEY `client_sub_module_access_client_admin_id_fkey`,
  DROP INDEX `client_sub_module_access_client_admin_id_service_id_module_i_key`,
  DROP PRIMARY KEY,
  DROP COLUMN `id`,
  CHANGE COLUMN `client_admin_id` `admin_id` BIGINT NOT NULL,
  ADD PRIMARY KEY (`admin_id`, `service_id`, `module_id`, `sub_module_id`),
  ADD CONSTRAINT `Admin_sub_module_access_admin_id_fkey`
    FOREIGN KEY (`admin_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
