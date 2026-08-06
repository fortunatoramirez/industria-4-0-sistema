const socket = io();
const formulario = document.getElementById("formularioCaja");
const mensaje = document.getElementById("mensaje");

async function cargarCajas() {
    const respuesta = await apiFetch("/api/cajas");
    const cajas = await respuesta.json();
    document.getElementById("tablaCajas").innerHTML = cajas.map(c => `
        <tr><td>${c.id}</td><td>${escapeHtml(c.nombre)}</td><td><code>${escapeHtml(c.uid_rfid)}</code></td>
        <td>${c.capacidad_max_g === null ? "Sin límite" : `${c.capacidad_max_g} g`}</td>
        <td><span class="etiqueta ${claseResultado(c.estado)}">${escapeHtml(textoResultado(c.estado))}</span></td>
        <td><button class="boton boton-pequeno ${c.estado === "activa" ? "boton-peligro" : "boton-exito"}" data-id="${c.id}" data-estado="${c.estado === "activa" ? "inactiva" : "activa"}">${c.estado === "activa" ? "Desactivar" : "Activar"}</button></td></tr>`).join("");
    document.querySelectorAll("[data-estado]").forEach(b => b.addEventListener("click", () => cambiarEstado(b.dataset.id, b.dataset.estado)));
}

async function cambiarEstado(id, estado) {
    const respuesta = await apiFetch(`/api/cajas/${id}/estado`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado })
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) return mostrarMensaje(mensaje, datos.mensaje, "error");
    mostrarMensaje(mensaje, datos.mensaje, "correcto");
    cargarCajas();
}

async function cargarEventos() {
    const respuesta = await apiFetch("/api/eventos-rfid");
    const eventos = await respuesta.json();
    document.getElementById("tablaEventos").innerHTML = eventos.map(e => `
        <tr><td>${e.id}</td><td><code>${escapeHtml(e.uid_rfid)}</code></td><td>${escapeHtml(e.caja || "Desconocida")}</td>
        <td><span class="etiqueta ${claseResultado(e.resultado)}">${escapeHtml(textoResultado(e.resultado))}</span></td>
        <td>${escapeHtml(e.dispositivo)}</td><td>${new Date(e.fecha).toLocaleString()}</td></tr>`).join("");
}

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const capacidad = document.getElementById("capacidad").value.trim();
        const respuesta = await apiFetch("/api/cajas", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombre: document.getElementById("nombre").value,
                uid_rfid: document.getElementById("uid").value,
                capacidad_max_g: capacidad === "" ? null : Number(capacidad)
            })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);
        mostrarMensaje(mensaje, datos.mensaje, "correcto");
        formulario.reset(); await cargarCajas();
    } catch (error) { mostrarMensaje(mensaje, error.message, "error"); }
});

socket.on("lectura_rfid", evento => {
    document.getElementById("ultimoUid").textContent = evento.uid_rfid;
    document.getElementById("resultadoRfid").innerHTML = `<span class="etiqueta ${claseResultado(evento.resultado)}">${escapeHtml(textoResultado(evento.resultado))}</span>`;
    document.getElementById("cajaRfid").textContent = evento.caja || "Desconocida";
    document.getElementById("uid").value = evento.uid_rfid;
    cargarEventos();
});

document.addEventListener("DOMContentLoaded", async () => { await cargarCajas(); await cargarEventos(); });
