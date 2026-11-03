import { openDB, IDBPDatabase } from 'idb';
import { DecisionDS, ProyectoDS, ProyectoDSSchema } from './schemas';

const DB_NAME = 'ds_tutor_db';
const DB_VERSION = 1;
const STORE_PROYECTOS = 'proyectos';
const STORE_BITACORA = 'bitacora';

const REGEX_API_KEY_LEAK = /AIza[0-9A-Za-z\-_]{20,}|sk-or-v1-[0-9A-Za-z\-_]{10,}/;

/**
 * Escanea un objeto serializado para verificar que no contenga ninguna clave de API
 * antes de escribir en IndexedDB.
 */
function auditarAusenciaDeApiKey(objeto: unknown): void {
  const serializado = JSON.stringify(objeto);
  if (REGEX_API_KEY_LEAK.test(serializado)) {
    throw new Error(
      'VIOLACIÓN DE SEGURIDAD BYOK: Se detectó un intento de persistir la API key en IndexedDB. Operación abortada.'
    );
  }
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function obtenerInstanciaBD(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PROYECTOS)) {
          db.createObjectStore(STORE_PROYECTOS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BITACORA)) {
          const storeBitacora = db.createObjectStore(STORE_BITACORA, {
            keyPath: 'id',
            autoIncrement: true,
          });
          storeBitacora.createIndex('paso', 'paso', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Guarda el estado actual del proyecto en IndexedDB de manera segura.
 */
export async function guardarProyectoEnIDB(proyecto: ProyectoDS): Promise<void> {
  auditarAusenciaDeApiKey(proyecto);
  const db = await obtenerInstanciaBD();
  const validado = ProyectoDSSchema.parse(proyecto);
  await db.put(STORE_PROYECTOS, {
    ...validado,
    id: validado.id || 'proyecto-actual',
    fechaActualizacion: new Date().toISOString(),
  });
}

/**
 * Carga el proyecto persistido de IndexedDB si existe.
 */
export async function cargarProyectoDeIDB(): Promise<ProyectoDS | null> {
  const db = await obtenerInstanciaBD();
  const crudo = await db.get(STORE_PROYECTOS, 'proyecto-actual');
  if (!crudo) return null;
  try {
    return ProyectoDSSchema.parse(crudo);
  } catch {
    return null;
  }
}

/**
 * Elimina el proyecto almacenado en IndexedDB.
 */
export async function limpiarProyectoDeIDB(): Promise<void> {
  const db = await obtenerInstanciaBD();
  await db.delete(STORE_PROYECTOS, 'proyecto-actual');
  await db.clear(STORE_BITACORA);
}

/**
 * Registra una decisión metodológica tomada por el estudiante o sugerida por la IA.
 */
export async function registrarDecisionEnIDB(decision: Omit<DecisionDS, 'id'> & { id?: string }): Promise<void> {
  auditarAusenciaDeApiKey(decision);
  const db = await obtenerInstanciaBD();
  const decisionCompleta: DecisionDS = {
    ...decision,
    id: decision.id || `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
  await db.put(STORE_BITACORA, decisionCompleta);

  // Sincronizar también con el proyecto actual si existe
  const proyecto = await cargarProyectoDeIDB();
  if (proyecto) {
    const bitacoraActual = proyecto.bitacoraDecisiones || [];
    const existe = bitacoraActual.some((d) => d.id === decisionCompleta.id);
    if (!existe) {
      proyecto.bitacoraDecisiones = [...bitacoraActual, decisionCompleta];
      await guardarProyectoEnIDB(proyecto);
    }
  }
}

/**
 * Recupera todas las decisiones metodológicas registradas en la bitácora.
 */
export async function obtenerBitacoraDecisionesDeIDB(): Promise<DecisionDS[]> {
  const db = await obtenerInstanciaBD();
  return (await db.getAll(STORE_BITACORA)) as DecisionDS[];
}
