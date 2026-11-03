import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
} from '../core/schemas';
import {
  generarDatasetSintetico,
  convertirADatasetCSV,
} from '../core/sampleDataset';
import { generarScriptPython } from '../core/python/pipelineGenerator';
import {
  ejecutarPipelinePyodide,
  ejecutarPipelineFallbackLocal,
  PuntoCluster2D,
  ResultadoEjecucionPipeline,
} from '../core/workers/pyodideClient';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';

export interface Step7EjecucionWasmDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  algoritmoSeleccionado: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  onActualizarMetricas?: (metricas: MetricasEvaluacion) => void;
  onAvanzarAPaso8: () => void;
  onVolverAPaso6: () => void;
  deshabilitado?: boolean;
}

const PALETA_COLORES_CLUSTERS = [
  '#38bdf8', // Cyan
  '#818cf8', // Indigo
  '#34d399', // Esmeralda
  '#f472b6', // Rosa
  '#fbbf24', // Ámbar
  '#a78bfa', // Violeta
  '#fb923c', // Naranja
  '#2dd4bf', // Teal
];

export function Step7EjecucionWasmDS({
  fichaTecnica,
  problemaOriginal,
  algoritmoSeleccionado,
  hiperparametros,
  metricas: _metricas,
  onActualizarMetricas,
  onAvanzarAPaso8,
  onVolverAPaso6,
  deshabilitado = false,
}: Step7EjecucionWasmDSProps) {
  const [ejecutando, setEjecutando] = useState<boolean>(false);
  const [mensajeEstado, setMensajeEstado] = useState<string>('Listo para ejecutar');
  const [seedDataset, setSeedDataset] = useState<number>(42);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<PuntoCluster2D | null>(null);

  // Obtener nombres de las dos variables explicativas principales para la proyección 2D
  const varsCuantitativas = useMemo(() => {
    const cuantitativas = fichaTecnica.variables.filter(
      (v) =>
        (v.rol === 'feature' || v.rol === 'target') &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
    );
    return cuantitativas.length >= 2 ? cuantitativas : fichaTecnica.variables;
  }, [fichaTecnica]);

  const nombreEjeX = varsCuantitativas[0]?.nombre || 'Feature_1';
  const nombreEjeY = varsCuantitativas[1]?.nombre || varsCuantitativas[0]?.nombre || 'Feature_2';

  // Dataset sintético actual
  const filasDataset = useMemo(
    () => generarDatasetSintetico(fichaTecnica, 120, seedDataset),
    [fichaTecnica, seedDataset]
  );

  const datasetCSV = useMemo(
    () => convertirADatasetCSV(filasDataset),
    [filasDataset]
  );

  const scriptPython = useMemo(
    () =>
      generarScriptPython({
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
        hiperparametros,
      }),
    [fichaTecnica, algoritmoSeleccionado, hiperparametros]
  );

  // Resultado de ejecución inicial o previa
  const [resultado, setResultado] = useState<ResultadoEjecucionPipeline>(() =>
    ejecutarPipelineFallbackLocal({
      fichaTecnica,
      algoritmo: algoritmoSeleccionado,
      hiperparametros,
    })
  );

  // Función para ejecutar el pipeline
  const ejecutarPipeline = useCallback(async () => {
    setEjecutando(true);
    setMensajeEstado('Iniciando entorno WebAssembly...');

    try {
      const res = await ejecutarPipelinePyodide({
        code: scriptPython,
        csvData: datasetCSV,
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
        hiperparametros,
        onProgress: (msg) => setMensajeEstado(msg),
      });

      setResultado(res);
      setMensajeEstado(
        res.esSimulado
          ? '✓ Ejecución determinística completada (modo simulación local)'
          : '✓ Ejecución en Pyodide WASM completada con éxito'
      );

      if (onActualizarMetricas) {
        onActualizarMetricas({
          inercia: res.metricas.inercia,
          silhouetteScore: res.metricas.silueta,
          numeroClustersIdentificados: res.metricas.numeroClusters,
          porcentajeRuido: res.metricas.porcentajeRuido,
        });
      }
    } catch {
      // Fallback determinístico seguro
      const fallback = ejecutarPipelineFallbackLocal({
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
        hiperparametros,
      });
      setResultado(fallback);
      setMensajeEstado('✓ Ejecución completada mediante fallback local');
    } finally {
      setEjecutando(false);
    }
  }, [scriptPython, datasetCSV, fichaTecnica, algoritmoSeleccionado, hiperparametros, onActualizarMetricas]);

  // Si cambia la semilla (regenerar datos), re-ejecutar
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    void ejecutarPipeline();
  }, [seedDataset]);

  // Coordenadas normalizadas para el SVG (viewBox 0 0 600 420)
  const svgBounds = useMemo(() => {
    const puntos = resultado.puntos2D;
    if (puntos.length === 0) return { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    puntos.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    if (resultado.centroides2D) {
      resultado.centroides2D.forEach((c) => {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
      });
    }

    const padX = (maxX - minX) * 0.1 || 5;
    const padY = (maxY - minY) * 0.1 || 5;

    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [resultado.puntos2D, resultado.centroides2D]);

  const mapToSvg = useCallback(
    (x: number, y: number) => {
      const w = 600;
      const h = 400;
      const padding = { top: 35, right: 35, bottom: 50, left: 65 };

      const innerWidth = w - padding.left - padding.right;
      const innerHeight = h - padding.top - padding.bottom;

      const normX = (x - svgBounds.minX) / (svgBounds.maxX - svgBounds.minX || 1);
      const normY = (y - svgBounds.minY) / (svgBounds.maxY - svgBounds.minY || 1);

      const svgX = padding.left + normX * innerWidth;
      const svgY = padding.top + (1 - normY) * innerHeight;

      return { svgX, svgY };
    },
    [svgBounds]
  );

  const handleConfirmarYAvanzar = async () => {
    try {
      await registrarDecisionEnIDB({
        paso: 7,
        fecha: new Date().toISOString(),
        descripcion: `Ejecutó y validó el modelo ${algoritmoSeleccionado.toUpperCase()} en WASM. Silueta: ${resultado.metricas.silueta.toFixed(4)}, Clusters: ${resultado.metricas.numeroClusters}.`,
        origen: 'estudiante',
      });

      await guardarProyectoEnIDB({
        id: 'proyecto-actual',
        version: 1,
        fechaCreacion: new Date().toISOString(),
        problemaOriginal,
        fichaTecnica,
        hiperparametros,
        metricas: {
          inercia: resultado.metricas.inercia,
          silhouetteScore: resultado.metricas.silueta,
          numeroClustersIdentificados: resultado.metricas.numeroClusters,
          porcentajeRuido: resultado.metricas.porcentajeRuido,
        },
        bitacoraDecisiones: [],
      });
    } catch {
      // Ignora errores no bloqueantes de IDB
    }

    onAvanzarAPaso8();
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step7-title"
      data-testid="step7-container"
    >
      {/* Encabezado Unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 7 de 8</span>
        <div>
          <h2 id="step7-title" className="card-title">
            Ejecución WASM y Visualización de Clusters (2D)
          </h2>
          <p className="step-lead">
            Ejecución real de Python en tu navegador con Pyodide (WebAssembly) sin enviar datos a
            servidores externos.
          </p>
        </div>
      </div>

      {/* Caja Conceptual Pedagógica */}
      <details className="concept-box" data-testid="step7-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Interpretación Visual, Centroides y Detección de Ruido
        </summary>
        <div className="concept-content">
          <p>
            Al proyectar los datos sobre el plano cartesiano de dos variables clave, podemos
            contrastar los supuestos teóricos del algoritmo elegido frente a la distribución real:
          </p>
          <ul>
            <li>
              <strong>Centroides en K-Means (marca 'X' roja):</strong> Representan la media o
              baricentro del cluster. Su posición busca minimizar la inercia WCSS. Verificá si están
              equilibrados o si se ven desplazados por algún valor extremo.
            </li>
            <li>
              <strong>Aislamiento de Ruido en DBSCAN (puntos grises con etiqueta -1):</strong> Puntos
              que no alcanzan el umbral <code>min_samples</code> en su radio <code>eps</code>. A
              diferencia de K-Means, DBSCAN no los fuerza dentro de ningún cluster, preservando la
              pureza de los grupos densos.
            </li>
            <li>
              <strong>Separación de Fronteras:</strong> Un Coeficiente de Silueta superior a{' '}
              <code>0.50</code> indica clusters con separación nítida; valores cercanos a{' '}
              <code>0.0</code> evidencian zonas de solapamiento donde las decisiones comerciales
              deben ser más cautelosas.
            </li>
          </ul>
        </div>
      </details>

      {/* Bloque de Explicación del Tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          Hemos ejecutado el pipeline de <strong>{algoritmoSeleccionado.toUpperCase()}</strong> en tu
          navegador con un dataset sintético coherente. En el gráfico interactivo podés hacer hover o
          clic en cada punto para ver sus valores exactos, centroides y etiquetas.
        </p>
      </div>

      {/* Barra de Control de Ejecución WASM */}
      <div className="wasm-execution-bar">
        <div className="wasm-status-group">
          <span
            className={`badge ${
              ejecutando
                ? 'badge-warning'
                : resultado.esSimulado
                  ? 'badge-info'
                  : 'badge-success'
            }`}
          >
            {ejecutando ? '⏳ Ejecutando...' : resultado.esSimulado ? '⚡ Simulación' : '⚡ WASM Listo'}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>{mensajeEstado}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="regenerate-data-btn"
            onClick={() => setSeedDataset((s) => s + 7)}
            disabled={ejecutando || deshabilitado}
            title="Genera un nuevo lote de muestras aleatorias manteniendo los supuestos"
          >
            ↻ Regenerar Datos
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="run-pipeline-btn"
            onClick={ejecutarPipeline}
            disabled={ejecutando || deshabilitado}
          >
            {ejecutando ? 'Calculando en WASM...' : '▶ Ejecutar Pipeline en Navegador'}
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Cuantitativas Reales */}
      <div className="metricas-wasm-grid" data-testid="wasm-metrics-grid">
        <div className="metrica-wasm-card">
          <span className="metrica-wasm-lbl">Algoritmo</span>
          <span className="metrica-wasm-val" style={{ fontSize: '1.2rem' }}>
            {algoritmoSeleccionado.toUpperCase()}
          </span>
        </div>

        <div className="metrica-wasm-card">
          <span className="metrica-wasm-lbl">Clusters Identificados</span>
          <span className="metrica-wasm-val">{resultado.metricas.numeroClusters}</span>
        </div>

        <div className="metrica-wasm-card">
          <span className="metrica-wasm-lbl">Coeficiente de Silueta</span>
          <span className="metrica-wasm-val">
            {resultado.metricas.silueta.toFixed(3)}
          </span>
        </div>

        {resultado.metricas.inercia !== undefined && (
          <div className="metrica-wasm-card">
            <span className="metrica-wasm-lbl">Inercia WCSS</span>
            <span className="metrica-wasm-val">
              {resultado.metricas.inercia.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
            </span>
          </div>
        )}

        {resultado.metricas.porcentajeRuido !== undefined && (
          <div className="metrica-wasm-card">
            <span className="metrica-wasm-lbl">Ruido Detectado</span>
            <span className="metrica-wasm-val">
              {resultado.metricas.porcentajeRuido.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Grilla Principal: Scatter Plot 2D y Panel de Perfiles */}
      <div className="scatter-layout-grid">
        {/* Gráfico Interactivo de Dispersión SVG */}
        <div className="scatter-svg-wrapper">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              Proyección 2D: {nombreEjeX} vs {nombreEjeY}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {resultado.puntos2D.length} muestras proyectadas
            </span>
          </div>

          <svg
            className="scatter-svg"
            viewBox="0 0 600 400"
            data-testid="clusters-scatter-svg"
            role="img"
            aria-label="Gráfico de dispersión 2D de clusters de Machine Learning"
          >
            {/* Ejes y Cuadrícula */}
            <line x1="65" y1="350" x2="565" y2="350" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <line x1="65" y1="35" x2="65" y2="350" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

            {/* Etiquetas de Ejes */}
            <text x="315" y="388" fill="var(--text-muted)" fontSize="11" textAnchor="middle">
              {nombreEjeX}
            </text>
            <text
              x="-190"
              y="22"
              fill="var(--text-muted)"
              fontSize="11"
              textAnchor="middle"
              transform="rotate(-90)"
            >
              {nombreEjeY}
            </text>

            {/* Puntos de Datos */}
            {resultado.puntos2D.map((p) => {
              const { svgX, svgY } = mapToSvg(p.x, p.y);
              const esRuido = p.cluster === -1;
              const colorPunto = esRuido
                ? '#94a3b8'
                : PALETA_COLORES_CLUSTERS[p.cluster % PALETA_COLORES_CLUSTERS.length];
              const estaSeleccionado = puntoSeleccionado?.id === p.id;

              if (esRuido) {
                // Dibujar cruz para ruido (-1)
                return (
                  <g
                    key={`ruido-${p.id}`}
                    className="scatter-point-circle"
                    onClick={() => setPuntoSeleccionado(p)}
                    data-testid={`point-${p.id}`}
                  >
                    <line
                      x1={svgX - 4}
                      y1={svgY - 4}
                      x2={svgX + 4}
                      y2={svgY + 4}
                      stroke="#94a3b8"
                      strokeWidth="2"
                    />
                    <line
                      x1={svgX - 4}
                      y1={svgY + 4}
                      x2={svgX + 4}
                      y2={svgY - 4}
                      stroke="#94a3b8"
                      strokeWidth="2"
                    />
                  </g>
                );
              }

              return (
                <circle
                  key={`pt-${p.id}`}
                  cx={svgX}
                  cy={svgY}
                  r={estaSeleccionado ? 8 : 5}
                  fill={colorPunto}
                  stroke={estaSeleccionado ? '#ffffff' : '#070b14'}
                  strokeWidth={estaSeleccionado ? 2.5 : 1}
                  opacity={estaSeleccionado ? 1 : 0.82}
                  className="scatter-point-circle"
                  data-testid={`point-${p.id}`}
                  onClick={() => setPuntoSeleccionado(p)}
                />
              );
            })}

            {/* Centroides (K-Means) */}
            {resultado.centroides2D &&
              resultado.centroides2D.map((c) => {
                const { svgX, svgY } = mapToSvg(c.x, c.y);
                return (
                  <g key={`centroid-${c.cluster}`}>
                    {/* Resplandor circular */}
                    <circle cx={svgX} cy={svgY} r="14" fill="rgba(239, 68, 68, 0.25)" />
                    {/* Cruz X de Centroide */}
                    <line
                      x1={svgX - 8}
                      y1={svgY - 8}
                      x2={svgX + 8}
                      y2={svgY + 8}
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <line
                      x1={svgX - 8}
                      y1={svgY + 8}
                      x2={svgX + 8}
                      y2={svgY - 8}
                      stroke="#ef4444"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <text
                      x={svgX}
                      y={svgY - 14}
                      fill="#ef4444"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      C{c.cluster}
                    </text>
                  </g>
                );
              })}
          </svg>

          {/* Leyenda del Gráfico */}
          <div className="scatter-legend">
            {resultado.resumenClusters.map((r, idx) => {
              const color =
                r.cluster.toString().includes('Ruido')
                  ? '#94a3b8'
                  : PALETA_COLORES_CLUSTERS[idx % PALETA_COLORES_CLUSTERS.length];
              return (
                <div key={idx} className="scatter-legend-item">
                  <span
                    className="scatter-legend-circle"
                    style={{ backgroundColor: color }}
                  />
                  <span>
                    <strong>{r.cluster}:</strong> {r.conteo} ({r.porcentaje}%)
                  </span>
                </div>
              );
            })}
            {resultado.centroides2D && (
              <div className="scatter-legend-item">
                <span style={{ color: '#ef4444', fontWeight: 900 }}>✕</span>
                <span>Centroides</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel Lateral: Perfil y Detalle de Muestras */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Muestra Seleccionada */}
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent-cyan)',
                letterSpacing: '0.05em',
              }}
            >
              Inspección de Muestra
            </span>
            {puntoSeleccionado ? (
              <div style={{ marginTop: '0.45rem', fontSize: '0.84rem' }}>
                <p style={{ margin: '0 0 0.35rem' }}>
                  <strong>ID:</strong> #{puntoSeleccionado.id}
                </p>
                <p style={{ margin: '0 0 0.35rem' }}>
                  <strong>Asignación:</strong>{' '}
                  <span className="badge badge-info">
                    {puntoSeleccionado.cluster === -1
                      ? 'Ruido / Outlier'
                      : `Cluster ${puntoSeleccionado.cluster}`}
                  </span>
                </p>
                <p style={{ margin: '0 0 0.2rem' }}>
                  <strong>{nombreEjeX}:</strong> {puntoSeleccionado.x}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>{nombreEjeY}:</strong> {puntoSeleccionado.y}
                </p>
              </div>
            ) : (
              <p
                style={{
                  margin: '0.45rem 0 0',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)',
                }}
              >
                Hacé clic en cualquier punto del gráfico para ver sus coordenadas exactas y
                pertenencia de cluster.
              </p>
            )}
          </div>

          {/* Tabla de Medias de Clusters */}
          <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-main)',
                letterSpacing: '0.05em',
              }}
            >
              Medias por Cluster
            </span>
            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table style={{ width: '100%', fontSize: '0.78rem', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.3rem 0.4rem' }}>Grupo</th>
                    <th style={{ padding: '0.3rem 0.4rem' }}>{nombreEjeX}</th>
                    <th style={{ padding: '0.3rem 0.4rem' }}>{nombreEjeY}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.resumenClusters.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.4rem', fontWeight: 600 }}>{r.cluster}</td>
                      <td style={{ padding: '0.4rem' }}>{r.medias[nombreEjeX] ?? '-'}</td>
                      <td style={{ padding: '0.4rem' }}>{r.medias[nombreEjeY] ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Visor de Salida Terminal (stdout de Python) */}
      <div className="terminal-viewer-container" data-testid="terminal-container">
        <div className="terminal-viewer-header">
          <div className="terminal-dots">
            <span className="terminal-dot terminal-dot-red" />
            <span className="terminal-dot terminal-dot-yellow" />
            <span className="terminal-dot terminal-dot-green" />
          </div>
          <span>python3 pipeline_{algoritmoSeleccionado}.py — Captura de Consola (stdout)</span>
          <span style={{ fontSize: '0.7rem' }}>UTF-8</span>
        </div>
        <pre className="terminal-viewer-body" data-testid="python-stdout-viewer">
          {resultado.stdout || 'Esperando ejecución del script...'}
        </pre>
      </div>

      {/* Navegación Inferior Estándar */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onVolverAPaso6}
          disabled={ejecutando || deshabilitado}
        >
          ← Volver al Paso 6 (Pipeline Python)
        </button>

        <button
          type="button"
          className="btn btn-primary"
          data-testid="confirm-step7-btn"
          onClick={handleConfirmarYAvanzar}
          disabled={ejecutando || deshabilitado}
        >
          Confirmar Resultados y Avanzar al Paso 8 (Perfilado BI) →
        </button>
      </div>
    </section>
  );
}
