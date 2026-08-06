const express = require("express");
const bcrypt = require("bcryptjs");
const { requiereSesionAPI } = require("../middleware");

module.exports = function crearRutasAuth(pool) {
    const router = express.Router();

    router.post("/api/auth/registro", async (req, res) => {
        try {
            const nombre = String(req.body.nombre || "").trim();
            const correo = String(req.body.correo || "").trim().toLowerCase();
            const contrasena = String(req.body.contrasena || "");

            if (!nombre || !correo || !contrasena) {
                return res.status(400).json({ correcto: false, mensaje: "Todos los campos son obligatorios" });
            }
            if (contrasena.length < 6) {
                return res.status(400).json({ correcto: false, mensaje: "La contraseña debe tener al menos 6 caracteres" });
            }

            const hash = await bcrypt.hash(contrasena, 10);
            await pool.execute(
                "INSERT INTO usuarios (nombre, correo, password_hash) VALUES (?, ?, ?)",
                [nombre, correo, hash]
            );
            res.json({ correcto: true, mensaje: "Usuario registrado correctamente" });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({ correcto: false, mensaje: "El correo ya está registrado" });
            }
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "No fue posible registrar el usuario" });
        }
    });

    router.post("/api/auth/login", async (req, res) => {
        try {
            const correo = String(req.body.correo || "").trim().toLowerCase();
            const contrasena = String(req.body.contrasena || "");

            if (!correo || !contrasena) {
                return res.status(400).json({ correcto: false, mensaje: "Escriba el correo y la contraseña" });
            }

            const [usuarios] = await pool.execute(
                "SELECT id, nombre, correo, password_hash FROM usuarios WHERE correo = ?",
                [correo]
            );

            const usuario = usuarios[0] || null;
            const valida = usuario ? await bcrypt.compare(contrasena, usuario.password_hash) : false;

            await pool.execute(
                `INSERT INTO accesos (usuario_id, correo_intentado, resultado, direccion_ip)
                 VALUES (?, ?, ?, ?)`,
                [usuario ? usuario.id : null, correo, valida ? "correcto" : "incorrecto", req.ip]
            );

            if (!valida) {
                return res.status(401).json({ correcto: false, mensaje: "Correo o contraseña incorrectos" });
            }

            await new Promise((resolve, reject) => {
                req.session.regenerate(error => error ? reject(error) : resolve());
            });

            req.session.usuario = { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo };
            res.json({ correcto: true, usuario: req.session.usuario });
        } catch (error) {
            console.error(error);
            res.status(500).json({ correcto: false, mensaje: "Ocurrió un error al iniciar sesión" });
        }
    });

    router.get("/api/auth/sesion", (req, res) => {
        if (!req.session.usuario) return res.status(401).json({ autenticado: false });
        res.json({ autenticado: true, usuario: req.session.usuario });
    });

    router.post("/api/auth/logout", requiereSesionAPI, (req, res) => {
        req.session.destroy(error => {
            if (error) return res.status(500).json({ correcto: false, mensaje: "No fue posible cerrar la sesión" });
            res.json({ correcto: true });
        });
    });

    return router;
};
