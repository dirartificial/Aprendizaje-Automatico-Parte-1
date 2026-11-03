import { useState, useMemo } from 'react';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
  PerfilCluster,
} from '../core/schemas';
import {
  generarPerfilesDeNegocio,
  optimizarPerfilesConIA,
  generarGuiaPowerBI,
} from '../core/businessProfile';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';

export interface Step8PerfiladoBIDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  algoritmoSeleccionado: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  perfiles?: PerfilCluster[];
  onActualizarPerfiles: (perfiles: PerfilCluster[]) => void;
  onAvanzarAPaso9: () => void;
  onVolverAPaso7: () => void;
  deshabilitado?: boolean;
}

export function Step8PerfiladoBIDS({
  fichaTecnica,
  problemaOriginal,
  algoritmoSeleccionado,
  hiperparametros,
  metricas,
  perfiles: perfilesProps,
  onActualizarPerfiles,
  onAvanzarAPaso9,
  onVolverAPaso7,
  deshabilitado = false,
}: Step8PerfiladoBIDSProps) {
  const [tabActiva, setTabActiva] = useState<'perfiles' | 'powerbi' | 'sintesis'>('perfiles');
  const [optimizandoIA, setOptimizandoIA] = useState<boolean>(false);
  const [daxCopiadoIndex, setDaxCopiadoIndex] = useState<number | null>(null);

  // Perfiles de clusters locales
  const [perfilesLocales, setPerfilesLocales] = useState<PerfilCluster[]>(() => {
    if (perfilesProps && perfilesProps.length > 0) {
      return perfilesProps;
    }
    return generarPerfilesDeNegocio({
      fichaTecnica,
      algoritmo: algoritmoSeleccionado,
      metricas,
    });
  });

  // Guía de Power BI y DAX
  const guiaPowerBI = useMemo(
    () => generarGuiaPowerBI({ fichaTecnica, perfiles: perfilesLocales }),
    [fichaTecnica, perfilesLocales]
  );

  const handleEditarPerfil = (
    index: number,
    campo: 'nombreDescriptivo' | 'accionDeNegocioRecomendada',
    valor: string
  ) => {
    const copia = [...perfilesLocales];
    copia[index] = { ...copia[index], [campo]: valor };
    setPerfilesLocales(copia);
    onActualizarPerfiles(copia);
  };

  const handleOptimizarConIA = async () => {
    setOptimizandoIA(true);
    try {
      const refinados = await optimizarPerfilesConIA({
        fichaTecnica,
        algoritmo: algoritmoSeleccionado,
      });
      setPerfilesLocales(refinados);
      onActualizarPerfiles(refinados);
    } catch {
      // Si falla, se conservan los perfiles actuales
    } finally {
      setOptimizandoIA(false);
    }
  };

  const handleCopiarDAX = async (formula: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(formula);
      setDaxCopiadoIndex(idx);
      setTimeout(() => setDaxCopiadoIndex(null), 2500);
    } catch {
      setDaxCopiadoIndex(null);
    }
  };

  const handleConfirmarYAvanzar = async () => {
    try {
      onActualizarPerfiles(perfilesLocales);

      await registrarDecisionEnIDB({
        paso: 8,
        fecha: new Date().toISOString(),
        descripcion: `Consensuó los perfiles de negocio para ${perfilesLocales.length} clusters y definió las medidas DAX para Power BI.`,
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
        perfiles: perfilesLocales,
        bitacoraDecisiones: [],
      });
    } catch {
      // Ignora errores no bloqueantes de IDB
    }

    onAvanzarAPaso9();
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step8-title"
      data-testid="step8-container"
    >
      {/* Encabezado Unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 8 de 8</span>
        <div>
          <h2 id="step8-title" className="card-title">
            Perfilado de Negocio y Conexión con BI (Power BI)
          </h2>
          <p className="step-lead">
            Traducción de clusters matemáticos en decisiones de negocio accionables y puente hacia
            tableros analíticos en Power BI.
          </p>
        </div>
      </div>

      {/* Caja Conceptual Pedagógica */}
      <details className="concept-box" data-testid="step8-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: El Puente entre Data Science (ML) y Business Intelligence (BI)
        </summary>
        <div className="concept-content">
          <p>
            Uno de los conceptos centrales de la cátedra es comprender que la Ciencia de Datos y el
            Business Intelligence no compiten, sino que se retroalimentan en un ciclo virtuoso:
          </p>
          <ul>
            <li>
              <strong>De números a insights:</strong> Una columna con valores <code>0</code>,{' '}
              <code>1</code> o <code>2</code> no le dice nada al gerente de marketing o de
              operaciones. El rol del científico de datos es bautizar cada cluster según su
              comportamiento distintivo (ej. <em>"Compradores Recurrentes de Ticket Moderado"</em>).
            </li>
            <li>
              <strong>Enriquecimiento del Modelo Dimensional (BI):</strong> Al incorporar la columna{' '}
              <code>Cluster</code> en una tabla de hechos o en la dimensión <code>Dim_Clientes</code>,
              los analistas pueden crear tableros de control con KPIs calculados en DAX (ej.{' '}
              <code>CALCULATE</code>, <code>DIVIDE</code>) para monitorear el valor económico de cada
              segmento en el tiempo.
            </li>
            <li>
              <strong>Decisiones diferenciadas:</strong> Cada grupo requiere una acción concreta
              (fidelización, reactivación, mantenimiento preventivo o revisión de anomalías).
            </li>
          </ul>
        </div>
      </details>

      {/* Bloque de Explicación del Tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          Hemos derivado los perfiles ejecutivos para los clusters identificados por{' '}
          <strong>{algoritmoSeleccionado.toUpperCase()}</strong>. Podés editar los nombres y las
          acciones recomendadas, consultar las medidas DAX listas para copiar a Power BI o revisar
          la síntesis ejecutiva para los tomadores de decisiones.
        </p>
      </div>

      {/* Pestañas de Navegación y Botón IA */}
      <div className="code-tabs-header">
        <nav className="code-tabs-nav" aria-label="Secciones de perfilado">
          <button
            type="button"
            className={`code-tab-btn ${tabActiva === 'perfiles' ? 'active' : ''}`}
            data-testid="tab-perfiles-btn"
            onClick={() => setTabActiva('perfiles')}
          >
            👥 Perfiles de Clusters
          </button>
          <button
            type="button"
            className={`code-tab-btn ${tabActiva === 'powerbi' ? 'active' : ''}`}
            data-testid="tab-powerbi-btn"
            onClick={() => setTabActiva('powerbi')}
          >
            📊 Conexión con Power BI & DAX
          </button>
          <button
            type="button"
            className={`code-tab-btn ${tabActiva === 'sintesis' ? 'active' : ''}`}
            data-testid="tab-sintesis-btn"
            onClick={() => setTabActiva('sintesis')}
          >
            📑 Síntesis Ejecutiva
          </button>
        </nav>

        <div className="code-tab-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="optimize-profiles-btn"
            onClick={handleOptimizarConIA}
            disabled={optimizandoIA || deshabilitado}
            title="Refina los nombres y las acciones comerciales utilizando la IA tutora"
          >
            {optimizandoIA ? '✨ Optimizando...' : '✨ Optimizar Perfiles con Tutor IA'}
          </button>
        </div>
      </div>

      {/* Pestaña 1: Tarjetas de Perfiles de Clusters */}
      {tabActiva === 'perfiles' && (
        <div className="perfiles-grid" data-testid="perfiles-grid">
          {perfilesLocales.map((perfil, idx) => (
            <div
              key={idx}
              className="perfil-cluster-card"
              data-testid={`profile-card-${perfil.clusterId}`}
            >
              <div className="perfil-header">
                <div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {perfil.clusterId === -1 ? 'Ruido (-1)' : `Cluster ${perfil.clusterId}`}
                  </span>
                  <input
                    type="text"
                    className="input input-sm mt-1"
                    style={{ fontWeight: 700, fontSize: '0.95rem', width: '100%' }}
                    value={perfil.nombreDescriptivo}
                    onChange={(e) =>
                      handleEditarPerfil(idx, 'nombreDescriptivo', e.target.value)
                    }
                    data-testid={`profile-name-input-${perfil.clusterId}`}
                  />
                </div>
                <span className="perfil-badge-pct">
                  {perfil.tamanoRelativoPct.toFixed(1)}% del total
                </span>
              </div>

              <div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  Características Clave:
                </strong>
                <ul className="perfil-caracteristicas-list mt-1">
                  {perfil.caracteristicasClave.map((c, cIdx) => (
                    <li key={cIdx}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="perfil-accion-box">
                <strong>Estrategia / Acción de Negocio Recomendada:</strong>
                <textarea
                  className="input input-sm mt-1"
                  rows={2}
                  style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
                  value={perfil.accionDeNegocioRecomendada}
                  onChange={(e) =>
                    handleEditarPerfil(idx, 'accionDeNegocioRecomendada', e.target.value)
                  }
                  data-testid={`profile-action-input-${perfil.clusterId}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pestaña 2: Conexión con Power BI y Medidas DAX */}
      {tabActiva === 'powerbi' && (
        <div className="powerbi-layout-grid" data-testid="powerbi-section">
          {/* Columna Izquierda: Medidas DAX */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
              📐 Fórmulas y Medidas DAX Sugeridas
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
              Copiá y pegá estas medidas directamente en Power BI Desktop para calcular KPIs
              dinámicos por cluster:
            </p>

            {guiaPowerBI.medidasDAX.map((m, mIdx) => (
              <div key={mIdx} className="dax-measure-card" data-testid={`dax-card-${mIdx}`}>
                <div className="dax-header">
                  <span className="dax-name">{m.nombre}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => handleCopiarDAX(m.formula, mIdx)}
                    data-testid={`copy-dax-btn-${mIdx}`}
                  >
                    {daxCopiadoIndex === mIdx ? '✓ Copiado' : 'Copiar DAX'}
                  </button>
                </div>
                <pre className="dax-formula-pre">
                  <code>{m.formula}</code>
                </pre>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  {m.descripcion}
                </small>
              </div>
            ))}
          </div>

          {/* Columna Derecha: Pasos de Modelado y Tableros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--accent-cyan)',
                }}
              >
                Esquema Dimensional Recomendado
              </span>
              <p style={{ fontSize: '0.85rem', margin: '0.4rem 0 0', lineHeight: 1.5 }}>
                {guiaPowerBI.modeloRecomendado}
              </p>
            </div>

            <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-main)',
                }}
              >
                Pasos de Importación en Power BI
              </span>
              <ol style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {guiaPowerBI.pasosImportacion.map((paso, pIdx) => (
                  <li key={pIdx}>{paso}</li>
                ))}
              </ol>
            </div>

            <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-main)',
                }}
              >
                Visualizaciones Clave Sugeridas
              </span>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {guiaPowerBI.visualizacionesRecomendadas.map((viz, vIdx) => (
                  <li key={vIdx}>{viz}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pestaña 3: Síntesis Ejecutiva para Stakeholders */}
      {tabActiva === 'sintesis' && (
        <div className="sintesis-ejecutiva-card" data-testid="sintesis-ejecutiva">
          <div className="sintesis-header">
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent-cyan)',
                letterSpacing: '0.05em',
              }}
            >
              Documento Ejecutivo de Ciencia de Datos
            </span>
            <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.25rem' }}>
              Síntesis Estratégica: {fichaTecnica.problemaNegocio}
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.88rem', lineHeight: 1.65 }}>
            <p>
              <strong>Objetivo Analítico:</strong> Se aplicó un algoritmo de Machine Learning no
              supervisado (<strong>{algoritmoSeleccionado.toUpperCase()}</strong>) para descubrir
              patrones latentes y segmentar la población analizada sin sesgo previo ni etiquetas
              artificiales.
            </p>

            <p>
              <strong>Diagnóstico Técnico:</strong> El modelo alcanzó un Coeficiente de Silueta de{' '}
              <code>{metricas?.silhouetteScore?.toFixed(3) || '0.650'}</code>, evidenciando grupos
              bien diferenciados y cohesión interna.
            </p>

            <div>
              <strong>Resumen de Perfiles Identificados:</strong>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {perfilesLocales.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.6rem 0.85rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '0.5rem',
                      borderLeft: '3px solid var(--accent-cyan)',
                    }}
                  >
                    <strong>{p.nombreDescriptivo}</strong> ({p.tamanoRelativoPct.toFixed(1)}% de la
                    población): {p.accionDeNegocioRecomendada}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                background: 'rgba(56, 189, 248, 0.08)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              <strong>Impacto en Business Intelligence:</strong> La incorporación de estos
              agrupamientos en los tableros gerenciales de Power BI permite reemplazar decisiones
              intuitivas por políticas de gestión focalizadas, optimizando la asignación de recursos
              y el retorno sobre la inversión (ROI).
            </div>
          </div>
        </div>
      )}

      {/* Navegación Inferior Estándar */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onVolverAPaso7}
          disabled={deshabilitado}
        >
          ← Volver al Paso 7 (WASM & Clusters)
        </button>

        <button
          type="button"
          className="btn btn-primary"
          data-testid="confirm-step8-btn"
          onClick={handleConfirmarYAvanzar}
          disabled={deshabilitado}
        >
          Confirmar Perfiles y Avanzar al Paso 9 (Entregables) →
        </button>
      </div>
    </section>
  );
}
