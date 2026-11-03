import { useState } from 'react';
import { PRESETS_CASOS_DS, PresetCasoDS } from '../core/presetsDS';
import {
  evaluarClaridadProblemaDS,
  generarFichaTecnicaDS,
  InteraccionAclaratoria,
} from '../core/clarityDS';
import { AclaracionDS, FichaTecnicaDS } from '../core/schemas';
import { registrarDecisionEnIDB } from '../core/storageDS';

export interface Step1ProblemaDSProps {
  problema: string;
  onActualizarProblema: (nuevo: string) => void;
  onAvanzarAPaso2: (fichaGenerada: FichaTecnicaDS) => void;
  deshabilitado?: boolean;
}

export function Step1ProblemaDS({
  problema,
  onActualizarProblema,
  onAvanzarAPaso2,
  deshabilitado = false,
}: Step1ProblemaDSProps) {
  const [evaluando, setEvaluando] = useState<boolean>(false);
  const [generandoFicha, setGenerandoFicha] = useState<boolean>(false);
  const [aclaracion, setAclaracion] = useState<AclaracionDS | null>(null);
  const [respuestasUsuario, setRespuestasUsuario] = useState<Record<number, string>>({});
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [presetActivoId, setPresetActivoId] = useState<string | null>(null);

  const handleSeleccionarPreset = (preset: PresetCasoDS) => {
    onActualizarProblema(preset.problemaTexto);
    setPresetActivoId(preset.id);
    setAclaracion(null);
    setRespuestasUsuario({});
    setErrorLocal(null);

    void registrarDecisionEnIDB({
      paso: 1,
      fecha: new Date().toISOString(),
      descripcion: `Seleccionó el caso didáctico precargado: "${preset.titulo}" (${preset.claseReferencia}).`,
      origen: 'estudiante',
    });
  };

  const armarListaRespuestas = (): InteraccionAclaratoria[] => {
    if (!aclaracion || !aclaracion.preguntas) return [];
    return aclaracion.preguntas.map((pregunta, idx) => ({
      pregunta,
      respuesta: respuestasUsuario[idx] || '',
    }));
  };

  const handleEvaluarClaridad = async () => {
    if (!problema.trim() || problema.trim().length < 5) {
      setErrorLocal('Por favor ingresá una descripción del problema antes de continuar.');
      return;
    }
    setErrorLocal(null);
    setEvaluando(true);
    try {
      const respuestas = armarListaRespuestas();
      const resultado = await evaluarClaridadProblemaDS(problema, respuestas);
      setAclaracion(resultado);

      void registrarDecisionEnIDB({
        paso: 1,
        fecha: new Date().toISOString(),
        descripcion: resultado.suficiente
          ? 'El planteo del problema fue evaluado con suficiente claridad metodológica.'
          : `El Tutor Socrático formuló ${resultado.preguntas.length} preguntas aclaratorias para guiar la formulación.`,
        origen: 'ia_aceptada',
      });
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Error al evaluar claridad del planteo.'
      );
    } finally {
      setEvaluando(false);
    }
  };

  const handleConfirmarYAvanzar = async () => {
    if (!problema.trim()) return;
    setGenerandoFicha(true);
    setErrorLocal(null);
    try {
      const respuestas = armarListaRespuestas();
      const ficha = await generarFichaTecnicaDS(problema, respuestas);

      void registrarDecisionEnIDB({
        paso: 1,
        fecha: new Date().toISOString(),
        descripcion: `Confirmó el planteo y avanzó al Paso 2. Ficha Técnica generada (${ficha.paradigma.toUpperCase()} - ${ficha.tarea.toUpperCase()}).`,
        origen: 'estudiante',
      });

      onAvanzarAPaso2(ficha);
    } catch (err) {
      setErrorLocal(
        err instanceof Error ? err.message : 'Error al generar la Ficha Técnica de ML.'
      );
    } finally {
      setGenerandoFicha(false);
    }
  };

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step1-title"
      data-testid="step1-container"
    >
      {/* Encabezado unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 1 de 8</span>
        <div>
          <h2 id="step1-title" className="card-title">
            Planteo del Problema de Negocio
          </h2>
          <p className="step-lead">
            Definí el desafío analítico o comercial que querés abordar con Ciencia de Datos.
          </p>
        </div>
      </div>

      {/* Caja conceptual pedagógica */}
      <details className="concept-box" data-testid="step1-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Inteligencia de Negocios (BI) vs. Análisis Predictivo (AP / ML)
        </summary>
        <div className="concept-content">
          <p>
            <strong>Inteligencia de Negocios (BI):</strong> Enfoque descriptivo y de diagnóstico que
            responde a <em>"¿Qué ocurrió?"</em> y <em>"¿Por qué ocurrió?"</em> a través de
            agregaciones históricas, KPIs consolidados y tableros interactivos (Power BI, SQL, Power Query).
          </p>
          <p>
            <strong>Ciencia de Datos y Machine Learning (ML):</strong> Enfoque predictivo y de
            descubrimiento que responde a <em>"¿Qué pasará?"</em> o{' '}
            <em>"¿Qué patrones ocultos existen en los datos sin etiquetar?"</em> (Clustering,
            Clasificación, Regresión).
          </p>
          <p>
            En este asistente aprenderás a formular una{' '}
            <strong>Ficha Técnica de Machine Learning</strong>, separando claramente las variables
            predictoras ($X$) y comprendiendo por qué en tareas No Supervisadas (como Clustering) no
            existe una variable objetivo ($Y$) predeterminada.
          </p>
        </div>
      </details>

      {/* Bloque de explicación del tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          ¡Hola! Soy tu tutor pedagógico de Ciencia de Datos. Podés redactar tu propio problema o
          cargar uno de los casos del programa curricular de la cátedra para comenzar.
        </p>
      </div>

      {/* Barra de Presets Pedagógicos del Curso */}
      <div className="quick-ideas-bar">
        <span className="quick-ideas-label">
          📚 Casos Didácticos del Programa Curricular (Hacé clic para cargar):
        </span>
        <div className="quick-ideas-grid" data-testid="presets-grid">
          {PRESETS_CASOS_DS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`idea-chip-btn ${presetActivoId === preset.id ? 'active' : ''}`}
              data-testid={`preset-btn-${preset.id}`}
              onClick={() => handleSeleccionarPreset(preset)}
              disabled={deshabilitado || evaluando || generandoFicha}
              title={preset.claseReferencia}
            >
              <span>{preset.icono}</span> {preset.titulo}
            </button>
          ))}
        </div>
      </div>

      {/* Formulario Principal de Planteo */}
      <div className="form-group">
        <label htmlFor="problem-description-input" className="form-label">
          Descripción del problema o reto analítico:
        </label>
        <textarea
          id="problem-description-input"
          data-testid="problem-input"
          className="textarea-input"
          rows={5}
          placeholder="Describí con tus propias palabras qué situación comercial, operativa o científica necesitás resolver con datos..."
          value={problema}
          onChange={(e) => {
            onActualizarProblema(e.target.value);
            setAclaracion(null);
            setErrorLocal(null);
          }}
          disabled={deshabilitado || evaluando || generandoFicha}
        />
        <div className="form-help">
          Consejo: Mencioná qué tipo de registros u observaciones tenés y qué decisión esperás tomar a
          partir de los resultados.
        </div>
      </div>

      {errorLocal && (
        <div className="alert alert-error" role="alert" data-testid="step1-error">
          ⚠️ {errorLocal}
        </div>
      )}

      {/* Diálogo Socrático: Preguntas Aclaratorias si el planteo es ambiguo */}
      {aclaracion && !aclaracion.suficiente && (
        <div className="notice-box notice-warning mb-4" data-testid="clarification-dialog">
          <h3 className="notice-title">
            🤔 Preguntas Orientadoras del Tutor Socrático
          </h3>
          <p style={{ fontSize: '0.86rem', marginBottom: '0.8rem', color: '#fcd34d' }}>
            Para formular una Ficha Técnica rigurosa, necesitamos aclarar algunos puntos
            metodológicos:
          </p>
          <div className="questions-grid">
            {aclaracion.preguntas.map((pregunta, idx) => (
              <div key={idx} className="question-item">
                <span className="question-number-tag">Pregunta {idx + 1} de {aclaracion.preguntas.length}</span>
                <p className="qa-question" style={{ marginBottom: '0.5rem' }}>
                  {pregunta}
                </p>
                <input
                  type="text"
                  className="input input-block"
                  data-testid={`question-response-input-${idx}`}
                  placeholder="Tu respuesta o aclaración..."
                  value={respuestasUsuario[idx] || ''}
                  onChange={(e) =>
                    setRespuestasUsuario({ ...respuestasUsuario, [idx]: e.target.value })
                  }
                  disabled={evaluando || generandoFicha}
                />
              </div>
            ))}
          </div>
          <div className="button-group" style={{ marginTop: '0.8rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              data-testid="submit-answers-btn"
              onClick={handleEvaluarClaridad}
              disabled={evaluando || generandoFicha}
            >
              {evaluando ? 'Re-evaluando...' : '🔄 Responder y re-evaluar claridad'}
            </button>
          </div>
        </div>
      )}

      {/* Supuestos confirmados si la claridad fue suficiente */}
      {aclaracion && aclaracion.suficiente && (
        <div className="alert alert-success" data-testid="clarity-success-alert">
          <strong>✅ Claridad metodológica confirmada:</strong> El planteo contiene la información
          necesaria para diseñar la Ficha Técnica de Machine Learning.
          {aclaracion.supuestosAConfirmar && aclaracion.supuestosAConfirmar.length > 0 && (
            <ul style={{ margin: '0.45rem 0 0', paddingLeft: '1.2rem', fontSize: '0.84rem' }}>
              {aclaracion.supuestosAConfirmar.map((sup, sIdx) => (
                <li key={sIdx}>{sup}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Botones de Acción */}
      <div className="button-group">
        {!aclaracion?.suficiente ? (
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="evaluate-clarity-btn"
            onClick={handleEvaluarClaridad}
            disabled={!problema.trim() || evaluando || generandoFicha || deshabilitado}
          >
            {evaluando ? 'Analizando con Tutor Socrático...' : '🔍 Evaluar Claridad del Planteo'}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-glow"
            data-testid="confirm-step1-btn"
            onClick={handleConfirmarYAvanzar}
            disabled={generandoFicha || deshabilitado}
          >
            {generandoFicha
              ? 'Estructurando Ficha Técnica de ML...'
              : 'Confirmar Planteo y Crear Ficha Técnica (Paso 2) →'}
          </button>
        )}
      </div>
    </section>
  );
}
