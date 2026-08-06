const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const config = require("./config");

let pool = null;

const schemaStatements = [
`CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS accesos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NULL,
    correo_intentado VARCHAR(150) NOT NULL,
    resultado VARCHAR(20) NOT NULL,
    direccion_ip VARCHAR(50) NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_accesos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    tamano VARCHAR(30) NULL,
    cantidad INT NOT NULL DEFAULT 0,
    altura_min_cm DECIMAL(7,2) NULL,
    altura_max_cm DECIMAL(7,2) NULL,
    peso_min_g DECIMAL(10,2) NULL,
    peso_max_g DECIMAL(10,2) NULL,
    color_esperado VARCHAR(30) NULL,
    color_ref_r_pct DECIMAL(6,2) NULL,
    color_ref_g_pct DECIMAL(6,2) NULL,
    color_ref_b_pct DECIMAL(6,2) NULL,
    tolerancia_color DECIMAL(6,2) NULL DEFAULT 10.00,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS cajas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    uid_rfid VARCHAR(32) NOT NULL UNIQUE,
    capacidad_max_g DECIMAL(10,2) NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS eventos_rfid (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    caja_id INT NULL,
    uid_rfid VARCHAR(32) NOT NULL,
    dispositivo VARCHAR(50) NOT NULL,
    resultado VARCHAR(30) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_eventos_rfid_caja
        FOREIGN KEY (caja_id) REFERENCES cajas(id)
        ON DELETE SET NULL
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS dispositivos (
    nombre VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL,
    direccion_ip VARCHAR(50) NULL,
    detalle VARCHAR(255) NULL,
    ultima_conexion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS inspecciones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_evento VARCHAR(100) NOT NULL UNIQUE,
    producto_id INT NOT NULL,
    caja_id INT NULL,
    uid_rfid VARCHAR(32) NULL,
    numero_pieza_caja INT NULL,
    dispositivo_banda VARCHAR(50) NOT NULL,
    dispositivo_bascula VARCHAR(50) NULL,
    distancia_banda_cm DECIMAL(7,2) NOT NULL,
    distancia_objeto_cm DECIMAL(7,2) NOT NULL,
    altura_cm DECIMAL(7,2) NOT NULL,
    resultado_altura VARCHAR(30) NOT NULL,
    rojo_raw INT UNSIGNED NOT NULL,
    verde_raw INT UNSIGNED NOT NULL,
    azul_raw INT UNSIGNED NOT NULL,
    claro_raw INT UNSIGNED NOT NULL,
    rojo_pct DECIMAL(6,2) NOT NULL,
    verde_pct DECIMAL(6,2) NOT NULL,
    azul_pct DECIMAL(6,2) NOT NULL,
    color_detectado VARCHAR(30) NOT NULL,
    diferencia_color DECIMAL(8,2) NULL,
    resultado_color VARCHAR(30) NOT NULL,
    peso_anterior_g DECIMAL(10,2) NULL,
    peso_actual_g DECIMAL(10,2) NULL,
    peso_pieza_g DECIMAL(10,2) NULL,
    resultado_peso VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    resultado_general VARCHAR(40) NOT NULL DEFAULT 'pendiente',
    estado VARCHAR(30) NOT NULL DEFAULT 'esperando_peso',
    caja_llena BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_cancelacion VARCHAR(255) NULL,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_fin TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_inspecciones_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id),
    CONSTRAINT fk_inspecciones_caja
        FOREIGN KEY (caja_id) REFERENCES cajas(id)
        ON DELETE SET NULL,
    INDEX idx_inspecciones_estado (estado),
    INDEX idx_inspecciones_fecha (fecha_inicio),
    INDEX idx_inspecciones_producto (producto_id)
) ENGINE=InnoDB`,

`CREATE TABLE IF NOT EXISTS movimientos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    usuario_id INT NULL,
    inspeccion_id BIGINT NULL,
    tipo VARCHAR(20) NOT NULL,
    cantidad INT NOT NULL,
    existencia_resultante INT NOT NULL,
    origen VARCHAR(20) NOT NULL DEFAULT 'manual',
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movimientos_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id),
    CONSTRAINT fk_movimientos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_movimientos_inspeccion
        FOREIGN KEY (inspeccion_id) REFERENCES inspecciones(id)
        ON DELETE SET NULL
) ENGINE=InnoDB`
];

async function inicializarBaseDatos() {
    const conexionInicial = await mysql.createConnection({
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password
    });

    await conexionInicial.query(
        `CREATE DATABASE IF NOT EXISTS \`${config.database.database}\`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conexionInicial.end();

    pool = mysql.createPool({
        ...config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        decimalNumbers: true,
        charset: "utf8mb4"
    });

    for (const statement of schemaStatements) {
        await pool.query(statement);
    }

    await crearDatosIniciales();
    return pool;
}

async function crearDatosIniciales() {
    const [[usuarios]] = await pool.query("SELECT COUNT(*) AS total FROM usuarios");
    if (usuarios.total === 0) {
        const hash = await bcrypt.hash(config.admin.contrasena, 10);
        await pool.execute(
            `INSERT INTO usuarios (nombre, correo, password_hash) VALUES (?, ?, ?)`,
            [config.admin.nombre, config.admin.correo, hash]
        );
        console.log(`Usuario inicial creado: ${config.admin.correo}`);
    }

    const [[productos]] = await pool.query("SELECT COUNT(*) AS total FROM productos");
    if (productos.total === 0) {
        await pool.execute(
            `INSERT INTO productos
             (codigo, nombre, tamano, cantidad, tolerancia_color)
             VALUES (?, ?, ?, ?, ?)`,
            ["PZA-DEMO", "Pieza de demostración", "mediano", 0, 10]
        );
        console.log("Producto de demostración creado. Configure sus límites desde la página Productos.");
    }
}

function obtenerPool() {
    if (!pool) throw new Error("La base de datos todavía no ha sido inicializada.");
    return pool;
}

module.exports = {
    inicializarBaseDatos,
    obtenerPool,
    schemaStatements
};
