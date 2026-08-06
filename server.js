const path = require("path");
const http = require("http");
const express = require("express");
const session = require("express-session");
const { Server } = require("socket.io");

const config = require("./src/config");
const { inicializarBaseDatos } = require("./src/database");
const { crearRequiereClaveDispositivo } = require("./src/middleware");
const crearRutasPaginas = require("./src/routes/pages");
const crearRutasAuth = require("./src/routes/auth");
const crearRutasProductos = require("./src/routes/products");
const crearRutasCajas = require("./src/routes/boxes");
const crearRutasInspecciones = require("./src/routes/inspections");
const crearRutasDashboard = require("./src/routes/dashboard");

async function iniciar() {
    const pool = await inicializarBaseDatos();
    const app = express();
    const servidorHTTP = http.createServer(app);
    const io = new Server(servidorHTTP);
    const requiereClaveDispositivo = crearRequiereClaveDispositivo(config.deviceApiKey);

    app.disable("x-powered-by");
    app.use(express.json({ limit: "200kb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 1000 * 60 * 60 * 8,
            httpOnly: true,
            sameSite: "lax"
        }
    }));

    app.use("/css", express.static(path.join(__dirname, "public", "css")));
    app.use("/js", express.static(path.join(__dirname, "public", "js")));

    app.use(crearRutasPaginas());
    app.use(crearRutasAuth(pool));
    app.use(crearRutasProductos(pool));
    app.use(crearRutasCajas(pool, io, requiereClaveDispositivo));
    app.use(crearRutasInspecciones(pool, io, requiereClaveDispositivo));
    app.use(crearRutasDashboard(pool, requiereClaveDispositivo));

    app.use((req, res) => {
        if (req.path.startsWith("/api/")) {
            return res.status(404).json({ correcto: false, mensaje: "Ruta API no encontrada" });
        }
        res.status(404).send("Página no encontrada");
    });

    app.use((error, _req, res, _next) => {
        console.error(error);
        res.status(500).json({ correcto: false, mensaje: "Error interno del servidor" });
    });

    io.on("connection", socket => {
        console.log(`Página conectada por Socket.IO: ${socket.id}`);
    });

    servidorHTTP.listen(config.puerto, "0.0.0.0", () => {
        console.log("==================================================");
        console.log("Sistema integral de Industria 4.0 preparado");
        console.log(`Servidor local: http://localhost:${config.puerto}`);
        console.log(`Base de datos: ${config.database.database}`);
        console.log("==================================================");
    });
}

iniciar().catch(error => {
    console.error("No fue posible iniciar el sistema:");
    console.error(error.message);
    console.error("Revise el archivo .env y confirme que MySQL esté ejecutándose.");
    process.exit(1);
});
