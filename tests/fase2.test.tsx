import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { FichaTecnicaDS } from '../src/core/schemas';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import {
  validarModeloDS,
  resolverAdvertenciaPedagogica,
} from '../src/core/modelValidatorDS';
import {
  cargarProyectoDeIDB,
  limpiarProyectoDeIDB,
} from '../src/core/storageDS';
import { Step3EstructuraDatosDS } from '../src/steps/Step3EstructuraDatosDS';
import { Step4SeleccionAlgoritmoDS } from '../src/steps/Step4SeleccionAlgoritmoDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 2 — Validador Determinístico (5 Reglas Pedagógicas)', () => {
  const fichaBase: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('Regla 1 (Escala en K-Means): emite advertencia crítica si hay variables numéricas sin StandardScaler', () => {
    const fichaSinEscalar: FichaTecnicaDS = {
      ...fichaBase,
      variables: fichaBase.variables.map((v) => ({
        ...v,
        escaladoRecomendado: 'ninguno' as const,
      })),
    };

    const advertencias = validarModeloDS(fichaSinEscalar, 'kmeans');
    const advEscala = advertencias.find((a) => a.regla === 'escala_kmeans');
    expect(advEscala).toBeDefined();
    expect(advEscala?.nivel).toBe('critica');
    expect(advEscala?.mensaje).toContain('sin escalado activado');
    expect(advEscala?.explicacionPedagogica).toContain('Z-Score');

    // Prueba resolución rápida
    const resuelta = resolverAdvertenciaPedagogica(
      fichaSinEscalar,
      advEscala!,
      'kmeans'
    );
    const nuevasSinEscalar = resuelta.fichaActualizada.variables.filter(
      (v) =>
        v.rol === 'feature' &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta') &&
        v.escaladoRecomendado === 'ninguno'
    );
    expect(nuevasSinEscalar.length).toBe(0);
  });

  it('Regla 2 (Formas No Convexas): advierte si se usa K-Means con datos de lunas o geometría compleja', () => {
    const fichaLunas: FichaTecnicaDS = {
      ...fichaBase,
      problemaNegocio: 'Sensores industriales con trayectorias en semilunas entrelazadas y curvas.',
    };

    const advertencias = validarModeloDS(fichaLunas, 'kmeans');
    const advLunas = advertencias.find((a) => a.regla === 'formas_no_convexas');
    expect(advLunas).toBeDefined();
    expect(advLunas?.explicacionPedagogica).toContain('hiper-esféricas');

    // Resolución rápida sugiere DBSCAN
    const resuelta = resolverAdvertenciaPedagogica(fichaLunas, advLunas!, 'kmeans');
    expect(resuelta.nuevoAlgoritmo).toBe('dbscan');
  });

  it('Regla 3 (Outliers y Ruido): advierte si se usa K-Means con presencia explícita de anomalías o ruido', () => {
    const fichaRuido: FichaTecnicaDS = {
      ...fichaBase,
      problemaNegocio: 'Monitoreo de turbinas con picos eléctricos y lecturas anómalas de ruido.',
    };

    const advertencias = validarModeloDS(fichaRuido, 'kmeans');
    const advRuido = advertencias.find((a) => a.regla === 'outliers_ruido');
    expect(advRuido).toBeDefined();
    expect(advRuido?.explicacionPedagogica).toContain('etiqueta -1');
  });

  it('Regla 4 (Features Insuficientes): bloquea con error crítico si hay menos de 2 features cuantitativas', () => {
    const fichaPocasFeatures: FichaTecnicaDS = {
      ...fichaBase,
      variables: [
        {
          nombre: 'edad',
          tipo: 'numerica_continua',
          descripcion: 'Edad',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion: 'Única variable cuantitativa',
        },
      ],
    };

    const advertencias = validarModeloDS(fichaPocasFeatures, 'kmeans');
    const advInsuficiente = advertencias.find(
      (a) => a.regla === 'features_insuficientes'
    );
    expect(advInsuficiente).toBeDefined();
    expect(advInsuficiente?.nivel).toBe('critica');
  });

  it('Regla 5 (Dimensionalidad Excesiva): advierte si hay más de 10 atributos ("maldición de la dimensionalidad")', () => {
    const variablesMuchas = Array.from({ length: 12 }, (_, i) => ({
      nombre: `feature_${i + 1}`,
      tipo: 'numerica_continua' as const,
      descripcion: `Variable ${i + 1}`,
      rol: 'feature' as const,
      escaladoRecomendado: 'standard_scaler' as const,
      justificacion: 'Atributo de prueba',
    }));

    const fichaMuchas: FichaTecnicaDS = {
      ...fichaBase,
      variables: variablesMuchas,
    };

    const advertencias = validarModeloDS(fichaMuchas, 'kmeans');
    const advDim = advertencias.find(
      (a) => a.regla === 'dimensionalidad_excesiva'
    );
    expect(advDim).toBeDefined();
    expect(advDim?.explicacionPedagogica).toContain('maldición de la dimensionalidad');
  });
});

describe('Fase 2 — Componente Step3EstructuraDatosDS (EDA y Preprocesamiento)', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('renderiza encabezado unificado, caja conceptual y tabla EDA', () => {
    const onActualizarFicha = vi.fn();
    const onAvanzar = vi.fn();
    const onVolver = vi.fn();

    render(
      <Step3EstructuraDatosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={onActualizarFicha}
        onAvanzarAPaso4={onAvanzar}
        onVolverAPaso2={onVolver}
      />
    );

    expect(screen.getByTestId('step3-container')).toBeInTheDocument();
    expect(screen.getByTestId('step3-concept-box')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('step3-concept-box')).getAllByText(/StandardScaler/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('eda-table')).toBeInTheDocument();
  });

  it('permite aplicar StandardScaler a todas las cuantitativas con un solo clic', () => {
    const fichaSinEscalar: FichaTecnicaDS = {
      ...fichaInicial,
      variables: fichaInicial.variables.map((v) => ({
        ...v,
        escaladoRecomendado: 'ninguno' as const,
      })),
    };
    const onActualizarFicha = vi.fn();

    render(
      <Step3EstructuraDatosDS
        fichaTecnica={fichaSinEscalar}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={onActualizarFicha}
        onAvanzarAPaso4={vi.fn()}
        onVolverAPaso2={vi.fn()}
      />
    );

    // Debe mostrar la alerta de escala
    expect(screen.getByTestId('scale-warning-box')).toBeInTheDocument();

    const btnEstandarizar = screen.getByTestId('standardize-all-btn');
    fireEvent.click(btnEstandarizar);

    expect(onActualizarFicha).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.arrayContaining([
          expect.objectContaining({
            rol: 'feature',
            escaladoRecomendado: 'standard_scaler',
          }),
        ]),
      })
    );
  });

  it('avanza al Paso 4 al confirmar preprocesamiento y persiste en IndexedDB', async () => {
    const onAvanzar = vi.fn();

    render(
      <Step3EstructuraDatosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        onActualizarFichaTecnica={vi.fn()}
        onAvanzarAPaso4={onAvanzar}
        onVolverAPaso2={vi.fn()}
      />
    );

    const btnConfirmar = screen.getByTestId('confirm-step3-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado).not.toBeNull();
  });
});

describe('Fase 2 — Componente Step4SeleccionAlgoritmoDS (Algoritmo y Supuestos)', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('renderiza las 3 tarjetas de algoritmos (K-Means, Jerárquico, DBSCAN)', () => {
    const onActualizarAlgoritmo = vi.fn();

    render(
      <Step4SeleccionAlgoritmoDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarAlgoritmo={onActualizarAlgoritmo}
        onActualizarFichaTecnica={vi.fn()}
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso5={vi.fn()}
        onVolverAPaso3={vi.fn()}
      />
    );

    expect(screen.getByTestId('step4-container')).toBeInTheDocument();
    expect(screen.getByTestId('algorithm-card-kmeans')).toBeInTheDocument();
    expect(screen.getByTestId('algorithm-card-jerarquico')).toBeInTheDocument();
    expect(screen.getByTestId('algorithm-card-dbscan')).toBeInTheDocument();
  });

  it('permite cambiar de algoritmo haciendo clic en una tarjeta', () => {
    const onActualizarAlgoritmo = vi.fn();

    render(
      <Step4SeleccionAlgoritmoDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarAlgoritmo={onActualizarAlgoritmo}
        onActualizarFichaTecnica={vi.fn()}
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso5={vi.fn()}
        onVolverAPaso3={vi.fn()}
      />
    );

    const btnDBSCAN = screen.getByTestId('select-dbscan-btn');
    fireEvent.click(btnDBSCAN);

    expect(onActualizarAlgoritmo).toHaveBeenCalledWith('dbscan');
  });

  it('muestra advertencia del validador y botón de resolución rápida ante datos no convexos', () => {
    const fichaLunas: FichaTecnicaDS = {
      ...fichaInicial,
      problemaNegocio: 'Sensor de turbinas industriales con trayectorias en semilunas curvadas.',
    };
    const onActualizarAlgoritmo = vi.fn();

    render(
      <Step4SeleccionAlgoritmoDS
        fichaTecnica={fichaLunas}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarAlgoritmo={onActualizarAlgoritmo}
        onActualizarFichaTecnica={vi.fn()}
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso5={vi.fn()}
        onVolverAPaso3={vi.fn()}
      />
    );

    expect(
      screen.getByTestId('validator-alert-formas_no_convexas')
    ).toBeInTheDocument();

    const btnQuickFix = screen.getByTestId('quick-fix-btn-formas_no_convexas');
    fireEvent.click(btnQuickFix);

    expect(onActualizarAlgoritmo).toHaveBeenCalledWith('dbscan');
  });

  it('guarda en IndexedDB y avanza al Paso 5 al confirmar el algoritmo', async () => {
    const onAvanzar = vi.fn();
    const onActualizarHiperparametros = vi.fn();

    render(
      <Step4SeleccionAlgoritmoDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarAlgoritmo={vi.fn()}
        onActualizarFichaTecnica={vi.fn()}
        onActualizarHiperparametros={onActualizarHiperparametros}
        onAvanzarAPaso5={onAvanzar}
        onVolverAPaso3={vi.fn()}
      />
    );

    const btnConfirmar = screen.getByTestId('confirm-step4-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado?.hiperparametros?.algoritmo).toBe('kmeans');
  });
});

describe('Fase 2 — Integración Completa en el Wizard de App', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('navega secuencialmente desde el Paso 1 al Paso 4 manteniendo el estado persistido', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    // Paso 1: Selecciona preset retail y evalúa
    const btnPreset = screen.getByTestId('preset-btn-retail-segmentacion-clientes');
    fireEvent.click(btnPreset);

    const btnEvaluar = screen.getByTestId('evaluate-clarity-btn');
    fireEvent.click(btnEvaluar);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-step1-btn')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('confirm-step1-btn'));

    // Paso 2: Ficha Técnica
    await waitFor(() => {
      expect(screen.getByTestId('step2-container')).toBeInTheDocument();
    }, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('confirm-step2-btn'));

    // Paso 3: EDA y Preprocesamiento
    await waitFor(() => {
      expect(screen.getByTestId('step3-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step3-btn'));

    // Paso 4: Selección de Algoritmo
    await waitFor(() => {
      expect(screen.getByTestId('step4-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-4')).toHaveClass('active');
  });
});
