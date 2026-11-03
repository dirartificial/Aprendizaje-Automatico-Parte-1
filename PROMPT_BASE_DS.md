# PROMPT BASE — Contexto de Continuación (DS Tutor BYOK)

> **Uso:** Copiá este archivo o mencionalo (`@[PROMPT_BASE_DS.md]`) al iniciar un nuevo chat o repositorio para guiar al agente de desarrollo sin gastar tokens de más.
> **Regla de mantenimiento:** Al finalizar cada fase, el agente DEBE actualizar la sección **"Estado Actual"** de este archivo.

---

## 1. Resumen del Proyecto
Asistente pedagógico web **100% estático (sin backend, modelo BYOK)** para que estudiantes de Ciencia de Datos e Inteligencia Artificial aprendan a formular problemas de negocio, diseñar fichas técnicas de ML, preparar datos, seleccionar y ajustar algoritmos de clustering (**K-Means, Jerárquico, DBSCAN**), interpretar resultados con impacto en Business Intelligence y generar código Python/Jupyter Notebooks dialogando con una IA tutora (Gemini).
La especificación completa está en `@[PLAN_data_science_tutor_BYOK.md]`.

## 2. Reglas Innegociables (Seguridad, Arquitectura y Diseño)
- **Stack:** Vite + React + TypeScript + `@google/genai` (navegador) + Zod + Pyodide (WASM en Web Worker para ejecución local de Python/scikit-learn).
- **API Key (BYOK):** Solo vive en `sessionStorage` gestionada exclusivamente por `src/core/key.ts`. **Prohibido** `localStorage`, IndexedDB, cookies, URL, logs o exportables.
- **Anti-XSS y CSP:** Cero scripts/CDNs externos. Prohibido `dangerouslySetInnerHTML`. CSP estricta en `vercel.json` y `public/_headers`.
- **IA como Tutor Socrático:** No asume; formula preguntas guiadas si hay ambigüedad. Salidas siempre en JSON estructurado validadas con **Zod**. El estudiante confirma cada decisión técnica (la IA no impone modelos).
- **Exportaciones Seguras:** Protección estricta contra inyección de fórmulas en CSV (`'`, `=`, `+`, `-`, `@`, tab). Los entregables en ZIP son auditados en memoria para asegurar que jamás contengan la API key.
- **Diseño Visual Homogéneo y Consistente (Design System & UX):**
  Todos los pasos del wizard (Pasos 1 al 8 y Entregables) y el entorno de trabajo DEBEN respetar estrictamente la misma estructura visual, jerarquía y clases CSS:
  1. *Layout del Workspace (2 Columnas ergonómicas):*
     - Contenedor raíz: `<div className="workspace-grid" data-testid="ready-workspace">`.
     - Columna lateral: `<aside className="workspace-sidebar" aria-label="Ruta de aprendizaje">`.
     - Columna central de estudio: `<div className="workspace-center"><main id="main-content">...`.
  2. *Menú de Etapas Pedagógicas (Sidebar de Navegación Amigable y Ergonómico):*
     - Tarjeta del sidebar: `<div className="card sidebar-card">`.
     - Cabecera del sidebar: `<div className="sidebar-header"><span className="module-tag">Ruta Pedagógica</span><h2 className="sidebar-title">Ciencia de Datos & ML</h2></div>`.
     - Lista de etapas: `<nav className="wizard-vertical-nav" aria-label="Etapas del asistente">`.
     - Botones de paso tipo tarjeta: `<button className="wizard-step-card [active] [completed]" data-testid="wizard-step-btn-X">`.
       - Insignia circular con número o checkmark completado: `<span className="step-num-circle">{completado ? '✓' : paso.numero}</span>`.
       - Texto jerarquizado con ícono: `<span className="step-card-text"><span className="step-card-title">{icono} {titulo}</span><span className="step-card-sub">{subtitulo}</span></span>`.
     - Barra de progreso visual con degradado cyan-indigo: `<div className="sidebar-progress"><div className="progress-header"><span>Progreso general</span><strong>...%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: '...%' }} /></div></div>`.
     - *Regla UX estricta:* Prohibido crear listas planas, desalineadas o sin estilos gráficos (`<ol>`, `<nav>` ad-hoc). Cada etapa debe tener microinteracciones hover, estado activo resaltado con glow cyan (`var(--accent-cyan)`), badges claros y legibilidad óptima para una experiencia de usuario fluida y amigable.
  3. *Contenedor raíz del paso activo:* `<section className="card studio-step-card" aria-labelledby="stepX-title" data-testid="stepX-container">`.
  4. *Encabezado unificado:* `<div className="step-header"><span className="step-badge">Paso X de 8</span><div><h2 id="stepX-title" className="card-title">...</h2><p className="step-lead">...</p></div></div>`.
  5. *Caja conceptual pedagógica:* `<details className="concept-box" data-testid="stepX-concept-box"><summary className="concept-summary">💡 Fundamento teórico: ...</summary><div className="concept-content">...</div></details>`.
  6. *Bloque de explicación del tutor IA:* `<div className="tutor-explanation-box"><strong>Tutor IA:</strong><p>...</p></div>`.
  7. *Barra de herramientas:* `<div className="toolbar-row">...</div>`.
  8. *Navegación inferior:* `<div className="button-group"><button className="btn btn-secondary">← Volver...</button><button className="btn btn-primary">Confirmar y Avanzar...</button></div>`.
  *Prohibido inventar clases ad-hoc o contenedores externos que rompan la coherencia visual.*

## 3. Flujo de Trabajo para el Agente
1. Implementar **una sola fase por vez**, siguiendo el orden de `PLAN_data_science_tutor_BYOK.md` (Sección 9).
2. No agregar funcionalidades fuera del plan.
3. Al terminar cada fase:
   - Ejecutar `npm test` y `npm run build` para verificar que todo pase sin errores ni advertencias de TypeScript.
   - Actualizar la sección **Estado Actual** de este `PROMPT_BASE_DS.md`.
   - Indicar al usuario cómo probar la fase y **esperar confirmación explícita** antes de pasar a la siguiente.

## 4. Estado Actual del Proyecto
- **Fases completadas:**
  - [x] **Fase 0 — Base, seguridad y onboarding BYOK:** Proyecto Vite + React + TS, cabeceras CSP, `src/core/key.ts` (`sessionStorage` aislado), `src/core/gemini.ts` (wrapper con modelo configurable y prueba de conexión), pantalla de Onboarding con aviso obligatorio no ocultable la primera vez, enmascarado de key, botones "Probar conexión" y "Olvidar key ahora", `.env.example`, `README.md` y suite de tests de seguridad en `tests/fase0.test.tsx` (16/16 tests pasando, build limpio).
  - [x] **Fase 1 — Núcleo conceptual y Ficha Técnica ML:** Prompt versionado (`src/prompts/system_tutor_ds.md`), esquemas Zod completos (`src/core/schemas.ts`), evaluación de claridad y detección de ambigüedad (`src/core/clarityDS.ts`), persistencia en IndexedDB (`src/core/storageDS.ts`) con auditoría de seguridad anti-leaks en IndexedDB, componentes de Pasos 1 y 2 (`Step1ProblemaDS.tsx`, `Step2FichaTecnicaDS.tsx`) con 4 presets curriculares y bitácora de decisiones metodológicas, suite de tests en `tests/fase1.test.tsx` (19/19 tests pasando, 35/35 tests globales pasando, build limpio).
  - [x] **Fase 2 — EDA, variables y validador determinístico:** Componentes de Paso 3 (`Step3EstructuraDatosDS.tsx`) y Paso 4 (`Step4SeleccionAlgoritmoDS.tsx`), validador determinístico (`src/core/modelValidatorDS.ts`) con las 5 reglas pedagógicas (Escala en K-Means, Formas no convexas, Outliers/ruido, Features insuficientes, Dimensionalidad excesiva), botones de resolución rápida, persistencia sincronizada y suite de tests en `tests/fase2.test.tsx` (13/13 tests pasando, 48/48 tests globales pasando, build limpio).
  - [x] **Fase 3 — Diagnóstico de hiperparámetros (Codo y Silueta):** Componente de Paso 5 (`Step5HiperparametrosDS.tsx`), motor determinístico de cálculo de Inercia WCSS y Coeficiente de Silueta (`src/core/metrics/diagnostics.ts`), renderizador visual interactivo de Curva del Codo y Gráfico de Silueta en SVG nativo puro, diagnósticos especializados para DBSCAN (densidad/ruido) y Clustering Jerárquico (dendrograma y criterios de enlace), justificación metodológica guiada y suite de tests en `tests/fase3.test.tsx` (10/10 tests pasando, 58/58 tests globales pasando, build limpio).
  - [x] **Fase 4 — Generador de pipelines y Python:** Generador determinístico de código `scikit-learn` modular (`src/core/python/pipelineGenerator.ts`), creador de Jupyter Notebook `.ipynb` nativo (JSON v4 con celdas de Markdown y código), componente de Paso 6 (`Step6PipelinePythonDS.tsx`) con 3 pestañas (Script `.py`, Notebook `.ipynb`, Modo "Explicar línea por línea" interactivo y consulta al tutor IA), descarga directa de archivos, copiado al portapapeles y suite de tests en `tests/fase4.test.tsx` (15/15 tests pasando, 73/73 tests globales pasando, build limpio).
  - [x] **Fase 5 — Ejecución WASM con Pyodide:** Web Worker aislado con Pyodide para ejecución real de Python en el navegador (`src/core/workers/pyodideWorker.ts`, `pyodideClient.ts`), generador de dataset sintético coherente con protección anti-fórmulas en CSV (`src/core/sampleDataset.ts`), componente de Paso 7 (`Step7EjecucionWasmDS.tsx`) con visualización interactiva de clusters en 2D (SVG nativo responsive, centroides resaltados, etiquetas de ruido `-1`, inspección de muestras y consola stdout) y tests en `tests/fase5.test.tsx` (11/11 tests pasando, 84/84 tests globales pasando, build limpio).
  - [x] **Fase 6 — Perfilado de negocio y puente con BI:** Componente de Paso 8 (`Step8PerfiladoBIDS.tsx`), traducción guiada de clusters a perfiles de clientes y valor de negocio (`src/core/businessProfile.ts`), guía interactiva de conexión hacia Power BI con modelado en estrella, medidas DAX sugeridas (`CALCULATE`, `SUM`, `DIVIDE`) y síntesis ejecutiva para stakeholders, con suite de tests en `tests/fase6.test.tsx` (9/9 tests pasando, 93/93 tests globales pasando, build limpio).
  - [x] **Fase 7 — Entregables descargables:** Módulo de exportación CSV seguro anti-fórmulas (`src/export/csvDS.ts`), generador de informe PDF ejecutivo de 1-2 páginas con `jspdf` (`src/export/pdfDS.ts`), empaquetador ZIP en memoria con `fflate` (`src/export/zipDS.ts`) con auditoría estricta anti-leaks de API key, componente `StepEntregablesDS.tsx` con descarga del ZIP completo (9 artefactos) y descargas individuales, con suite de tests en `tests/fase7.test.tsx` (8/8 tests pasando, 101/101 tests globales pasando, build limpio).
  - [x] **Fase 8 — Pulido pedagógico, glosario y accesibilidad:** Glosario interactivo modal con buscador en vivo categorizado (`src/steps/GlossaryModalDS.tsx`) con 20+ conceptos curriculares y fórmulas, contrastes y navegación accesible WCAG AA, skip link `#main-content`, modo oscuro/claro con alternador en cabecera y persistencia, documentación exhaustiva ilustrada en `README.md` y suite de tests en `tests/fase8.test.tsx` (10/10 tests pasando, 111/111 tests globales pasando, build limpio).
- **Fase actual a implementar:** Proyecto completado al 100%. Todas las fases (0 a 8) implementadas y verificadas con éxito.
- **Estado general:**
  - **Proyecto 100% Completo y Validado:** Suite total de 111 tests automatizados pasando sin fallos (`npm test` en 9 suites) y compilación limpia de producción (`npm run build`). Cumplimiento estricto del modelo BYOK, seguridad anti-leaks, Pyodide WASM y pedagogía de cátedra.
