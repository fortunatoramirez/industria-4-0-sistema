const socket = io();

function numero(valor) { return valor === null || valor === undefined ? 0 : Number(valor); }

async function cargarProductos() {
    const respuesta = await apiFetch("/api/productos");
    const productos = await respuesta.json();
    document.getElementById("filtroProducto").innerHTML = `<option value="">Todos los productos</option>` + productos.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");
}

async function cargarEstadisticas() {
    const id = document.getElementById("filtroProducto").value;
    const respuesta = await apiFetch(`/api/estadisticas${id ? `?producto_id=${id}` : ""}`);
    const datos = await respuesta.json();
    const r = datos.resumen;
    const completas = numero(r.completas);
    const aceptadas = numero(r.aceptadas);
    const cumplimiento = completas > 0 ? (aceptadas / completas * 100).toFixed(1) : "0.0";

    const valores = {
        total: numero(r.total), pendientes: numero(r.pendientes), completas,
        aceptadas, rechazadas: numero(r.rechazadas), cumplimiento: `${cumplimiento} %`,
        alturaPromedio: `${numero(r.altura_promedio)} cm`, pesoPromedio: `${numero(r.peso_promedio)} g`,
        fallasAltura: numero(r.fallas_altura), fallasColor: numero(r.fallas_color), fallasPeso: numero(r.fallas_peso)
    };
    Object.entries(valores).forEach(([idElemento, valor]) => document.getElementById(idElemento).textContent = valor);

    dibujarBarras(
        document.getElementById("graficaResultados"),
        datos.distribucion.map(x => textoResultado(x.resultado_general)),
        datos.distribucion.map(x => Number(x.cantidad))
    );
    dibujarBarras(
        document.getElementById("graficaFallas"),
        ["Altura", "Color", "Peso"],
        [numero(r.fallas_altura), numero(r.fallas_color), numero(r.fallas_peso)]
    );
    const serie = [...datos.serie].reverse();
    dibujarLineas(
        document.getElementById("graficaMediciones"),
        serie.map(x => `#${x.id}`),
        [
            { nombre: "Altura cm", valores: serie.map(x => Number(x.altura_cm)) },
            { nombre: "Peso g", valores: serie.map(x => x.peso_pieza_g === null ? null : Number(x.peso_pieza_g)) },
            { nombre: "Diferencia color", valores: serie.map(x => x.diferencia_color === null ? null : Number(x.diferencia_color)) }
        ]
    );
}

document.getElementById("botonActualizar").addEventListener("click", cargarEstadisticas);
document.getElementById("filtroProducto").addEventListener("change", cargarEstadisticas);
socket.on("inspeccion_iniciada", cargarEstadisticas);
socket.on("inspeccion_completada", cargarEstadisticas);
socket.on("inspeccion_cancelada", cargarEstadisticas);
document.addEventListener("DOMContentLoaded", async () => { await cargarProductos(); await cargarEstadisticas(); });
window.addEventListener("resize", () => setTimeout(cargarEstadisticas, 150));
