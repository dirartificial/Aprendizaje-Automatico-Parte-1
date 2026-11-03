import { AlgoritmoClustering, FichaTecnicaDS } from './schemas';

export type NivelAdvertencia = 'critica' | 'advertencia' | 'sugerencia';

export interface AccionSugeridaValidacion {
  tipo:
    | 'activar_escalado'
    | 'cambiar_algoritmo_dbscan'
    | 'cambiar_algoritmo_jerarquico'
    | 'agregar_variable'
    | 'reducir_variables';
  descripcion: string;
}

export interface AdvertenciaValidacionDS {
  id: string;
  regla:
    | 'escala_kmeans'
    | 'formas_no_convexas'
    | 'outliers_ruido'
    | 'features_insuficientes'
    | 'dimensionalidad_excesiva';
  nivel: NivelAdvertencia;
  titulo: string;
  mensaje: string;
  explicacionPedagogica: string;
  accionSugerida?: AccionSugeridaValidacion;
}

export interface OpcionesValidacionDS {
  hayOutliersReportados?: boolean;
  hayFormasNoConvexas?: boolean;
}

/**
 * Validador determinístico de Ciencia de Datos basado en las 5 reglas pedagógicas de cátedra.
 */
export function validarModeloDS(
  fichaTecnica: FichaTecnicaDS,
  algoritmoSeleccionado: AlgoritmoClustering = 'kmeans',
  opciones: OpcionesValidacionDS = {}
): AdvertenciaValidacionDS[] {
  const advertencias: AdvertenciaValidacionDS[] = [];

  const features = (fichaTecnica.variables || []).filter((v) => v.rol === 'feature');
  const featuresCuantitativas = features.filter(
    (v) => v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta'
  );

  const textoAnalisis = [
    fichaTecnica.problemaNegocio,
    fichaTecnica.justificacionParadigma,
    ...(fichaTecnica.restricciones || []),
    ...features.map((f) => `${f.nombre} ${f.descripcion} ${f.justificacion}`),
  ]
    .join(' ')
    .toLowerCase();

  // 1. Regla de Features Insuficientes (< 2 variables cuantitativas/explicativas)
  if (featuresCuantitativas.length < 2) {
    advertencias.push({
      id: 'adv-features-insuficientes',
      regla: 'features_insuficientes',
      nivel: 'critica',
      titulo: 'Variables Cuantitativas Insuficientes para Clustering',
      mensaje: `Actualmente hay ${featuresCuantitativas.length} variable(s) cuantitativa(s). Se requieren al menos 2 atributos numéricos.`,
      explicacionPedagogica:
        'El agrupamiento (Clustering) construye distancias en un espacio geométrico multidimensional. Con menos de 2 dimensiones numéricas no es posible analizar la dispersión espacial ni contrastar la separación entre grupos.',
      accionSugerida: {
        tipo: 'agregar_variable',
        descripcion: 'Agregar o configurar al menos 2 variables continuas o discretas con rol "feature".',
      },
    });
  }

  // 2. Regla de Dimensionalidad Excesiva (> 10 variables)
  if (features.length > 10) {
    advertencias.push({
      id: 'adv-dimensionalidad-excesiva',
      regla: 'dimensionalidad_excesiva',
      nivel: 'advertencia',
      titulo: 'Advertencia: Maldición de la Dimensionalidad (> 10 variables)',
      mensaje: `Definiste ${features.length} variables como features.`,
      explicacionPedagogica:
        'En espacios de alta dimensionalidad ("maldición de la dimensionalidad"), las distancias euclidianas entre pares de puntos tienden a volverse homogéneas, reduciendo drásticamente el contraste entre vecinos cercanos y lejanos. En K-Means o Jerárquico se recomienda seleccionar las variables críticas de negocio o aplicar reducción de dimensionalidad (PCA).',
      accionSugerida: {
        tipo: 'reducir_variables',
        descripcion: 'Priorizar las variables con mayor relevancia conceptual para el agrupamiento.',
      },
    });
  }

  // 3. Regla de Escala en K-Means (StandardScaler)
  if (algoritmoSeleccionado === 'kmeans' && featuresCuantitativas.length >= 2) {
    const sinEscalar = featuresCuantitativas.filter(
      (v) => v.escaladoRecomendado === 'ninguno'
    );

    if (sinEscalar.length > 0) {
      advertencias.push({
        id: 'adv-escala-kmeans',
        regla: 'escala_kmeans',
        nivel: 'critica',
        titulo: 'Distorsión de Escala en K-Means (Distancia Euclidiana)',
        mensaje: `Hay ${sinEscalar.length} variable(s) cuantitativa(s) sin escalado activado (${sinEscalar.map((v) => v.nombre).join(', ')}).`,
        explicacionPedagogica:
          'K-Means calcula distancias euclidianas. Si una variable tiene magnitudes grandes (ej. Facturación de $10.000 a $5.000.000) y otra magnitudes pequeñas (ej. Frecuencia de 1 a 20), la variable de mayor orden dominará absolutamente el cálculo y anulará el aporte de las demás. Es imperativo estandarizar con StandardScaler (Z-Score) para equiparar la media a 0 y varianza a 1.',
        accionSugerida: {
          tipo: 'activar_escalado',
          descripcion: 'Aplicar StandardScaler a todas las variables numéricas de entrada.',
        },
      });
    }
  }

  // 4. Regla de Formas No Convexas / No Lineales
  const patronesFormasNoConvexas = [
    'luna',
    'lunas',
    'anillo',
    'anillos',
    'no convex',
    'no lineal',
    'curva',
    'curvas',
    'espiral',
    'semiluna',
    'geometría arbitraria',
    'geometria arbitraria',
    'densidad espacial',
  ];
  const detectaFormasNoConvexas =
    opciones.hayFormasNoConvexas === true ||
    patronesFormasNoConvexas.some((pat) => textoAnalisis.includes(pat));

  if (detectaFormasNoConvexas && algoritmoSeleccionado === 'kmeans') {
    advertencias.push({
      id: 'adv-formas-no-convexas',
      regla: 'formas_no_convexas',
      nivel: 'critica',
      titulo: 'Incompatibilidad Geométrica: Supuesto de Esfericidad de K-Means',
      mensaje:
        'El planteo describe patrones con geometrías curvadas, semilunas o estructuras no convexas.',
      explicacionPedagogica:
        'K-Means particiona el espacio en regiones de Voronoi convexas (hiper-esféricas) alrededor de centroides promediados. Si los datos forman lunas entrelazadas o anillos concéntricos, K-Means partirá incorrectamente la figura por el medio. Se recomienda utilizar DBSCAN (basado en densidad local) o Clustering Jerárquico.',
      accionSugerida: {
        tipo: 'cambiar_algoritmo_dbscan',
        descripcion: 'Cambiar a DBSCAN para capturar geometrías de densidad arbitraria.',
      },
    });
  }

  // 5. Regla de Outliers y Ruido
  const patronesRuido = [
    'anomalia',
    'anomalía',
    'outlier',
    'outliers',
    'ruido',
    'pico electrico',
    'picos electricos',
    'lecturas espurias',
    'atipico',
    'atípico',
    'falla potencial',
  ];
  const detectaRuido =
    opciones.hayOutliersReportados === true ||
    patronesRuido.some((pat) => textoAnalisis.includes(pat));

  if (detectaRuido && algoritmoSeleccionado === 'kmeans') {
    advertencias.push({
      id: 'adv-outliers-ruido',
      regla: 'outliers_ruido',
      nivel: 'advertencia',
      titulo: 'Sensibilidad Crítica a Outliers en K-Means',
      mensaje:
        'Se menciona presencia de anomalías, ruido o lecturas atípicas en las observaciones.',
      explicacionPedagogica:
        'K-Means calcula centroides minimizando la suma de distancias al cuadrado (WCSS). Un solo punto extremo puede arrastrar un centroide a cientos de unidades del grupo real, degradando la cohesión del cluster. DBSCAN está diseñado específicamente para aislar ruido asignándoles la etiqueta -1.',
      accionSugerida: {
        tipo: 'cambiar_algoritmo_dbscan',
        descripcion: 'Evaluar DBSCAN para etiquetar y aislar automáticamente los outliers.',
      },
    });
  }

  return advertencias;
}

/**
 * Resuelve rápidamente una advertencia detectada, actualizando la ficha técnica o el algoritmo.
 */
export function resolverAdvertenciaPedagogica(
  fichaTecnica: FichaTecnicaDS,
  advertencia: AdvertenciaValidacionDS,
  algoritmoActual: AlgoritmoClustering
): { fichaActualizada: FichaTecnicaDS; nuevoAlgoritmo: AlgoritmoClustering } {
  const accion = advertencia.accionSugerida;
  if (!accion) {
    return { fichaActualizada: fichaTecnica, nuevoAlgoritmo: algoritmoActual };
  }

  if (accion.tipo === 'activar_escalado') {
    const varsActualizadas = fichaTecnica.variables.map((v) => {
      if (
        v.rol === 'feature' &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
      ) {
        return { ...v, escaladoRecomendado: 'standard_scaler' as const };
      }
      return v;
    });
    return {
      fichaActualizada: { ...fichaTecnica, variables: varsActualizadas },
      nuevoAlgoritmo: algoritmoActual,
    };
  }

  if (accion.tipo === 'cambiar_algoritmo_dbscan') {
    return {
      fichaActualizada: fichaTecnica,
      nuevoAlgoritmo: 'dbscan',
    };
  }

  if (accion.tipo === 'cambiar_algoritmo_jerarquico') {
    return {
      fichaActualizada: fichaTecnica,
      nuevoAlgoritmo: 'jerarquico',
    };
  }

  return { fichaActualizada: fichaTecnica, nuevoAlgoritmo: algoritmoActual };
}
