const { inicializarBaseDatos, obtenerPool } = require("../src/database");

(async () => {
    try {
        await inicializarBaseDatos();
        const pool = obtenerPool();
        const [tablas] = await pool.query("SHOW TABLES");
        console.log("Conexión correcta. Tablas disponibles:");
        console.table(tablas);
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error("No fue posible preparar MySQL:");
        console.error(error.message);
        process.exit(1);
    }
})();
