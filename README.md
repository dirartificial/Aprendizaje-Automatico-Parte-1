# Tutor de Ciencia de Datos y Machine Learning (BYOK)

Asistente pedagógico interactivo **100% estático (sin backend)** bajo el modelo **BYOK (*Bring Your Own Key*)**, diseñado para estudiantes de Ciencia de Datos e Inteligencia Artificial según el diseño curricular del **Centro Educativo Paulo Freire — U.E.G.P. N° 165**.

Acompaña al estudiante desde la formulación del reto comercial, elaboración de la **Ficha Técnica de ML**, análisis exploratorio y escalado, selección y diagnóstico de algoritmos de agrupamiento (**K-Means, Jerárquico y DBSCAN**), ejecución real de Python mediante **Pyodide (WebAssembly)**, hasta la traducción de los clusters a perfiles de valor para **Business Intelligence (Power BI y DAX)** y la descarga de un paquete de entregables en ZIP auditado.

---

## 🔒 Privacidad y Manejo de la API Key (Reglas de Primer Orden)

1. **Aislamiento en `sessionStorage`:** Tu clave vive exclusivamente en la pestaña activa del navegador gestionada por el módulo `src/core/key.ts`. Se elimina de inmediato al cerrar la pestaña o el navegador.
2. **Prohibiciones estrictas:** Prohibido el uso de `localStorage`, IndexedDB, cookies, URLs o telemetría para claves de API.
3. **Cero servidores intermedios:** La aplicación se comunica de forma directa desde tu navegador con el endpoint oficial de Google Gemini (`generativelanguage.googleapis.com`), OpenRouter u Ollama local.
4. **Auditoría de seguridad anti-leaks:** Todo archivo descargable individual y el paquete ZIP completo son inspeccionados en memoria byte a byte con un escáner regex (`AIza[0-9A-Za-z-_]{20,}`) que aborta la exportación si detecta cualquier coincidencia.
5. **Botón de purga inmediata:** Disponés en todo momento del botón *"Olvidar key ahora"* en la barra superior.

---

## 🔑 Guía para Obtener y Configurar tu API Key

### Opción 1: Google Gemini (Recomendada Oficial)
1. Ingresá en [Google AI Studio](https://aistudio.google.com/) con tu cuenta de Google.
2. Hacé clic en **"Get API key"** > **"Create API key"**.
3. Copiá la clave generada (comienza con `AIzaSy...`).
4. Pegala en la pantalla inicial de la aplicación.
5. *(Al finalizar la cursada)*: Podés volver a Google AI Studio y eliminar la clave con un solo clic.

### Opción 2: OpenRouter (Modelos Gratuitos `:free`)
1. Creá una cuenta en [OpenRouter](https://openrouter.ai/).
2. Navegá a la sección **Keys** y generá una nueva API key (comienza con `sk-or-v1-...`).
3. Seleccioná el proveedor *OpenRouter* en la app e ingresá tu clave para acceder a los modelos `:free` y al auto-router.

### Opción 3: Ollama Local (100% Offline / Privado)
1. Instalá [Ollama](https://ollama.com/) en tu equipo.
2. Descargá un modelo en tu terminal: `ollama run qwen2.5-coder:7b` o `llama3.2:3b`.
3. En la app, seleccioná el proveedor *Ollama Local (http://localhost:11434)* sin necesidad de ingresar ninguna API key.

---

## 🧠 Ruta Pedagógica del Asistente (9 Etapas)

| Paso | Etapa Metodológica | Descripción y Fundamentos de la Cátedra |
|---|---|---|
| **1** | **Problema de Negocio** | Planteo del reto en lenguaje cotidiano con 4 presets curriculares (Retail, Sensores/Lunas, Jerárquico taxonómico, Power BI vs AP). |
| **2** | **Ficha Técnica de ML** | Tutor socrático que clarifica ambigüedades y define Paradigma (No Supervisado), Tarea (Clustering), Features ($X$) y ausencia de Target ($Y$). |
| **3** | **EDA y Escalado** | Revisión de tipos de datos y aplicación sistemática de `StandardScaler` / `MinMaxScaler` para evitar distorsiones en distancias euclidianas. |
| **4** | **Selección de Algoritmo** | Validador determinístico con 5 reglas pedagógicas (Escala, Formas no convexas, Outliers, Features insuficientes y Dimensionalidad). |
| **5** | **Hiperparámetros y Diagnóstico** | Ajuste interactivo del Método del Codo (Inercia WCSS), Coeficiente de Silueta, Criterios de Enlace (Ward) y radio `eps` / `min_samples`. |
| **6** | **Pipeline Python (`scikit-learn`)** | Generación de scripts `.py` y notebooks `.ipynb` v4 con modo interactivo *"Explicar línea por línea"* y preguntas socráticas. |
| **7** | **WASM & Visualización 2D** | Ejecución real en el navegador mediante **Pyodide** en Web Worker, scatter plot interactivo en SVG, centroides y aislamiento de ruido (`-1`). |
| **8** | **Perfilado BI y DAX** | Traducción de clusters a perfiles cualitativos accionables, modelado en estrella (Star Schema) y fórmulas DAX (`CALCULATE`, `DIVIDE`). |
| **9** | **Paquete de Entregables** | Descarga del ZIP completo auditado con 9 artefactos listos para producción académica y profesional. |

---

## 📦 Paquete de Entregables en el ZIP

- `proyecto_ds.json`: Estado íntegro de la sesión para retomar en la aplicación sin credenciales.
- `notebook_clustering.ipynb`: Jupyter Notebook estructurado v4 ejecutable en Google Colab o VS Code.
- `pipeline_sklearn.py`: Script modular en Python con scikit-learn, pandas y matplotlib.
- `dataset_ejemplo.csv`: Dataset sintético con columnas `cluster` y protección anti-fórmulas (`'`).
- `ficha_tecnica.md`: Ficha técnica formal detallada en Markdown.
- `reporte_ejecutivo.pdf`: Informe gerencial de 1 a 2 páginas con perfiles y KPIs.
- `grafico_clusters.svg`: Gráfico vectorial responsive de la proyección 2D.
- `curva_codo_silueta.svg`: Curva diagnóstica de inercia y silueta.
- `glosario_ciencia_datos.md`: Glosario con todos los conceptos técnicos de la sesión.

---

## ♿ Accesibilidad y Usabilidad (WCAG AA)

- **Navegación por teclado completa:** Modales accesibles con cierre por `Escape`, foco visible de alto contraste y trampas de foco.
- **Skip Links:** Enlace directo `#main-content` para lectores de pantalla.
- **Modo Claro / Modo Oscuro:** Alternable en la barra superior con persistencia de preferencias de usuario.
- **Glosario Modal Interactivo:** Buscador reactivo en vivo categorizado con más de 20 conceptos didácticos y fórmulas clave.

---

## 💻 Desarrollo Local y Comandos de Verificación

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo Vite
npm run dev

# 3. Correr suite completa de pruebas automatizadas (Vitest)
npm test

# 4. Compilación estricta de producción (TypeScript + Vite build)
npm run build
```
