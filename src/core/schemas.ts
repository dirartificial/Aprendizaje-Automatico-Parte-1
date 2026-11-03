import { z } from 'zod';

/**
 * Tipos de datos para variables cuantitativas y cualitativas según el diseño de cátedra.
 */
export const TipoVariableSchema = z.enum([
  'numerica_continua',
  'numerica_discreta',
  'categorica_nominal',
  'categorica_ordinal',
  'fecha_hora',
  'texto_libre',
]);
export type TipoVariable = z.infer<typeof TipoVariableSchema>;

/**
 * Esquema de una variable individual (atributo / feature / target).
 */
export const VariableSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la variable no puede estar vacío'),
  tipo: TipoVariableSchema,
  descripcion: z.string(),
  rol: z.enum(['feature', 'target', 'identificador']),
  escaladoRecomendado: z.enum(['ninguno', 'standard_scaler', 'min_max_scaler', 'robust_scaler']),
  justificacion: z.string(),
});
export type VariableDS = z.infer<typeof VariableSchema>;

/**
 * Paradigmas del aprendizaje automático y BI.
 */
export const ParadigmaMLSchema = z.enum([
  'supervisado',
  'no_supervisado',
  'refuerzo',
  'bi_descriptivo',
]);
export type ParadigmaML = z.infer<typeof ParadigmaMLSchema>;

/**
 * Tipos de tareas analíticas y de modelado.
 */
export const TareaMLSchema = z.enum([
  'clustering',
  'clasificacion',
  'regresion',
  'dashboard_kpis',
]);
export type TareaML = z.infer<typeof TareaMLSchema>;

/**
 * Ficha Técnica de Machine Learning consensuada entre el tutor y el estudiante.
 */
export const FichaTecnicaSchema = z.object({
  problemaNegocio: z.string().min(5, 'El problema debe tener una descripción mínima'),
  paradigma: ParadigmaMLSchema,
  tarea: TareaMLSchema,
  justificacionParadigma: z.string().min(5, 'Debe incluir una justificación metodológica'),
  variables: z.array(VariableSchema).min(1, 'Debe contar con al menos una variable definida'),
  variableTarget: z
    .preprocess(
      (v) => (v === null || v === '' || v === 'null' ? undefined : v),
      z.string().optional()
    )
    .optional(),
  restricciones: z.array(z.string()).default([]),
});
export type FichaTecnicaDS = z.infer<typeof FichaTecnicaSchema>;

/**
 * Esquema de respuesta para la evaluación socrática de claridad del problema.
 */
export const AclaracionDSSchema = z.object({
  suficiente: z.boolean(),
  preguntas: z.array(z.string()).max(5),
  supuestosAConfirmar: z.array(z.string()),
});
export type AclaracionDS = z.infer<typeof AclaracionDSSchema>;

/**
 * Algoritmos de clustering contemplados en el programa de la cátedra.
 */
export const AlgoritmoClusteringSchema = z.enum(['kmeans', 'jerarquico', 'dbscan']);
export type AlgoritmoClustering = z.infer<typeof AlgoritmoClusteringSchema>;

/**
 * Hiperparámetros de clustering seleccionados por el estudiante.
 */
export const HiperparametrosClusteringSchema = z.object({
  algoritmo: AlgoritmoClusteringSchema,
  k: z.number().int().min(2).max(10).optional(),
  criterioEnlace: z.enum(['ward', 'complete', 'average', 'single']).optional(),
  eps: z.number().positive().optional(),
  minSamples: z.number().int().min(2).optional(),
  randomState: z.number().int().default(42),
  justificacionEstudiante: z.string(),
});
export type HiperparametrosClustering = z.infer<typeof HiperparametrosClusteringSchema>;

/**
 * Métricas de evaluación y diagnóstico de clustering.
 */
export const MetricasEvaluacionSchema = z.object({
  inercia: z.number().optional(),
  silhouetteScore: z.number().min(-1).max(1),
  numeroClustersIdentificados: z.number().int().min(1),
  porcentajeRuido: z.number().min(0).max(100).optional(),
});
export type MetricasEvaluacion = z.infer<typeof MetricasEvaluacionSchema>;

/**
 * Perfil descriptivo de un cluster traducido a valor de negocio.
 */
export const PerfilClusterSchema = z.object({
  clusterId: z.union([z.number(), z.string()]),
  nombreDescriptivo: z.string(),
  caracteristicasClave: z.array(z.string()),
  tamanoRelativoPct: z.number(),
  accionDeNegocioRecomendada: z.string(),
});
export type PerfilCluster = z.infer<typeof PerfilClusterSchema>;

/**
 * Entrada en la bitácora de decisiones metodológicas del estudiante.
 */
export const DecisionDSSchema = z.object({
  id: z.string().optional(),
  paso: z.number().int(),
  fecha: z.string(),
  descripcion: z.string(),
  origen: z.enum(['estudiante', 'ia_aceptada', 'ia_rechazada']),
});
export type DecisionDS = z.infer<typeof DecisionDSSchema>;

/**
 * Modelo completo del proyecto persistible en IndexedDB y exportable.
 */
export const ProyectoDSSchema = z.object({
  id: z.string().default('proyecto-actual'),
  version: z.literal(1),
  fechaCreacion: z.string(),
  fechaActualizacion: z.string().optional(),
  problemaOriginal: z.string(),
  fichaTecnica: FichaTecnicaSchema,
  hiperparametros: HiperparametrosClusteringSchema.optional(),
  metricas: MetricasEvaluacionSchema.optional(),
  perfiles: z.array(PerfilClusterSchema).optional(),
  bitacoraDecisiones: z.array(DecisionDSSchema).default([]),
});
export type ProyectoDS = z.infer<typeof ProyectoDSSchema>;
