import { FichaTecnicaDS } from './schemas';

export interface PresetCasoDS {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: string;
  claseReferencia: string;
  algoritmoRecomendado: 'kmeans' | 'dbscan' | 'jerarquico' | 'dashboard_kpis';
  problemaTexto: string;
  fichaTecnicaInicial: FichaTecnicaDS;
  preguntasAclaratoriasTipicas: string[];
}

export const PRESETS_CASOS_DS: readonly PresetCasoDS[] = [
  {
    id: 'retail-segmentacion-clientes',
    titulo: 'Segmentación de Clientes en E-commerce',
    subtitulo: 'K-Means • Frecuencia, Recencia y Ticket Promedio (RFM)',
    icono: '🛒',
    claseReferencia: 'Clases 13 y 14: Clustering no supervisado y algoritmo K-Means',
    algoritmoRecomendado: 'kmeans',
    problemaTexto:
      'Tenemos una tienda online de indumentaria y calzado. Queremos identificar grupos homogéneos de clientes en base a su comportamiento de compra histórico (frecuencia de compra anual, gasto promedio por compra y días transcurridos desde su última adquisición) para diseñar campañas de marketing personalizadas y programas de fidelización diferenciados.',
    fichaTecnicaInicial: {
      problemaNegocio:
        'Identificar grupos homogéneos de clientes según frecuencia de compra, gasto promedio y recencia para optimizar campañas de fidelización.',
      paradigma: 'no_supervisado',
      tarea: 'clustering',
      justificacionParadigma:
        'No disponemos de etiquetas previas de categorías de clientes; el objetivo es descubrir patrones y agrupamientos naturales a partir de su comportamiento numérico continuo.',
      variables: [
        {
          nombre: 'recencia_dias',
          tipo: 'numerica_continua',
          descripcion: 'Días transcurridos desde la última compra del cliente',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion:
            'Variable temporal de alta dispersión; el escalado estándar evita que distorsione el cálculo de distancias euclidianas.',
        },
        {
          nombre: 'frecuencia_anual',
          tipo: 'numerica_discreta',
          descripcion: 'Cantidad total de compras realizadas en los últimos 12 meses',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion:
            'Escala de orden menor (1 a 50) comparada con el gasto monetario; requiere estandarización.',
        },
        {
          nombre: 'monto_promedio_compra',
          tipo: 'numerica_continua',
          descripcion: 'Ticket monetario promedio en moneda local por pedido',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion:
            'Magnitudes en miles/millones; sin escalado dominaría absolutamente la distancia en K-Means.',
        },
        {
          nombre: 'id_cliente',
          tipo: 'categorica_nominal',
          descripcion: 'Identificador único del cliente',
          rol: 'identificador',
          escaladoRecomendado: 'ninguno',
          justificacion: 'Identificador sin valor predictivo para el cálculo de distancias.',
        },
      ],
      variableTarget: undefined,
      restricciones: [
        'Excluir id_cliente del cálculo de distancias',
        'Normalizar variables cuantitativas con StandardScaler',
        'Eliminar registros con ticket promedio negativo o nulo',
      ],
    },
    preguntasAclaratoriasTipicas: [
      '¿Disponés de etiquetas previas de clientes (ej. "VIP", "Ocasional") o buscás descubrirlas desde cero?',
      '¿Qué nivel de granularidad temporal manejás en el historial de transacciones?',
      '¿Existen clientes atípicos (mayoristas con compras millonarias) que deban separarse como outliers?',
    ],
  },
  {
    id: 'sensores-anomalias-dbscan',
    titulo: 'Detección de Formas No Lineales y Anomalías en Sensores',
    subtitulo: 'DBSCAN • Geometrías Arbitrarias (Lunas) y Aislamiento de Ruido',
    icono: '📡',
    claseReferencia: 'Clase 15: Algoritmos basados en densidad (DBSCAN) y formas complejas',
    algoritmoRecomendado: 'dbscan',
    problemaTexto:
      'En una planta industrial monitoreamos dos sensores de vibración y temperatura en turbinas de generación. El comportamiento normal genera trayectorias geométricas entrelazadas y con curvas no esféricas (tipo semilunas concéntricas), acompañadas de lecturas anómalas dispersas por picos eléctricos ocasionales. Necesitamos agrupar los regímenes operativos válidos y aislar automáticamente las anomalías.',
    fichaTecnicaInicial: {
      problemaNegocio:
        'Agrupar regímenes normales de operación en turbinas industriales con geometrías no convexas y aislar lecturas espurias de ruido como fallas potenciales.',
      paradigma: 'no_supervisado',
      tarea: 'clustering',
      justificacionParadigma:
        'Se desconoce la tipología exacta de anomalías y los clusters tienen topología curvada no lineal donde los métodos basados en centroides (K-Means) fallan rotundamente.',
      variables: [
        {
          nombre: 'frecuencia_vibracion_hz',
          tipo: 'numerica_continua',
          descripcion: 'Frecuencia angular de vibración medida en Hz',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion: 'Magnitud continua que define el primer eje de densidad espacial.',
        },
        {
          nombre: 'temperatura_sensor_c',
          tipo: 'numerica_continua',
          descripcion: 'Temperatura de rodamiento en grados Celsius',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion:
            'Requiere igualar la escala con la vibración para que el radio eps de DBSCAN sea isotrópico.',
        },
      ],
      variableTarget: undefined,
      restricciones: [
        'DBSCAN requiere calibrar eps y min_samples con gráfico k-distancias',
        'Etiquetar los puntos con cluster -1 como anomalías de mantenimiento crítico',
      ],
    },
    preguntasAclaratoriasTipicas: [
      '¿Los sensores transmiten mediciones calibradas o presentan desfasajes de escala?',
      '¿Cuántos puntos mínimos por vecindad considerás que justifican un régimen operativo estable?',
      '¿Qué porcentaje estimado de datos considerás ruido eléctrico tolerable?',
    ],
  },
  {
    id: 'jerarquico-taxonomia-productos',
    titulo: 'Agrupamiento Taxonómico de Productos de Catálogo',
    subtitulo: 'Clustering Jerárquico Aglomerativo • Dendrograma y Enlaces',
    icono: '🏷️',
    claseReferencia: 'Clase 15: Clustering Jerárquico y corte del dendrograma',
    algoritmoRecomendado: 'jerarquico',
    problemaTexto:
      'Una cadena de retail de artículos para el hogar tiene un catálogo de 250 productos y desea descubrir una jerarquía taxonómica natural de surtido a partir de sus dimensiones físicas (volumen en litros, peso en kg, margen de contribución porcentual y rotación de inventario). Queremos visualizar el dendrograma para decidir a qué nivel de corte agruparlos en familias y subfamilias.',
    fichaTecnicaInicial: {
      problemaNegocio:
        'Construir un árbol taxonómico (dendrograma) de productos para organizar familias y categorías logísticas según volumen, peso y rotación.',
      paradigma: 'no_supervisado',
      tarea: 'clustering',
      justificacionParadigma:
        'El negocio necesita explorar relaciones de anidamiento jerárquico a diferentes niveles de especificidad en lugar de una partición plana fija con un $K$ arbitrario.',
      variables: [
        {
          nombre: 'volumen_litros',
          tipo: 'numerica_continua',
          descripcion: 'Espacio cúbico que ocupa el producto embalado',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion:
            'Estandarización necesaria para equilibrar peso físico y volumen métrico.',
        },
        {
          nombre: 'peso_kg',
          tipo: 'numerica_continua',
          descripcion: 'Peso bruto del producto en kilogramos',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion:
            'Evita que productos pesados distorsionen la distancia aglomerativa.',
        },
        {
          nombre: 'rotacion_mensual',
          tipo: 'numerica_continua',
          descripcion: 'Vueltas de inventario promedio por mes',
          rol: 'feature',
          escaladoRecomendado: 'standard_scaler',
          justificacion: 'Aporta la dimensión de dinamismo comercial.',
        },
      ],
      variableTarget: undefined,
      restricciones: [
        'Volumen de catálogo moderado (<1000 ítems) para viabilidad de matriz de distancias O(N^2)',
        'Evaluar enlace Ward vs Average para compacidad de dendrograma',
      ],
    },
    preguntasAclaratoriasTipicas: [
      '¿Cuántos niveles de jerarquía comercial (familias, subfamilias) requiere el área de logística?',
      '¿Se prioriza la minimización de la varianza intra-cluster (método Ward) o la distancia media?',
    ],
  },
  {
    id: 'bi-dashboard-ventas-kpis',
    titulo: 'Análisis Histórico de Ventas y Facturación (BI vs AP)',
    subtitulo: 'Business Intelligence Descriptivo • Tablero de Control y KPIs en Power BI',
    icono: '📊',
    claseReferencia: 'Guía Conceptual: Inteligencia de Negocios vs Análisis Predictivo',
    algoritmoRecomendado: 'dashboard_kpis',
    problemaTexto:
      'La gerencia comercial solicita un tablero interactivo para consultar la evolución de ventas del último trimestre, desglosada por sucursal, vendedor y familia de productos, con KPIs de cumplimiento de meta y ticket promedio por canal. Quieren poder filtrar por fecha y ver gráficos de barras de los vendedores más exitosos.',
    fichaTecnicaInicial: {
      problemaNegocio:
        'Diseñar un panel ejecutivo de Inteligencia de Negocios para monitorear el desempeño histórico de ventas, ticket medio y cumplimiento de cuotas comerciales.',
      paradigma: 'bi_descriptivo',
      tarea: 'dashboard_kpis',
      justificacionParadigma:
        'El objetivo es responder "qué ocurrió" y monitorear KPIs históricos consolidados. No requiere un modelo de aprendizaje automático de clustering ni predicción de variables no observadas, sino un modelo analítico relacional (Estrella/Snowflake) para Power BI.',
      variables: [
        {
          nombre: 'fecha_venta',
          tipo: 'fecha_hora',
          descripcion: 'Fecha y hora de la transacción',
          rol: 'feature',
          escaladoRecomendado: 'ninguno',
          justificacion: 'Dimensión temporal para agregaciones (Año, Mes, Trimestre).',
        },
        {
          nombre: 'sucursal',
          tipo: 'categorica_nominal',
          descripcion: 'Nombre de la sucursal comercial',
          rol: 'feature',
          escaladoRecomendado: 'ninguno',
          justificacion: 'Dimensión geográfica de análisis.',
        },
        {
          nombre: 'monto_facturado',
          tipo: 'numerica_continua',
          descripcion: 'Importe total facturado sin impuestos',
          rol: 'feature',
          escaladoRecomendado: 'ninguno',
          justificacion: 'Métrica cuantitativa principal para sumatorias y promedios DAX.',
        },
      ],
      variableTarget: undefined,
      restricciones: [
        'Enfocar en modelado dimensional en Power Query / Power BI en lugar de estimadores de scikit-learn',
        'Definir medidas DAX explícitas para Total Facturación y Ticket Promedio',
      ],
    },
    preguntasAclaratoriasTipicas: [
      '¿Se busca un reporte descriptivo de lo ocurrido o proyectar ventas futuras?',
      '¿Qué granularidad temporal precisan los directivos para los filtros del reporte?',
    ],
  },
];
