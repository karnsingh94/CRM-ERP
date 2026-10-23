ALTER TABLE `company_service_teams`
    ADD COLUMN `name` VARCHAR(150) NOT NULL DEFAULT 'Service Team';

UPDATE `company_service_teams` AS `team`
INNER JOIN `services` AS `service` ON `service`.`id` = `team`.`service_id`
SET `team`.`name` = CONCAT(`service`.`name`, ' Team');

ALTER TABLE `company_service_teams`
    DROP INDEX `company_service_teams_company_id_service_id_key`,
    MODIFY COLUMN `name` VARCHAR(150) NOT NULL,
    ADD UNIQUE INDEX `company_service_teams_company_id_service_id_name_key`(`company_id`, `service_id`, `name`),
    ADD INDEX `company_service_teams_company_id_service_id_idx`(`company_id`, `service_id`);
