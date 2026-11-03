import { useState } from 'react';
import { FichaTecnicaDS, TipoVariable } from '../core/schemas';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';
import { validarModeloDS, AdvertenciaValidacionDS } from '../core/modelValidatorDS';

export interface Step3EstructuraDatosDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  onActualizarFichaTecnica: (nueva: FichaTecnicaDS) => void;
  onAvanzarAPaso4: () => void;
  onVolverAPaso2: () => void;
  deshabilitado?: boolean;
}

export function Step3EstructuraDatosDS({
  fichaTecnica,
  problemaOriginal,
  onActualizarFichaTecnica,
  onAvanzarAPaso4,
  onVolverAPaso2,
  deshabilitado = false,
}: Step3EstructuraDatosDSProps) {
  const [estrategiaNulos, setEstrategiaNulos] = useState<string>('imputar_mediana');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  // Ejecutamos validación determinística temprana
  const advertencias: AdvertenciaValidacionDS[] = validarModeloDS(fichaTecnica, 'kmeans');
  const advEscala = advertencias.find((a) => a.regla === 'escala_kmeans');

  const handleAplicarStandardScalerTodas = () => {
    const variablesActualizadas = fichaTecnica.variables.map((v) => {
      if (
        v.rol === 'feature' &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
      ) {
        return { ...v, escaladoRecomendado: 'standard_scaler' as const };
      }
      return v;
    });

    onActualizarFichaTecnica({
      ...fichaTecnica,
      variables: variablesActualizadas,
    });

    void registrarDecisionEnIDB({
      paso: 3,
      fecha: new Date().toISOString(),
      descripcion:
        'Aplicó StandardScaler (Z-Score) a todas las variables cuantitativas para equilibrar las distancias euclidianas.',
      origen: 'estudiante',
    });
  };

  const handleCambiarEscalado = (
    idx: number,
    nuevoEscalado: 'ninguno' | 'standard_scaler' | 'min_max_scaler' | 'robust_scaler'
  ) => {
    const vars = [...fichaTecnica.variables];
    vars[idx] = { ...vars[idx], escaladoRecomendado: nuevoEscalado };
    onActualizarFichaTecnica({ ...fichaTecnica, variables: vars });
  };

  const handleCambiarTipo = (idx: number, nuevoTipo: TipoVariable) => {
    const vars = [...fichaTecnica.variables];
    vars[idx] = { ...vars[idx], tipo: nuevoTipo };
    onActualizarFichaTecnica({ ...fichaTecnica, variables: vars });
  };

  const handleConfirmarYAvanzar = async () => {
    const featuresCuantitativas = fichaTecnica.variables.filter(
      (v) =>
        v.rol === 'feature' &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
    );

    if (featuresCuantitativas.length < 2) {
      setErrorLocal(
        'El preprocesamiento requiere al menos 2 variables cuantitativas definidas como "feature".'
      );
      return;
    }

    try {
      await registrarDecisionEnIDB({
        paso: 3,
        fecha: new Date().toISOString(),
        descripcion: `Consensuó el esquema de EDA y preprocesamiento con estrategia de nulos "${estrategiaNulos}" y ${featuresCuantitativas.length} atributos cuantitativos.`,
        origen: 'estudiante',
      });

      await guardarProyectoEnIDB({
        id: 'proyecto-actual',
        version: 1,
        fechaCreacion: new Date().toISOString(),
        problemaOriginal,
        fichaTecnica,
        bitacoraDecisiones: [],
      });

      onAvanzarAPaso4();
    } catch (err) {
      setErrorLocal(
        err instanceof Error
          ? err.message
          : 'Error al persistir la configuración de preprocesamiento.'
      );
    }
  };

  const featuresCount = fichaTecnica.variables.filter((v) => v.rol === 'feature').length;
  const sinEscalarCount = fichaTecnica.variables.filter(
    (v) =>
      v.rol === 'feature' &&
      (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta') &&
      v.escaladoRecomendado === 'ninguno'
  ).length;

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step3-title"
      data-testid="step3-container"
    >
      {/* Encabezado unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 3 de 8</span>
        <div>
          <h2 id="step3-title" className="card-title">
            Estructura de Datos y Calidad (EDA y Preprocesamiento)
          </h2>
          <p className="step-lead">
            Revisión exploratoria de variables, tratamiento de inconsistencias y estrategia de escalado.
          </p>
        </div>
      </div>

      {/* Caja conceptual pedagógica */}
      <details className="concept-box" data-testid="step3-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Calidad de Datos, Escala Numérica y StandardScaler
        </summary>
        <div className="concept-content">
          <p>
            <strong>¿Por qué el escalado es vital en Clustering?</strong> Algoritmos como K-Means y
            Jerárquico calculan distancias euclidianas directas en el espacio multidimensional:
            <code>d(p, q) = √Σ(p_i - q_i)²</code>.
            Si una variable tiene magnitudes de cientos de miles (ej. <em>Facturación anual</em>) y otra de
            decenas (ej. <em>Edad</em> o <em>Frecuencia</em>), la de mayor escala dominará el 99.9% de
            la distancia euclidiana, anulando por completo el aporte de las variables con rangos pequeños.
          </p>
          <p>
            <strong>StandardScaler (Z-Score):</strong> Transforma cada variable restando la media y
            dividiendo por el desvío estándar (<code>z = (x - μ) / σ</code>), logrando que todas tengan
            media 0 y varianza 1. Es la opción preferida por la cátedra para clustering.
          </p>
        </div>
      </details>

      {/* Explicación del tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          Analizá las variables definidas en la Ficha Técnica. Si vas a utilizar algoritmos basados en
          distancias euclidianas (como K-Means), asegurate de que todas las variables cuantitativas
          estén normalizadas con <code>StandardScaler</code>.
        </p>
      </div>

      {/* Alerta del Validador Determinístico si hay variables cuantitativas sin escalar */}
      {advEscala && (
        <div
          className="notice-box notice-warning mb-4"
          data-testid="scale-warning-box"
          role="alert"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 className="notice-title">⚠️ {advEscala.titulo}</h3>
              <p style={{ margin: '0.2rem 0 0.5rem', fontSize: '0.86rem', color: '#fcd34d' }}>
                {advEscala.mensaje}
              </p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {advEscala.explicacionPedagogica}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm btn-glow"
              data-testid="quick-fix-scale-btn"
              onClick={handleAplicarStandardScalerTodas}
              style={{ whiteSpace: 'nowrap', marginLeft: '1rem' }}
            >
              ⚡ Estandarizar Cuantitativas Ahora
            </button>
          </div>
        </div>
      )}

      {/* Barra de Herramientas Rápida */}
      <div className="toolbar-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="standardize-all-btn"
            onClick={handleAplicarStandardScalerTodas}
            disabled={deshabilitado || sinEscalarCount === 0}
          >
            ⚡ Aplicar StandardScaler a todas las cuantitativas ({sinEscalarCount} pendientes)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="select-missing-strategy" className="form-label-sm" style={{ margin: 0 }}>
            Tratamiento de Nulos:
          </label>
          <select
            id="select-missing-strategy"
            data-testid="missing-strategy-select"
            className="select-input select-compact"
            value={estrategiaNulos}
            onChange={(e) => setEstrategiaNulos(e.target.value)}
            disabled={deshabilitado}
          >
            <option value="imputar_mediana">Imputar numéricos con Mediana (Robusto)</option>
            <option value="imputar_media">Imputar con Media aritmética</option>
            <option value="eliminar_filas">Eliminar registros incompletos (Dropna)</option>
            <option value="imputar_moda">Imputar categóricos con Moda</option>
          </select>
        </div>
      </div>

      {/* Tabla de Exploración y Configuración de EDA */}
      <div className="entity-card">
        <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
          📋 Esquema de Preprocesamiento de Variables ({featuresCount} features activas)
        </h3>

        <div className="table-responsive">
          <table className="model-table" data-testid="eda-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Variable</th>
                <th style={{ width: '18%' }}>Tipo de Variable</th>
                <th style={{ width: '15%' }}>Rol en el Modelo</th>
                <th style={{ width: '22%' }}>Estrategia de Escalado</th>
                <th style={{ width: '25%' }}>Estado de Calidad</th>
              </tr>
            </thead>
            <tbody>
              {fichaTecnica.variables.map((variable, idx) => {
                const esCuantitativa =
                  variable.tipo === 'numerica_continua' || variable.tipo === 'numerica_discreta';
                const requiereEscalado =
                  variable.rol === 'feature' && esCuantitativa && variable.escaladoRecomendado === 'ninguno';

                return (
                  <tr key={idx} data-testid={`eda-row-${idx}`}>
                    <td>
                      <strong>{variable.nombre}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {variable.descripcion}
                      </div>
                    </td>
                    <td>
                      <select
                        className="input-table"
                        data-testid={`eda-type-select-${idx}`}
                        value={variable.tipo}
                        onChange={(e) => handleCambiarTipo(idx, e.target.value as TipoVariable)}
                        disabled={deshabilitado}
                      >
                        <option value="numerica_continua">Numérica Continua</option>
                        <option value="numerica_discreta">Numérica Discreta</option>
                        <option value="categorica_nominal">Categórica Nominal</option>
                        <option value="categorica_ordinal">Categórica Ordinal</option>
                        <option value="fecha_hora">Fecha y Hora</option>
                        <option value="texto_libre">Texto Libre</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          variable.rol === 'feature'
                            ? 'badge-primary'
                            : variable.rol === 'identificador'
                              ? 'badge-secondary'
                              : 'badge-success'
                        }`}
                      >
                        {variable.rol.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {variable.rol === 'identificador' ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          No aplica (Excluido de cálculo)
                        </span>
                      ) : (
                        <select
                          className={`input-table ${requiereEscalado ? 'border-warning' : ''}`}
                          data-testid={`eda-scale-select-${idx}`}
                          value={variable.escaladoRecomendado}
                          onChange={(e) =>
                            handleCambiarEscalado(
                              idx,
                              e.target.value as
                                | 'ninguno'
                                | 'standard_scaler'
                                | 'min_max_scaler'
                                | 'robust_scaler'
                            )
                          }
                          disabled={deshabilitado}
                        >
                          <option value="standard_scaler">StandardScaler (Recomendado)</option>
                          <option value="min_max_scaler">MinMaxScaler (0 a 1)</option>
                          <option value="robust_scaler">RobustScaler (IQR)</option>
                          <option value="ninguno">Sin escalado (Original)</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {requiereEscalado ? (
                        <span style={{ color: 'var(--text-warning)', fontSize: '0.8rem', fontWeight: 600 }}>
                          ⚠️ Sin escalar (riesgo euclidiano)
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-success)', fontSize: '0.8rem', fontWeight: 600 }}>
                          ✓ Configuración consistente
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {errorLocal && (
        <div className="alert alert-error" role="alert" data-testid="step3-error">
          ⚠️ {errorLocal}
        </div>
      )}

      {/* Navegación Inferior Unificada */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="back-to-step2-btn"
          onClick={onVolverAPaso2}
          disabled={deshabilitado}
        >
          ← Volver al Paso 2 (Ficha Técnica)
        </button>
        <button
          type="button"
          className="btn btn-primary btn-glow"
          data-testid="confirm-step3-btn"
          onClick={handleConfirmarYAvanzar}
          disabled={deshabilitado}
        >
          Confirmar Preprocesamiento y Avanzar al Paso 4 (Algoritmo) →
        </button>
      </div>
    </section>
  );
}
