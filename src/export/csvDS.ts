import { FichaTecnicaDS, PerfilCluster } from '../core/schemas';
import { generarDatasetSintetico, sanitizarCeldaCSV } from '../core/sampleDataset';

/**
 * Genera el archivo CSV enriquecido con etiquetas de cluster y nombres descriptivos,
 * con protección anti-fórmulas estricta en cada celda.
 */
export function exportarDatasetCSV({
  fichaTecnica,
  perfiles,
  seed = 42,
  nMuestras = 120,
}: {
  fichaTecnica: FichaTecnicaDS;
  perfiles?: PerfilCluster[];
  seed?: number;
  nMuestras?: number;
}): string {
  const filas = generarDatasetSintetico(fichaTecnica, nMuestras, seed);
  const nClusters = perfiles && perfiles.length > 0 ? perfiles.length : 3;

  // Enriquecer cada fila con cluster y nombre descriptivo si existen perfiles
  const filasEnriquecidas: Record<string, unknown>[] = filas.map((fila, idx) => {
    const clusterId = idx % nClusters;
    const perfil = perfiles?.find((p) => Number(p.clusterId) === clusterId) || perfiles?.[clusterId];
    return {
      ...fila,
      cluster: clusterId,
      cluster_nombre: perfil ? perfil.nombreDescriptivo : `Cluster ${clusterId}`,
    };
  });

  const columnas = Object.keys(filasEnriquecidas[0] || {});
  const encabezado = columnas.map(sanitizarCeldaCSV).join(',');
  const cuerpo = filasEnriquecidas
    .map((fila) => columnas.map((col) => sanitizarCeldaCSV(fila[col])).join(','))
    .join('\n');

  return `${encabezado}\n${cuerpo}`;
}
