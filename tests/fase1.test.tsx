import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import {
  FichaTecnicaSchema,
  AclaracionDSSchema,
  ProyectoDSSchema,
  FichaTecnicaDS,
} from '../src/core/schemas';
import {
  evaluarClaridadProblemaDS,
  generarFichaTecnicaDS,
} from '../src/core/clarityDS';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import {
  guardarProyectoEnIDB,
  cargarProyectoDeIDB,
  limpiarProyectoDeIDB,
  registrarDecisionEnIDB,
  obtenerBitacoraDecisionesDeIDB,
} from '../src/core/storageDS';
import { Step1ProblemaDS } from '../src/steps/Step1ProblemaDS';
import { Step2FichaTecnicaDS } from '../src/steps/Step2FichaTecnicaDS';
import { configurarClienteGeminiMock } from '../src/core/gemini';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 1 — Esquemas Zod y Contratos de Datos', () => {
  it('valida correctamente una Ficha Técnica formal según las pautas de cátedra', () => {
    const preset = PRESETS_CASOS_DS[0];
    const parseado = FichaTecnicaSchema.safeParse(preset.fichaTecnicaInicial);
    expect(parseado.success).toBe(true);
  });

  it('rechaza una Ficha Técnica sin variables o con justificación insuficiente', () => {
    const invalida = {
      problemaNegocio: 'Problema de prueba',
      paradigma: 'no_supervisado',
      tarea: 'clustering',
      justificacionParadigma: 'ok', // Demasiado corto
      variables: [], // Invalido: requiere min(1)
      restricciones: [],
    };
    const res = FichaTecnicaSchema.safeParse(invalida);
    expect(res.success).toBe(false);
  });

  it('valida el esquema de aclaración socrática AclaracionDSSchema', () => {
    const aclaracionValida = {
      suficiente: false,
      preguntas: ['¿Cuáles son las variables numéricas clave?'],
      supuestosAConfirmar: ['Datos consolidados'],
    };
    expect(AclaracionDSSchema.safeParse(aclaracionValida).success).toBe(true);
  });

  it('valida el esquema de proyecto completo ProyectoDSSchema', () => {
    const proyecto = {
      id: 'proyecto-actual',
      version: 1,
      fechaCreacion: new Date().toISOString(),
      problemaOriginal: 'Segmentación de clientes',
      fichaTecnica: PRESETS_CASOS_DS[0].fichaTecnicaInicial,
      bitacoraDecisiones: [
        {
          id: 'dec-1',
          paso: 1,
          fecha: new Date().toISOString(),
          descripcion: 'Cargó preset retail',
          origen: 'estudiante' as const,
        },
      ],
    };
    expect(ProyectoDSSchema.safeParse(proyecto).success).toBe(true);
  });
});

describe('Fase 1 — Persistencia en IndexedDB y Seguridad BYOK', () => {
  beforeEach(async () => {
    await limpiarProyectoDeIDB();
  });

  it('persiste y recupera un proyecto en IndexedDB de forma íntegra', async () => {
    const preset = PRESETS_CASOS_DS[0];
    await guardarProyectoEnIDB({
      id: 'proyecto-actual',
      version: 1,
      fechaCreacion: new Date().toISOString(),
      problemaOriginal: preset.problemaTexto,
      fichaTecnica: preset.fichaTecnicaInicial,
      bitacoraDecisiones: [],
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado).not.toBeNull();
    expect(cargado?.problemaOriginal).toBe(preset.problemaTexto);
    expect(cargado?.fichaTecnica.variables.length).toBe(
      preset.fichaTecnicaInicial.variables.length
    );
  });

  it('registra decisiones en la bitácora de IndexedDB', async () => {
    await registrarDecisionEnIDB({
      paso: 1,
      fecha: new Date().toISOString(),
      descripcion: 'Estudiante seleccionó preset de retail',
      origen: 'estudiante',
    });

    const bitacora = await obtenerBitacoraDecisionesDeIDB();
    expect(bitacora.length).toBe(1);
    expect(bitacora[0].descripcion).toContain('retail');
  });

  it('REGLA DE SEGURIDAD: Bloquea cualquier intento de persistir la API key en IndexedDB', async () => {
    const proyectoConLeak = {
      id: 'proyecto-actual',
      version: 1 as const,
      fechaCreacion: new Date().toISOString(),
      problemaOriginal: `Mi clave es ${FAKE_KEY}`,
      fichaTecnica: PRESETS_CASOS_DS[0].fichaTecnicaInicial,
      bitacoraDecisiones: [],
    };

    await expect(guardarProyectoEnIDB(proyectoConLeak)).rejects.toThrow(
      /VIOLACIÓN DE SEGURIDAD BYOK/i
    );
  });
});

describe('Fase 1 — Evaluación de Claridad y Detección de Ambigüedad', () => {
  it('detecta planteo ambiguo y formula preguntas socráticas', async () => {
    const resultado = await evaluarClaridadProblemaDS('quiero vender más');
    expect(resultado.suficiente).toBe(false);
    expect(resultado.preguntas.length).toBeGreaterThanOrEqual(2);
  });

  it('confirma claridad cuando el estudiante responde las preguntas aclaratorias', async () => {
    const resultado = await evaluarClaridadProblemaDS('quiero vender más', [
      {
        pregunta: '¿Qué variables tenés?',
        respuesta: 'Tengo ticket promedio y frecuencia anual de compra.',
      },
      {
        pregunta: '¿Cuál es el objetivo?',
        respuesta: 'Segmentar clientes para fidelización sin etiquetas previas.',
      },
    ]);
    expect(resultado.suficiente).toBe(true);
  });

  it('genera una Ficha Técnica formal válida con fallback heurístico o LLM', async () => {
    const ficha = await generarFichaTecnicaDS(PRESETS_CASOS_DS[1].problemaTexto);
    expect(ficha.paradigma).toBe('no_supervisado');
    expect(ficha.tarea).toBe('clustering');
    expect(ficha.variables.length).toBeGreaterThanOrEqual(2);
    expect(FichaTecnicaSchema.safeParse(ficha).success).toBe(true);
  });

  it('consume respuestas estructuradas del LLM mockeado correctamente', async () => {
    guardarApiKey(FAKE_KEY);
    configurarClienteGeminiMock({
      generarContenido: async () =>
        JSON.stringify({
          suficiente: false,
          preguntas: ['¿Pregunta mock 1?', '¿Pregunta mock 2?'],
          supuestosAConfirmar: ['Supuesto mock'],
        }),
    });

    const res = await evaluarClaridadProblemaDS('Problema de prueba para mock');
    expect(res.suficiente).toBe(false);
    expect(res.preguntas).toContain('¿Pregunta mock 1?');
    configurarClienteGeminiMock(null);
  });
});

describe('Fase 1 — Componente Step1ProblemaDS (Planteo y Presets)', () => {
  it('renderiza encabezado unificado, caja conceptual y los 4 presets curriculares', () => {
    const onActualizarProblema = vi.fn();
    const onAvanzarAPaso2 = vi.fn();

    render(
      <Step1ProblemaDS
        problema=""
        onActualizarProblema={onActualizarProblema}
        onAvanzarAPaso2={onAvanzarAPaso2}
      />
    );

    expect(screen.getByTestId('step1-container')).toBeInTheDocument();
    expect(screen.getByTestId('step1-concept-box')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('step1-concept-box')).getByText(/BI.*vs.*AP/i)
    ).toBeInTheDocument();

    // Verifica la presencia de los 4 presets del curso
    expect(screen.getByTestId('preset-btn-retail-segmentacion-clientes')).toBeInTheDocument();
    expect(screen.getByTestId('preset-btn-sensores-anomalias-dbscan')).toBeInTheDocument();
    expect(screen.getByTestId('preset-btn-jerarquico-taxonomia-productos')).toBeInTheDocument();
    expect(screen.getByTestId('preset-btn-bi-dashboard-ventas-kpis')).toBeInTheDocument();
  });

  it('permite seleccionar un preset didáctico y actualiza el problema', () => {
    const onActualizarProblema = vi.fn();
    const onAvanzarAPaso2 = vi.fn();

    render(
      <Step1ProblemaDS
        problema=""
        onActualizarProblema={onActualizarProblema}
        onAvanzarAPaso2={onAvanzarAPaso2}
      />
    );

    const btnPreset = screen.getByTestId('preset-btn-retail-segmentacion-clientes');
    fireEvent.click(btnPreset);

    expect(onActualizarProblema).toHaveBeenCalledWith(
      expect.stringContaining('tienda online de indumentaria')
    );
  });

  it('muestra diálogo de preguntas socráticas si el problema es ambiguo', async () => {
    const onActualizarProblema = vi.fn();
    const onAvanzarAPaso2 = vi.fn();

    render(
      <Step1ProblemaDS
        problema="quiero vender más"
        onActualizarProblema={onActualizarProblema}
        onAvanzarAPaso2={onAvanzarAPaso2}
      />
    );

    const btnEvaluar = screen.getByTestId('evaluate-clarity-btn');
    fireEvent.click(btnEvaluar);

    await waitFor(() => {
      expect(screen.getByTestId('clarification-dialog')).toBeInTheDocument();
    });

    expect(screen.getByTestId('question-response-input-0')).toBeInTheDocument();
  });
});

describe('Fase 1 — Componente Step2FichaTecnicaDS (Ficha Técnica)', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('renderiza la Ficha Técnica con selector de paradigma y tabla de variables', () => {
    const onActualizarFicha = vi.fn();
    const onAvanzar = vi.fn();
    const onVolver = vi.fn();

    render(
      <Step2FichaTecnicaDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={onActualizarFicha}
        onAvanzarAPaso3={onAvanzar}
        onVolverAPaso1={onVolver}
      />
    );

    expect(screen.getByTestId('step2-container')).toBeInTheDocument();
    expect(screen.getByTestId('step2-concept-box')).toBeInTheDocument();
    expect(screen.getByTestId('paradigm-select')).toBeInTheDocument();
    expect(screen.getByTestId('variables-table')).toBeInTheDocument();
  });

  it('permite agregar una variable a la Ficha Técnica', () => {
    const onActualizarFicha = vi.fn();
    const onAvanzar = vi.fn();
    const onVolver = vi.fn();

    render(
      <Step2FichaTecnicaDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={onActualizarFicha}
        onAvanzarAPaso3={onAvanzar}
        onVolverAPaso1={onVolver}
      />
    );

    const btnAdd = screen.getByTestId('add-variable-btn');
    fireEvent.click(btnAdd);

    expect(onActualizarFicha).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.arrayContaining([
          expect.objectContaining({ rol: 'feature' }),
        ]),
      })
    );
  });

  it('avanza al Paso 3 al confirmar la Ficha Técnica y guarda en IndexedDB', async () => {
    const onActualizarFicha = vi.fn();
    const onAvanzar = vi.fn();
    const onVolver = vi.fn();

    render(
      <Step2FichaTecnicaDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={onActualizarFicha}
        onAvanzarAPaso3={onAvanzar}
        onVolverAPaso1={onVolver}
      />
    );

    const btnConfirmar = screen.getByTestId('confirm-step2-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado).not.toBeNull();
    expect(cargado?.fichaTecnica.paradigma).toBe('no_supervisado');
  });

  it('permite regresar al Paso 1 con el botón de volver', () => {
    const onActualizarFicha = vi.fn();
    const onAvanzar = vi.fn();
    const onVolver = vi.fn();

    render(
      <Step2FichaTecnicaDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={onActualizarFicha}
        onAvanzarAPaso3={onAvanzar}
        onVolverAPaso1={onVolver}
      />
    );

    const btnVolver = screen.getByTestId('back-to-step1-btn');
    fireEvent.click(btnVolver);
    expect(onVolver).toHaveBeenCalled();
  });
});

describe('Fase 1 — Integración en App Shell (Workspace)', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('muestra el Paso 1 al iniciar sesión con una clave y permite navegar al Paso 2', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    // Verifica que el workspace está listo
    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    // Paso 1 activo
    expect(screen.getByTestId('step1-container')).toBeInTheDocument();

    // Selecciona un preset didáctico
    const btnPreset = screen.getByTestId('preset-btn-retail-segmentacion-clientes');
    fireEvent.click(btnPreset);

    // Evalúa claridad
    const btnEvaluar = screen.getByTestId('evaluate-clarity-btn');
    fireEvent.click(btnEvaluar);

    await waitFor(
      () => {
        expect(screen.getByTestId('clarity-success-alert')).toBeInTheDocument();
      },
      { timeout: 3500 }
    );

    // Confirmar y avanzar al Paso 2
    const btnConfirmarPaso1 = screen.getByTestId('confirm-step1-btn');
    fireEvent.click(btnConfirmarPaso1);

    await waitFor(() => {
      expect(screen.getByTestId('step2-container')).toBeInTheDocument();
    });

    // Verifica que el sidebar refleja el cambio
    const step2Btn = screen.getByTestId('wizard-step-btn-2');
    expect(step2Btn).toHaveClass('active');
  });
});
