import { useState } from 'react';
import {
  FichaTecnicaDS,
  FichaTecnicaSchema,
  ParadigmaML,
  TareaML,
  TipoVariable,
  VariableDS,
} from '../core/schemas';
import { guardarProyectoEnIDB, registrarDecisionEnIDB } from '../core/storageDS';

export interface Step2FichaTecnicaDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  onActualizarFichaTecnica: (nueva: FichaTecnicaDS) => void;
  onAvanzarAPaso3: () => void;
  onVolverAPaso1: () => void;
  deshabilitado?: boolean;
}

const OPCIONES_PARADIGMA: { valor: ParadigmaML; label: string; desc: string }[] = [
  {
    valor: 'no_supervisado',
    label: 'No Supervisado (Clustering / Descubrimiento)',
    desc: 'Sin variable objetivo Y etiquetada. Descubre agrupamientos naturales y geometría en los datos.',
  },
  {
    valor: 'supervisado',
    label: 'Supervisado (Clasificación / Regresión)',
    desc: 'Requiere una variable objetivo Y histórica conocida para entrenar al modelo.',
  },
  {
    valor: 'bi_descriptivo',
    label: 'Inteligencia de Negocios (BI / KPIs)',
    desc: 'Monitoreo retrospectivo y tableros en Power BI. No requiere modelo inductivo de ML.',
  },
  {
    valor: 'refuerzo',
    label: 'Aprendizaje por Refuerzo',
    desc: 'Agente interactúa con un entorno mediante recompensas y penalizaciones secuenciales.',
  },
];

const OPCIONES_TAREA: { valor: TareaML; label: string }[] = [
  { valor: 'clustering', label: 'Clustering (Agrupamiento no supervisado)' },
  { valor: 'clasificacion', label: 'Clasificación (Target categórico)' },
  { valor: 'regresion', label: 'Regresión (Target numérico continuo)' },
  { valor: 'dashboard_kpis', label: 'Tablero de Control y Métricas de BI' },
];

const OPCIONES_TIPO_VARIABLE: { valor: TipoVariable; label: string }[] = [
  { valor: 'numerica_continua', label: 'Numérica Continua' },
  { valor: 'numerica_discreta', label: 'Numérica Discreta' },
  { valor: 'categorica_nominal', label: 'Categórica Nominal' },
  { valor: 'categorica_ordinal', label: 'Categórica Ordinal' },
  { valor: 'fecha_hora', label: 'Fecha y Hora' },
  { valor: 'texto_libre', label: 'Texto Libre' },
];

export function Step2FichaTecnicaDS({
  fichaTecnica,
  problemaOriginal,
  onActualizarFichaTecnica,
  onAvanzarAPaso3,
  onVolverAPaso1,
  deshabilitado = false,
}: Step2FichaTecnicaDSProps) {
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [nuevaRestriccion, setNuevaRestriccion] = useState<string>('');

  const actualizarCampo = <K extends keyof FichaTecnicaDS>(campo: K, valor: FichaTecnicaDS[K]) => {
    const actualizada = { ...fichaTecnica, [campo]: valor };
    onActualizarFichaTecnica(actualizada);
    setErrorValidacion(null);
  };

  const handleCambiarParadigma = (nuevo: ParadigmaML) => {
    let tareaRecomendada = fichaTecnica.tarea;
    if (nuevo === 'no_supervisado' && tareaRecomendada !== 'clustering') {
      tareaRecomendada = 'clustering';
    } else if (nuevo === 'bi_descriptivo') {
      tareaRecomendada = 'dashboard_kpis';
    }

    const fichaActualizada: FichaTecnicaDS = {
      ...fichaTecnica,
      paradigma: nuevo,
      tarea: tareaRecomendada,
      variableTarget: nuevo === 'no_supervisado' ? undefined : fichaTecnica.variableTarget,
    };
    onActualizarFichaTecnica(fichaActualizada);
    setErrorValidacion(null);

    void registrarDecisionEnIDB({
      paso: 2,
      fecha: new Date().toISOString(),
      descripcion: `Modificó el paradigma de aprendizaje a: ${nuevo.toUpperCase()}.`,
      origen: 'estudiante',
    });
  };

  const handleActualizarVariable = (idx: number, campo: keyof VariableDS, valor: unknown) => {
    const vars = [...fichaTecnica.variables];
    vars[idx] = { ...vars[idx], [campo]: valor };
    actualizarCampo('variables', vars);
  };

  const handleAgregarVariable = () => {
    const nuevaVar: VariableDS = {
      nombre: `variable_${fichaTecnica.variables.length + 1}`,
      tipo: 'numerica_continua',
      descripcion: 'Nueva variable cuantitativa',
      rol: 'feature',
      escaladoRecomendado: 'standard_scaler',
      justificacion: 'Atributo para análisis de clustering',
    };
    actualizarCampo('variables', [...fichaTecnica.variables, nuevaVar]);
  };

  const handleEliminarVariable = (idx: number) => {
    if (fichaTecnica.variables.length <= 1) {
      setErrorValidacion('Debe existir al menos una variable en la Ficha Técnica.');
      return;
    }
    const vars = fichaTecnica.variables.filter((_, i) => i !== idx);
    actualizarCampo('variables', vars);
  };

  const handleAgregarRestriccion = () => {
    if (!nuevaRestriccion.trim()) return;
    const actuales = fichaTecnica.restricciones || [];
    actualizarCampo('restricciones', [...actuales, nuevaRestriccion.trim()]);
    setNuevaRestriccion('');
  };

  const handleEliminarRestriccion = (idx: number) => {
    const actuales = (fichaTecnica.restricciones || []).filter((_, i) => i !== idx);
    actualizarCampo('restricciones', actuales);
  };

  const handleConfirmar = async () => {
    const parsed = FichaTecnicaSchema.safeParse(fichaTecnica);
    if (!parsed.success) {
      const errMsgs = parsed.error.issues.map((i) => i.message).join('. ');
      setErrorValidacion(`Ficha técnica incompleta: ${errMsgs}`);
      return;
    }

    try {
      await registrarDecisionEnIDB({
        paso: 2,
        fecha: new Date().toISOString(),
        descripcion: `Consensuó la Ficha Técnica formal: ${fichaTecnica.paradigma.toUpperCase()} (${fichaTecnica.tarea}) con ${fichaTecnica.variables.length} variables.`,
        origen: 'estudiante',
      });

      await guardarProyectoEnIDB({
        id: 'proyecto-actual',
        version: 1,
        fechaCreacion: new Date().toISOString(),
        problemaOriginal,
        fichaTecnica: parsed.data,
        bitacoraDecisiones: [],
      });

      onAvanzarAPaso3();
    } catch (err) {
      setErrorValidacion(
        err instanceof Error ? err.message : 'Error al guardar la Ficha Técnica en el navegador.'
      );
    }
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step2-title"
      data-testid="step2-container"
    >
      {/* Encabezado unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 2 de 8</span>
        <div>
          <h2 id="step2-title" className="card-title">
            Ficha Técnica de Machine Learning
          </h2>
          <p className="step-lead">
            Formalización del paradigma, tipo de tarea analítica, variables predictoras ($X$) y objetivo ($Y$).
          </p>
        </div>
      </div>

      {/* Caja conceptual pedagógica */}
      <details className="concept-box" data-testid="step2-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Taxonomía del ML (Supervisado vs. No Supervisado vs. BI) y Variables (X vs. Y)
        </summary>
        <div className="concept-content">
          <p>
            <strong>Aprendizaje No Supervisado (Clustering):</strong> Se trabaja únicamente con una matriz
            de características o atributos <strong>$X$</strong>. <u>No existe variable objetivo $Y$</u> pre-etiquetada.
            El modelo busca la estructura geométrica interna o densidades relativas (K-Means, Jerárquico, DBSCAN).
          </p>
          <p>
            <strong>Aprendizaje Supervisado:</strong> Se dispone de ejemplos históricos con una variable objetivo
            <strong>$Y$</strong> que se desea predecir a partir de $X$ (Clasificación si $Y$ es categórica,
            Regresión si $Y$ es numérica continua).
          </p>
          <p>
            <strong>Inteligencia de Negocios (BI):</strong> Se enfoca en responder <em>"¿qué ocurrió?"</em>
            mediante agregaciones, sumas y promedios en dashboards (Power BI / DAX), sin entrenar estimadores de ML.
          </p>
        </div>
      </details>

      {/* Bloque de explicación del tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          He estructurado la Ficha Técnica preliminar a partir de tu planteo. Revisá cada sección,
          corregí los tipos de variables según tus datos y confirmá cuando estés de acuerdo.
        </p>
      </div>

      {/* Resumen del problema planteado */}
      <div className="context-summary-box">
        <span className="form-label-sm">Problema planteado en el Paso 1:</span>
        <p className="context-summary-text" data-testid="problem-summary-text">
          {fichaTecnica.problemaNegocio}
        </p>
      </div>

      {/* Formulario de Ficha Técnica */}
      <div className="entity-card">
        <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '0.85rem' }}>
          📋 Especificación Metodológica del Modelo
        </h3>

        <div className="entity-header-inputs" style={{ marginBottom: '1rem' }}>
          {/* Paradigma ML */}
          <div className="form-group-inline" style={{ flex: 1, minWidth: '220px' }}>
            <label htmlFor="paradigma-select" className="form-label-sm">
              Paradigma de Aprendizaje:
            </label>
            <select
              id="paradigma-select"
              data-testid="paradigm-select"
              className="select-input"
              value={fichaTecnica.paradigma}
              onChange={(e) => handleCambiarParadigma(e.target.value as ParadigmaML)}
              disabled={deshabilitado}
            >
              {OPCIONES_PARADIGMA.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tarea ML */}
          <div className="form-group-inline" style={{ flex: 1, minWidth: '220px' }}>
            <label htmlFor="tarea-select" className="form-label-sm">
              Tipo de Tarea Analítica:
            </label>
            <select
              id="tarea-select"
              data-testid="task-select"
              className="select-input"
              value={fichaTecnica.tarea}
              onChange={(e) => actualizarCampo('tarea', e.target.value as TareaML)}
              disabled={deshabilitado}
            >
              {OPCIONES_TAREA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Justificación del Paradigma */}
        <div className="form-group">
          <label htmlFor="paradigm-justification" className="form-label-sm">
            Justificación Metodológica:
          </label>
          <textarea
            id="paradigm-justification"
            data-testid="paradigm-justification-input"
            className="textarea-input"
            rows={2}
            value={fichaTecnica.justificacionParadigma}
            onChange={(e) => actualizarCampo('justificacionParadigma', e.target.value)}
            disabled={deshabilitado}
          />
        </div>

        {/* Variable Target Y (si aplica) */}
        {fichaTecnica.paradigma === 'no_supervisado' ? (
          <div className="notice-box mb-3" style={{ background: 'rgba(56, 189, 248, 0.08)' }}>
            <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
              💡 Aprendizaje No Supervisado:
            </strong>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No existe variable objetivo $Y$. Todos los atributos se consideran predictoras o descriptivas ($X$) para la matriz de distancias.
            </p>
          </div>
        ) : (
          <div className="form-group mb-3">
            <label htmlFor="target-input" className="form-label-sm">
              Variable Objetivo (Target $Y$):
            </label>
            <input
              id="target-input"
              data-testid="target-input"
              type="text"
              className="text-input"
              placeholder="Ej: fuga_cliente, precio_estimado..."
              value={fichaTecnica.variableTarget || ''}
              onChange={(e) => actualizarCampo('variableTarget', e.target.value)}
              disabled={deshabilitado}
            />
          </div>
        )}
      </div>

      {/* Tabla de Variables (Atributos X) */}
      <div className="entity-card">
        <div className="entity-card-header">
          <div>
            <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
              📊 Variables del Modelo (Matriz de Atributos $X$)
            </h3>
            <p className="step-lead" style={{ fontSize: '0.82rem', margin: '0.2rem 0 0' }}>
              Definí el rol, el tipo de dato y el método de escalado recomendado.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="add-variable-btn"
            onClick={handleAgregarVariable}
            disabled={deshabilitado}
          >
            + Agregar Variable
          </button>
        </div>

        <div className="table-responsive">
          <table className="model-table" data-testid="variables-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Nombre</th>
                <th style={{ width: '16%' }}>Tipo de Dato</th>
                <th style={{ width: '14%' }}>Rol</th>
                <th style={{ width: '18%' }}>Escalado Sugerido</th>
                <th style={{ width: '26%' }}>Justificación Didáctica</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {fichaTecnica.variables.map((variable, idx) => (
                <tr key={idx} data-testid={`variable-row-${idx}`}>
                  <td>
                    <input
                      type="text"
                      className="input-table"
                      data-testid={`variable-name-input-${idx}`}
                      value={variable.nombre}
                      onChange={(e) => handleActualizarVariable(idx, 'nombre', e.target.value)}
                      disabled={deshabilitado}
                    />
                  </td>
                  <td>
                    <select
                      className="input-table"
                      data-testid={`variable-type-select-${idx}`}
                      value={variable.tipo}
                      onChange={(e) =>
                        handleActualizarVariable(idx, 'tipo', e.target.value as TipoVariable)
                      }
                      disabled={deshabilitado}
                    >
                      {OPCIONES_TIPO_VARIABLE.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="input-table"
                      data-testid={`variable-role-select-${idx}`}
                      value={variable.rol}
                      onChange={(e) =>
                        handleActualizarVariable(
                          idx,
                          'rol',
                          e.target.value as 'feature' | 'target' | 'identificador'
                        )
                      }
                      disabled={deshabilitado}
                    >
                      <option value="feature">Feature (X)</option>
                      <option value="target">Target (Y)</option>
                      <option value="identificador">Identificador</option>
                    </select>
                  </td>
                  <td>
                    <select
                      className="input-table"
                      data-testid={`variable-scaler-select-${idx}`}
                      value={variable.escaladoRecomendado}
                      onChange={(e) =>
                        handleActualizarVariable(
                          idx,
                          'escaladoRecomendado',
                          e.target.value as
                            | 'ninguno'
                            | 'standard_scaler'
                            | 'min_max_scaler'
                            | 'robust_scaler'
                        )
                      }
                      disabled={deshabilitado}
                    >
                      <option value="standard_scaler">StandardScaler (Z-Score)</option>
                      <option value="min_max_scaler">MinMaxScaler (0 a 1)</option>
                      <option value="robust_scaler">RobustScaler (Mediana / IQR)</option>
                      <option value="ninguno">Ninguno (Sin escalado)</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-table"
                      data-testid={`variable-justification-input-${idx}`}
                      value={variable.justificacion}
                      onChange={(e) =>
                        handleActualizarVariable(idx, 'justificacion', e.target.value)
                      }
                      disabled={deshabilitado}
                    />
                  </td>
                  <td className="cell-center">
                    <button
                      type="button"
                      className="btn-icon btn-sm"
                      data-testid={`remove-variable-btn-${idx}`}
                      onClick={() => handleEliminarVariable(idx)}
                      disabled={fichaTecnica.variables.length <= 1 || deshabilitado}
                      title="Eliminar variable"
                      style={{ color: 'var(--danger)', cursor: 'pointer', background: 'transparent', border: 'none' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restricciones y Supuestos Operativos */}
      <div className="entity-card">
        <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '0.6rem' }}>
          ⚠️ Restricciones y Reglas de Calidad
        </h3>
        <div className="assumptions-grid" data-testid="restrictions-list">
          {(fichaTecnica.restricciones || []).map((restriccion, rIdx) => (
            <div key={rIdx} className="assumption-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>• {restriccion}</span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => handleEliminarRestriccion(rIdx)}
                title="Eliminar restricción"
                style={{ color: 'var(--text-muted)', fontSize: '0.8rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="input-row" style={{ marginTop: '0.8rem' }}>
          <input
            type="text"
            className="text-input"
            data-testid="new-restriction-input"
            placeholder="Agregar una nueva restricción o regla de negocio..."
            value={nuevaRestriccion}
            onChange={(e) => setNuevaRestriccion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAgregarRestriccion();
              }
            }}
            disabled={deshabilitado}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            data-testid="add-restriction-btn"
            onClick={handleAgregarRestriccion}
            disabled={!nuevaRestriccion.trim() || deshabilitado}
          >
            + Agregar
          </button>
        </div>
      </div>

      {errorValidacion && (
        <div className="alert alert-error" role="alert" data-testid="step2-error">
          ⚠️ {errorValidacion}
        </div>
      )}

      {/* Navegación inferior unificada */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          data-testid="back-to-step1-btn"
          onClick={onVolverAPaso1}
          disabled={deshabilitado}
        >
          ← Volver al Paso 1 (Problema)
        </button>
        <button
          type="button"
          className="btn btn-primary btn-glow"
          data-testid="confirm-step2-btn"
          onClick={handleConfirmar}
          disabled={deshabilitado}
        >
          Confirmar Ficha Técnica y Avanzar al Paso 3 (EDA) →
        </button>
      </div>
    </section>
  );
}
