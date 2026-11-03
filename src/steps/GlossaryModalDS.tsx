import { useState, useEffect, useMemo, useRef } from 'react';

export interface TerminoGlosario {
  id: string;
  termino: string;
  categoria: 'paradigmas' | 'algoritmos' | 'preprocesamiento' | 'metricas' | 'bi';
  categoriaNombre: string;
  definicion: string;
  ejemploContextual: string;
  formulaOClave?: string;
}

export const TERMINOS_GLOSARIO_DS: TerminoGlosario[] = [
  // Paradigmas y Conceptos Fundamentales
  {
    id: 'no_supervisado',
    termino: 'Aprendizaje No Supervisado (Unsupervised Learning)',
    categoria: 'paradigmas',
    categoriaNombre: 'Paradigmas y Fundamentos',
    definicion:
      'Paradigma del Machine Learning donde el algoritmo debe inferir patrones, agrupamientos o estructuras latentes a partir de un conjunto de datos sin etiquetas ni supervisión humana previa. No existe una variable objetivo (Y).',
    ejemploContextual:
      'Segmentación de clientes en base a su historial de compras para descubrir tribus de consumidores no evidentes a simple vista.',
  },
  {
    id: 'bi_vs_ds',
    termino: 'Business Intelligence (BI) vs. Data Science (ML)',
    categoria: 'paradigmas',
    categoriaNombre: 'Paradigmas y Fundamentos',
    definicion:
      'BI se enfoca en el análisis descriptivo y diagnóstico del pasado ("¿qué pasó y por qué?"), utilizando agregaciones, dashboards y KPIs. Data Science y Machine Learning van más allá: descubren patrones ocultos, proyectan agrupamientos y construyen modelos predictivos ("¿qué pasará o qué patrón latente existe?").',
    ejemploContextual:
      'BI muestra que las ventas cayeron 10% el mes pasado. Machine Learning agrupa a los clientes en riesgo de abandono para prevenirlos antes de que se vayan.',
  },
  {
    id: 'features_x',
    termino: 'Variables Explicativas / Atributos (Features X)',
    categoria: 'paradigmas',
    categoriaNombre: 'Paradigmas y Fundamentos',
    definicion:
      'Columnas cuantitativas o cualitativas que representan las características de cada observación. Configuran las coordenadas del espacio vectorial multidimensional en el que operan los algoritmos.',
    ejemploContextual:
      'En retail: Facturación anual, recencia en días, frecuencia de compra y ticket promedio.',
  },
  {
    id: 'target_y',
    termino: 'Variable Objetivo (Target Y)',
    categoria: 'paradigmas',
    categoriaNombre: 'Paradigmas y Fundamentos',
    definicion:
      'La variable dependiente que un modelo supervisado busca predecir (ej. si pagará o no un crédito). En tareas no supervisadas como el Clustering, NO existe variable objetivo etiquetada.',
    ejemploContextual:
      'En regresión: el precio de una vivienda. En clasificación: si un email es spam. En clustering: no aplica.',
  },

  // Algoritmos de Clustering
  {
    id: 'kmeans',
    termino: 'K-Means (K-Medias)',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'Algoritmo particional que divide N observaciones en K clusters mutuamente excluyentes. Cada muestra se asigna al cluster cuyo centroide (media matemática) se encuentra más próximo por distancia euclidiana.',
    ejemploContextual:
      'Muy eficiente para millones de registros, pero asume grupos aproximadamente esféricos de similar dispersión y es sensible a valores atípicos (outliers).',
    formulaOClave: 'sklearn.cluster.KMeans(n_clusters=K, random_state=42)',
  },
  {
    id: 'kmeans_plus_plus',
    termino: 'K-Means++ (Inicialización Inteligente)',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'Estrategia de inicialización de centroides que dispersa los puntos iniciales con probabilidades proporcionales al cuadrado de su distancia. Evita que los centroides arranquen apelotonados y acelera la convergencia a una solución óptima.',
    ejemploContextual:
      'Es el valor por defecto en scikit-learn (init="k-means++").',
  },
  {
    id: 'clustering_jerarquico',
    termino: 'Clustering Jerárquico Aglomerativo (Agglomerative Clustering)',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'Enfoque ascendente (bottom-up) que comienza considerando cada punto como un cluster individual y fusiona sucesivamente los pares de clusters más cercanos hasta formar un único árbol jerárquico.',
    ejemploContextual:
      'No requiere prefijar K al inicio: se visualiza el dendrograma y se corta horizontalmente a la altura deseada.',
    formulaOClave: 'sklearn.cluster.AgglomerativeClustering(linkage="ward")',
  },
  {
    id: 'dendrograma',
    termino: 'Dendrograma',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'Diagrama en árbol bidimensional que ilustra la secuencia jerárquica de fusiones entre clusters. La altura vertical de cada enlace representa la distancia a la cual se unieron los dos subgrupos.',
    ejemploContextual:
      'Un enlace largo y vertical indica una clara separación entre las ramas resultantes.',
  },
  {
    id: 'enlace_ward',
    termino: 'Criterio de Enlace Ward (Ward Linkage)',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'Método de enlace en clustering jerárquico que minimiza el incremento en la varianza total intra-cluster al unir dos grupos. Tiende a generar clusters equilibrados y compactos.',
    ejemploContextual:
      'Es el criterio más utilizado por su robustez matemática y similitud con la inercia de K-Means.',
  },
  {
    id: 'dbscan',
    termino: 'DBSCAN (Density-Based Spatial Clustering of Applications with Noise)',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'Algoritmo basado en densidad que localiza zonas de alta concentración de puntos separadas por áreas de baja densidad. Es capaz de descubrir agrupamientos de formas geométricas arbitrarias (anillos, lunas) y aísla anomalías como ruido (-1).',
    ejemploContextual:
      'Excelente para sensores con ruido o anomalías de vibración que no deben forzarse en ningún cluster.',
    formulaOClave: 'sklearn.cluster.DBSCAN(eps=0.5, min_samples=5)',
  },
  {
    id: 'eps_min_samples',
    termino: 'Hiperparámetros de DBSCAN (eps y min_samples)',
    categoria: 'algoritmos',
    categoriaNombre: 'Algoritmos de Clustering',
    definicion:
      'eps es el radio máximo de la vecindad alrededor de un punto. min_samples es el número mínimo de observaciones requeridas dentro de ese radio para que el punto sea considerado un "punto núcleo" (core point).',
    ejemploContextual:
      'Si eps es muy pequeño, casi todo el dataset se clasificará como ruido (-1). Si es muy grande, todo se fusionará en un único cluster.',
  },

  // Preprocesamiento y Escalado
  {
    id: 'standard_scaler',
    termino: 'Escalado Estándar (StandardScaler)',
    categoria: 'preprocesamiento',
    categoriaNombre: 'Preprocesamiento y Calidad',
    definicion:
      'Transformación lineal que estandariza cada variable restándole su media y dividiéndola por su desviación típica. Garantiza media cero y varianza unitaria.',
    ejemploContextual:
      'Indispensable en K-Means para evitar que una variable en millones distorsione la distancia euclidiana frente a una variable en unidades.',
    formulaOClave: 'z = (x - μ) / σ',
  },
  {
    id: 'distancia_euclidiana',
    termino: 'Distancia Euclidiana',
    categoria: 'preprocesamiento',
    categoriaNombre: 'Preprocesamiento y Calidad',
    definicion:
      'Métrica geométrica de longitud del segmento en línea recta entre dos puntos en un espacio euclidiano N-dimensional. Es la base del cálculo de proximidad en K-Means y Jerárquico.',
    formulaOClave: 'd(p, q) = √[ ∑ (p_i - q_i)² ]',
    ejemploContextual:
      'Calcula la distancia recta en el plano cartesiano entre dos clientes según sus coordenadas de consumo.',
  },
  {
    id: 'maldicion_dimensionalidad',
    termino: 'Maldición de la Dimensionalidad (Curse of Dimensionality)',
    categoria: 'preprocesamiento',
    categoriaNombre: 'Preprocesamiento y Calidad',
    definicion:
      'Fenómeno que ocurre al incrementar el número de variables (dimensiones): el volumen del espacio crece exponencialmente y todos los puntos tienden a quedar a distancias similares entre sí, degradando la efectividad de las distancias euclidianas.',
    ejemploContextual:
      'Por esta razón se recomienda seleccionar con cuidado entre 2 y 8 variables explicativas representativas o aplicar PCA previo.',
  },

  // Métricas y Diagnósticos
  {
    id: 'inercia_wcss',
    termino: 'Inercia Intra-Cluster (WCSS)',
    categoria: 'metricas',
    categoriaNombre: 'Diagnósticos y Métricas',
    definicion:
      'Within-Cluster Sum of Squares. Mide la compacidad interna de los clusters sumando las distancias euclidianas al cuadrado de cada punto a su centroide correspondiente. Disminuye monótonamente al aumentar K.',
    ejemploContextual:
      'Se grafica en función de K para identificar el "punto del codo".',
    formulaOClave: 'WCSS = ∑ ∑ || x_i - c_k ||²',
  },
  {
    id: 'metodo_codo',
    termino: 'Método del Codo (Elbow Method)',
    categoria: 'metricas',
    categoriaNombre: 'Diagnósticos y Métricas',
    definicion:
      'Técnica visual y heurística para seleccionar el número óptimo de clusters K. Se busca el punto de inflexión en la curva de inercia donde agregar un cluster adicional ya no genera una reducción drástica de WCSS.',
    ejemploContextual:
      'El punto donde la curva pasa de una caída pronunciada a un aplanamiento semejante a un codo de brazo.',
  },
  {
    id: 'coeficiente_silueta',
    termino: 'Coeficiente de Silueta (Silhouette Score)',
    categoria: 'metricas',
    categoriaNombre: 'Diagnósticos y Métricas',
    definicion:
      'Métrica de validación interna de clustering en el rango [-1, 1]. Compara qué tan cerca está un punto de su propio cluster (cohesión a) frente a su distancia al cluster vecino más cercano (separación b).',
    ejemploContextual:
      'Valores > 0.50 indican separación nítida; valores cercanos a 0.0 indican solapamiento; valores negativos denotan muestras mal asignadas.',
    formulaOClave: 's = (b - a) / max(a, b)',
  },

  // Business Intelligence y DAX
  {
    id: 'perfilado_clusters',
    termino: 'Perfilado de Clusters (Cluster Profiling)',
    categoria: 'bi',
    categoriaNombre: 'Business Intelligence & DAX',
    definicion:
      'Proceso de negocio que traduce etiquetas matemáticas abstractas (0, 1, 2) en descripciones cualitativas y comerciales comprensibles para directores y gerentes.',
    ejemploContextual:
      'Asignar nombres como "Clientes VIP de Máximo Valor" o "Compradores Ocasionales de Ofertas".',
  },
  {
    id: 'star_schema',
    termino: 'Modelo Dimensional en Estrella (Star Schema)',
    categoria: 'bi',
    categoriaNombre: 'Business Intelligence & DAX',
    definicion:
      'Estructura de base de datos analítica donde una tabla central de hechos (Fact_Ventas) con métricas numéricas se conecta en relaciones 1 a N con tablas maestras de dimensiones (Dim_Clientes, Dim_Segmentos).',
    ejemploContextual:
      'Permite vincular la etiqueta de cluster de Machine Learning con el historial de facturación en Power BI.',
  },
  {
    id: 'calculate_dax',
    termino: 'Función CALCULATE (DAX)',
    categoria: 'bi',
    categoriaNombre: 'Business Intelligence & DAX',
    definicion:
      'La función más potente del lenguaje DAX en Power BI. Evalúa una expresión en un contexto de filtro modificado.',
    ejemploContextual:
      'CALCULATE(SUM(Ventas[Monto]), Clientes[Cluster] = "Cluster VIP") calcula la facturación filtrando exclusivamente al grupo VIP.',
    formulaOClave: 'CALCULATE(<expresion>, <filtro1>, <filtro2>, ...)',
  },
];

export interface GlossaryModalDSProps {
  abierto: boolean;
  onCerrar: () => void;
}

export function GlossaryModalDS({ abierto, onCerrar }: GlossaryModalDSProps) {
  const [busqueda, setBusqueda] = useState<string>('');
  const [categoriaActiva, setCategoriaActiva] = useState<string>('todas');
  const modalRef = useRef<HTMLDivElement>(null);
  const inputBusquedaRef = useRef<HTMLInputElement>(null);

  // Atajo de teclado: Escape cierra el modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto) {
        onCerrar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abierto, onCerrar]);

  // Foco automático en el buscador al abrir
  useEffect(() => {
    if (abierto) {
      setTimeout(() => {
        inputBusquedaRef.current?.focus();
      }, 50);
    }
  }, [abierto]);

  const categorias = useMemo(
    () => [
      { id: 'todas', nombre: 'Todas las Categorías' },
      { id: 'paradigmas', nombre: 'Paradigmas y Fundamentos' },
      { id: 'algoritmos', nombre: 'Algoritmos de Clustering' },
      { id: 'preprocesamiento', nombre: 'Preprocesamiento y Escalado' },
      { id: 'metricas', nombre: 'Diagnósticos y Silueta' },
      { id: 'bi', nombre: 'Business Intelligence y DAX' },
    ],
    []
  );

  const terminosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return TERMINOS_GLOSARIO_DS.filter((item) => {
      const coincideCat =
        categoriaActiva === 'todas' || item.categoria === categoriaActiva;
      const coincideBusqueda =
        !q ||
        item.termino.toLowerCase().includes(q) ||
        item.definicion.toLowerCase().includes(q) ||
        item.ejemploContextual.toLowerCase().includes(q) ||
        (item.formulaOClave && item.formulaOClave.toLowerCase().includes(q));

      return coincideCat && coincideBusqueda;
    });
  }, [busqueda, categoriaActiva]);

  if (!abierto) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-modal-title"
      data-testid="glossary-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="modal-card glossary-modal-card" ref={modalRef}>
        {/* Cabecera del Modal */}
        <div className="modal-header">
          <div>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent-cyan)',
                letterSpacing: '0.05em',
              }}
            >
              Cátedra Paulo Freire — U.E.G.P. N° 165
            </span>
            <h2 id="glossary-modal-title" style={{ margin: '0.25rem 0 0', fontSize: '1.25rem' }}>
              📖 Glosario Conceptual de Ciencia de Datos & BI
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onCerrar}
            data-testid="close-glossary-btn"
            aria-label="Cerrar glosario conceptual"
          >
            ✕
          </button>
        </div>

        {/* Barra de Filtros y Buscador */}
        <div className="glossary-toolbar">
          <input
            ref={inputBusquedaRef}
            type="search"
            className="input input-block"
            placeholder="🔍 Buscar término, fórmula o concepto didáctico..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            data-testid="glossary-search-input"
            aria-label="Buscar términos del glosario"
          />

          <div
            style={{
              display: 'flex',
              gap: '0.4rem',
              overflowX: 'auto',
              paddingTop: '0.65rem',
              paddingBottom: '0.2rem',
            }}
          >
            {categorias.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`code-tab-btn ${categoriaActiva === cat.id ? 'active' : ''}`}
                style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap' }}
                onClick={() => setCategoriaActiva(cat.id)}
                data-testid={`glossary-cat-${cat.id}`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Términos */}
        <div
          style={{
            overflowY: 'auto',
            paddingRight: '0.5rem',
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
          data-testid="glossary-terms-list"
        >
          {terminosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>🔍</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                No se encontraron términos que coincidan con <strong>"{busqueda}"</strong>.
              </p>
            </div>
          ) : (
            terminosFiltrados.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '1rem 1.15rem',
                  background: 'var(--bg-card-elevated)',
                  border: '1px solid var(--border-color)',
                }}
                data-testid={`glossary-item-${item.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-main)', fontWeight: 700 }}>
                    {item.termino}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--accent-cyan)',
                      background: 'rgba(56, 189, 248, 0.12)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.categoriaNombre}
                  </span>
                </div>

                <p style={{ margin: '0.45rem 0 0', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                  {item.definicion}
                </p>

                {item.formulaOClave && (
                  <div style={{ marginTop: '0.45rem' }}>
                    <code style={{ fontSize: '0.78rem' }}>{item.formulaOClave}</code>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '0.55rem',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(99, 102, 241, 0.08)',
                    borderLeft: '3px solid var(--accent-indigo)',
                    borderRadius: '0 0.4rem 0.4rem 0',
                    fontSize: '0.8rem',
                    color: '#c7d2fe',
                  }}
                >
                  <strong>Ejemplo aplicado:</strong> {item.ejemploContextual}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie del Modal */}
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Mostrando {terminosFiltrados.length} de {TERMINOS_GLOSARIO_DS.length} conceptos
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onCerrar}
          >
            Cerrar Glosario
          </button>
        </div>
      </div>
    </div>
  );
}
