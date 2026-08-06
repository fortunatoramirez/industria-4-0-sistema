const express = require("express");
const { requiereSesionAPI } = require("../middleware");

module.exports = function crearRutasDashboard(pool, requiereClaveDispositivo) {
    const router = express.Router();

    router.post("/api/dispositivo/latido", requiereClaveDispositivo, async (req, res) => {
        try {
            const nombre = String(req.body.nombre || "").trim();
            const tipo = String(req.body.tipo || "").trim();
            const detalle = String(req.body.detalle || "").trim().slice(0, 255) || null;
            if (!nombre || !tipo) return res.status(400).json({ correcto: false, mensaje: "Datos incompletos" });

            await pool.execute(
                `INSERT INTO dispositivos (nombre, tipo, direccion_ip, detalle, ultima_conexion)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE
                    tipo=VALUES(tipo), direccion_ip=VALUES(direccion_ip),
                    detalle=VALUES(detalle), ultima_conexion=CURRENT_TIMESTAMP`,
                [nombre, tipo, req.ip, detalle]
            );
            res.json({ correcto: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible registrar el latido" });
        }
    });

    router.get("/api/dispositivos", requiereSesionAPI, async (_req, res) => {
        try {
            const [dispositivos] = await pool.query(
                `SELECT nombre, tipo, direccion_ip, detalle, ultima_conexion,
                        TIMESTAMPDIFF(SECOND, ultima_conexion, CURRENT_TIMESTAMP) AS segundos_sin_conexion
                 FROM dispositivos ORDER BY nombre`
            );
            res.json(dispositivos.map(d => ({ ...d, en_linea: Number(d.segundos_sin_conexion) <= 40 })));
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible consultar los dispositivos" });
        }
    });

    router.get("/api/panel/resumen", requiereSesionAPI, async (_req, res) => {
        try {
            const [[productos]] = await pool.query("SELECT COUNT(*) AS total, COALESCE(SUM(cantidad),0) AS inventario FROM productos WHERE activo=TRUE");
            const [[cajas]] = await pool.query("SELECT COUNT(*) AS total FROM cajas WHERE estado='activa'");
            const [[inspecciones]] = await pool.query(
                `SELECT COUNT(*) AS total,
                        SUM(estado='esperando_peso') AS pendientes,
                        SUM(estado='completa') AS completas,
                        SUM(resultado_general='aceptada') AS aceptadas,
                        SUM(resultado_general LIKE 'rechazada%') AS rechazadas
                 FROM inspecciones`
            );
            const [[dispositivos]] = await pool.query(
                `SELECT SUM(TIMESTAMPDIFF(SECOND, ultima_conexion, CURRENT_TIMESTAMP) <= 40) AS en_linea,
                        COUNT(*) AS total FROM dispositivos`
            );
            const [recientes] = await pool.query(
                `SELECT i.id, p.nombre AS producto, i.altura_cm, i.color_detectado,
                        i.peso_pieza_g, i.resultado_general, i.estado, i.fecha_inicio,
                        c.nombre AS caja
                 FROM inspecciones i
                 INNER JOIN productos p ON p.id=i.producto_id
                 LEFT JOIN cajas c ON c.id=i.caja_id
                 ORDER BY i.id DESC LIMIT 8`
            );

            res.json({ productos, cajas: cajas.total, inspecciones, dispositivos, recientes });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible cargar el panel" });
        }
    });

    return router;
};
