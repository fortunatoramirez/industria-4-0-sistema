function prepararCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const ancho = Math.max(canvas.clientWidth, 320);
    const alto = Math.max(canvas.clientHeight, 240);
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    return { ctx, ancho, alto };
}

window.dibujarBarras = function dibujarBarras(canvas, etiquetas, valores) {
    const { ctx, ancho, alto } = prepararCanvas(canvas);
    const margen = { izq: 48, der: 18, sup: 22, inf: 64 };
    const maximo = Math.max(...valores.map(Number), 1);
    const areaW = ancho - margen.izq - margen.der;
    const areaH = alto - margen.sup - margen.inf;
    const paso = areaW / Math.max(valores.length, 1);
    const barra = Math.max(8, paso * 0.6);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#475569";
    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(margen.izq, margen.sup);
    ctx.lineTo(margen.izq, margen.sup + areaH);
    ctx.lineTo(margen.izq + areaW, margen.sup + areaH);
    ctx.stroke();

    valores.forEach((valor, i) => {
        const v = Number(valor) || 0;
        const h = v / maximo * areaH;
        const x = margen.izq + i * paso + (paso - barra) / 2;
        const y = margen.sup + areaH - h;
        ctx.fillStyle = "#075985";
        ctx.fillRect(x, y, barra, h);
        ctx.fillStyle = "#172033";
        ctx.textAlign = "center";
        ctx.fillText(String(v), x + barra / 2, Math.max(14, y - 5));
        const etiqueta = String(etiquetas[i] ?? "").slice(0, 16);
        ctx.save();
        ctx.translate(x + barra / 2, margen.sup + areaH + 12);
        ctx.rotate(-0.45);
        ctx.fillText(etiqueta, 0, 0);
        ctx.restore();
    });
};

window.dibujarLineas = function dibujarLineas(canvas, etiquetas, series) {
    const { ctx, ancho, alto } = prepararCanvas(canvas);
    const margen = { izq: 52, der: 20, sup: 30, inf: 48 };
    const valores = series.flatMap(s => s.valores.filter(v => v !== null && Number.isFinite(Number(v))).map(Number));
    const maximo = Math.max(...valores, 1);
    const minimo = Math.min(...valores, 0);
    const rango = maximo - minimo || 1;
    const areaW = ancho - margen.izq - margen.der;
    const areaH = alto - margen.sup - margen.inf;

    ctx.strokeStyle = "#cbd5e1";
    ctx.beginPath();
    ctx.moveTo(margen.izq, margen.sup);
    ctx.lineTo(margen.izq, margen.sup + areaH);
    ctx.lineTo(margen.izq + areaW, margen.sup + areaH);
    ctx.stroke();

    const trazos = ["#075985", "#15803d", "#b45309", "#7e22ce"];
    series.forEach((serie, indiceSerie) => {
        ctx.strokeStyle = trazos[indiceSerie % trazos.length];
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let iniciado = false;
        serie.valores.forEach((valor, i) => {
            if (valor === null || !Number.isFinite(Number(valor))) {
                iniciado = false;
                return;
            }
            const x = margen.izq + (etiquetas.length <= 1 ? areaW / 2 : i * areaW / (etiquetas.length - 1));
            const y = margen.sup + areaH - ((Number(valor) - minimo) / rango * areaH);
            if (!iniciado) { ctx.moveTo(x, y); iniciado = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
    });

    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    series.forEach((serie, i) => {
        ctx.fillStyle = trazos[i % trazos.length];
        ctx.fillRect(margen.izq + i * 140, 8, 12, 12);
        ctx.fillStyle = "#172033";
        ctx.fillText(serie.nombre, margen.izq + 18 + i * 140, 18);
    });
};
