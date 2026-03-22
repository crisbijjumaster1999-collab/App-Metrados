// ==========================================
// 1. CONFIGURACIÓN DEL CANVAS (DIBUJO)
// ==========================================
const canvas = document.getElementById("planoColumna");
const ctx = canvas.getContext("2d");
const escala = 150; 

function dibujarConcreto(largoMetro, anchoMetro, xOrigen, yOrigen) {
    const largoPx = largoMetro * escala;
    const anchoPx = anchoMetro * escala;
    ctx.fillStyle = "#e5e7eb"; 
    ctx.fillRect(xOrigen, yOrigen, largoPx, anchoPx);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.strokeRect(xOrigen, yOrigen, largoPx, anchoPx);
}

function dibujarAcero(xLocal, yLocal, radioPx, xOrigen, yOrigen) {
    const xReal = xOrigen + (xLocal * escala);
    const yReal = yOrigen + (yLocal * escala);
    ctx.beginPath();
    ctx.arc(xReal, yReal, radioPx, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6"; 
    ctx.fill();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
}

// Dibujamos la Placa P-3 de prueba (3.45m x 0.25m)
const largoPlaca = 3.45;
const anchoPlaca = 0.25;
dibujarConcreto(largoPlaca, anchoPlaca, 30, 200);
dibujarAcero(0.15, 0.125, 6, 30, 200); 
dibujarAcero(3.30, 0.125, 6, 30, 200);


// ==========================================
// 2. MOTOR DE CÁLCULO (NUEVO)
// ==========================================

// Esta función lee el HTML, hace la matemática y actualiza el Dashboard
function calcularMetrados() {
    // A. Leer los datos que el usuario escribió en el panel izquierdo
    let alturaH = parseFloat(document.getElementById("alturaTotal").value);
    let deduccion = parseFloat(document.getElementById("deduccion").value);
    
    // B. Matemáticas de la Sección (usando la placa que dibujamos)
    let areaBruta = largoPlaca * anchoPlaca; 
    let perimetro = 2 * (largoPlaca + anchoPlaca);
    
    // C. Fórmulas de Ingeniería que definimos
    let volumenConcreto = areaBruta * alturaH;
    let areaEncofrado = perimetro * (alturaH - deduccion);
    
    // Simulamos un peso de acero temporal (hasta que hagamos la importación real)
    let pesoAceroTotal = 132.69; // Suma de la tabla de ejemplo
    
    // Cálculo del Ratio (Cuantía kg/m3)
    let ratioCuantia = pesoAceroTotal / volumenConcreto;

    // D. Enviar los resultados de vuelta al HTML (al Dashboard oscuro)
    // El .toFixed(2) asegura que solo se muestren 2 decimales
    document.getElementById("res-concreto").innerText = volumenConcreto.toFixed(2);
    document.getElementById("res-encofrado").innerText = areaEncofrado.toFixed(2);
    document.getElementById("res-acero").innerText = pesoAceroTotal.toFixed(2);
    document.getElementById("res-ratio").innerText = ratioCuantia.toFixed(2);
}

// ==========================================
// 3. EVENTOS (INTERACTIVIDAD EN TIEMPO REAL)
// ==========================================
// Le decimos a la app: "Si el usuario cambia un número, recalcula todo al instante"

document.getElementById("alturaTotal").addEventListener("input", calcularMetrados);
document.getElementById("deduccion").addEventListener("input", calcularMetrados);
document.getElementById("tipoElemento").addEventListener("change", calcularMetrados);

// Ejecutamos el cálculo una vez al abrir la página para que no empiece en 0.00
calcularMetrados();