import { FichaTecnicaDS, VariableDS } from './schemas';

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

  const columnas =
    columnasEspecificas && columnasEspecificas.length > 0
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

interface PerfilEscalaVariable {
  centros: [number, number, number];
  desvioRelativo: number;
  minimo: number;
  maximo?: number;
}

/**
 * Infiere centros multimodales realistas para cada variable cuantitativa según su nombre,
 * descripción e índice de feature, garantizando que cada columna tenga unidades verosímiles
 * y que los 3 grupos formen una geometría 2D/ND no colineal bien diferenciada.
 */
export function inferirEscalaVariable(
  variable: VariableDS,
  featureIndex: number,
  problemaNegocio: string
): PerfilEscalaVariable {
  const texto = `${variable.nombre} ${variable.descripcion} ${problemaNegocio}`.toLowerCase();
  const nombre = variable.nombre.toLowerCase();

  let base: [number, number, number] = [25, 65, 110];
  let minimo = 0.5;
  let maximo: number | undefined = undefined;
  let desvioRelativo = 0.11;

  if (nombre.includes('edad') || nombre.includes('anio') || nombre.includes('año')) {
    base = [25, 44, 63];
    minimo = 18;
    maximo = 90;
    desvioRelativo = 0.09;
  } else if (
    nombre.includes('pct') ||
    nombre.includes('porcentaje') ||
    nombre.includes('tasa') ||
    nombre.includes('ratio') ||
    nombre.includes('asistencia') ||
    nombre.includes('humedad')
  ) {
    base = [22, 56, 88];
    minimo = 1;
    maximo = 100;
    desvioRelativo = 0.09;
  } else if (
    nombre.includes('factor_potencia') ||
    (nombre.includes('indice') && texto.includes('0.'))
  ) {
    base = [0.66, 0.82, 0.96];
    minimo = 0.45;
    maximo = 1.0;
    desvioRelativo = 0.04;
  } else if (
    nombre.includes('promedio') ||
    nombre.includes('calificacion') ||
    nombre.includes('nota') ||
    nombre.includes('puntaje') ||
    nombre.includes('satisfaccion') ||
    nombre.includes('score')
  ) {
    base = [3.8, 6.8, 9.1];
    minimo = 1;
    maximo = 10;
    desvioRelativo = 0.08;
  } else if (
    nombre.includes('ticket') ||
    nombre.includes('monto') ||
    nombre.includes('gasto') ||
    nombre.includes('facturacion') ||
    nombre.includes('ingreso') ||
    nombre.includes('salario') ||
    nombre.includes('precio') ||
    nombre.includes('venta')
  ) {
    base = [24000, 92000, 185000];
    minimo = 1500;
    desvioRelativo = 0.11;
  } else if (
    nombre.includes('frecuencia') ||
    nombre.includes('compra') ||
    nombre.includes('visita') ||
    nombre.includes('consulta') ||
    nombre.includes('pedido') ||
    nombre.includes('cantidad')
  ) {
    base = [3, 13, 25];
    minimo = 1;
    desvioRelativo = 0.12;
  } else if (
    nombre.includes('recencia') ||
    nombre.includes('dia') ||
    nombre.includes('día') ||
    nombre.includes('demora')
  ) {
    base = [15, 75, 180];
    minimo = 1;
    desvioRelativo = 0.11;
  } else if (nombre.includes('antiguedad') || nombre.includes('mes')) {
    base = [6, 26, 58];
    minimo = 1;
    desvioRelativo = 0.11;
  } else if (
    nombre.includes('temp') ||
    nombre.includes('grado') ||
    nombre.includes('calor') ||
    nombre.includes('glucemia')
  ) {
    base = [35, 68, 105];
    minimo = 15;
    desvioRelativo = 0.09;
  } else if (
    nombre.includes('vibrac') ||
    nombre.includes('hz') ||
    nombre.includes('rpm') ||
    nombre.includes('presion') ||
    nombre.includes('sensor')
  ) {
    base = [18, 52, 88];
    minimo = 2;
    desvioRelativo = 0.1;
  } else if (
    nombre.includes('consumo') ||
    nombre.includes('kwh') ||
    nombre.includes('energia') ||
    nombre.includes('volumen') ||
    nombre.includes('demanda')
  ) {
    base = [160, 520, 1180];
    minimo = 10;
    desvioRelativo = 0.11;
  } else if (
    nombre.includes('hora') ||
    nombre.includes('tiempo') ||
    nombre.includes('minuto') ||
    nombre.includes('duracion')
  ) {
    base = [3.5, 11.5, 22.0];
    minimo = 0.5;
    desvioRelativo = 0.11;
  } else {
    // Escalas diferenciadas según el índice de feature para evitar columnas idénticas
    const escalasPorIndice: [number, number, number][] = [
      [24, 68, 115],
      [12, 46, 84],
      [150, 480, 920],
      [8, 26, 52],
      [45, 130, 260],
    ];
    base = escalasPorIndice[featureIndex % escalasPorIndice.length];
  }

  // Permutamos el orden de los centros en features impares para que los 3 clusters
  // formen un triángulo en el plano 2D en lugar de una recta colineal.
  const centros: [number, number, number] =
    featureIndex % 2 === 1 ? [base[1], base[0], base[2]] : [base[0], base[1], base[2]];

  return { centros, desvioRelativo, minimo, maximo };
}

/**
 * Infiere categorías nominales coherentes según el nombre de la variable.
 */
function inferirCategoriasNominales(variable: VariableDS): string[] {
  const n = `${variable.nombre} ${variable.descripcion}`.toLowerCase();
  if (n.includes('canal') || n.includes('medio')) {
    return ['Tienda Online', 'App Móvil', 'Sucursal Física', 'Venta Corporativa'];
  }
  if (n.includes('rubro') || n.includes('categoria') || n.includes('linea') || n.includes('producto')) {
    return ['Línea Esencial', 'Línea Profesional', 'Hogar & Deco', 'Tecnología'];
  }
  if (n.includes('turno') || n.includes('horario')) {
    return ['Mañana', 'Tarde', 'Noche', 'Rotativo'];
  }
  if (n.includes('estado') || n.includes('condicion')) {
    return ['Activo', 'En Revisión', 'Regular', 'Prioritario'];
  }
  return ['Zona Norte', 'Zona Sur', 'Zona Centro', 'Metropolitana'];
}

/**
 * Genera un dataset sintético coherente y estadísticamente realista para el problema de negocio.
 * Produce agrupamientos multimodales bien diferenciados según cada variable de la Ficha Técnica,
 * incluyendo una pequeña proporción de observaciones atípicas para pruebas de DBSCAN/Outliers.
 */
export function generarDatasetSintetico(
  fichaTecnica: FichaTecnicaDS,
  nMuestras = 120,
  seed = 42
): Record<string, number | string>[] {
  const rnd = crearGeneradorAleatorio(seed);
  const nClustersBase = 3;

  // Pre-calcular escalas por variable cuantitativa
  const escalasPorVar = new Map<string, PerfilEscalaVariable>();
  let fIdx = 0;
  for (const variable of fichaTecnica.variables) {
    if (
      variable.rol !== 'identificador' &&
      (variable.tipo === 'numerica_continua' || variable.tipo === 'numerica_discreta')
    ) {
      escalasPorVar.set(
        variable.nombre,
        inferirEscalaVariable(variable, fIdx, fichaTecnica.problemaNegocio)
      );
      fIdx++;
    }
  }

  // Proporciones asimétricas realistas (ej. ~38%, ~34%, ~24% + ~4% outliers)
  const filas: Record<string, number | string>[] = [];
  const cantidadOutliers = Math.max(3, Math.round(nMuestras * 0.04));

  for (let i = 0; i < nMuestras; i++) {
    const fila: Record<string, number | string> = {};
    const esOutlier = i >= nMuestras - cantidadOutliers;

    // Distribución de clusters: 0, 1, 2 con tamaños realistas
    const mod = i % 10;
    const clusterAsignado = mod < 4 ? 0 : mod < 7 ? 1 : 2;

    let featureIndex = 0;

    for (const variable of fichaTecnica.variables) {
      const nombre = variable.nombre;

      if (variable.rol === 'identificador') {
        fila[nombre] = `ID-${String(i + 1).padStart(4, '0')}`;
        continue;
      }

      if (variable.tipo === 'numerica_continua' || variable.tipo === 'numerica_discreta') {
        const escala =
          escalasPorVar.get(nombre) ||
          inferirEscalaVariable(variable, featureIndex, fichaTecnica.problemaNegocio);

        let valor: number;
        if (esOutlier) {
          // Punto atípico alejado de los centros densos (útil para evaluar sensibilidad a outliers y DBSCAN -1)
          const extremoAlto = escala.centros[2] * (1.42 + (i % 3) * 0.12);
          const extremoBajo = Math.max(escala.minimo, escala.centros[0] * 0.25);
          valor = (i + featureIndex) % 2 === 0 ? extremoAlto : extremoBajo;
        } else {
          const centroBase = escala.centros[clusterAsignado % nClustersBase];
          const desvioBase = Math.max(0.02, centroBase * escala.desvioRelativo);
          valor = muestraNormal(rnd, centroBase, desvioBase);
        }

        if (escala.maximo !== undefined) {
          valor = Math.min(escala.maximo, valor);
        }
        valor = Math.max(escala.minimo, valor);

        if (variable.tipo === 'numerica_discreta') {
          valor = Math.max(0, Math.round(valor));
        } else {
          valor = Number(valor.toFixed(2));
        }

        fila[nombre] = valor;
        featureIndex++;
      } else if (variable.tipo === 'categorica_nominal') {
        const opciones = inferirCategoriasNominales(variable);
        fila[nombre] = opciones[(clusterAsignado + Math.floor(rnd() * 2)) % opciones.length];
      } else if (variable.tipo === 'categorica_ordinal') {
        const niveles = ['Bajo', 'Medio', 'Alto', 'Premium'];
        fila[nombre] = niveles[clusterAsignado % niveles.length];
      } else if (variable.tipo === 'fecha_hora') {
        const dia = Math.floor(rnd() * 28) + 1;
        const mes = (clusterAsignado % 3) + 1;
        fila[nombre] = `2025-0${mes}-${String(dia).padStart(2, '0')}`;
      } else {
        fila[nombre] = `Registro ${i + 1}`;
      }
    }

    filas.push(fila);
  }

  return filas;
}
