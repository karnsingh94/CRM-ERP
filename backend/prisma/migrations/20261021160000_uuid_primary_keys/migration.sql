CREATE TEMPORARY TABLE `_uuid_super_admins` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_services` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_modules` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_sub_modules` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_admins` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_audit_logs` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_departments` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_company_service_teams` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_company_employees` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_service_work_items` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);
CREATE TEMPORARY TABLE `_uuid_service_work_updates` (`old_id` BIGINT NOT NULL PRIMARY KEY, `new_id` CHAR(36) NOT NULL);

INSERT INTO `_uuid_super_admins` SELECT `id`, UUID() FROM `super_admins`;
INSERT INTO `_uuid_services` SELECT `id`, UUID() FROM `services`;
INSERT INTO `_uuid_modules` SELECT `id`, UUID() FROM `modules`;
INSERT INTO `_uuid_sub_modules` SELECT `id`, UUID() FROM `sub_modules`;
INSERT INTO `_uuid_admins` SELECT `id`, UUID() FROM `Admins`;
INSERT INTO `_uuid_audit_logs` SELECT `id`, UUID() FROM `audit_logs`;
INSERT INTO `_uuid_departments` SELECT `id`, UUID() FROM `departments`;
INSERT INTO `_uuid_company_service_teams` SELECT `id`, UUID() FROM `company_service_teams`;
INSERT INTO `_uuid_company_employees` SELECT `id`, UUID() FROM `company_employees`;
INSERT INTO `_uuid_service_work_items` SELECT `id`, UUID() FROM `service_work_items`;
INSERT INTO `_uuid_service_work_updates` SELECT `id`, UUID() FROM `service_work_updates`;

ALTER TABLE `super_admins` ADD COLUMN `_uuid_id` CHAR(36) NULL;
ALTER TABLE `services`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_created_by` CHAR(36) NULL;
ALTER TABLE `modules`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_created_by` CHAR(36) NULL;
ALTER TABLE `sub_modules`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_module_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_created_by` CHAR(36) NULL;
ALTER TABLE `Admins`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_created_by` CHAR(36) NULL;
ALTER TABLE `Admin_service_access`
  ADD COLUMN `_uuid_admin_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_assigned_by` CHAR(36) NULL;
ALTER TABLE `Admin_module_access`
  ADD COLUMN `_uuid_admin_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_module_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_assigned_by` CHAR(36) NULL;
ALTER TABLE `Admin_sub_module_access`
  ADD COLUMN `_uuid_admin_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_module_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_sub_module_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_assigned_by` CHAR(36) NULL;
ALTER TABLE `audit_logs`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_actor_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_entity_id` CHAR(36) NULL;
ALTER TABLE `departments`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_company_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_head_id` CHAR(36) NULL;
ALTER TABLE `company_service_teams`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_company_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_head_employee_id` CHAR(36) NULL;
ALTER TABLE `company_employees`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_company_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_department_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_team_id` CHAR(36) NULL;
ALTER TABLE `service_work_items`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_company_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_service_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_created_by_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_assigned_to_id` CHAR(36) NULL;
ALTER TABLE `service_work_updates`
  ADD COLUMN `_uuid_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_work_item_id` CHAR(36) NULL,
  ADD COLUMN `_uuid_author_id` CHAR(36) NULL;

UPDATE `super_admins` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `services` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `services` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`created_by` SET `t`.`_uuid_created_by` = `m`.`new_id`;
UPDATE `modules` AS `t` JOIN `_uuid_modules` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `modules` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `modules` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`created_by` SET `t`.`_uuid_created_by` = `m`.`new_id`;
UPDATE `sub_modules` AS `t` JOIN `_uuid_sub_modules` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `sub_modules` AS `t` JOIN `_uuid_modules` AS `m` ON `m`.`old_id` = `t`.`module_id` SET `t`.`_uuid_module_id` = `m`.`new_id`;
UPDATE `sub_modules` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `sub_modules` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`created_by` SET `t`.`_uuid_created_by` = `m`.`new_id`;
UPDATE `Admins` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `Admins` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`created_by` SET `t`.`_uuid_created_by` = `m`.`new_id`;

UPDATE `Admin_service_access` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`admin_id` SET `t`.`_uuid_admin_id` = `m`.`new_id`;
UPDATE `Admin_service_access` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `Admin_service_access` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`assigned_by` SET `t`.`_uuid_assigned_by` = `m`.`new_id`;
UPDATE `Admin_module_access` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`admin_id` SET `t`.`_uuid_admin_id` = `m`.`new_id`;
UPDATE `Admin_module_access` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `Admin_module_access` AS `t` JOIN `_uuid_modules` AS `m` ON `m`.`old_id` = `t`.`module_id` SET `t`.`_uuid_module_id` = `m`.`new_id`;
UPDATE `Admin_module_access` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`assigned_by` SET `t`.`_uuid_assigned_by` = `m`.`new_id`;
UPDATE `Admin_sub_module_access` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`admin_id` SET `t`.`_uuid_admin_id` = `m`.`new_id`;
UPDATE `Admin_sub_module_access` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `Admin_sub_module_access` AS `t` JOIN `_uuid_modules` AS `m` ON `m`.`old_id` = `t`.`module_id` SET `t`.`_uuid_module_id` = `m`.`new_id`;
UPDATE `Admin_sub_module_access` AS `t` JOIN `_uuid_sub_modules` AS `m` ON `m`.`old_id` = `t`.`sub_module_id` SET `t`.`_uuid_sub_module_id` = `m`.`new_id`;
UPDATE `Admin_sub_module_access` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`assigned_by` SET `t`.`_uuid_assigned_by` = `m`.`new_id`;

UPDATE `audit_logs` AS `t` JOIN `_uuid_audit_logs` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `audit_logs` AS `t` JOIN `_uuid_super_admins` AS `m` ON `m`.`old_id` = `t`.`actor_id` SET `t`.`_uuid_actor_id` = `m`.`new_id`;
UPDATE `audit_logs` AS `t`
  LEFT JOIN `_uuid_super_admins` AS `sa` ON `sa`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_services` AS `sv` ON `sv`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_modules` AS `mo` ON `mo`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_sub_modules` AS `sm` ON `sm`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_admins` AS `ad` ON `ad`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_departments` AS `dp` ON `dp`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_company_service_teams` AS `tm` ON `tm`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_company_employees` AS `em` ON `em`.`old_id` = `t`.`entity_id`
  LEFT JOIN `_uuid_service_work_items` AS `wi` ON `wi`.`old_id` = `t`.`entity_id`
SET `t`.`_uuid_entity_id` = CASE
  WHEN `t`.`entity_id` IS NULL THEN NULL
  ELSE CASE UPPER(`t`.`entity_type`)
  WHEN 'SUPER_ADMIN' THEN sa.new_id
  WHEN 'SERVICE' THEN sv.new_id
  WHEN 'MODULE' THEN mo.new_id
  WHEN 'SUB_MODULE' THEN sm.new_id
  WHEN 'CLIENT_ADMIN' THEN ad.new_id
  WHEN 'COMPANY_ADMIN' THEN ad.new_id
  WHEN 'DEPARTMENT' THEN dp.new_id
  WHEN 'COMPANY_SERVICE_TEAM' THEN tm.new_id
  WHEN 'COMPANY_EMPLOYEE' THEN em.new_id
  WHEN 'SERVICE_WORK_ITEM' THEN wi.new_id
  WHEN 'ACCESS' THEN ad.new_id
  ELSE UUID()
END
END;

UPDATE `departments` AS `t` JOIN `_uuid_departments` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `departments` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`company_id` SET `t`.`_uuid_company_id` = `m`.`new_id`;
UPDATE `departments` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `departments` AS `t` JOIN `_uuid_company_employees` AS `m` ON `m`.`old_id` = `t`.`head_id` SET `t`.`_uuid_head_id` = `m`.`new_id`;
UPDATE `company_service_teams` AS `t` JOIN `_uuid_company_service_teams` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `company_service_teams` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`company_id` SET `t`.`_uuid_company_id` = `m`.`new_id`;
UPDATE `company_service_teams` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `company_service_teams` AS `t` JOIN `_uuid_company_employees` AS `m` ON `m`.`old_id` = `t`.`head_employee_id` SET `t`.`_uuid_head_employee_id` = `m`.`new_id`;
UPDATE `company_employees` AS `t` JOIN `_uuid_company_employees` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `company_employees` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`company_id` SET `t`.`_uuid_company_id` = `m`.`new_id`;
UPDATE `company_employees` AS `t` JOIN `_uuid_departments` AS `m` ON `m`.`old_id` = `t`.`department_id` SET `t`.`_uuid_department_id` = `m`.`new_id`;
UPDATE `company_employees` AS `t` JOIN `_uuid_company_service_teams` AS `m` ON `m`.`old_id` = `t`.`team_id` SET `t`.`_uuid_team_id` = `m`.`new_id`;
UPDATE `service_work_items` AS `t` JOIN `_uuid_service_work_items` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `service_work_items` AS `t` JOIN `_uuid_admins` AS `m` ON `m`.`old_id` = `t`.`company_id` SET `t`.`_uuid_company_id` = `m`.`new_id`;
UPDATE `service_work_items` AS `t` JOIN `_uuid_services` AS `m` ON `m`.`old_id` = `t`.`service_id` SET `t`.`_uuid_service_id` = `m`.`new_id`;
UPDATE `service_work_items` AS `t` JOIN `_uuid_company_employees` AS `m` ON `m`.`old_id` = `t`.`created_by_id` SET `t`.`_uuid_created_by_id` = `m`.`new_id`;
UPDATE `service_work_items` AS `t` JOIN `_uuid_company_employees` AS `m` ON `m`.`old_id` = `t`.`assigned_to_id` SET `t`.`_uuid_assigned_to_id` = `m`.`new_id`;
UPDATE `service_work_updates` AS `t` JOIN `_uuid_service_work_updates` AS `m` ON `m`.`old_id` = `t`.`id` SET `t`.`_uuid_id` = `m`.`new_id`;
UPDATE `service_work_updates` AS `t` JOIN `_uuid_service_work_items` AS `m` ON `m`.`old_id` = `t`.`work_item_id` SET `t`.`_uuid_work_item_id` = `m`.`new_id`;
UPDATE `service_work_updates` AS `t` JOIN `_uuid_company_employees` AS `m` ON `m`.`old_id` = `t`.`author_id` SET `t`.`_uuid_author_id` = `m`.`new_id`;

ALTER TABLE `services`
  DROP FOREIGN KEY `services_created_by_fkey`;
ALTER TABLE `modules`
  DROP FOREIGN KEY `modules_service_id_fkey`,
  DROP FOREIGN KEY `modules_created_by_fkey`;
ALTER TABLE `sub_modules`
  DROP FOREIGN KEY `sub_modules_module_id_fkey`,
  DROP FOREIGN KEY `sub_modules_service_id_fkey`,
  DROP FOREIGN KEY `sub_modules_created_by_fkey`;
ALTER TABLE `Admins` DROP FOREIGN KEY `client_admins_created_by_fkey`;
ALTER TABLE `Admin_service_access`
  DROP FOREIGN KEY `Admin_service_access_admin_id_fkey`,
  DROP FOREIGN KEY `client_service_access_service_id_fkey`,
  DROP PRIMARY KEY;
ALTER TABLE `Admin_module_access`
  DROP FOREIGN KEY `Admin_module_access_admin_id_fkey`,
  DROP FOREIGN KEY `client_module_access_service_id_fkey`,
  DROP FOREIGN KEY `client_module_access_module_id_fkey`,
  DROP PRIMARY KEY;
ALTER TABLE `Admin_sub_module_access`
  DROP FOREIGN KEY `Admin_sub_module_access_admin_id_fkey`,
  DROP FOREIGN KEY `client_sub_module_access_service_id_fkey`,
  DROP FOREIGN KEY `client_sub_module_access_module_id_fkey`,
  DROP FOREIGN KEY `client_sub_module_access_sub_module_id_fkey`,
  DROP PRIMARY KEY;
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_actor_id_fkey`;
ALTER TABLE `departments`
  DROP FOREIGN KEY `departments_company_id_fkey`,
  DROP FOREIGN KEY `departments_service_id_fkey`,
  DROP FOREIGN KEY `departments_head_id_fkey`,
  DROP INDEX `departments_company_id_service_id_code_key`;
ALTER TABLE `company_service_teams`
  DROP FOREIGN KEY `company_service_teams_company_id_fkey`,
  DROP FOREIGN KEY `company_service_teams_service_id_fkey`,
  DROP FOREIGN KEY `company_service_teams_head_employee_id_fkey`,
  DROP INDEX `company_service_teams_head_employee_id_key`,
  DROP INDEX `company_service_teams_company_id_service_id_key`,
  DROP INDEX `company_service_teams_service_id_idx`;
ALTER TABLE `company_employees`
  DROP FOREIGN KEY `company_employees_company_id_fkey`,
  DROP FOREIGN KEY `company_employees_department_id_fkey`,
  DROP FOREIGN KEY `company_employees_team_id_fkey`,
  DROP INDEX `company_employees_company_id_email_key`,
  DROP INDEX `company_employees_team_id_idx`;
ALTER TABLE `service_work_items`
  DROP FOREIGN KEY `service_work_items_company_id_fkey`,
  DROP FOREIGN KEY `service_work_items_service_id_fkey`,
  DROP FOREIGN KEY `service_work_items_created_by_id_fkey`,
  DROP FOREIGN KEY `service_work_items_assigned_to_id_fkey`,
  DROP INDEX `service_work_items_company_id_service_id_status_idx`,
  DROP INDEX `service_work_items_assigned_to_id_status_idx`;
ALTER TABLE `service_work_updates`
  DROP FOREIGN KEY `service_work_updates_work_item_id_fkey`,
  DROP FOREIGN KEY `service_work_updates_author_id_fkey`,
  DROP INDEX `service_work_updates_work_item_id_created_at_idx`;

ALTER TABLE `super_admins` DROP PRIMARY KEY, DROP COLUMN `id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, ADD PRIMARY KEY (`id`);
ALTER TABLE `services` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `created_by`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_created_by` `created_by` CHAR(36) NULL, ADD PRIMARY KEY (`id`);
ALTER TABLE `modules` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `service_id`, DROP COLUMN `created_by`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_created_by` `created_by` CHAR(36) NULL, ADD PRIMARY KEY (`id`);
ALTER TABLE `sub_modules` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `module_id`, DROP COLUMN `service_id`, DROP COLUMN `created_by`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_module_id` `module_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_created_by` `created_by` CHAR(36) NULL, ADD PRIMARY KEY (`id`);
ALTER TABLE `Admins` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `created_by`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_created_by` `created_by` CHAR(36) NULL, ADD PRIMARY KEY (`id`);
ALTER TABLE `Admin_service_access` DROP COLUMN `admin_id`, DROP COLUMN `service_id`, DROP COLUMN `assigned_by`, CHANGE COLUMN `_uuid_admin_id` `admin_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_assigned_by` `assigned_by` CHAR(36) NULL, ADD PRIMARY KEY (`admin_id`, `service_id`);
ALTER TABLE `Admin_module_access` DROP COLUMN `admin_id`, DROP COLUMN `service_id`, DROP COLUMN `module_id`, DROP COLUMN `assigned_by`, CHANGE COLUMN `_uuid_admin_id` `admin_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_module_id` `module_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_assigned_by` `assigned_by` CHAR(36) NULL, ADD PRIMARY KEY (`admin_id`, `service_id`, `module_id`);
ALTER TABLE `Admin_sub_module_access` DROP COLUMN `admin_id`, DROP COLUMN `service_id`, DROP COLUMN `module_id`, DROP COLUMN `sub_module_id`, DROP COLUMN `assigned_by`, CHANGE COLUMN `_uuid_admin_id` `admin_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_module_id` `module_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_sub_module_id` `sub_module_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_assigned_by` `assigned_by` CHAR(36) NULL, ADD PRIMARY KEY (`admin_id`, `service_id`, `module_id`, `sub_module_id`);
ALTER TABLE `audit_logs` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `actor_id`, DROP COLUMN `entity_id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_actor_id` `actor_id` CHAR(36) NULL, CHANGE COLUMN `_uuid_entity_id` `entity_id` CHAR(36) NULL, ADD PRIMARY KEY (`id`);
ALTER TABLE `departments` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `company_id`, DROP COLUMN `service_id`, DROP COLUMN `head_id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_company_id` `company_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_head_id` `head_id` CHAR(36) NULL, ADD PRIMARY KEY (`id`), ADD UNIQUE INDEX `departments_company_id_service_id_code_key` (`company_id`, `service_id`, `code`);
ALTER TABLE `company_service_teams` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `company_id`, DROP COLUMN `service_id`, DROP COLUMN `head_employee_id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_company_id` `company_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_head_employee_id` `head_employee_id` CHAR(36) NULL, ADD PRIMARY KEY (`id`), ADD UNIQUE INDEX `company_service_teams_head_employee_id_key` (`head_employee_id`), ADD UNIQUE INDEX `company_service_teams_company_id_service_id_key` (`company_id`, `service_id`), ADD INDEX `company_service_teams_service_id_idx` (`service_id`);
ALTER TABLE `company_employees` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `company_id`, DROP COLUMN `department_id`, DROP COLUMN `team_id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_company_id` `company_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_department_id` `department_id` CHAR(36) NULL, CHANGE COLUMN `_uuid_team_id` `team_id` CHAR(36) NULL, ADD PRIMARY KEY (`id`), ADD UNIQUE INDEX `company_employees_company_id_email_key` (`company_id`, `email`), ADD INDEX `company_employees_team_id_idx` (`team_id`);
ALTER TABLE `service_work_items` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `company_id`, DROP COLUMN `service_id`, DROP COLUMN `created_by_id`, DROP COLUMN `assigned_to_id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_company_id` `company_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_service_id` `service_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_created_by_id` `created_by_id` CHAR(36) NULL, CHANGE COLUMN `_uuid_assigned_to_id` `assigned_to_id` CHAR(36) NOT NULL, ADD PRIMARY KEY (`id`), ADD INDEX `service_work_items_company_id_service_id_status_idx` (`company_id`, `service_id`, `status`), ADD INDEX `service_work_items_assigned_to_id_status_idx` (`assigned_to_id`, `status`);
ALTER TABLE `service_work_updates` DROP PRIMARY KEY, DROP COLUMN `id`, DROP COLUMN `work_item_id`, DROP COLUMN `author_id`, CHANGE COLUMN `_uuid_id` `id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_work_item_id` `work_item_id` CHAR(36) NOT NULL, CHANGE COLUMN `_uuid_author_id` `author_id` CHAR(36) NULL, ADD PRIMARY KEY (`id`), ADD INDEX `service_work_updates_work_item_id_created_at_idx` (`work_item_id`, `created_at`);

ALTER TABLE `services` ADD CONSTRAINT `services_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `super_admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `modules`
  ADD CONSTRAINT `modules_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `modules_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `super_admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sub_modules`
  ADD CONSTRAINT `sub_modules_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sub_modules_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sub_modules_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `super_admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Admins` ADD CONSTRAINT `client_admins_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `super_admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Admin_service_access`
  ADD CONSTRAINT `Admin_service_access_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `client_service_access_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Admin_module_access`
  ADD CONSTRAINT `Admin_module_access_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `client_module_access_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `client_module_access_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Admin_sub_module_access`
  ADD CONSTRAINT `Admin_sub_module_access_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `client_sub_module_access_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `client_sub_module_access_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `client_sub_module_access_sub_module_id_fkey` FOREIGN KEY (`sub_module_id`) REFERENCES `sub_modules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `super_admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `departments`
  ADD CONSTRAINT `departments_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `departments_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `departments_head_id_fkey` FOREIGN KEY (`head_id`) REFERENCES `company_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `company_service_teams`
  ADD CONSTRAINT `company_service_teams_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_service_teams_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_service_teams_head_employee_id_fkey` FOREIGN KEY (`head_employee_id`) REFERENCES `company_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `company_employees`
  ADD CONSTRAINT `company_employees_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `company_employees_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `company_employees_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `company_service_teams` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `service_work_items`
  ADD CONSTRAINT `service_work_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `Admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `service_work_items_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `service_work_items_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `company_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `service_work_items_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `company_employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `service_work_updates`
  ADD CONSTRAINT `service_work_updates_work_item_id_fkey` FOREIGN KEY (`work_item_id`) REFERENCES `service_work_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `service_work_updates_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `company_employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

DROP TEMPORARY TABLE `_uuid_super_admins`;
DROP TEMPORARY TABLE `_uuid_services`;
DROP TEMPORARY TABLE `_uuid_modules`;
DROP TEMPORARY TABLE `_uuid_sub_modules`;
DROP TEMPORARY TABLE `_uuid_admins`;
DROP TEMPORARY TABLE `_uuid_audit_logs`;
DROP TEMPORARY TABLE `_uuid_departments`;
DROP TEMPORARY TABLE `_uuid_company_service_teams`;
DROP TEMPORARY TABLE `_uuid_company_employees`;
DROP TEMPORARY TABLE `_uuid_service_work_items`;
DROP TEMPORARY TABLE `_uuid_service_work_updates`;
