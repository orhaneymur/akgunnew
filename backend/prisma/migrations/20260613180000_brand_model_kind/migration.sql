-- BrandModel: marka ve model ayrimi
ALTER TABLE `BrandModel` ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'MODEL';

ALTER TABLE `BrandModel` DROP INDEX `BrandModel_name_categoryId_key`;

ALTER TABLE `BrandModel` ADD UNIQUE INDEX `BrandModel_name_categoryId_kind_key`(`name`, `categoryId`, `kind`);
