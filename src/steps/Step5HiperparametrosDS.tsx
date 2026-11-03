import { useState, useMemo } from 'react';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
} from '../core/schemas';
import {
  generarDiagnosticoKMeans,
  generarDiagnosticoDBSCAN,
  generarDiagnosticoJerarquico,
} from '../core/metrics/diagnostics';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';

export interface Step5HiperparametrosDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  algoritmoSeleccionado: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  onActualizarHiperparametros: (params: HiperparametrosClustering) => void;
  onActualizarMetricas?: (metricas: MetricasEvaluacion) => void;
  onAvanzarAPaso6: () => void;
  onVolverAPaso4: () => void;
  deshabilitado?: boolean;
}

export function Step5HiperparametrosDS({
  fichaTecnica,
  problemaOriginal,
  algoritmoSeleccionado,
  hiperparametros,
  onActualizarHiperparametros,
  onActualizarMetricas,
  onAvanzarAPaso6,
  onVolverAPaso4,
  deshabilitado = false,
}: Step5HiperparametrosDSProps) {
  // Estado de hiperparámetros locales
  const [kSeleccionado, setKSeleccionado] = useState<number>(() => hiperparametros?.k ?? 3);
  const [criterioEnlace, setCriterioEnlace] = useState<'ward' | 'complete' | 'average' | 'single'>(
    () => hiperparametros?.criterioEnlace ?? 'ward'
  );
  const [eps, setEps] = useState<number>(() => hiperparametros?.eps ?? 0.5);
  const [minSamples, setMinSamples] = useState<number>(() => hiperparametros?.minSamples ?? 5);
  const [tabGrafico, setTabGrafico] = useState<'codo' | 'silueta'>('codo');
  const [justificacion, setJustificacion] = useState<string>(
    () =>
      hiperparametros?.justificacionEstudiante ||
      (algoritmoSeleccionado === 'kmeans'
        ? `Seleccioné K=${kSeleccionado} porque coincide con el codo de la curva WCSS y maximiza el coeficiente de silueta.`
        : algoritmoSeleccionado === 'dbscan'
          ? `Seleccioné eps=${eps} y min_samples=${minSamples} para equilibrar la densidad y aislar el ruido.`
          : `Seleccioné K=${kSeleccionado} con enlace ${criterioEnlace} para obtener clusters compactos en el dendrograma.`)
  );
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const nFeaturesCuantitativas = useMemo(
    () =>
      fichaTecnica.variables.filter(
        (v) =>
          v.rol === 'feature' &&
          (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
      ).length,
    [fichaTecnica]
  );

  // Diagnósticos determinísticos según el algoritmo activo
  const diagKMeans = useMemo(
    () => generarDiagnosticoKMeans(nFeaturesCuantitativas),
    [nFeaturesCuantitativas]
  );
  const diagDBSCAN = useMemo(
    () => generarDiagnosticoDBSCAN(eps, minSamples),
    [eps, minSamples]
  );
  const diagJerarquico = useMemo(
    () => generarDiagnosticoJerarquico(criterioEnlace, kSeleccionado),
    [criterioEnlace, kSeleccionado]
  );

  // Métrica actual según selección
  const puntoActualKMeans = diagKMeans.puntos.find((p) => p.k === kSeleccionado) || diagKMeans.puntos[1];
  const siluetaActual =
    algoritmoSeleccionado === 'kmeans'
      ? puntoActualKMeans.silhouette
      : algoritmoSeleccionado === 'dbscan'
        ? diagDBSCAN.silhouette
        : diagJerarquico.silhouette;

  const inerciaActual = algoritmoSeleccionado === 'kmeans' ? puntoActualKMeans.inercia : undefined;
  const clustersActuales =
    algoritmoSeleccionado === 'dbscan' ? diagDBSCAN.clustersEstimados : kSeleccionado;

  const handleConfirmarYAvanzar = async () => {
    if (!justificacion.trim() || justificacion.trim().length < 5) {
      setErrorLocal('Por favor ingresá una fundamentación de tus hiperparámetros elegidos.');
      return;
    }

    const nuevosHiperparametros: HiperparametrosClustering = {
      algoritmo: algoritmoSeleccionado,
      k: algoritmoSeleccionado !== 'dbscan' ? kSeleccionado : undefined,
      criterioEnlace: algoritmoSeleccionado === 'jerarquico' ? criterioEnlace : undefined,
      eps: algoritmoSeleccionado === 'dbscan' ? eps : undefined,
      minSamples: algoritmoSeleccionado === 'dbscan' ? minSamples : undefined,
      randomState: 42,
      justificacionEstudiante: justificacion.trim(),
    };

    const metricasCalculadas: MetricasEvaluacion = {
      inercia: inerciaActual,
      silhouetteScore: siluetaActual,
      numeroClustersIdentificados: clustersActuales,
      porcentajeRuido:
        algoritmoSeleccionado === 'dbscan' ? diagDBSCAN.porcentajeRuido : undefined,
    };

    try {
      onActualizarHiperparametros(nuevosHiperparametros);
      if (onActualizarMetricas) {
        onActualizarMetricas(metricasCalculadas);
      }

      await registrarDecisionEnIDB({
        paso: 5,
        fecha: new Date().toISOString(),
        descripcion: `Configuró hiperparámetros (${algoritmoSeleccionado.toUpperCase()} - ${
          algoritmoSeleccionado === 'dbscan'
            ? `eps=${eps}, min_samples=${minSamples}`
            : `K=${kSeleccionado}`
        }) con Coeficiente de Silueta = ${siluetaActual}.`,
        origen: 'estudiante',
      });

      await guardarProyectoEnIDB({
        id: 'proyecto-actual',
        version: 1,
        fechaCreacion: new Date().toISOString(),
        problemaOriginal,
        fichaTecnica,
        hiperparametros: nuevosHiperparametros,
        metricas: metricasCalculadas,
        bitacoraDecisiones: [],
      });

      onAvanzarAPaso6();
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Error al guardar los hiperparámetros.'
      );
    }
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step5-title"
      data-testid="step5-container"
    >
      {/* Encabezado unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 5 de 8</span>
        <div>
          <h2 id="step5-title" className="card-title">
            Ajuste de Hiperparámetros y Diagnóstico
          </h2>
          <p className="step-lead">
            Calibración técnica de hiperparámetros e interpretación de Inercia WCSS, Silueta y Dendrogramas.
          </p>
        </div>
      </div>

      {/* Caja conceptual pedagógica */}
      <details className="concept-box" data-testid="step5-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Método del Codo, Coeficiente de Silueta y Criterios de Diagnóstico
        </summary>
        <div className="concept-content">
          <p>
            <strong>Método del Codo (Elbow Method):</strong> Grafica la <em>Inercia intra-cluster (WCSS)</em> en función de $K$. La inercia siempre disminuye al aumentar $K$; el punto óptimo (el "codo") es aquel donde agregar un cluster adicional ya no produce una ganancia sustancial en la compactación.
          </p>
          <p>
            <strong>Coeficiente de Silueta ($s$):</strong> Mide simultáneamente cuán parecido es un punto a su propio cluster (cohesión $a$) comparado con el cluster más cercano (separación $b$), con valores en $[-1, +1]$:
          </p>
          <ul>
            <li>
              <strong>$s &gt; 0.50$:</strong> Estructura de clusters sólida y natural bien diferenciada.
            </li>
            <li>
              <strong>$0.25 \le s \le 0.50$:</strong> Estructura razonable con solapamiento leve en los bordes.
            </li>
            <li>
              <strong>$s &lt; 0.25$:</strong> Estructura débil o clusters forzados artificialmente.
            </li>
          </ul>
        </div>
      </details>

      {/* Explicación del tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          {algoritmoSeleccionado === 'kmeans' && diagKMeans.explicacion}
          {algoritmoSeleccionado === 'dbscan' && diagDBSCAN.explicacion}
          {algoritmoSeleccionado === 'jerarquico' && diagJerarquico.explicacion}
        </p>
      </div>

      {/* Visualizadores y Controles Específicos por Algoritmo */}

      {/* CASO 1: K-MEANS */}
      {algoritmoSeleccionado === 'kmeans' && (
        <div className="entity-card" data-testid="kmeans-diagnostics-card">
          <div className="entity-card-header">
            <div>
              <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                📈 Diagnóstico de K-Means: Método del Codo y Gráfico de Silueta
              </h3>
              <p className="step-lead" style={{ fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
                Hacé clic en los puntos del gráfico o utilizá el control deslizante para ajustar $K$.
              </p>
            </div>

            <div className="button-group" style={{ margin: 0 }}>
              <button
                type="button"
                className={`btn btn-sm ${tabGrafico === 'codo' ? 'btn-primary' : 'btn-secondary'}`}
                data-testid="tab-codo-btn"
                onClick={() => setTabGrafico('codo')}
              >
                Inercia WCSS (Codo)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${tabGrafico === 'silueta' ? 'btn-primary' : 'btn-secondary'}`}
                data-testid="tab-silueta-btn"
                onClick={() => setTabGrafico('silueta')}
              >
                Coeficiente de Silueta
              </button>
            </div>
          </div>

          {/* Gráfico SVG Puro Sanitizado */}
          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <svg
              viewBox="0 0 600 280"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              data-testid="codo-svg-chart"
              role="img"
              aria-label="Gráfico de diagnóstico de clustering"
            >
              {/* Ejes y cuadrícula */}
              <line x1="60" y1="20" x2="60" y2="240" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1" />
              <line x1="60" y1="240" x2="570" y2="240" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="1" />

              {/* Título y leyenda del eje */}
              <text x="315" y="270" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
                Número de Clusters (K)
              </text>
              <text
                x="20"
                y="130"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontWeight="600"
                transform="rotate(-90 20 130)"
              >
                {tabGrafico === 'codo' ? 'Inercia intra-cluster (WCSS)' : 'Silueta promedio (-1 a 1)'}
              </text>

              {/* Vista 1: Curva del Codo */}
              {tabGrafico === 'codo' && (
                <g data-testid="curva-codo-layer">
                  {/* Línea de conexión */}
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={diagKMeans.puntos
                      .map((p) => {
                        const px = 60 + ((p.k - 2) / 8) * 500;
                        const maxInercia = diagKMeans.puntos[0].inercia;
                        const py = 240 - (p.inercia / maxInercia) * 200;
                        return `${px},${py}`;
                      })
                      .join(' ')}
                  />

                  {/* Puntos de cada K */}
                  {diagKMeans.puntos.map((p) => {
                    const px = 60 + ((p.k - 2) / 8) * 500;
                    const maxInercia = diagKMeans.puntos[0].inercia;
                    const py = 240 - (p.inercia / maxInercia) * 200;
                    const esSeleccionado = p.k === kSeleccionado;
                    const esOptimo = p.k === diagKMeans.kOptimo;

                    return (
                      <g
                        key={p.k}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setKSeleccionado(p.k)}
                        data-testid={`punto-k-${p.k}`}
                      >
                        {esSeleccionado && (
                          <circle cx={px} cy={py} r="12" fill="rgba(56, 189, 248, 0.25)" />
                        )}
                        <circle
                          cx={px}
                          cy={py}
                          r={esSeleccionado ? '7' : '5'}
                          fill={esSeleccionado ? '#38bdf8' : esOptimo ? '#10b981' : '#6366f1'}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        <text
                          x={px}
                          y={py - 12}
                          textAnchor="middle"
                          fill={esSeleccionado ? '#38bdf8' : '#e2e8f0'}
                          fontSize="11"
                          fontWeight={esSeleccionado ? '700' : '400'}
                        >
                          {Math.round(p.inercia)}
                        </text>
                        <text x={px} y="255" textAnchor="middle" fill="#cbd5e1" fontSize="11">
                          {p.k}
                        </text>
                        {esOptimo && (
                          <text
                            x={px}
                            y={py - 26}
                            textAnchor="middle"
                            fill="#10b981"
                            fontSize="10"
                            fontWeight="700"
                          >
                            ⭐ Codo
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Vista 2: Coeficiente de Silueta */}
              {tabGrafico === 'silueta' && (
                <g data-testid="silueta-layer">
                  {/* Línea de referencia umbral 0.5 */}
                  <line
                    x1="60"
                    y1={240 - 0.5 * 200}
                    x2="570"
                    y2={240 - 0.5 * 200}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />
                  <text x="565" y={240 - 0.5 * 200 - 6} textAnchor="end" fill="#10b981" fontSize="10">
                    Umbral estructura sólida (s ≥ 0.50)
                  </text>

                  {/* Barras de silueta */}
                  {diagKMeans.puntos.map((p) => {
                    const bx = 60 + ((p.k - 2) / 8) * 500 - 14;
                    const ancho = 28;
                    const altura = Math.max(4, p.silhouette * 200);
                    const by = 240 - altura;
                    const esSeleccionado = p.k === kSeleccionado;
                    const colorBarra =
                      p.silhouette >= 0.5
                        ? esSeleccionado
                          ? '#38bdf8'
                          : '#10b981'
                        : p.silhouette >= 0.25
                          ? '#f59e0b'
                          : '#ef4444';

                    return (
                      <g
                        key={p.k}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setKSeleccionado(p.k)}
                        data-testid={`barra-silueta-${p.k}`}
                      >
                        <rect
                          x={bx}
                          y={by}
                          width={ancho}
                          height={altura}
                          rx="4"
                          fill={colorBarra}
                          opacity={esSeleccionado ? 1 : 0.8}
                          stroke={esSeleccionado ? '#ffffff' : 'none'}
                          strokeWidth="2"
                        />
                        <text
                          x={bx + ancho / 2}
                          y={by - 6}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="10"
                          fontWeight="700"
                        >
                          {p.silhouette.toFixed(2)}
                        </text>
                        <text x={bx + ancho / 2} y="255" textAnchor="middle" fill="#cbd5e1" fontSize="11">
                          {p.k}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </svg>
          </div>

          {/* Selector de K con Slider e Indicadores */}
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-tile">
              <span className="stat-label">Número de Clusters Seleccionado (K)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  data-testid="k-slider"
                  value={kSeleccionado}
                  onChange={(e) => setKSeleccionado(Number(e.target.value))}
                  disabled={deshabilitado}
                  style={{ flex: 1 }}
                />
                <span className="stat-value" data-testid="k-value-display">
                  K = {kSeleccionado}
                </span>
              </div>
            </div>

            <div className="stat-tile">
              <span className="stat-label">Métricas del Modelo para K = {kSeleccionado}</span>
              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.35rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Inercia WCSS:</span>
                  <div className="stat-value" style={{ fontSize: '1.1rem' }}>
                    {puntoActualKMeans.inercia}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Silueta Promedio:</span>
                  <div
                    className="stat-value"
                    data-testid="silhouette-value-display"
                    style={{
                      fontSize: '1.1rem',
                      color: siluetaActual >= 0.5 ? '#10b981' : siluetaActual >= 0.25 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {siluetaActual.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASO 2: DBSCAN */}
      {algoritmoSeleccionado === 'dbscan' && (
        <div className="entity-card" data-testid="dbscan-diagnostics-card">
          <div className="entity-card-header">
            <div>
              <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                🌌 Calibración de Hiperparámetros de DBSCAN (eps y min_samples)
              </h3>
              <p className="step-lead" style={{ fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
                Ajustá la distancia de vecindad ($eps$) y la densidad mínima ($min\_samples$) para segmentar y aislar el ruido.
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <svg
              viewBox="0 0 500 340"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              data-testid="dbscan-density-svg"
              role="img"
              aria-label="Visualización de densidades en DBSCAN"
            >
              {/* Puntos simulados de semilunas y ruido */}
              {diagDBSCAN.puntosSimulados.map((p) => {
                const esRuido = p.tipo === 'noise' || p.cluster === -1;
                const color = esRuido
                  ? '#ef4444'
                  : p.cluster === 0
                    ? '#38bdf8'
                    : '#10b981';

                return (
                  <circle
                    key={p.id}
                    cx={p.x}
                    cy={p.y}
                    r={esRuido ? '5' : '6'}
                    fill={color}
                    stroke={esRuido ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                    strokeWidth="1.5"
                  />
                );
              })}

              {/* Leyenda de clusters DBSCAN */}
              <g transform="translate(20, 20)">
                <circle cx="10" cy="10" r="5" fill="#38bdf8" />
                <text x="22" y="14" fill="#cbd5e1" fontSize="11">Cluster 0 (Semiluna Sup)</text>
                <circle cx="170" cy="10" r="5" fill="#10b981" />
                <text x="182" y="14" fill="#cbd5e1" fontSize="11">Cluster 1 (Semiluna Inf)</text>
                <circle cx="330" cy="10" r="5" fill="#ef4444" />
                <text x="342" y="14" fill="#fca5a5" fontSize="11">Etiqueta -1 (Ruido/Outliers)</text>
              </g>
            </svg>
          </div>

          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-tile">
              <span className="stat-label">Distancia de Vecindad (eps)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  data-testid="eps-slider"
                  value={eps}
                  onChange={(e) => setEps(Number(e.target.value))}
                  disabled={deshabilitado}
                  style={{ flex: 1 }}
                />
                <span className="stat-value" data-testid="eps-display">
                  {eps.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="stat-tile">
              <span className="stat-label">Mínimo de Puntos (min_samples)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                <input
                  type="range"
                  min={2}
                  max={10}
                  step={1}
                  data-testid="min-samples-slider"
                  value={minSamples}
                  onChange={(e) => setMinSamples(Number(e.target.value))}
                  disabled={deshabilitado}
                  style={{ flex: 1 }}
                />
                <span className="stat-value" data-testid="min-samples-display">
                  {minSamples}
                </span>
              </div>
            </div>

            <div className="stat-tile">
              <span className="stat-label">Clusters Identificados</span>
              <span className="stat-value" data-testid="dbscan-clusters-display">
                {diagDBSCAN.clustersEstimados} grupos
              </span>
            </div>

            <div className="stat-tile">
              <span className="stat-label">Porcentaje de Ruido / Anomalías (-1)</span>
              <span
                className="stat-value"
                data-testid="dbscan-noise-display"
                style={{ color: diagDBSCAN.porcentajeRuido > 10 ? '#ef4444' : '#f59e0b' }}
              >
                {diagDBSCAN.porcentajeRuido}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CASO 3: CLUSTERING JERÁRQUICO */}
      {algoritmoSeleccionado === 'jerarquico' && (
        <div className="entity-card" data-testid="jerarquico-diagnostics-card">
          <div className="entity-card-header">
            <div>
              <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                🌳 Criterio de Enlace y Dendrograma Aglomerativo
              </h3>
              <p className="step-lead" style={{ fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
                Elegí el criterio de distancia entre grupos y ajustá la altura de corte para definir $K$.
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <svg
              viewBox="0 0 500 280"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              data-testid="dendrogram-svg"
              role="img"
              aria-label="Dendrograma aglomerativo"
            >
              {/* Ramas del árbol */}
              {diagJerarquico.ramas.map((r) => (
                <g key={r.id}>
                  <line x1={r.x1} y1={r.y} x2={r.x2} y2={r.y} stroke="#6366f1" strokeWidth="2" />
                  <line x1={r.x1} y1={r.y} x2={r.x1} y2={r.y - r.altura} stroke="#6366f1" strokeWidth="2" />
                  <line x1={r.x2} y1={r.y} x2={r.x2} y2={r.y - r.altura} stroke="#6366f1" strokeWidth="2" />
                </g>
              ))}

              {/* Línea horizontal de corte */}
              <line
                x1="40"
                y1={diagJerarquico.alturaCorte}
                x2="460"
                y2={diagJerarquico.alturaCorte}
                stroke="#ef4444"
                strokeDasharray="5 5"
                strokeWidth="2"
              />
              <text
                x="455"
                y={diagJerarquico.alturaCorte - 6}
                textAnchor="end"
                fill="#fca5a5"
                fontSize="11"
                fontWeight="700"
              >
                Corte = K={kSeleccionado} (Distancia = {diagJerarquico.alturaCorte})
              </text>
            </svg>
          </div>

          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-tile">
              <label htmlFor="linkage-select" className="stat-label">
                Criterio de Enlace (Linkage)
              </label>
              <select
                id="linkage-select"
                data-testid="linkage-select"
                className="select-input"
                style={{ marginTop: '0.35rem' }}
                value={criterioEnlace}
                onChange={(e) =>
                  setCriterioEnlace(
                    e.target.value as 'ward' | 'complete' | 'average' | 'single'
                  )
                }
                disabled={deshabilitado}
              >
                <option value="ward">Ward (Mínima varianza intra-cluster - Recomendado)</option>
                <option value="complete">Complete (Distancia máxima)</option>
                <option value="average">Average (Distancia promedio)</option>
                <option value="single">Single (Distancia mínima - Riesgo encadenamiento)</option>
              </select>
            </div>

            <div className="stat-tile">
              <span className="stat-label">Número de Familias al Corte (K)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  data-testid="jerarquico-k-slider"
                  value={kSeleccionado}
                  onChange={(e) => setKSeleccionado(Number(e.target.value))}
                  disabled={deshabilitado}
                  style={{ flex: 1 }}
                />
                <span className="stat-value">K = {kSeleccionado}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Justificación Pedagógica del Estudiante */}
      <div className="entity-card" style={{ marginTop: '1rem' }}>
        <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
          ✍️ Justificación de Hiperparámetros Seleccionados
        </h3>
        <p className="step-lead" style={{ fontSize: '0.82rem', margin: '0 0 0.5rem' }}>
          Argumentá con base en las métricas de diagnóstico (Codo, Silueta, % Ruido o Dendrograma) por qué elegiste esta configuración.
        </p>
        <textarea
          data-testid="hyperparams-justification-input"
          className="textarea-input"
          rows={3}
          value={justificacion}
          onChange={(e) => {
            setJustificacion(e.target.value);
            setErrorLocal(null);
          }}
          disabled={deshabilitado}
        />
      </div>

      {errorLocal && (
        <div className="alert alert-error" role="alert" data-testid="step5-error">
          ⚠️ {errorLocal}
        </div>
      )}

      {/* Navegación Inferior Unificada */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="back-to-step4-btn"
          onClick={onVolverAPaso4}
          disabled={deshabilitado}
        >
          ← Volver al Paso 4 (Algoritmo)
        </button>
        <button
          type="button"
          className="btn btn-primary btn-glow"
          data-testid="confirm-step5-btn"
          onClick={handleConfirmarYAvanzar}
          disabled={deshabilitado}
        >
          Confirmar Hiperparámetros y Avanzar al Paso 6 (Pipeline Python) →
        </button>
      </div>
    </section>
  );
}
