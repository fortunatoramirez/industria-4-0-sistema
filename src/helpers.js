function redondear2(valor) {
    return Number(Number(valor).toFixed(2));
}

function normalizarUid(valor) {
    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/[^0-9A-F]/g, "");
}

function clasificarColorBasico(rojo, verde, azul) {
    const maximo = Math.max(rojo, verde, azul);
    const minimo = Math.min(rojo, verde, azul);

    if (maximo - minimo <= 6) return "neutro";
    if (rojo >= 40 && verde >= 34 && azul <= 25) return "amarillo";
    if (rojo >= verde + 8 && rojo >= azul + 8) return "rojo";
    if (verde >= rojo + 7 && verde >= azul + 7) return "verde";
    if (azul >= rojo + 7 && azul >= verde + 7) return "azul";
    return "indeterminado";
}

function calcularDiferenciaColor(rojo, verde, azul, refR, refG, refB) {
    return Math.sqrt(
        Math.pow(rojo - refR, 2) +
        Math.pow(verde - refG, 2) +
        Math.pow(azul - refB, 2)
    );
}

function calcularResultadoGeneral(resultadoAltura, resultadoColor, resultadoPeso) {
    if ([resultadoAltura, resultadoColor, resultadoPeso].includes("sin_especificacion")) {
        return "sin_especificacion";
    }

    const fallaAltura = resultadoAltura !== "correcto";
    const fallaColor = resultadoColor !== "correcto";
    const fallaPeso = resultadoPeso !== "correcto";
    const totalFallas = Number(fallaAltura) + Number(fallaColor) + Number(fallaPeso);

    if (totalFallas === 0) return "aceptada";
    if (totalFallas > 1) return "rechazada_varias_causas";
    if (fallaAltura) return "rechazada_altura";
    if (fallaColor) return "rechazada_color";
    return "rechazada_peso";
}

function textoOpcionalANumero(valor) {
    if (valor === null || valor === undefined || String(valor).trim() === "") return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

module.exports = {
    redondear2,
    normalizarUid,
    clasificarColorBasico,
    calcularDiferenciaColor,
    calcularResultadoGeneral,
    textoOpcionalANumero
};
