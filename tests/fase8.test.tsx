import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { guardarApiKey, olvidarApiKey } from '../src/core/key';
import { GlossaryModalDS, TERMINOS_GLOSARIO_DS } from '../src/steps/GlossaryModalDS';
import { limpiarProyectoDeIDB } from '../src/core/storageDS';
import { FichaTecnicaSchema, FichaTecnicaDS } from '../src/core/schemas';
import { generarScriptPython } from '../src/core/python/pipelineGenerator';
import { ejecutarPipelineFallbackLocal } from '../src/core/workers/pyodideClient';
import { generarPerfilesDeNegocio } from '../src/core/businessProfile';

const FAKE_KEY = 'AIzaSyTestKey1234567890abcdefXYZ987';

describe('Fase 8 — Glosario Pedagógico Modal Interactivo', () => {
  it('contiene más de 15 términos curriculares clasificados en categorías clave', () => {
    expect(TERMINOS_GLOSARIO_DS.length).toBeGreaterThanOrEqual(15);

    const categorias = new Set(TERMINOS_GLOSARIO_DS.map((t) => t.categoria));
    expect(categorias.has('paradigmas')).toBe(true);
    expect(categorias.has('algoritmos')).toBe(true);
    expect(categorias.has('preprocesamiento')).toBe(true);
    expect(categorias.has('metricas')).toBe(true);
    expect(categorias.has('bi')).toBe(true);
  });

  it('no renderiza nada cuando abierto es false', () => {
    render(<GlossaryModalDS abierto={false} onCerrar={vi.fn()} />);
    expect(screen.queryByTestId('glossary-modal')).not.toBeInTheDocument();
  });

  it('renderiza modal accesible con campo de búsqueda y lista de conceptos cuando abierto es true', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    expect(screen.getByTestId('glossary-modal')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-terms-list')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-item-kmeans')).toBeInTheDocument();
  });

  it('filtra los términos en tiempo real según el texto ingresado en el buscador', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    const inputBusqueda = screen.getByTestId('glossary-search-input');
    fireEvent.change(inputBusqueda, { target: { value: 'Silueta' } });

    expect(screen.getByText(/Coeficiente de Silueta/)).toBeInTheDocument();
    expect(screen.queryByText(/DBSCAN/)).not.toBeInTheDocument();
  });

  it('filtra los términos al seleccionar una categoría específica', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    const btnCatBI = screen.getByTestId('glossary-cat-bi');
    fireEvent.click(btnCatBI);

    expect(screen.getByText(/Función CALCULATE/)).toBeInTheDocument();
    expect(screen.queryByText(/StandardScaler/)).not.toBeInTheDocument();
  });

  it('muestra mensaje amigable cuando no hay resultados para una búsqueda', () => {
    render(<GlossaryModalDS abierto={true} onCerrar={vi.fn()} />);

    const inputBusqueda = screen.getByTestId('glossary-search-input');
    fireEvent.change(inputBusqueda, { target: { value: 'termino_inexistente_xyz' } });

    expect(screen.getByText(/No se encontraron términos/)).toBeInTheDocument();
  });

  it('llama a onCerrar al hacer clic en el botón de cerrar o presionar Escape', () => {
    const onCerrar = vi.fn();
    render(<GlossaryModalDS abierto={true} onCerrar={onCerrar} />);

    const btnCerrar = screen.getByTestId('close-glossary-btn');
    fireEvent.click(btnCerrar);
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });
});

describe('Fase 8 — Accesibilidad, Modo Oscuro / Claro y App Shell', () => {
  beforeEach(async () => {
    olvidarApiKey();
    await limpiarProyectoDeIDB();
    document.documentElement.removeAttribute('data-theme');
  });

  it('permite alternar entre Modo Oscuro y Modo Claro actualizando data-theme y persistiendo en localStorage', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    const btnTema = screen.getByTestId('toggle-theme-btn');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Cambiar a claro
    fireEvent.click(btnTema);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('ds_tutor_theme')).toBe('light');

    // Cambiar nuevamente a oscuro
    fireEvent.click(btnTema);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('ds_tutor_theme')).toBe('dark');
  });

  it('incluye skip-link accesible para lectores de pantalla hacia el contenido principal', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    const skipLink = screen.getByText('Saltar al contenido principal');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('abre el Glosario interactivo desde la barra superior y permite cerrarlo', async () => {
    guardarApiKey(FAKE_KEY);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('ready-workspace')).toBeInTheDocument();
    });

    const btnAbrirGlosario = screen.getByTestId('open-glossary-btn');
    fireEvent.click(btnAbrirGlosario);

    await waitFor(() => {
      expect(screen.getByTestId('glossary-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-glossary-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('glossary-modal')).not.toBeInTheDocument();
    });
  });
});

describe('Fase 8 — Coherencia Matemática End-to-End y Dominios Personalizados', () => {
  const fichaClinicaPersonalizada: FichaTecnicaDS = {
    problemaNegocio: 'Segmentación de pacientes crónicos en clínica médica según frecuencia de consultas y edad',
    paradigma: 'no_supervisado',
    tarea: 'clustering',
    justificacionParadigma: 'Agrupamiento preventivo sin etiquetas previas.',
    variables: [
      {
        nombre: 'id_paciente',
        tipo: 'categorica_nominal',
        descripcion: 'Identificador único de historia clínica',
        rol: 'identificador',
        escaladoRecomendado: 'ninguno',
        justificacion: 'Clave primaria a excluir.',
      },
      {
        nombre: 'edad_paciente',
        tipo: 'numerica_discreta',
        descripcion: 'Edad biológica en años',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Factor demográfico clave.',
      },
      {
        nombre: 'consultas_anuales',
        tipo: 'numerica_discreta',
        descripcion: 'Cantidad de visitas médicas en el último año',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Mide recurrencia asistencial.',
      },
      {
        nombre: 'indice_glucemia_mg',
        tipo: 'numerica_continua',
        descripcion: 'Nivel medio de glucemia en ayunas (mg/dL)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Indicador clínico metabólico.',
      },
      {
        nombre: 'sede_atencion',
        tipo: 'categorica_nominal',
        descripcion: 'Sucursal de atención médica',
        rol: 'feature',
        escaladoRecomendado: 'ninguno',
        justificacion: 'Variable nominal que no debe enviarse directo a StandardScaler.',
      },
    ],
    restricciones: [],
  };

  it('FichaTecnicaSchema acepta variableTarget null devuelto por LLMs en clustering', () => {
    const parsed = FichaTecnicaSchema.safeParse({
      ...fichaClinicaPersonalizada,
      variableTarget: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.variableTarget).toBeUndefined();
    }
  });

  it('generarScriptPython produce sintaxis Python 100% válida sin operador ?? y filtra categóricas de StandardScaler', () => {
    for (const alg of ['kmeans', 'jerarquico', 'dbscan'] as const) {
      const script = generarScriptPython({
        fichaTecnica: fichaClinicaPersonalizada,
        algoritmo: alg,
      });
      expect(script).not.toContain('??');
      expect(script).toContain("'edad_paciente'");
      expect(script).toContain("'consultas_anuales'");
      expect(script).toContain("'indice_glucemia_mg'");
      expect(script).not.toContain("features = ['sede_atencion'");
    }
  });

  it('ejecutarPipelineFallbackLocal calcula clustering matemático real y medias de todas las variables cuantitativas', () => {
    const res = ejecutarPipelineFallbackLocal({
      fichaTecnica: fichaClinicaPersonalizada,
      algoritmo: 'kmeans',
      hiperparametros: { algoritmo: 'kmeans', k: 3, init: 'k-means++', maxIter: 300 },
    });

    expect(res.resumenClusters.length).toBe(3);
    // Verifica que todas las variables cuantitativas tengan su media real calculada
    for (const c of res.resumenClusters) {
      expect(c.medias['edad_paciente']).toBeDefined();
      expect(c.medias['consultas_anuales']).toBeDefined();
      expect(c.medias['indice_glucemia_mg']).toBeDefined();
    }

    // Verifica que no sea una asignación artificial idx % 3
    const esModuloTrivial = res.puntos2D.every((p, idx) => p.cluster === idx % 3);
    expect(esModuloTrivial).toBe(false);
  });

  it('generarPerfilesDeNegocio construye perfiles contextualizados con las medias reales de las variables del usuario', () => {
    const res = ejecutarPipelineFallbackLocal({
      fichaTecnica: fichaClinicaPersonalizada,
      algoritmo: 'kmeans',
      hiperparametros: { algoritmo: 'kmeans', k: 3, init: 'k-means++', maxIter: 300 },
    });

    const perfiles = generarPerfilesDeNegocio({
      fichaTecnica: fichaClinicaPersonalizada,
      algoritmo: 'kmeans',
      resumenClusters: res.resumenClusters,
    });

    expect(perfiles.length).toBe(3);
    const textoConsolidado = JSON.stringify(perfiles);
    expect(textoConsolidado).toContain('edad_paciente');
    expect(textoConsolidado).toContain('consultas_anuales');
    expect(textoConsolidado).toContain('indice_glucemia_mg');
  });
});
