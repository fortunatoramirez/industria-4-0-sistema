const express = require("express");
const { requiereSesionAPI } = require("../middleware");
const {
    redondear2,
    normalizarUid,
    clasificarColorBasico,
    calcularDiferenciaColor,
    calcularResultadoGeneral
} = require("../helpers");

function validarCanales(valores) {
    return valores.every(valor => Number.isInteger(valor) && valor >= 0 && valor <= 65535);
}

module.exports = function crearRutasInspecciones(pool, io, requiereClaveDispositivo) {
    const router = express.Router();

    router.post("/api/dispositivo/inspecciones/iniciar", requiereClaveDispositivo, async (req, res) => {
        try {
            const token = String(req.body.token_evento || "").trim().slice(0, 100);
            const productoId = Number(req.body.producto_id);
            const dispositivo = String(req.body.dispositivo || "").trim();
            const distanciaBanda = Number(req.body.distancia_banda_cm);
            const distanciaObjeto = Number(req.body.distancia_objeto_cm);
            const rojoRaw = Number(req.body.rojo_raw);
            const verdeRaw = Number(req.body.verde_raw);
            const azulRaw = Number(req.body.azul_raw);
            const claroRaw = Number(req.body.claro_raw);

            if (!token || !Number.isInteger(productoId) || productoId <= 0 || !dispositivo) {
                return res.status(400).json({ correcto: false, mensaje: "Faltan datos de identificación" });
            }
            if (!Number.isFinite(distanciaBanda) || !Number.isFinite(distanciaObjeto) || distanciaBanda <= 0 || distanciaObjeto <= 0 || distanciaObjeto >= distanciaBanda) {
                return res.status(400).json({ correcto: false, mensaje: "Las distancias son inválidas" });
            }
            if (!validarCanales([rojoRaw, verdeRaw, azulRaw, claroRaw])) {
                return res.status(400).json({ correcto: false, mensaje: "Los canales de color son inválidos" });
            }

            const [existentes] = await pool.execute(
                `SELECT i.id, i.estado, i.resultado_general, p.nombre AS producto
                 FROM inspecciones i INNER JOIN productos p ON p.id=i.producto_id
                 WHERE i.token_evento=?`,
                [token]
            );
            if (existentes.length) {
                return res.json({ correcto: true, repetida: true, mensaje: "La inspección ya había sido registrada", inspeccion: existentes[0] });
            }

            const [productos] = await pool.execute(
                `SELECT id, nombre, activo, altura_min_cm, altura_max_cm,
                        color_esperado, color_ref_r_pct, color_ref_g_pct,
                        color_ref_b_pct, tolerancia_color
                 FROM productos WHERE id=?`,
                [productoId]
            );
            if (!productos.length || !productos[0].activo) {
                return res.status(404).json({ correcto: false, mensaje: "El producto no existe o está inactivo" });
            }
            const producto = productos[0];

            const altura = redondear2(distanciaBanda - distanciaObjeto);
            let resultadoAltura = "sin_especificacion";
            if (producto.altura_min_cm !== null && producto.altura_max_cm !== null) {
                if (altura < Number(producto.altura_min_cm)) resultadoAltura = "demasiado_bajo";
                else if (altura > Number(producto.altura_max_cm)) resultadoAltura = "demasiado_alto";
                else resultadoAltura = "correcto";
            }

            const sumaRgb = rojoRaw + verdeRaw + azulRaw;
            if (sumaRgb <= 0) return res.status(400).json({ correcto: false, mensaje: "No existe información de color" });
            const rojoPct = redondear2(rojoRaw * 100 / sumaRgb);
            const verdePct = redondear2(verdeRaw * 100 / sumaRgb);
            const azulPct = redondear2(azulRaw * 100 / sumaRgb);
            const colorDetectado = clasificarColorBasico(rojoPct, verdePct, azulPct);

            let diferenciaColor = null;
            let resultadoColor = "sin_especificacion";
            const referenciaCompleta = producto.color_ref_r_pct !== null && producto.color_ref_g_pct !== null &&
                producto.color_ref_b_pct !== null && producto.tolerancia_color !== null;
            if (referenciaCompleta) {
                diferenciaColor = redondear2(calcularDiferenciaColor(
                    rojoPct, verdePct, azulPct,
                    Number(producto.color_ref_r_pct), Number(producto.color_ref_g_pct), Number(producto.color_ref_b_pct)
                ));
                resultadoColor = diferenciaColor <= Number(producto.tolerancia_color) ? "correcto" : "color_incorrecto";
            }

            let resultado;
            try {
                [resultado] = await pool.execute(
                    `INSERT INTO inspecciones
                     (token_evento, producto_id, dispositivo_banda,
                      distancia_banda_cm, distancia_objeto_cm, altura_cm, resultado_altura,
                      rojo_raw, verde_raw, azul_raw, claro_raw,
                      rojo_pct, verde_pct, azul_pct, color_detectado,
                      diferencia_color, resultado_color)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [token, productoId, dispositivo, distanciaBanda, distanciaObjeto, altura, resultadoAltura,
                     rojoRaw, verdeRaw, azulRaw, claroRaw, rojoPct, verdePct, azulPct,
                     colorDetectado, diferenciaColor, resultadoColor]
                );
            } catch (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    const [duplicadas] = await pool.execute(
                        `SELECT i.id, i.estado, i.resultado_general, p.nombre AS producto
                         FROM inspecciones i INNER JOIN productos p ON p.id=i.producto_id
                         WHERE i.token_evento=?`,
                        [token]
                    );
                    return res.json({ correcto: true, repetida: true, mensaje: "La inspección ya había sido registrada", inspeccion: duplicadas[0] });
                }
                throw error;
            }

            const inspeccion = {
                id: resultado.insertId,
                producto_id: productoId,
                producto: producto.nombre,
                altura_cm: altura,
                resultado_altura: resultadoAltura,
                rojo_pct: rojoPct,
                verde_pct: verdePct,
                azul_pct: azulPct,
                color_detectado: colorDetectado,
                diferencia_color: diferenciaColor,
                resultado_color: resultadoColor,
                peso_pieza_g: null,
                caja: null,
                estado: "esperando_peso",
                resultado_general: "pendiente",
                fecha_inicio: new Date().toISOString()
            };
            io.emit("inspeccion_iniciada", inspeccion);
            res.json({ correcto: true, mensaje: "Inspección creada y esperando peso", inspeccion });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible iniciar la inspección" });
        }
    });

    router.get("/api/dispositivo/inspecciones/pendiente", requiereClaveDispositivo, async (_req, res) => {
        try {
            const [filas] = await pool.query(
                `SELECT id FROM inspecciones
                 WHERE estado='esperando_peso'
                 ORDER BY id ASC LIMIT 1`
            );
            if (!filas.length) return res.status(404).type("text/plain").send("SIN_PENDIENTES");
            res.type("text/plain").send(`OK|${filas[0].id}`);
        } catch (error) {
            console.error(error);
            res.status(500).type("text/plain").send("ERROR_SERVIDOR");
        }
    });

    router.post("/api/dispositivo/inspecciones/:id/completar-peso", requiereClaveDispositivo, async (req, res) => {
        const inspeccionId = Number(req.params.id);
        const uid = normalizarUid(req.body.uid_rfid);
        const numeroPieza = Number(req.body.numero_pieza_caja);
        const pesoAnterior = Number(req.body.peso_anterior_g);
        const pesoActual = Number(req.body.peso_actual_g);
        const dispositivo = String(req.body.dispositivo || "").trim();

        if (!Number.isInteger(inspeccionId) || inspeccionId <= 0 || uid.length < 4 || uid.length > 32 ||
            !Number.isInteger(numeroPieza) || numeroPieza <= 0 || !Number.isFinite(pesoAnterior) ||
            !Number.isFinite(pesoActual) || !dispositivo) {
            return res.status(400).json({ correcto: false, mensaje: "Los datos para completar la inspección son inválidos" });
        }

        const conexion = await pool.getConnection();
        try {
            await conexion.beginTransaction();
            const [inspecciones] = await conexion.execute(
                `SELECT i.*, p.nombre AS producto, p.cantidad, p.peso_min_g, p.peso_max_g
                 FROM inspecciones i
                 INNER JOIN productos p ON p.id=i.producto_id
                 WHERE i.id=? FOR UPDATE`,
                [inspeccionId]
            );
            if (!inspecciones.length) {
                await conexion.rollback();
                return res.status(404).json({ correcto: false, mensaje: "La inspección no existe" });
            }
            const inspeccion = inspecciones[0];
            if (inspeccion.estado === "completa") {
                await conexion.commit();
                return res.json({ correcto: true, ya_completa: true, mensaje: "La inspección ya estaba completa", inspeccion_id: inspeccionId });
            }
            if (inspeccion.estado !== "esperando_peso") {
                await conexion.rollback();
                return res.status(409).json({ correcto: false, mensaje: `La inspección tiene estado ${inspeccion.estado}` });
            }

            const [cajas] = await conexion.execute(
                "SELECT id, nombre, capacidad_max_g, estado FROM cajas WHERE uid_rfid=? FOR UPDATE",
                [uid]
            );
            if (!cajas.length) {
                await conexion.rollback();
                return res.status(404).json({ correcto: false, mensaje: "La caja no está registrada" });
            }
            const caja = cajas[0];
            if (caja.estado !== "activa") {
                await conexion.rollback();
                return res.status(403).json({ correcto: false, mensaje: "La caja está inactiva" });
            }

            const pesoPieza = redondear2(pesoActual - pesoAnterior);
            if (pesoPieza <= 0) {
                await conexion.rollback();
                return res.status(400).json({ correcto: false, mensaje: "El peso de la pieza debe ser mayor que cero" });
            }

            let resultadoPeso = "sin_especificacion";
            if (inspeccion.peso_min_g !== null && inspeccion.peso_max_g !== null) {
                if (pesoPieza < Number(inspeccion.peso_min_g)) resultadoPeso = "demasiado_ligero";
                else if (pesoPieza > Number(inspeccion.peso_max_g)) resultadoPeso = "demasiado_pesado";
                else resultadoPeso = "correcto";
            }
            const resultadoGeneral = calcularResultadoGeneral(inspeccion.resultado_altura, inspeccion.resultado_color, resultadoPeso);
            const capacidad = Number(caja.capacidad_max_g || 0);
            const cajaLlena = capacidad > 0 && pesoActual >= capacidad;

            await conexion.execute(
                `UPDATE inspecciones SET
                    caja_id=?, uid_rfid=?, numero_pieza_caja=?, dispositivo_bascula=?,
                    peso_anterior_g=?, peso_actual_g=?, peso_pieza_g=?, resultado_peso=?,
                    resultado_general=?, estado='completa', caja_llena=?, fecha_fin=CURRENT_TIMESTAMP
                 WHERE id=?`,
                [caja.id, uid, numeroPieza, dispositivo, pesoAnterior, pesoActual, pesoPieza,
                 resultadoPeso, resultadoGeneral, cajaLlena, inspeccionId]
            );

            let existencia = Number(inspeccion.cantidad);
            if (resultadoGeneral === "aceptada") {
                existencia += 1;
                await conexion.execute("UPDATE productos SET cantidad=? WHERE id=?", [existencia, inspeccion.producto_id]);
                await conexion.execute(
                    `INSERT INTO movimientos
                     (producto_id, usuario_id, inspeccion_id, tipo, cantidad, existencia_resultante, origen)
                     VALUES (?, NULL, ?, 'entrada', 1, ?, 'sensor')`,
                    [inspeccion.producto_id, inspeccionId, existencia]
                );
            }

            await conexion.commit();

            const completa = {
                id: inspeccionId,
                producto: inspeccion.producto,
                caja: caja.nombre,
                uid_rfid: uid,
                numero_pieza_caja: numeroPieza,
                altura_cm: Number(inspeccion.altura_cm),
                resultado_altura: inspeccion.resultado_altura,
                color_detectado: inspeccion.color_detectado,
                resultado_color: inspeccion.resultado_color,
                peso_pieza_g: pesoPieza,
                peso_actual_g: pesoActual,
                resultado_peso: resultadoPeso,
                resultado_general: resultadoGeneral,
                caja_llena: cajaLlena,
                estado: "completa",
                fecha_fin: new Date().toISOString()
            };
            io.emit("inspeccion_completada", completa);
            res.json({ correcto: true, mensaje: "Inspección completada", inspeccion: completa });
        } catch (error) {
            await conexion.rollback();
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible completar la inspección" });
        } finally {
            conexion.release();
        }
    });

    router.get("/api/inspecciones", requiereSesionAPI, async (req, res) => {
        try {
            const condiciones = [];
            const parametros = [];
            if (req.query.estado) {
                condiciones.push("i.estado=?");
                parametros.push(String(req.query.estado));
            }
            if (req.query.producto_id) {
                const productoId = Number(req.query.producto_id);
                if (Number.isInteger(productoId) && productoId > 0) {
                    condiciones.push("i.producto_id=?");
                    parametros.push(productoId);
                }
            }
            const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
            const [filas] = await pool.execute(
                `SELECT i.*, p.nombre AS producto, p.codigo AS producto_codigo, c.nombre AS caja
                 FROM inspecciones i
                 INNER JOIN productos p ON p.id=i.producto_id
                 LEFT JOIN cajas c ON c.id=i.caja_id
                 ${where}
                 ORDER BY i.id DESC LIMIT 300`,
                parametros
            );
            res.json(filas);
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible consultar las inspecciones" });
        }
    });

    router.patch("/api/inspecciones/:id/cancelar", requiereSesionAPI, async (req, res) => {
        try {
            const id = Number(req.params.id);
            const motivo = String(req.body.motivo || "Cancelada manualmente").trim().slice(0, 255);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ correcto: false, mensaje: "Inspección inválida" });
            const [resultado] = await pool.execute(
                `UPDATE inspecciones SET estado='cancelada', resultado_general='cancelada',
                        motivo_cancelacion=?, fecha_fin=CURRENT_TIMESTAMP
                 WHERE id=? AND estado='esperando_peso'`,
                [motivo, id]
            );
            if (!resultado.affectedRows) return res.status(409).json({ correcto: false, mensaje: "La inspección no está pendiente" });
            io.emit("inspeccion_cancelada", { id, estado: "cancelada", resultado_general: "cancelada" });
            res.json({ correcto: true, mensaje: "Inspección cancelada" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible cancelar la inspección" });
        }
    });

    router.get("/api/estadisticas", requiereSesionAPI, async (req, res) => {
        try {
            const productoId = Number(req.query.producto_id);
            const filtrar = Number.isInteger(productoId) && productoId > 0;
            const where = filtrar ? "WHERE producto_id=?" : "";
            const parametros = filtrar ? [productoId] : [];

            const [[resumen]] = await pool.execute(
                `SELECT COUNT(*) AS total,
                        SUM(estado='esperando_peso') AS pendientes,
                        SUM(estado='completa') AS completas,
                        SUM(estado='cancelada') AS canceladas,
                        SUM(resultado_general='aceptada') AS aceptadas,
                        SUM(resultado_general LIKE 'rechazada%') AS rechazadas,
                        SUM(resultado_general='sin_especificacion') AS sin_especificacion,
                        ROUND(AVG(altura_cm),2) AS altura_promedio,
                        ROUND(AVG(peso_pieza_g),2) AS peso_promedio,
                        ROUND(AVG(diferencia_color),2) AS diferencia_color_promedio,
                        SUM(resultado_altura IN ('demasiado_bajo','demasiado_alto')) AS fallas_altura,
                        SUM(resultado_color='color_incorrecto') AS fallas_color,
                        SUM(resultado_peso IN ('demasiado_ligero','demasiado_pesado')) AS fallas_peso
                 FROM inspecciones ${where}`,
                parametros
            );

            const [serie] = await pool.execute(
                `SELECT i.id, i.altura_cm, i.peso_pieza_g, i.diferencia_color,
                        i.resultado_general, i.estado, p.nombre AS producto
                 FROM inspecciones i INNER JOIN productos p ON p.id=i.producto_id
                 ${filtrar ? "WHERE i.producto_id=?" : ""}
                 ORDER BY i.id DESC LIMIT 30`,
                parametros
            );

            const [distribucion] = await pool.execute(
                `SELECT resultado_general, COUNT(*) AS cantidad
                 FROM inspecciones ${where}
                 GROUP BY resultado_general ORDER BY cantidad DESC`,
                parametros
            );

            res.json({ resumen, serie, distribucion });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible obtener las estadísticas" });
        }
    });

    return router;
};
