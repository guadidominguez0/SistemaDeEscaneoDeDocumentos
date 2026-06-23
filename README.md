# Sistema de Escaneo de Documentos

Este proyecto es una herramienta de automatización integral que utiliza **Google Apps Script** y la **API de Google Gemini** para procesar facturas y tickets contables de forma inteligente, almacenando toda la información en Google Drive y Google Sheets.

## 🚀 Características principales
* **Procesamiento de Archivos:** Carga automática de facturas y tickets (PDF/Imágenes).
* **IA Inteligente:** Extracción de datos contables mediante Gemini Flash.
* **Dashboard Integrado:** Interfaz de usuario directa en Google Sheets.
* **Resiliencia:** Sistema de reintentos automáticos para manejar errores de red (503) o límites de tasa (429).
* **Experiencia de usuario:** Interfaz con limpieza automática y soporte para atajos de teclado (`Enter`).

## 🛠️ Requisitos previos
1. Una cuenta de Google (Gmail/Drive).
2. Acceso a [Google AI Studio](https://aistudio.google.com/) para generar tu API Key.

## 📋 Guía de Instalación Paso a Paso

### 1. Configuración de Google Drive
1. Crea una carpeta principal en tu Drive llamada: `Sistema de Escaneo de Documentos`.
2. Dentro, crea dos subcarpetas exactas:
   - `Historial de Facturas`
   - `Historial de Tickets`
3. Crea un nuevo **Google Sheets** dentro de la carpeta principal llamado `Historial de Documentos`.
4. **Copia el ID de este Sheet** (el código alfanumérico largo en la URL luego de https://drive.google.com/drive/folders/).

### 2. Configuración del Script
1. En tu archivo `Historial de Documentos`, ve a **Extensiones > Apps Script**.
2. Pega el código de `codigo.gs`. 
3. Crea un archivo html llamado `Interfaz.html` y pega el código de `Interfaz.html`.
4. **Vinculación:** En tu código `codigo.gs`, localiza las constantes de ID y reemplaza los valores de ejemplo por los ID de tu hoja de cálculo y tus carpetas de Drive:
   ```javascript
   const ID_CARPETA_FACTURAS = "TU_ID_CARPETA_FACTURAS";
   const ID_CARPETA_TICKETS = "TU_ID_CARPETA_TICKETS";

```

### 3. Seguridad y API

1. Genera tu API Key en [Google AI Studio](https://aistudio.google.com/).
2. En Apps Script, ve al **engranaje (Configuración del proyecto)** > **Propiedades de las secuencias de comandos**.
3. Añade la propiedad:
* **Nombre:** `GEMINI_API_KEY`
* **Valor:** `Tu_Clave_Generada`


4. Guarda los cambios.

### 4. Despliegue

1. Haz clic en **Implementar > Nueva implementación**.
2. Selecciona **Aplicación web**.
3. En "Acceso", elige "Cualquiera" o "Solo yo".
4. Copia la URL de la aplicación web resultante y ábrela en tu navegador para empezar a procesar documentos.

## 💡 Cómo usar

1. **Carga:** Arrastra tus archivos a las zonas designadas en el panel.
2. **Consulta:** Escribe tu pregunta en el chat y presiona `Enter` (o el botón "Preguntar").
3. **Limpieza:** La interfaz limpiará el campo de entrada automáticamente y ocultará la respuesta tras 30 segundos de inactividad.

## 📝 Notas de desarrollo

* El script incluye lógica de *exponential backoff* para reintentar automáticamente peticiones fallidas.
* **Seguridad:** Nunca compartas tu API Key ni subas este proyecto a un repositorio público con la clave escrita en el código; utiliza siempre `PropertiesService`.

```
