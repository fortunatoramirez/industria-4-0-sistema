const express = require("express");
const path = require("path");
const { requiereSesionPagina } = require("../middleware");

module.exports = function crearRutasPaginas() {
    const router = express.Router();
    const paginas = path.join(__dirname, "..", "..", "public", "pages");
    const enviar = (res, archivo) => res.sendFile(path.join(paginas, archivo));

    router.get("/", (req, res) => res.redirect(req.session.usuario ? "/panel" : "/login"));
    router.get("/login", (req, res) => enviar(res, "login.html"));
    router.get("/registro", (req, res) => enviar(res, "registro.html"));
    router.get("/panel", requiereSesionPagina, (req, res) => enviar(res, "panel.html"));
    router.get("/productos", requiereSesionPagina, (req, res) => enviar(res, "productos.html"));
    router.get("/movimientos", requiereSesionPagina, (req, res) => enviar(res, "movimientos.html"));
    router.get("/cajas", requiereSesionPagina, (req, res) => enviar(res, "cajas.html"));
    router.get("/inspecciones", requiereSesionPagina, (req, res) => enviar(res, "inspecciones.html"));
    router.get("/estadisticas", requiereSesionPagina, (req, res) => enviar(res, "estadisticas.html"));

    return router;
};
