function requiereSesionPagina(req, res, next) {
    if (!req.session.usuario) return res.redirect("/login");
    next();
}

function requiereSesionAPI(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({ correcto: false, mensaje: "Debe iniciar sesión" });
    }
    next();
}

function crearRequiereClaveDispositivo(claveEsperada) {
    return function requiereClaveDispositivo(req, res, next) {
        const clave = req.get("x-api-key");
        if (!clave || clave !== claveEsperada) {
            return res.status(401).json({ correcto: false, mensaje: "Dispositivo no autorizado" });
        }
        next();
    };
}

module.exports = {
    requiereSesionPagina,
    requiereSesionAPI,
    crearRequiereClaveDispositivo
};
