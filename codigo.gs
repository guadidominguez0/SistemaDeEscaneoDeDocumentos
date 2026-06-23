// =========================================================================
// 1. CONFIGURACIÓN
// =========================================================================
const ID_CARPETA_FACTURAS = "TU_ID_CARPETA_FACTURAS";
const ID_CARPETA_TICKETS = "TU_ID_CARPETA_TICKETS";
// ===================================

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Interfaz')
      .setTitle('SED')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Función auxiliar para guardar en Drive
function guardarEnDrive(base64Data, mimeType, nombreArchivo, folderId) {
  var bytes = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(bytes, mimeType, nombreArchivo);
  var folder = DriveApp.getFolderById(folderId);
  return folder.createFile(blob).getUrl(); 
}

function abrirDialogoPrincipal() {
  var html = HtmlService.createHtmlOutputFromFile('Interfaz')
      .setWidth(950)
      .setHeight(720);
  SpreadsheetApp.getUi().showModalDialog(html, 'Panel de Control Inteligente');
}

function getGeminiApiKey() {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) {
    throw new Error("Falta configurar la propiedad 'GEMINI_API_KEY' en la configuración del script.");
  }
  return key;
}

// =========================================================================
// 2. FUNCIÓN CENTRAL: ANALIZAR DOCUMENTO CON GEMINI
// =========================================================================

function analizarDocumentoConIA(base64Data, mimeType, tipoDoc) {
  var apiKey = getGeminiApiKey();
  var prompt = "";
  if (tipoDoc === "factura") {
    prompt = "Analiza esta factura de servicio eléctrico (EDEMSA). Extrae con precisión los siguientes datos en formato JSON estricto sin formatos markdown, devolviendo solo el objeto de texto plano:\n" +
             "{\n" +
             "  \"nic\": \"Número de NIC de la factura\",\n" +
             "  \"titular\": \"Nombre completo del Titular o Razón Social\",\n" +
             "  \"direccion\": \"Dirección del suministro eléctrico indicada en la factura\",\n" +
             "  \"total\": 0.0,\n" +
             "  \"kwh\": 0\n" +
             "}\n" +
             "Reglas:\n" +
             "- El 'total' debe ser un número decimal.\n" +
             "- El 'kwh' debe ser el consumo total del período expresado en kWh de forma numérica.\n" +
             "- Si no encontrás un dato, dejá el campo vacío (\"\") o en 0.";
  } else {
    prompt = "Analiza este ticket o comprobante de gasto. Extrae con precisión los siguientes datos en formato JSON estricto sin formatos markdown, devolviendo solo el objeto de texto plano:\n" +
             "{\n" +
             "  \"comercio\": \"Nombre del Supermercado, Farmacia o Comercio Emisor\",\n" +
             "  \"cuit\": \"Número de CUIT o RUT del emisor sin guiones ni espacios\",\n" +
             "  \"fecha\": \"AAAA-MM-DD\",\n" +
             "  \"detalle\": \"Un resumen muy breve en 3 o 4 palabras de lo que se compró (ej: Medicamentos, mercadería, limpieza)\",\n" +
             "  \"total\": 0.0\n" +
             "}\n" +
             "Reglas:\n" +
             "- El 'total' debe ser un número decimal.\n" +
             "- Si no encontrás un dato, dejá el campo vacío (\"\") o en 0.";
  }

  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

  var payload = {
    "contents": [{
      "parts": [
        { "text": prompt },
        { "inlineData": { "mimeType": mimeType, "data": base64Data } }
      ]
    }]
  };

  var opciones = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  // LLAMADA DIRECTA: Saltamos llamarGeminiConReintentos
  var respuesta = UrlFetchApp.fetch(url, opciones);
  var codigo = respuesta.getResponseCode();
  var cuerpo = respuesta.getContentText();

  // Si no es 200, lanzamos el error con todo el detalle
  if (codigo !== 200) {
    throw new Error("ERROR DIRECTO (Código " + codigo + "): " + cuerpo);
  }

  var jsonRespuesta = JSON.parse(cuerpo);
  var textoClaro = jsonRespuesta.candidates[0].content.parts[0].text.trim();
  
  // Limpieza de Markdown...
  textoClaro = textoClaro.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  return JSON.parse(textoClaro);
}

// =========================================================================
// 3. PROCESAMIENTO DE FACTURAS
// =========================================================================

function procesarFacturaSubida(fileData) {
  try {
    var nombreArchivo = fileData.name;
    var base64Data    = fileData.base64;
    var mimeType      = fileData.type || "application/pdf";

    // 1. PRIMERO: Llamada a Gemini (Si falla, no guarda nada)
    var datosIA = analizarDocumentoConIA(base64Data, mimeType, "factura");

    // 2. SEGUNDO: Si la IA respondió, guardamos el archivo
    var urlArchivo = guardarEnDrive(base64Data, mimeType, nombreArchivo, ID_CARPETA_FACTURAS);

    // 3. TERCERO: Escribir en la hoja
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Facturas");
    if (!hoja) throw new Error("No se encontró la pestaña 'Facturas'.");

    hoja.appendRow([
      nombreArchivo,
      datosIA.nic         || "",
      datosIA.titular     || "",
      datosIA.direccion   || "",
      datosIA.total       || 0,
      datosIA.kwh         || 0
    ]);

    return { ok: true, mensaje: "¡Factura procesada con éxito!" };

  } catch (error) {
    // Si algo falla, el archivo nunca se subió a Drive
    return { ok: false, mensaje: "Error en IA. Intentá más tarde." + error.message};
  }
}

// =========================================================================
// 4. PROCESAMIENTO DE TICKETS
// =========================================================================

function procesarTicketSubido(fileData) {
  try {
    var nombreArchivo = fileData.name;
    var base64Data    = fileData.base64;
    var mimeType      = fileData.type || "image/jpeg";

    // 1. PRIMERO: Llamada a Gemini
    var datosIA = analizarDocumentoConIA(base64Data, mimeType, "ticket");

    // 2. SEGUNDO: Guardar en Drive
    var urlArchivo = guardarEnDrive(base64Data, mimeType, nombreArchivo, ID_CARPETA_TICKETS);

    // 3. TERCERO: Escribir en la hoja
    var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Tickets");
    if (!hoja) throw new Error("No se encontró la pestaña 'Tickets'.");

    hoja.appendRow([
      nombreArchivo,
      datosIA.comercio  || "",
      datosIA.cuit      || "",
      datosIA.fecha     || "",
      datosIA.detalle   || "",
      datosIA.total     || 0
    ]);

    return { ok: true, mensaje: "¡Ticket procesado con éxito!" };

  } catch (error) {
    return { ok: false, mensaje: "Error en IA. Intentá más tarde." + error.message };
  }
}

// =========================================================================
// 5. CONSULTAS EN LENGUAJE NATURAL
// =========================================================================

function realizarConsultaIA(preguntaUsuario) {
  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet();

    var hojaFacturas  = libro.getSheetByName("Facturas");
    var datosFacturas = hojaFacturas ? hojaFacturas.getDataRange().getValues() : [];

    var hojaTickets  = libro.getSheetByName("Tickets");
    var datosTickets = hojaTickets ? hojaTickets.getDataRange().getValues() : [];

    var respuestaIA = consultarMotorLLM(preguntaUsuario, datosFacturas, datosTickets);
    return { ok: true, respuesta: respuestaIA };

  } catch (error) {
    return { ok: false, respuesta: "Error al consultar a la IA: " + error.toString() };
  }
}

function consultarMotorLLM(pregunta, tablaFacturas, tablaTickets) {
  var apiKey = getGeminiApiKey();
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

  var promptCompleto =
    "Eres un analista financiero experto.\n\n" +
    "Tabla Facturas (columnas: Archivo, NIC, Titular, Dirección, Total, kWh):\n" + JSON.stringify(tablaFacturas) + "\n\n" +
    "Tabla Tickets (columnas: Archivo, Comercio, CUIT, Fecha, Detalle, Monto):\n" + JSON.stringify(tablaTickets) + "\n\n" +
    "Responde la siguiente consulta de manera precisa basándote en los datos: " + pregunta;

  var opciones = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify({
      "contents": [{ "parts": [{ "text": promptCompleto }] }]
    }),
    "muteHttpExceptions": true
  };

  var respuesta = llamarGeminiConReintentos(url, opciones);
  var json = JSON.parse(respuesta.getContentText());
  return json.candidates[0].content.parts[0].text;
}

// =========================================================================
// 6. UTILIDAD: REINTENTOS ANTE ERRORES 503 / 429
// =========================================================================

function llamarGeminiConReintentos(url, opciones, maxReintentos) {
  maxReintentos = maxReintentos || 3;
  
  for (var i = 0; i < maxReintentos; i++) {
    try {
      var respuesta = UrlFetchApp.fetch(url, opciones);
      var codigoRespuesta = respuesta.getResponseCode();
      
      // 1. ÉXITO
      if (codigoRespuesta === 200) {
        return respuesta;
      }
      
      // 2. ERRORES DE SATURACIÓN O CUOTA (429 y 503)
      if (codigoRespuesta === 429 || codigoRespuesta === 503) {
        var textoRespuesta = respuesta.getContentText();
        
        // Si es cuota diaria (429 específico), no reintentar
        if (codigoRespuesta === 429 && (textoRespuesta.includes("Quota exceeded") || textoRespuesta.includes("RESOURCE_EXHAUSTED"))) {
          throw new Error("Límite diario de IA agotado. Revisa tu facturación o espera al reseteo diario.");
        }
        
        // Si es 429 (Rate Limit) o 503 (Servidor ocupado), reintentamos con espera
        var retraso = Math.pow(2, i) * 2000; 
        Logger.log("Error " + codigoRespuesta + ". Reintentando en " + (retraso/1000) + " segundos...");
        Utilities.sleep(retraso);
        continue; 
      }
      
      // 3. OTROS ERRORES
      throw new Error("Error API Gemini. Código: " + codigoRespuesta + ". Respuesta: " + textoRespuesta);

    } catch (error) {
      // Si es el error de cuota que lanzamos manualmente, relanzar para mostrar en UI
      if (error.message.includes("Límite diario")) {
        throw error; 
      }
      
      // Si es el último intento, fallar
      if (i === maxReintentos - 1) {
        throw new Error("Máximo de reintentos alcanzado. Último error: " + error.message);
      }
      
      Utilities.sleep(1000);
    }
  }
}

// =========================================================================
// 7. UTILIDAD: MENÚ PERSONALIZADO EN LA BARRA DE HERRAMIENTAS DE GOOGLE SHEETS
// =========================================================================

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('SED')
      .addItem('Abrir Panel de Control', 'abrirDialogoPrincipal')
      .addToUi();
}

function probarAPIKey() {
  var apiKey = getGeminiApiKey();
  var url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
  
  var payload = {
    "contents": [{
      "parts": [{ "text": "Responde solo: OK" }]
    }]
  };
  
  var opciones = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  var respuesta = UrlFetchApp.fetch(url, opciones);
  Logger.log(respuesta.getResponseCode());
  Logger.log(respuesta.getContentText());
}
