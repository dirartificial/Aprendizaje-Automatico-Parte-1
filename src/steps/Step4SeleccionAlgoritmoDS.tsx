import { useState } from 'react';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
} from '../core/schemas';
import {
  validarModeloDS,
  resolverAdvertenciaPedagogica,
  AdvertenciaValidacionDS,
} from '../core/modelValidatorDS';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';
import { consultarTutorContextualDS } from '../core/clarityDS';

export interface Step4SeleccionAlgoritmoDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  algoritmoSeleccionado: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  onActualizarAlgoritmo: (algoritmo: AlgoritmoClustering) => void;
  onActualizarFichaTecnica: (ficha: FichaTecnicaDS) => void;
  onActualizarHiperparametros: (params: HiperparametrosClustering) => void;
  onAvanzarAPaso5: () => void;
  onVolverAPaso3: () => void;
  deshabilitado?: boolean;
}

interface AlgoritmoCardInfo {
  id: AlgoritmoClustering;
  nombre: string;
  icono: string;
  subtitulo: string;
  supuestoGeom: string;
  sensibilidadOutliers: string;
  ventajas: string[];
  desventajas: string[];
}

const ALGORITMOS_INFO: AlgoritmoCardInfo[] = [
  {
    id: 'kmeans',
    nombre: 'K-Means (k-medias)',
    icono: '⚪',
    subtitulo: 'Particionamiento basado en centroides',
    supuestoGeom: 'Clusters esféricos / convexos de varianza similar',
    sensibilidadOutliers: 'Alta (Los outliers arrastran los centroides)',
    ventajas: [
      'Rápido y escalable a millones de registros',
      'Fácil interpretación matemática y de centroides',
      'Excelente punto de partida para segmentaciones comerciales',
    ],
    desventajas: [
      'Requiere definir el número de clusters K a priori',
      'Falla ante geometrías arbitrarias (lunas, anillos concéntricos)',
      'Exige escalado estricto (StandardScaler)',
    ],
  },
  {
    id: 'jerarquico',
    nombre: 'Clustering Jerárquico Aglomerativo',
    icono: '🌳',
    subtitulo: 'Árbol taxonómico aglomerativo con dendrograma',
    supuestoGeom: 'Estructuras de anidamiento y relaciones jerárquicas',
    sensibilidadOutliers: 'Moderada (Depende del criterio de enlace)',
    ventajas: [
      'No exige definir K antes de iniciar; se define al cortar el dendrograma',
      'Visualización intuitiva de familias y subfamilias',
      'Admite diferentes distancias y criterios de enlace (Ward, Complete, etc.)',
    ],
    desventajas: [
      'Costo computacional y de memoria elevado: O(N²)',
      'Inviable para datasets masivos (> 10.000 observaciones)',
      'No reasigna puntos una vez fusionados en el árbol',
    ],
  },
  {
    id: 'dbscan',
    nombre: 'DBSCAN (Basado en Densidad)',
    icono: '🌌',
    subtitulo: 'Agrupamiento espacial basado en densidad con filtro de ruido',
    supuestoGeom: 'Geometrías de densidad arbitraria (semilunas, anillos, curvas)',
    sensibilidadOutliers: 'Muy baja (Aísla automáticamente el ruido con etiqueta -1)',
    ventajas: [
      'Descubre formas geométricas complejas no lineales',
      'No requiere definir K a priori',
      'Detecta y separa anomalías y ruido de forma nativa',
    ],
    desventajas: [
      'Sensible a la calibración de eps y min_samples',
      'Dificultad con clusters de densidades muy dispares',
      'No apto cuando las distancias no son continuas o están mal calibradas',
    ],
  },
];

function redactarJustificacionContextual(
  algoritmo: AlgoritmoClustering,
  fichaTecnica: FichaTecnicaDS
): string {
  const vars = fichaTecnica.variables
    .filter((v) => v.rol === 'feature')
    .map((v) => v.nombre)
    .join(', ');

  if (algoritmo === 'kmeans') {
    return `Seleccioné K-Means sobre las variables escaladas (${vars}) para identificar centroides representativos y segmentar los registros en grupos compactos.`;
  }
  if (algoritmo === 'dbscan') {
    return `Seleccioné DBSCAN sobre (${vars}) para capturar regiones de densidad variable y aislar automáticamente las lecturas atípicas o ruido con etiqueta -1.`;
  }
  return `Seleccioné Clustering Jerárquico Aglomerativo sobre (${vars}) para analizar la estructura de fusiones taxonómicas mediante el dendrograma.`;
}

export function Step4SeleccionAlgoritmoDS({
  fichaTecnica,
  problemaOriginal,
  algoritmoSeleccionado,
  hiperparametros,
  onActualizarAlgoritmo,
  onActualizarFichaTecnica,
  onActualizarHiperparametros,
  onAvanzarAPaso5,
  onVolverAPaso3,
  deshabilitado = false,
}: Step4SeleccionAlgoritmoDSProps) {
  const [justificacion, setJustificacion] = useState<string>(() => {
    if (hiperparametros?.justificacionEstudiante) {
      return hiperparametros.justificacionEstudiante;
    }
    return redactarJustificacionContextual(algoritmoSeleccionado, fichaTecnica);
  });

  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [consultandoIA, setConsultandoIA] = useState<boolean>(false);
  const [explicacionTutor, setExplicacionTutor] = useState<string | null>(null);

  // Ejecución de las 5 reglas determinísticas
  const advertencias: AdvertenciaValidacionDS[] = validarModeloDS(
    fichaTecnica,
    algoritmoSeleccionado
  );

  const handleSeleccionarAlgoritmo = (algoritmo: AlgoritmoClustering) => {
    onActualizarAlgoritmo(algoritmo);
    setJustificacion(redactarJustificacionContextual(algoritmo, fichaTecnica));
    setErrorLocal(null);

    void registrarDecisionEnIDB({
      paso: 4,
      fecha: new Date().toISOString(),
      descripcion: `Seleccionó el algoritmo: ${algoritmo.toUpperCase()}.`,
      origen: 'estudiante',
    });
  };

  const handleConsultarTutorAlgoritmo = async () => {
    setConsultandoIA(true);
    try {
      const resp = await consultarTutorContextualDS({
        paso: 4,
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
      });
      setExplicacionTutor(resp);
      setJustificacion(resp);
    } finally {
      setConsultandoIA(false);
    }
  };

  const handleResolverAdvertencia = (adv: AdvertenciaValidacionDS) => {
    const { fichaActualizada, nuevoAlgoritmo } = resolverAdvertenciaPedagogica(
      fichaTecnica,
      adv,
      algoritmoSeleccionado
    );

    if (fichaActualizada !== fichaTecnica) {
      onActualizarFichaTecnica(fichaActualizada);
    }
    if (nuevoAlgoritmo !== algoritmoSeleccionado) {
      onActualizarAlgoritmo(nuevoAlgoritmo);
      setJustificacion(redactarJustificacionContextual(nuevoAlgoritmo, fichaActualizada));
    }

    void registrarDecisionEnIDB({
      paso: 4,
      fecha: new Date().toISOString(),
      descripcion: `Resolvió advertencia pedagógica "${adv.titulo}" aplicando la recomendación de la IA.`,
      origen: 'ia_aceptada',
    });
  };

  const handleConfirmarYAvanzar = async () => {
    if (!justificacion.trim() || justificacion.trim().length < 5) {
      setErrorLocal('Por favor escribí una breve justificación de tu elección de algoritmo.');
      return;
    }

    const nuevosParams: HiperparametrosClustering = {
      algoritmo: algoritmoSeleccionado,
      k: algoritmoSeleccionado !== 'dbscan' ? hiperparametros?.k ?? 3 : undefined,
      criterioEnlace:
        algoritmoSeleccionado === 'jerarquico'
          ? hiperparametros?.criterioEnlace ?? 'ward'
          : undefined,
      eps: algoritmoSeleccionado === 'dbscan' ? hiperparametros?.eps ?? 0.5 : undefined,
      minSamples:
        algoritmoSeleccionado === 'dbscan' ? hiperparametros?.minSamples ?? 5 : undefined,
      randomState: 42,
      justificacionEstudiante: justificacion.trim(),
    };

    try {
      onActualizarHiperparametros(nuevosParams);

      await registrarDecisionEnIDB({
        paso: 4,
        fecha: new Date().toISOString(),
        descripcion: `Consensuó algoritmo ${algoritmoSeleccionado.toUpperCase()} con justificación: "${justificacion.trim()}".`,
        origen: 'estudiante',
      });

      await guardarProyectoEnIDB({
        id: 'proyecto-actual',
        version: 1,
        fechaCreacion: new Date().toISOString(),
        problemaOriginal,
        fichaTecnica,
        hiperparametros: nuevosParams,
        bitacoraDecisiones: [],
      });

      onAvanzarAPaso5();
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Error al guardar la selección de algoritmo.'
      );
    }
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step4-title"
      data-testid="step4-container"
    >
      {/* Encabezado unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 4 de 8</span>
        <div>
          <h2 id="step4-title" className="card-title">
            Selección de Algoritmo y Supuestos Geométricos
          </h2>
          <p className="step-lead">
            Comparativa pedagógica entre K-Means, Clustering Jerárquico y DBSCAN según la geometría de tus datos.
          </p>
        </div>
      </div>

      {/* Caja conceptual pedagógica */}
      <details className="concept-box" data-testid="step4-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Supuestos Geométricos de Clustering (K-Means vs. Jerárquico vs. DBSCAN)
        </summary>
        <div className="concept-content">
          <p>
            En aprendizaje no supervisado, <strong>no existe un algoritmo universalmente superior</strong> (teorema <em>"No Free Lunch"</em>). La elección depende de la topología geométrica de las observaciones:
          </p>
          <ul>
            <li>
              <strong>K-Means:</strong> Asume que los clusters son convexos (esferas o elipsoides) con varianzas equiparables. Minimiza la suma cuadrática de distancias (Inercia / WCSS). Muy vulnerable a valores extremos.
            </li>
            <li>
              <strong>Clustering Jerárquico:</strong> Construye un árbol taxonómico (dendrograma) fusionando puntos iterativamente según distancias de enlace (<em>Ward</em> minimiza varianza, <em>Complete</em> toma la distancia máxima).
            </li>
            <li>
              <strong>DBSCAN:</strong> Busca zonas de alta densidad separadas por regiones de baja densidad. Es el único capaz de descubrir geometrías arbitrarias (como semilunas o anillos entrelazados) y de aislar el ruido asignándole la etiqueta <code>-1</code>.
            </li>
          </ul>
        </div>
      </details>

      {/* Explicación del tutor IA */}
      <div className="tutor-explanation-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <strong>Tutor IA:</strong>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="ask-tutor-step4-btn"
            onClick={handleConsultarTutorAlgoritmo}
            disabled={consultandoIA || deshabilitado}
          >
            {consultandoIA ? '⏳ Consultando al Tutor...' : '✨ Pedir recomendación al Tutor IA'}
          </button>
        </div>
        <p style={{ marginTop: '0.35rem' }}>
          {explicacionTutor ||
            'El validador determinístico analiza el enunciado y tus variables en busca de formas complejas o presencia de ruido. Seleccioná el algoritmo que mejor responda a las características de tu problema o consultá al Tutor IA para redactar la fundamentación.'}
        </p>
      </div>

      {/* Alertas del Validador Determinístico */}
      {advertencias.length > 0 && (
        <div className="mb-4" data-testid="validator-alerts-section">
          {advertencias.map((adv) => (
            <div
              key={adv.id}
              className={`notice-box ${adv.nivel === 'critica' ? 'notice-warning' : 'notice-warning'} mb-2`}
              data-testid={`validator-alert-${adv.regla}`}
              role="alert"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 className="notice-title" style={{ fontSize: '0.92rem' }}>
                    {adv.nivel === 'critica' ? '⚠️ ADVERTENCIA CRÍTICA: ' : '💡 SUGERENCIA METODOLÓGICA: '}
                    {adv.titulo}
                  </h4>
                  <p style={{ margin: '0.2rem 0 0.4rem', fontSize: '0.84rem', color: '#fcd34d' }}>
                    {adv.mensaje}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {adv.explicacionPedagogica}
                  </p>
                </div>

                {adv.accionSugerida && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-glow"
                    data-testid={`quick-fix-btn-${adv.regla}`}
                    onClick={() => handleResolverAdvertencia(adv)}
                    style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
                  >
                    ⚡ Resolver: {adv.accionSugerida.descripcion}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparativa Interactiva de los 3 Algoritmos de la Cátedra */}
      <div className="criteria-modular-grid" data-testid="algorithms-grid">
        {ALGORITMOS_INFO.map((algo) => {
          const seleccionado = algo.id === algoritmoSeleccionado;
          return (
            <div
              key={algo.id}
              className={`entity-card ${seleccionado ? 'border-glow' : ''}`}
              style={{
                cursor: 'pointer',
                borderColor: seleccionado ? 'var(--accent-cyan)' : 'var(--border-color)',
                boxShadow: seleccionado ? '0 0 16px rgba(56, 189, 248, 0.25)' : undefined,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onClick={() => handleSeleccionarAlgoritmo(algo.id)}
              data-testid={`algorithm-card-${algo.id}`}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>{algo.icono}</span>
                  <span
                    className={`badge ${seleccionado ? 'badge-success' : 'badge-secondary'}`}
                  >
                    {seleccionado ? 'SELECCIONADO' : 'DISPONIBLE'}
                  </span>
                </div>

                <h3 className="card-title" style={{ fontSize: '1.02rem', marginBottom: '0.25rem' }}>
                  {algo.nombre}
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                  {algo.subtitulo}
                </p>

                <div style={{ fontSize: '0.78rem', marginBottom: '0.55rem' }}>
                  <strong style={{ color: 'var(--accent-cyan)' }}>Supuesto Geométrico: </strong>
                  <span>{algo.supuestoGeom}</span>
                </div>

                <div style={{ fontSize: '0.78rem', marginBottom: '0.65rem' }}>
                  <strong style={{ color: '#f59e0b' }}>Sensibilidad a Outliers: </strong>
                  <span>{algo.sensibilidadOutliers}</span>
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: '#cbd5e1' }}>Fortalezas:</strong>
                  <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.1rem' }}>
                    {algo.ventajas.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className={`btn btn-sm btn-block ${seleccionado ? 'btn-primary' : 'btn-secondary'}`}
                  data-testid={`select-${algo.id}-btn`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeleccionarAlgoritmo(algo.id);
                  }}
                  disabled={deshabilitado}
                >
                  {seleccionado ? '✓ Algoritmo Activo' : `Elegir ${algo.nombre}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Justificación Pedagógica del Estudiante */}
      <div className="entity-card" style={{ marginTop: '1rem' }}>
        <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '0.35rem' }}>
          ✍️ Justificación Metodológica de tu Elección
        </h3>
        <p className="step-lead" style={{ fontSize: '0.82rem', margin: '0 0 0.5rem' }}>
          Explicá por qué este método es coherente con el tipo de datos y reto analítico que estás abordando.
        </p>
        <textarea
          data-testid="algorithm-justification-input"
          className="textarea-input"
          rows={3}
          value={justificacion}
          onChange={(e) => {
            setJustificacion(e.target.value);
            setErrorLocal(null);
          }}
          placeholder="Escribí aquí por qué seleccionaste este algoritmo..."
          disabled={deshabilitado}
        />
      </div>

      {errorLocal && (
        <div className="alert alert-error" role="alert" data-testid="step4-error">
          ⚠️ {errorLocal}
        </div>
      )}

      {/* Navegación Inferior Unificada */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="back-to-step3-btn"
          onClick={onVolverAPaso3}
          disabled={deshabilitado}
        >
          ← Volver al Paso 3 (EDA y Preprocesamiento)
        </button>
        <button
          type="button"
          className="btn btn-primary btn-glow"
          data-testid="confirm-step4-btn"
          onClick={handleConfirmarYAvanzar}
          disabled={deshabilitado}
        >
          Confirmar Algoritmo y Avanzar al Paso 5 (Hiperparámetros) →
        </button>
      </div>
    </section>
  );
}
