import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { FichaTecnicaDS, HiperparametrosClustering, MetricasEvaluacion } from '../src/core/schemas';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import {
  generarPerfilesDeNegocio,
  optimizarPerfilesConIA,
  generarGuiaPowerBI,
} from '../src/core/businessProfile';
import { Step8PerfiladoBIDS } from '../src/steps/Step8PerfiladoBIDS';
import { cargarProyectoDeIDB, limpiarProyectoDeIDB } from '../src/core/storageDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 6 — Motor de Perfilado de Negocio y Conexión con BI', () => {
  const fichaRetail: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('genera perfiles de negocio coherentes para segmentación retail con acciones recomendadas', () => {
    const perfiles = generarPerfilesDeNegocio({
      fichaTecnica: fichaRetail,
      algoritmo: 'kmeans',
      resumenClusters: [
        { cluster: 0, conteo: 40, porcentaje: 33.3, medias: { recencia_dias: 25, frecuencia_anual: 3 } },
        { cluster: 1, conteo: 40, porcentaje: 33.3, medias: { recencia_dias: 95, frecuencia_anual: 14 } },
        { cluster: 2, conteo: 40, porcentaje: 33.4, medias: { recencia_dias: 180, frecuencia_anual: 22 } },
      ],
    });

    expect(perfiles.length).toBe(3);
    expect(perfiles[0].nombreDescriptivo).toBeTruthy();
    expect(perfiles[0].caracteristicasClave.length).toBeGreaterThan(0);
    expect(perfiles[0].accionDeNegocioRecomendada).toBeTruthy();
    expect(perfiles[0].tamanoRelativoPct).toBe(33.3);
  });

  it('identifica y perfila adecuadamente el cluster de ruido (-1) en DBSCAN', () => {
    const fichaDBSCAN: FichaTecnicaDS = {
      ...PRESETS_CASOS_DS[1].fichaTecnicaInicial,
    };

    const perfiles = generarPerfilesDeNegocio({
      fichaTecnica: fichaDBSCAN,
      algoritmo: 'dbscan',
      resumenClusters: [
        { cluster: -1, conteo: 12, porcentaje: 10.0, medias: {} },
        { cluster: 0, conteo: 54, porcentaje: 45.0, medias: {} },
        { cluster: 1, conteo: 54, porcentaje: 45.0, medias: {} },
      ],
    });

    const perfilRuido = perfiles.find((p) => p.clusterId === -1);
    expect(perfilRuido).toBeDefined();
    expect(perfilRuido?.nombreDescriptivo).toContain('Ruido');
    expect(perfilRuido?.accionDeNegocioRecomendada).toContain('auditoría');
  });

  it('produce fórmulas DAX y recomendaciones de modelado en estrella para Power BI', () => {
    const perfiles = generarPerfilesDeNegocio({
      fichaTecnica: fichaRetail,
      algoritmo: 'kmeans',
    });

    const guia = generarGuiaPowerBI({ fichaTecnica: fichaRetail, perfiles });

    expect(guia.modeloRecomendado).toContain('Esquema en Estrella');
    expect(guia.medidasDAX.length).toBeGreaterThanOrEqual(3);

    const tieneCalculate = guia.medidasDAX.some((m) => m.formula.includes('CALCULATE'));
    const tieneDivide = guia.medidasDAX.some((m) => m.formula.includes('DIVIDE'));
    expect(tieneCalculate).toBe(true);
    expect(tieneDivide).toBe(true);

    expect(guia.pasosImportacion.length).toBeGreaterThanOrEqual(4);
    expect(guia.kpisSugeridos.length).toBeGreaterThanOrEqual(3);
  });

  it('ofrece fallback seguro al optimizar perfiles con IA sin conexión', async () => {
    const perfiles = await optimizarPerfilesConIA({
      fichaTecnica: fichaRetail,
      algoritmo: 'kmeans',
    });

    expect(perfiles).toBeDefined();
    expect(perfiles.length).toBeGreaterThanOrEqual(1);
    expect(perfiles[0].nombreDescriptivo).toBeTruthy();
  });
});

describe('Fase 6 — Componente Step8PerfiladoBIDS', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  const hiperInicial: HiperparametrosClustering = {
    algoritmo: 'kmeans',
    k: 3,
    randomState: 42,
    justificacionEstudiante: 'K=3 óptimo',
  };

  const metricasInicial: MetricasEvaluacion = {
    inercia: 1250,
    silhouetteScore: 0.68,
    numeroClustersIdentificados: 3,
  };

  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('renderiza encabezado unificado, caja conceptual y pestañas de trabajo', () => {
    render(
      <Step8PerfiladoBIDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onActualizarPerfiles={vi.fn()}
        onAvanzarAPaso9={vi.fn()}
        onVolverAPaso7={vi.fn()}
      />
    );

    expect(screen.getByTestId('step8-container')).toBeInTheDocument();
    expect(screen.getByTestId('step8-concept-box')).toBeInTheDocument();
    expect(screen.getByTestId('tab-perfiles-btn')).toBeInTheDocument();
    expect(screen.getByTestId('tab-powerbi-btn')).toBeInTheDocument();
    expect(screen.getByTestId('tab-sintesis-btn')).toBeInTheDocument();
    expect(screen.getByTestId('perfiles-grid')).toBeInTheDocument();
  });

  it('permite alternar a la pestaña de Power BI y copiar medidas DAX al portapapeles', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <Step8PerfiladoBIDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onActualizarPerfiles={vi.fn()}
        onAvanzarAPaso9={vi.fn()}
        onVolverAPaso7={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('tab-powerbi-btn'));
    expect(screen.getByTestId('powerbi-section')).toBeInTheDocument();

    const btnCopiarDAX = screen.getByTestId('copy-dax-btn-0');
    fireEvent.click(btnCopiarDAX);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText('✓ Copiado')).toBeInTheDocument();
    });
  });

  it('permite alternar a la pestaña de Síntesis Ejecutiva para stakeholders', () => {
    render(
      <Step8PerfiladoBIDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onActualizarPerfiles={vi.fn()}
        onAvanzarAPaso9={vi.fn()}
        onVolverAPaso7={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('tab-sintesis-btn'));
    expect(screen.getByTestId('sintesis-ejecutiva')).toBeInTheDocument();
    expect(screen.getByText(/Síntesis Estratégica/)).toBeInTheDocument();
  });

  it('permite editar el nombre y la recomendación de un perfil y persistir en IndexedDB', async () => {
    const onAvanzar = vi.fn();
    const onActualizarPerfiles = vi.fn();

    render(
      <Step8PerfiladoBIDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onActualizarPerfiles={onActualizarPerfiles}
        onAvanzarAPaso9={onAvanzar}
        onVolverAPaso7={vi.fn()}
      />
    );

    const inputNombre = screen.getByTestId('profile-name-input-0');
    fireEvent.change(inputNombre, { target: { value: 'Compradores VIP Personalizados' } });

    expect(onActualizarPerfiles).toHaveBeenCalled();

    const btnConfirmar = screen.getByTestId('confirm-step8-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado).not.toBeNull();
    expect(cargado?.perfiles).toBeDefined();
  });
});

describe('Fase 6 — Integración Completa en el Wizard de App', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('navega secuencialmente desde el Paso 1 hasta el Paso 8 verificando el avance en el sidebar', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    // Paso 1 -> Paso 2
    fireEvent.click(screen.getByTestId('preset-btn-retail-segmentacion-clientes'));
    fireEvent.click(screen.getByTestId('evaluate-clarity-btn'));
    await waitFor(
      () => {
        expect(screen.getByTestId('confirm-step1-btn')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    fireEvent.click(screen.getByTestId('confirm-step1-btn'));

    // Paso 2 -> Paso 3
    await waitFor(() => {
      expect(screen.getByTestId('step2-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step2-btn'));

    // Paso 3 -> Paso 4
    await waitFor(() => {
      expect(screen.getByTestId('step3-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step3-btn'));

    // Paso 4 -> Paso 5
    await waitFor(() => {
      expect(screen.getByTestId('step4-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step4-btn'));

    // Paso 5 -> Paso 6
    await waitFor(() => {
      expect(screen.getByTestId('step5-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step5-btn'));

    // Paso 6 -> Paso 7
    await waitFor(() => {
      expect(screen.getByTestId('step6-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step6-btn'));

    // Paso 7 -> Paso 8
    await waitFor(() => {
      expect(screen.getByTestId('step7-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step7-btn'));

    // Paso 8: Perfilado de Negocio y Power BI
    await waitFor(() => {
      expect(screen.getByTestId('step8-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-8')).toHaveClass('active');

    // Confirmar Paso 8 avanza al Paso 9 (Entregables)
    fireEvent.click(screen.getByTestId('confirm-step8-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('step9-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-9')).toHaveClass('active');
  });
});
