window.escapeHtml = function escapeHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
};

window.mostrarMensaje = function mostrarMensaje(elemento, texto, tipo = "correcto") {
    elemento.textContent = texto;
    elemento.className = `mensaje visible ${tipo}`;
};

window.apiFetch = async function apiFetch(url, opciones = {}) {
    const respuesta = await fetch(url, opciones);
    if (respuesta.status === 401) {
        window.location.href = "/login";
        throw new Error("Sesión no disponible");
    }
    return respuesta;
};

window.textoResultado = function textoResultado(valor) {
    const textos = {
        correcto: "Correcto",
        demasiado_bajo: "Demasiado bajo",
        demasiado_alto: "Demasiado alto",
        color_incorrecto: "Color incorrecto",
        demasiado_ligero: "Demasiado ligero",
        demasiado_pesado: "Demasiado pesado",
        sin_especificacion: "Sin especificación",
        pendiente: "Pendiente",
        aceptada: "Aceptada",
        rechazada_altura: "Rechazada por altura",
        rechazada_color: "Rechazada por color",
        rechazada_peso: "Rechazada por peso",
        rechazada_varias_causas: "Rechazada por varias causas",
        esperando_peso: "Esperando peso",
        completa: "Completa",
        cancelada: "Cancelada",
        identificada: "Identificada",
        no_registrada: "No registrada",
        inactiva: "Inactiva"
    };
    return textos[valor] || valor || "--";
};

window.claseResultado = function claseResultado(valor) {
    if (["correcto", "aceptada", "completa", "identificada", "activa"].includes(valor)) return "correcto";
    if (["pendiente", "esperando_peso", "sin_especificacion"].includes(valor)) return "aviso";
    if (["cancelada", "inactiva"].includes(valor)) return "info";
    return "error";
};

async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
}

async function prepararAplicacion() {
    const contenedor = document.getElementById("encabezadoApp");
    if (!contenedor) return;

    const respuesta = await fetch("/api/auth/sesion");
    if (!respuesta.ok) {
        window.location.href = "/login";
        return;
    }
    const datos = await respuesta.json();
    const pagina = document.body.dataset.pagina || "Sistema integral";

    contenedor.innerHTML = `
        <header class="encabezado">
            <div>
                <h1>${escapeHtml(pagina)}</h1>
                <p>Usuario: <strong>${escapeHtml(datos.usuario.nombre)}</strong></p>
            </div>
            <button id="botonCerrarSesion" class="boton boton-secundario">Cerrar sesión</button>
        </header>
        <nav class="navegacion">
            <a href="/panel">Panel</a>
            <a href="/productos">Productos</a>
            <a href="/movimientos">Inventario</a>
            <a href="/cajas">Cajas RFID</a>
            <a href="/inspecciones">Inspecciones</a>
            <a href="/estadisticas">Estadísticas</a>
        </nav>`;
    document.getElementById("botonCerrarSesion").addEventListener("click", cerrarSesion);
}

document.addEventListener("DOMContentLoaded", prepararAplicacion);
