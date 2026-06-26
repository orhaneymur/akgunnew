-- Soft delete for invoices + china return flag on line items
ALTER TABLE `Invoice` ADD COLUMN `deletedAt` DATETIME(3) NULL;

ALTER TABLE `InvoiceItem` ADD COLUMN `isChinaReturn` BOOLEAN NOT NULL DEFAULT false;
