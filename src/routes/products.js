const express = require("express");
const { requiereSesionAPI } = require("../middleware");
const { textoOpcionalANumero } = require("../helpers");

function datosProducto(body) {
    const datos = {
        codigo: String(body.codigo || "").trim().toUpperCase(),
        nombre: String(body.nombre || "").trim(),
        tamano: String(body.tamano || "").trim() || null,
        alturaMin: textoOpcionalANumero(body.altura_min_cm),
        alturaMax: textoOpcionalANumero(body.altura_max_cm),
        pesoMin: textoOpcionalANumero(body.peso_min_g),
        pesoMax: textoOpcionalANumero(body.peso_max_g),
        colorEsperado: String(body.color_esperado || "").trim().toLowerCase() || null,
        refR: textoOpcionalANumero(body.color_ref_r_pct),
        refG: textoOpcionalANumero(body.color_ref_g_pct),
        refB: textoOpcionalANumero(body.color_ref_b_pct),
        tolerancia: textoOpcionalANumero(body.tolerancia_color),
        activo: body.activo === false || body.activo === 0 || body.activo === "0" ? 0 : 1
    };
    return datos;
}

function validarProducto(d) {
    if (!d.codigo || !d.nombre) return "Código y nombre son obligatorios";
    const numeros = [d.alturaMin, d.alturaMax, d.pesoMin, d.pesoMax, d.refR, d.refG, d.refB, d.tolerancia];
    if (numeros.some(valor => Number.isNaN(valor))) return "Existe un valor numérico inválido";
    if (d.alturaMin !== null && d.alturaMax !== null && d.alturaMin > d.alturaMax) return "La altura mínima no puede ser mayor que la máxima";
    if (d.pesoMin !== null && d.pesoMax !== null && d.pesoMin > d.pesoMax) return "El peso mínimo no puede ser mayor que el máximo";
    if ([d.refR, d.refG, d.refB].some(v => v !== null && (v < 0 || v > 100))) return "Las referencias RGB deben estar entre 0 y 100";
    if (d.tolerancia !== null && d.tolerancia < 0) return "La tolerancia no puede ser negativa";
    return null;
}

module.exports = function crearRutasProductos(pool) {
    const router = express.Router();

    router.get("/api/productos", requiereSesionAPI, async (_req, res) => {
        try {
            const [productos] = await pool.query(
                `SELECT * FROM productos ORDER BY activo DESC, nombre ASC`
            );
            res.json(productos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible consultar los productos" });
        }
    });

    router.post("/api/productos", requiereSesionAPI, async (req, res) => {
        try {
            const d = datosProducto(req.body);
            const errorValidacion = validarProducto(d);
            if (errorValidacion) return res.status(400).json({ correcto: false, mensaje: errorValidacion });

            const cantidad = Number(req.body.cantidad || 0);
            if (!Number.isInteger(cantidad) || cantidad < 0) {
                return res.status(400).json({ correcto: false, mensaje: "La cantidad inicial debe ser un entero no negativo" });
            }

            const [resultado] = await pool.execute(
                `INSERT INTO productos
                 (codigo, nombre, tamano, cantidad, altura_min_cm, altura_max_cm,
                  peso_min_g, peso_max_g, color_esperado, color_ref_r_pct,
                  color_ref_g_pct, color_ref_b_pct, tolerancia_color, activo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [d.codigo, d.nombre, d.tamano, cantidad, d.alturaMin, d.alturaMax,
                 d.pesoMin, d.pesoMax, d.colorEsperado, d.refR, d.refG, d.refB,
                 d.tolerancia ?? 10, d.activo]
            );
            res.json({ correcto: true, id: resultado.insertId, mensaje: "Producto registrado" });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ correcto: false, mensaje: "El código del producto ya existe" });
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible registrar el producto" });
        }
    });

    router.put("/api/productos/:id", requiereSesionAPI, async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ correcto: false, mensaje: "Producto inválido" });
            const d = datosProducto(req.body);
            const errorValidacion = validarProducto(d);
            if (errorValidacion) return res.status(400).json({ correcto: false, mensaje: errorValidacion });

            const [resultado] = await pool.execute(
                `UPDATE productos SET
                    codigo=?, nombre=?, tamano=?, altura_min_cm=?, altura_max_cm=?,
                    peso_min_g=?, peso_max_g=?, color_esperado=?, color_ref_r_pct=?,
                    color_ref_g_pct=?, color_ref_b_pct=?, tolerancia_color=?, activo=?
                 WHERE id=?`,
                [d.codigo, d.nombre, d.tamano, d.alturaMin, d.alturaMax, d.pesoMin,
                 d.pesoMax, d.colorEsperado, d.refR, d.refG, d.refB,
                 d.tolerancia ?? 10, d.activo, id]
            );
            if (!resultado.affectedRows) return res.status(404).json({ correcto: false, mensaje: "El producto no existe" });
            res.json({ correcto: true, mensaje: "Producto actualizado" });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ correcto: false, mensaje: "El código del producto ya existe" });
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible actualizar el producto" });
        }
    });

    router.post("/api/movimientos", requiereSesionAPI, async (req, res) => {
        const productoId = Number(req.body.producto_id);
        const tipo = String(req.body.tipo || "").trim();
        const cantidad = Number(req.body.cantidad);

        if (!Number.isInteger(productoId) || productoId <= 0 || !["entrada", "salida"].includes(tipo) || !Number.isInteger(cantidad) || cantidad <= 0) {
            return res.status(400).json({ correcto: false, mensaje: "Revise los datos del movimiento" });
        }

        const conexion = await pool.getConnection();
        try {
            await conexion.beginTransaction();
            const [productos] = await conexion.execute("SELECT cantidad FROM productos WHERE id=? FOR UPDATE", [productoId]);
            if (!productos.length) {
                await conexion.rollback();
                return res.status(404).json({ correcto: false, mensaje: "El producto no existe" });
            }
            const actual = Number(productos[0].cantidad);
            const nueva = tipo === "entrada" ? actual + cantidad : actual - cantidad;
            if (nueva < 0) {
                await conexion.rollback();
                return res.status(400).json({ correcto: false, mensaje: "No hay suficientes existencias" });
            }
            await conexion.execute("UPDATE productos SET cantidad=? WHERE id=?", [nueva, productoId]);
            await conexion.execute(
                `INSERT INTO movimientos
                 (producto_id, usuario_id, tipo, cantidad, existencia_resultante, origen)
                 VALUES (?, ?, ?, ?, ?, 'manual')`,
                [productoId, req.session.usuario.id, tipo, cantidad, nueva]
            );
            await conexion.commit();
            res.json({ correcto: true, mensaje: "Movimiento registrado", existencia: nueva });
        } catch (error) {
            await conexion.rollback();
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible registrar el movimiento" });
        } finally {
            conexion.release();
        }
    });

    router.get("/api/movimientos", requiereSesionAPI, async (_req, res) => {
        try {
            const [movimientos] = await pool.query(
                `SELECT m.id, p.nombre AS producto, m.tipo, m.cantidad,
                        m.existencia_resultante, m.origen, u.nombre AS usuario,
                        m.inspeccion_id, m.fecha
                 FROM movimientos m
                 INNER JOIN productos p ON p.id=m.producto_id
                 LEFT JOIN usuarios u ON u.id=m.usuario_id
                 ORDER BY m.id DESC LIMIT 200`
            );
            res.json(movimientos);
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible consultar los movimientos" });
        }
    });

    return router;
};
