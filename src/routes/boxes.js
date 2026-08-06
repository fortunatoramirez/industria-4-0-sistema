const express = require("express");
const { requiereSesionAPI } = require("../middleware");
const { normalizarUid, textoOpcionalANumero } = require("../helpers");

module.exports = function crearRutasCajas(pool, io, requiereClaveDispositivo) {
    const router = express.Router();

    router.get("/api/cajas", requiereSesionAPI, async (_req, res) => {
        try {
            const [cajas] = await pool.query("SELECT * FROM cajas ORDER BY nombre");
            res.json(cajas);
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible consultar las cajas" });
        }
    });

    router.post("/api/cajas", requiereSesionAPI, async (req, res) => {
        try {
            const nombre = String(req.body.nombre || "").trim();
            const uid = normalizarUid(req.body.uid_rfid);
            const capacidad = textoOpcionalANumero(req.body.capacidad_max_g);

            if (!nombre || nombre.includes("|")) return res.status(400).json({ correcto: false, mensaje: "El nombre es obligatorio y no puede contener |" });
            if (uid.length < 4 || uid.length > 32) return res.status(400).json({ correcto: false, mensaje: "El UID es inválido" });
            if (Number.isNaN(capacidad) || (capacidad !== null && capacidad <= 0)) {
                return res.status(400).json({ correcto: false, mensaje: "La capacidad debe ser mayor que cero" });
            }

            const [resultado] = await pool.execute(
                `INSERT INTO cajas (nombre, uid_rfid, capacidad_max_g, estado)
                 VALUES (?, ?, ?, 'activa')`,
                [nombre, uid, capacidad]
            );
            res.json({ correcto: true, id: resultado.insertId, mensaje: "Caja registrada" });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ correcto: false, mensaje: "El UID ya está registrado" });
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible registrar la caja" });
        }
    });

    router.patch("/api/cajas/:id/estado", requiereSesionAPI, async (req, res) => {
        try {
            const id = Number(req.params.id);
            const estado = String(req.body.estado || "").trim();
            if (!Number.isInteger(id) || id <= 0 || !["activa", "inactiva"].includes(estado)) {
                return res.status(400).json({ correcto: false, mensaje: "Datos inválidos" });
            }
            const [resultado] = await pool.execute("UPDATE cajas SET estado=? WHERE id=?", [estado, id]);
            if (!resultado.affectedRows) return res.status(404).json({ correcto: false, mensaje: "La caja no existe" });
            res.json({ correcto: true, mensaje: "Estado actualizado" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible cambiar el estado" });
        }
    });

    router.get("/api/eventos-rfid", requiereSesionAPI, async (_req, res) => {
        try {
            const [eventos] = await pool.query(
                `SELECT e.id, e.uid_rfid, e.dispositivo, e.resultado, e.fecha,
                        c.nombre AS caja
                 FROM eventos_rfid e
                 LEFT JOIN cajas c ON c.id=e.caja_id
                 ORDER BY e.id DESC LIMIT 100`
            );
            res.json(eventos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible consultar los eventos RFID" });
        }
    });

    router.post("/api/dispositivo/rfid/identificar", requiereClaveDispositivo, async (req, res) => {
        try {
            const uid = normalizarUid(req.body.uid_rfid);
            const dispositivo = String(req.body.dispositivo || "").trim();
            if (uid.length < 4 || uid.length > 32 || !dispositivo) {
                return res.status(400).type("text/plain").send("DATOS_INVALIDOS");
            }

            const [cajas] = await pool.execute(
                "SELECT id, nombre, uid_rfid, capacidad_max_g, estado FROM cajas WHERE uid_rfid=?",
                [uid]
            );
            const caja = cajas[0] || null;
            const resultado = !caja ? "no_registrada" : caja.estado === "activa" ? "identificada" : "inactiva";

            await pool.execute(
                `INSERT INTO eventos_rfid (caja_id, uid_rfid, dispositivo, resultado)
                 VALUES (?, ?, ?, ?)`,
                [caja ? caja.id : null, uid, dispositivo, resultado]
            );

            io.emit("lectura_rfid", {
                uid_rfid: uid,
                dispositivo,
                resultado,
                caja: caja ? caja.nombre : null,
                capacidad_max_g: caja ? caja.capacidad_max_g : null,
                fecha: new Date().toISOString()
            });

            if (!caja) return res.status(404).type("text/plain").send("NO_REGISTRADA");
            if (caja.estado !== "activa") return res.status(403).type("text/plain").send("CAJA_INACTIVA");

            res.type("text/plain").send(`OK|${caja.id}|${caja.nombre}|${Number(caja.capacidad_max_g || 0)}`);
        } catch (error) {
            console.error(error);
            res.status(500).type("text/plain").send("ERROR_SERVIDOR");
        }
    });

    return router;
};
