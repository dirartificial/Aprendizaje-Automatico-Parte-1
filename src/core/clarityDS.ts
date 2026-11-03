import { consultarGeminiEstructurado } from './gemini';
import {
  AclaracionDS,
  AclaracionDSSchema,
  FichaTecnicaDS,
  FichaTecnicaSchema,
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
- Si el problema describe un desafío concreto con variables potenciales o el estudiante ya respondió preguntas aclaratorias, 'suficiente' debe ser true.
- Supuestos a confirmar: enumerar supuestos pedagógicos (ej: "se asume que los datos están disponibles a nivel cliente").
`;

const SYSTEM_INSTRUCTION_FICHA = `
Sos un Tutor Socrático de Ciencia de Datos y Machine Learning (Centro Educativo Paulo Freire).
A partir del problema de negocio y las aclaraciones del estudiante, generá la Ficha Técnica de Machine Learning formal.

Reglas:
1. Paradigma:
   - 'no_supervisado' si se busca descubrir agrupamientos sin etiquetas previas (Clustering).
   - 'supervisado' si hay una variable objetivo Y histórica conocida a predecir.
   - 'bi_descriptivo' si se trata de dashboards, KPIs históricos o tableros de control en Power BI sin modelo predictivo.
2. Tarea: 'clustering', 'clasificacion', 'regresion' o 'dashboard_kpis'.
3. Justificación metodológica clara distinguiendo BI vs ML y el rol de las variables.
4. Variables: al menos 2 variables cuantitativas o explicativas. Definir tipo, rol ('feature', 'target' o 'identificador') y método de escalado recomendado ('standard_scaler' para clustering con K-Means y variables continuas).
5. En clustering, 'variableTarget' debe ser undefined o vacío.
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

  // Default: K-Means / Segmentación
  const presetRetail = PRESETS_CASOS_DS[0];
  return {
    ...presetRetail.fichaTecnicaInicial,
    problemaNegocio: problema.length > 5 ? problema : presetRetail.fichaTecnicaInicial.problemaNegocio,
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
`;

  try {
    return await consultarGeminiEstructurado<AclaracionDS>({
      prompt,
      schema: AclaracionDSSchema,
      systemInstruction: SYSTEM_INSTRUCTION_CLARIDAD,
    });
  } catch {
    // Si la llamada al LLM falla (o se ejecuta en tests/offline), aplicamos el fallback heurístico
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

Generá la Ficha Técnica de Machine Learning completa, definiendo las variables numéricas y categóricas, tipos, roles y método de escalado recomendado.
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
