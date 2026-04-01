// ==========================================
// 1. CONFIGURACIÓN BASE Y ESTADO DINÁMICO
// ==========================================
const canvas = document.getElementById("planoColumna");
const ctx = canvas.getContext("2d");

const arrayDiametros = ['6 mm', '8 mm', '12 mm', '1/4"', '3/8"', '1/2"', '5/8"', '3/4"', '1"', '1 3/8"'];

let configAceros = {
    '6 mm': { peso: 0.22, empalme: 0.30, gancho135: 0.08 }, 
    '8 mm': { peso: 0.40, empalme: 0.30, gancho135: 0.10 },
    '12 mm': { peso: 0.86, empalme: 0.30, gancho135: 0.08 },
    '1/4"': { peso: 0.25, empalme: 0.30, gancho135: 0.08 },
    '3/8"': { peso: 0.56, empalme: 0.30, gancho135: 0.13 }, 
    '1/2"': { peso: 0.99, empalme: 0.40, gancho135: 0.16 }, 
    '5/8"': { peso: 1.56, empalme: 0.50, gancho135: 0.18 }, 
    '3/4"': { peso: 2.24, empalme: 0.60, gancho135: 0.27 },
    '1"': { peso: 3.96, empalme: 1.00, gancho135: 0.35 },
    '1 3/8"': { peso: 7.907, empalme: 1.55, gancho135: 0.51 }
};

let recubrimientoGlobal = 0.04; 
let baseDatosProyecto = []; // ARRAY MAESTRO

let dbAutoCAD = { 
    seccion: { perimetro: 0, area: 0, coords: [] }, 
    aceroLong: { varillas: [] }, 
    estribos: { polilineas: [] }, 
    ganchos: { polilineas: [] }, 
    mallaTrans: { polilineas: [] }, 
    mallaVert: { polilineas: [] } 
};
let filasTabla = []; 

// NAVEGACIÓN DE PESTAÑAS
function cambiarPestana(idVista, idTab) {
    document.getElementById('vista-metrado').classList.add('vista-oculta');
    document.getElementById('vista-global').classList.add('vista-oculta');
    document.getElementById('vista-parcial').classList.add('vista-oculta');
    document.getElementById('vista-recopilatorio').classList.add('vista-oculta');
    
    document.getElementById('tab-metrado').classList.remove('activa');
    document.getElementById('tab-global').classList.remove('activa');
    document.getElementById('tab-parcial').classList.remove('activa');
    document.getElementById('tab-recopilatorio').classList.remove('activa');
    
    document.getElementById(idVista).classList.remove('vista-oculta');
    document.getElementById(idTab).classList.add('activa');
}

// ==========================================
// 2. MODAL Y LECTOR CSV
// ==========================================
function abrirModalConfig() {
    let tbody = document.getElementById("tablaConfigCuerpo");
    tbody.innerHTML = "";
    document.getElementById("recubrimientoModalInput").value = recubrimientoGlobal.toFixed(2);
    for (const [diam, datos] of Object.entries(configAceros)) {
        tbody.innerHTML += `<tr>
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
        filasTabla.forEach(f => { 
            if (f.esEstribo) { 
                let conf = configAceros[f.diam] || { gancho135: 0 }; 
                f.desarrollo = conf.gancho135 * 2; 
            } 
        });
        renderizarTabla(); 
        renderizarRecopilatorioCompleto();
    }
    document.getElementById("modalConfig").style.display = "none";
}

document.getElementById('csvFileInput').addEventListener('change', function(e) {
    const file = e.target.files[0]; if (!file) return;
    document.getElementById("nombreElemento").value = file.name.replace(/\.[^/.]+$/, ""); 
    const reader = new FileReader();
    reader.onload = function(e) { procesarCSV(e.target.result); };
    reader.readAsText(file, 'ISO-8859-1'); 
});

function procesarCSV(csv) {
    dbAutoCAD = { seccion: { perimetro: 0, area: 0, coords: [] }, aceroLong: { varillas: [] }, estribos: { polilineas: [] }, ganchos: { polilineas: [] }, mallaTrans: { polilineas: [] }, mallaVert: { polilineas: [] } };
    const lineas = csv.split('\n');
    for (let i = 1; i < lineas.length; i++) {
        const cols = lineas[i].split(','); if (cols.length < 5) continue;
        const capa = cols[0].toUpperCase(), tipoObj = cols[1].toUpperCase(), etiqueta = cols[2];
        const x = parseFloat(cols[3]), y = parseFloat(cols[4]), valor1 = cols[5], valor2 = cols[6], coordsExtra = cols[7] ? cols[7].trim() : "";
        if (capa.includes("SECCI") && tipoObj === "POLILINEA") { dbAutoCAD.seccion.perimetro = parseFloat(valor1); dbAutoCAD.seccion.area = parseFloat(valor2); dbAutoCAD.seccion.coords = parsearCoordenadas(coordsExtra); }
        else if (capa.includes("LONGITUDINAL") && tipoObj === "VARILLA") { dbAutoCAD.aceroLong.varillas.push({ x, y, texto: etiqueta }); }
        else if (capa.includes("ESTRIBOS") && tipoObj === "POLILINEA") { dbAutoCAD.estribos.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta }); }
        else if (capa.includes("GANCHOS") && tipoObj === "POLILINEA") { dbAutoCAD.ganchos.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta }); }
        else if (capa.includes("MALLA TRANS") && tipoObj === "POLILINEA") { dbAutoCAD.mallaTrans.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta }); }
        else if (capa.includes("MALLA VERT") && tipoObj === "POLILINEA") { dbAutoCAD.mallaVert.polilineas.push({ x, y, long: parseFloat(valor1), coords: parsearCoordenadas(coordsExtra), texto: etiqueta }); }
    }
    dibujarEnCanvas(); generarFilasEstructurales(); 
}

function parsearCoordenadas(str) {
    if (!str) return []; let sep = str.includes(':') ? ':' : ';';
    return str.split('|').map(pt => { let c = pt.split(sep); return { x: parseFloat(c[0]), y: parseFloat(c[1]) }; });
}
function decodificarEtiqueta(texto, esLongitudinal) {
    if (!texto || texto === "-") return { cant: 0, diam: "-", espac: 0 };
    texto = texto.trim();
    if (esLongitudinal) { let partes = texto.split("%%c"); return { cant: partes.length >= 2 ? parseInt(partes[partes.length - 2].trim()) || 0 : 0, diam: partes.length >= 2 ? partes[partes.length - 1].trim() : "0" };
    } else { let limpio = texto.replace("%%c", "").trim(); let partes = limpio.split("@"); return { diam: partes[0].trim(), espac: partes.length > 1 ? parseFloat(partes[1].trim()) : 0 }; }
}

// ==========================================
// 4. GENERACIÓN DE FILAS INDIVIDUALES
// ==========================================
function generarFilasEstructurales() {
    filasTabla = [];
    let alturaH = parseFloat(document.getElementById("alturaTotal").value) || 3;
    let deduccion = parseFloat(document.getElementById("deduccion").value) || 0.20;
    let alturaLibre = alturaH - deduccion;
    document.getElementById("infoPerimetro").value = dbAutoCAD.seccion.perimetro.toFixed(3);
    document.getElementById("infoArea").value = dbAutoCAD.seccion.area.toFixed(3);
    
    let tipoEnc = alturaLibre <= 3.6 ? "SIMPLE" : (alturaLibre <= 5 ? "DOBLE" : "TRIPLE");
    if(dbAutoCAD.seccion.perimetro === 0) tipoEnc = "-";
    document.getElementById("infoEncofrado").value = tipoEnc;

    // Acero Longitudinal Desagrupado
    let contLong = 1;
    dbAutoCAD.aceroLong.varillas.forEach(varilla => { 
        let d = decodificarEtiqueta(varilla.texto, true); 
        if (d.cant > 0) { 
            filasTabla.push({ nombre: "Acero longitudinal " + contLong, similares: d.cant, diam: d.diam, longPieza: alturaH, desarrollo: 0, forma: "-", espac: "-", numXPiso: 1, editableDesarrollo: true, editableForma: true, esEstribo: false }); 
            contLong++; 
        } 
    });

    // Elementos Transversales Desagrupados
    function procesarPolilineasIndividuales(polilineas, prefijoNombre, calcNumXPiso, calcLongPieza, esMallaVertical = false) {
        let cont = 1;
        polilineas.forEach(pol => { 
            let d = decodificarEtiqueta(pol.texto, false); 
            let long = calcLongPieza(pol.long, alturaH); 
            let isStirrup = prefijoNombre.includes("Estribo"); 
            let des = 0;
            if(isStirrup) { let conf = configAceros[d.diam] || { gancho135: 0 }; des = conf.gancho135 * 2; }
            let espacReal = d.espac || 0;
            let numPiso = espacReal > 0 ? calcNumXPiso(espacReal, pol.long, alturaLibre) : 0;

            filasTabla.push({ nombre: prefijoNombre + " " + cont, similares: 1, diam: d.diam, longPieza: long, desarrollo: des, forma: "-", espac: espacReal, numXPiso: numPiso, editableDesarrollo: esMallaVertical || prefijoNombre.includes("Malla transversal"), editableForma: esMallaVertical || prefijoNombre.includes("Malla transversal"), esEstribo: isStirrup });
            cont++;
        });
    }

    procesarPolilineasIndividuales(dbAutoCAD.estribos.polilineas, "Estribo", (esp, l, hLibre) => Math.ceil(hLibre / esp) + 1, (l, h) => l);
    procesarPolilineasIndividuales(dbAutoCAD.ganchos.polilineas, "Gancho", (esp, l, hLibre) => Math.ceil(hLibre / esp) + 1, (l, h) => l);
    procesarPolilineasIndividuales(dbAutoCAD.mallaTrans.polilineas, "Malla transversal", (esp, l, hLibre) => Math.ceil(hLibre / esp) + 1, (l, h) => l);
    procesarPolilineasIndividuales(dbAutoCAD.mallaVert.polilineas, "Malla vertical", (esp, l, hLibre) => Math.ceil(l / esp) + 1, (l, h) => h, true);
    renderizarTabla();
}

let varCalculadas = { volConcreto: 0, areaEncofrado: 0, pesoTotalAcero: 0, ratio: 0, pesosPorDiametro: {} };

function calcularElementoLogica(filas, params) {
    let result = { volConcreto: 0, areaEncofrado: 0, pesoTotalAcero: 0, ratio: 0, pesosPorDiametro: { '6 mm':0, '8 mm':0, '12 mm':0, '1/4"':0, '3/8"':0, '1/2"':0, '5/8"':0, '3/4"':0, '1"':0, '1 3/8"':0 } };
    result.volConcreto = (params.area * params.h) * params.nElem;
    result.areaEncofrado = (params.perimetro * (params.h - params.deduccion)) * params.nElem;
    
    filas.forEach(f => {
        let conf = configAceros[f.diam] || { peso: 0, empalme: 0 };
        let numRecubrimientos = 0;
        if(f.editableForma) { if (f.forma === "L") numRecubrimientos = 2; else if (f.forma === "[") numRecubrimientos = 4; }
        let descuentoFinal = numRecubrimientos * recubrimientoGlobal;
        let longTotalCalculo = f.longPieza + f.desarrollo - descuentoFinal;
        if(longTotalCalculo < 0) longTotalCalculo = 0;

        let numEmpAuto = longTotalCalculo > 9 ? Math.floor(longTotalCalculo / 9) : 0;
        let empalmesFinal = f.editableEmpalmes !== undefined ? f.editableEmpalmes : numEmpAuto;

        let acerosTotales = f.similares * f.numXPiso;
        let longConEmpalmes = longTotalCalculo + (empalmesFinal * conf.empalme);
        let pesoFilaTotal = acerosTotales * longConEmpalmes * conf.peso * params.nElem; 
        
        f.pesoCalculado = pesoFilaTotal; 
        f.numEmpAuto = numEmpAuto;
        
        result.pesoTotalAcero += pesoFilaTotal;
        if(result.pesosPorDiametro[f.diam] !== undefined) result.pesosPorDiametro[f.diam] += pesoFilaTotal;
    });
    result.ratio = result.volConcreto > 0 ? (result.pesoTotalAcero / result.volConcreto) : 0;
    return result;
}

// FUNCIONES DE EDICIÓN AVANZADA
function cambiarDiam(idx, dir) {
    let actual = filasTabla[idx].diam;
    let pos = arrayDiametros.indexOf(actual);
    if (pos !== -1) {
        let nuevaPos = pos + dir;
        if (nuevaPos >= 0 && nuevaPos < arrayDiametros.length) { filasTabla[idx].diam = arrayDiametros[nuevaPos]; renderizarTabla(); }
    }
}
function duplicarFila(idx) {
    let copia = JSON.parse(JSON.stringify(filasTabla[idx]));
    copia.nombre = copia.nombre + " (Copia)";
    filasTabla.splice(idx + 1, 0, copia); renderizarTabla();
}
function eliminarFila(idx) {
    if(confirm("¿Seguro que deseas eliminar esta fila?")) { filasTabla.splice(idx, 1); renderizarTabla(); }
}
function editarValorTabla(index, campo, valor) { 
    if(['desarrollo', 'longPieza', 'espac', 'numXPiso'].includes(campo)) filasTabla[index][campo] = parseFloat(valor) || 0; 
    else filasTabla[index][campo] = valor; 
    renderizarTabla(); 
}
function cambiarValor(index, campo, delta, valorAuto = 0) {
    if(campo === 'editableEmpalmes') { let actual = filasTabla[index][campo] !== undefined ? filasTabla[index][campo] : valorAuto; if (actual + delta >= 0) { filasTabla[index][campo] = actual + delta; renderizarTabla(); } } 
    else { let actual = parseFloat(filasTabla[index][campo]) || 0; let newVal = actual + delta; if (newVal >= 0) { filasTabla[index][campo] = parseFloat(newVal.toFixed(3)); renderizarTabla(); } }
}


function renderizarTabla() {
    let multiplicadorGlobal = parseInt(document.getElementById("numElementos").value) || 1;
    let alturaH = parseFloat(document.getElementById("alturaTotal").value) || 3;
    let deduccionVal = parseFloat(document.getElementById("deduccion").value) || 0.20;
    
    let params = { area: dbAutoCAD.seccion.area, perimetro: dbAutoCAD.seccion.perimetro, h: alturaH, deduccion: deduccionVal, nElem: multiplicadorGlobal };
    varCalculadas = calcularElementoLogica(filasTabla, params);

    let tbody = document.getElementById("tablaCuerpo"); tbody.innerHTML = "";
    if (filasTabla.length === 0) { tbody.innerHTML = `<tr><td colspan="11" class="fila-ejemplo">Sin datos</td></tr>`; } 
    else {
        filasTabla.forEach((f, idx) => {
            let cellDiam = `<div class="control-btn" style="display:flex; align-items:center; gap:2px; justify-content:center;"><button onclick="cambiarDiam(${idx}, -1)">-</button><span style="width: 45px; text-align: center; font-size: 12px;">${f.diam}</span><button onclick="cambiarDiam(${idx}, 1)">+</button></div>`;
            let cellLong = `<input type="number" step="0.01" value="${f.longPieza.toFixed(3)}" class="input-editable-tabla" style="width: 60px; text-align: center;" onchange="editarValorTabla(${idx}, 'longPieza', this.value)">`;
            let cellDesarrollo = f.editableDesarrollo ? `<input type="number" step="0.001" value="${f.desarrollo.toFixed(3)}" class="input-editable-tabla" style="width:50px" onchange="editarValorTabla(${idx}, 'desarrollo', this.value)">` : `<span>${f.desarrollo.toFixed(3)}</span>`;
            let cellForma = f.editableForma ? `<select class="input-editable-tabla" onchange="editarValorTabla(${idx}, 'forma', this.value)"><option value="-" ${f.forma === "-" ? "selected" : ""}>-</option><option value="L" ${f.forma === "L" ? "selected" : ""}>L</option><option value="[" ${f.forma === "[" ? "selected" : ""}>[</option><option value="|" ${f.forma === "|" ? "selected" : ""}>|</option></select>` : `<span>-</span>`;
            let cellEspac = (f.espac === "-" || f.espac === 0) ? `<span>-</span>` : `<div class="control-btn" style="display:flex; align-items:center; gap:2px; justify-content:center;"><button onclick="cambiarValor(${idx}, 'espac', -0.05)">-</button><input type="number" step="0.01" value="${f.espac.toFixed(2)}" class="input-editable-tabla" style="width: 45px; text-align: center; margin:0; padding:2px;" onchange="editarValorTabla(${idx}, 'espac', this.value)"><button onclick="cambiarValor(${idx}, 'espac', 0.05)">+</button></div>`;
            let cellNumPiso = (f.nombre.includes("Acero longitudinal")) ? `<span>-</span>` : `<div class="control-btn" style="display:flex; align-items:center; gap:2px; justify-content:center;"><button onclick="cambiarValor(${idx}, 'numXPiso', -1)">-</button><input type="number" step="1" value="${f.numXPiso}" class="input-editable-tabla" style="width: 35px; text-align: center; margin:0; padding:2px;" onchange="editarValorTabla(${idx}, 'numXPiso', this.value)"><button onclick="cambiarValor(${idx}, 'numXPiso', 1)">+</button></div>`;
            let cellAcciones = `<div style="display:flex; gap:5px; justify-content:center;"><button onclick="duplicarFila(${idx})" title="Duplicar" style="background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;">📄</button><button onclick="eliminarFila(${idx})" title="Eliminar" style="background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer;">❌</button></div>`;

            tbody.innerHTML += `<tr>
                <td style="text-align:left;">${f.nombre}</td>
                <td><div class="control-btn"><button onclick="cambiarValor(${idx}, 'similares', -1)">-</button><span>${f.similares}</span><button onclick="cambiarValor(${idx}, 'similares', 1)">+</button></div></td>
                <td>${cellDiam}</td><td>${cellLong}</td><td>${cellDesarrollo}</td><td>${cellForma}</td><td>${cellEspac}</td><td>${cellNumPiso}</td>
                <td><div class="control-btn"><button onclick="cambiarValor(${idx}, 'editableEmpalmes', -1, ${f.numEmpAuto})">-</button><span>${f.editableEmpalmes !== undefined ? f.editableEmpalmes : f.numEmpAuto}</span><button onclick="cambiarValor(${idx}, 'editableEmpalmes', 1, ${f.numEmpAuto})">+</button></div></td>
                <td><strong>${f.pesoCalculado.toFixed(2)}</strong></td>
                <td>${cellAcciones}</td>
            </tr>`;
        });
    }
    document.getElementById("res-concreto").innerText = varCalculadas.volConcreto.toFixed(2); 
    document.getElementById("res-encofrado").innerText = varCalculadas.areaEncofrado.toFixed(2);
    document.getElementById("res-acero").innerText = varCalculadas.pesoTotalAcero.toFixed(2); 
    document.getElementById("res-ratio").innerText = varCalculadas.ratio.toFixed(2);
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
        if (relleno) { ctx.fillStyle = color; ctx.fill(); } else { ctx.strokeStyle = color; ctx.lineWidth = grosor; ctx.stroke(); } 
    }
    
    dibujarPolilinea(dbAutoCAD.seccion.coords, "#e5e7eb", 2, true); 
    dibujarPolilinea(dbAutoCAD.seccion.coords, "#d946ef", 2, false); 
    dbAutoCAD.estribos.polilineas.forEach(est => dibujarPolilinea(est.coords, "#eab308", 2)); 
    dbAutoCAD.ganchos.polilineas.forEach(gan => dibujarPolilinea(gan.coords, "#22c55e", 2)); 
    dbAutoCAD.mallaTrans.polilineas.forEach(ml => dibujarPolilinea(ml.coords, "#ef4444", 2)); 
    dbAutoCAD.mallaVert.polilineas.forEach(ml => dibujarPolilinea(ml.coords, "#f97316", 2)); 
    dbAutoCAD.aceroLong.varillas.forEach(pt => { 
        ctx.beginPath(); 
        ctx.arc(proyectarX(pt.x), proyectarY(pt.y), 4, 0, Math.PI * 2); 
        ctx.fillStyle = "#06b6d4"; ctx.fill(); ctx.strokeStyle = "#000000"; ctx.lineWidth = 1; ctx.stroke(); 
    });
}

function limpiarDatos() {
    dbAutoCAD = { seccion: { perimetro: 0, area: 0, coords: [] }, aceroLong: { varillas: [] }, estribos: { polilineas: [] }, ganchos: { polilineas: [] }, mallaTrans: { polilineas: [] }, mallaVert: { polilineas: [] }}; 
    filasTabla = []; 
    document.getElementById("csvFileInput").value = ""; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById("nombreElemento").value = ""; 
    document.getElementById("infoPerimetro").value = "-"; 
    document.getElementById("infoArea").value = "-"; 
    document.getElementById("infoEncofrado").value = "-"; 
    renderizarTabla();
}
document.getElementById("btnLimpiar").addEventListener("click", limpiarDatos);

// ==========================================
// 7. SISTEMA DE BASE DE DATOS Y RECÁLCULO
// ==========================================
function guardarEnBaseDatos() {
    if(varCalculadas.volConcreto === 0) { alert("No hay metrado calculado para guardar."); return; }
    
    let nuevoElemento = {
        id: Date.now(),
        nombre: document.getElementById("nombreElemento").value.trim() || "Elemento Sin Nombre",
        zona: document.getElementById("zonaElemento").value,
        tipo: document.getElementById("tipoElemento").value,
        nElem: parseInt(document.getElementById("numElementos").value) || 1,
        fc: document.getElementById("resistenciaConcreto").value,
        encTipo: document.getElementById("infoEncofrado").value,
        h: parseFloat(document.getElementById("alturaTotal").value) || 3,
        deduccion: parseFloat(document.getElementById("deduccion").value) || 0.20,
        area: dbAutoCAD.seccion.area,
        perimetro: dbAutoCAD.seccion.perimetro,
        filas: JSON.parse(JSON.stringify(filasTabla)), 
        resultados: JSON.parse(JSON.stringify(varCalculadas))
    };

    baseDatosProyecto.push(nuevoElemento);
    alert(`¡"${nuevoElemento.nombre}" guardado exitosamente en la Base de Datos!\n(Tus datos siguen en pantalla por si deseas modificarlos y crear una variante).`);
    renderizarRecopilatorioCompleto();
}

// RECÁLCULO DEL RECOPILATORIO EDITABLE
function editarBDEstado(elemIdx, campo, valor) {
    if(['h', 'deduccion', 'nElem', 'perimetro', 'area'].includes(campo)) baseDatosProyecto[elemIdx][campo] = parseFloat(valor) || 0;
    else baseDatosProyecto[elemIdx][campo] = valor;
    recalcularElementoBD(elemIdx);
}

function editarBDFila(elemIdx, filaIdx, campo, valor) {
    let f = baseDatosProyecto[elemIdx].filas[filaIdx];
    if (['desarrollo', 'longPieza', 'espac', 'numXPiso'].includes(campo)) f[campo] = parseFloat(valor) || 0;
    else f[campo] = valor;
    recalcularElementoBD(elemIdx);
}

function cambiarBDFilaValor(eIdx, fIdx, campo, delta, valorAuto = 0) {
    let f = baseDatosProyecto[eIdx].filas[fIdx];
    if(campo === 'editableEmpalmes') { 
        let actual = f[campo] !== undefined ? f[campo] : valorAuto; 
        if (actual + delta >= 0) f[campo] = actual + delta; 
    } else { 
        let actual = parseFloat(f[campo]) || 0; let newVal = actual + delta; 
        if (newVal >= 0) f[campo] = parseFloat(newVal.toFixed(3)); 
    }
    recalcularElementoBD(eIdx);
}

function cambiarBDDiam(eIdx, fIdx, dir) {
    let f = baseDatosProyecto[eIdx].filas[fIdx];
    let pos = arrayDiametros.indexOf(f.diam);
    if (pos !== -1) {
        let nuevaPos = pos + dir;
        if (nuevaPos >= 0 && nuevaPos < arrayDiametros.length) { f.diam = arrayDiametros[nuevaPos]; recalcularElementoBD(eIdx); }
    }
}
function duplicarBDFila(eIdx, fIdx) {
    let copia = JSON.parse(JSON.stringify(baseDatosProyecto[eIdx].filas[fIdx]));
    copia.nombre = copia.nombre + " (Copia)";
    baseDatosProyecto[eIdx].filas.splice(fIdx + 1, 0, copia); recalcularElementoBD(eIdx);
}
function eliminarBDFila(eIdx, fIdx) {
    if(confirm("¿Eliminar esta fila del registro?")) { baseDatosProyecto[eIdx].filas.splice(fIdx, 1); recalcularElementoBD(eIdx); }
}

function recalcularElementoBD(elemIdx) {
    let elem = baseDatosProyecto[elemIdx];
    let hLibre = elem.h - elem.deduccion;
    elem.encTipo = hLibre <= 3.6 ? "SIMPLE" : (hLibre <= 5 ? "DOBLE" : "TRIPLE");
    
    let params = { area: elem.area, perimetro: elem.perimetro, h: elem.h, deduccion: elem.deduccion, nElem: elem.nElem };
    elem.resultados = calcularElementoLogica(elem.filas, params);
    renderizarRecopilatorioCompleto();
}

function renderizarRecopilatorioCompleto() {
    renderizarRecopilatorioHTML();
    renderizarBDParcial();
    renderizarBDGlobal();
}

function renderizarBDParcial() {
    let tbody = document.getElementById("tablaBaseDatos"); let tfoot = document.getElementById("tablaBaseDatosFooter"); tbody.innerHTML = "";
    if(baseDatosProyecto.length === 0) { tbody.innerHTML = `<tr><td colspan="19" class="fila-ejemplo">Aún no hay elementos.</td></tr>`; tfoot.innerHTML = ""; return; }

    let t_vol = 0, t_area = 0, t_totalPeso = 0; let t_ac = { '6 mm':0, '8 mm':0, '1/4"':0, '3/8"':0, '1/2"':0, '5/8"':0, '3/4"':0, '1"':0, '1 3/8"':0 };
    baseDatosProyecto.forEach((item, idx) => {
        t_vol += item.resultados.volConcreto; t_area += item.resultados.areaEncofrado; t_totalPeso += item.resultados.pesoTotalAcero;
        for (let k in t_ac) t_ac[k] += (item.resultados.pesosPorDiametro[k] || 0);
        tbody.innerHTML += `<tr>
            <td>${idx + 1}</td><td style="font-weight:bold; text-align:left;">${item.nombre}</td><td>${item.tipo}</td><td>${item.nElem}</td><td>${item.fc}</td>
            <td style="background-color:#f0f9ff"><strong>${item.resultados.volConcreto.toFixed(2)}</strong></td><td>${item.encTipo}</td><td style="background-color:#fefce8"><strong>${item.resultados.areaEncofrado.toFixed(2)}</strong></td>
            <td>${(item.resultados.pesosPorDiametro['6 mm']||0).toFixed(2)}</td><td>${(item.resultados.pesosPorDiametro['8 mm']||0).toFixed(2)}</td>
            <td>${(item.resultados.pesosPorDiametro['1/4"']||0).toFixed(2)}</td><td>${(item.resultados.pesosPorDiametro['3/8"']||0).toFixed(2)}</td><td>${(item.resultados.pesosPorDiametro['1/2"']||0).toFixed(2)}</td>
            <td>${(item.resultados.pesosPorDiametro['5/8"']||0).toFixed(2)}</td><td>${(item.resultados.pesosPorDiametro['3/4"']||0).toFixed(2)}</td><td>${(item.resultados.pesosPorDiametro['1"']||0).toFixed(2)}</td><td>${(item.resultados.pesosPorDiametro['1 3/8"']||0).toFixed(2)}</td>
            <td style="background-color:#fdf2f8"><strong>${item.resultados.pesoTotalAcero.toFixed(2)}</strong></td><td>${item.resultados.ratio.toFixed(2)}</td>
        </tr>`;
    });
    let ratioGlobal = t_vol > 0 ? (t_totalPeso / t_vol) : 0;
    tfoot.innerHTML = `<tr><td colspan="5" style="text-align:right;">TOTALES:</td><td style="background-color:#bae6fd">${t_vol.toFixed(2)}</td><td>-</td><td style="background-color:#fef08a">${t_area.toFixed(2)}</td>
        <td>${t_ac['6 mm'].toFixed(2)}</td><td>${t_ac['8 mm'].toFixed(2)}</td><td>${t_ac['1/4"'].toFixed(2)}</td><td>${t_ac['3/8"'].toFixed(2)}</td><td>${t_ac['1/2"'].toFixed(2)}</td><td>${t_ac['5/8"'].toFixed(2)}</td><td>${t_ac['3/4"'].toFixed(2)}</td><td>${t_ac['1"'].toFixed(2)}</td><td>${t_ac['1 3/8"'].toFixed(2)}</td>
        <td style="background-color:#fbcfe8">${t_totalPeso.toFixed(2)}</td><td>${ratioGlobal.toFixed(2)}</td></tr>`;
}

function renderizarBDGlobal() {
    let cont = document.getElementById("contenedor-resumen-global"); cont.innerHTML = "";
    if(baseDatosProyecto.length === 0) { cont.innerHTML = `<div class="fila-ejemplo" style="width: 100%; text-align: center;">Aún no hay elementos.</div>`; return; }

    let fcsValidos = ["100", "210", "245", "280", "350", "420"];
    let zonas = ["SUB-ESTRUCTURA", "SUPER-ESTRUCTURA"];
    let tipos = ["COLUMNAS", "PLACAS"];

    zonas.forEach(z => {
        let tablaHTML = `<table class="tabla-global" style="margin-bottom: 15px;"><tr><th colspan="2" style="background-color:#1e40af; color:white; font-size:14px; padding:8px;">${z}</th></tr>`;
        let hayDatosZona = false;
        
        tipos.forEach(t => {
            let elemFiltrados = baseDatosProyecto.filter(e => e.zona === z && e.tipo === t);
            if(elemFiltrados.length > 0) {
                hayDatosZona = true;
                tablaHTML += `<tr><th colspan="2" style="background-color:#bfdbfe; color:#1e3a8a; text-align:left; padding:6px;">${t}</th></tr>`;
                
                fcsValidos.forEach(fc => {
                    let vol = elemFiltrados.filter(e => e.fc === fc).reduce((sum, e) => sum + e.resultados.volConcreto, 0);
                    if(vol > 0) tablaHTML += `<tr><td>CONCRETO F'C=${fc} KG/CM2</td><td style="width:80px; text-align:right;"><strong>${vol.toFixed(2)} m³</strong></td></tr>`;
                });
                
                let encTipos = ["SIMPLE", "DOBLE", "TRIPLE"];
                encTipos.forEach(enc => {
                    let area = elemFiltrados.filter(e => e.encTipo === enc).reduce((sum, e) => sum + e.resultados.areaEncofrado, 0);
                    if(area > 0) tablaHTML += `<tr><td>ENCOFRADO Y DESENCOFRADO ${enc === "SIMPLE" ? "ALTURA SIMPLE" : (enc === "DOBLE" ? "- 2H" : "- 3H")}</td><td style="text-align:right;"><strong>${area.toFixed(2)} m²</strong></td></tr>`;
                });
                
                let acero = elemFiltrados.reduce((sum, e) => sum + e.resultados.pesoTotalAcero, 0);
                if(acero > 0) tablaHTML += `<tr><td>ACERO FY=4200 KG/CM2</td><td style="text-align:right;"><strong>${acero.toFixed(2)} kg</strong></td></tr>`;
                
                let curado = elemFiltrados.reduce((sum, e) => sum + e.resultados.areaEncofrado, 0);
                if(curado > 0) tablaHTML += `<tr><td>CURADO</td><td style="text-align:right;"><strong>${curado.toFixed(2)} m²</strong></td></tr>`;
            }
        });
        tablaHTML += `</table>`;
        if(hayDatosZona) cont.innerHTML += `<div style="flex: 1; min-width: 400px; max-width: 450px;">${tablaHTML}</div>`;
    });
}

function renderizarRecopilatorioHTML() {
    let cont = document.getElementById("contenedor-recopilatorio"); cont.innerHTML = "";
    if(baseDatosProyecto.length === 0) { cont.innerHTML = `<div class="fila-ejemplo" style="text-align: center;">Aún no hay elementos guardados.</div>`; return; }

    baseDatosProyecto.forEach((elem, eIdx) => {
        let fcsHTML = ["100", "210", "245", "280", "350", "420"].map(v => `<option value="${v}" ${elem.fc === v ? 'selected':''}>${v} kg/cm²</option>`).join('');
        
        let html = `
        <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="background-color: #f8fafc; padding: 10px 15px; border-bottom: 2px solid #3b82f6;">
                <table class="tabla-dinamica" style="margin: 0; background: transparent; table-layout: auto;">
                    <thead style="background: transparent;">
                        <tr><th style="border:none; text-align:left;">Nombre del Elemento</th><th style="border:none;">Zona</th><th style="border:none;">Tipo</th><th style="border:none;">Altura(H)</th><th style="border:none;">Deducc.</th><th style="border:none;">f'c</th><th style="border:none;">N°Elem.</th><th style="border:none;">Ratio</th><th style="border:none; text-align:right;">Borrar</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border:none;"><input type="text" class="input-editable-tabla" style="width:120px; font-weight:bold; font-size:14px; text-align:left;" value="${elem.nombre}" onchange="editarBDEstado(${eIdx}, 'nombre', this.value)"></td>
                            <td style="border:none;"><select class="input-editable-tabla" style="width:130px;" onchange="editarBDEstado(${eIdx}, 'zona', this.value)"><option value="SUB-ESTRUCTURA" ${elem.zona==="SUB-ESTRUCTURA"?'selected':''}>Sub-Estructura</option><option value="SUPER-ESTRUCTURA" ${elem.zona==="SUPER-ESTRUCTURA"?'selected':''}>Super-Estructura</option></select></td>
                            <td style="border:none;"><select class="input-editable-tabla" style="width:100px;" onchange="editarBDEstado(${eIdx}, 'tipo', this.value)"><option value="COLUMNAS" ${elem.tipo==="COLUMNAS"?'selected':''}>Columna</option><option value="PLACAS" ${elem.tipo==="PLACAS"?'selected':''}>Placa</option></select></td>
                            <td style="border:none;"><input type="number" step="0.05" class="input-editable-tabla" style="width:60px;" value="${elem.h}" onchange="editarBDEstado(${eIdx}, 'h', this.value)"></td>
                            <td style="border:none;"><input type="number" step="0.05" class="input-editable-tabla" style="width:60px;" value="${elem.deduccion}" onchange="editarBDEstado(${eIdx}, 'deduccion', this.value)"></td>
                            <td style="border:none;"><select class="input-editable-tabla" style="width:90px;" onchange="editarBDEstado(${eIdx}, 'fc', this.value)">${fcsHTML}</select></td>
                            <td style="border:none;"><input type="number" step="1" class="input-editable-tabla" style="width:50px;" value="${elem.nElem}" onchange="editarBDEstado(${eIdx}, 'nElem', this.value)"></td>
                            <td style="border:none;"><strong>${elem.resultados.ratio.toFixed(2)}</strong></td>
                            <td style="border:none; text-align:right;"><button onclick="borrarDeBD(${eIdx})" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:bold;">X</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="tabla-responsive" style="padding: 10px;">
                <table class="tabla-dinamica">
                    <thead><tr><th style="width:20%">Elemento de acero</th><th>N°Sim.</th><th>Ø</th><th>Long. Pieza</th><th>Desarr.(m)</th><th>Forma</th><th>@</th><th>N°x Piso</th><th>N°Emp.</th><th>Peso(kg)</th><th>Acc.</th></tr></thead>
                    <tbody>`;
        
        elem.filas.forEach((f, fIdx) => {
            let cellDiam = `<div class="control-btn" style="display:flex; align-items:center; gap:2px; justify-content:center;"><button onclick="cambiarBDDiam(${eIdx}, ${fIdx}, -1)">-</button><span style="width: 45px; text-align: center; font-size: 12px;">${f.diam}</span><button onclick="cambiarBDDiam(${eIdx}, ${fIdx}, 1)">+</button></div>`;
            let cellLong = `<input type="number" step="0.01" value="${f.longPieza.toFixed(3)}" class="input-editable-tabla" style="width: 60px; text-align: center;" onchange="editarBDFila(${eIdx}, ${fIdx}, 'longPieza', this.value)">`;
            let cellDesarrollo = f.editableDesarrollo ? `<input type="number" step="0.001" value="${f.desarrollo.toFixed(3)}" class="input-editable-tabla" style="width:50px" onchange="editarBDFila(${eIdx}, ${fIdx}, 'desarrollo', this.value)">` : `<span>${f.desarrollo.toFixed(3)}</span>`;
            let cellForma = f.editableForma ? `<select class="input-editable-tabla" onchange="editarBDFila(${eIdx}, ${fIdx}, 'forma', this.value)"><option value="-" ${f.forma === "-" ? "selected" : ""}>-</option><option value="L" ${f.forma === "L" ? "selected" : ""}>L</option><option value="[" ${f.forma === "[" ? "selected" : ""}>[</option><option value="|" ${f.forma === "|" ? "selected" : ""}>|</option></select>` : `<span>-</span>`;
            let cellEspac = (f.espac === "-" || f.espac === 0) ? `<span>-</span>` : `<div class="control-btn" style="display:flex; align-items:center; gap:2px; justify-content:center;"><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'espac', -0.05)">-</button><input type="number" step="0.01" value="${f.espac.toFixed(2)}" class="input-editable-tabla" style="width: 45px; text-align: center; margin:0; padding:2px;" onchange="editarBDFila(${eIdx}, ${fIdx}, 'espac', this.value)"><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'espac', 0.05)">+</button></div>`;
            let cellNumPiso = (f.nombre.includes("Acero longitudinal")) ? `<span>-</span>` : `<div class="control-btn" style="display:flex; align-items:center; gap:2px; justify-content:center;"><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'numXPiso', -1)">-</button><input type="number" step="1" value="${f.numXPiso}" class="input-editable-tabla" style="width: 35px; text-align: center; margin:0; padding:2px;" onchange="editarBDFila(${eIdx}, ${fIdx}, 'numXPiso', this.value)"><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'numXPiso', 1)">+</button></div>`;
            let cellAcciones = `<div style="display:flex; gap:5px; justify-content:center;"><button onclick="duplicarBDFila(${eIdx}, ${fIdx})" title="Duplicar" style="background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer;">📄</button><button onclick="eliminarBDFila(${eIdx}, ${fIdx})" title="Eliminar" style="background:#ef4444; color:white; border:none; border-radius:4px; cursor:pointer;">❌</button></div>`;

            html += `<tr>
                <td style="text-align:left;">${f.nombre}</td>
                <td><div class="control-btn"><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'similares', -1)">-</button><span>${f.similares}</span><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'similares', 1)">+</button></div></td>
                <td>${cellDiam}</td><td>${cellLong}</td><td>${cellDesarrollo}</td><td>${cellForma}</td><td>${cellEspac}</td><td>${cellNumPiso}</td>
                <td><div class="control-btn"><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'editableEmpalmes', -1, ${f.numEmpAuto})">-</button><span>${f.editableEmpalmes !== undefined ? f.editableEmpalmes : f.numEmpAuto}</span><button onclick="cambiarBDFilaValor(${eIdx}, ${fIdx}, 'editableEmpalmes', 1, ${f.numEmpAuto})">+</button></div></td>
                <td><strong>${f.pesoCalculado.toFixed(2)}</strong></td>
                <td>${cellAcciones}</td>
            </tr>`;
        });
        
        html += `</tbody></table></div></div>`;
        cont.innerHTML += html;
    });
}

function borrarDeBD(idx) {
    if(confirm("¿Seguro que deseas eliminar el elemento estructural completo?")) { baseDatosProyecto.splice(idx, 1); renderizarRecopilatorioCompleto(); }
}

// ==========================================
// 8. FUNCIONES DE EXPORTACIÓN A EXCEL
// ==========================================
function descargarCSV(contenido, nombreArchivo) {
    const blob = new Blob(["\uFEFF" + contenido], { type: 'text/csv;charset=utf-8;' }); 
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", nombreArchivo);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarExcelParcial() {
    if(baseDatosProyecto.length === 0) { alert("No hay datos para exportar."); return; }
    let csv = "N,Nombre Elemento,Tipo,N Elem.,f'c,Vol. Concreto (m3),Tipo Enc.,Area Enc. (m2),Diam. 6mm (kg),Diam. 8mm (kg),Diam. 1/4 (kg),Diam. 3/8 (kg),Diam. 1/2 (kg),Diam. 5/8 (kg),Diam. 3/4 (kg),Diam. 1 (kg),Diam. 1 3/8 (kg),Total Acero (kg),Ratio (kg/m3)\n";
    baseDatosProyecto.forEach((item, i) => {
        let fila = [ i+1, item.nombre, item.tipo, item.nElem, item.fc, item.resultados.volConcreto.toFixed(2), item.encTipo, item.resultados.areaEncofrado.toFixed(2),
            (item.resultados.pesosPorDiametro['6 mm']||0).toFixed(2), (item.resultados.pesosPorDiametro['8 mm']||0).toFixed(2), (item.resultados.pesosPorDiametro['1/4"']||0).toFixed(2), (item.resultados.pesosPorDiametro['3/8"']||0).toFixed(2),
            (item.resultados.pesosPorDiametro['1/2"']||0).toFixed(2), (item.resultados.pesosPorDiametro['5/8"']||0).toFixed(2), (item.resultados.pesosPorDiametro['3/4"']||0).toFixed(2), (item.resultados.pesosPorDiametro['1"']||0).toFixed(2),
            (item.resultados.pesosPorDiametro['1 3/8"']||0).toFixed(2), item.resultados.pesoTotalAcero.toFixed(2), item.resultados.ratio.toFixed(2)
        ];
        csv += fila.join(",") + "\n";
    });
    descargarCSV(csv, "Resumen_Parcial_Elementos.csv");
}

function exportarExcelGlobal() {
    if(baseDatosProyecto.length === 0) { alert("No hay datos para exportar."); return; }
    let csv = "ZONA,TIPO,PARTIDA,CANTIDAD,UNIDAD\n";
    let zonas = ["SUB-ESTRUCTURA", "SUPER-ESTRUCTURA"];
    let tipos = ["COLUMNAS", "PLACAS"];
    let fcs = ["100", "210", "245", "280", "350", "420"];

    zonas.forEach(z => {
        tipos.forEach(t => {
            let elems = baseDatosProyecto.filter(e => e.zona === z && e.tipo === t);
            if(elems.length > 0) {
                fcs.forEach(fc => {
                    let vol = elems.filter(e => e.fc === fc).reduce((sum, e) => sum + e.resultados.volConcreto, 0);
                    if(vol > 0) csv += `${z},${t},CONCRETO F'C=${fc} KG/CM2,${vol.toFixed(2)},m3\n`;
                });
                let encTipos = ["SIMPLE", "DOBLE", "TRIPLE"];
                encTipos.forEach(enc => {
                    let area = elems.filter(e => e.encTipo === enc).reduce((sum, e) => sum + e.resultados.areaEncofrado, 0);
                    let nombreEnc = enc === "SIMPLE" ? "ALTURA SIMPLE" : (enc === "DOBLE" ? "- 2H" : "- 3H");
                    if(area > 0) csv += `${z},${t},ENCOFRADO Y DESENCOFRADO ${nombreEnc},${area.toFixed(2)},m2\n`;
                });
                let acero = elems.reduce((sum, e) => sum + e.resultados.pesoTotalAcero, 0);
                if(acero > 0) csv += `${z},${t},ACERO FY=4200 KG/CM2,${acero.toFixed(2)},kg\n`;

                let curado = elems.reduce((sum, e) => sum + e.resultados.areaEncofrado, 0);
                if(curado > 0) csv += `${z},${t},CURADO,${curado.toFixed(2)},m2\n`;
            }
        });
    });
    descargarCSV(csv, "Resumen_Global_Presupuesto.csv");
}

function exportarExcelRecopilatorio() {
    if(baseDatosProyecto.length === 0) { alert("No hay datos para exportar."); return; }
    let csv = "Elemento,Zona,Tipo,Elemento Acero,Similares,Diametro,Long. Pieza (m),Desarrollo (m),Forma,Espaciamiento,N x Piso,Empalmes,Peso (kg)\n";
    baseDatosProyecto.forEach(item => {
        item.filas.forEach(f => {
            let espac = f.espac === "-" || f.espac === 0 ? "-" : f.espac;
            let numPiso = f.nombre.includes("longitudinal") ? "-" : f.numXPiso;
            let emp = f.editableEmpalmes !== undefined ? f.editableEmpalmes : f.numEmpAuto;
            csv += `${item.nombre},${item.zona},${item.tipo},${f.nombre},${f.similares},${f.diam},${f.longPieza.toFixed(3)},${f.desarrollo.toFixed(3)},${f.forma},${espac},${numPiso},${emp},${f.pesoCalculado.toFixed(2)}\n`;
        });
    });
    descargarCSV(csv, "Despiece_Detallado.csv");
}