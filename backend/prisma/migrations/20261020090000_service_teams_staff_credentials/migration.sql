ALTER TABLE `company_employees`
    ADD COLUMN `team_id` BIGINT NULL,
    ADD COLUMN `access_role` VARCHAR(30) NOT NULL DEFAULT 'EMPLOYEE',
    ADD COLUMN `password_hash` VARCHAR(255) NULL;

CREATE TABLE `company_service_teams` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `company_id` BIGINT NOT NULL,
    `service_id` BIGINT NOT NULL,
    `head_employee_id` BIGINT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `company_service_teams_head_employee_id_key`(`head_employee_id`),
    UNIQUE INDEX `company_service_teams_company_id_service_id_key`(`company_id`, `service_id`),
    INDEX `company_service_teams_service_id_idx`(`service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `company_service_teams` (`company_id`, `service_id`, `created_at`, `updated_at`)
SELECT `service_assignments`.`company_id`,
       `service_assignments`.`service_id`,
       CURRENT_TIMESTAMP(3),
       CURRENT_TIMESTAMP(3)
FROM (
    SELECT `company_id`, `service_id` FROM `departments`
    UNION
    SELECT `client_admin_id`, `service_id`
    FROM `client_service_access`
    WHERE `is_allowed` = 1
) AS `service_assignments`;

UPDATE `company_employees` AS `employee`
INNER JOIN `departments` AS `department`
    ON `department`.`id` = `employee`.`department_id`
INNER JOIN `company_service_teams` AS `team`
    ON `team`.`company_id` = `employee`.`company_id`
   AND `team`.`service_id` = `department`.`service_id`
SET `employee`.`team_id` = `team`.`id`;

UPDATE `company_employees` AS `employee`
INNER JOIN `departments` AS `department`
    ON `department`.`head_id` = `employee`.`id`
SET `employee`.`access_role` = 'TEAM_LEADER';

UPDATE `company_service_teams` AS `team`
INNER JOIN (
    SELECT `company_id`, `service_id`, MIN(`head_id`) AS `head_id`
    FROM `departments`
    WHERE `head_id` IS NOT NULL
    GROUP BY `company_id`, `service_id`
    HAVING COUNT(DISTINCT `head_id`) = 1
) AS `single_heads`
    ON `single_heads`.`company_id` = `team`.`company_id`
   AND `single_heads`.`service_id` = `team`.`service_id`
INNER JOIN `company_employees` AS `employee`
    ON `employee`.`id` = `single_heads`.`head_id`
   AND `employee`.`team_id` = `team`.`id`
SET `team`.`head_employee_id` = `single_heads`.`head_id`;

UPDATE `company_employees` AS `employee`
INNER JOIN `company_service_teams` AS `team`
    ON `team`.`head_employee_id` = `employee`.`id`
SET `employee`.`access_role` = 'SERVICE_HEAD';

ALTER TABLE `company_employees`
    ADD INDEX `company_employees_team_id_idx`(`team_id`),
    ADD CONSTRAINT `company_employees_team_id_fkey`
        FOREIGN KEY (`team_id`) REFERENCES `company_service_teams`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `company_service_teams`
    ADD CONSTRAINT `company_service_teams_company_id_fkey`
        FOREIGN KEY (`company_id`) REFERENCES `client_admins`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `company_service_teams_service_id_fkey`
        FOREIGN KEY (`service_id`) REFERENCES `services`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `company_service_teams_head_employee_id_fkey`
        FOREIGN KEY (`head_employee_id`) REFERENCES `company_employees`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
