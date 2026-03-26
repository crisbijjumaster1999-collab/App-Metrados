// ==========================================
// 1. BASE DE DATOS Y VARIABLES GLOBALES
// ==========================================
const canvas = document.getElementById("planoColumna");
const ctx = canvas.getContext("2d");

// Pesos nominales del acero (kg/m)
const pesosAcero = {
    '1/4"': 0.25, '6 mm': 0.222, '8 mm': 0.395, '3/8"': 0.56, 
    '12 mm': 0.888, '1/2"': 0.994, '5/8"': 1.552, '3/4"': 2.235, 
    '1"': 3.973, '1 3/8"': 7.907
};

// Base de datos de AutoCAD
let dbAutoCAD = {
    seccion: { perimetro: 0, area: 0, coords: [] },
    aceroLong: { etiquetas: [], coords: [] },
    estribos: { polilineas: [], etiquetas: [] },
    ganchos: { polilineas: [], etiquetas: [] },
    mallaTrans: { polilineas: [], etiquetas: [] },
    mallaVert: { polilineas: [], etiquetas: [] }
};

// ==========================================
// 2. LECTOR DE CSV Y ANTI-ERRORES
// ==========================================
document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        procesarCSV(e.target.result);
    };
    reader.readAsText(file, 'ISO-8859-1'); 
});

function procesarCSV(csv) {
    // Limpiar base de datos
    dbAutoCAD = { seccion: { perimetro: 0, area: 0, coords: [] }, aceroLong: { etiquetas: [], coords: [] }, estribos: { polilineas: [], etiquetas: [] }, ganchos: { polilineas: [], etiquetas: [] }, mallaTrans: { polilineas: [], etiquetas: [] }, mallaVert: { polilineas: [], etiquetas: [] } };

    const lineas = csv.split('\n');
    
    for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(',');
        if (cols.length < 4) continue;

        const capa = cols[0].toUpperCase();
        const tipoObj = cols[1].toUpperCase();
        const x = parseFloat(cols[2]);
        const y = parseFloat(cols[3]);
        const valor1 = cols[4];
        const valor2 = cols[5];
        const coordsExtra = cols[6] ? cols[6].trim() : "";

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
    if (str.includes(':')) {
        return str.split('|').map(pt => {
            let coords = pt.split(':');
            return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
        });
    } else {
        return str.split('|').map(pt => {
            let coords = pt.split(';');
            return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
        });
    }
}

// ==========================================
// 3. MATEMÁTICAS Y METRADOS
// ==========================================
function decodificarEtiqueta(texto, esLongitudinal) {
    texto = texto.trim();
    if (esLongitudinal) {
        // CORREGIDO: "24 %%c 1" -> cant: 24, diam: 1
        let partes = texto.split("%%c");
        if(partes.length < 2) return { cant: 0, diam: "0" };
        return { cant: parseInt(partes[0].trim()) || 0, diam: partes[1].trim() };
    } else {
        // "%%c3/8"@.15" -> diam: 3/8", espac: 0.15
        let limpio = texto.replace("%%c", "").trim();
        let partes = limpio.split("@");
        let diam = partes[0].trim();
        let espac = partes.length > 1 ? parseFloat(partes[1].trim()) : 0;
        return { diam: diam, espac: espac };
    }
}

function calcularMetrados() {
    let alturaH = parseFloat(document.getElementById("alturaTotal").value);
    let deduccion = parseFloat(document.getElementById("deduccion").value);
    let alturaLibre = alturaH - deduccion;

    let volConcreto = dbAutoCAD.seccion.area * alturaH;
    let areaEncofrado = dbAutoCAD.seccion.perimetro * alturaLibre;
    let pesoTotalGeneral = 0;
    
    let tbody = document.getElementById("tablaCuerpo");
    tbody.innerHTML = "";
    
    function agregarFila(nombre, cant, diam, long, peso) {
        if (cant > 0) {
            pesoTotalGeneral += peso;
            tbody.innerHTML += `<tr>
                <td style="text-align: left;">${nombre}</td>
                <td>${cant}</td>
                <td>${diam}</td>
                <td>${long.toFixed(2)}</td>
                <td>${peso.toFixed(2)}</td>
            </tr>`;
        } else {
             tbody.innerHTML += `<tr>
                <td style="text-align: left; color: #94a3b8;">${nombre}</td>
                <td colspan="4" style="color: #94a3b8;">-</td>
            </tr>`;
        }
    }

    // 1. Acero Longitudinal
    let totalCantLong = 0, diamLong = "-", longLong = 0, pesoLong = 0;
    dbAutoCAD.aceroLong.etiquetas.forEach(etiq => {
        let datos = decodificarEtiqueta(etiq, true);
        if(datos.cant > 0) {
            let kgPorMetro = pesosAcero[datos.diam] || 0;
            let longPorVarilla = alturaH + 0.60; 
            totalCantLong += datos.cant; diamLong = datos.diam; longLong = longPorVarilla; pesoLong += (datos.cant * longPorVarilla * kgPorMetro);
        }
    });
    agregarFila("Acero longitudinal", totalCantLong, diamLong, longLong, pesoLong);

    // 2. Estribos
    let totalCantEst = 0, diamEst = "-", longEst = 0, pesoEst = 0;
    dbAutoCAD.estribos.etiquetas.forEach((etiq, index) => {
        let datos = decodificarEtiqueta(etiq, false);
        let polilinea = dbAutoCAD.estribos.polilineas[index];
        if(datos.espac > 0 && polilinea) {
            let cant = Math.ceil(alturaLibre / datos.espac) + 1;
            let kgPorMetro = pesosAcero[datos.diam] || 0;
            totalCantEst += cant; diamEst = datos.diam; longEst = polilinea.long; pesoEst += (cant * polilinea.long * kgPorMetro);
        }
    });
    agregarFila("Estribos", totalCantEst, diamEst, longEst, pesoEst);

    // 3. Ganchos
    let totalCantGan = 0, diamGan = "-", longGan = 0, pesoGan = 0;
    dbAutoCAD.ganchos.etiquetas.forEach((etiq, index) => {
        let datos = decodificarEtiqueta(etiq, false);
        let polilinea = dbAutoCAD.ganchos.polilineas[index];
        if(datos.espac > 0 && polilinea) {
            let cant = Math.ceil(alturaLibre / datos.espac) + 1;
            let kgPorMetro = pesosAcero[datos.diam] || 0;
            totalCantGan += cant; diamGan = datos.diam; longGan = polilinea.long; pesoGan += (cant * polilinea.long * kgPorMetro);
        }
    });
    agregarFila("Ganchos", totalCantGan, diamGan, longGan, pesoGan);

    // 4. Malla Transversal
    let totalCantMT = 0, diamMT = "-", longMT = 0, pesoMT = 0;
    dbAutoCAD.mallaTrans.etiquetas.forEach((etiq, index) => {
        let datos = decodificarEtiqueta(etiq, false);
        let polilinea = dbAutoCAD.mallaTrans.polilineas[index];
        if(datos.espac > 0 && polilinea) {
            let cant = Math.ceil(alturaLibre / datos.espac) + 1;
            let kgPorMetro = pesosAcero[datos.diam] || 0;
            totalCantMT += cant; diamMT = datos.diam; longMT = polilinea.long; pesoMT += (cant * polilinea.long * kgPorMetro);
        }
    });
    agregarFila("Malla transversal", totalCantMT, diamMT, longMT, pesoMT);

    // 5. Malla Vertical
    let totalCantMV = 0, diamMV = "-", longMV = 0, pesoMV = 0;
    dbAutoCAD.mallaVert.etiquetas.forEach((etiq, index) => {
        let datos = decodificarEtiqueta(etiq, false);
        let polilinea = dbAutoCAD.mallaVert.polilineas[index];
        if(datos.espac > 0 && polilinea) {
            // Calculamos la longitud de la polilínea extraída
            let longDistribucion = polilinea.long; 
            let cant = Math.ceil(longDistribucion / datos.espac) + 1;
            let kgPorMetro = pesosAcero[datos.diam] || 0;
            totalCantMV += cant; diamMV = datos.diam; longMV = alturaH; pesoMV += (cant * alturaH * kgPorMetro);
        }
    });
    agregarFila("Malla vertical", totalCantMV, diamMV, longMV, pesoMV);

    // C. Enviar Resultados a la Interfaz
    document.getElementById("res-concreto").innerText = volConcreto.toFixed(2);
    document.getElementById("res-encofrado").innerText = areaEncofrado.toFixed(2);
    document.getElementById("res-acero").innerText = pesoTotalGeneral.toFixed(2);
    
    let ratio = volConcreto > 0 ? (pesoTotalGeneral / volConcreto) : 0;
    document.getElementById("res-ratio").innerText = ratio.toFixed(2);
}

// ==========================================
// 4. MOTOR DE DIBUJO (AUTO-ESCALADO INTELIGENTE)
// ==========================================
function dibujarEnCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (dbAutoCAD.seccion.coords.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dbAutoCAD.seccion.coords.forEach(pt => {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
    });

    let anchoAutoCAD = maxX - minX;
    let altoAutoCAD = maxY - minY;
    
    let escalaX = (canvas.width * 0.9) / anchoAutoCAD;
    let escalaY = (canvas.height * 0.9) / altoAutoCAD;
    let escala = Math.min(escalaX, escalaY);

    let offsetX = (canvas.width / 2) - ((minX + maxX) / 2) * escala;
    let offsetY = (canvas.height / 2) + ((minY + maxY) / 2) * escala;

    function proyectarX(x) { return x * escala + offsetX; }
    function proyectarY(y) { return -y * escala + offsetY; }

    function dibujarPolilinea(coords, color, grosor, relleno = false) {
        if (!coords || coords.length === 0) return;
        ctx.beginPath();
        ctx.moveTo(proyectarX(coords[0].x), proyectarY(coords[0].y));
        for (let i = 1; i < coords.length; i++) {
            ctx.lineTo(proyectarX(coords[i].x), proyectarY(coords[i].y));
        }
        if (relleno) {
            ctx.fillStyle = color;
            ctx.fill();
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = grosor;
            ctx.stroke();
        }
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
        ctx.fillStyle = "#06b6d4";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// ==========================================
// 5. BOTÓN LIMPIAR Y EVENTOS
// ==========================================
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