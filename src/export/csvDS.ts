import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  PerfilCluster,
} from '../core/schemas';
import { generarDatasetSintetico, sanitizarCeldaCSV } from '../core/sampleDataset';
import { ejecutarPipelineFallbackLocal } from '../core/workers/pyodideClient';

/**
 * Genera el archivo CSV enriquecido con etiquetas de cluster reales y nombres descriptivos,
 * con protección anti-fórmulas estricta en cada celda.
 */
export function exportarDatasetCSV({
  fichaTecnica,
  perfiles,
  algoritmo = 'kmeans',
  hiperparametros,
  seed = 42,
  nMuestras = 120,
}: {
  fichaTecnica: FichaTecnicaDS;
  perfiles?: PerfilCluster[];
  algoritmo?: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  seed?: number;
  nMuestras?: number;
}): string {
  const filas = generarDatasetSintetico(fichaTecnica, nMuestras, seed);
  const ejecucion = ejecutarPipelineFallbackLocal({
    fichaTecnica,
    algoritmo: hiperparametros?.algoritmo || algoritmo,
    hiperparametros,
    seedDataset: seed,
  });

  // Enriquecer cada fila con el cluster real asignado y su nombre descriptivo
  const filasEnriquecidas: Record<string, unknown>[] = filas.map((fila, idx) => {
    const clusterId = ejecucion.puntos2D[idx]?.cluster ?? idx % (perfiles?.length || 3);
    const perfil =
      perfiles?.find((p) => Number(p.clusterId) === clusterId) ||
      perfiles?.[Math.max(0, clusterId) % (perfiles?.length || 1)];
    return {
      ...fila,
      cluster: clusterId,
      cluster_nombre:
        clusterId === -1
          ? perfil?.nombreDescriptivo || 'Ruido (-1)'
          : perfil
            ? perfil.nombreDescriptivo
            : `Cluster ${clusterId}`,
    };
  });

  const columnas = Object.keys(filasEnriquecidas[0] || {});
  const encabezado = columnas.map(sanitizarCeldaCSV).join(',');
  const cuerpo = filasEnriquecidas
    .map((fila) => columnas.map((col) => sanitizarCeldaCSV(fila[col])).join(','))
    .join('\n');

  return `${encabezado}\n${cuerpo}`;
}
