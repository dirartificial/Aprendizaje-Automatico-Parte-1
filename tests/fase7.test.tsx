import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { unzipSync, strFromU8 } from 'fflate';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { FichaTecnicaDS, HiperparametrosClustering, MetricasEvaluacion, PerfilCluster } from '../src/core/schemas';
import { PRESETS_CASOS_DS } from '../src/core/presetsDS';
import { exportarDatasetCSV } from '../src/export/csvDS';
import { generarReporteEjecutivoPDF } from '../src/export/pdfDS';
import {
  generarPaqueteZipCompleto,
  auditarContenidoSinApiKey,
} from '../src/export/zipDS';
import { StepEntregablesDS } from '../src/steps/StepEntregablesDS';
import { limpiarProyectoDeIDB } from '../src/core/storageDS';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 7 — Exportación Segura de CSV y PDF Ejecutivo', () => {
  const fichaRetail: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  const perfilesPrueba: PerfilCluster[] = [
    {
      clusterId: 0,
      nombreDescriptivo: 'Clientes Frecuentes',
      caracteristicasClave: ['Alta frecuencia'],
      tamanoRelativoPct: 50.0,
      accionDeNegocioRecomendada: 'Cross-selling',
    },
    {
      clusterId: 1,
      nombreDescriptivo: 'Clientes Ocasionales VIP',
      caracteristicasClave: ['Alto ticket'],
      tamanoRelativoPct: 50.0,
      accionDeNegocioRecomendada: 'Atención exclusiva',
    },
  ];

  it('exporta dataset CSV enriquecido con columnas cluster y cluster_nombre', () => {
    const csv = exportarDatasetCSV({
      fichaTecnica: fichaRetail,
      perfiles: perfilesPrueba,
    });

    expect(csv).toContain('cluster,cluster_nombre');
    expect(csv).toContain('Clientes Frecuentes');
  });

  it('genera informe ejecutivo en PDF con encabezado institucional y páginas válidas', () => {
    const doc = generarReporteEjecutivoPDF({
      problemaOriginal: 'Problema de prueba retail',
      fichaTecnica: fichaRetail,
      hiperparametros: {
        algoritmo: 'kmeans',
        k: 3,
        randomState: 42,
        justificacionEstudiante: 'Codo K=3',
      },
      metricas: {
        inercia: 1200,
        silhouetteScore: 0.65,
        numeroClustersIdentificados: 3,
      },
      perfiles: perfilesPrueba,
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const pdfOutput = doc.output('arraybuffer');
    expect(pdfOutput.byteLength).toBeGreaterThan(1000);
  });
});

describe('Fase 7 — Auditoría de Privacidad y Paquete ZIP con fflate', () => {
  const fichaRetail: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  it('aborta y arroja excepción si el contenido a exportar contiene una API key de Gemini', () => {
    const textoConKey = `import pandas as pd\nAPI_KEY = "${FAKE_KEY}"\n`;

    expect(() => {
      auditarContenidoSinApiKey(textoConKey, 'pipeline_sklearn.py');
    }).toThrow(/AUDITORÍA DE SEGURIDAD ABORTADA/);
  });

  it('genera un paquete ZIP válido conteniendo los 9 artefactos auditados y libres de API keys', () => {
    const zipBytes = generarPaqueteZipCompleto({
      problemaOriginal: 'Planteo de prueba',
      fichaTecnica: fichaRetail,
      hiperparametros: {
        algoritmo: 'kmeans',
        k: 2,
        randomState: 42,
        justificacionEstudiante: 'Justificación',
      },
      metricas: {
        silhouetteScore: 0.72,
        numeroClustersIdentificados: 2,
      },
      perfiles: [
        {
          clusterId: 0,
          nombreDescriptivo: 'Grupo A',
          caracteristicasClave: ['Rasgo 1'],
          tamanoRelativoPct: 50,
          accionDeNegocioRecomendada: 'Acción 1',
        },
        {
          clusterId: 1,
          nombreDescriptivo: 'Grupo B',
          caracteristicasClave: ['Rasgo 2'],
          tamanoRelativoPct: 50,
          accionDeNegocioRecomendada: 'Acción 2',
        },
      ],
    });

    expect(zipBytes).toBeInstanceOf(Uint8Array);
    expect(zipBytes.length).toBeGreaterThan(5000);

    // Descomprimir el ZIP para verificar los 9 artefactos
    const archivosDescomprimidos = unzipSync(zipBytes);
    const nombresArchivos = Object.keys(archivosDescomprimidos);

    const archivosEsperados = [
      'proyecto_ds.json',
      'notebook_clustering.ipynb',
      'pipeline_sklearn.py',
      'dataset_ejemplo.csv',
      'ficha_tecnica.md',
      'reporte_ejecutivo.pdf',
      'grafico_clusters.svg',
      'curva_codo_silueta.svg',
      'glosario_ciencia_datos.md',
    ];

    for (const esperado of archivosEsperados) {
      expect(nombresArchivos).toContain(esperado);
    }

    // Inspección de seguridad: Ningún archivo puede contener FAKE_KEY
    for (const nombre of nombresArchivos) {
      const u8Contenido = archivosDescomprimidos[nombre];
      const strContenido = strFromU8(u8Contenido);
      expect(strContenido).not.toContain(FAKE_KEY);
      expect(strContenido).not.toMatch(/AIza[0-9A-Za-z\-_]{35}/);
    }
  });
});

describe('Fase 7 — Componente StepEntregablesDS', () => {
  const fichaInicial: FichaTecnicaDS = {
    ...PRESETS_CASOS_DS[0].fichaTecnicaInicial,
  };

  const hiperInicial: HiperparametrosClustering = {
    algoritmo: 'kmeans',
    k: 3,
    randomState: 42,
    justificacionEstudiante: 'K=3',
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

  it('renderiza encabezado unificado, insignia de auditoría y grilla de entregables', () => {
    render(
      <StepEntregablesDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onVolverAPaso8={vi.fn()}
      />
    );

    expect(screen.getByTestId('step9-container')).toBeInTheDocument();
    expect(screen.getByTestId('step9-concept-box')).toBeInTheDocument();
    expect(screen.getByTestId('security-audit-badge')).toBeInTheDocument();
    expect(screen.getByTestId('download-zip-btn')).toBeInTheDocument();
    expect(screen.getByTestId('deliverables-grid')).toBeInTheDocument();
  });

  it('descarga el archivo ZIP completo al hacer clic en el botón principal', async () => {
    // Mock de URL.createObjectURL y click
    const createObjectURLMock = vi.fn().mockReturnValue('blob:test-zip');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <StepEntregablesDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onVolverAPaso8={vi.fn()}
      />
    );

    const btnZip = screen.getByTestId('download-zip-btn');
    fireEvent.click(btnZip);

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(screen.getByText(/ZIP descargado exitosamente/)).toBeInTheDocument();
    });
  });

  it('permite descargar artefactos individuales de la grilla', () => {
    render(
      <StepEntregablesDS
        fichaTecnica={fichaInicial}
        problemaOriginal="Problema de prueba"
        algoritmoSeleccionado="kmeans"
        hiperparametros={hiperInicial}
        metricas={metricasInicial}
        onVolverAPaso8={vi.fn()}
      />
    );

    expect(screen.getByTestId('download-item-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-ipynb')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-py')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-csv')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-ficha')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-glosario')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-clusters-svg')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-diagnostico-svg')).toBeInTheDocument();
    expect(screen.getByTestId('download-item-json')).toBeInTheDocument();
  });
});

describe('Fase 7 — Integración Completa en el Wizard de App (Pasos 1 al 9)', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
  });

  it('navega secuencialmente desde el Paso 1 hasta el Paso 9 (Entregables) verificando avance total', async () => {
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

    // Paso 8 -> Paso 9
    await waitFor(() => {
      expect(screen.getByTestId('step8-container')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-step8-btn'));

    // Paso 9: Entregables Descargables
    await waitFor(() => {
      expect(screen.getByTestId('step9-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('wizard-step-btn-9')).toHaveClass('active');
    expect(screen.getByTestId('download-zip-btn')).toBeInTheDocument();
  });
});
