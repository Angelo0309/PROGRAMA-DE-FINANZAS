-- CreateTable
CREATE TABLE `TIENDA` (
    `id` CHAR(36) NOT NULL,
    `numero_documento` VARCHAR(20) NOT NULL,
    `razon_social` VARCHAR(160) NOT NULL,
    `nombre_comercial` VARCHAR(160) NULL,
    `currency` CHAR(3) NOT NULL DEFAULT 'PEN',
    `zona_horaria` VARCHAR(64) NOT NULL DEFAULT 'America/Lima',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TIENDA_numero_documento_key`(`numero_documento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `USUARIO` (
    `id` CHAR(36) NOT NULL,
    `nombre_usuario` VARCHAR(80) NOT NULL,
    `correo` VARCHAR(254) NOT NULL,
    `clave_hash` VARCHAR(255) NOT NULL,
    `nombre_mostrar` VARCHAR(160) NOT NULL,
    `rol_plataforma` ENUM('PLATFORM_ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `correo_verificado_en` DATETIME(3) NULL,
    `ultimo_acceso_en` DATETIME(3) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `USUARIO_nombre_usuario_key`(`nombre_usuario`),
    UNIQUE INDEX `USUARIO_correo_key`(`correo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CLIENTE` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NULL,
    `tipo_documento` VARCHAR(20) NOT NULL,
    `numero_documento` VARCHAR(24) NOT NULL,
    `nombre_completo` VARCHAR(180) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `address` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    INDEX `CLIENTE_usuario_id_idx`(`usuario_id`),
    UNIQUE INDEX `CLIENTE_tienda_id_tipo_documento_numero_documento_key`(`tienda_id`, `tipo_documento`, `numero_documento`),
    UNIQUE INDEX `CLIENTE_tienda_id_usuario_id_key`(`tienda_id`, `usuario_id`),
    PRIMARY KEY (`id`, `tienda_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ACCESO_TIENDA` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `rol` ENUM('STORE_ADMIN', 'OPERATOR', 'CLIENT') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    INDEX `ACCESO_TIENDA_usuario_id_activo_idx`(`usuario_id`, `activo`),
    UNIQUE INDEX `ACCESO_TIENDA_tienda_id_usuario_id_key`(`tienda_id`, `usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CUENTA_CREDITO` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `cliente_id` CHAR(36) NOT NULL,
    `numero_cuenta` VARCHAR(40) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `limite_credito` DECIMAL(19, 4) NOT NULL,
    `capital_original_pendiente` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    INDEX `CUENTA_CREDITO_cliente_id_tienda_id_idx`(`cliente_id`, `tienda_id`),
    UNIQUE INDEX `CUENTA_CREDITO_tienda_id_numero_cuenta_key`(`tienda_id`, `numero_cuenta`),
    PRIMARY KEY (`id`, `tienda_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CONDICION_CREDITICIA` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `cuenta_id` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `tipo_tasa_compensatoria` ENUM('EFFECTIVE_ANNUAL', 'NOMINAL_ANNUAL') NOT NULL,
    `tasa_compensatoria` DECIMAL(20, 12) NOT NULL,
    `tipo_tasa_moratoria` ENUM('EFFECTIVE_ANNUAL', 'NOMINAL_ANNUAL') NOT NULL,
    `tasa_moratoria` DECIMAL(20, 12) NOT NULL,
    `dia_corte` TINYINT UNSIGNED NOT NULL,
    `dia_vencimiento` TINYINT UNSIGNED NOT NULL,
    `maximo_cuotas` SMALLINT UNSIGNED NOT NULL,
    `meses_gracia_total` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `vigente_desde` DATETIME(3) NOT NULL,
    `vigente_hasta` DATETIME(3) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CONDICION_CREDITICIA_tienda_id_vigente_desde_idx`(`tienda_id`, `vigente_desde`),
    UNIQUE INDEX `CONDICION_CREDITICIA_cuenta_id_version_key`(`cuenta_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PRODUCTO_SERVICIO` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `nombre` VARCHAR(180) NOT NULL,
    `descripcion` TEXT NULL,
    `precio_unitario` DECIMAL(19, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `imagen_url` VARCHAR(2048) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PRODUCTO_SERVICIO_tienda_id_sku_key`(`tienda_id`, `sku`),
    PRIMARY KEY (`id`, `tienda_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `COMPRA` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `cuenta_id` CHAR(36) NOT NULL,
    `condicion_id` CHAR(36) NOT NULL,
    `operador_usuario_id` CHAR(36) NOT NULL,
    `clave_idempotencia` VARCHAR(100) NOT NULL,
    `modalidad` ENUM('END_OF_MONTH', 'INSTALLMENTS') NOT NULL,
    `numero_cuotas` SMALLINT UNSIGNED NULL,
    `comprado_en` DATETIME(3) NOT NULL,
    `corte_asignado_en` DATETIME(3) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `subtotal` DECIMAL(19, 4) NOT NULL,
    `total` DECIMAL(19, 4) NOT NULL,
    `estado` ENUM('ACTIVE', 'VOIDED') NOT NULL DEFAULT 'ACTIVE',
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `COMPRA_cuenta_id_comprado_en_idx`(`cuenta_id`, `comprado_en`),
    INDEX `COMPRA_cuenta_id_corte_asignado_en_idx`(`cuenta_id`, `corte_asignado_en`),
    UNIQUE INDEX `COMPRA_tienda_id_clave_idempotencia_key`(`tienda_id`, `clave_idempotencia`),
    PRIMARY KEY (`id`, `tienda_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DETALLE_COMPRA` (
    `id` CHAR(36) NOT NULL,
    `compra_id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `producto_id` CHAR(36) NOT NULL,
    `descripcion` VARCHAR(255) NOT NULL,
    `cantidad` DECIMAL(12, 4) NOT NULL,
    `precio_unitario` DECIMAL(19, 4) NOT NULL,
    `total_linea` DECIMAL(19, 4) NOT NULL,

    INDEX `DETALLE_COMPRA_compra_id_tienda_id_idx`(`compra_id`, `tienda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CREDITO` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `cuenta_id` CHAR(36) NOT NULL,
    `compra_id` CHAR(36) NOT NULL,
    `capital` DECIMAL(19, 4) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `fecha_base` DATE NOT NULL,
    `numero_cuotas` SMALLINT UNSIGNED NOT NULL,
    `meses_gracia` TINYINT UNSIGNED NOT NULL,
    `tasa_efectiva_diaria` DECIMAL(20, 15) NOT NULL,
    `tasa_moratoria_diaria` DECIMAL(20, 15) NOT NULL,
    `estado` ENUM('ACTIVE', 'PAID', 'OVERDUE', 'VOIDED') NOT NULL DEFAULT 'ACTIVE',
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CREDITO_cuenta_id_tienda_id_estado_idx`(`cuenta_id`, `tienda_id`, `estado`),
    UNIQUE INDEX `CREDITO_compra_id_tienda_id_key`(`compra_id`, `tienda_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OBLIGACION` (
    `id` CHAR(36) NOT NULL,
    `credito_id` CHAR(36) NOT NULL,
    `numero_cuota` SMALLINT UNSIGNED NOT NULL,
    `fecha_vencimiento` DATE NOT NULL,
    `saldo_inicial` DECIMAL(19, 4) NOT NULL,
    `capital_exigible` DECIMAL(19, 4) NOT NULL,
    `interes_compensatorio` DECIMAL(19, 4) NOT NULL,
    `interes_moratorio` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `importe_exigible` DECIMAL(19, 4) NOT NULL,
    `importe_pagado` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `estado` ENUM('PENDING', 'PAID', 'OVERDUE', 'VOIDED') NOT NULL DEFAULT 'PENDING',
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OBLIGACION_fecha_vencimiento_estado_idx`(`fecha_vencimiento`, `estado`),
    UNIQUE INDEX `OBLIGACION_credito_id_numero_cuota_key`(`credito_id`, `numero_cuota`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CORTE` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `cuenta_id` CHAR(36) NOT NULL,
    `clave_idempotencia` VARCHAR(100) NOT NULL,
    `corte_en` DATETIME(3) NOT NULL,
    `periodo_desde` DATE NOT NULL,
    `periodo_hasta` DATE NOT NULL,
    `fecha_vencimiento` DATE NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `total_exigible` DECIMAL(19, 4) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CORTE_cuenta_id_corte_en_key`(`cuenta_id`, `corte_en`),
    UNIQUE INDEX `CORTE_tienda_id_clave_idempotencia_key`(`tienda_id`, `clave_idempotencia`),
    PRIMARY KEY (`id`, `tienda_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DETALLE_CORTE` (
    `id` CHAR(36) NOT NULL,
    `corte_id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `obligacion_id` CHAR(36) NOT NULL,
    `importe_exigible` DECIMAL(19, 4) NOT NULL,

    UNIQUE INDEX `DETALLE_CORTE_corte_id_obligacion_id_key`(`corte_id`, `obligacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PAGO` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `cuenta_id` CHAR(36) NOT NULL,
    `operador_usuario_id` CHAR(36) NOT NULL,
    `clave_idempotencia` VARCHAR(100) NOT NULL,
    `pagado_en` DATETIME(3) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `importe` DECIMAL(19, 4) NOT NULL,
    `metodo` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER') NOT NULL,
    `numero_comprobante` VARCHAR(64) NOT NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PAGO_numero_comprobante_key`(`numero_comprobante`),
    INDEX `PAGO_cuenta_id_pagado_en_idx`(`cuenta_id`, `pagado_en`),
    UNIQUE INDEX `PAGO_tienda_id_clave_idempotencia_key`(`tienda_id`, `clave_idempotencia`),
    PRIMARY KEY (`id`, `tienda_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DETALLE_PAGO` (
    `id` CHAR(36) NOT NULL,
    `pago_id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NOT NULL,
    `obligacion_id` CHAR(36) NOT NULL,
    `mora_pagada` DECIMAL(19, 4) NOT NULL,
    `interes_compensatorio_pagado` DECIMAL(19, 4) NOT NULL,
    `capital_pagado` DECIMAL(19, 4) NOT NULL,

    UNIQUE INDEX `DETALLE_PAGO_pago_id_obligacion_id_key`(`pago_id`, `obligacion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AUDITORIA` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NULL,
    `usuario_id` CHAR(36) NULL,
    `evento` VARCHAR(100) NOT NULL,
    `entidad` VARCHAR(100) NULL,
    `entidad_id` VARCHAR(64) NULL,
    `direccion_ip` VARCHAR(64) NULL,
    `agente_usuario` VARCHAR(512) NULL,
    `detalles` JSON NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AUDITORIA_tienda_id_creado_en_idx`(`tienda_id`, `creado_en`),
    INDEX `AUDITORIA_usuario_id_creado_en_idx`(`usuario_id`, `creado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `INVITACION_USUARIO` (
    `id` CHAR(36) NOT NULL,
    `tienda_id` CHAR(36) NULL,
    `emitida_por_id` CHAR(36) NOT NULL,
    `correo` VARCHAR(254) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `rol_plataforma` ENUM('PLATFORM_ADMIN', 'USER') NOT NULL DEFAULT 'USER',
    `rol_tienda` ENUM('STORE_ADMIN', 'OPERATOR', 'CLIENT') NULL,
    `estado` ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `vence_en` DATETIME(3) NOT NULL,
    `aceptada_en` DATETIME(3) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `INVITACION_USUARIO_token_hash_key`(`token_hash`),
    INDEX `INVITACION_USUARIO_correo_estado_idx`(`correo`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SESION_REFRESH` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `vence_en` DATETIME(3) NOT NULL,
    `revocada_en` DATETIME(3) NULL,
    `reemplazada_por_id` CHAR(36) NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `SESION_REFRESH_token_hash_key`(`token_hash`),
    INDEX `SESION_REFRESH_usuario_id_vence_en_idx`(`usuario_id`, `vence_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CLIENTE` ADD CONSTRAINT `CLIENTE_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CLIENTE` ADD CONSTRAINT `CLIENTE_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ACCESO_TIENDA` ADD CONSTRAINT `ACCESO_TIENDA_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ACCESO_TIENDA` ADD CONSTRAINT `ACCESO_TIENDA_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CUENTA_CREDITO` ADD CONSTRAINT `CUENTA_CREDITO_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CUENTA_CREDITO` ADD CONSTRAINT `CUENTA_CREDITO_cliente_id_tienda_id_fkey` FOREIGN KEY (`cliente_id`, `tienda_id`) REFERENCES `CLIENTE`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CONDICION_CREDITICIA` ADD CONSTRAINT `CONDICION_CREDITICIA_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CONDICION_CREDITICIA` ADD CONSTRAINT `CONDICION_CREDITICIA_cuenta_id_tienda_id_fkey` FOREIGN KEY (`cuenta_id`, `tienda_id`) REFERENCES `CUENTA_CREDITO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PRODUCTO_SERVICIO` ADD CONSTRAINT `PRODUCTO_SERVICIO_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COMPRA` ADD CONSTRAINT `COMPRA_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COMPRA` ADD CONSTRAINT `COMPRA_cuenta_id_tienda_id_fkey` FOREIGN KEY (`cuenta_id`, `tienda_id`) REFERENCES `CUENTA_CREDITO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COMPRA` ADD CONSTRAINT `COMPRA_condicion_id_fkey` FOREIGN KEY (`condicion_id`) REFERENCES `CONDICION_CREDITICIA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `COMPRA` ADD CONSTRAINT `COMPRA_operador_usuario_id_fkey` FOREIGN KEY (`operador_usuario_id`) REFERENCES `USUARIO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DETALLE_COMPRA` ADD CONSTRAINT `DETALLE_COMPRA_compra_id_tienda_id_fkey` FOREIGN KEY (`compra_id`, `tienda_id`) REFERENCES `COMPRA`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DETALLE_COMPRA` ADD CONSTRAINT `DETALLE_COMPRA_producto_id_tienda_id_fkey` FOREIGN KEY (`producto_id`, `tienda_id`) REFERENCES `PRODUCTO_SERVICIO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CREDITO` ADD CONSTRAINT `CREDITO_cuenta_id_tienda_id_fkey` FOREIGN KEY (`cuenta_id`, `tienda_id`) REFERENCES `CUENTA_CREDITO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CREDITO` ADD CONSTRAINT `CREDITO_compra_id_tienda_id_fkey` FOREIGN KEY (`compra_id`, `tienda_id`) REFERENCES `COMPRA`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OBLIGACION` ADD CONSTRAINT `OBLIGACION_credito_id_fkey` FOREIGN KEY (`credito_id`) REFERENCES `CREDITO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CORTE` ADD CONSTRAINT `CORTE_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CORTE` ADD CONSTRAINT `CORTE_cuenta_id_tienda_id_fkey` FOREIGN KEY (`cuenta_id`, `tienda_id`) REFERENCES `CUENTA_CREDITO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DETALLE_CORTE` ADD CONSTRAINT `DETALLE_CORTE_corte_id_tienda_id_fkey` FOREIGN KEY (`corte_id`, `tienda_id`) REFERENCES `CORTE`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DETALLE_CORTE` ADD CONSTRAINT `DETALLE_CORTE_obligacion_id_fkey` FOREIGN KEY (`obligacion_id`) REFERENCES `OBLIGACION`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PAGO` ADD CONSTRAINT `PAGO_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PAGO` ADD CONSTRAINT `PAGO_cuenta_id_tienda_id_fkey` FOREIGN KEY (`cuenta_id`, `tienda_id`) REFERENCES `CUENTA_CREDITO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PAGO` ADD CONSTRAINT `PAGO_operador_usuario_id_fkey` FOREIGN KEY (`operador_usuario_id`) REFERENCES `USUARIO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DETALLE_PAGO` ADD CONSTRAINT `DETALLE_PAGO_pago_id_tienda_id_fkey` FOREIGN KEY (`pago_id`, `tienda_id`) REFERENCES `PAGO`(`id`, `tienda_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DETALLE_PAGO` ADD CONSTRAINT `DETALLE_PAGO_obligacion_id_fkey` FOREIGN KEY (`obligacion_id`) REFERENCES `OBLIGACION`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AUDITORIA` ADD CONSTRAINT `AUDITORIA_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AUDITORIA` ADD CONSTRAINT `AUDITORIA_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `INVITACION_USUARIO` ADD CONSTRAINT `INVITACION_USUARIO_tienda_id_fkey` FOREIGN KEY (`tienda_id`) REFERENCES `TIENDA`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `INVITACION_USUARIO` ADD CONSTRAINT `INVITACION_USUARIO_emitida_por_id_fkey` FOREIGN KEY (`emitida_por_id`) REFERENCES `USUARIO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SESION_REFRESH` ADD CONSTRAINT `SESION_REFRESH_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `USUARIO`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SESION_REFRESH` ADD CONSTRAINT `SESION_REFRESH_reemplazada_por_id_fkey` FOREIGN KEY (`reemplazada_por_id`) REFERENCES `SESION_REFRESH`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
