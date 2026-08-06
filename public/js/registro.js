const formulario = document.getElementById("formularioRegistro");
const mensaje = document.getElementById("mensaje");

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const respuesta = await fetch("/api/auth/registro", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombre: document.getElementById("nombre").value,
                correo: document.getElementById("correo").value,
                contrasena: document.getElementById("contrasena").value
            })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje || "No fue posible registrar el usuario");
        mensaje.textContent = datos.mensaje;
        mensaje.className = "mensaje visible correcto";
        formulario.reset();
        setTimeout(() => window.location.href = "/login", 900);
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.className = "mensaje visible error";
    }
});
