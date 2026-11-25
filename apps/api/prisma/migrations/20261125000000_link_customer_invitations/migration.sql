-- AlterTable
ALTER TABLE `INVITACION_USUARIO` ADD COLUMN `cliente_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `INVITACION_USUARIO_cliente_id_estado_idx` ON `INVITACION_USUARIO`(`cliente_id`, `estado`);

-- AddForeignKey
ALTER TABLE `INVITACION_USUARIO` ADD CONSTRAINT `INVITACION_USUARIO_cliente_id_tienda_id_fkey` FOREIGN KEY (`cliente_id`, `tienda_id`) REFERENCES `CLIENTE`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
