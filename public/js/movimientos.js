const formulario = document.getElementById("formularioMovimiento");
const mensaje = document.getElementById("mensaje");

async function cargarProductos() {
    const respuesta = await apiFetch("/api/productos");
    const productos = await respuesta.json();
    document.getElementById("producto").innerHTML = productos.filter(p => p.activo).map(p =>
        `<option value="${p.id}">${escapeHtml(p.nombre)} · existencia ${p.cantidad}</option>`).join("");
}

async function cargarMovimientos() {
    const respuesta = await apiFetch("/api/movimientos");
    const movimientos = await respuesta.json();
    document.getElementById("tablaMovimientos").innerHTML = movimientos.map(m => `
        <tr><td>${m.id}</td><td>${escapeHtml(m.producto)}</td><td>${escapeHtml(m.tipo)}</td>
        <td>${m.cantidad}</td><td>${m.existencia_resultante}</td><td>${escapeHtml(m.origen)}</td>
        <td>${m.inspeccion_id ? `#${m.inspeccion_id}` : "--"}</td><td>${escapeHtml(m.usuario || "Sistema")}</td>
        <td>${new Date(m.fecha).toLocaleString()}</td></tr>`).join("");
}

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const respuesta = await apiFetch("/api/movimientos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                producto_id: Number(document.getElementById("producto").value),
                tipo: document.getElementById("tipo").value,
                cantidad: Number(document.getElementById("cantidad").value)
            })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);
        mostrarMensaje(mensaje, `${datos.mensaje}. Existencia: ${datos.existencia}`, "correcto");
        await cargarProductos(); await cargarMovimientos();
    } catch (error) { mostrarMensaje(mensaje, error.message, "error"); }
});

document.addEventListener("DOMContentLoaded", async () => { await cargarProductos(); await cargarMovimientos(); });
