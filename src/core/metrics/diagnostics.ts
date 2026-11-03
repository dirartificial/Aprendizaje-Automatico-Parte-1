export interface PuntoCodoSilueta {
  k: number;
  inercia: number;
  silhouette: number;
}

export interface DiagnosticoKMeans {
  puntos: PuntoCodoSilueta[];
  kOptimo: number;
  explicacion: string;
}

export interface PuntoEspacialSimulado {
  id: number;
  x: number;
  y: number;
  tipo: 'core' | 'border' | 'noise';
  cluster: number;
}

export interface DiagnosticoDBSCAN {
  eps: number;
  minSamples: number;
  clustersEstimados: number;
  porcentajeRuido: number;
  silhouette: number;
  explicacion: string;
  puntosSimulados: PuntoEspacialSimulado[];
}

export interface RamaDendrograma {
  id: string;
  x1: number;
  x2: number;
  y: number;
  altura: number;
  hijos?: [string, string];
}

export interface DiagnosticoJerarquico {
  k: number;
  criterio: 'ward' | 'complete' | 'average' | 'single';
  silhouette: number;
  alturaCorte: number;
  explicacion: string;
  ramas: RamaDendrograma[];
}

/**
 * Genera el diagnóstico determinístico de la curva del codo (Inercia WCSS) y coeficiente de silueta para K-Means.
 * Garantiza propiedades matemáticas: WCSS monótonamente decreciente y Silueta en [-1, 1].
 */
export function generarDiagnosticoKMeans(nVariables: number = 3): DiagnosticoKMeans {
  const escalaBase = Math.max(1, nVariables) * 450;

  // Factores matemáticos de inercia y silueta calibrados según teoría pedagógica (Codo nítido en K=3)
  const coeficientesCodo: { k: number; factorInercia: number; silueta: number }[] = [
    { k: 2, factorInercia: 2.85, silueta: 0.52 },
    { k: 3, factorInercia: 1.45, silueta: 0.68 }, // Codo óptimo
    { k: 4, factorInercia: 1.05, silueta: 0.59 },
    { k: 5, factorInercia: 0.84, silueta: 0.48 },
    { k: 6, factorInercia: 0.71, silueta: 0.41 },
    { k: 7, factorInercia: 0.62, silueta: 0.35 },
    { k: 8, factorInercia: 0.55, silueta: 0.31 },
    { k: 9, factorInercia: 0.49, silueta: 0.27 },
    { k: 10, factorInercia: 0.44, silueta: 0.24 },
  ];

  const puntos: PuntoCodoSilueta[] = coeficientesCodo.map((c) => ({
    k: c.k,
    inercia: Math.round(c.factorInercia * escalaBase * 10) / 10,
    silhouette: Math.round(c.silueta * 100) / 100,
  }));

  return {
    puntos,
    kOptimo: 3,
    explicacion:
      'El Método del Codo muestra un punto de inflexión marcado en K=3 (donde la pendiente de reducción de WCSS disminuye abruptamente). A su vez, el Coeficiente de Silueta alcanza su valor máximo relativo (0.68 > 0.50), confirmando una estructura de grupos con alta cohesión interna y marcada separación inter-cluster.',
  };
}

/**
 * Calcula el diagnóstico pedagógico para DBSCAN según eps y min_samples.
 */
export function generarDiagnosticoDBSCAN(
  eps: number = 0.5,
  minSamples: number = 5
): DiagnosticoDBSCAN {
  const epsVal = Math.max(0.1, Math.min(2.0, eps));
  const minS = Math.max(2, Math.min(10, Math.round(minSamples)));

  let clustersEstimados = 2;
  let porcentajeRuido = 3.5;
  let silhouette = 0.66;
  let explicacion = '';

  if (epsVal < 0.25) {
    // Radio demasiado pequeño: mucho ruido, clusters fragmentados
    clustersEstimados = minS > 5 ? 1 : 4;
    porcentajeRuido = Math.round((70 - epsVal * 120) * 10) / 10;
    silhouette = 0.22;
    explicacion =
      'El radio eps es excesivamente restrictivo (< 0.25). La mayoría de los puntos quedan aislados como ruido (-1) y los clusters válidos se fragmentan artificialmente.';
  } else if (epsVal > 1.1) {
    // Radio demasiado grande: fusiona todo en 1 solo cluster gigante
    clustersEstimados = 1;
    porcentajeRuido = 0.5;
    silhouette = 0.18;
    explicacion =
      'El radio eps es demasiado amplio (> 1.1). La vecindad conecta puntos lejanos y fusiona todas las geometrías en un único macro-cluster, perdiendo la capacidad de discriminación.';
  } else {
    // Rango óptimo (0.3 a 0.8)
    clustersEstimados = 2;
    porcentajeRuido = Math.round((5.0 + (minS - 5) * 1.2 - (epsVal - 0.5) * 3) * 10) / 10;
    porcentajeRuido = Math.max(1.0, Math.min(12.0, porcentajeRuido));
    silhouette = Math.round((0.68 - Math.abs(epsVal - 0.5) * 0.15) * 100) / 100;
    explicacion = `Con eps=${epsVal.toFixed(2)} y min_samples=${minS}, DBSCAN separa con nitidez 2 densidades principales y aísla un ${porcentajeRuido}% de lecturas extremas como ruido (-1), alcanzando una silueta de ${silhouette}.`;
  }

  // Generamos puntos 2D representativos simulados para la visualización de densidades
  const puntosSimulados: PuntoEspacialSimulado[] = [];
  // Luna 1
  for (let i = 0; i < 20; i++) {
    const angulo = (i / 19) * Math.PI;
    const r = 100 + (Math.sin(i * 3) * 8);
    puntosSimulados.push({
      id: i,
      x: Math.round(200 + r * Math.cos(angulo)),
      y: Math.round(180 - r * Math.sin(angulo)),
      tipo: epsVal < 0.25 && i % 3 === 0 ? 'noise' : 'core',
      cluster: epsVal > 1.1 ? 0 : 0,
    });
  }
  // Luna 2
  for (let i = 0; i < 20; i++) {
    const angulo = (i / 19) * Math.PI;
    const r = 100 + (Math.cos(i * 2) * 8);
    puntosSimulados.push({
      id: 20 + i,
      x: Math.round(270 + r * Math.cos(angulo)),
      y: Math.round(220 + r * Math.sin(angulo)),
      tipo: epsVal < 0.25 && i % 3 === 0 ? 'noise' : 'core',
      cluster: epsVal > 1.1 ? 0 : 1,
    });
  }
  // Puntos de ruido atípicos
  puntosSimulados.push(
    { id: 40, x: 80, y: 70, tipo: 'noise', cluster: -1 },
    { id: 41, x: 390, y: 90, tipo: 'noise', cluster: -1 },
    { id: 42, x: 360, y: 310, tipo: 'noise', cluster: -1 }
  );

  return {
    eps: epsVal,
    minSamples: minS,
    clustersEstimados,
    porcentajeRuido,
    silhouette,
    explicacion,
    puntosSimulados,
  };
}

/**
 * Genera el diagnóstico y estructura de dendrograma para Clustering Jerárquico.
 */
export function generarDiagnosticoJerarquico(
  criterio: 'ward' | 'complete' | 'average' | 'single' = 'ward',
  k: number = 3
): DiagnosticoJerarquico {
  const kVal = Math.max(2, Math.min(8, Math.round(k)));

  const siluetasPorCriterio: Record<string, number> = {
    ward: 0.64,
    complete: 0.58,
    average: 0.54,
    single: 0.38, // Efecto encadenamiento (chaining)
  };

  const silueta = Math.round((siluetasPorCriterio[criterio] - Math.abs(kVal - 3) * 0.05) * 100) / 100;

  const explicaciones: Record<string, string> = {
    ward: 'El enlace Ward minimiza el incremento en la varianza total intra-cluster. Tiende a producir clusters compactos y de tamaños balanceados.',
    complete: 'El enlace Complete toma la distancia máxima entre elementos. Es robusto contra el encadenamiento pero sensible a outliers extremos.',
    average: 'El enlace Average promedia todas las distancias entre pares. Ofrece un compromiso intermedio entre Ward y Single.',
    single: 'El enlace Single toma la distancia mínima. Es muy vulnerable al "efecto encadenamiento" (chaining), donde puntos intermedios conectan clusters distantes.',
  };

  // Ramas de dendrograma simuladas
  const ramas: RamaDendrograma[] = [
    { id: 'r1', x1: 60, x2: 120, y: 80, altura: 25 },
    { id: 'r2', x1: 180, x2: 240, y: 95, altura: 40 },
    { id: 'r3', x1: 90, x2: 210, y: 150, altura: 85 },
    { id: 'r4', x1: 300, x2: 380, y: 110, altura: 50 },
    { id: 'r5', x1: 150, x2: 340, y: 220, altura: 140 },
  ];

  const alturaCorte = Math.round(240 - kVal * 28);

  return {
    k: kVal,
    criterio,
    silhouette: silueta,
    alturaCorte,
    explicacion: `${explicaciones[criterio]} Al cortar el dendrograma a una altura de ${alturaCorte}, se obtienen ${kVal} familias taxonómicas bien diferenciadas.`,
    ramas,
  };
}
