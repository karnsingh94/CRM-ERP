ALTER TABLE `Admin_service_access`
  ADD COLUMN `access_mode` ENUM('FULL', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM';

UPDATE `Admin_service_access`
SET `access_mode` = CASE
  WHEN `is_full_service` = 1 THEN 'FULL'
  ELSE 'CUSTOM'
END;

INSERT INTO `Admin_module_access`
  (`client_admin_id`, `service_id`, `module_id`, `access_mode`, `is_allowed`, `assigned_by`, `created_at`, `updated_at`)
SELECT
  `access`.`client_admin_id`,
  `access`.`service_id`,
  `module`.`id`,
  'FULL',
  `access`.`is_allowed`,
  `access`.`assigned_by`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `Admin_service_access` AS `access`
JOIN `modules` AS `module` ON `module`.`service_id` = `access`.`service_id`
WHERE `access`.`is_full_service` = 1
  AND NOT EXISTS (
    SELECT 1
    FROM `Admin_module_access` AS `existing`
    WHERE `existing`.`client_admin_id` = `access`.`client_admin_id`
      AND `existing`.`service_id` = `access`.`service_id`
      AND `existing`.`module_id` = `module`.`id`
  );

UPDATE `Admin_module_access` AS `module_access`
JOIN `Admin_service_access` AS `service_access`
  ON `service_access`.`client_admin_id` = `module_access`.`client_admin_id`
  AND `service_access`.`service_id` = `module_access`.`service_id`
SET
  `module_access`.`access_mode` = 'FULL',
  `module_access`.`is_allowed` = `service_access`.`is_allowed`,
  `module_access`.`assigned_by` = COALESCE(`module_access`.`assigned_by`, `service_access`.`assigned_by`)
WHERE `service_access`.`is_full_service` = 1;

INSERT INTO `Admin_sub_module_access`
  (`client_admin_id`, `service_id`, `module_id`, `sub_module_id`, `is_allowed`, `assigned_by`, `created_at`, `updated_at`)
SELECT
  `module_access`.`client_admin_id`,
  `module_access`.`service_id`,
  `module_access`.`module_id`,
  `sub_module`.`id`,
  `module_access`.`is_allowed`,
  `module_access`.`assigned_by`,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `Admin_module_access` AS `module_access`
JOIN `sub_modules` AS `sub_module` ON `sub_module`.`module_id` = `module_access`.`module_id`
WHERE `module_access`.`access_mode` = 'FULL'
  AND NOT EXISTS (
    SELECT 1
    FROM `Admin_sub_module_access` AS `existing`
    WHERE `existing`.`client_admin_id` = `module_access`.`client_admin_id`
      AND `existing`.`service_id` = `module_access`.`service_id`
      AND `existing`.`module_id` = `module_access`.`module_id`
      AND `existing`.`sub_module_id` = `sub_module`.`id`
  );

UPDATE `Admin_sub_module_access` AS `sub_module_access`
JOIN `Admin_module_access` AS `module_access`
  ON `module_access`.`client_admin_id` = `sub_module_access`.`client_admin_id`
  AND `module_access`.`service_id` = `sub_module_access`.`service_id`
  AND `module_access`.`module_id` = `sub_module_access`.`module_id`
SET
  `sub_module_access`.`is_allowed` = `module_access`.`is_allowed`,
  `sub_module_access`.`assigned_by` = COALESCE(`sub_module_access`.`assigned_by`, `module_access`.`assigned_by`)
WHERE `module_access`.`access_mode` = 'FULL';
