// Web Worker para ejecución de Python en el navegador mediante Pyodide WASM.
// Se ejecuta en un hilo aislado para no congelar la interfaz de usuario durante cálculos pesados.

declare const self: any;

interface PyodideInterface {
  loadPackage: (packages: string | string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython: (code: string) => unknown;
  setStdout: (options: { batched: (output: string) => void }) => void;
  FS: {
    writeFile: (path: string, data: string, options?: { encoding: string }) => void;
    readFile: (path: string, options?: { encoding: string }) => string;
  };
}

declare function loadPyodide(options?: {
  indexURL?: string;
}): Promise<PyodideInterface>;

let pyodideInstance: PyodideInterface | null = null;
let stdoutBuffer: string[] = [];

async function inicializarPyodide(): Promise<void> {
  if (pyodideInstance) return;

  // Carga dinámica de Pyodide desde CDN oficial de jsDelivr
  // @ts-expect-error importScripts existe en el contexto de Web Worker
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

  pyodideInstance = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
  });

  pyodideInstance.setStdout({
    batched: (text: string) => {
      stdoutBuffer.push(text);
    },
  });

  // Carga paquetes fundamentales de Ciencia de Datos
  await pyodideInstance.loadPackage(['numpy', 'pandas', 'scikit-learn']);
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, code, csvData } = e.data;

  if (type === 'INIT') {
    try {
      await inicializarPyodide();
      self.postMessage({ type: 'INIT_DONE', id, success: true });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (type === 'RUN') {
    stdoutBuffer = [];
    try {
      if (!pyodideInstance) {
        await inicializarPyodide();
      }

      const pyodide = pyodideInstance!;

      // Escribe el dataset CSV generado en el sistema de archivos virtual de Pyodide
      if (csvData) {
        pyodide.FS.writeFile('dataset_ejemplo.csv', csvData, { encoding: 'utf8' });
      }

      // Ejecuta el código del estudiante/pipeline
      await pyodide.runPythonAsync(code);

      // Código Python auxiliar para serializar resultados estructurados a JSON
      const extractScript = `
import json

_results = {
    "stdout": "",
    "metricas": {},
    "puntos2D": [],
    "centroides2D": [],
    "resumenClusters": []
}

try:
    if 'labels' in globals() and 'X' in globals():
        _labels = list(labels)
        _x_col = X.columns[0]
        _y_col = X.columns[1] if len(X.columns) > 1 else X.columns[0]
        
        for idx in range(len(_labels)):
            _results["puntos2D"].append({
                "x": float(X.iloc[idx, 0]),
                "y": float(X.iloc[idx, 1] if len(X.columns) > 1 else X.iloc[idx, 0]),
                "cluster": int(_labels[idx]),
                "id": idx + 1
            })

    if 'kmeans' in globals() and hasattr(kmeans, 'cluster_centers_') and 'scaler' in globals():
        _centers = scaler.inverse_transform(kmeans.cluster_centers_)
        for c_idx in range(len(_centers)):
            _results["centroides2D"].append({
                "cluster": c_idx,
                "x": float(_centers[c_idx, 0]),
                "y": float(_centers[c_idx, 1] if len(_centers[c_idx]) > 1 else _centers[c_idx, 0])
            })

    if 'inercia' in globals():
        _results["metricas"]["inercia"] = float(inercia)
    if 'silueta' in globals():
        _results["metricas"]["silueta"] = float(silueta)
    if 'labels' in globals():
        _labels_set = set(labels)
        _results["metricas"]["numeroClusters"] = len([c for c in _labels_set if c != -1])
        if -1 in _labels_set:
            _ruido_count = list(labels).count(-1)
            _results["metricas"]["porcentajeRuido"] = (_ruido_count / len(labels)) * 100
        else:
            _results["metricas"]["porcentajeRuido"] = 0.0

    if 'resumen_bi' in globals():
        pass
except Exception as _e:
    pass

json.dumps(_results)
`;

      const jsonStr = (await pyodide.runPythonAsync(extractScript)) as string;
      const parsedResults = JSON.parse(jsonStr);

      parsedResults.stdout = stdoutBuffer.join('\n');

      self.postMessage({
        type: 'RUN_DONE',
        id,
        success: true,
        data: parsedResults,
      });
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        id,
        error: err instanceof Error ? err.message : String(err),
        stdout: stdoutBuffer.join('\n'),
      });
    }
  }
};
