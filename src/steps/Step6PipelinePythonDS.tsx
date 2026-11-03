import React, { useState, useMemo } from 'react';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
} from '../core/schemas';
import {
  generarScriptPython,
  generarNotebookJupyter,
  generarNotebookJson,
  obtenerExplicacionLineas,
  consultarTutorSobreCodigo,
  LineaExplicada,
  SeccionExplicada,
} from '../core/python/pipelineGenerator';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';

export interface Step6PipelinePythonDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  algoritmoSeleccionado: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  onAvanzarAPaso7: () => void;
  onVolverAPaso5: () => void;
  deshabilitado?: boolean;
}

export function Step6PipelinePythonDS({
  fichaTecnica,
  problemaOriginal,
  algoritmoSeleccionado,
  hiperparametros,
  metricas,
  onAvanzarAPaso7,
  onVolverAPaso5,
  deshabilitado = false,
}: Step6PipelinePythonDSProps) {
  // Pestaña activa: 'script' | 'notebook' | 'explicacion'
  const [tabActiva, setTabActiva] = useState<'script' | 'notebook' | 'explicacion'>('script');

  // Generación determinística del código y notebook
  const scriptPython = useMemo(
    () =>
      generarScriptPython({
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
        hiperparametros,
      }),
    [fichaTecnica, algoritmoSeleccionado, hiperparametros]
  );

  const notebookJupyter = useMemo(
    () =>
      generarNotebookJupyter({
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
        hiperparametros,
      }),
    [fichaTecnica, algoritmoSeleccionado, hiperparametros]
  );

  const notebookJsonStr = useMemo(
    () =>
      generarNotebookJson({
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
        hiperparametros,
      }),
    [fichaTecnica, algoritmoSeleccionado, hiperparametros]
  );

  // Secciones explicadas para el modo interactivo línea por línea
  const seccionesExplicadas = useMemo(
    () => obtenerExplicacionLineas(algoritmoSeleccionado, scriptPython),
    [algoritmoSeleccionado, scriptPython]
  );

  // Estado para el modo línea por línea
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaExplicada>(() => {
    // Primera línea de la sección de modelo o escalado por defecto
    const primeraSec =
      seccionesExplicadas.find((s) => s.id === 'modelo') || seccionesExplicadas[0];
    return (
      primeraSec.lineas[0] || {
        linea: 1,
        codigo: '# Pipeline',
        conceptoClave: 'Inicialización',
        explicacion: 'Estructura inicial del pipeline.',
        categoria: 'model',
      }
    );
  });

  const seccionActivaDeLinea = useMemo<SeccionExplicada | undefined>(() => {
    return seccionesExplicadas.find((s) =>
      s.lineas.some((l) => l.linea === lineaSeleccionada.linea)
    );
  }, [seccionesExplicadas, lineaSeleccionada]);

  // Estado de copia y descargas
  const [copiado, setCopiado] = useState<boolean>(false);

  // Consulta interactiva al tutor IA
  const [consultaTutor, setConsultaTutor] = useState<string>('');
  const [respuestaTutor, setRespuestaTutor] = useState<string | null>(null);
  const [consultandoTutor, setConsultandoTutor] = useState<boolean>(false);

  const handleCopiarCodigo = async () => {
    try {
      const contenidoACopiar = tabActiva === 'notebook' ? notebookJsonStr : scriptPython;
      await navigator.clipboard.writeText(contenidoACopiar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback si clipboard falla
      setCopiado(false);
    }
  };

  const handleDescargarScriptPy = () => {
    const blob = new Blob([scriptPython], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipeline_${algoritmoSeleccionado}.py`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDescargarNotebookIpynb = () => {
    const blob = new Blob([notebookJsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `notebook_${algoritmoSeleccionado}.ipynb`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConsultarTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultaTutor.trim()) return;

    setConsultandoTutor(true);
    try {
      const respuesta = await consultarTutorSobreCodigo({
        codigo: lineaSeleccionada.codigo,
        consulta: consultaTutor.trim(),
        algoritmo: algoritmoSeleccionado,
      });
      setRespuestaTutor(respuesta);
    } catch {
      setRespuestaTutor(
        'El tutor pedagógico no pudo procesar la consulta en este momento. Por favor verificá tu conexión o modelo en la barra superior.'
      );
    } finally {
      setConsultandoTutor(false);
    }
  };

  const handleConfirmarYAvanzar = async () => {
    try {
      await registrarDecisionEnIDB({
        paso: 6,
        fecha: new Date().toISOString(),
        descripcion: `Generó y validó el pipeline Python (${algoritmoSeleccionado.toUpperCase()}) y Jupyter Notebook .ipynb.`,
        origen: 'estudiante',
      });

      await guardarProyectoEnIDB({
        id: 'proyecto-actual',
        version: 1,
        fechaCreacion: new Date().toISOString(),
        problemaOriginal,
        fichaTecnica,
        hiperparametros,
        metricas,
        bitacoraDecisiones: [],
      });
    } catch {
      // Ignora errores no bloqueantes de IDB
    }

    onAvanzarAPaso7();
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step6-title"
      data-testid="step6-container"
    >
      {/* Encabezado Unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 6 de 8</span>
        <div>
          <h2 id="step6-title" className="card-title">
            Pipeline de Código en Python (scikit-learn)
          </h2>
          <p className="step-lead">
            Generación determinística de scripts reproducibles y Jupyter Notebooks (.ipynb) listos
            para Google Colab y VS Code.
          </p>
        </div>
      </div>

      {/* Caja Conceptual Pedagógica Colapsable */}
      <details className="concept-box" data-testid="step6-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Estructuración de Pipelines en Ciencia de Datos y Reproducibilidad
        </summary>
        <div className="concept-content">
          <p>
            En la práctica profesional de la Ciencia de Datos, el código no debe ser una secuencia
            desordenada de celdas, sino un <strong>pipeline modular y reproducible</strong> que
            respete las siguientes reglas de la cátedra:
          </p>
          <ul>
            <li>
              <strong>Separación estricta de $X$:</strong> Las variables explicativas se extraen
              limpias en una matriz bidimensional. En clustering, <u>no existe columna target $Y$</u>
              , pues buscamos estructura latente sin supervisión previa.
            </li>
            <li>
              <strong>Escalado sistemático con <code>StandardScaler</code>:</strong> Los métodos de
              agrupamiento basados en distancia euclidiana (como K-Means o Jerárquico) distorsionan
              los clusters si una variable mide en millones y otra en unidades. El escalador asegura
              media $\mu = 0$ y desvío $\sigma = 1$.
            </li>
            <li>
              <strong>Fijación de semilla aleatoria (<code>random_state=42</code>):</strong> La
              inicialización de centroides (K-Means++) contiene un componente estocástico. Fijar el
              estado aleatorio asegura que cualquier colega o evaluador obtenga exactamente los
              mismos clusters.
            </li>
            <li>
              <strong>Exportabilidad universal:</strong> El formato <code>.ipynb</code> (Jupyter
              Notebook v4 JSON) permite abrir este pipeline directamente en Google Colab con un solo
              clic, sin instalar entornos locales.
            </li>
          </ul>
        </div>
      </details>

      {/* Bloque de Explicación del Tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          He generado el pipeline completo de <strong>{algoritmoSeleccionado.toUpperCase()}</strong>{' '}
          basándome en tu Ficha Técnica y tus hiperparámetros. Podés inspeccionar el script puro en{' '}
          <code>.py</code>, explorar el notebook con celdas explicativas <code>.ipynb</code> o
          utilizar el <strong>modo "Explicar línea por línea"</strong> para entender en detalle qué
          hace cada función de <code>scikit-learn</code> y <code>pandas</code>.
        </p>
      </div>

      {/* Cabecera de Tabs y Acciones */}
      <div className="code-tabs-header">
        <nav className="code-tabs-nav" aria-label="Formatos de código">
          <button
            type="button"
            className={`code-tab-btn ${tabActiva === 'script' ? 'active' : ''}`}
            data-testid="tab-script-btn"
            onClick={() => setTabActiva('script')}
          >
            🐍 Script Python (.py)
          </button>
          <button
            type="button"
            className={`code-tab-btn ${tabActiva === 'notebook' ? 'active' : ''}`}
            data-testid="tab-notebook-btn"
            onClick={() => setTabActiva('notebook')}
          >
            📓 Jupyter Notebook (.ipynb)
          </button>
          <button
            type="button"
            className={`code-tab-btn ${tabActiva === 'explicacion' ? 'active' : ''}`}
            data-testid="tab-explicacion-btn"
            onClick={() => setTabActiva('explicacion')}
          >
            🔍 Explicar Línea por Línea
          </button>
        </nav>

        <div className="code-tab-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="copy-code-btn"
            onClick={handleCopiarCodigo}
            title="Copiar código al portapapeles"
          >
            {copiado ? '✓ ¡Copiado!' : '📋 Copiar Código'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-py-btn"
            onClick={handleDescargarScriptPy}
            title="Descargar script .py para ejecutar en consola"
          >
            ⬇ Descargar .py
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-ipynb-btn"
            onClick={handleDescargarNotebookIpynb}
            title="Descargar notebook .ipynb para Google Colab o JupyterLab"
          >
            ⬇ Descargar .ipynb
          </button>
        </div>
      </div>

      {/* Contenido según la pestaña activa */}
      {tabActiva === 'script' && (
        <div className="code-viewer-container" data-testid="script-py-viewer">
          <div className="code-viewer-bar">
            <span className="code-file-tag">
              📄 pipeline_{algoritmoSeleccionado}.py
            </span>
            <span>Python 3 • scikit-learn & pandas</span>
          </div>
          <pre className="code-viewer-pre">
            <code>{scriptPython}</code>
          </pre>
        </div>
      )}

      {tabActiva === 'notebook' && (
        <div className="notebook-preview-list" data-testid="notebook-cells-viewer">
          <div className="alert alert-info" style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
            ℹ️ <strong>Vista previa estructurada:</strong> Este notebook contiene{' '}
            <strong>{notebookJupyter.cells.length} celdas</strong> (alternando teoría didáctica en
            Markdown y bloques de ejecución en Python). Al descargarlo podés subirlo a{' '}
            <a
              href="https://colab.research.google.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}
            >
              Google Colab
            </a>{' '}
            para correrlo en la nube sin configuración.
          </div>

          {notebookJupyter.cells.map((celda, idx) => (
            <div
              key={idx}
              className={`notebook-cell-item ${
                celda.cell_type === 'markdown' ? 'cell-markdown' : 'cell-code'
              }`}
              data-testid={`notebook-cell-${idx}`}
            >
              <div className="notebook-cell-badge">
                <span>
                  Celda {idx + 1} • {celda.cell_type === 'markdown' ? '📝 Markdown Explicativo' : '⚡ Código Python'}
                </span>
                <span>{celda.cell_type === 'code' ? '[ ]' : ''}</span>
              </div>
              <div className="notebook-cell-content">
                {celda.cell_type === 'markdown' ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{celda.source.join('')}</div>
                ) : (
                  <pre>
                    <code>{celda.source.join('')}</code>
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tabActiva === 'explicacion' && (
        <div className="line-by-line-layout" data-testid="line-by-line-mode">
          {/* Lista interactiva de código */}
          <div className="code-interactive-list">
            {seccionesExplicadas.map((seccion) => (
              <div key={seccion.id} className="code-interactive-section">
                <div className="code-interactive-section-header">
                  <span>{seccion.icono}</span>
                  <span>{seccion.titulo}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    ({seccion.lineas.length} líneas)
                  </span>
                </div>
                {seccion.lineas.map((item) => {
                  const estaActiva = lineaSeleccionada.linea === item.linea;
                  return (
                    <div
                      key={item.linea}
                      className={`code-interactive-row ${estaActiva ? 'active' : ''}`}
                      onClick={() => {
                        setLineaSeleccionada(item);
                        setRespuestaTutor(null);
                      }}
                      data-testid={`code-line-${item.linea}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setLineaSeleccionada(item);
                        }
                      }}
                    >
                      <span className="code-gutter-num">{item.linea}</span>
                      <span className="code-row-text">{item.codigo}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Panel Lateral de Explicación y Pregunta Socrática */}
          <div className="explanation-side-card" data-testid="line-explanation-panel">
            <div>
              <span className="explanation-concept-badge">
                💡 {lineaSeleccionada.conceptoClave}
              </span>
              <h4 style={{ margin: '0.5rem 0 0.2rem', fontSize: '0.95rem' }}>
                Línea {lineaSeleccionada.linea}: Explicación Didáctica
              </h4>
            </div>

            <div
              style={{
                background: '#070b14',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.4rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <code style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>
                {lineaSeleccionada.codigo}
              </code>
            </div>

            <p style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.55 }}>
              {lineaSeleccionada.explicacion}
            </p>

            {seccionActivaDeLinea && (
              <div className="socratic-question-box">
                <strong>🤔 Pregunta Socrática para reflexionar:</strong>
                <p style={{ margin: '0.35rem 0 0', fontStyle: 'italic' }}>
                  {seccionActivaDeLinea.preguntaSocratica}
                </p>
              </div>
            )}

            {/* Consulta interactiva al tutor */}
            <div className="ask-tutor-container">
              <label
                htmlFor="ask-tutor-input"
                style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)' }}
              >
                ¿Tenés una duda sobre esta línea o concepto?
              </label>
              <form onSubmit={handleConsultarTutor} className="ask-tutor-form">
                <input
                  id="ask-tutor-input"
                  data-testid="ask-tutor-input"
                  type="text"
                  className="input input-sm ask-tutor-input"
                  placeholder="Ej: ¿Por qué StandardScaler y no MinMaxScaler?"
                  value={consultaTutor}
                  onChange={(e) => setConsultaTutor(e.target.value)}
                  disabled={consultandoTutor}
                />
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  data-testid="ask-tutor-submit-btn"
                  disabled={consultandoTutor || !consultaTutor.trim()}
                >
                  {consultandoTutor ? 'Pensando...' : 'Preguntar'}
                </button>
              </form>

              {respuestaTutor && (
                <div className="ask-tutor-response-box" data-testid="ask-tutor-response">
                  <strong>Respuesta del Tutor IA:</strong>
                  <div style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap' }}>
                    {respuestaTutor}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navegación Inferior Estándar */}
      <div className="button-group mt-4">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onVolverAPaso5}
          disabled={deshabilitado}
        >
          ← Volver al Paso 5 (Hiperparámetros)
        </button>

        <button
          type="button"
          className="btn btn-primary"
          data-testid="confirm-step6-btn"
          onClick={handleConfirmarYAvanzar}
          disabled={deshabilitado}
        >
          Confirmar Pipeline y Avanzar al Paso 7 (Ejecución WASM) →
        </button>
      </div>
    </section>
  );
}
