import { consultarGeminiEstructurado, consultarGeminiTexto } from './gemini';
import {
  AclaracionDS,
  AclaracionDSSchema,
  AlgoritmoClustering,
  FichaTecnicaDS,
  FichaTecnicaSchema,
  VariableDS,
} from './schemas';
import { PRESETS_CASOS_DS } from './presetsDS';

export interface InteraccionAclaratoria {
  pregunta: string;
  respuesta: string;
}

const SYSTEM_INSTRUCTION_CLARIDAD = `
Sos un Tutor Socrático de Ciencia de Datos y Machine Learning (Centro Educativo Paulo Freire).
Tu rol es evaluar si el problema de negocio planteado por el estudiante tiene la especificidad suficiente para diseñar una Ficha Técnica de Machine Learning (variables cuantitativas/cualitativas, objetivo claro, datos disponibles) o si requiere preguntas aclaratorias.

Reglas:
- Si el enunciado es vago, abstracto o muy breve (ej: "quiero vender más", "tengo datos de clientes", "hacer clustering"), 'suficiente' debe ser false y formular entre 2 y 4 preguntas socráticas concretas sobre variables y objetivos.
- Si el problema describe un desafío concreto con variables potenciales o el estudiante ya respondió preguntas aclaratorias, 'suficiente' debe ser true y 'preguntas' debe ser un array vacío [].
- Supuestos a confirmar: enumerar 2 o 3 supuestos pedagógicos concretos sobre los datos del problema planteado.

DEBÉS responder ÚNICAMENTE con un objeto JSON válido que respete exactamente esta estructura y nombres de propiedades:
{
  "suficiente": boolean,
  "preguntas": ["string"],
  "supuestosAConfirmar": ["string"]
}
`;

const SYSTEM_INSTRUCTION_FICHA = `
Sos un Tutor Socrático de Ciencia de Datos y Machine Learning (Centro Educativo Paulo Freire).
A partir del problema de negocio y las aclaraciones del estudiante, generá la Ficha Técnica de Machine Learning formal, adaptada específicamente al dominio y las variables mencionadas por el estudiante.

Reglas estrictas del contrato JSON:
1. "problemaNegocio": string con el resumen claro del problema planteado por el estudiante (mínimo 10 caracteres).
2. "paradigma": DEBE ser exactamente uno de: "no_supervisado" | "supervisado" | "refuerzo" | "bi_descriptivo".
   - Usá "no_supervisado" si se busca descubrir agrupamientos o segmentos sin etiquetas previas (Clustering).
3. "tarea": DEBE ser exactamente uno de: "clustering" | "clasificacion" | "regresion" | "dashboard_kpis".
4. "justificacionParadigma": string explicando por qué corresponde ese paradigma y tarea para este caso concreto (mínimo 15 caracteres).
5. "variables": array de al menos 3 objetos (1 identificador y al menos 2 o 3 variables cuantitativas "feature" directamente relacionadas con el problema del estudiante). Cada variable DEBE tener exactamente:
   - "nombre": string en snake_case (ej: "consumo_mensual_kwh", "edad_paciente", "frecuencia_compra")
   - "tipo": exactamente uno de: "numerica_continua" | "numerica_discreta" | "categorica_nominal" | "categorica_ordinal" | "fecha_hora" | "texto_libre"
   - "descripcion": string describiendo qué mide y en qué unidad
   - "rol": exactamente uno de: "feature" | "target" | "identificador"
   - "escaladoRecomendado": exactamente uno de: "ninguno" | "standard_scaler" | "min_max_scaler" | "robust_scaler" (usar "standard_scaler" para variables numéricas con rol "feature", y "ninguno" para "identificador")
   - "justificacion": string explicando el aporte de la variable al modelo
6. "restricciones": array de strings con 2 o 3 reglas de calidad de datos específicas del problema.

Devolvé ÚNICAMENTE el objeto JSON sin bloques markdown adicionales.
`;

/**
 * Fallback heurístico local para evaluar claridad cuando la IA está offline o en tests.
 */
function evaluarClaridadHeuristica(
  problema: string,
  respuestasPrevias: InteraccionAclaratoria[] = []
): AclaracionDS {
  const textoLimpio = problema.trim().toLowerCase();
  const cantRespuestas = respuestasPrevias.filter((r) => r.respuesta.trim().length > 0).length;

  // Si ya respondió 2 o más preguntas aclaratorias, consideramos que hay claridad suficiente
  if (cantRespuestas >= 2) {
    return {
      suficiente: true,
      preguntas: [],
      supuestosAConfirmar: [
        'Se cuenta con datos consolidados a nivel unidad de análisis',
        'Las respuestas del estudiante delimitan las variables prioritarias del estudio',
      ],
    };
  }

  // Detectar casos breves o vagos
  const esVago =
    textoLimpio.length < 35 ||
    textoLimpio === 'quiero vender más' ||
    textoLimpio === 'mejorar ventas' ||
    textoLimpio === 'datos de clientes' ||
    textoLimpio === 'hacer ml' ||
    textoLimpio === 'clustering de clientes';

  if (esVago && cantRespuestas === 0) {
    return {
      suficiente: false,
      preguntas: [
        '¿Qué variables o atributos específicos tenés registrados de cada caso o cliente (ej: frecuencia de compra, ticket promedio, recencia)?',
        '¿Disponés de etiquetas previas de categorías o buscás que el algoritmo descubra los grupos de forma no supervisada?',
        '¿Cuál es la acción de negocio concreta que se tomará con los grupos identificados?',
      ],
      supuestosAConfirmar: [
        'Se asume que los datos están disponibles a nivel registro individual',
      ],
    };
  }

  // Si coincide con alguno de los presets, es suficiente
  const presetMatch = PRESETS_CASOS_DS.find((p) =>
    problema.toLowerCase().includes(p.titulo.toLowerCase().slice(0, 15))
  );
  if (presetMatch) {
    return {
      suficiente: true,
      preguntas: [],
      supuestosAConfirmar: [
        'Los datos representan transacciones consolidadas sin identificadores personales sensibles',
        'El volumen de datos es adecuado para el algoritmo seleccionado',
      ],
    };
  }

  // Si el texto es moderadamente descriptivo
  if (textoLimpio.length >= 60) {
    return {
      suficiente: true,
      preguntas: [],
      supuestosAConfirmar: [
        'Las variables explicativas son accesibles en el dataset de partida',
        'Se requerirá estandarización de escala para el cálculo de distancias euclidianas',
      ],
    };
  }

  return {
    suficiente: false,
    preguntas: [
      '¿Qué mediciones o características numéricas describen a cada elemento?',
      '¿El objetivo es predecir un valor futuro específico o segmentar sin etiquetas previas?',
    ],
    supuestosAConfirmar: ['El problema requiere mayor detalle de las métricas disponibles'],
  };
}

/**
 * Extrae variables contextuales del texto del estudiante cuando se usa el fallback sin conexión
 * y el problema no es uno de los 4 presets curriculares.
 */
function inferirVariablesDesdeTexto(textoCompleto: string): VariableDS[] {
  const t = textoCompleto.toLowerCase();

  if (t.includes('salud') || t.includes('paciente') || t.includes('hospital') || t.includes('clínic')) {
    return [
      {
        nombre: 'id_paciente',
        tipo: 'categorica_nominal',
        descripcion: 'Código anonimizado de historia clínica',
        rol: 'identificador',
        escaladoRecomendado: 'ninguno',
        justificacion: 'Identificador único; se excluye del cálculo de distancias.',
      },
      {
        nombre: 'edad_anios',
        tipo: 'numerica_discreta',
        descripcion: 'Edad biológica del paciente en años',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Factor demográfico clave para estratificación de riesgo.',
      },
      {
        nombre: 'indice_glucemia_mg_dl',
        tipo: 'numerica_continua',
        descripcion: 'Nivel medio de glucosa en sangre (mg/dL)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Indicador metabólico continuo que requiere estandarización Z-Score.',
      },
      {
        nombre: 'frecuencia_consultas_anual',
        tipo: 'numerica_discreta',
        descripcion: 'Cantidad de visitas médicas en los últimos 12 meses',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Mide el nivel de demanda asistencial del paciente.',
      },
    ];
  }

  if (t.includes('alumno') || t.includes('estudiant') || t.includes('educaci') || t.includes('curso') || t.includes('escuela')) {
    return [
      {
        nombre: 'id_estudiante',
        tipo: 'categorica_nominal',
        descripcion: 'Legajo anonimizado del estudiante',
        rol: 'identificador',
        escaladoRecomendado: 'ninguno',
        justificacion: 'Identificador administrativo sin valor geométrico.',
      },
      {
        nombre: 'porcentaje_asistencia',
        tipo: 'numerica_continua',
        descripcion: 'Porcentaje de asistencia a clases (0 a 100%)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Refleja la regularidad y compromiso presencial.',
      },
      {
        nombre: 'promedio_calificaciones',
        tipo: 'numerica_continua',
        descripcion: 'Promedio general de evaluaciones (escala 1 a 10)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Mide el desempeño académico cuantitativo.',
      },
      {
        nombre: 'horas_plataforma_semanal',
        tipo: 'numerica_continua',
        descripcion: 'Horas semanales de estudio en el campus virtual',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Captura la dedicación práctica fuera del aula.',
      },
    ];
  }

  if (t.includes('energ') || t.includes('consumo') || t.includes('kwh') || t.includes('eléctric')) {
    return [
      {
        nombre: 'id_medidor',
        tipo: 'categorica_nominal',
        descripcion: 'Identificador único del medidor inteligente',
        rol: 'identificador',
        escaladoRecomendado: 'ninguno',
        justificacion: 'Clave primaria del suministro; no participa en distancias.',
      },
      {
        nombre: 'consumo_mensual_kwh',
        tipo: 'numerica_continua',
        descripcion: 'Energía activa consumida en el mes (kWh)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Magnitud de volumen energético; requiere escalado por su amplio rango.',
      },
      {
        nombre: 'demanda_pico_kw',
        tipo: 'numerica_continua',
        descripcion: 'Potencia máxima demandada en horario punta (kW)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Diferencia perfiles residenciales de industriales.',
      },
      {
        nombre: 'factor_potencia',
        tipo: 'numerica_continua',
        descripcion: 'Índice de eficiencia eléctrica (0.50 a 1.00)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Permite detectar cargas inductivas o penalizaciones.',
      },
    ];
  }

  if (t.includes('finanz') || t.includes('banco') || t.includes('crédito') || t.includes('riesgo') || t.includes('préstamo')) {
    return [
      {
        nombre: 'id_cuenta',
        tipo: 'categorica_nominal',
        descripcion: 'Identificador de cuenta bancaria',
        rol: 'identificador',
        escaladoRecomendado: 'ninguno',
        justificacion: 'Clave técnica que no debe incluirse como feature.',
      },
      {
        nombre: 'ingreso_mensual_declarado',
        tipo: 'numerica_continua',
        descripcion: 'Nivel de ingresos mensuales en moneda local',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Determina la capacidad de pago; escala de miles/millones.',
      },
      {
        nombre: 'ratio_endeudamiento_pct',
        tipo: 'numerica_continua',
        descripcion: 'Porcentaje del ingreso comprometido en deudas (0-100%)',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Métrica clave de exposición financiera.',
      },
      {
        nombre: 'antiguedad_crediticia_meses',
        tipo: 'numerica_discreta',
        descripcion: 'Meses de historial activo en el sistema financiero',
        rol: 'feature',
        escaladoRecomendado: 'standard_scaler',
        justificacion: 'Aporta madurez del comportamiento crediticio.',
      },
    ];
  }

  // Fallback general adaptable
  return PRESETS_CASOS_DS[0].fichaTecnicaInicial.variables;
}

/**
 * Fallback heurístico local para generar una Ficha Técnica cuando la IA está offline o en tests.
 */
function generarFichaTecnicaHeuristica(
  problema: string,
  respuestasPrevias: InteraccionAclaratoria[] = []
): FichaTecnicaDS {
  const textoCompleto = `${problema} ${respuestasPrevias.map((r) => r.respuesta).join(' ')}`.toLowerCase();

  // Caso BI / Dashboard
  if (
    textoCompleto.includes('dashboard') ||
    textoCompleto.includes('kpi') ||
    textoCompleto.includes('power bi') ||
    textoCompleto.includes('facturación histórica')
  ) {
    const presetBI = PRESETS_CASOS_DS.find((p) => p.id === 'bi-dashboard-ventas-kpis');
    if (presetBI) return { ...presetBI.fichaTecnicaInicial, problemaNegocio: problema };
  }

  // Caso DBSCAN / Anomalías / Lunas
  if (
    textoCompleto.includes('dbscan') ||
    textoCompleto.includes('densidad') ||
    textoCompleto.includes('luna') ||
    textoCompleto.includes('sensor') ||
    textoCompleto.includes('anomalía') ||
    textoCompleto.includes('ruido')
  ) {
    const presetDBSCAN = PRESETS_CASOS_DS.find((p) => p.id === 'sensores-anomalias-dbscan');
    if (presetDBSCAN) return { ...presetDBSCAN.fichaTecnicaInicial, problemaNegocio: problema };
  }

  // Caso Jerárquico / Dendrograma
  if (
    textoCompleto.includes('jerárquico') ||
    textoCompleto.includes('jerarquico') ||
    textoCompleto.includes('dendrograma') ||
    textoCompleto.includes('taxonomía') ||
    textoCompleto.includes('catálogo')
  ) {
    const presetJer = PRESETS_CASOS_DS.find((p) => p.id === 'jerarquico-taxonomia-productos');
    if (presetJer) return { ...presetJer.fichaTecnicaInicial, problemaNegocio: problema };
  }

  // Si es el preset de Retail o menciona tienda/clientes/compras
  if (
    textoCompleto.includes('tienda') ||
    textoCompleto.includes('indumentaria') ||
    textoCompleto.includes('retail') ||
    textoCompleto.includes('recencia') ||
    textoCompleto.includes('ticket')
  ) {
    const presetRetail = PRESETS_CASOS_DS[0];
    return {
      ...presetRetail.fichaTecnicaInicial,
      problemaNegocio: problema.length > 5 ? problema : presetRetail.fichaTecnicaInicial.problemaNegocio,
    };
  }

  // Para otros dominios personalizados cuando está offline
  const varsInferidas = inferirVariablesDesdeTexto(textoCompleto);
  return {
    problemaNegocio: problema.length > 5 ? problema : PRESETS_CASOS_DS[0].fichaTecnicaInicial.problemaNegocio,
    paradigma: 'no_supervisado',
    tarea: 'clustering',
    justificacionParadigma:
      'Se busca descubrir agrupamientos y patrones latentes en los registros sin contar con una etiqueta previa (Y), aplicando aprendizaje no supervisado.',
    variables: varsInferidas,
    restricciones: [
      'Estandarizar las variables numéricas con StandardScaler antes de medir distancias',
      'Excluir columnas identificadoras del entrenamiento del modelo',
    ],
  };
}

/**
 * Evalúa la claridad del problema planteado por el estudiante.
 * Utiliza LLM estructurado y cuenta con fallback determinístico transparente.
 */
export async function evaluarClaridadProblemaDS(
  problema: string,
  respuestasPrevias: InteraccionAclaratoria[] = []
): Promise<AclaracionDS> {
  const prompt = `
Problema planteado por el estudiante:
"${problema}"

${
  respuestasPrevias.length > 0
    ? `Respuestas a preguntas aclaratorias previas:\n${respuestasPrevias
        .map((r, i) => `${i + 1}. Pregunta: "${r.pregunta}" -> Respuesta: "${r.respuesta}"`)
        .join('\n')}`
    : 'No hay respuestas aclaratorias previas aún.'
}

Evaluá si la información es SUFICIENTE para armar la Ficha Técnica de Machine Learning o formulá preguntas socráticas orientadoras.
Respondé ÚNICAMENTE con un JSON válido con las claves exactas: "suficiente" (boolean), "preguntas" (string[]), "supuestosAConfirmar" (string[]).
`;

  try {
    return await consultarGeminiEstructurado<AclaracionDS>({
      prompt,
      schema: AclaracionDSSchema,
      systemInstruction: SYSTEM_INSTRUCTION_CLARIDAD,
    });
  } catch {
    return evaluarClaridadHeuristica(problema, respuestasPrevias);
  }
}

/**
 * Genera la Ficha Técnica formal de Machine Learning estructurada a partir del diálogo socrático.
 */
export async function generarFichaTecnicaDS(
  problema: string,
  respuestasPrevias: InteraccionAclaratoria[] = []
): Promise<FichaTecnicaDS> {
  const prompt = `
Problema del estudiante:
"${problema}"

${
  respuestasPrevias.length > 0
    ? `Respuestas a preguntas aclaratorias previas:\n${respuestasPrevias
        .map((r, i) => `${i + 1}. Pregunta: "${r.pregunta}" -> Respuesta: "${r.respuesta}"`)
        .join('\n')}`
    : 'Sin aclaraciones adicionales.'
}

Generá la Ficha Técnica de Machine Learning completa adaptada específicamente a este problema, definiendo las variables del dominio, tipos, roles y método de escalado recomendado.
Recordá usar exactamente las claves JSON: "problemaNegocio", "paradigma", "tarea", "justificacionParadigma", "variables" (array con "nombre", "tipo", "descripcion", "rol", "escaladoRecomendado", "justificacion") y "restricciones" (string[]).
`;

  try {
    const ficha = await consultarGeminiEstructurado<FichaTecnicaDS>({
      prompt,
      schema: FichaTecnicaSchema,
      systemInstruction: SYSTEM_INSTRUCTION_FICHA,
    });
    return ficha;
  } catch {
    return generarFichaTecnicaHeuristica(problema, respuestasPrevias);
  }
}

/**
 * Consulta al Tutor IA para brindar una recomendación o análisis pedagógico contextualizado
 * en los Pasos 3 (EDA), 4 (Algoritmo), 5 (Hiperparámetros) o 7 (Resultados WASM).
 */
export async function consultarTutorContextualDS({
  paso,
  fichaTecnica,
  algoritmo,
  detalleExtra,
}: {
  paso: 3 | 4 | 5 | 7;
  fichaTecnica: FichaTecnicaDS;
  algoritmo?: AlgoritmoClustering;
  detalleExtra?: string;
}): Promise<string> {
  const listaVars = fichaTecnica.variables
    .map((v) => `${v.nombre} (${v.tipo}, rol: ${v.rol}, escalado: ${v.escaladoRecomendado})`)
    .join('; ');

  const instruccionesPorPaso: Record<3 | 4 | 5 | 7, string> = {
    3: `Analizá brevemente (en 3 a 4 oraciones claras y didácticas) el esquema de preprocesamiento y EDA para este problema. Explicá por qué las variables cuantitativas seleccionadas necesitan escalado y qué estrategia de nulos conviene aplicar.`,
    4: `Analizá brevemente (en 3 a 4 oraciones) la elección del algoritmo ${algoritmo?.toUpperCase() || 'K-MEANS'} para este problema y estas variables. Mencioná los supuestos geométricos y redactá una justificación metodológica concreta para el estudiante.`,
    5: `Interpretá brevemente (en 3 a 4 oraciones) los hiperparámetros y métricas de diagnóstico (${detalleExtra || ''}) para el algoritmo ${algoritmo?.toUpperCase() || 'K-MEANS'} en el contexto de este problema de negocio.`,
    7: `Interpretá brevemente (en 3 a 4 oraciones) los resultados de ejecución del clustering (${detalleExtra || ''}) sobre las variables del problema, explicando qué significan los centroides o grupos hallados para el negocio.`,
  };

  const prompt = `Problema de negocio: "${fichaTecnica.problemaNegocio}"
Variables de la Ficha Técnica: ${listaVars}
${detalleExtra ? `Datos del paso actual: ${detalleExtra}` : ''}

Tarea pedagógica: ${instruccionesPorPaso[paso]}`;

  try {
    const texto = await consultarGeminiTexto({
      prompt,
      systemInstruction:
        'Sos un Tutor Socrático de Ciencia de Datos (Cátedra Paulo Freire). Respondé en español rioplatense, de forma concisa, rigurosa y directamente conectada con las variables del estudiante.',
    });
    if (texto && texto.length > 15) return texto;
  } catch {
    // Fallback determinístico contextualizado a las variables reales de la ficha
  }

  const cuantitativas = fichaTecnica.variables
    .filter((v) => v.rol === 'feature' && (v.tipo === 'numerica_continua' || v.tipo === 'numerica_discreta'))
    .map((v) => v.nombre);

  if (paso === 3) {
    return `Para el problema "${fichaTecnica.problemaNegocio}", las variables cuantitativas (${cuantitativas.join(', ') || 'definidas'}) presentan diferentes unidades de medida. Aplicar StandardScaler (Z-Score) es indispensable para que ninguna variable domine la distancia euclidiana por su magnitud nominal, mientras que la imputación por mediana protege los estadísticos ante posibles valores extremos.`;
  }
  if (paso === 4) {
    return `Para analizar [${cuantitativas.join(', ')}] en el marco de "${fichaTecnica.problemaNegocio}", el algoritmo ${algoritmo?.toUpperCase() || 'K-MEANS'} resulta adecuado si consideramos sus supuestos topológicos sobre las variables estandarizadas.`;
  }
  if (paso === 5) {
    return `En el diagnóstico sobre [${cuantitativas.join(', ')}], la configuración actual (${detalleExtra || algText(algoritmo)}) equilibra la cohesión interna de cada grupo con la separación inter-cluster, evitando tanto la sobre-segmentación como la pérdida de especificidad analítica.`;
  }
  return `La proyección sobre ${cuantitativas.slice(0, 2).join(' vs ')} confirma agrupamientos diferenciados (${detalleExtra || ''}). Las medias por cluster muestran diferencias claras en las magnitudes originales, listas para traducirse en decisiones de Business Intelligence.`;
}

function algText(algoritmo?: AlgoritmoClustering): string {
  return algoritmo ? algoritmo.toUpperCase() : 'K-MEANS';
}
