const socket = io();
let inspecciones = [];

function etiqueta(valor) {
    return `<span class="etiqueta ${claseResultado(valor)}">${escapeHtml(textoResultado(valor))}</span>`;
}

function actualizarResumen(i) {
    if (!i) return;
    document.getElementById("ultimaId").textContent = `#${i.id}`;
    document.getElementById("ultimoEstado").innerHTML = etiqueta(i.estado);
    document.getElementById("ultimoResultado").innerHTML = etiqueta(i.resultado_general);
    document.getElementById("ultimaAltura").textContent = `${i.altura_cm} cm`;
    document.getElementById("ultimoColor").textContent = i.color_detectado || "--";
    document.getElementById("ultimoPeso").textContent = i.peso_pieza_g === null || i.peso_pieza_g === undefined ? "--" : `${i.peso_pieza_g} g`;
    document.getElementById("ultimaCaja").textContent = i.caja || "Sin asignar";
}

async function cargarProductos() {
    const respuesta = await apiFetch("/api/productos");
    const productos = await respuesta.json();
    document.getElementById("filtroProducto").innerHTML = `<option value="">Todos</option>` + productos.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");
}

async function cargarInspecciones() {
    const params = new URLSearchParams();
    const producto = document.getElementById("filtroProducto").value;
    const estado = document.getElementById("filtroEstado").value;
    if (producto) params.set("producto_id", producto);
    if (estado) params.set("estado", estado);
    const respuesta = await apiFetch(`/api/inspecciones?${params.toString()}`);
    inspecciones = await respuesta.json();
    document.getElementById("tablaInspecciones").innerHTML = inspecciones.map(i => {
        const fecha = i.fecha_fin || i.fecha_inicio;
        const cancelar = i.estado === "esperando_peso" ? `<button class="boton boton-peligro boton-pequeno" data-cancelar="${i.id}">Cancelar</button>` : "--";
        return `<tr><td>#${i.id}</td><td>${escapeHtml(i.producto)}</td><td>${i.altura_cm} cm</td><td>${etiqueta(i.resultado_altura)}</td>
            <td>${escapeHtml(i.color_detectado)}</td><td>${etiqueta(i.resultado_color)}</td>
            <td>${i.peso_pieza_g === null ? "--" : `${i.peso_pieza_g} g`}</td><td>${etiqueta(i.resultado_peso)}</td>
            <td>${escapeHtml(i.caja || "--")}</td><td>${i.numero_pieza_caja || "--"}</td>
            <td>${etiqueta(i.resultado_general)}</td><td>${etiqueta(i.estado)}</td>
            <td>${new Date(fecha).toLocaleString()}</td><td>${cancelar}</td></tr>`;
    }).join("");
    document.querySelectorAll("[data-cancelar]").forEach(b => b.addEventListener("click", () => cancelarInspeccion(Number(b.dataset.cancelar))));
    if (inspecciones.length) actualizarResumen(inspecciones[0]);
}

async function cancelarInspeccion(id) {
    const motivo = window.prompt("Motivo de cancelación:", "Pieza retirada o desincronización");
    if (motivo === null) return;
    const respuesta = await apiFetch(`/api/inspecciones/${id}/cancelar`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo })
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) return window.alert(datos.mensaje);
    cargarInspecciones();
}

document.getElementById("botonActualizar").addEventListener("click", cargarInspecciones);
document.getElementById("filtroProducto").addEventListener("change", cargarInspecciones);
document.getElementById("filtroEstado").addEventListener("change", cargarInspecciones);
socket.on("inspeccion_iniciada", cargarInspecciones);
socket.on("inspeccion_completada", cargarInspecciones);
socket.on("inspeccion_cancelada", cargarInspecciones);
document.addEventListener("DOMContentLoaded", async () => { await cargarProductos(); await cargarInspecciones(); });
