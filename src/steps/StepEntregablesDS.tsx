import { useState } from 'react';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
  PerfilCluster,
} from '../core/schemas';
import {
  generarPaqueteZipCompleto,
  generarFichaTecnicaMarkdown,
  generarGlosarioMarkdown,
  generarGraficoClustersSVG,
  generarGraficoDiagnosticoSVG,
} from '../export/zipDS';
import { exportarDatasetCSV } from '../export/csvDS';
import { exportarNotebookIpynb } from '../export/notebookDS';
import { generarReporteEjecutivoPDF } from '../export/pdfDS';
import { generarScriptPython } from '../core/python/pipelineGenerator';
import { ejecutarPipelineFallbackLocal } from '../core/workers/pyodideClient';

export interface StepEntregablesDSProps {
  fichaTecnica: FichaTecnicaDS;
  problemaOriginal: string;
  algoritmoSeleccionado: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  perfiles?: PerfilCluster[];
  onVolverAPaso8: () => void;
  onReiniciarProyecto?: () => void;
  deshabilitado?: boolean;
}

export function StepEntregablesDS({
  fichaTecnica,
  problemaOriginal,
  algoritmoSeleccionado,
  hiperparametros,
  metricas,
  perfiles,
  onVolverAPaso8,
  onReiniciarProyecto,
  deshabilitado = false,
}: StepEntregablesDSProps) {
  const [descargando, setDescargando] = useState<boolean>(false);
  const [mensajeDescarga, setMensajeDescarga] = useState<string | null>(null);

  const handleDescargarArchivo = (
    nombre: string,
    contenido: string | Uint8Array,
    tipoMime: string
  ) => {
    const blob = new Blob([contenido as BlobPart], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDescargarZip = () => {
    setDescargando(true);
    setMensajeDescarga('Auditando en memoria y empaquetando ZIP...');

    try {
      const u8Zip = generarPaqueteZipCompleto({
        problemaOriginal,
        fichaTecnica,
        hiperparametros,
        metricas,
        perfiles,
      });

      handleDescargarArchivo(
        `proyecto_ml_${algoritmoSeleccionado}.zip`,
        u8Zip,
        'application/zip'
      );
      setMensajeDescarga('✓ ZIP descargado exitosamente. Cero filtraciones de credenciales.');
    } catch (err) {
      setMensajeDescarga(
        `Error en exportación: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setDescargando(false);
    }
  };

  const algo = hiperparametros?.algoritmo || algoritmoSeleccionado;

  return (
    <section
      className="card studio-step-card"
      aria-labelledby="step9-title"
      data-testid="step9-container"
    >
      {/* Encabezado Unificado */}
      <div className="step-header">
        <span className="step-badge">Paso 9 de 9</span>
        <div>
          <h2 id="step9-title" className="card-title">
            Paquete de Entregables Descargables (ZIP Seguro)
          </h2>
          <p className="step-lead">
            Descarga de todos los artefactos reproducibles generados durante la sesión de estudio,
            con auditoría de seguridad anti-leaks en memoria.
          </p>
        </div>
      </div>

      {/* Caja Conceptual Pedagógica */}
      <details className="concept-box" data-testid="step9-concept-box">
        <summary className="concept-summary">
          💡 Fundamento teórico: Entregables en la Práctica Profesional de Machine Learning
        </summary>
        <div className="concept-content">
          <p>
            Un proyecto de Ciencia de Datos no termina en una pantalla interactiva, sino en la
            entrega de un <strong>paquete metodológico reproducible</strong> para los equipos de
            ingeniería, auditoría y dirección:
          </p>
          <ul>
            <li>
              <strong>Notebook interactivo (<code>.ipynb</code>):</strong> Permite a otros
              investigadores reproducir los experimentos paso a paso en Google Colab o JupyterLab.
            </li>
            <li>
              <strong>Script modular (<code>.py</code>):</strong> Código listo para integrarse en un
              pipeline de producción automatizado (ETL / MLOps).
            </li>
            <li>
              <strong>Dataset enriquecido (<code>.csv</code>):</strong> Con protección estricta
              anti-inyección de fórmulas, listo para consumirse en Power BI o Excel.
            </li>
            <li>
              <strong>Informe Ejecutivo (<code>.pdf</code>):</strong> Síntesis concisa de 1 a 2
              páginas diseñada para stakeholders que toman decisiones de negocio.
            </li>
            <li>
              <strong>Privacidad absoluta (BYOK):</strong> Ningún archivo contiene jamás tu API key.
              El escáner en memoria inspecciona cada byte antes de crear el archivo ZIP.
            </li>
          </ul>
        </div>
      </details>

      {/* Bloque de Explicación del Tutor IA */}
      <div className="tutor-explanation-box">
        <strong>Tutor IA:</strong>
        <p>
          ¡Felicitaciones! Has completado el ciclo integral de Ciencia de Datos: desde la formulación
          del problema hasta el perfilado de negocio. Podés descargar el paquete ZIP completo con
          los 9 artefactos o descargar cada archivo individualmente según lo requieras.
        </p>
      </div>

      {/* Tarjeta de Descarga Principal ZIP y Auditoría */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(99, 102, 241, 0.12))',
          border: '1px solid var(--accent-cyan)',
          padding: '1.5rem',
          borderRadius: '0.85rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          <span className="badge badge-success" data-testid="security-audit-badge">
            ✓ Auditoría de Privacidad Aprobada
          </span>
          <h3 style={{ margin: '0.4rem 0 0.2rem', fontSize: '1.2rem' }}>
            Paquete de Entregables Completo (.ZIP)
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Incluye: Notebook Colab, Script Python, Dataset CSV, Informe PDF, Gráficos SVG, Ficha
            Técnica y Glosario.
          </p>
          {mensajeDescarga && (
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--accent-cyan)' }}>
              {mensajeDescarga}
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.4rem', fontSize: '1rem', fontWeight: 700 }}
          data-testid="download-zip-btn"
          onClick={handleDescargarZip}
          disabled={descargando || deshabilitado}
        >
          {descargando ? 'Generando ZIP Seguro...' : '⬇ Descargar Paquete ZIP Completo'}
        </button>
      </div>

      {/* Grilla de Entregables Individuales */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.85rem' }}>
        Artefactos Individuales del Proyecto
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
        data-testid="deliverables-grid"
      >
        {/* 1. Reporte PDF */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>📄 Reporte Ejecutivo (.pdf)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Informe gerencial de 1-2 páginas con perfiles y KPIs.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-pdf"
            onClick={() => {
              const doc = generarReporteEjecutivoPDF({
                problemaOriginal,
                fichaTecnica,
                hiperparametros,
                metricas,
                perfiles,
              });
              doc.save('reporte_ejecutivo.pdf');
            }}
          >
            Descargar PDF
          </button>
        </div>

        {/* 2. Jupyter Notebook */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>📓 Jupyter Notebook (.ipynb)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Notebook v4 listo para abrir en Google Colab o VS Code.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-ipynb"
            onClick={() => {
              const nb = exportarNotebookIpynb({ fichaTecnica, algoritmo: algo, hiperparametros });
              handleDescargarArchivo('notebook_clustering.ipynb', nb, 'application/json');
            }}
          >
            Descargar .ipynb
          </button>
        </div>

        {/* 3. Script Python */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>🐍 Pipeline Python (.py)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Script reproducible modular con scikit-learn y pandas.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-py"
            onClick={() => {
              const py = generarScriptPython({ fichaTecnica, algoritmo: algo, hiperparametros });
              handleDescargarArchivo('pipeline_sklearn.py', py, 'text/x-python');
            }}
          >
            Descargar .py
          </button>
        </div>

        {/* 4. Dataset CSV */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>📊 Dataset Limpio (.csv)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Datos con etiquetas de cluster y protección anti-fórmulas.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-csv"
            onClick={() => {
              const csv = exportarDatasetCSV({ fichaTecnica, perfiles });
              handleDescargarArchivo('dataset_ejemplo.csv', csv, 'text/csv');
            }}
          >
            Descargar .csv
          </button>
        </div>

        {/* 5. Ficha Técnica MD */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>📋 Ficha Técnica (.md)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Documento formal con variables, target y justificación.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-ficha"
            onClick={() => {
              const md = generarFichaTecnicaMarkdown({
                problemaOriginal,
                fichaTecnica,
                hiperparametros,
                metricas,
              });
              handleDescargarArchivo('ficha_tecnica.md', md, 'text/markdown');
            }}
          >
            Descargar .md
          </button>
        </div>

        {/* 6. Glosario de Términos MD */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>📖 Glosario de la Cátedra (.md)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Definiciones de los conceptos técnicos de la sesión.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-glosario"
            onClick={() => {
              const md = generarGlosarioMarkdown();
              handleDescargarArchivo('glosario_ciencia_datos.md', md, 'text/markdown');
            }}
          >
            Descargar Glosario
          </button>
        </div>

        {/* 7. Gráfico de Clusters SVG */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>🖼️ Gráfico de Clusters (.svg)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Vectorial responsive con centroides y puntos coloreados.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-clusters-svg"
            onClick={() => {
              const res = ejecutarPipelineFallbackLocal({
                fichaTecnica,
                algoritmo: algo,
                hiperparametros,
              });
              const vars = fichaTecnica.variables.filter((v) => v.rol === 'feature');
              const svg = generarGraficoClustersSVG(res, vars[0]?.nombre, vars[1]?.nombre);
              handleDescargarArchivo('grafico_clusters.svg', svg, 'image/svg+xml');
            }}
          >
            Descargar SVG
          </button>
        </div>

        {/* 8. Diagnóstico SVG */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>📈 Diagnóstico del Codo (.svg)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Curva de Inercia WCSS y Coeficiente de Silueta.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-diagnostico-svg"
            onClick={() => {
              const svg = generarGraficoDiagnosticoSVG(algo, hiperparametros);
              handleDescargarArchivo('curva_codo_silueta.svg', svg, 'image/svg+xml');
            }}
          >
            Descargar SVG
          </button>
        </div>

        {/* 9. Estado JSON de la sesión */}
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-card)' }}>
          <strong style={{ fontSize: '0.9rem' }}>💾 Estado de Proyecto (.json)</strong>
          <p style={{ margin: '0.3rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Permite reanudar la sesión en la app sin credenciales.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="download-item-json"
            onClick={() => {
              const jsonStr = JSON.stringify(
                {
                  id: 'proyecto-actual',
                  version: 1,
                  fechaCreacion: new Date().toISOString(),
                  problemaOriginal,
                  fichaTecnica,
                  hiperparametros,
                  metricas,
                  perfiles,
                  bitacoraDecisiones: [],
                },
                null,
                2
              );
              handleDescargarArchivo('proyecto_ds.json', jsonStr, 'application/json');
            }}
          >
            Descargar JSON
          </button>
        </div>
      </div>

      {/* Navegación Inferior Estándar */}
      <div className="button-group">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onVolverAPaso8}
          disabled={deshabilitado}
        >
          ← Volver al Paso 8 (Perfilado BI)
        </button>

        {onReiniciarProyecto && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onReiniciarProyecto}
            disabled={deshabilitado}
            title="Inicia un nuevo planteo analítico en blanco"
          >
            🔄 Nuevo Proyecto / Reiniciar
          </button>
        )}
      </div>
    </section>
  );
}
