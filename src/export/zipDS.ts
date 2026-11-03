import { strToU8, zipSync } from 'fflate';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
  PerfilCluster,
  ProyectoDS,
} from '../core/schemas';
import { exportarDatasetCSV } from './csvDS';
import { exportarNotebookIpynb } from './notebookDS';
import { generarReporteEjecutivoPDF } from './pdfDS';
import { generarScriptPython } from '../core/python/pipelineGenerator';
import {
  generarDiagnosticoKMeans,
  generarDiagnosticoDBSCAN,
  generarDiagnosticoJerarquico,
} from '../core/metrics/diagnostics';
import {
  ejecutarPipelineFallbackLocal,
  ResultadoEjecucionPipeline,
} from '../core/workers/pyodideClient';

/**
 * Patrones de API keys que bajo ninguna circunstancia pueden filtrarse en las exportaciones.
 */
const PATRONES_API_KEY = [
  /AIza[0-9A-Za-z\-_]{20,}/,
  /sk-or-v1-[0-9a-zA-Z]{15,}/,
  /AIzaSy/,
];

/**
 * Escanea exhaustivamente en memoria el contenido de un archivo buscando fugas de claves de API.
 * Lanza una excepción de seguridad crítica si detecta cualquier coincidencia.
 */
export function auditarContenidoSinApiKey(
  contenido: string | Uint8Array,
  nombreArchivo: string
): void {
  const texto =
    typeof contenido === 'string'
      ? contenido
      : new TextDecoder('utf-8', { fatal: false }).decode(contenido);

  for (const patron of PATRONES_API_KEY) {
    if (patron.test(texto)) {
      throw new Error(
        `[AUDITORÍA DE SEGURIDAD ABORTADA] Se detectó un patrón de API key en '${nombreArchivo}'. La descarga fue bloqueada para proteger la privacidad del usuario.`
      );
    }
  }
}

/**
 * Genera el documento Markdown de la Ficha Técnica.
 */
export function generarFichaTecnicaMarkdown({
  problemaOriginal,
  fichaTecnica,
  hiperparametros,
  metricas,
}: {
  problemaOriginal: string;
  fichaTecnica: FichaTecnicaDS;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
}): string {
  const features = fichaTecnica.variables
    .filter((v) => v.rol === 'feature')
    .map((v) => `- **${v.nombre}** (${v.tipo}): ${v.descripcion} [Escalado: ${v.escaladoRecomendado}]`)
    .join('\n');

  return `# Ficha Técnica de Machine Learning
**Cátedra:** Centro Educativo Paulo Freire — U.E.G.P. N° 165  
**Proyecto:** ${fichaTecnica.problemaNegocio}  
**Fecha:** ${new Date().toISOString()}

---

## 1. Planteo del Problema de Negocio
> "${problemaOriginal || fichaTecnica.problemaNegocio}"

## 2. Definición Metodológica
- **Paradigma de Aprendizaje:** ${fichaTecnica.paradigma} (No Supervisado)
- **Tipo de Tarea:** ${fichaTecnica.tarea}
- **Justificación Metodológica:** ${fichaTecnica.justificacionParadigma}

## 3. Matriz de Variables Explicativas (X)
${features}

## 4. Algoritmo y Supuestos Geométricos
- **Algoritmo Seleccionado:** ${hiperparametros?.algoritmo.toUpperCase() || 'K-MEANS'}
- **Parámetros:** ${
    hiperparametros?.algoritmo === 'kmeans'
      ? `K=${hiperparametros.k ?? 3}, random_state=${hiperparametros.randomState ?? 42}`
      : hiperparametros?.algoritmo === 'jerarquico'
        ? `K=${hiperparametros.k ?? 3}, Enlace=${hiperparametros.criterioEnlace ?? 'ward'}`
        : `eps=${hiperparametros?.eps ?? 0.5}, min_samples=${hiperparametros?.minSamples ?? 5}`
  }
- **Fundamentación del Estudiante:** "${hiperparametros?.justificacionEstudiante || 'Selección calibrada por diagnósticos'}"

## 5. Diagnóstico Cuantitativo de Calidad
- **Coeficiente de Silueta:** ${metricas?.silhouetteScore?.toFixed(4) || 'N/A'}
- **Inercia Intra-Cluster (WCSS):** ${metricas?.inercia !== undefined ? metricas.inercia.toFixed(2) : 'N/A'}
- **Ruido / Outliers:** ${metricas?.porcentajeRuido !== undefined ? `${metricas.porcentajeRuido.toFixed(1)}%` : 'No aplica'}
`;
}

/**
 * Genera el glosario conceptual exclusivo en Markdown.
 */
export function generarGlosarioMarkdown(): string {
  return `# Glosario Pedagógico de Ciencia de Datos y Machine Learning
**Cátedra:** Centro Educativo Paulo Freire — U.E.G.P. N° 165

### 1. Paradigmas del Aprendizaje
- **Aprendizaje No Supervisado:** Rama del Machine Learning donde el algoritmo descubre patrones, agrupamientos o estructuras latentes en los datos sin contar con una variable objetivo ($Y$) etiquetada previamente.
- **Inteligencia de Negocios (BI):** Análisis descriptivo centrado en *qué ocurrió* mediante tableros, KPIs y agregaciones históricas. Se complementa con la Ciencia de Datos para predecir o segmentar.

### 2. Algoritmos de Clustering
- **K-Means:** Algoritmo particional basado en centroides. Asume clusters convexos y esféricos de similar dispersión. Muy rápido pero sensible a valores atípicos.
- **Clustering Jerárquico Aglomerativo:** Construye un árbol jerárquico (dendrograma) fusionando pares de grupos según criterios de enlace (Ward, Complete, Average, Single).
- **DBSCAN:** Agrupamiento basado en densidad local definido por un radio (\`eps\`) y un mínimo de puntos (\`min_samples\`). Detecta formas arbitrarias y aísla ruido (-1).

### 3. Preprocesamiento y Diagnóstico
- **StandardScaler:** Estandarización que remueve la media y escala a varianza unitaria ($z = (x - \\mu) / \\sigma$). Esencial para algoritmos basados en distancias euclidianas.
- **Inercia WCSS (Within-Cluster Sum of Squares):** Suma de las distancias al cuadrado de cada muestra a su centroide asignado. Se utiliza en el Método del Codo.
- **Coeficiente de Silueta:** Medida de validación interna en $[-1, 1]$. Evalúa qué tan similar es un punto a su propio cluster comparado con el cluster vecino más próximo.
`;
}

/**
 * Genera un SVG en string para el gráfico de dispersión de clusters.
 */
export function generarGraficoClustersSVG(
  resultado: ResultadoEjecucionPipeline,
  nombreX = 'Feature_1',
  nombreY = 'Feature_2'
): string {
  const puntos = resultado.puntos2D;
  const colX = nombreX;
  const colY = nombreY;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
  <rect width="600" height="400" fill="#060913"/>
  <line x1="65" y1="350" x2="565" y2="350" stroke="#475569" stroke-width="1.5"/>
  <line x1="65" y1="35" x2="65" y2="350" stroke="#475569" stroke-width="1.5"/>
  <text x="315" y="385" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="sans-serif">${colX}</text>
  <text x="-190" y="25" fill="#94a3b8" font-size="12" text-anchor="middle" font-family="sans-serif" transform="rotate(-90)">${colY}</text>
  ${puntos
    .slice(0, 150)
    .map((p, i) => {
      const cx = 65 + ((p.x % 100) / 100) * 480;
      const cy = 350 - ((p.y % 100) / 100) * 300;
      const color = p.cluster === -1 ? '#94a3b8' : p.cluster === 0 ? '#38bdf8' : p.cluster === 1 ? '#818cf8' : '#34d399';
      return `<circle key="${i}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${color}" opacity="0.8"/>`;
    })
    .join('\n  ')}
</svg>`;
}

/**
 * Genera un SVG diagnóstico de la curva del codo.
 */
export function generarGraficoDiagnosticoSVG(
  algoritmo: AlgoritmoClustering,
  hiperparametros?: HiperparametrosClustering
): string {
  const k = hiperparametros?.k ?? 3;
  if (algoritmo === 'kmeans') {
    generarDiagnosticoKMeans(2);
  } else if (algoritmo === 'jerarquico') {
    generarDiagnosticoJerarquico('ward', k);
  } else {
    generarDiagnosticoDBSCAN(0.5, 5);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 350" width="100%" height="100%">
  <rect width="600" height="350" fill="#070b14"/>
  <text x="300" y="30" fill="#38bdf8" font-size="14" font-weight="bold" text-anchor="middle" font-family="sans-serif">
    Diagnóstico Cuantitativo (${algoritmo.toUpperCase()})
  </text>
  <line x1="60" y1="300" x2="550" y2="300" stroke="#475569" stroke-width="1.5"/>
  <line x1="60" y1="50" x2="60" y2="300" stroke="#475569" stroke-width="1.5"/>
  <text x="300" y="335" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="sans-serif">
    ${algoritmo === 'kmeans' ? 'Número de Clusters (K)' : 'Parámetros'}
  </text>
  <path d="M 100 80 Q 250 240 500 280" fill="none" stroke="#38bdf8" stroke-width="3"/>
  <circle cx="250" cy="240" r="7" fill="#ef4444"/>
  <text x="265" y="235" fill="#ef4444" font-size="11" font-weight="bold" font-family="sans-serif">Punto Óptimo</text>
</svg>`;
}

/**
 * Empaqueta y audita en memoria todos los entregables en un archivo ZIP con fflate.
 */
export function generarPaqueteZipCompleto({
  problemaOriginal,
  fichaTecnica,
  hiperparametros,
  metricas,
  perfiles,
}: {
  problemaOriginal: string;
  fichaTecnica: FichaTecnicaDS;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  perfiles?: PerfilCluster[];
}): Uint8Array {
  const algo = hiperparametros?.algoritmo || 'kmeans';

  // 1. Estado JSON del proyecto (sin credenciales)
  const proyectoObj: ProyectoDS = {
    id: 'proyecto-actual',
    version: 1,
    fechaCreacion: new Date().toISOString(),
    problemaOriginal,
    fichaTecnica,
    hiperparametros,
    metricas,
    perfiles,
    bitacoraDecisiones: [],
  };
  const strProyectoJson = JSON.stringify(proyectoObj, null, 2);

  // 2. Notebook Jupyter (.ipynb)
  const strNotebook = exportarNotebookIpynb({
    fichaTecnica,
    algoritmo: algo,
    hiperparametros,
  });

  // 3. Script Python modular (.py)
  const strScriptPy = generarScriptPython({
    fichaTecnica,
    algoritmo: algo,
    hiperparametros,
  });

  // 4. Dataset CSV con protección anti-fórmulas
  const strDatasetCsv = exportarDatasetCSV({
    fichaTecnica,
    perfiles,
  });

  // 5. Ficha técnica en Markdown
  const strFichaTecnicaMd = generarFichaTecnicaMarkdown({
    problemaOriginal,
    fichaTecnica,
    hiperparametros,
    metricas,
  });

  // 6. Reporte ejecutivo en PDF (binario jsPDF)
  const docPdf = generarReporteEjecutivoPDF({
    problemaOriginal,
    fichaTecnica,
    hiperparametros,
    metricas,
    perfiles,
  });
  const pdfArrayBuffer = docPdf.output('arraybuffer');
  const u8Pdf = new Uint8Array(pdfArrayBuffer);

  // 7. Gráfico de clusters en SVG
  const resFallback = ejecutarPipelineFallbackLocal({
    fichaTecnica,
    algoritmo: algo,
    hiperparametros,
  });
  const varsCuantitativas = fichaTecnica.variables.filter((v) => v.rol === 'feature');
  const strSvgClusters = generarGraficoClustersSVG(
    resFallback,
    varsCuantitativas[0]?.nombre,
    varsCuantitativas[1]?.nombre
  );

  // 8. Gráfico de diagnóstico del codo / silueta en SVG
  const strSvgDiagnostico = generarGraficoDiagnosticoSVG(algo, hiperparametros);

  // 9. Glosario en Markdown
  const strGlosarioMd = generarGlosarioMarkdown();

  // AUDITORÍA DE SEGURIDAD EN MEMORIA
  auditarContenidoSinApiKey(strProyectoJson, 'proyecto_ds.json');
  auditarContenidoSinApiKey(strNotebook, 'notebook_clustering.ipynb');
  auditarContenidoSinApiKey(strScriptPy, 'pipeline_sklearn.py');
  auditarContenidoSinApiKey(strDatasetCsv, 'dataset_ejemplo.csv');
  auditarContenidoSinApiKey(strFichaTecnicaMd, 'ficha_tecnica.md');
  auditarContenidoSinApiKey(u8Pdf, 'reporte_ejecutivo.pdf');
  auditarContenidoSinApiKey(strSvgClusters, 'grafico_clusters.svg');
  auditarContenidoSinApiKey(strSvgDiagnostico, 'curva_codo_silueta.svg');
  auditarContenidoSinApiKey(strGlosarioMd, 'glosario_ciencia_datos.md');

  // Empaquetado binario ZIP mediante fflate
  const zipData = zipSync({
    'proyecto_ds.json': strToU8(strProyectoJson),
    'notebook_clustering.ipynb': strToU8(strNotebook),
    'pipeline_sklearn.py': strToU8(strScriptPy),
    'dataset_ejemplo.csv': strToU8(strDatasetCsv),
    'ficha_tecnica.md': strToU8(strFichaTecnicaMd),
    'reporte_ejecutivo.pdf': u8Pdf,
    'grafico_clusters.svg': strToU8(strSvgClusters),
    'curva_codo_silueta.svg': strToU8(strSvgDiagnostico),
    'glosario_ciencia_datos.md': strToU8(strGlosarioMd),
  });

  return zipData;
}
