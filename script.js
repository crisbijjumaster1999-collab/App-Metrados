// 1. OBTENER EL LIENZO (CANVAS)
// Esto es como abrir la ventana de modelo en AutoCAD
const canvas = document.getElementById("planoColumna");
const ctx = canvas.getContext("2d"); // "ctx" será nuestro cursor para dibujar

// 2. CONFIGURAR LA ESCALA
// El Canvas usa píxeles. Si tu placa P-3 mide 3.45m, necesitamos escalarla.
// Factor: 1 metro = 150 píxeles
const escala = 150; 

// 3. FUNCIÓN PARA DIBUJAR EL CONCRETO (Comando RECTANG + HATCH)
function dibujarConcreto(largoMetro, anchoMetro, xOrigen, yOrigen) {
    const largoPx = largoMetro * escala;
    const anchoPx = anchoMetro * escala;

    // Pintar el fondo gris (Concreto)
    ctx.fillStyle = "#e5e7eb"; 
    ctx.fillRect(xOrigen, yOrigen, largoPx, anchoPx);

    // Dibujar el contorno negro
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.strokeRect(xOrigen, yOrigen, largoPx, anchoPx);
}

// 4. FUNCIÓN PARA DIBUJAR UN ACERO (Comando CIRCLE)
function dibujarAcero(xLocal, yLocal, radioPx, xOrigen, yOrigen) {
    const xReal = xOrigen + (xLocal * escala);
    const yReal = yOrigen + (yLocal * escala);

    ctx.beginPath();
    // ctx.arc(X centro, Y centro, Radio, Ángulo inicio, Ángulo fin)
    ctx.arc(xReal, yReal, radioPx, 0, Math.PI * 2);
    
    // Relleno azul
    ctx.fillStyle = "#3b82f6"; 
    ctx.fill();
    
    // Borde negro del acero
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
}

// ==========================================
// EJECUCIÓN DEL DIBUJO (LA PLACA P-3)
// ==========================================

// Posición de inicio en la pantalla (Margen)
const inicioX = 30; 
const inicioY = 200; 

// Dibujamos la Placa P-3 de 3.45m x 0.25m
dibujarConcreto(3.45, 0.25, inicioX, inicioY);

// Insertamos un par de aceros de prueba usando coordenadas relativas
// Acero izquierdo a 15cm (0.15m) en X, y al centro en Y (0.125m)
dibujarAcero(0.15, 0.125, 6, inicioX, inicioY); 

// Acero derecho a 3.30m en X, y al centro en Y
dibujarAcero(3.30, 0.125, 6, inicioX, inicioY);