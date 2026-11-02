# Tutor de Ciencia de Datos y Machine Learning (BYOK)

Asistente pedagógico interactivo 100% estático (sin backend, arquitectura cliente BYOK - *Bring Your Own Key*) para la formulación, diseño de fichas técnicas, preparación de datos, clustering (**K-Means, Jerárquico, DBSCAN**), diagnóstico de hiperparámetros, ejecución real en Python con Pyodide (WASM) y traducción a decisiones de Business Intelligence (Power BI).

---

## 🔒 Privacidad y Manejo de la API Key (BYOK)

1. **Aislamiento absoluto:** Tu API key se guarda **únicamente en `sessionStorage`** del navegador y se elimina en el momento en que cerrás la pestaña.
2. **Cero servidores intermedios:** Las peticiones van directamente desde tu navegador al endpoint oficial de Google (`generativelanguage.googleapis.com`) u OpenRouter.
3. **Auditoría de exportaciones:** Todo entregable generado (ZIP, Notebooks, informes) es auditado en memoria para asegurar que **jamás** contenga la API key.
4. **Olvidar clave:** Disponés en todo momento de un botón visible para purgar la credencial de forma inmediata.

---

## 🚀 Puesta en Marcha Local

### Prerrequisitos
- Node.js >= 18 (o 20/22 recomendado)
- npm >= 9

### Instalación y Ejecución
```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Ejecutar tests automatizados
npm test

# Compilación de producción
npm run build
```

---

## 🧠 Flujo Pedagógico (Wizard de 8 Pasos)

1. **Paso 1:** Planteo del Problema de Negocio (Retail, Sensores/Lunas, Jerárquico taxonómico, Power BI vs AP).
2. **Paso 2:** Aclaración guiada socrática y Ficha Técnica de ML ($X$ features, $Y$ target, paradigma y tarea).
3. **Paso 3:** Estructura de Datos, EDA y Escalado (`StandardScaler`, `MinMaxScaler`).
4. **Paso 4:** Selección de Algoritmo de Clustering y Supuestos Geométricos (Validador determinístico).
5. **Paso 5:** Ajuste de Hiperparámetros y Diagnóstico (Método del Codo / WCSS, Coeficiente de Silueta).
6. **Paso 6:** Generación de Pipeline en Python (`scikit-learn`) y Jupyter Notebook (`.ipynb`).
7. **Paso 7:** Ejecución real en Pyodide (WASM) y visualización interactiva de clusters 2D en SVG.
8. **Paso 8:** Perfilado de Negocio y Conexión con Business Intelligence (Power BI / DAX).
9. **Entregables:** Paquete ZIP completo auditado (Notebook, scripts `.py`, dataset `.csv` seguro anti-inyección, PDF ejecutivo y glosario).
