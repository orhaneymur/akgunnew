-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `originalInvoiceId` INTEGER NULL;

-- AlterTable
ALTER TABLE `InvoiceItem` ADD COLUMN `sourceInvoiceItemId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_originalInvoiceId_fkey` FOREIGN KEY (`originalInvoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceItem` ADD CONSTRAINT `InvoiceItem_sourceInvoiceItemId_fkey` FOREIGN KEY (`sourceInvoiceItemId`) REFERENCES `InvoiceItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
