// ==========================================
// 1. CONFIGURACIÓN Y BASE DE DATOS
// ==========================================
const canvas = document.getElementById("planoColumna");
const ctx = canvas.getContext("2d");

const pesosAcero = {
    '1/4"': 0.25, '6 mm': 0.222, '8 mm': 0.395, '3/8"': 0.56, 
    '12 mm': 0.888, '1/2"': 0.994, '5/8"': 1.552, '3/4"': 2.235, 
    '1"': 3.973, '1 3/8"': 7.907
};

let dbAutoCAD = {
    seccion: { perimetro: 0, area: 0, coords: [] },
    aceroLong: { etiquetas: [], coords: [] },
    estribos: { polilineas: [], etiquetas: [] },
    ganchos: { polilineas: [], etiquetas: [] },
    mallaTrans: { polilineas: [], etiquetas: [] },
    mallaVert: { polilineas: [], etiquetas: [] }
};

// ==========================================
// 2. LECTOR DE CSV Y ANTI-ERRORES DE TILDES
// ==========================================
document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { procesarCSV(e.target.result); };
    reader.readAsText(file, 'ISO-8859-1'); // Ayuda a leer caracteres latinos
});

function procesarCSV(csv) {
    limpiarDatos(); // Resetea antes de cargar nuevo
    const lineas = csv.split('\n');
    
    for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(',');
        if (cols.length < 4) continue;

        // Convertir a mayúsculas para evitar errores de tipeo
        const capa = cols[0].toUpperCase();
        const tipoObj = cols[1].toUpperCase();
        const x = parseFloat(cols[2]);
        const y = parseFloat(cols[3]);
        const valor1 = cols[4];
        const valor2 = cols[5];
        const coordsExtra = cols[6] ? cols[6].trim() : "";

        // Usamos .includes() para ignorar si la "Ó" se rompió en el CSV
        if (capa.includes("SECCI") && tipoObj === "POLILINEA") {
            dbAutoCAD.seccion.perimetro = parseFloat(valor1);
            dbAutoCAD.seccion.area = parseFloat(valor2);
            dbAutoCAD.seccion.coords = parsearCoordenadas(coordsExtra);
        }
        else if (capa.includes("LONGITUDINAL")) {
            if (tipoObj === "ETIQUETA") dbAutoCAD.aceroLong.etiquetas.push(valor1);
            if (tipoObj === "VARILLA") dbAutoCAD.aceroLong.coords.push({x, y});
        }
        else if (capa.includes("ESTRIBOS")) {
            if (tipoObj === "POLILINEA") dbAutoCAD.estribos.polilineas.push({long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra)});
            if (tipoObj === "ETIQUETA") dbAutoCAD.estribos.etiquetas.push(valor1);
        }
        else if (capa.includes("GANCHOS")) {
            if (tipoObj === "POLILINEA") dbAutoCAD.ganchos.polilineas.push({long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra)});
            if (tipoObj === "ETIQUETA") dbAutoCAD.ganchos.etiquetas.push(valor1);
        }
        else if (capa.includes("MALLA TRANS")) {
            if (tipoObj === "POLILINEA") dbAutoCAD.mallaTrans.polilineas.push({long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra)});
            if (tipoObj === "ETIQUETA") dbAutoCAD.mallaTrans.etiquetas.push(valor1);
        }
        else if (capa.includes("MALLA VERT")) {
            if (tipoObj === "POLILINEA") dbAutoCAD.mallaVert.polilineas.push({long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra)});
            if (tipoObj === "ETIQUETA") dbAutoCAD.mallaVert.etiquetas.push(valor1);
        }
    }
    dibujarEnCanvas();
    calcularMetrados();
}

function parsearCoordenadas(str) {
    if (!str) return [];
    return str.split('|').map(pt => {
        let coords = pt.split(';');
        return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
    });
}

// ==========================================
// 3. MOTOR DE CÁLCULO (LAS 5 CATEGORÍAS)
// ==========================================
function decodificarEtiqueta(texto, esLongitudinal) {
    texto = texto.trim();
    if (esLongitudinal) {
        let partes = texto.split("%%c");
        if(partes.length < 2) return { cant: 0, diam: "0" };
        return { cant: parseInt(partes[0].trim()), diam: partes[1].trim() };
    } else {
        let limpio = texto.replace("%%c", "").trim();
        let partes = limpio.split("@");
        return { diam: partes[0].trim(), espac: partes.length > 1 ? parseFloat(partes[1].trim()) : 0 };
    }
}

function calcularMetrados() {
    let alturaH = parseFloat(document.getElementById("alturaTotal").value) || 0;
    let deduccion = parseFloat(document.getElementById("deduccion").value) || 0;
    let alturaLibre = alturaH - deduccion;

    // A. Concreto
    let volConcreto = dbAutoCAD.seccion.area * alturaH;
    let areaEncofrado = dbAutoCAD.seccion.perimetro * alturaLibre;
    let pesoTotalGeneral = 0;
    let tablaHTML = "";

    // Función auxiliar para agregar filas a la tabla
    function agregarFila(nombre, cant, diam, long, peso) {
        if (cant > 0) {
            pesoTotalGeneral += peso;
            tablaHTML += `<tr><td style="text-align: left;">${nombre}</td><td>${cant}</td><td>${diam}</td><td>${long.toFixed(2)}</td><td>${peso.toFixed(2)}</td></tr>`;
        } else {
            tablaHTML += `<tr><td style="text-align: left; color: #94a3b8;">${nombre}</td><td colspan="4" style="color: #94a3b8;">-</td></tr>`;
        }
    }

    // 1. Acero Longitudinal
    let totalCantLong = 0, diamLong = "-", longLong = 0, pesoLong = 0;
    dbAutoCAD.aceroLong.etiquetas.forEach(etiq => {
        let d = decodificarEtiqueta(etiq, true);
        if(d.cant > 0) {
            let kgM = pesosAcero[d.diam] || 0;
            let longPieza = alturaH + 0.60; // Altura + traslape
            let pesoFila = d.cant * longPieza * kgM;
            totalCantLong += d.cant; diamLong = d.diam; longLong = longPieza; pesoLong += pesoFila;
        }
    });
    agregarFila("Acero longitudinal", totalCantLong, diamLong, longLong, pesoLong);

    // 2. Estribos
    let totalCantEst = 0, diamEst = "-", longEst = 0, pesoEst = 0;
    dbAutoCAD.estribos.etiquetas.forEach((etiq, i) => {
        let d = decodificarEtiqueta(etiq, false);
        let pol = dbAutoCAD.estribos.polilineas[i];
        if(d.espac > 0 && pol) {
            let cant = Math.ceil(alturaLibre / d.espac) + 1;
            let kgM = pesosAcero[d.diam] || 0;
            totalCantEst += cant; diamEst = d.diam; longEst = pol.long; pesoEst += (cant * pol.long * kgM);
        }
    });
    agregarFila("Estribos", totalCantEst, diamEst, longEst, pesoEst);

    // 3. Ganchos
    let totalCantGan = 0, diamGan = "-", longGan = 0, pesoGan = 0;
    dbAutoCAD.ganchos.etiquetas.forEach((etiq, i) => {
        let d = decodificarEtiqueta(etiq, false);
        let pol = dbAutoCAD.ganchos.polilineas[i];
        if(d.espac > 0 && pol) {
            let cant = Math.ceil(alturaLibre / d.espac) + 1;
            let kgM = pesosAcero[d.diam] || 0;
            totalCantGan += cant; diamGan = d.diam; longGan = pol.long; pesoGan += (cant * pol.long * kgM);
        }
    });
    agregarFila("Ganchos", totalCantGan, diamGan, longGan, pesoGan);

    // 4. Malla Vertical (Se distribuye a lo largo del muro)
    let totalCantMV = 0, diamMV = "-", longMV = 0, pesoMV = 0;
    dbAutoCAD.mallaVert.etiquetas.forEach((etiq, i) => {
        let d = decodificarEtiqueta(etiq, false);
        let pol = dbAutoCAD.mallaVert.polilineas[i];
        if(d.espac > 0 && pol) {
            let cant = Math.ceil(pol.long / d.espac) + 1; // Longitud de distribución / espaciamiento
            let kgM = pesosAcero[d.diam] || 0;
            let longPieza = alturaH; // El fierro sube todo el piso
            totalCantMV += cant; diamMV = d.diam; longMV = longPieza; pesoMV += (cant * longPieza * kgM);
        }
    });
    agregarFila("Malla vertical", totalCantMV, diamMV, longMV, pesoMV);

    // 5. Malla Transversal (Se distribuye en la altura)
    let totalCantMT = 0, diamMT = "-", longMT = 0, pesoMT = 0;
    dbAutoCAD.mallaTrans.etiquetas.forEach((etiq, i) => {
        let d = decodificarEtiqueta(etiq, false);
        let pol = dbAutoCAD.mallaTrans.polilineas[i];
        if(d.espac > 0 && pol) {
            let cant = Math.ceil(alturaLibre / d.espac) + 1;
            let kgM = pesosAcero[d.diam] || 0;
            totalCantMT += cant; diamMT = d.diam; longMT = pol.long; pesoMT += (cant * pol.long * kgM);
        }
    });
    agregarFila("Malla transversal", totalCantMT, diamMT, longMT, pesoMT);

    // Renderizar resultados
    document.getElementById("tablaCuerpo").innerHTML = tablaHTML;
    document.getElementById("res-concreto").innerText = volConcreto.toFixed(2);
    document.getElementById("res-encofrado").innerText = areaEncofrado.toFixed(2);
    document.getElementById("res-acero").innerText = pesoTotalGeneral.toFixed(2);
    document.getElementById("res-ratio").innerText = volConcreto > 0 ? (pesoTotalGeneral / volConcreto).toFixed(2) : "0.00";
}

// ==========================================
// 4. CANVAS Y UTILIDADES
// ==========================================
function dibujarEnCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dbAutoCAD.seccion.coords.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dbAutoCAD.seccion.coords.forEach(pt => {
        if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y;
    });

    let escalaX = (canvas.width * 0.9) / (maxX - minX);
    let escalaY = (canvas.height * 0.9) / (maxY - minY);
    let escala = Math.min(escalaX, escalaY);

    let offsetX = (canvas.width / 2) - ((minX + maxX) / 2) * escala;
    let offsetY = (canvas.height / 2) + ((minY + maxY) / 2) * escala;

    function proyectarX(x) { return x * escala + offsetX; }
    function proyectarY(y) { return -y * escala + offsetY; }

    function dibujarPolilinea(coords, color, grosor, relleno = false) {
        if (!coords || coords.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(proyectarX(coords[0].x), proyectarY(coords[0].y));
        for (let i = 1; i < coords.length; i++) ctx.lineTo(proyectarX(coords[i].x), proyectarY(coords[i].y));
        if (relleno) { ctx.fillStyle = color; ctx.fill(); } 
        else { ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.stroke(); }
    }

    dibujarPolilinea(dbAutoCAD.seccion.coords, "#e5e7eb", 2, true);
    dibujarPolilinea(dbAutoCAD.seccion.coords, "#d946ef", 2, false);
    dbAutoCAD.estribos.polilineas.forEach(est => dibujarPolilinea(est.coords, "#eab308", 2));
    dbAutoCAD.ganchos.polilineas.forEach(gan => dibujarPolilinea(gan.coords, "#22c55e", 2));
    dbAutoCAD.mallaTrans.polilineas.forEach(ml => dibujarPolilinea(ml.coords, "#ef4444", 2));
    dbAutoCAD.mallaVert.polilineas.forEach(ml => dibujarPolilinea(ml.coords, "#f97316", 2));

    dbAutoCAD.aceroLong.coords.forEach(pt => {
        ctx.beginPath();
        ctx.arc(proyectarX(pt.x), proyectarY(pt.y), 4, 0, Math.PI * 2);
        ctx.fillStyle = "#06b6d4"; ctx.fill();
        ctx.strokeStyle = "#000000"; ctx.lineWidth = 1; ctx.stroke();
    });
}

function limpiarDatos() {
    dbAutoCAD = { seccion: { perimetro: 0, area: 0, coords: [] }, aceroLong: { etiquetas: [], coords: [] }, estribos: { polilineas: [], etiquetas: [] }, ganchos: { polilineas: [], etiquetas: [] }, mallaTrans: { polilineas: [], etiquetas: [] }, mallaVert: { polilineas: [], etiquetas: [] }};
    document.getElementById("csvFileInput").value = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("tablaCuerpo").innerHTML = `<tr><td colspan="5" class="fila-ejemplo">Importa un archivo CSV para ver los datos</td></tr>`;
    document.getElementById("res-concreto").innerText = "0.00";
    document.getElementById("res-encofrado").innerText = "0.00";
    document.getElementById("res-acero").innerText = "0.00";
    document.getElementById("res-ratio").innerText = "0.00";
}

document.getElementById("btnLimpiar").addEventListener("click", limpiarDatos);
document.getElementById("alturaTotal").addEventListener("input", calcularMetrados);
document.getElementById("deduccion").addEventListener("input", calcularMetrados);