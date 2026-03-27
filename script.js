// ==========================================
// 1. CONFIGURACIÓN BASE Y ESTADO DINÁMICO
// ==========================================
const canvas = document.getElementById("planoColumna");
const ctx = canvas.getContext("2d");

// Base de datos Editable por el usuario (Actualizada con ganchos 135°)
let configAceros = {
    '6 mm': { peso: 0.22, empalme: 0.30, gancho135: 0.06 }, 
    '8 mm': { peso: 0.40, empalme: 0.30, gancho135: 0.08 },
    '12 mm': { peso: 0.86, empalme: 0.30, gancho135: 0.12 },
    '1/4"': { peso: 0.25, empalme: 0.30, gancho135: 0.065 },
    '3/8"': { peso: 0.56, empalme: 0.30, gancho135: 0.10 }, 
    '1/2"': { peso: 0.99, empalme: 0.40, gancho135: 0.13 }, 
    '5/8"': { peso: 1.56, empalme: 0.50, gancho135: 0.16 }, 
    '3/4"': { peso: 2.24, empalme: 0.60, gancho135: 0.19 },
    '1"': { peso: 3.96, empalme: 1.00, gancho135: 0.25 },
    '1 3/8"': { peso: 7.907, empalme: 1.55, gancho135: 0.35 }
};

// Variable Global de Recubrimiento
let recubrimientoGlobal = 0.04; 

let dbAutoCAD = { 
    seccion: { perimetro: 0, area: 0, coords: [] }, 
    aceroLong: { varillas: [] }, 
    estribos: { polilineas: [] }, 
    ganchos: { polilineas: [] }, 
    mallaTrans: { polilineas: [] }, 
    mallaVert: { polilineas: [] } 
};
let filasTabla = []; 

// ==========================================
// 2. MODAL DE CONFIGURACIÓN
// ==========================================
function abrirModalConfig() {
    let tbody = document.getElementById("tablaConfigCuerpo");
    tbody.innerHTML = "";
    
    document.getElementById("recubrimientoModalInput").value = recubrimientoGlobal.toFixed(2);

    for (const [diam, datos] of Object.entries(configAceros)) {
        tbody.innerHTML += `
            <tr>
                <td><strong>${diam}</strong></td>
                <td><input type="number" step="0.001" id="peso_${diam}" value="${datos.peso}"></td>
                <td><input type="number" step="0.01" id="emp_${diam}" value="${datos.empalme}"></td>
                <td><input type="number" step="0.001" id="g135_${diam}" value="${datos.gancho135}"></td>
            </tr>`;
    }
    document.getElementById("modalConfig").style.display = "flex";
}

function cerrarModalConfig(guardarCambios) {
    if (guardarCambios) {
        recubrimientoGlobal = parseFloat(document.getElementById("recubrimientoModalInput").value) || 0.04;

        for (const diam of Object.keys(configAceros)) {
            let p = parseFloat(document.getElementById(`peso_${diam}`).value);
            let e = parseFloat(document.getElementById(`emp_${diam}`).value);
            let g = parseFloat(document.getElementById(`g135_${diam}`).value); 
            if(!isNaN(p)) configAceros[diam].peso = p;
            if(!isNaN(e)) configAceros[diam].empalme = e;
            if(!isNaN(g)) configAceros[diam].gancho135 = g; 
        }
        
        generarFilasEstructurales(); 
    }
    document.getElementById("modalConfig").style.display = "none";
}

// ==========================================
// 3. LECTOR CSV Y AUTO-NOMBRE
// ==========================================
document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    let nombreSinExtension = file.name.replace(/\.[^/.]+$/, ""); 
    document.getElementById("nombreElemento").value = nombreSinExtension;

    const reader = new FileReader();
    reader.onload = function(e) { procesarCSV(e.target.result); };
    reader.readAsText(file, 'ISO-8859-1'); 
});

function procesarCSV(csv) {
    dbAutoCAD = { seccion: { perimetro: 0, area: 0, coords: [] }, aceroLong: { varillas: [] }, estribos: { polilineas: [] }, ganchos: { polilineas: [] }, mallaTrans: { polilineas: [] }, mallaVert: { polilineas: [] } };
    const lineas = csv.split('\n');
    
    for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(',');
        if (cols.length < 5) continue;

        const capa = cols[0].toUpperCase(), tipoObj = cols[1].toUpperCase(), etiqueta = cols[2];
        const x = parseFloat(cols[3]), y = parseFloat(cols[4]);
        const valor1 = cols[5], valor2 = cols[6], coordsExtra = cols[7] ? cols[7].trim() : "";

        if (capa.includes("SECCI") && tipoObj === "POLILINEA") {
            dbAutoCAD.seccion.perimetro = parseFloat(valor1); dbAutoCAD.seccion.area = parseFloat(valor2); dbAutoCAD.seccion.coords = parsearCoordenadas(coordsExtra);
        }
        else if (capa.includes("LONGITUDINAL") && tipoObj === "VARILLA") {
            dbAutoCAD.aceroLong.varillas.push({ x, y, texto: etiqueta });
        }
        else if (capa.includes("ESTRIBOS") && tipoObj === "POLILINEA") {
            dbAutoCAD.estribos.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta });
        }
        else if (capa.includes("GANCHOS") && tipoObj === "POLILINEA") {
            dbAutoCAD.ganchos.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta });
        }
        else if (capa.includes("MALLA TRANS") && tipoObj === "POLILINEA") {
            dbAutoCAD.mallaTrans.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta });
        }
        else if (capa.includes("MALLA VERT") && tipoObj === "POLILINEA") {
            dbAutoCAD.mallaVert.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta });
        }
    }
    dibujarEnCanvas();
    generarFilasEstructurales(); 
}

function parsearCoordenadas(str) {
    if (!str) return [];
    let sep = str.includes(':') ? ':' : ';';
    return str.split('|').map(pt => { let c = pt.split(sep); return { x: parseFloat(c[0]), y: parseFloat(c[1]) }; });
}

function decodificarEtiqueta(texto, esLongitudinal) {
    if (!texto || texto === "-") return { cant: 0, diam: "-", espac: 0 };
    texto = texto.trim();
    if (esLongitudinal) {
        let partes = texto.split("%%c");
        return { cant: partes.length >= 2 ? parseInt(partes[partes.length - 2].trim()) || 0 : 0, diam: partes.length >= 2 ? partes[partes.length - 1].trim() : "0" };
    } else {
        let limpio = texto.replace("%%c", "").trim();
        let partes = limpio.split("@");
        return { diam: partes[0].trim(), espac: partes.length > 1 ? parseFloat(partes[1].trim()) : 0 };
    }
}

// ==========================================
// 4. GENERACIÓN DE FILAS 
// ==========================================
function generarFilasEstructurales() {
    filasTabla = [];
    let alturaH = parseFloat(document.getElementById("alturaTotal").value) || 3;
    let deduccion = parseFloat(document.getElementById("deduccion").value) || 0.20;
    let alturaLibre = alturaH - deduccion;

    document.getElementById("infoPerimetro").value = dbAutoCAD.seccion.perimetro.toFixed(3);
    document.getElementById("infoArea").value = dbAutoCAD.seccion.area.toFixed(3);
    
    let tipoEnc = alturaLibre <= 3.6 ? "Simple" : (alturaLibre <= 5 ? "Doble" : "Triple");
    if(dbAutoCAD.seccion.perimetro === 0) tipoEnc = "-";
    document.getElementById("infoEncofrado").value = tipoEnc;

    // 1. Acero Longitudinal 
    let gruposLong = {};
    dbAutoCAD.aceroLong.varillas.forEach(varilla => {
        if (!gruposLong[varilla.texto]) {
            let d = decodificarEtiqueta(varilla.texto, true);
            if (d.cant > 0) gruposLong[varilla.texto] = d;
        }
    });

    let contLong = 1;
    let keysLong = Object.keys(gruposLong);
    for (const key of keysLong) {
        let d = gruposLong[key];
        filasTabla.push({
            nombre: "Acero longitudinal" + (keysLong.length > 1 ? ` ${contLong}` : ""),
            similares: d.cant, 
            diam: d.diam, 
            longPieza: alturaH, 
            desarrollo: 0, 
            forma: "-", 
            espac: "-", 
            numXPiso: 1, 
            editableDesarrollo: true, 
            editableForma: true, 
            esEstribo: false 
        });
        contLong++;
    }

    function agruparYAgregar(polilineas, prefijoNombre, calcNumXPiso, calcLongPieza, esMallaVertical = false) {
        if (polilineas.length === 0) return;
        let grupos = {};

        polilineas.forEach(pol => {
            let d = decodificarEtiqueta(pol.texto, false);
            let long = calcLongPieza(pol.long, alturaH);
            let llave = long.toFixed(3) + "_" + d.diam;

            if (!grupos[llave]) {
                grupos[llave] = { similares: 0, diam: d.diam, longPieza: long, espac: d.espac, numXPiso: d.espac > 0 ? calcNumXPiso(d.espac, pol.long, alturaLibre) : 0 };
            }
            grupos[llave].similares += 1; 
        });
        
        let cont = 1;
        let keys = Object.keys(grupos);
        for (const k of keys) {
            let g = grupos[k];
            let nombreFinal = prefijoNombre + (keys.length > 1 ? ` ${cont}` : "");
            
            let isStirrup = prefijoNombre.includes("Estribo");
            let des = 0;
            if(isStirrup) {
                let conf = configAceros[g.diam] || { gancho135: 0 };
                des = conf.gancho135 * 2; 
            }

            filasTabla.push({
                nombre: nombreFinal, 
                similares: g.similares, 
                diam: g.diam, 
                longPieza: g.longPieza, 
                desarrollo: des, 
                forma: "-", 
                espac: g.espac, 
                numXPiso: g.numXPiso,
                editableDesarrollo: esMallaVertical || prefijoNombre.includes("Malla transversal"), 
                editableForma: esMallaVertical || prefijoNombre.includes("Malla transversal"), 
                esEstribo: isStirrup
            });
            cont++;
        }
    }

    agruparYAgregar(dbAutoCAD.estribos.polilineas, "Estribo", (esp, l, hLibre) => Math.ceil(hLibre / esp) + 1, (l, h) => l);
    agruparYAgregar(dbAutoCAD.ganchos.polilineas, "Gancho", (esp, l, hLibre) => Math.ceil(hLibre / esp) + 1, (l, h) => l);
    agruparYAgregar(dbAutoCAD.mallaTrans.polilineas, "Malla transversal", (esp, l, hLibre) => Math.ceil(hLibre / esp) + 1, (l, h) => l);
    agruparYAgregar(dbAutoCAD.mallaVert.polilineas, "Malla vertical", (esp, l, hLibre) => Math.ceil(l / esp) + 1, (l, h) => h, true);

    renderizarTabla();
}

// ==========================================
// 5. RENDER Y MATEMÁTICAS EN TIEMPO REAL
// ==========================================
function renderizarTabla() {
    let tbody = document.getElementById("tablaCuerpo");
    tbody.innerHTML = "";
    
    let multiplicadorGlobal = parseInt(document.getElementById("numElementos").value) || 1;
    let alturaH = parseFloat(document.getElementById("alturaTotal").value) || 3;
    let deduccionVal = parseFloat(document.getElementById("deduccion").value) || 0.20;
    
    let volConcreto = (dbAutoCAD.seccion.area * alturaH) * multiplicadorGlobal;
    let areaEncofrado = (dbAutoCAD.seccion.perimetro * (alturaH - deduccionVal)) * multiplicadorGlobal;
    let pesoTotalAcero = 0;

    if (filasTabla.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="fila-ejemplo">Sin datos</td></tr>`; 
    } else {
        filasTabla.forEach((f, idx) => {
            let conf = configAceros[f.diam] || { peso: 0, empalme: 0 };
            
            let numRecubrimientos = 0;
            if(f.editableForma) { 
                if (f.forma === "L") numRecubrimientos = 2;
                else if (f.forma === "[") numRecubrimientos = 4;
            }
            let descuentoFinal = numRecubrimientos * recubrimientoGlobal;

            let longTotalCalculo = f.longPieza + f.desarrollo - descuentoFinal;
            if(longTotalCalculo < 0) longTotalCalculo = 0;

            let numEmp = longTotalCalculo > 9 ? Math.floor(longTotalCalculo / 9) : 0;

            let pesoFilaBase = f.similares * f.numXPiso * (longTotalCalculo + (numEmp * conf.empalme)) * conf.peso;
            let pesoFilaTotal = pesoFilaBase * multiplicadorGlobal; 
            
            pesoTotalAcero += pesoFilaTotal;

            let txtEspac = f.espac === "-" || f.espac === 0 ? "-" : f.espac.toFixed(2);
            let txtNumPiso = f.nombre.includes("Acero longitudinal") ? "-" : f.numXPiso; 

            let cellDesarrollo = f.editableDesarrollo ? 
                `<input type="number" step="0.001" value="${f.desarrollo.toFixed(3)}" class="input-editable-tabla" onchange="editarValorTabla(${idx}, 'desarrollo', this.value)">` : 
                `<span>${f.desarrollo.toFixed(3)}</span>`;

            // CORRECCIÓN: Aquí cambiamos "I" por "|"
            let cellForma = f.editableForma ? 
                `<select class="input-editable-tabla" onchange="editarValorTabla(${idx}, 'forma', this.value)">
                    <option value="-" ${f.forma === "-" ? "selected" : ""}>-</option>
                    <option value="L" ${f.forma === "L" ? "selected" : ""}>L</option>
                    <option value="[" ${f.forma === "[" ? "selected" : ""}>[</option>
                    <option value="|" ${f.forma === "|" ? "selected" : ""}>|</option>
                </select>` : 
                `<span>-</span>`;

            tbody.innerHTML += `
            <tr>
                <td style="text-align:left;">${f.nombre}</td>
                <td>
                    <div class="control-btn">
                        <button onclick="cambiarValor(${idx}, 'similares', -1)">-</button>
                        <span>${f.similares}</span>
                        <button onclick="cambiarValor(${idx}, 'similares', 1)">+</button>
                    </div>
                </td>
                <td>${f.diam}</td>
                <td>${f.longPieza.toFixed(3)}</td>
                <td>${cellDesarrollo}</td> 
                <td>${cellForma}</td> 
                <td>${txtEspac}</td>
                <td>${txtNumPiso}</td>
                <td>
                    <div class="control-btn">
                        <button onclick="cambiarValor(${idx}, 'editableEmpalmes', -1, ${numEmp})">-</button> 
                        <span>${f.editableEmpalmes !== undefined ? f.editableEmpalmes : numEmp}</span> 
                        <button onclick="cambiarValor(${idx}, 'editableEmpalmes', 1, ${numEmp})">+</button>
                    </div>
                </td>
                <td><strong>${pesoFilaTotal.toFixed(2)}</strong></td>
            </tr>`;
        });
    }

    document.getElementById("res-concreto").innerText = volConcreto.toFixed(2);
    document.getElementById("res-encofrado").innerText = areaEncofrado.toFixed(2);
    document.getElementById("res-acero").innerText = pesoTotalAcero.toFixed(2);
    document.getElementById("res-ratio").innerText = volConcreto > 0 ? (pesoTotalAcero / volConcreto).toFixed(2) : "0.00";
}

function editarValorTabla(index, campo, valor) {
    if(campo === 'desarrollo') {
        filasTabla[index][campo] = parseFloat(valor) || 0;
    } else {
        filasTabla[index][campo] = valor;
    }
    renderizarTabla();
}

function cambiarValor(index, campo, delta, valorAuto = 0) {
    if(campo === 'editableEmpalmes') {
        let actual = filasTabla[index][campo] !== undefined ? filasTabla[index][campo] : valorAuto;
        if (actual + delta >= 0) {
            filasTabla[index][campo] = actual + delta;
            renderizarTabla();
        }
    } else {
        if (filasTabla[index][campo] + delta >= 0) {
            filasTabla[index][campo] += delta;
            renderizarTabla();
        }
    }
}

document.getElementById("alturaTotal").addEventListener("change", generarFilasEstructurales);
document.getElementById("deduccion").addEventListener("change", generarFilasEstructurales);
document.getElementById("numElementos").addEventListener("input", renderizarTabla);
document.getElementById("resistenciaConcreto").addEventListener("change", renderizarTabla);

// ==========================================
// 6. DIBUJO DEL CANVAS
// ==========================================
function dibujarEnCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dbAutoCAD.seccion.coords.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dbAutoCAD.seccion.coords.forEach(pt => { if (pt.x < minX) minX = pt.x; if (pt.x > maxX) maxX = pt.x; if (pt.y < minY) minY = pt.y; if (pt.y > maxY) maxY = pt.y; });
    let escalaX = (canvas.width * 0.9) / (maxX - minX), escalaY = (canvas.height * 0.9) / (maxY - minY);
    let escala = Math.min(escalaX, escalaY);
    let offsetX = (canvas.width / 2) - ((minX + maxX) / 2) * escala, offsetY = (canvas.height / 2) + ((minY + maxY) / 2) * escala;
    function proyectarX(x) { return x * escala + offsetX; }
    function proyectarY(y) { return -y * escala + offsetY; }
    function dibujarPolilinea(coords, color, grosor, relleno = false) {
        if (!coords || coords.length === 0) return;
        ctx.beginPath(); ctx.moveTo(proyectarX(coords[0].x), proyectarY(coords[0].y));
        for (let i = 1; i < coords.length; i++) ctx.lineTo(proyectarX(coords[i].x), proyectarY(coords[i].y));
        if (relleno) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.stroke(); }
    }
    dibujarPolilinea(dbAutoCAD.seccion.coords, "#e5e7eb", 2, true); dibujarPolilinea(dbAutoCAD.seccion.coords, "#d946ef", 2, false); 
    dbAutoCAD.estribos.polilineas.forEach(est => dibujarPolilinea(est.coords, "#eab308", 2));
    dbAutoCAD.ganchos.polilineas.forEach(gan => dibujarPolilinea(gan.coords, "#22c55e", 2));
    dbAutoCAD.mallaTrans.polilineas.forEach(ml => dibujarPolilinea(ml.coords, "#ef4444", 2));
    dbAutoCAD.mallaVert.polilineas.forEach(ml => dibujarPolilinea(ml.coords, "#f97316", 2));
    dbAutoCAD.aceroLong.varillas.forEach(pt => { ctx.beginPath(); ctx.arc(proyectarX(pt.x), proyectarY(pt.y), 4, 0, Math.PI * 2); ctx.fillStyle = "#06b6d4"; ctx.fill(); ctx.strokeStyle = "#000000"; ctx.lineWidth = 1; ctx.stroke(); });
}

function limpiarDatos() {
    dbAutoCAD = { seccion: { perimetro: 0, area: 0, coords: [] }, aceroLong: { varillas: [] }, estribos: { polilineas: [] }, ganchos: { polilineas: [] }, mallaTrans: { polilineas: [] }, mallaVert: { polilineas: [] }};
    filasTabla = []; document.getElementById("csvFileInput").value = ""; ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("nombreElemento").value = ""; 
    document.getElementById("infoPerimetro").value = "-"; document.getElementById("infoArea").value = "-"; document.getElementById("infoEncofrado").value = "-";
    renderizarTabla();
}
document.getElementById("btnLimpiar").addEventListener("click", limpiarDatos);