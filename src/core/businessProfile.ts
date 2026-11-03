import { z } from 'zod';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
  PerfilCluster,
  PerfilClusterSchema,
} from './schemas';
import {
  ejecutarPipelineFallbackLocal,
  ResumenClusterInfo,
} from './workers/pyodideClient';
import { consultarGeminiEstructurado } from './gemini';

export interface MedidaDAX {
  nombre: string;
  formula: string;
  descripcion: string;
}

export interface GuiaPowerBI {
  modeloRecomendado: string;
  pasosImportacion: string[];
  medidasDAX: MedidaDAX[];
  kpisSugeridos: string[];
  visualizacionesRecomendadas: string[];
}

function normalizarClusterId(raw: number | string): number | string {
  if (typeof raw === 'number') return raw;
  const str = String(raw).trim();
  if (str.includes('-1') || str.toLowerCase().includes('ruido')) return -1;
  const match = str.match(/(\d+)/);
  if (match) return Number(match[1]);
  return str;
}

/**
 * Construye viñetas cuantitativas reales a partir de las medias de cada variable en el cluster
 * comparadas con el promedio general de todos los clusters.
 */
function describirMediasCluster(
  mediasCluster: Record<string, number>,
  mediasGlobales: Record<string, number>,
  pct: number
): string[] {
  const entradas = Object.entries(mediasCluster);
  if (entradas.length === 0) return [];

  const descripciones: string[] = entradas.map(([nombreVar, valor]) => {
    const globalVal = mediasGlobales[nombreVar] || valor || 1;
    const ratio = valor / (globalVal || 1);
    const nivel =
      ratio >= 1.22
        ? 'Nivel Alto (por encima de la media)'
        : ratio <= 0.78
          ? 'Nivel Bajo (por debajo de la media)'
          : 'Nivel Intermedio / Moderado';
    return `${nombreVar}: promedio de ${valor.toLocaleString('es-AR', {
      maximumFractionDigits: 2,
    })} — ${nivel}.`;
  });

  descripciones.push(`Concentra el ${pct}% de las observaciones analizadas.`);
  return descripciones;
}

/**
 * Genera perfiles cualitativos y cuantitativos reales a partir de las métricas y las medias de cada cluster.
 */
export function generarPerfilesDeNegocio({
  fichaTecnica,
  algoritmo,
  hiperparametros,
  resumenClusters,
}: {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  resumenClusters?: ResumenClusterInfo[];
}): PerfilCluster[] {
  const esRetail =
    fichaTecnica.problemaNegocio.toLowerCase().includes('cliente') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('retail') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('compra') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('tienda');

  const esSensores =
    fichaTecnica.problemaNegocio.toLowerCase().includes('sensor') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('vehículo') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('vibraci') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('turbina');

  // Si no se proveyó resumenClusters explícito, calculamos el agrupamiento matemático real sobre el dataset
  const infoClusters: ResumenClusterInfo[] =
    resumenClusters && resumenClusters.length > 0
      ? resumenClusters
      : ejecutarPipelineFallbackLocal({
          fichaTecnica,
          algoritmo,
          hiperparametros,
        }).resumenClusters;

  // Calcular medias globales por variable para comparar niveles relativos (Alto / Medio / Bajo)
  const mediasGlobales: Record<string, number> = {};
  const conteosVar: Record<string, number> = {};
  for (const info of infoClusters) {
    for (const [k, v] of Object.entries(info.medias || {})) {
      mediasGlobales[k] = (mediasGlobales[k] || 0) + v;
      conteosVar[k] = (conteosVar[k] || 0) + 1;
    }
  }
  for (const k of Object.keys(mediasGlobales)) {
    mediasGlobales[k] = mediasGlobales[k] / (conteosVar[k] || 1);
  }

  let indiceDenso = 0;

  return infoClusters.map((info) => {
    const cid = normalizarClusterId(info.cluster);
    const pct = info.porcentaje;
    const detallesReales = describirMediasCluster(info.medias || {}, mediasGlobales, pct);

    if (cid === -1) {
      return {
        clusterId: -1,
        nombreDescriptivo: 'Observaciones Atípicas / Ruido Operativo',
        caracteristicasClave:
          detallesReales.length > 0
            ? [
                ...detallesReales,
                'Muestras que no cumplen la densidad mínima local (aisladas por DBSCAN con etiqueta -1).',
              ]
            : [
                `Representa el ${pct}% del volumen total procesado.`,
                'Muestras que no cumplen la densidad mínima local (aisladas por DBSCAN).',
                'Comportamientos no estandarizados o transacciones anómalas.',
              ],
        tamanoRelativoPct: pct,
        accionDeNegocioRecomendada:
          'Aislar de las campañas masivas y enviar a revisión manual o auditoría de calidad de datos.',
      };
    }

    const idxActual = indiceDenso++;

    if (esRetail) {
      const perfilesRetail = [
        {
          nombre: 'Compradores Recurrentes de Ticket Moderado',
          caracteristicasFallback: [
            'Alta frecuencia de compras mensuales.',
            'Sensibilidad a promociones y descuentos periódicos.',
            `Abarca aproximadamente el ${pct}% de la cartera activa.`,
          ],
          accion:
            'Implementar programa de puntos por repetición y combos de productos cruzados (cross-selling).',
        },
        {
          nombre: 'Clientes Ocasionales de Alto Impacto',
          caracteristicasFallback: [
            'Baja frecuencia pero ticket medio significativamente superior.',
            'Adquieren líneas premium o compras de temporada.',
            `Concentra el ${pct}% de los clientes.`,
          ],
          accion:
            'Campañas de reactivación vía email marketing personalizado antes de fechas clave.',
        },
        {
          nombre: 'Clientes VIP de Máximo Valor',
          caracteristicasFallback: [
            'Lideran en facturación acumulada y frecuencia sostenida.',
            'Máxima lealtad y adopción temprana de novedades.',
            `Representa el ${pct}% más rentable del negocio.`,
          ],
          accion:
            'Atención preferencial por ejecutivo de cuenta, acceso anticipado y beneficios exclusivos.',
        },
      ];
      const p = perfilesRetail[idxActual % perfilesRetail.length];
      return {
        clusterId: cid,
        nombreDescriptivo: p.nombre,
        caracteristicasClave:
          detallesReales.length > 0 ? detallesReales : p.caracteristicasFallback,
        tamanoRelativoPct: pct,
        accionDeNegocioRecomendada: p.accion,
      };
    }

    if (esSensores) {
      const perfilesSensores = [
        {
          nombre: 'Régimen Operativo Nominal y Estable',
          caracteristicasFallback: [
            'Valores de vibración y temperatura dentro de los rangos de calibración.',
            'Consistencia temporal en lecturas continuas.',
            `Comprende el ${pct}% del tiempo de funcionamiento.`,
          ],
          accion:
            'Mantener el cronograma estándar de mantenimiento preventivo sin intervenciones.',
        },
        {
          nombre: 'Zona de Advertencia y Fatiga Dinámica',
          caracteristicasFallback: [
            'Desplazamiento leve de temperatura y fluctuaciones de frecuencia.',
            'Indicios de desgaste mecánico incipiente.',
            `Detectado en el ${pct}% de los ciclos evaluados.`,
          ],
          accion:
            'Programar inspección visual y lubricación en la próxima parada programada de planta.',
        },
        {
          nombre: 'Régimen de Alto Esfuerzo Crítico',
          caracteristicasFallback: [
            'Altas magnitudes combinadas en múltiples sensores.',
            'Cercanía a los umbrales de seguridad de ingeniería.',
            `Ocurre en el ${pct}% de las operaciones monitoreadas.`,
          ],
          accion:
            'Reducción preventiva de carga de trabajo y auditoría técnica inmediata de componentes.',
        },
      ];
      const p = perfilesSensores[idxActual % perfilesSensores.length];
      return {
        clusterId: cid,
        nombreDescriptivo: p.nombre,
        caracteristicasClave:
          detallesReales.length > 0 ? detallesReales : p.caracteristicasFallback,
        tamanoRelativoPct: pct,
        accionDeNegocioRecomendada: p.accion,
      };
    }

    // Caso personalizado de cualquier otro dominio: nombrado según las variables dominantes del cluster
    const entradasMedias = Object.entries(info.medias || {});
    let etiquetaDominante = `Segmento Operativo Nivel ${idxActual + 1}`;
    let accionContextual =
      'Diseñar política focalizada según las magnitudes medias del grupo y monitorear evolución en KPIs.';

    if (entradasMedias.length > 0) {
      const [varPrincipal, valPrincipal] = entradasMedias[0];
      const globalPrincipal = mediasGlobales[varPrincipal] || valPrincipal || 1;
      if (valPrincipal >= globalPrincipal * 1.18) {
        etiquetaDominante = `Segmento de Alta Intensidad en ${varPrincipal} (Grupo ${cid})`;
        accionContextual = `Priorizar gestión intensiva y seguimiento personalizado sobre los registros con ${varPrincipal} elevado (~${valPrincipal}).`;
      } else if (valPrincipal <= globalPrincipal * 0.82) {
        etiquetaDominante = `Segmento de Baja Intensidad en ${varPrincipal} (Grupo ${cid})`;
        accionContextual = `Aplicar estrategia de desarrollo o prevención temprana para registros con bajo nivel relativo en ${varPrincipal} (~${valPrincipal}).`;
      } else {
        etiquetaDominante = `Segmento de Comportamiento Balanceado en ${varPrincipal} (Grupo ${cid})`;
        accionContextual = `Automatizar el monitoreo regular en tableros de BI mantendo los estándares actuales para este grupo intermedio.`;
      }
    }

    return {
      clusterId: cid,
      nombreDescriptivo: etiquetaDominante,
      caracteristicasClave:
        detallesReales.length > 0
          ? detallesReales
          : [
              `Concentra el ${pct}% de la población total.`,
              `Agrupamiento generado bajo el algoritmo ${algoritmo.toUpperCase()}.`,
              'Patrón homogéneo en las dimensiones cuantitativas evaluadas.',
            ],
      tamanoRelativoPct: pct,
      accionDeNegocioRecomendada: accionContextual,
    };
  });
}

/**
 * Optimiza y contextualiza los perfiles de negocio utilizando el LLM conectado
 * pasándole las medias cuantitativas reales de cada cluster.
 */
export async function optimizarPerfilesConIA({
  fichaTecnica,
  algoritmo,
  hiperparametros,
  metricas,
  resumenClusters,
}: {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  resumenClusters?: ResumenClusterInfo[];
}): Promise<PerfilCluster[]> {
  const perfilesBase = generarPerfilesDeNegocio({
    fichaTecnica,
    algoritmo,
    hiperparametros,
    metricas,
    resumenClusters,
  });

  const prompt = `Actuá como un Consultor Senior de Inteligencia de Negocios y Ciencia de Datos.
El estudiante completó un modelo de clustering (${algoritmo.toUpperCase()}) para el siguiente problema:
"${fichaTecnica.problemaNegocio}"

Variables del modelo:
${fichaTecnica.variables.map((v) => `- ${v.nombre} (${v.tipo}, ${v.rol}): ${v.descripcion}`).join('\n')}

Perfiles cuantitativos calculados por el algoritmo (con medias reales por variable):
${JSON.stringify(perfilesBase, null, 2)}

Tu tarea pedagógica:
1. Refiná el campo "nombreDescriptivo" de cada cluster para que sea específico al dominio del problema, atractivo y orientado a decisiones ejecutivas.
2. Enriquecé "caracteristicasClave" (array de strings) interpretando los promedios numéricos reales de cada variable en ese cluster.
3. Redactá una "accionDeNegocioRecomendada" (string) concreta y accionable para ese segmento.
4. Mantené EXACTAMENTE los mismos valores de "clusterId" y "tamanoRelativoPct" de cada elemento.
5. Respondé ÚNICAMENTE con un array JSON válido donde cada objeto tenga las claves exactas:
   "clusterId", "nombreDescriptivo", "caracteristicasClave", "tamanoRelativoPct", "accionDeNegocioRecomendada".`;

  try {
    const resultado = await consultarGeminiEstructurado({
      prompt,
      schema: z.array(PerfilClusterSchema),
      systemInstruction:
        'Sos un especialista en Business Intelligence y Machine Learning de la cátedra Paulo Freire. Respondés únicamente con un array JSON válido respetando exactamente las claves solicitadas.',
    });
    return resultado;
  } catch {
    return perfilesBase;
  }
}

/**
 * Genera la guía técnica para conectar los clusters con Power BI y fórmulas DAX.
 */
export function generarGuiaPowerBI({
  fichaTecnica,
  perfiles,
}: {
  fichaTecnica: FichaTecnicaDS;
  perfiles: PerfilCluster[];
}): GuiaPowerBI {
  const varsCuantitativas = fichaTecnica.variables.filter(
    (v) =>
      (v.rol === 'feature' || v.rol === 'target') &&
      (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
  );

  const variableNumerica = varsCuantitativas[0]?.nombre || 'Monto';
  const segundaVariable = varsCuantitativas[1]?.nombre || variableNumerica;

  const medidasDAX: MedidaDAX[] = [
    {
      nombre: `Total_${variableNumerica}`,
      formula: `Total_${variableNumerica} = SUM(Datos[${variableNumerica}])`,
      descripcion: `Calcula el acumulado global de la métrica principal ${variableNumerica}.`,
    },
    {
      nombre: `Promedio_${segundaVariable}`,
      formula: `Promedio_${segundaVariable} = AVERAGE(Datos[${segundaVariable}])`,
      descripcion: `Mide el valor medio de ${segundaVariable} por registro en cada cluster.`,
    },
    {
      nombre: 'Participacion_Cluster_Pct',
      formula: `Participacion_Cluster_Pct = 
DIVIDE(
    CALCULATE(COUNTROWS(Datos)),
    CALCULATE(COUNTROWS(Datos), ALL(Datos[cluster])),
    0
)`,
      descripcion: 'Calcula el porcentaje de registros que pertenecen a cada segmento sobre el total.',
    },
    {
      nombre: `Impacto_Segmento_Principal`,
      formula: `Impacto_Segmento_Principal = 
CALCULATE(
    SUM(Datos[${variableNumerica}]),
    Datos[cluster_nombre] = "${perfiles[0]?.nombreDescriptivo || 'Cluster 0'}"
)`,
      descripcion: `Filtra dinámicamente la métrica ${variableNumerica} del segmento "${perfiles[0]?.nombreDescriptivo || 'Cluster 0'}" mediante CALCULATE.`,
    },
  ];

  return {
    modeloRecomendado:
      'Esquema en Estrella (Star Schema): Tabla de Hechos (Datos) vinculada 1 a N con la dimensión Dim_Segmentos mediante la clave cluster.',
    pasosImportacion: [
      '1. Exportar el archivo dataset_ejemplo.csv con las columnas agregadas "cluster" y "cluster_nombre" desde el Paso 9.',
      '2. Abrir Power BI Desktop > "Obtener datos" > "Texto/CSV" y cargar el archivo.',
      '3. En Power Query, verificar que las variables cuantitativas tengan tipo Número Decimal y "cluster_nombre" sea Texto.',
      '4. Crear una tabla de dimensión "Dim_Segmentos" vinculando el ID del cluster con su Nombre Descriptivo y Estrategia.',
      '5. Crear las medidas DAX sugeridas para analizar participación y promedios por grupo.',
      `6. Insertar un gráfico de dispersión con ${variableNumerica} en el Eje X, ${segundaVariable} en el Eje Y y cluster_nombre en Leyenda.`,
    ],
    medidasDAX,
    kpisSugeridos: [
      `Promedio de ${variableNumerica} por Segmento`,
      `Promedio de ${segundaVariable} por Cluster`,
      'Tasa de Concentración por Grupo (%)',
      'Volumen de Observaciones Atípicas / Ruido',
    ],
    visualizacionesRecomendadas: [
      `Gráfico de Dispersión (Scatter Plot) de ${variableNumerica} vs ${segundaVariable} coloreado por cluster_nombre.`,
      'Gráfico de Treemap para visualizar la participación porcentual de cada grupo.',
      'Tarjetas de KPI con variación frente al promedio global.',
      'Matriz con desglose por segmento y variables explicativas.',
    ],
  };
}
