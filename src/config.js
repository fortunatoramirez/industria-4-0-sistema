const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function entero(valor, predeterminado) {
    const numero = Number(valor);
    return Number.isInteger(numero) ? numero : predeterminado;
}

const nombreBase = String(process.env.DB_NAME || "industria40_integral").trim();

if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
    throw new Error("DB_NAME solamente puede contener letras, números y guion bajo.");
}

module.exports = {
    puerto: entero(process.env.PORT, 3000),
    sessionSecret: String(process.env.SESSION_SECRET || "cambie-esta-clave-de-sesion"),
    deviceApiKey: String(process.env.DEVICE_API_KEY || "clave-banda-industria-40"),
    database: {
        host: String(process.env.DB_HOST || "localhost"),
        port: entero(process.env.DB_PORT, 3306),
        user: String(process.env.DB_USER || "root"),
        password: String(process.env.DB_PASSWORD || ""),
        database: nombreBase
    },
    admin: {
        nombre: String(process.env.ADMIN_NAME || "Administrador"),
        correo: String(process.env.ADMIN_EMAIL || "admin@industria40.local").toLowerCase(),
        contrasena: String(process.env.ADMIN_PASSWORD || "Industria40!")
    }
};
