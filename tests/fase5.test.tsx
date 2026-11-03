import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { FichaTecnicaDS, HiperparametrosClustering } from '../src/core/schemas';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import {
  generarDatasetSintetico,
  convertirADatasetCSV,
  sanitizarCeldaCSV,
} from '../src/core/sampleDataset';
import {
  ejecutarPipelineFallbackLocal,
  ejecutarPipelinePyodide,
} from '../src/core/workers/pyodideClient';
import { Step7EjecucionWasmDS } from '../src/steps/Step7EjecucionWasmDS';
import { cargarProyectoDeIDB, limpiarProyectoDeIDB } from '../src/core/storageDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 5 — Generador de Datos Sintéticos y Protección CSV', () => {
  const fichaKMeans: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('genera dataset con el número de filas solicitado y columnas de la Ficha Técnica', () => {
    const filas = generarDatasetSintetico(fichaKMeans, 80, 42);
    expect(filas.length).toBe(80);

    for (const variable of fichaKMeans.variables) {
      expect(filas[0]).toHaveProperty(variable.nombre);
    }
  });

  it('sanitiza celdas potencialmente peligrosas anteponiendo un apóstrofe anti-fórmulas', () => {
    expect(sanitizarCeldaCSV('=1+2')).toBe("'=1+2");
    expect(sanitizarCeldaCSV('+cmd|/c')).toBe("'+cmd|/c");
    expect(sanitizarCeldaCSV('-100')).toBe("'-100");
    expect(sanitizarCeldaCSV('@SUM(A1:A5)')).toBe("'@SUM(A1:A5)");
    expect(sanitizarCeldaCSV('Texto Seguro')).toBe('Texto Seguro');
  });

  it('convierte un array de objetos a CSV seguro y bien formateado', () => {
    const filas = [
      { id: '1', nombre: 'Alice', monto: 1500 },
      { id: '2', nombre: 'Bob', monto: 3200 },
    ];
    const csv = convertirADatasetCSV(filas);
    expect(csv).toContain('id,nombre,monto');
    expect(csv).toContain('1,Alice,1500');
    expect(csv).toContain('2,Bob,3200');
  });
});

describe('Fase 5 — Cliente Pyodide y Motor de Ejecución Local', () => {
  const fichaKMeans: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('ejecuta pipeline de K-Means calculando puntos 2D, centroides e inercia', () => {
    const res = ejecutarPipelineFallbackLocal({
      fichaTecnica: fichaKMeans,
      algoritmo: 'kmeans',
      hiperparametros: {
        algoritmo: 'kmeans',
        k: 3,
        randomState: 42,
        justificacionEstudiante: 'K=3 codo',
      },
    });

    expect(res.exito).toBe(true);
    expect(res.puntos2D.length).toBeGreaterThan(50);
    expect(res.centroides2D).toBeDefined();
    expect(res.centroides2D?.length).toBe(3);
    expect(res.metricas.inercia).toBeGreaterThan(0);
    expect(res.metricas.silueta).toBeGreaterThan(0.2);
    expect(res.stdout).toContain('DIAGNÓSTICO CUANTITATIVO (K-MEANS)');
  });

  it('ejecuta pipeline de DBSCAN identificando ruido con etiqueta -1', () => {
    const fichaDBSCAN: FichaTecnicaDS = {
      ...PRESETS_CASOS_DS[1].fichaTecnicaInicial,
    };

    const res = ejecutarPipelineFallbackLocal({
      fichaTecnica: fichaDBSCAN,
      algoritmo: 'dbscan',
      hiperparametros: {
        algoritmo: 'dbscan',
        eps: 0.3,
        minSamples: 5,
        randomState: 42,
        justificacionEstudiante: 'DBSCAN prueba',
      },
    });

    expect(res.exito).toBe(true);
    expect(res.metricas.porcentajeRuido).toBeDefined();
    expect(res.puntos2D.some((p) => p.cluster === -1)).toBe(true);
    expect(res.stdout).toContain('DIAGNÓSTICO CUANTITATIVO (DBSCAN)');
  });

  it('ejecuta la función ejecutarPipelinePyodide retornando resultados completos', async () => {
    const res = await ejecutarPipelinePyodide({
      code: 'print("Test")',
      csvData: 'col1,col2\n1,2',
      fichaTecnica: fichaKMeans,
      algoritmo: 'kmeans',
    });

    expect(res.exito).toBe(true);
    expect(res.puntos2D.length).toBeGreaterThan(0);
    expect(res.stdout).toBeTruthy();
  });
});

describe('Fase 5 — Componente Step7EjecucionWasmDS', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  const hiperInicial: HiperparametrosClustering = {
    algoritmo: 'kmeans',
    k: 3,
    randomState: 42,
    justificacionEstudiante: 'K=3 óptimo',
  };

  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('renderiza encabezado unificado, caja conceptual y el gráfico SVG interactivo 2D', () => {
    render(
      <Step7EjecucionWasmDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso8={vi.fn()}
        onVolverAPaso6={vi.fn()}
      />
    );

    expect(screen.getByTestId('step7-container')).toBeInTheDocument();
    expect(screen.getByTestId('step7-concept-box')).toBeInTheDocument();
    expect(screen.getByTestId('clusters-scatter-svg')).toBeInTheDocument();
    expect(screen.getByTestId('wasm-metrics-grid')).toBeInTheDocument();
    expect(screen.getByTestId('python-stdout-viewer')).toBeInTheDocument();
  });

  it('permite hacer clic en un punto del scatter plot e inspeccionar sus detalles', async () => {
    render(
      <Step7EjecucionWasmDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso8={vi.fn()}
        onVolverAPaso6={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('point-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('point-1'));

    await waitFor(() => {
      expect(screen.getByText('Inspección de Muestra')).toBeInTheDocument();
      expect(screen.getByText(/#1/)).toBeInTheDocument();
    });
  });

  it('regenera datos sintéticos al pulsar el botón correspondiente', async () => {
    render(
      <Step7EjecucionWasmDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso8={vi.fn()}
        onVolverAPaso6={vi.fn()}
      />
    );

    const btnRegenerar = screen.getByTestId('regenerate-data-btn');
    fireEvent.click(btnRegenerar);

    await waitFor(() => {
      expect(screen.getByTestId('clusters-scatter-svg')).toBeInTheDocument();
    });
  });

  it('persiste las métricas y la decisión en IndexedDB y avanza al Paso 8', async () => {
    const onAvanzar = vi.fn();
    const onActualizarMetricas = vi.fn();

    render(
      <Step7EjecucionWasmDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onActualizarMetricas={onActualizarMetricas}
        onAvanzarAPaso8={onAvanzar}
        onVolverAPaso6={vi.fn()}
      />
    );

    const btnConfirmar = screen.getByTestId('confirm-step7-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado).not.toBeNull();
    expect(cargado?.metricas).toBeDefined();
  });
});

describe('Fase 5 — Integración Completa en el Wizard de App', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('navega secuencialmente desde el Paso 1 hasta el Paso 7 verificando el avance en el sidebar', async () => {
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

    // Paso 7: Ejecución WASM y Visualización 2D
    await waitFor(() => {
      expect(screen.getByTestId('step7-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-7')).toHaveClass('active');

    // Confirmar Paso 7 avanza al Paso 8
    fireEvent.click(screen.getByTestId('confirm-step7-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('step8-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-8')).toHaveClass('active');
  });
});
