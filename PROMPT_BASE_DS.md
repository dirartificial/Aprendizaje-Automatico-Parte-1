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
- **Diseño Visual Homogéneo y Consistente (Design System):**
  Todos los pasos del wizard (Pasos 1 al 8 y Entregables) DEBEN respetar estrictamente la misma estructura visual, jerarquía y clases CSS:
  1. *Contenedor raíz del paso:* `<section className="card studio-step-card" aria-labelledby="stepX-title" data-testid="stepX-container">`.
  2. *Encabezado unificado:* `<div className="step-header"><span className="step-badge">Paso X de 8</span><div><h2 id="stepX-title" className="card-title">...</h2><p className="step-lead">...</p></div></div>`.
  3. *Caja conceptual pedagógica:* `<details className="concept-box" data-testid="stepX-concept-box"><summary className="concept-summary">💡 Fundamento teórico: ...</summary><div className="concept-content">...</div></details>`.
  4. *Bloque de explicación del tutor IA:* `<div className="tutor-explanation-box"><strong>Tutor IA:</strong><p>...</p></div>`.
  5. *Barra de herramientas:* `<div className="toolbar-row">...</div>`.
  6. *Navegación inferior:* `<div className="button-group"><button className="btn btn-secondary">← Volver...</button><button className="btn btn-primary">Confirmar y Avanzar...</button></div>`.
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
  - [x] **Fase 0 — Base, seguridad y onboarding BYOK:** Proyecto Vite + React + TS, cabeceras CSP, `src/core/key.ts` (`sessionStorage` aislado), `src/core/gemini.ts` (wrapper con modelo configurable y prueba de conexión), pantalla de Onboarding con aviso obligatorio no ocultable la primera vez, enmascarado de key, botones "Probar conexión" y "Olvidar key ahora", `.env.example`, `README.md` y suite de tests de seguridad en `tests/fase0.test.tsx` (13/13 tests pasando, build limpio).
  - [ ] **Fase 1 — Núcleo conceptual y Ficha Técnica ML:** Prompt versionado (`src/prompts/system_tutor_ds.md`), esquemas Zod completos (`src/core/schemas.ts`), evaluación de claridad y detección de ambigüedad (`src/core/clarityDS.ts`), persistencia en IndexedDB (`src/core/storageDS.ts`), componentes de Pasos 1 y 2 con 4 presets didácticos y bitácora de decisiones, y tests en `tests/fase1.test.tsx`.
  - [ ] **Fase 2 — EDA, variables y validador:** Componentes de Paso 3 (variables, tipos, escalado `StandardScaler`) y Paso 4 (selección de K-Means, Jerárquico o DBSCAN), validador determinístico (`src/core/modelValidatorDS.ts`) con 5 reglas pedagógicas, resolución rápida de advertencias y tests en `tests/fase2.test.tsx`.
  - [ ] **Fase 3 — Diagnóstico de hiperparámetros:** Componente de Paso 5, cálculo/simulación de Inercia WCSS y Coeficiente de Silueta, renderizado SVG puro interactivo del Método del Codo y gráfico de silueta, justificación guiada del tutor y tests en `tests/fase3.test.tsx`.
  - [ ] **Fase 4 — Generador de pipelines y Python:** Generador determinístico de código `scikit-learn` modular (`src/core/python/pipelineGenerator.ts`), creador de Jupyter Notebook `.ipynb` nativo (JSON v4 con celdas de Markdown y código), componente de Paso 6 con modo "Explicar línea por línea" del tutor IA y tests en `tests/fase4.test.tsx`.
  - [ ] **Fase 5 — Ejecución WASM con Pyodide:** Web Worker aislado con Pyodide para ejecución real de Python en el navegador, generador de dataset sintético coherente (`src/core/sampleDataset.ts`), componente de Paso 7 con visualización interactiva de clusters en 2D (SVG nativo con centroides y etiquetas de ruido) y tests en `tests/fase5.test.tsx`.
  - [ ] **Fase 6 — Perfilado de negocio y puente con BI:** Componente de Paso 8, traducción de clusters numéricos a perfiles comerciales cualitativos (`src/core/businessProfile.ts`), guía didáctica de conexión a Power BI con medidas DAX sugeridas y tests en `tests/fase6.test.tsx`.
  - [ ] **Fase 7 — Entregables descargables:** Módulo de exportación CSV seguro anti-fórmulas, generador de informe PDF ejecutivo con `jspdf`, empaquetador ZIP en memoria con `fflate` con auditoría de seguridad anti-leaks de API key, componente `StepEntregablesDS.tsx` y tests en `tests/fase7.test.tsx`.
  - [ ] **Fase 8 — Pulido pedagógico, glosario y accesibilidad:** Glosario interactivo modal con buscador en vivo categorizado, contrastes WCAG AA, skip link `#main-content`, modo oscuro/claro y build de producción verificado.
- **Fase actual a implementar:** Fase 1 — Núcleo conceptual y Ficha Técnica ML.
- **Estado general:**
  - Fase 0 completada con éxito. Suite de tests unitarios al 100% (13 tests) y compilación limpia de producción verificada. Listo para confirmación de usuario e inicio de Fase 1.
