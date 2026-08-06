const formulario = document.getElementById("formularioLogin");
const mensaje = document.getElementById("mensaje");

formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
        const respuesta = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                correo: document.getElementById("correo").value,
                contrasena: document.getElementById("contrasena").value
            })
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje || "No fue posible iniciar sesión");
        window.location.href = "/panel";
    } catch (error) {
        mensaje.textContent = error.message;
        mensaje.className = "mensaje visible error";
    }
});
