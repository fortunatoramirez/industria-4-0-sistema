const socket = io();

function etiqueta(valor) {
    return `<span class="etiqueta ${claseResultado(valor)}">${escapeHtml(textoResultado(valor))}</span>`;
}

async function cargarPanel() {
    const respuesta = await apiFetch("/api/panel/resumen");
    const datos = await respuesta.json();
    document.getElementById("totalProductos").textContent = datos.productos.total || 0;
    document.getElementById("totalInventario").textContent = datos.productos.inventario || 0;
    document.getElementById("totalPendientes").textContent = datos.inspecciones.pendientes || 0;
    document.getElementById("totalAceptadas").textContent = datos.inspecciones.aceptadas || 0;
    document.getElementById("totalRechazadas").textContent = datos.inspecciones.rechazadas || 0;
    document.getElementById("dispositivosLinea").textContent = `${datos.dispositivos.en_linea || 0}/${datos.dispositivos.total || 0}`;

    document.getElementById("tablaRecientes").innerHTML = datos.recientes.map(i => `
        <tr><td>#${i.id}</td><td>${escapeHtml(i.producto)}</td><td>${etiqueta(i.estado)}</td>
        <td>${etiqueta(i.resultado_general)}</td><td>${escapeHtml(i.caja || "--")}</td></tr>`).join("");
    await cargarDispositivos();
}

async function cargarDispositivos() {
    const respuesta = await apiFetch("/api/dispositivos");
    const dispositivos = await respuesta.json();
    const contenedor = document.getElementById("listaDispositivos");
    if (!dispositivos.length) {
        contenedor.textContent = "Todavía no se han recibido latidos de los ESP32.";
        return;
    }
    contenedor.innerHTML = dispositivos.map(d => `
        <div class="estado-dispositivo">
            <div><span class="punto ${d.en_linea ? "en-linea" : "fuera"}"></span><strong>${escapeHtml(d.nombre)}</strong><br><span class="subtexto">${escapeHtml(d.tipo)} · ${escapeHtml(d.detalle || "")}</span></div>
            <div>${d.en_linea ? "En línea" : `Sin señal: ${d.segundos_sin_conexion}s`}</div>
        </div>`).join("");
}

document.addEventListener("DOMContentLoaded", cargarPanel);
socket.on("inspeccion_iniciada", cargarPanel);
socket.on("inspeccion_completada", cargarPanel);
socket.on("inspeccion_cancelada", cargarPanel);
setInterval(cargarPanel, 15000);
