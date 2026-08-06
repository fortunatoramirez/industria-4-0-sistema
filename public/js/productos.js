const formulario = document.getElementById("formularioProducto");
const mensaje = document.getElementById("mensaje");
const botonCancelar = document.getElementById("botonCancelar");
let productos = [];

function valor(id) {
    const texto = document.getElementById(id).value.trim();
    return texto === "" ? null : texto;
}

function datosFormulario() {
    return {
        codigo: document.getElementById("codigo").value,
        nombre: document.getElementById("nombre").value,
        tamano: document.getElementById("tamano").value,
        cantidad: Number(document.getElementById("cantidad").value || 0),
        altura_min_cm: valor("alturaMin"),
        altura_max_cm: valor("alturaMax"),
        peso_min_g: valor("pesoMin"),
        peso_max_g: valor("pesoMax"),
        color_esperado: document.getElementById("colorEsperado").value,
        color_ref_r_pct: valor("refR"),
        color_ref_g_pct: valor("refG"),
        color_ref_b_pct: valor("refB"),
        tolerancia_color: valor("tolerancia"),
        activo: document.getElementById("activo").value === "1"
    };
}

function formatoRango(min, max, unidad) {
    if (min === null || max === null) return "Sin configurar";
    return `${min}–${max} ${unidad}`;
}

async function cargarProductos() {
    const respuesta = await apiFetch("/api/productos");
    productos = await respuesta.json();
    document.getElementById("tablaProductos").innerHTML = productos.map(p => `
        <tr>
            <td>${p.id}</td><td><code>${escapeHtml(p.codigo)}</code></td><td>${escapeHtml(p.nombre)}</td>
            <td>${p.cantidad}</td><td>${escapeHtml(formatoRango(p.altura_min_cm, p.altura_max_cm, "cm"))}</td>
            <td>${escapeHtml(formatoRango(p.peso_min_g, p.peso_max_g, "g"))}</td>
            <td>${escapeHtml(p.color_esperado || "Sin configurar")}</td>
            <td><span class="etiqueta ${p.activo ? "correcto" : "info"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
            <td><button class="boton boton-pequeno" data-editar="${p.id}">Editar</button></td>
        </tr>`).join("");
    document.querySelectorAll("[data-editar]").forEach(b => b.addEventListener("click", () => editar(Number(b.dataset.editar))));
}

function asignar(id, valorDato) { document.getElementById(id).value = valorDato ?? ""; }

function editar(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;
    asignar("productoId", p.id); asignar("codigo", p.codigo); asignar("nombre", p.nombre); asignar("tamano", p.tamano);
    asignar("cantidad", p.cantidad); asignar("alturaMin", p.altura_min_cm); asignar("alturaMax", p.altura_max_cm);
    asignar("pesoMin", p.peso_min_g); asignar("pesoMax", p.peso_max_g); asignar("colorEsperado", p.color_esperado);
    asignar("refR", p.color_ref_r_pct); asignar("refG", p.color_ref_g_pct); asignar("refB", p.color_ref_b_pct);
    asignar("tolerancia", p.tolerancia_color ?? 10); asignar("activo", p.activo ? "1" : "0");
    document.getElementById("cantidad").disabled = true;
    document.getElementById("tituloFormulario").textContent = `Editar producto #${p.id}`;
    botonCancelar.classList.remove("oculto");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function limpiar() {
    formulario.reset();
    asignar("productoId", "");
    asignar("cantidad", 0); asignar("tolerancia", 10); asignar("activo", "1");
    document.getElementById("cantidad").disabled = false;
    document.getElementById("tituloFormulario").textContent = "Registrar producto";
    botonCancelar.classList.add("oculto");
}

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const id = document.getElementById("productoId").value;
        const respuesta = await apiFetch(id ? `/api/productos/${id}` : "/api/productos", {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datosFormulario())
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);
        mostrarMensaje(mensaje, datos.mensaje, "correcto");
        limpiar();
        cargarProductos();
    } catch (error) { mostrarMensaje(mensaje, error.message, "error"); }
});

botonCancelar.addEventListener("click", limpiar);
document.addEventListener("DOMContentLoaded", cargarProductos);
