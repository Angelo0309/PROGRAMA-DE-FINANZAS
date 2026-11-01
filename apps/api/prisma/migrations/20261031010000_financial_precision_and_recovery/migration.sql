-- Preserve internal financial precision and distinguish the original capital
-- released from the account limit from the amortized capital billed to a customer.
ALTER TABLE `CUENTA_CREDITO`
  MODIFY `capital_original_pendiente` DECIMAL(19, 12) NOT NULL DEFAULT 0;

ALTER TABLE `CREDITO`
  MODIFY `capital` DECIMAL(19, 12) NOT NULL;

ALTER TABLE `OBLIGACION`
  MODIFY `saldo_inicial` DECIMAL(19, 12) NOT NULL,
  MODIFY `capital_exigible` DECIMAL(19, 12) NOT NULL,
  ADD COLUMN `capital_original_recuperable` DECIMAL(19, 12) NOT NULL AFTER `capital_exigible`,
  MODIFY `interes_compensatorio` DECIMAL(19, 12) NOT NULL,
  MODIFY `importe_exigible` DECIMAL(19, 12) NOT NULL,
  MODIFY `importe_pagado` DECIMAL(19, 12) NOT NULL DEFAULT 0;
