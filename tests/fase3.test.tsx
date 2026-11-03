import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { FichaTecnicaDS } from '../src/core/schemas';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import {
  generarDiagnosticoKMeans,
  generarDiagnosticoDBSCAN,
  generarDiagnosticoJerarquico,
} from '../src/core/metrics/diagnostics';
import {
  cargarProyectoDeIDB,
  limpiarProyectoDeIDB,
} from '../src/core/storageDS';
import { Step5HiperparametrosDS } from '../src/steps/Step5HiperparametrosDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 3 — Motor de Diagnóstico Matemático (Codo, Silueta, Dendrograma)', () => {
  it('garantiza propiedades matemáticas de K-Means (WCSS monótonamente decreciente y Silueta en [-1, 1])', () => {
    const diag = generarDiagnosticoKMeans(3);
    expect(diag.puntos.length).toBe(9); // K de 2 a 10

    // Verifica monotonía decreciente de la inercia (WCSS)
    for (let i = 1; i < diag.puntos.length; i++) {
      expect(diag.puntos[i].inercia).toBeLessThan(diag.puntos[i - 1].inercia);
    }

    // Verifica rango acotado del Coeficiente de Silueta [-1, 1]
    for (const p of diag.puntos) {
      expect(p.silhouette).toBeGreaterThanOrEqual(-1);
      expect(p.silhouette).toBeLessThanOrEqual(1);
    }

    // Codo óptimo identificado
    expect(diag.kOptimo).toBe(3);
    expect(diag.explicacion).toContain('K=3');
  });

  it('calibra correctamente el comportamiento de densidad y ruido en DBSCAN', () => {
    // Caso con eps pequeño -> alto ruido
    const diagBajo = generarDiagnosticoDBSCAN(0.15, 5);
    expect(diagBajo.porcentajeRuido).toBeGreaterThan(40);
    expect(diagBajo.explicacion).toContain('restrictivo');

    // Caso óptimo -> 2 clusters y bajo ruido
    const diagOptimo = generarDiagnosticoDBSCAN(0.5, 5);
    expect(diagOptimo.clustersEstimados).toBe(2);
    expect(diagOptimo.porcentajeRuido).toBeLessThanOrEqual(12);
    expect(diagOptimo.silhouette).toBeGreaterThanOrEqual(0.5);
    expect(diagOptimo.puntosSimulados.length).toBeGreaterThan(30);
  });

  it('evalúa criterios de enlace y altura de corte en Clustering Jerárquico', () => {
    const diagWard = generarDiagnosticoJerarquico('ward', 3);
    expect(diagWard.silhouette).toBeGreaterThan(0.55); // Ward produce clusters compactos
    expect(diagWard.alturaCorte).toBeGreaterThan(0);
    expect(diagWard.ramas.length).toBeGreaterThanOrEqual(4);

    const diagSingle = generarDiagnosticoJerarquico('single', 3);
    expect(diagSingle.explicacion).toContain('encadenamiento');
  });
});

describe('Fase 3 — Componente Step5HiperparametrosDS (K-Means y SVGs)', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('renderiza encabezado unificado, caja conceptual y el gráfico SVG interactivo', () => {
    const onActualizarParams = vi.fn();
    const onAvanzar = vi.fn();

    render(
      <Step5HiperparametrosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarHiperparametros={onActualizarParams}
        onAvanzarAPaso6={onAvanzar}
        onVolverAPaso4={vi.fn()}
      />
    );

    expect(screen.getByTestId('step5-container')).toBeInTheDocument();
    expect(screen.getByTestId('step5-concept-box')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('step5-concept-box')).getAllByText(/Método del Codo/i).length
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getByTestId('codo-svg-chart')).toBeInTheDocument();
    expect(screen.getByTestId('curva-codo-layer')).toBeInTheDocument();
  });

  it('permite alternar entre la vista de Curva del Codo y la vista de Silueta en SVG', () => {
    render(
      <Step5HiperparametrosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso6={vi.fn()}
        onVolverAPaso4={vi.fn()}
      />
    );

    const tabSilueta = screen.getByTestId('tab-silueta-btn');
    fireEvent.click(tabSilueta);

    expect(screen.getByTestId('silueta-layer')).toBeInTheDocument();

    const tabCodo = screen.getByTestId('tab-codo-btn');
    fireEvent.click(tabCodo);

    expect(screen.getByTestId('curva-codo-layer')).toBeInTheDocument();
  });

  it('permite cambiar K haciendo clic en un punto del SVG o moviendo el slider', () => {
    render(
      <Step5HiperparametrosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso6={vi.fn()}
        onVolverAPaso4={vi.fn()}
      />
    );

    const puntoK4 = screen.getByTestId('punto-k-4');
    fireEvent.click(puntoK4);

    expect(screen.getByTestId('k-value-display')).toHaveTextContent('K = 4');

    const slider = screen.getByTestId('k-slider');
    fireEvent.change(slider, { target: { value: '5' } });
    expect(screen.getByTestId('k-value-display')).toHaveTextContent('K = 5');
  });

  it('persiste hiperparámetros y métricas en IndexedDB y avanza al Paso 6', async () => {
    const onAvanzar = vi.fn();
    const onActualizarMetricas = vi.fn();

    render(
      <Step5HiperparametrosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        onActualizarHiperparametros={vi.fn()}
        onActualizarMetricas={onActualizarMetricas}
        onAvanzarAPaso6={onAvanzar}
        onVolverAPaso4={vi.fn()}
      />
    );

    const btnConfirmar = screen.getByTestId('confirm-step5-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    expect(onActualizarMetricas).toHaveBeenCalledWith(
      expect.objectContaining({
        silhouetteScore: expect.any(Number),
        numeroClustersIdentificados: 3,
      })
    );

    const cargado = await cargarProyectoDeIDB();
    expect(cargado?.hiperparametros?.k).toBe(3);
    expect(cargado?.metricas?.silhouetteScore).toBeGreaterThan(0);
  });
});

describe('Fase 3 — Diagnósticos de DBSCAN y Jerárquico en Step5', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[1].fichaTecnicaInicial,
  };

  it('renderiza controles de eps, min_samples y gráfico de densidades para DBSCAN', () => {
    render(
      <Step5HiperparametrosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de sensores"
        algoritmoSeleccionado="dbscan"
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso6={vi.fn()}
        onVolverAPaso4={vi.fn()}
      />
    );

    expect(screen.getByTestId('dbscan-diagnostics-card')).toBeInTheDocument();
    expect(screen.getByTestId('dbscan-density-svg')).toBeInTheDocument();
    expect(screen.getByTestId('eps-slider')).toBeInTheDocument();
    expect(screen.getByTestId('min-samples-slider')).toBeInTheDocument();
  });

  it('renderiza dendrograma SVG y selector de criterio de enlace para Clustering Jerárquico', () => {
    render(
      <Step5HiperparametrosDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema taxonómico"
        algoritmoSeleccionado="jerarquico"
        onActualizarHiperparametros={vi.fn()}
        onAvanzarAPaso6={vi.fn()}
        onVolverAPaso4={vi.fn()}
      />
    );

    expect(screen.getByTestId('jerarquico-diagnostics-card')).toBeInTheDocument();
    expect(screen.getByTestId('dendrogram-svg')).toBeInTheDocument();
    expect(screen.getByTestId('linkage-select')).toBeInTheDocument();
  });
});

describe('Fase 3 — Integración Completa en el Wizard de App', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('navega secuencialmente desde el Paso 1 hasta el Paso 5 verificando el avance en el sidebar', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    // Paso 1 -> Paso 2
    fireEvent.click(screen.getByTestId('preset-btn-retail-segmentacion-clientes'));
    fireEvent.click(screen.getByTestId('evaluate-clarity-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-step1-btn')).toBeInTheDocument();
    }, { timeout: 3000 });
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

    // Paso 5: Hiperparámetros y Diagnóstico activo
    await waitFor(() => {
      expect(screen.getByTestId('step5-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-5')).toHaveClass('active');
  });
});
