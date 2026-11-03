import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
} from '../schemas';
import { consultarGeminiTexto } from '../gemini';

export interface JupyterCell {
  cell_type: 'markdown' | 'code';
  metadata: Record<string, unknown>;
  source: string[];
  execution_count?: number | null;
  outputs?: unknown[];
}

export interface JupyterNotebook {
  nbformat: 4;
  nbformat_minor: 5;
  metadata: {
    kernelspec: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info: {
      name: string;
      version: string;
    };
  };
  cells: JupyterCell[];
}

export interface LineaExplicada {
  linea: number;
  codigo: string;
  explicacion: string;
  conceptoClave: string;
  categoria: 'import' | 'data' | 'scaling' | 'model' | 'metrics' | 'viz' | 'bi';
}

export interface SeccionExplicada {
  id: string;
  titulo: string;
  icono: string;
  lineas: LineaExplicada[];
  resumenPedagogico: string;
  preguntaSocratica: string;
}

export interface OpcionesPipeline {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
}

/**
 * Obtiene la lista de nombres de variables con rol 'feature'.
 * Si no hay features explícitas, toma todas las cuantitativas.
 */
function obtenerNombresFeatures(fichaTecnica: FichaTecnicaDS): string[] {
  const featuresCuantitativas = fichaTecnica.variables
    .filter(
      (v) =>
        v.rol === 'feature' &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
    )
    .map((v) => v.nombre);

  if (featuresCuantitativas.length >= 2) return featuresCuantitativas;

  // Fallback a todas las cuantitativas no identificadoras
  const cuantitativas = fichaTecnica.variables
    .filter(
      (v) =>
        v.rol !== 'identificador' &&
        (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta')
    )
    .map((v) => v.nombre);

  if (cuantitativas.length >= 2) return cuantitativas;

  const features = fichaTecnica.variables
    .filter((v) => v.rol === 'feature')
    .map((v) => v.nombre);

  return features.length >= 2
    ? features
    : fichaTecnica.variables.map((v) => v.nombre);
}

/**
 * Detecta qué tipo de escalador es el más apropiado según la ficha técnica.
 */
function determinarEscalador(fichaTecnica: FichaTecnicaDS): {
  clase: string;
  modulo: string;
  instancia: string;
} {
  const tieneRobust = fichaTecnica.variables.some((v) => v.escaladoRecomendado === 'robust_scaler');
  const tieneMinMax = fichaTecnica.variables.some((v) => v.escaladoRecomendado === 'min_max_scaler');

  if (tieneRobust) {
    return {
      clase: 'RobustScaler',
      modulo: 'sklearn.preprocessing',
      instancia: 'RobustScaler()',
    };
  }
  if (tieneMinMax) {
    return {
      clase: 'MinMaxScaler',
      modulo: 'sklearn.preprocessing',
      instancia: 'MinMaxScaler()',
    };
  }
  return {
    clase: 'StandardScaler',
    modulo: 'sklearn.preprocessing',
    instancia: 'StandardScaler()',
  };
}

/**
 * Genera un script completo en Python (.py) reproducible, limpio y modular.
 */
export function generarScriptPython({
  fichaTecnica,
  algoritmo,
  hiperparametros,
}: OpcionesPipeline): string {
  const features = obtenerNombresFeatures(fichaTecnica);
  const escalador = determinarEscalador(fichaTecnica);
  const featureListStr = features.map((f) => `'${f}'`).join(', ');

  const k = hiperparametros?.k ?? 3;
  const randomState = hiperparametros?.randomState ?? 42;
  const criterioEnlace = hiperparametros?.criterioEnlace ?? 'ward';
  const eps = hiperparametros?.eps ?? 0.5;
  const minSamples = hiperparametros?.minSamples ?? 5;

  let importsAlgoritmo = '';
  let instanciacionAlgoritmo = '';
  let bloqueMetricas = '';
  let bloqueVisualizacion = '';

  if (algoritmo === 'kmeans') {
    importsAlgoritmo = `from sklearn.cluster import KMeans`;
    instanciacionAlgoritmo = `# 4. Instanciación y Ajuste de K-Means
# random_state fijo para garantizar reproducibilidad en las asignaciones de centroides
kmeans = KMeans(
    n_clusters=${k},
    init='k-means++',
    n_init=10,
    random_state=${randomState}
)
labels = kmeans.fit_predict(X_scaled)
df['cluster'] = labels`;

    bloqueMetricas = `# 5. Evaluación Diagnóstica de la Calidad del Agrupamiento
# Inercia WCSS (suma de distancias al cuadrado al centroide más cercano)
inercia = kmeans.inertia_
# Coeficiente de Silueta medio (mide cohesión intra-cluster y separación inter-cluster en [-1, 1])
silueta = silhouette_score(X_scaled, labels)

print("\\n" + "=" * 55)
print("DIAGNÓSTICO CUANTITATIVO (K-MEANS)")
print("=" * 55)
print(f"• Número de clusters (K): {kmeans.n_clusters}")
print(f"• Inercia Intra-cluster (WCSS): {inercia:.2f}")
print(f"• Coeficiente de Silueta Promedio: {silueta:.4f}")
print("=" * 55)`;

    bloqueVisualizacion = `# 7. Visualización de los Agrupamientos y Centroides
plt.figure(figsize=(9, 6))
scatter = plt.scatter(
    X.iloc[:, 0],
    X.iloc[:, 1],
    c=labels,
    cmap='viridis',
    s=55,
    alpha=0.75,
    edgecolors='k',
    linewidth=0.5
)

# Centroides desescalados a la magnitud original para visualización
centroides_desescalados = scaler.inverse_transform(kmeans.cluster_centers_)
plt.scatter(
    centroides_desescalados[:, 0],
    centroides_desescalados[:, 1],
    c='red',
    marker='X',
    s=220,
    edgecolors='white',
    linewidth=1.8,
    label='Centroides (K-Means)'
)

plt.title(f"Segmentación K-Means (K={k}) — Coef. Silueta: {silueta:.2f}", fontsize=13, fontweight='bold')
plt.xlabel(features[0], fontsize=11)
plt.ylabel(features[1] if len(features) > 1 else features[0], fontsize=11)
plt.grid(True, linestyle='--', alpha=0.4)
plt.colorbar(scatter, label='Cluster asignado')
plt.legend(loc='best')
plt.tight_layout()
plt.savefig('grafico_clusters.png', dpi=300)
print("\\n✓ Gráfico guardado exitosamente como 'grafico_clusters.png'")
plt.show()`;
  } else if (algoritmo === 'jerarquico') {
    importsAlgoritmo = `from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import dendrogram, linkage`;
    instanciacionAlgoritmo = `# 4. Instanciación y Ajuste de Clustering Jerárquico Aglomerativo
# Criterio de enlace '${criterioEnlace}' para determinar proximidad entre subclusters
jerarquico = AgglomerativeClustering(
    n_clusters=${k},
    linkage='${criterioEnlace}'
)
labels = jerarquico.fit_predict(X_scaled)
df['cluster'] = labels`;

    bloqueMetricas = `# 5. Evaluación Diagnóstica de la Calidad del Agrupamiento
# Coeficiente de Silueta medio
silueta = silhouette_score(X_scaled, labels)

print("\\n" + "=" * 55)
print("DIAGNÓSTICO CUANTITATIVO (CLUSTERING JERÁRQUICO)")
print("=" * 55)
print(f"• Número de clusters (K): {k}")
print(f"• Criterio de Enlace: {criterioEnlace}")
print(f"• Coeficiente de Silueta Promedio: {silueta:.4f}")
print("=" * 55)`;

    bloqueVisualizacion = `# 7. Visualización: Dendrograma y Dispersión
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))

# Subgráfico 1: Dendrograma jerárquico
matriz_enlace = linkage(X_scaled, method='${criterioEnlace}')
dendrogram(
    matriz_enlace,
    truncate_mode='lastp',
    p=12,
    leaf_rotation=45.,
    leaf_font_size=10.,
    show_contracted=True,
    ax=ax1
)
ax1.set_title(f"Dendrograma Aglomerativo ({criterioEnlace.capitalize()})", fontsize=12, fontweight='bold')
ax1.set_xlabel("Índice de muestra o tamaño de cluster")
ax1.set_ylabel("Distancia de enlace euclidiana")
ax1.grid(True, linestyle='--', alpha=0.3)

# Subgráfico 2: Dispersión 2D de clusters resultantes
scatter = ax2.scatter(
    X.iloc[:, 0],
    X.iloc[:, 1],
    c=labels,
    cmap='plasma',
    s=55,
    alpha=0.75,
    edgecolors='k',
    linewidth=0.5
)
ax2.set_title(f"Asignación de Clusters (K={k})", fontsize=12, fontweight='bold')
ax2.set_xlabel(features[0])
ax2.set_ylabel(features[1] if len(features) > 1 else features[0])
ax2.grid(True, linestyle='--', alpha=0.3)
fig.colorbar(scatter, ax=ax2, label='Cluster asignado')

plt.tight_layout()
plt.savefig('grafico_clusters.png', dpi=300)
print("\\n✓ Gráfico guardado exitosamente como 'grafico_clusters.png'")
plt.show()`;
  } else {
    // DBSCAN
    importsAlgoritmo = `from sklearn.cluster import DBSCAN`;
    instanciacionAlgoritmo = `# 4. Instanciación y Ajuste de DBSCAN (Basado en Densidad)
# eps: radio máximo de vecindad | min_samples: umbral mínimo de puntos densos
dbscan = DBSCAN(
    eps=${eps},
    min_samples=${minSamples}
)
labels = dbscan.fit_predict(X_scaled)
df['cluster'] = labels`;

    bloqueMetricas = `# 5. Evaluación Diagnóstica de Densidad y Ruido
n_clusters_ = len(set(labels)) - (1 if -1 in labels else 0)
n_ruido_ = list(labels).count(-1)
pct_ruido_ = (n_ruido_ / len(labels)) * 100

print("\\n" + "=" * 55)
print("DIAGNÓSTICO CUANTITATIVO (DBSCAN)")
print("=" * 55)
print(f"• Clusters densos identificados: {n_clusters_}")
print(f"• Puntos clasificados como ruido (-1): {n_ruido_} ({pct_ruido_:.1f}%)")

if n_clusters_ > 1:
    # Se calcula la silueta únicamente sobre los puntos densos (excluyendo el ruido)
    mask_densos = labels != -1
    silueta = silhouette_score(X_scaled[mask_densos], labels[mask_densos])
    print(f"• Coeficiente de Silueta (excluyendo ruido): {silueta:.4f}")
else:
    silueta = 0.0
    print("• Advertencia: DBSCAN no encontró al menos 2 clusters densos. Ajustar 'eps' o 'min_samples'.")
print("=" * 55)`;

    bloqueVisualizacion = `# 7. Visualización de Clusters Densos y Ruido Aislado
plt.figure(figsize=(9, 6))

# Puntos normales con mapa de color
mask_densos = labels != -1
if mask_densos.any():
    scatter = plt.scatter(
        X.loc[mask_densos, features[0]],
        X.loc[mask_densos, features[1] if len(features) > 1 else features[0]],
        c=labels[mask_densos],
        cmap='Spectral',
        s=60,
        alpha=0.8,
        edgecolors='k',
        linewidth=0.5,
        label='Puntos en Clusters'
    )
    plt.colorbar(scatter, label='Cluster asignado')

# Ruido graficado en gris con cruz
mask_ruido = labels == -1
if mask_ruido.any():
    plt.scatter(
        X.loc[mask_ruido, features[0]],
        X.loc[mask_ruido, features[1] if len(features) > 1 else features[0]],
        c='#94a3b8',
        marker='x',
        s=45,
        alpha=0.65,
        label=f'Ruido / Outliers ({n_ruido_} pts)'
    )

plt.title(f"DBSCAN (eps={eps}, min_samples={minSamples}) — {n_clusters_} clusters detectados", fontsize=13, fontweight='bold')
plt.xlabel(features[0], fontsize=11)
plt.ylabel(features[1] if len(features) > 1 else features[0], fontsize=11)
plt.grid(True, linestyle='--', alpha=0.4)
plt.legend(loc='best')
plt.tight_layout()
plt.savefig('grafico_clusters.png', dpi=300)
print("\\n✓ Gráfico guardado exitosamente como 'grafico_clusters.png'")
plt.show()`;
  }

  return `# ==============================================================================
# PIPELINE DE MACHINE LEARNING: ${fichaTecnica.problemaNegocio}
# Cátedra: Centro Educativo Paulo Freire — U.E.G.P. N° 165
# Paradigma: No Supervisado | Tarea: Clustering
# Algoritmo: ${algoritmo.toUpperCase()}
# ==============================================================================

# 1. Importación de Librerías Estándar de Ciencia de Datos
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from ${escalador.modulo} import ${escalador.clase}
${importsAlgoritmo}
from sklearn.metrics import silhouette_score

# 2. Carga del Dataset y Selección de Variables Explicativas (X)
# En aprendizaje no supervisado no existe variable objetivo (Y) etiquetada
df = pd.read_csv('dataset_ejemplo.csv')
features = [${featureListStr}]
X = df[features]

print(f"Dimensiones del conjunto X: {X.shape[0]} muestras x {X.shape[1]} variables")
print(X.head(3))

# 3. Preprocesamiento: Escalado de Características
# Es indispensable normalizar para evitar que variables con escalas grandes
# distorsionen el cálculo de distancias euclidianas.
scaler = ${escalador.instancia}
X_scaled = scaler.fit_transform(X)

${instanciacionAlgoritmo}

${bloqueMetricas}

# 6. Perfilado de Clusters para Toma de Decisiones y Business Intelligence (BI)
# Agrupamos por la etiqueta asignada y calculamos la media de cada feature
perfil_clusters = df.groupby('cluster')[features].mean().round(2)
tamano_clusters = df['cluster'].value_counts().rename('conteo_muestras')
resumen_bi = pd.concat([tamano_clusters, perfil_clusters], axis=1)

print("\\n" + "=" * 55)
print("PERFILES DE CLUSTER PARA BUSINESS INTELLIGENCE (BI)")
print("=" * 55)
print(resumen_bi)
print("=" * 55)

${bloqueVisualizacion}
`;
}

/**
 * Convierte un bloque de código o texto a un array de líneas que terminan en '\n'.
 */
function aLineasJupyter(texto: string): string[] {
  const lineas = texto.split('\n');
  return lineas.map((linea, idx) => (idx === lineas.length - 1 ? linea : `${linea}\n`));
}

/**
 * Genera la estructura nativa de un Jupyter Notebook v4 (.ipynb) con celdas de Markdown y Código.
 */
export function generarNotebookJupyter(opciones: OpcionesPipeline): JupyterNotebook {
  const { fichaTecnica, algoritmo, hiperparametros } = opciones;
  const features = obtenerNombresFeatures(fichaTecnica);
  const escalador = determinarEscalador(fichaTecnica);
  const featureListStr = features.map((f) => `'${f}'`).join(', ');

  const k = hiperparametros?.k ?? 3;
  const randomState = hiperparametros?.randomState ?? 42;
  const criterioEnlace = hiperparametros?.criterioEnlace ?? 'ward';
  const eps = hiperparametros?.eps ?? 0.5;
  const minSamples = hiperparametros?.minSamples ?? 5;

  const cells: JupyterCell[] = [];

  // Celda 1: Markdown — Título, Ficha Técnica y Planteo de Negocio
  const mdTitulo = `# Proyecto de Ciencia de Datos: Agrupamiento con ${algoritmo.toUpperCase()}
**Cátedra:** Centro Educativo Paulo Freire — U.E.G.P. N° 165  
**Problema de Negocio:** ${fichaTecnica.problemaNegocio}

---

### Ficha Técnica de Machine Learning
- **Paradigma:** ${fichaTecnica.paradigma} (No Supervisado)
- **Tarea:** ${fichaTecnica.tarea}
- **Variables Explicativas ($X$):** \`${features.join('`, `')}\`
- **Variable Objetivo ($Y$):** No aplica en Clustering (descubrimiento de patrones no etiquetados)
- **Escalador recomendado:** \`${escalador.clase}\`
- **Algoritmo seleccionado:** \`${algoritmo.toUpperCase()}\`

> **Nota metodológica:** En este notebook se desarrolla el flujo completo de la ciencia de datos: desde la preparación y escalado de datos cuantitativos hasta la evaluación diagnóstica (Inercia / Silueta) y el perfilado accionable para Business Intelligence (BI).`;

  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdTitulo),
  });

  // Celda 2: Código — Importaciones
  let codigoImports = `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from ${escalador.modulo} import ${escalador.clase}
`;
  if (algoritmo === 'kmeans') {
    codigoImports += `from sklearn.cluster import KMeans\nfrom sklearn.metrics import silhouette_score\n`;
  } else if (algoritmo === 'jerarquico') {
    codigoImports += `from sklearn.cluster import AgglomerativeClustering\nfrom scipy.cluster.hierarchy import dendrogram, linkage\nfrom sklearn.metrics import silhouette_score\n`;
  } else {
    codigoImports += `from sklearn.cluster import DBSCAN\nfrom sklearn.metrics import silhouette_score\n`;
  }

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoImports),
  });

  // Celda 3: Markdown — Carga y separación de X
  const mdDatos = `## 1. Carga del Dataset y Selección de Variables Predictoras ($X$)
Leemos los datos y seleccionamos las columnas cuantitativas que definen el espacio vectorial de agrupamiento.`;

  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdDatos),
  });

  // Celda 4: Código — Carga de datos
  const codigoDatos = `# Carga del dataset generado o provisto
df = pd.read_csv('dataset_ejemplo.csv')
features = [${featureListStr}]
X = df[features]

print(f"Dimensiones de X: {X.shape}")
X.head()`;

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoDatos),
  });

  // Celda 5: Markdown — Preprocesamiento y Escalado
  const mdEscalado = `## 2. Preprocesamiento: Escalado de Características (\`${escalador.clase}\`)
Los algoritmos basados en distancias (como K-Means o Jerárquico con distancia euclidiana) son extremadamente sensibles a las escalas. Una variable con rango $10.000 - 5.000.000$ dominaría por completo a una variable de rango $1 - 100$.
Aplicamos el escalado estándar para que cada feature tenga media 0 y varianza unitaria:
$$z = \\frac{x - \\mu}{\\sigma}$$`;

  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdEscalado),
  });

  // Celda 6: Código — Escalado
  const codigoEscalado = `scaler = ${escalador.instancia}
X_scaled = scaler.fit_transform(X)

print("Media tras escalado (aprox 0):", np.round(X_scaled.mean(axis=0), 3))
print("Desvío estándar tras escalado (aprox 1):", np.round(X_scaled.std(axis=0), 3))`;

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoEscalado),
  });

  // Celda 7: Markdown — Modelado
  let mdModelado = '';
  let codigoModelado = '';

  if (algoritmo === 'kmeans') {
    mdModelado = `## 3. Ajuste de K-Means ($K=${k}$)
Instanciamos el estimador con \`random_state=${randomState}\` para asegurar reproducibilidad.
El método \`fit_predict\` calcula los centroides y retorna las etiquetas de pertenencia para cada muestra.`;
    codigoModelado = `kmeans = KMeans(
    n_clusters=${k},
    init='k-means++',
    n_init=10,
    random_state=${randomState}
)
labels = kmeans.fit_predict(X_scaled)
df['cluster'] = labels

print(f"Clusters asignados: {np.unique(labels)}")`;
  } else if (algoritmo === 'jerarquico') {
    mdModelado = `## 3. Ajuste de Clustering Jerárquico Aglomerativo
Utilizamos el criterio de enlace \`${criterioEnlace}\` con $K=${k}$ grupos.
Este enfoque construye un árbol jerárquico fusionando iterativamente los pares de clusters más cercanos.`;
    codigoModelado = `jerarquico = AgglomerativeClustering(
    n_clusters=${k},
    linkage='${criterioEnlace}'
)
labels = jerarquico.fit_predict(X_scaled)
df['cluster'] = labels

print(f"Clusters asignados: {np.unique(labels)}")`;
  } else {
    mdModelado = `## 3. Ajuste de DBSCAN (Clustering Basado en Densidad)
Configuramos radio de vecindad \`eps=${eps}\` y umbral \`min_samples=${minSamples}\`.
DBSCAN agrupa áreas de alta densidad y etiqueta automáticamente los puntos de ruido con \`-1\`.`;
    codigoModelado = `dbscan = DBSCAN(
    eps=${eps},
    min_samples=${minSamples}
)
labels = dbscan.fit_predict(X_scaled)
df['cluster'] = labels

print(f"Etiquetas únicas (incluye -1 para ruido): {np.unique(labels)}")`;
  }

  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdModelado),
  });

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoModelado),
  });

  // Celda 9: Markdown — Diagnóstico y Métricas
  const mdMetricas = `## 4. Diagnóstico de Calidad y Métricas
Evaluamos la cohesión y separación con el **Coeficiente de Silueta** ($s \\in [-1, 1]$):
- Valores cercanos a $+1$ indican asignaciones compactas y bien diferenciadas.
- Valores cercanos a $0$ denotan fronteras difusas entre clusters.
- Valores negativos sugieren muestras asignadas al cluster incorrecto.`;

  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdMetricas),
  });

  // Celda 10: Código — Métricas
  let codigoMetricas = '';
  if (algoritmo === 'kmeans') {
    codigoMetricas = `inercia = kmeans.inertia_
silueta = silhouette_score(X_scaled, labels)

print(f"Inercia WCSS: {inercia:.2f}")
print(f"Coeficiente de Silueta Promedio: {silueta:.4f}")`;
  } else if (algoritmo === 'jerarquico') {
    codigoMetricas = `silueta = silhouette_score(X_scaled, labels)
print(f"Coeficiente de Silueta Promedio: {silueta:.4f}")`;
  } else {
    codigoMetricas = `n_clusters_ = len(set(labels)) - (1 if -1 in labels else 0)
n_ruido_ = list(labels).count(-1)
pct_ruido_ = (n_ruido_ / len(labels)) * 100

print(f"Clusters identificados: {n_clusters_}")
print(f"Ruido detectado: {n_ruido_} muestras ({pct_ruido_:.1f}%)")

if n_clusters_ > 1:
    mask = labels != -1
    silueta = silhouette_score(X_scaled[mask], labels[mask])
    print(f"Coeficiente de Silueta (excluyendo ruido): {silueta:.4f}")`;
  }

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoMetricas),
  });

  // Celda 11: Markdown — Visualización
  const mdViz = `## 5. Visualización Gráfica de los Agrupamientos`;
  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdViz),
  });

  // Celda 12: Código — Visualización
  let codigoViz = '';
  if (algoritmo === 'kmeans') {
    codigoViz = `plt.figure(figsize=(8, 6))
scatter = plt.scatter(X.iloc[:, 0], X.iloc[:, 1], c=labels, cmap='viridis', edgecolors='k', alpha=0.7)
centroides = scaler.inverse_transform(kmeans.cluster_centers_)
plt.scatter(centroides[:, 0], centroides[:, 1], c='red', marker='X', s=200, label='Centroides')
plt.xlabel(features[0])
plt.ylabel(features[1] if len(features) > 1 else features[0])
plt.title(f"Clusters K-Means (K={k})")
plt.colorbar(scatter, label='Cluster')
plt.legend()
plt.show()`;
  } else if (algoritmo === 'jerarquico') {
    codigoViz = `fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
matriz = linkage(X_scaled, method='${criterioEnlace}')
dendrogram(matriz, truncate_mode='lastp', p=10, ax=ax1)
ax1.set_title("Dendrograma de Agrupamiento")

scatter = ax2.scatter(X.iloc[:, 0], X.iloc[:, 1], c=labels, cmap='plasma', edgecolors='k', alpha=0.7)
ax2.set_title(f"Dispersión 2D (K={k})")
ax2.set_xlabel(features[0])
ax2.set_ylabel(features[1] if len(features) > 1 else features[0])
fig.colorbar(scatter, ax=ax2, label='Cluster')
plt.tight_layout()
plt.show()`;
  } else {
    codigoViz = `plt.figure(figsize=(8, 6))
scatter = plt.scatter(X.iloc[:, 0], X.iloc[:, 1], c=labels, cmap='Spectral', edgecolors='k', alpha=0.7)
plt.title(f"DBSCAN (eps={eps}, min_samples={minSamples})")
plt.xlabel(features[0])
plt.ylabel(features[1] if len(features) > 1 else features[0])
plt.colorbar(scatter, label='Cluster (-1 = Ruido)')
plt.show()`;
  }

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoViz),
  });

  // Celda 13: Markdown — Perfilado BI
  const mdBI = `## 6. Perfilado de Clusters y Conexión con Business Intelligence (BI)
Traducimos los números y etiquetas en perfiles cualitativos para la toma de decisiones de negocio.
Estas medias por grupo se pueden exportar a un modelo de Power BI para crear tarjetas de KPIs y segmentación dinámica.`;

  cells.push({
    cell_type: 'markdown',
    metadata: {},
    source: aLineasJupyter(mdBI),
  });

  // Celda 14: Código — Perfilado
  const codigoBI = `perfiles = df.groupby('cluster')[features].mean().round(2)
conteo = df['cluster'].value_counts().rename('tamano_muestras')
resumen = pd.concat([conteo, perfiles], axis=1)
resumen`;

  cells.push({
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: aLineasJupyter(codigoBI),
  });

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3 (ipykernel)',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.10.12',
      },
    },
    cells,
  };
}

/**
 * Serializa el Jupyter Notebook a JSON string formateado.
 */
export function generarNotebookJson(opciones: OpcionesPipeline): string {
  const nb = generarNotebookJupyter(opciones);
  return JSON.stringify(nb, null, 2);
}

/**
 * Desglosa el script en bloques didácticos interactivos con explicaciones pedagógicas línea por línea.
 */
export function obtenerExplicacionLineas(
  algoritmo: AlgoritmoClustering,
  scriptPython: string
): SeccionExplicada[] {
  const lineasTotales = scriptPython.split('\n');

  const secciones: SeccionExplicada[] = [
    {
      id: 'importaciones',
      titulo: '1. Importaciones de Librerías',
      icono: '📦',
      lineas: [],
      resumenPedagogico:
        'Importamos las herramientas fundamentales del ecosistema Python: NumPy y Pandas para cálculo numérico y manipulación de datos tabulares, Scikit-Learn para modelos de Machine Learning y Matplotlib para visualización.',
      preguntaSocratica:
        '¿Por qué separamos las librerías de preprocesamiento (StandardScaler) de los estimadores de clustering?',
    },
    {
      id: 'datos_x',
      titulo: '2. Separación de Variables (X)',
      icono: '🎯',
      lineas: [],
      resumenPedagogico:
        'En problemas no supervisados no existe variable target (Y). Seleccionamos únicamente las variables explicativas (features) cuantitativas que configuran las dimensiones espaciales donde los puntos interactúan.',
      preguntaSocratica:
        'Si incluyéramos una variable identificatoria como ID_Cliente o DNI en X, ¿qué distorsión provocaría en el clustering?',
    },
    {
      id: 'escalado',
      titulo: '3. Escalado de Características',
      icono: '⚖️',
      lineas: [],
      resumenPedagogico:
        'El cálculo de distancia euclidiana entre dos puntos depende de las diferencias numéricas en cada eje. StandardScaler transforma cada atributo para tener media 0 y desviación típica 1, evitando que variables con valores enormes dominen el cálculo.',
      preguntaSocratica:
        '¿Por qué usamos fit_transform() en lugar de aplicar únicamente fit() o transform()?',
    },
    {
      id: 'modelo',
      titulo: `4. Ajuste del Modelo (${algoritmo.toUpperCase()})`,
      icono: '🤖',
      lineas: [],
      resumenPedagogico:
        algoritmo === 'kmeans'
          ? 'K-Means inicia posicionando centroides aleatorios y reasigna los puntos hasta converger en mínimos de inercia intra-cluster. Fijar random_state=42 asegura que el experimento sea exactamente reproducible.'
          : algoritmo === 'jerarquico'
            ? 'Clustering Jerárquico construye un árbol de fusiones sucesivas. El criterio de enlace (Ward, Complete, Average) determina cómo se mide la distancia entre dos subclusters.'
            : 'DBSCAN evalúa densidades locales con un radio eps y un mínimo de muestras. Aísla automáticamente puntos anómalos o de baja densidad asignándoles la etiqueta -1.',
      preguntaSocratica:
        algoritmo === 'kmeans'
          ? '¿Por qué fit_predict() retorna un vector de enteros y no probabilidades continuas?'
          : algoritmo === 'jerarquico'
            ? '¿Cuál es la diferencia entre el criterio de enlace Ward y el de Single Linkage?'
            : '¿Qué sucedería si aumentamos eps a un valor excesivamente grande en DBSCAN?',
    },
    {
      id: 'metricas',
      titulo: '5. Evaluación Diagnóstica',
      icono: '📏',
      lineas: [],
      resumenPedagogico:
        'El Coeficiente de Silueta compara qué tan cerca está una muestra de su propio cluster (cohesión) frente a su distancia al cluster vecino más cercano (separación). Varía entre -1 y +1.',
      preguntaSocratica:
        '¿Por qué una inercia WCSS de cero no significa necesariamente un modelo excelente?',
    },
    {
      id: 'perfilado_bi',
      titulo: '6. Perfilado para Business Intelligence',
      icono: '💼',
      lineas: [],
      resumenPedagogico:
        'El objetivo de la ciencia de datos en la empresa no es dejar una columna de números, sino traducir cada etiqueta en un segmento accionable con nombre, características clave y medidas de negocio para tableros de control.',
      preguntaSocratica:
        '¿Cómo vincularías esta tabla resultante con un modelo dimensional (estrella) en Power BI?',
    },
    {
      id: 'visualizacion',
      titulo: '7. Visualización Gráfica',
      icono: '📊',
      lineas: [],
      resumenPedagogico:
        'Graficamos el espacio bidimensional de las variables principales coloreando por cluster y destacando centroides o ruido, para comunicar visualmente los patrones descubiertos a los stakeholders.',
      preguntaSocratica:
        'Si tuviéramos 8 variables en lugar de 2, ¿qué técnica de reducción de dimensionalidad deberíamos aplicar para graficar en 2D?',
    },
  ];

  lineasTotales.forEach((texto, idx) => {
    const numLinea = idx + 1;
    const trim = texto.trim();
    if (!trim || trim.startsWith('# =')) return;

    let secId = 'modelo';
    let concepto = 'Ajuste del estimador de clustering';
    let explicacion = 'Línea de código de ejecución analítica.';

    if (trim.startsWith('import ') || trim.startsWith('from ')) {
      secId = 'importaciones';
      concepto = 'Importación de dependencias';
      explicacion =
        'Carga de módulos de Python necesarios para la manipulación matricial, modelos o gráficos.';
    } else if (
      trim.includes('pd.read_csv') ||
      trim.includes('features =') ||
      trim.includes('X = df[') ||
      trim.includes('X.shape')
    ) {
      secId = 'datos_x';
      concepto = 'Selección del espacio vectorial';
      explicacion =
        'Extracción de las variables analíticas que conformarán las coordenadas multidimensionales de cada registro.';
    } else if (
      trim.includes('scaler =') ||
      trim.includes('StandardScaler') ||
      trim.includes('MinMaxScaler') ||
      trim.includes('fit_transform(X)')
    ) {
      secId = 'escalado';
      concepto = 'Estandarización y normalización';
      explicacion =
        'Ajusta la escala de las variables para que ninguna distorsione las distancias euclidianas debido a su orden de magnitud.';
    } else if (
      trim.includes('KMeans(') ||
      trim.includes('AgglomerativeClustering(') ||
      trim.includes('DBSCAN(') ||
      trim.includes('fit_predict(') ||
      trim.includes("df['cluster'] =")
    ) {
      secId = 'modelo';
      concepto = 'Entrenamiento y partición de datos';
      explicacion =
        'Instanciación del algoritmo de clustering con sus hiperparámetros seleccionados y cálculo de etiquetas.';
    } else if (
      trim.includes('silhouette_score') ||
      trim.includes('.inertia_') ||
      trim.includes('DIAGNÓSTICO') ||
      trim.includes('Inercia Intra-cluster') ||
      trim.includes('Coeficiente de Silueta') ||
      trim.includes('n_ruido_') ||
      trim.includes('pct_ruido_')
    ) {
      secId = 'metricas';
      concepto = 'Métricas cuantitativas de agrupamiento';
      explicacion =
        'Cuantifica matemáticamente la cohesión y separación de los grupos para verificar la validez técnica del modelo.';
    } else if (
      trim.includes('groupby') ||
      trim.includes('perfil_clusters') ||
      trim.includes('resumen_bi') ||
      trim.includes('PERFILES DE CLUSTER')
    ) {
      secId = 'perfilado_bi';
      concepto = 'Agregación y perfiles de negocio';
      explicacion =
        'Calcula el centro de gravedad y la frecuencia de cada cluster para construir perfiles interpretables en BI.';
    } else if (
      trim.includes('plt.') ||
      trim.includes('scatter') ||
      trim.includes('dendrogram') ||
      trim.includes('fig,') ||
      trim.includes('savefig')
    ) {
      secId = 'visualizacion';
      concepto = 'Gráfica explicativa 2D';
      explicacion =
        'Renderiza la proyección espacial de los datos y exporta la figura resultante a disco.';
    }

    const seccion = secciones.find((s) => s.id === secId);
    if (seccion) {
      seccion.lineas.push({
        linea: numLinea,
        codigo: texto,
        conceptoClave: concepto,
        explicacion,
        categoria:
          secId === 'importaciones'
            ? 'import'
            : secId === 'datos_x'
              ? 'data'
              : secId === 'escalado'
                ? 'scaling'
                : secId === 'modelo'
                  ? 'model'
                  : secId === 'metricas'
                    ? 'metrics'
                    : secId === 'perfilado_bi'
                      ? 'bi'
                      : 'viz',
      });
    }
  });

  return secciones;
}

/**
 * Consulta al tutor socrático (IA o fallback determinístico) sobre una línea o duda del pipeline.
 */
export async function consultarTutorSobreCodigo({
  codigo,
  consulta,
  algoritmo,
}: {
  codigo: string;
  consulta: string;
  algoritmo: AlgoritmoClustering;
}): Promise<string> {
  const prompt = `Actuá como un Tutor Socrático de Ciencia de Datos y Machine Learning.
El estudiante está revisando este fragmento de código de pipeline en Python (${algoritmo.toUpperCase()} con scikit-learn):

\`\`\`python
${codigo.trim()}
\`\`\`

Pregunta del estudiante:
"${consulta}"

Instrucciones pedagógicas:
1. Respondé en tono amigable, claro y didáctico (orientado a principiantes de ciencia de datos).
2. Explicá qué hace el código, cuál es el fundamento matemático o estadístico detrás (ej. distancias euclidianas, dispersión, centroides, densidad).
3. Conectá la respuesta con la toma de decisiones y buenas prácticas en la industria (reproducibilidad, escalado, negocio).
4. Cerrá con una breve pregunta socrática de reflexión que estimule al estudiante a pensar.`;

  try {
    const respuesta = await consultarGeminiTexto({
      prompt,
      systemInstruction:
        'Sos el tutor pedagógico de Ciencia de Datos de la cátedra Centro Educativo Paulo Freire (U.E.G.P. N° 165). Explicás código scikit-learn de forma clara y socrática.',
    });
    return respuesta;
  } catch {
    // Fallback pedagógico determinístico si no hay conexión o no hay API key activa
    return `💡 **Explicación del Tutor Pedagógico:**
En este fragmento de código estamos interactuando con las funciones centrales de \`scikit-learn\` para el algoritmo **${algoritmo.toUpperCase()}**.
- **Aspecto clave:** Cada llamada asegura reproducibilidad y rigor metodológico (como la separación entre el escalado con \`StandardScaler\` y el método de ajuste \`fit_predict\`).
- **Impacto práctico:** En un entorno real de Ciencia de Datos, este bloque garantiza que las distancias matemáticas reflejen patrones auténticos en lugar de estar distorsionadas por unidades o escalas dispares.

*Pregunta para reflexionar:* ¿Qué ventajas tiene utilizar un estimador estructurado como el de \`scikit-learn\` frente a programar el algoritmo desde cero en Python puro?`;
  }
}
