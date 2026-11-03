import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { FichaTecnicaDS, HiperparametrosClustering } from '../src/core/schemas';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import {
  generarScriptPython,
  generarNotebookJupyter,
  generarNotebookJson,
  obtenerExplicacionLineas,
  consultarTutorSobreCodigo,
} from '../src/core/python/pipelineGenerator';
import { Step6PipelinePythonDS } from '../src/steps/Step6PipelinePythonDS';
import { cargarProyectoDeIDB, limpiarProyectoDeIDB } from '../src/core/storageDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 4 — Generador Determinístico de Scripts Python (scikit-learn)', () => {
  const fichaKMeans: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('genera un script Python reproducible para K-Means con StandardScaler, inercia y silueta', () => {
    const script = generarScriptPython({
      fichaTecnica: fichaKMeans,
      algoritmo: 'kmeans',
      hiperparametros: {
        algoritmo: 'kmeans',
        k: 4,
        randomState: 42,
        justificacionEstudiante: 'K=4 por curva de codo',
      },
    });

    // Verificaciones sintácticas y metodológicas
    expect(script).toContain("import numpy as np");
    expect(script).toContain("import pandas as pd");
    expect(script).toContain("from sklearn.preprocessing import StandardScaler");
    expect(script).toContain("from sklearn.cluster import KMeans");
    expect(script).toContain("from sklearn.metrics import silhouette_score");
    expect(script).toContain("n_clusters=4");
    expect(script).toContain("random_state=42");
    expect(script).toContain("X_scaled = scaler.fit_transform(X)");
    expect(script).toContain("labels = kmeans.fit_predict(X_scaled)");
    expect(script).toContain("inercia = kmeans.inertia_");
    expect(script).toContain("silueta = silhouette_score(X_scaled, labels)");
    expect(script).toContain("df.groupby('cluster')");
    expect(script).toContain("plt.savefig('grafico_clusters.png', dpi=300)");
  });

  it('genera un script Python para Clustering Jerárquico con dendrograma y criterio de enlace', () => {
    const script = generarScriptPython({
      fichaTecnica: fichaKMeans,
      algoritmo: 'jerarquico',
      hiperparametros: {
        algoritmo: 'jerarquico',
        k: 3,
        criterioEnlace: 'ward',
        randomState: 42,
        justificacionEstudiante: 'Enlace Ward para clusters compactos',
      },
    });

    expect(script).toContain("from sklearn.cluster import AgglomerativeClustering");
    expect(script).toContain("from scipy.cluster.hierarchy import dendrogram, linkage");
    expect(script).toContain("n_clusters=3");
    expect(script).toContain("linkage='ward'");
    expect(script).toContain("labels = jerarquico.fit_predict(X_scaled)");
    expect(script).toContain("matriz_enlace = linkage(X_scaled, method='ward')");
    expect(script).toContain("dendrogram(");
  });

  it('genera un script Python para DBSCAN con aislamiento de ruido y métricas sin -1', () => {
    const fichaDBSCAN: FichaTecnicaDS = {
      ...PRESETS_CASOS_DS[1].fichaTecnicaInicial,
    };

    const script = generarScriptPython({
      fichaTecnica: fichaDBSCAN,
      algoritmo: 'dbscan',
      hiperparametros: {
        algoritmo: 'dbscan',
        eps: 0.35,
        minSamples: 6,
        randomState: 42,
        justificacionEstudiante: 'eps=0.35 para capturar formas no lineales',
      },
    });

    expect(script).toContain("from sklearn.cluster import DBSCAN");
    expect(script).toContain("eps=0.35");
    expect(script).toContain("min_samples=6");
    expect(script).toContain("labels = dbscan.fit_predict(X_scaled)");
    expect(script).toContain("n_ruido_ = list(labels).count(-1)");
    expect(script).toContain("mask_densos = labels != -1");
    expect(script).toContain("mask_ruido = labels == -1");
  });

  it('aplica RobustScaler si la ficha técnica contiene variables con recomendación robust_scaler', () => {
    const fichaConOutliers: FichaTecnicaDS = {
      ...fichaKMeans,
      variables: fichaKMeans.variables.map((v, i) =>
        i === 0 ? { ...v, escaladoRecomendado: 'robust_scaler' as const } : v
      ),
    };

    const script = generarScriptPython({
      fichaTecnica: fichaConOutliers,
      algoritmo: 'kmeans',
    });

    expect(script).toContain("from sklearn.preprocessing import RobustScaler");
    expect(script).toContain("scaler = RobustScaler()");
  });
});

describe('Fase 4 — Generador Estructurado de Jupyter Notebook (.ipynb v4)', () => {
  const fichaKMeans: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('genera una estructura nativa de notebook v4 con celdas de Markdown y Código', () => {
    const nb = generarNotebookJupyter({
      fichaTecnica: fichaKMeans,
      algoritmo: 'kmeans',
      hiperparametros: {
        algoritmo: 'kmeans',
        k: 3,
        randomState: 42,
        justificacionEstudiante: 'Codo en K=3',
      },
    });

    expect(nb.nbformat).toBe(4);
    expect(nb.nbformat_minor).toBe(5);
    expect(nb.metadata.kernelspec.name).toBe('python3');
    expect(nb.cells.length).toBeGreaterThanOrEqual(10);

    const celdasMd = nb.cells.filter((c) => c.cell_type === 'markdown');
    const celdasCode = nb.cells.filter((c) => c.cell_type === 'code');

    expect(celdasMd.length).toBeGreaterThanOrEqual(5);
    expect(celdasCode.length).toBeGreaterThanOrEqual(5);

    // Todas las fuentes son arrays de strings
    for (const celda of nb.cells) {
      expect(Array.isArray(celda.source)).toBe(true);
      expect(celda.source.length).toBeGreaterThan(0);
    }
  });

  it('serializa un JSON parseable sin errores para .ipynb', () => {
    const jsonStr = generarNotebookJson({
      fichaTecnica: fichaKMeans,
      algoritmo: 'kmeans',
    });

    expect(() => JSON.parse(jsonStr)).not.toThrow();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.cells).toBeDefined();
    expect(parsed.metadata).toBeDefined();
  });
});

describe('Fase 4 — Desglose y Explicación Línea por Línea', () => {
  const fichaKMeans: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('desglosa el script en bloques didácticos con preguntas socráticas', () => {
    const script = generarScriptPython({
      fichaTecnica: fichaKMeans,
      algoritmo: 'kmeans',
    });

    const secciones = obtenerExplicacionLineas('kmeans', script);
    expect(secciones.length).toBeGreaterThanOrEqual(5);

    const secEscalado = secciones.find((s) => s.id === 'escalado');
    expect(secEscalado).toBeDefined();
    expect(secEscalado?.resumenPedagogico).toContain('StandardScaler');
    expect(secEscalado?.preguntaSocratica).toContain('fit_transform()');
    expect(secEscalado?.lineas.length).toBeGreaterThan(0);

    const secModelo = secciones.find((s) => s.id === 'modelo');
    expect(secModelo).toBeDefined();
    expect(secModelo?.lineas.some((l) => l.codigo.includes('KMeans'))).toBe(true);
  });

  it('ofrece respuestas didácticas del tutor sobre consultas de código', async () => {
    const respuesta = await consultarTutorSobreCodigo({
      codigo: 'scaler = StandardScaler()',
      consulta: '¿Por qué no puedo usar los datos sin escalar?',
      algoritmo: 'kmeans',
    });

    expect(respuesta).toBeTruthy();
    expect(typeof respuesta).toBe('string');
    expect(respuesta.length).toBeGreaterThan(20);
  });
});

describe('Fase 4 — Componente Step6PipelinePythonDS', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  const hiperInicial: HiperparametrosClustering = {
    algoritmo: 'kmeans',
    k: 3,
    randomState: 42,
    justificacionEstudiante: 'K=3 según método del codo',
  };

  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('renderiza encabezado unificado, caja conceptual y pestañas de código', () => {
    render(
      <Step6PipelinePythonDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso7={vi.fn()}
        onVolverAPaso5={vi.fn()}
      />
    );

    expect(screen.getByTestId('step6-container')).toBeInTheDocument();
    expect(screen.getByTestId('step6-concept-box')).toBeInTheDocument();
    expect(screen.getByTestId('tab-script-btn')).toBeInTheDocument();
    expect(screen.getByTestId('tab-notebook-btn')).toBeInTheDocument();
    expect(screen.getByTestId('tab-explicacion-btn')).toBeInTheDocument();
    expect(screen.getByTestId('script-py-viewer')).toBeInTheDocument();
  });

  it('permite alternar a la vista de Jupyter Notebook y renderiza las celdas', () => {
    render(
      <Step6PipelinePythonDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso7={vi.fn()}
        onVolverAPaso5={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('tab-notebook-btn'));
    expect(screen.getByTestId('notebook-cells-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('notebook-cell-0')).toBeInTheDocument();
  });

  it('permite navegar en modo Explicación Línea por Línea e inspeccionar conceptos', () => {
    render(
      <Step6PipelinePythonDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso7={vi.fn()}
        onVolverAPaso5={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('tab-explicacion-btn'));
    expect(screen.getByTestId('line-by-line-mode')).toBeInTheDocument();
    expect(screen.getByTestId('line-explanation-panel')).toBeInTheDocument();
  });

  it('copia el código al portapapeles y provee retroalimentación visual', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <Step6PipelinePythonDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso7={vi.fn()}
        onVolverAPaso5={vi.fn()}
      />
    );

    const btnCopiar = screen.getByTestId('copy-code-btn');
    fireEvent.click(btnCopiar);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText('✓ ¡Copiado!')).toBeInTheDocument();
    });
  });

  it('permite consultar al tutor sobre el código y muestra la respuesta', async () => {
    render(
      <Step6PipelinePythonDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso7={vi.fn()}
        onVolverAPaso5={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('tab-explicacion-btn'));

    const inputPregunta = screen.getByTestId('ask-tutor-input');
    fireEvent.change(inputPregunta, {
      target: { value: '¿Por qué fijamos random_state=42?' },
    });

    const btnPreguntar = screen.getByTestId('ask-tutor-submit-btn');
    fireEvent.click(btnPreguntar);

    await waitFor(() => {
      expect(screen.getByTestId('ask-tutor-response')).toBeInTheDocument();
    });
  });

  it('persiste la decisión en IndexedDB y avanza al Paso 7', async () => {
    const onAvanzar = vi.fn();

    render(
      <Step6PipelinePythonDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        onAvanzarAPaso7={onAvanzar}
        onVolverAPaso5={vi.fn()}
      />
    );

    const btnConfirmar = screen.getByTestId('confirm-step6-btn');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(onAvanzar).toHaveBeenCalled();
    });

    const cargado = await cargarProyectoDeIDB();
    expect(cargado).not.toBeNull();
  });
});

describe('Fase 4 — Integración Completa en el Wizard de App', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('navega secuencialmente desde el Paso 1 hasta el Paso 6 verificando el avance en el sidebar', async () => {
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

    // Paso 6: Pipeline Python
    await waitFor(() => {
      expect(screen.getByTestId('step6-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-6')).toHaveClass('active');

    // Confirmar Paso 6 avanza al Paso 7
    fireEvent.click(screen.getByTestId('confirm-step6-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('step7-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-7')).toHaveClass('active');
  });
});
