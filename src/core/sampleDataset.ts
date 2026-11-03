import { FichaTecnicaDS } from './schemas';

/**
 * Escapa valores para CSV asegurando protección contra inyección de fórmulas (CSV Injection).
 * Cualquier celda de texto que comience con '=', '+', '-', '@', tabulación o retorno se neutraliza con "'".
 */
export function sanitizarCeldaCSV(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const str = String(valor).trim();

  // Si comienza con caracteres ejecutables en Excel/Sheets, anteponer apóstrofe
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }

  // Si contiene comas, comillas dobles o saltos de línea, envolver entre comillas
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convierte un array de registros en un string CSV seguro anti-fórmulas.
 */
export function convertirADatasetCSV(
  filas: Record<string, number | string>[],
  columnasEspecificas?: string[]
): string {
  if (filas.length === 0) return '';

  const columnas = columnasEspecificas && columnasEspecificas.length > 0
    ? columnasEspecificas
    : Object.keys(filas[0]);

  const encabezado = columnas.map(sanitizarCeldaCSV).join(',');
  const cuerpo = filas
    .map((fila) => columnas.map((col) => sanitizarCeldaCSV(fila[col])).join(','))
    .join('\n');

  return `${encabezado}\n${cuerpo}`;
}

/**
 * Generador pseudo-aleatorio con semilla simple para datos sintéticos reproducibles.
 */
function crearGeneradorAleatorio(seedInicial = 42) {
  let s = seedInicial;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Genera una muestra de distribución normal estándar usando Box-Muller.
 */
function muestraNormal(rnd: () => number, media = 0, desvio = 1): number {
  const u1 = Math.max(1e-7, rnd());
  const u2 = rnd();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return media + z0 * desvio;
}

/**
 * Genera un dataset sintético coherente y estadísticamente realista para el problema de negocio.
 * Produce agrupamientos multimodales (clusters diferenciados) para que los algoritmos puedan
 * descubrir estructura geométrica verosímil.
 */
export function generarDatasetSintetico(
  fichaTecnica: FichaTecnicaDS,
  nMuestras = 120,
  seed = 42
): Record<string, number | string>[] {
  const rnd = crearGeneradorAleatorio(seed);
  const nClusters = 3;

  // Parámetros base para retail o sensores según el enunciado
  const esRetail =
    fichaTecnica.problemaNegocio.toLowerCase().includes('cliente') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('retail') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('compra');

  const esSensores =
    fichaTecnica.problemaNegocio.toLowerCase().includes('sensor') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('vehículo') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('vibraci');

  // Centros multimodales para features cuantitativas
  const centrosKMeans = [
    { c1: esRetail ? 25000 : esSensores ? 25 : 20, c2: esRetail ? 3 : esSensores ? 45 : 15 },
    { c1: esRetail ? 95000 : esSensores ? 65 : 60, c2: esRetail ? 14 : esSensores ? 75 : 55 },
    { c1: esRetail ? 180000 : esSensores ? 95 : 90, c2: esRetail ? 22 : esSensores ? 88 : 85 },
  ];

  const filas: Record<string, number | string>[] = [];

  for (let i = 0; i < nMuestras; i++) {
    const fila: Record<string, number | string> = {};
    const clusterAsignado = i % nClusters;
    const centro = centrosKMeans[clusterAsignado];

    let featureIndex = 0;

    for (const variable of fichaTecnica.variables) {
      const nombre = variable.nombre;

      if (variable.rol === 'identificador') {
        fila[nombre] = `ID-${String(i + 1).padStart(4, '0')}`;
        continue;
      }

      if (variable.tipo === 'numerica_continua' || variable.tipo === 'numerica_discreta') {
        const centroBase = featureIndex === 0 ? centro.c1 : featureIndex === 1 ? centro.c2 : (centro.c1 + centro.c2) / 2;
        const desvioBase = Math.max(1, centroBase * 0.18);
        let valor = muestraNormal(rnd, centroBase, desvioBase);

        if (variable.tipo === 'numerica_discreta') {
          valor = Math.max(0, Math.round(valor));
        } else {
          valor = Number(Math.max(0.1, valor).toFixed(2));
        }

        fila[nombre] = valor;
        featureIndex++;
      } else if (variable.tipo === 'categorica_nominal') {
        const opciones = ['Zona Norte', 'Zona Sur', 'Zona Centro', 'Metropolitana'];
        fila[nombre] = opciones[Math.floor(rnd() * opciones.length)];
      } else if (variable.tipo === 'categorica_ordinal') {
        const niveles = ['Bajo', 'Medio', 'Alto', 'Premium'];
        fila[nombre] = niveles[clusterAsignado % niveles.length];
      } else if (variable.tipo === 'fecha_hora') {
        const dia = Math.floor(rnd() * 28) + 1;
        fila[nombre] = `2024-03-${String(dia).padStart(2, '0')}`;
      } else {
        fila[nombre] = `Observación ${i + 1}`;
      }
    }

    filas.push(fila);
  }

  return filas;
}
