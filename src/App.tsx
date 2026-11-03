import React, { useEffect, useState } from 'react';
import {
  enmascararApiKey,
  guardarApiKey,
  obtenerApiKey,
  olvidarApiKey,
  validarFormatoKey,
  obtenerProveedorActivo,
  establecerProveedorActivo,
  ProveedorLLM,
} from './core/key';
import {
  establecerModeloActivo,
  GEMINI_MODEL,
  MODELOS_ALTERNATIVOS,
  MODELOS_OPENROUTER_GRATIS_DEFAULT,
  OPENROUTER_MODEL_DEFAULT,
  obtenerModeloActivo,
  probarConexionGemini,
  listarModelosOllamaLocales,
  listarModelosOpenRouterGratuitos,
  MODELOS_OLLAMA_RECOMENDADOS,
} from './core/gemini';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
  PerfilCluster,
} from './core/schemas';
import { PRESETS_CASOS_DS } from './core/presetsDS';
import { cargarProyectoDeIDB } from './core/storageDS';
import { Step1ProblemaDS } from './steps/Step1ProblemaDS';
import { Step2FichaTecnicaDS } from './steps/Step2FichaTecnicaDS';
import { Step3EstructuraDatosDS } from './steps/Step3EstructuraDatosDS';
import { Step4SeleccionAlgoritmoDS } from './steps/Step4SeleccionAlgoritmoDS';
import { Step5HiperparametrosDS } from './steps/Step5HiperparametrosDS';
import { Step6PipelinePythonDS } from './steps/Step6PipelinePythonDS';
import { Step7EjecucionWasmDS } from './steps/Step7EjecucionWasmDS';
import { Step8PerfiladoBIDS } from './steps/Step8PerfiladoBIDS';
import { StepEntregablesDS } from './steps/StepEntregablesDS';
import { GlossaryModalDS } from './steps/GlossaryModalDS';

export interface PasoMeta {
  numero: number;
  icono: string;
  titulo: string;
  subtitulo: string;
}

const ETIQUETAS_PASOS: readonly PasoMeta[] = [
  { numero: 1, icono: '🎯', titulo: '1. Problema', subtitulo: 'Negocio y formulación' },
  { numero: 2, icono: '📋', titulo: '2. Ficha Técnica', subtitulo: 'X, Y y paradigma ML' },
  { numero: 3, icono: '📊', titulo: '3. EDA y Variables', subtitulo: 'Tipos y StandardScaler' },
  { numero: 4, icono: '🔀', titulo: '4. Algoritmo', subtitulo: 'K-Means, Jerárquico o DBSCAN' },
  { numero: 5, icono: '🎛️', titulo: '5. Hiperparámetros', subtitulo: 'Codo y Silueta' },
  { numero: 6, icono: '🐍', titulo: '6. Pipeline Python', subtitulo: 'scikit-learn y .ipynb' },
  { numero: 7, icono: '⚡', titulo: '7. WASM & Clusters', subtitulo: 'Pyodide y visualización' },
  { numero: 8, icono: '📈', titulo: '8. Perfilado BI', subtitulo: 'Insights y Power BI' },
  { numero: 9, icono: '📦', titulo: '9. Entregables', subtitulo: 'ZIP, PDF y CSV seguro' },
] as const;

export function App() {
  const [keyGuardada, setKeyGuardada] = useState<string | null>(() => obtenerApiKey());
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<ProveedorLLM>(() =>
    obtenerProveedorActivo()
  );
  const [inputKey, setInputKey] = useState<string>('');
  const [avisoAceptado, setAvisoAceptado] = useState<boolean>(false);
  const [probando, setProbando] = useState<boolean>(false);
  const [cargandoModelos, setCargandoModelos] = useState<boolean>(false);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(() => obtenerModeloActivo());
  const [modelosOpciones, setModelosOpciones] = useState<string[]>(() => {
    const prov = obtenerProveedorActivo();
    if (prov === 'ollama') return [...MODELOS_OLLAMA_RECOMENDADOS];
    if (prov === 'openrouter') return [...MODELOS_OPENROUTER_GRATIS_DEFAULT];
    return [...MODELOS_ALTERNATIVOS];
  });
  const [estadoMensaje, setEstadoMensaje] = useState<{
    tipo: 'exito' | 'error';
    texto: string;
  } | null>(null);

  const [pasoActivo, setPasoActivo] = useState<number>(1);
  const [pasoMaximoAlcanzado, setPasoMaximoAlcanzado] = useState<number>(1);

  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const guardado = window.localStorage.getItem('ds_tutor_theme');
      if (guardado === 'light' || guardado === 'dark') return guardado;
    }
    return 'dark';
  });
  const [glosarioAbierto, setGlosarioAbierto] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
  }, [tema]);

  const toggleTema = () => {
    setTema((prev) => {
      const siguiente = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem('ds_tutor_theme', siguiente);
      } catch {
        // Ignora errores si localStorage está bloqueado
      }
      return siguiente;
    });
  };

  const [problema, setProblema] = useState<string>(
    () => PRESETS_CASOS_DS[0]?.problemaTexto || ''
  );
  const [fichaTecnica, setFichaTecnica] = useState<FichaTecnicaDS>(
    () => PRESETS_CASOS_DS[0]?.fichaTecnicaInicial
  );
  const [algoritmoSeleccionado, setAlgoritmoSeleccionado] = useState<AlgoritmoClustering>('kmeans');
  const [hiperparametros, setHiperparametros] = useState<HiperparametrosClustering | undefined>(
    undefined
  );
  const [metricas, setMetricas] = useState<MetricasEvaluacion | undefined>(undefined);
  const [perfiles, setPerfiles] = useState<PerfilCluster[] | undefined>(undefined);

  useEffect(() => {
    void cargarProyectoDeIDB().then((proyectoGuardado) => {
      if (proyectoGuardado) {
        if (proyectoGuardado.problemaOriginal) {
          setProblema(proyectoGuardado.problemaOriginal);
        }
        if (proyectoGuardado.fichaTecnica) {
          setFichaTecnica(proyectoGuardado.fichaTecnica);
        }
        if (proyectoGuardado.hiperparametros) {
          setHiperparametros(proyectoGuardado.hiperparametros);
          if (proyectoGuardado.hiperparametros.algoritmo) {
            setAlgoritmoSeleccionado(proyectoGuardado.hiperparametros.algoritmo);
          }
        }
        if (proyectoGuardado.metricas) {
          setMetricas(proyectoGuardado.metricas);
        }
        if (proyectoGuardado.perfiles) {
          setPerfiles(proyectoGuardado.perfiles);
        }
      }
    });
  }, []);

  const cargarModelosParaProveedor = async (nuevo: ProveedorLLM, keyEspecifica?: string) => {
    setCargandoModelos(true);
    try {
      if (nuevo === 'gemini') {
        const lista = [...MODELOS_ALTERNATIVOS];
        setModelosOpciones(lista);
        if (!lista.includes(modeloSeleccionado as typeof MODELOS_ALTERNATIVOS[number])) {
          setModeloSeleccionado(GEMINI_MODEL);
          establecerModeloActivo(GEMINI_MODEL);
        }
      } else if (nuevo === 'openrouter') {
        const key = keyEspecifica ?? inputKey ?? obtenerApiKey() ?? '';
        const lista = await listarModelosOpenRouterGratuitos(key);
        setModelosOpciones(lista);
        if (!lista.includes(modeloSeleccionado)) {
          const primero = lista.includes(OPENROUTER_MODEL_DEFAULT)
            ? OPENROUTER_MODEL_DEFAULT
            : lista[0];
          setModeloSeleccionado(primero);
          establecerModeloActivo(primero);
        }
      } else if (nuevo === 'ollama') {
        const lista = await listarModelosOllamaLocales();
        setModelosOpciones(lista);
        if (!lista.includes(modeloSeleccionado) && lista.length > 0) {
          setModeloSeleccionado(lista[0]);
          establecerModeloActivo(lista[0]);
        }
      }
    } catch {
      // Ignora errores silenciosamente y preserva los valores por defecto
    } finally {
      setCargandoModelos(false);
    }
  };

  useEffect(() => {
    void cargarModelosParaProveedor(proveedorSeleccionado);
  }, []);

  const handleCambiarProveedor = (nuevo: ProveedorLLM) => {
    setProveedorSeleccionado(nuevo);
    establecerProveedorActivo(nuevo);
    void cargarModelosParaProveedor(nuevo);
  };

  const handleGuardarKey = (e: React.FormEvent) => {
    e.preventDefault();
    setEstadoMensaje(null);
    const validacion = validarFormatoKey(inputKey, proveedorSeleccionado);
    if (!validacion.valida) {
      setEstadoMensaje({
        tipo: 'error',
        texto: validacion.mensaje ?? 'API key inválida.',
      });
      return;
    }
    try {
      guardarApiKey(inputKey, proveedorSeleccionado);
      setKeyGuardada(obtenerApiKey());
      void cargarModelosParaProveedor(proveedorSeleccionado, inputKey);
      setInputKey('');
      setEstadoMensaje({
        tipo: 'exito',
        texto: 'Configuración guardada de forma segura en sessionStorage para esta pestaña.',
      });
    } catch (err) {
      setEstadoMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Error al guardar la clave.',
      });
    }
  };

  const handleOlvidarKey = () => {
    olvidarApiKey();
    setKeyGuardada(null);
    setInputKey('');
    setEstadoMensaje({
      tipo: 'exito',
      texto: 'Sesión eliminada de la memoria de esta pestaña.',
    });
  };

  const handleProbarConexion = async () => {
    setProbando(true);
    setEstadoMensaje(null);
    try {
      const res = await probarConexionGemini();
      if (res.ok) {
        if (res.modelosDisponibles && res.modelosDisponibles.length > 0) {
          setModelosOpciones(res.modelosDisponibles);
        }
        setEstadoMensaje({
          tipo: 'exito',
          texto: res.mensaje,
        });
      } else {
        setEstadoMensaje({
          tipo: 'error',
          texto: res.mensaje,
        });
      }
    } catch (err) {
      setEstadoMensaje({
        tipo: 'error',
        texto: err instanceof Error ? err.message : 'Error inesperado al probar conexión.',
      });
    } finally {
      setProbando(false);
    }
  };

  const cambiarPaso = (nuevoPaso: number) => {
    setPasoActivo(nuevoPaso);
    if (nuevoPaso > pasoMaximoAlcanzado) {
      setPasoMaximoAlcanzado(nuevoPaso);
    }
  };

  const puedeGuardar =
    avisoAceptado &&
    (proveedorSeleccionado === 'ollama' || validarFormatoKey(inputKey, proveedorSeleccionado).valida);

  const porcentajeProgreso = Math.round((pasoActivo / 9) * 100);

  return (
    <div className="app-shell">
      {/* Skip link para accesibilidad WCAG */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      {/* Barra superior de comando */}
      <header className="app-header" role="banner">
        <div className="brand-block">
          <div className="brand-logo" aria-hidden="true">
            DS
          </div>
          <div>
            <h1 className="brand-title">Tutor de Ciencia de Datos y Machine Learning</h1>
            <p className="brand-subtitle">
              Asistente pedagógico interactivo • Modelo BYOK • 100% Estático y Privado
            </p>
          </div>
        </div>

        <div className="header-actions">
          {keyGuardada && (
            <div className="key-status-group">
              <span className="badge badge-success">Sesión Activa</span>

              {/* Selector agrupado de proveedor y modelo LLM */}
              <div className="llm-selector-cluster" title="Configuración de Proveedor y Modelo LLM">
                <select
                  className="input input-sm select-provider"
                  value={proveedorSeleccionado}
                  onChange={(e) => handleCambiarProveedor(e.target.value as ProveedorLLM)}
                  title="Cambiar proveedor LLM activo"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openrouter">OpenRouter (:free)</option>
                  <option value="ollama">Ollama Local</option>
                </select>

                <div className="model-select-wrapper">
                  <label htmlFor="model-select" className="sr-only">
                    Modelo activo
                  </label>
                  <select
                    id="model-select"
                    className="input input-sm select-model"
                    value={modeloSeleccionado}
                    onChange={(e) => {
                      const nuevo = e.target.value;
                      setModeloSeleccionado(nuevo);
                      establecerModeloActivo(nuevo);
                    }}
                    disabled={cargandoModelos}
                    title="Modelo LLM activo"
                  >
                    {modelosOpciones.map((m) => (
                      <option key={m} value={m}>
                        {m === 'openrouter/free'
                          ? 'openrouter/free (Auto-Router)'
                          : m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <span className="masked-key-tag" data-testid="masked-key">
                {enmascararApiKey(keyGuardada)}
              </span>

              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleProbarConexion}
                disabled={probando || cargandoModelos}
              >
                {probando ? 'Probando...' : 'Probar conexión'}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleOlvidarKey}
                title="Elimina la API key de sessionStorage de inmediato"
              >
                Olvidar key ahora
              </button>
            </div>
          )}

          <div className="header-utility-group">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              data-testid="open-glossary-btn"
              onClick={() => setGlosarioAbierto(true)}
              title="Abrir glosario pedagógico interactivo de conceptos"
              aria-label="Abrir glosario conceptual"
            >
              📖 Glosario
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              data-testid="toggle-theme-btn"
              onClick={toggleTema}
              title={`Cambiar a modo ${tema === 'dark' ? 'claro' : 'oscuro'}`}
              aria-label={`Cambiar a modo ${tema === 'dark' ? 'claro' : 'oscuro'}`}
            >
              {tema === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
          </div>
        </div>
      </header>

      {/* Mensajes de estado globales */}
      {estadoMensaje && (
        <aside
          role="status"
          aria-live="polite"
          data-testid="status-message"
          className={`banner banner-${estadoMensaje.tipo} mb-4`}
        >
          <div className="banner-content">
            <strong>{estadoMensaje.tipo === 'exito' ? '✅ ' : '⚠️ '}</strong>
            <span>{estadoMensaje.texto}</span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setEstadoMensaje(null)}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Pantalla / Modal de Onboarding BYOK si no hay key guardada */}
      {!keyGuardada ? (
        <section
          className="card onboarding-card mb-4"
          aria-labelledby="onboarding-title"
          data-testid="onboarding-section"
        >
          <div className="step-header">
            <span className="step-badge">Paso Previo</span>
            <div>
              <h2 id="onboarding-title" className="card-title">
                Bienvenido al Tutor de Ciencia de Datos y Machine Learning
              </h2>
              <p className="step-lead">
                Configuración segura de tu API Key (Modelo BYOK: <em>Bring Your Own Key</em>).
              </p>
            </div>
          </div>

          <div
            className="notice-box notice-warning mb-4"
            data-testid="security-notice"
            role="alert"
          >
            <h3 className="notice-title">🔒 Compromiso de Privacidad y Seguridad Absoluta</h3>
            <ul className="notice-list">
              <li>
                <strong>Aislamiento en sessionStorage:</strong> Tu clave vive <u>únicamente en esta pestaña</u> y se elimina automáticamente al cerrarla.
              </li>
              <li>
                <strong>Clave recomendada:</strong> Te sugerimos crear una clave <u>exclusiva para este curso</u> en Google AI Studio y revocarla una vez finalizada la cursada.
              </li>
              <li>
                <strong>Computadoras compartidas:</strong> Al terminar tu sesión de estudio, hacé clic en el botón <em>"Olvidar key ahora"</em> para borrar cualquier rastro inmediatamente.
              </li>
              <li>
                <strong>Datos sintéticos y académicos:</strong> <u>No cargues nombres, documentos ni datos reales</u> confidenciales de clientes o empresas en los enunciados.
              </li>
              <li>
                <strong>Cero servidores intermediarios:</strong> Este sitio es 100% estático. Las consultas viajan directamente desde tu navegador a la API oficial.
              </li>
            </ul>
          </div>

          <form onSubmit={handleGuardarKey} className="onboarding-form">
            <fieldset className="form-group mb-3">
              <legend className="form-label">1. Seleccioná el Proveedor de IA:</legend>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="proveedor"
                    value="gemini"
                    checked={proveedorSeleccionado === 'gemini'}
                    onChange={() => handleCambiarProveedor('gemini')}
                  />
                  <span>Google Gemini (Recomendado oficial - Modelos Flash en Google AI Studio)</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="proveedor"
                    value="openrouter"
                    checked={proveedorSeleccionado === 'openrouter'}
                    onChange={() => handleCambiarProveedor('openrouter')}
                  />
                  <span>OpenRouter (Todos los modelos :free y openrouter/free auto-router)</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="proveedor"
                    value="ollama"
                    checked={proveedorSeleccionado === 'ollama'}
                    onChange={() => handleCambiarProveedor('ollama')}
                  />
                  <span>Ollama Local (100% local en http://localhost:11434)</span>
                </label>
              </div>
            </fieldset>

            {/* Input de Key para Gemini y OpenRouter */}
            {proveedorSeleccionado !== 'ollama' && (
              <div className="form-group mb-3">
                <label htmlFor="api-key-input" className="form-label">
                  2. Ingresá tu API Key:
                </label>
                <input
                  id="api-key-input"
                  data-testid="api-key-input"
                  type="password"
                  className="input input-block"
                  placeholder={
                    proveedorSeleccionado === 'openrouter'
                      ? 'sk-or-v1-...'
                      : 'AIzaSy...'
                  }
                  value={inputKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    setInputKey(v);
                    if (proveedorSeleccionado === 'openrouter' && v.trim().length >= 15) {
                      void cargarModelosParaProveedor('openrouter', v.trim());
                    }
                  }}
                  autoComplete="off"
                  spellCheck="false"
                />
                <small className="form-hint">
                  {proveedorSeleccionado === 'openrouter'
                    ? 'Podés obtener tu clave gratuita en openrouter.ai/keys'
                    : 'Podés crear tu clave gratuita en aistudio.google.com'}
                </small>
              </div>
            )}

            {/* Selector de modelo en Onboarding para Ollama */}
            {proveedorSeleccionado === 'ollama' && (
              <div className="form-group mb-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label htmlFor="onboarding-model-select-ollama" className="form-label" style={{ marginBottom: 0 }}>
                    2. Modelo local disponible en Ollama:
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                    onClick={() => void cargarModelosParaProveedor('ollama')}
                    disabled={cargandoModelos}
                    title="Consultar http://localhost:11434/api/tags"
                  >
                    {cargandoModelos ? 'Buscando...' : '🔄 Actualizar modelos'}
                  </button>
                </div>
                <select
                  id="onboarding-model-select-ollama"
                  className="input input-block select-model"
                  value={modeloSeleccionado}
                  onChange={(e) => {
                    const m = e.target.value;
                    setModeloSeleccionado(m);
                    establecerModeloActivo(m);
                  }}
                  disabled={cargandoModelos}
                >
                  {modelosOpciones.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <small className="form-hint">
                  Detectado automáticamente desde tu Ollama local en <code>http://localhost:11434</code> ({modelosOpciones.length} modelo(s) disponibles).
                </small>
              </div>
            )}

            {/* Selector de modelo en Onboarding para OpenRouter */}
            {proveedorSeleccionado === 'openrouter' && (
              <div className="form-group mb-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label htmlFor="onboarding-model-select-openrouter" className="form-label" style={{ marginBottom: 0 }}>
                    3. Modelo gratuito de OpenRouter:
                  </label>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                    onClick={() => void cargarModelosParaProveedor('openrouter', inputKey)}
                    disabled={cargandoModelos}
                    title="Consultar catálogo de modelos :free en OpenRouter"
                  >
                    {cargandoModelos ? 'Cargando...' : '🔄 Listar todos los :free'}
                  </button>
                </div>
                <select
                  id="onboarding-model-select-openrouter"
                  className="input input-block select-model"
                  value={modeloSeleccionado}
                  onChange={(e) => {
                    const m = e.target.value;
                    setModeloSeleccionado(m);
                    establecerModeloActivo(m);
                  }}
                  disabled={cargandoModelos}
                >
                  {modelosOpciones.map((m) => (
                    <option key={m} value={m}>
                      {m === 'openrouter/free'
                        ? 'openrouter/free (Auto-Router: se acomoda automáticamente al mejor disponible)'
                        : m}
                    </option>
                  ))}
                </select>
                <small className="form-hint">
                  {modeloSeleccionado === 'openrouter/free'
                    ? '✨ Recomendado: openrouter/free redirige de forma transparente al modelo gratuito más óptimo que esté activo sin cuota agotada.'
                    : `Modelo seleccionado: ${modeloSeleccionado}`}
                </small>
              </div>
            )}

            <div className="form-group mb-4">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  data-testid="accept-notice-checkbox"
                  checked={avisoAceptado}
                  onChange={(e) => setAvisoAceptado(e.target.checked)}
                />
                <span>
                  He leído y comprendo las condiciones de seguridad, almacenamiento en memoria de
                  sesión y privacidad de datos.
                </span>
              </label>
            </div>

            <button
              type="submit"
              data-testid="save-key-btn"
              className="btn btn-primary btn-block"
              disabled={!puedeGuardar}
            >
              Confirmar y comenzar a aprender
            </button>
          </form>
        </section>
      ) : (
        /* Workspace con Layout Homogéneo: Sidebar de Etapas + Estudio Central */
        <div className="workspace-grid" data-testid="ready-workspace">
          {/* Panel Lateral: Menú Ergonómico de Etapas Pedagógicas */}
          <aside className="workspace-sidebar" aria-label="Ruta de aprendizaje">
            <div className="card sidebar-card">
              <div className="sidebar-header">
                <span className="module-tag">Ruta Pedagógica</span>
                <h2 className="sidebar-title">Ciencia de Datos & ML</h2>
              </div>

              <nav className="wizard-vertical-nav" aria-label="Etapas del asistente">
                {ETIQUETAS_PASOS.map((paso) => {
                  const activo = paso.numero === pasoActivo;
                  const completado = paso.numero < pasoActivo;
                  return (
                    <button
                      key={paso.numero}
                      type="button"
                      className={`wizard-step-card ${activo ? 'active' : ''} ${
                        completado ? 'completed' : ''
                      }`}
                      onClick={() => cambiarPaso(paso.numero)}
                      data-testid={`wizard-step-btn-${paso.numero}`}
                      aria-current={activo ? 'step' : undefined}
                    >
                      <span className="step-num-circle" aria-hidden="true">
                        {completado ? '✓' : paso.numero}
                      </span>
                      <span className="step-card-text">
                        <span className="step-card-title">
                          <span style={{ marginRight: '0.35rem' }}>{paso.icono}</span>
                          {paso.titulo}
                        </span>
                        <span className="step-card-sub">{paso.subtitulo}</span>
                      </span>
                    </button>
                  );
                })}
              </nav>

              <div className="sidebar-progress">
                <div className="progress-header">
                  <span>Progreso general</span>
                  <strong>{porcentajeProgreso}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={porcentajeProgreso}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${porcentajeProgreso}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Recordatorio de seguridad compacto en sidebar */}
            <details
              className="concept-box"
              style={{ marginTop: '0.85rem' }}
              data-testid="sidebar-security-box"
            >
              <summary className="concept-summary">🔒 Seguridad BYOK activa</summary>
              <div className="concept-content" style={{ fontSize: '0.78rem' }}>
                <p>
                  Proveedor: <strong>{proveedorSeleccionado.toUpperCase()}</strong>
                </p>
                <p>
                  Modelo: <code>{modeloSeleccionado}</code>
                </p>
                <p>
                  Clave: <code>{enmascararApiKey(keyGuardada)}</code>
                </p>
                <p>
                  Aislada exclusivamente en <code>sessionStorage</code>. Al cerrar la pestaña se
                  elimina automáticamente de la memoria.
                </p>
              </div>
            </details>
          </aside>

          {/* Panel Central: Contenido del Paso Activo */}
          <div className="workspace-center">
            <main id="main-content" tabIndex={-1}>
              {pasoActivo === 1 && (
                <Step1ProblemaDS
                  problema={problema}
                  onActualizarProblema={setProblema}
                  onAvanzarAPaso2={(fichaGenerada) => {
                    setFichaTecnica(fichaGenerada);
                    cambiarPaso(2);
                  }}
                />
              )}

              {pasoActivo === 2 && (
                <Step2FichaTecnicaDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  onActualizarFichaTecnica={setFichaTecnica}
                  onAvanzarAPaso3={() => cambiarPaso(3)}
                  onVolverAPaso1={() => cambiarPaso(1)}
                />
              )}

              {pasoActivo === 3 && (
                <Step3EstructuraDatosDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  onActualizarFichaTecnica={setFichaTecnica}
                  onAvanzarAPaso4={() => cambiarPaso(4)}
                  onVolverAPaso2={() => cambiarPaso(2)}
                />
              )}

              {pasoActivo === 4 && (
                <Step4SeleccionAlgoritmoDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  algoritmoSeleccionado={algoritmoSeleccionado}
                  hiperparametros={hiperparametros}
                  onActualizarAlgoritmo={setAlgoritmoSeleccionado}
                  onActualizarFichaTecnica={setFichaTecnica}
                  onActualizarHiperparametros={setHiperparametros}
                  onAvanzarAPaso5={() => cambiarPaso(5)}
                  onVolverAPaso3={() => cambiarPaso(3)}
                />
              )}

              {pasoActivo === 5 && (
                <Step5HiperparametrosDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  algoritmoSeleccionado={algoritmoSeleccionado}
                  hiperparametros={hiperparametros}
                  metricas={metricas}
                  onActualizarHiperparametros={setHiperparametros}
                  onActualizarMetricas={setMetricas}
                  onAvanzarAPaso6={() => cambiarPaso(6)}
                  onVolverAPaso4={() => cambiarPaso(4)}
                />
              )}

              {pasoActivo === 6 && (
                <Step6PipelinePythonDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  algoritmoSeleccionado={algoritmoSeleccionado}
                  hiperparametros={hiperparametros}
                  metricas={metricas}
                  onAvanzarAPaso7={() => cambiarPaso(7)}
                  onVolverAPaso5={() => cambiarPaso(5)}
                />
              )}

              {pasoActivo === 7 && (
                <Step7EjecucionWasmDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  algoritmoSeleccionado={algoritmoSeleccionado}
                  hiperparametros={hiperparametros}
                  metricas={metricas}
                  onActualizarMetricas={setMetricas}
                  onAvanzarAPaso8={() => cambiarPaso(8)}
                  onVolverAPaso6={() => cambiarPaso(6)}
                />
              )}

              {pasoActivo === 8 && (
                <Step8PerfiladoBIDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  algoritmoSeleccionado={algoritmoSeleccionado}
                  hiperparametros={hiperparametros}
                  metricas={metricas}
                  perfiles={perfiles}
                  onActualizarPerfiles={setPerfiles}
                  onAvanzarAPaso9={() => cambiarPaso(9)}
                  onVolverAPaso7={() => cambiarPaso(7)}
                />
              )}

              {pasoActivo === 9 && (
                <StepEntregablesDS
                  fichaTecnica={fichaTecnica}
                  problemaOriginal={problema}
                  algoritmoSeleccionado={algoritmoSeleccionado}
                  hiperparametros={hiperparametros}
                  metricas={metricas}
                  perfiles={perfiles}
                  onVolverAPaso8={() => cambiarPaso(8)}
                  onReiniciarProyecto={() => {
                    cambiarPaso(1);
                  }}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Modal accesible del Glosario Conceptual */}
      <GlossaryModalDS
        abierto={glosarioAbierto}
        onCerrar={() => setGlosarioAbierto(false)}
      />
    </div>
  );
}
