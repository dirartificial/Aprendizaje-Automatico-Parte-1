import { z } from 'zod';
import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  MetricasEvaluacion,
  PerfilCluster,
  PerfilClusterSchema,
} from './schemas';
import { ResumenClusterInfo } from './workers/pyodideClient';
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

/**
 * Genera perfiles cualitativos determinísticos a partir de las métricas y los clusters obtenidos.
 */
export function generarPerfilesDeNegocio({
  fichaTecnica,
  algoritmo,
  resumenClusters,
}: {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  metricas?: MetricasEvaluacion;
  resumenClusters?: ResumenClusterInfo[];
}): PerfilCluster[] {
  const esRetail =
    fichaTecnica.problemaNegocio.toLowerCase().includes('cliente') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('retail') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('compra');

  const esSensores =
    fichaTecnica.problemaNegocio.toLowerCase().includes('sensor') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('vehículo') ||
    fichaTecnica.problemaNegocio.toLowerCase().includes('vibraci');

  // Si tenemos el resumen real del paso 7, usamos sus proporciones
  const infoClusters =
    resumenClusters && resumenClusters.length > 0
      ? resumenClusters
      : [
          { cluster: 0, conteo: 40, porcentaje: 33.3, medias: {} },
          { cluster: 1, conteo: 40, porcentaje: 33.3, medias: {} },
          { cluster: 2, conteo: 40, porcentaje: 33.4, medias: {} },
        ];

  return infoClusters.map((info, idx) => {
    const cid = info.cluster;
    const pct = info.porcentaje;

    if (cid === -1 || String(cid).includes('Ruido')) {
      return {
        clusterId: -1,
        nombreDescriptivo: 'Observaciones Atípicas / Ruido Operativo',
        caracteristicasClave: [
          `Representa el ${pct}% del volumen total procesado.`,
          'Muestras que no cumplen la densidad mínima local (aisladas por DBSCAN).',
          'Comportamientos no estandarizados o transacciones anómalas.',
        ],
        tamanoRelativoPct: pct,
        accionDeNegocioRecomendada:
          'Aislar de las campañas masivas y enviar a revisión manual o auditoría de calidad de datos.',
      };
    }

    if (esRetail) {
      const perfilesRetail = [
        {
          nombre: 'Compradores Recurrentes de Ticket Moderado',
          caracteristicas: [
            'Alta frecuencia de compras mensuales.',
            'Sensibilidad a promociones y descuentos periódicos.',
            `Abarca aproximadamente el ${pct}% de la cartera activa.`,
          ],
          accion:
            'Implementar programa de puntos por repetición y combos de productos cruzados (cross-selling).',
        },
        {
          nombre: 'Clientes Ocasionales de Alto Impacto',
          caracteristicas: [
            'Baja frecuencia pero ticket medio significativamente superior.',
            'Adquieren líneas premium o compras de temporada.',
            `Concentra el ${pct}% de los clientes.`,
          ],
          accion:
            'Campañas de reactivación vía email marketing personalizado antes de fechas clave.',
        },
        {
          nombre: 'Clientes VIP de Máximo Valor',
          caracteristicas: [
            'Lideran en facturación acumulada y frecuencia sostenida.',
            'Máxima lealtad y adopción temprana de novedades.',
            `Representa el ${pct}% más rentable del negocio.`,
          ],
          accion:
            'Atención preferencial por ejecutivo de cuenta, acceso anticipado y beneficios exclusivos.',
        },
      ];
      const p = perfilesRetail[idx % perfilesRetail.length];
      return {
        clusterId: cid,
        nombreDescriptivo: p.nombre,
        caracteristicasClave: p.caracteristicas,
        tamanoRelativoPct: pct,
        accionDeNegocioRecomendada: p.accion,
      };
    }

    if (esSensores) {
      const perfilesSensores = [
        {
          nombre: 'Régimen Operativo Nominal y Estable',
          caracteristicas: [
            'Valores de vibración y temperatura dentro de los rangos de calibración.',
            'Consistencia temporal en lecturas continuas.',
            `Comprende el ${pct}% del tiempo de funcionamiento.`,
          ],
          accion:
            'Mantener el cronograma estándar de mantenimiento preventivo sin intervenciones.',
        },
        {
          nombre: 'Zona de Advertencia y Fatiga Dinámica',
          caracteristicas: [
            'Desplazamiento leve de temperatura y fluctuaciones de frecuencia.',
            'Indicios de desgaste mecánico incipiente.',
            `Detectado en el ${pct}% de los ciclos evaluados.`,
          ],
          accion:
            'Programar inspección visual y lubricación en la próxima parada programada de planta.',
        },
        {
          nombre: 'Régimen de Alto Esfuerzo Crítico',
          caracteristicas: [
            'Altas magnitudes combinadas en múltiples sensores.',
            'Cercanía a los umbrales de seguridad de ingeniería.',
            `Ocurre en el ${pct}% de las operaciones monitoreadas.`,
          ],
          accion:
            'Reducción preventiva de carga de trabajo y auditoría técnica inmediata de componentes.',
        },
      ];
      const p = perfilesSensores[idx % perfilesSensores.length];
      return {
        clusterId: cid,
        nombreDescriptivo: p.nombre,
        caracteristicasClave: p.caracteristicas,
        tamanoRelativoPct: pct,
        accionDeNegocioRecomendada: p.accion,
      };
    }

    // Caso genérico
    return {
      clusterId: cid,
      nombreDescriptivo: `Segmento Estratégico Grupo ${cid}`,
      caracteristicasClave: [
        `Concentra el ${pct}% de la población total.`,
        `Agrupamiento generado bajo el algoritmo ${algoritmo.toUpperCase()}.`,
        'Patrón homogéneo en las dimensiones cuantitativas evaluadas.',
      ],
      tamanoRelativoPct: pct,
      accionDeNegocioRecomendada:
        'Definir política diferenciada y medir impacto en los KPIs trimestrales.',
    };
  });
}

/**
 * Optimiza y contextualiza los perfiles de negocio utilizando el LLM conectado.
 */
export async function optimizarPerfilesConIA({
  fichaTecnica,
  algoritmo,
  resumenClusters,
}: {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  resumenClusters?: ResumenClusterInfo[];
}): Promise<PerfilCluster[]> {
  const perfilesBase = generarPerfilesDeNegocio({
    fichaTecnica,
    algoritmo,
    resumenClusters,
  });

  const prompt = `Actuá como un Consultor Senior de Inteligencia de Negocios y Ciencia de Datos.
El estudiante completó un modelo de clustering (${algoritmo.toUpperCase()}) para el siguiente problema:
"${fichaTecnica.problemaNegocio}"

Variables utilizadas: ${fichaTecnica.variables.map((v) => v.nombre).join(', ')}.

Perfiles iniciales calculados:
${JSON.stringify(perfilesBase, null, 2)}

Tu tarea pedagógica:
1. Refiná los nombres descriptivos para que suenen atractivos, profesionales y orientados a la toma de decisiones empresariales.
2. Detallá las características clave y redactá una acción de negocio clara y accionable.
3. Mantené intactos los 'clusterId' y los 'tamanoRelativoPct'.
4. Respondé estrictamente con un array JSON de objetos cumpliendo el esquema solicitado.`;

  try {
    const resultado = await consultarGeminiEstructurado({
      prompt,
      schema: z.array(PerfilClusterSchema),
      systemInstruction:
        'Sos un especialista en Business Intelligence y Machine Learning de la cátedra Paulo Freire. Producís perfiles accionables en JSON.',
    });
    return resultado;
  } catch {
    // Si falla o no hay conexión, devolvemos los perfiles determinísticos sin interrumpir al alumno
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
  const variableNumerica =
    fichaTecnica.variables.find(
      (v) =>
        (v.rol === 'feature' || v.rol === 'target') &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
    )?.nombre || 'Monto';

  const medidasDAX: MedidaDAX[] = [
    {
      nombre: `Total_${variableNumerica}`,
      formula: `Total_${variableNumerica} = SUM(Ventas[${variableNumerica}])`,
      descripcion: `Calcula el acumulado global de la métrica principal ${variableNumerica}.`,
    },
    {
      nombre: `Promedio_${variableNumerica}`,
      formula: `Promedio_${variableNumerica} = AVERAGE(Ventas[${variableNumerica}])`,
      descripcion: `Mide el valor medio por transacción o registro analítico.`,
    },
    {
      nombre: 'Participacion_Cluster_Pct',
      formula: `Participacion_Cluster_Pct = 
DIVIDE(
    CALCULATE(COUNTROWS(Ventas)),
    CALCULATE(COUNTROWS(Ventas), ALL(Ventas[Cluster])),
    0
)`,
      descripcion: 'Calcula el porcentaje de registros que pertenecen a cada segmento sobre el total.',
    },
    {
      nombre: `Facturacion_Segmento_Lider`,
      formula: `Facturacion_Segmento_Lider = 
CALCULATE(
    SUM(Ventas[${variableNumerica}]),
    Ventas[Cluster] = "${perfiles[0]?.nombreDescriptivo || 'Cluster 0'}"
)`,
      descripcion: `Filtra dinámicamente la facturación del segmento líder mediante CALCULATE.`,
    },
  ];

  return {
    modeloRecomendado:
      'Esquema en Estrella (Star Schema): Tabla de Hechos (Fact_Transacciones o Datos) vinculada 1 a N con la dimensión Dim_Segmentos.',
    pasosImportacion: [
      '1. Exportar el archivo dataset_ejemplo.csv con la columna agregada "cluster" desde la aplicación.',
      '2. Abrir Power BI Desktop > "Obtener datos" > "Texto/CSV" y cargar el archivo.',
      '3. En Power Query, transformar el tipo de datos de la columna "cluster" a Texto para habilitar la categorización.',
      '4. Crear una tabla de mapeo "Dim_Segmentos" que vincule el ID numérico del cluster con su Nombre Descriptivo.',
      '5. Crear una nueva medida en DAX con las fórmulas sugeridas.',
      '6. Insertar una matriz o gráfico de barras con Segmentos en el eje y las medidas calculadas en valores.',
    ],
    medidasDAX,
    kpisSugeridos: [
      'Ticket Medio por Segmento',
      'Margen de Contribución por Cluster',
      'Tasa de Concentración de Clientes VIP',
      'Volumen de Ruido / Observaciones Atípicas',
    ],
    visualizacionesRecomendadas: [
      'Gráfico de Dispersión (Scatter Plot) con segmentadores interactivos de fecha y región.',
      'Gráfico de Treemap para visualizar la participación porcentual de cada grupo.',
      'Tarjetas de KPI con variación porcentual frente al período anterior.',
      'Matriz jerárquica con desglose por segmento y categorías de producto.',
    ],
  };
}
