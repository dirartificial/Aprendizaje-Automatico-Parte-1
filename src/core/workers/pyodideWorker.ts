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

  // Carga paquetes fundamentales de Ciencia de Datos incluyendo matplotlib y scipy
  await pyodideInstance.loadPackage([
    'numpy',
    'pandas',
    'scikit-learn',
    'matplotlib',
    'scipy',
  ]);
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

      // Configurar backend no interactivo de matplotlib para evitar errores de GUI en Web Worker
      await pyodide.runPythonAsync(`
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.show = lambda *args, **kwargs: None
`);

      // Escribe el dataset CSV generado en el sistema de archivos virtual de Pyodide
      if (csvData) {
        pyodide.FS.writeFile('dataset_ejemplo.csv', csvData, { encoding: 'utf8' });
      }

      // Ejecuta el código del estudiante/pipeline
      await pyodide.runPythonAsync(code);

      // Código Python auxiliar para serializar resultados estructurados a JSON
      const extractScript = `
import json
import numpy as np

_results = {
    "stdout": "",
    "metricas": {},
    "puntos2D": [],
    "centroides2D": [],
    "resumenClusters": []
}

try:
    if 'labels' in globals() and 'X' in globals():
        _labels = [int(x) for x in list(labels)]
        _n_total = len(_labels)
        
        for idx in range(_n_total):
            _results["puntos2D"].append({
                "x": round(float(X.iloc[idx, 0]), 2),
                "y": round(float(X.iloc[idx, 1] if len(X.columns) > 1 else X.iloc[idx, 0]), 2),
                "cluster": int(_labels[idx]),
                "id": idx + 1
            })

        _clusters_unicos = sorted(list(set(_labels)))
        for _c in _clusters_unicos:
            _mask = [i for i, l in enumerate(_labels) if l == _c]
            _sub = X.iloc[_mask]
            _medias = {}
            for _col in X.columns:
                _medias[str(_col)] = round(float(_sub[_col].mean()), 2)
            _results["resumenClusters"].append({
                "cluster": "Ruido (-1)" if _c == -1 else f"Cluster {_c}",
                "conteo": len(_mask),
                "porcentaje": round((len(_mask) / max(1, _n_total)) * 100.0, 1),
                "medias": _medias
            })

    if 'kmeans' in globals() and hasattr(kmeans, 'cluster_centers_') and 'scaler' in globals():
        _centers = scaler.inverse_transform(kmeans.cluster_centers_)
        for c_idx in range(len(_centers)):
            _results["centroides2D"].append({
                "cluster": int(c_idx),
                "x": round(float(_centers[c_idx, 0]), 2),
                "y": round(float(_centers[c_idx, 1] if len(_centers[c_idx]) > 1 else _centers[c_idx, 0]), 2)
            })
    elif 'labels' in globals() and 'X' in globals():
        # Para Jerárquico o DBSCAN calculamos los baricentros reales de cada cluster denso
        for _c in sorted(list(set(_labels))):
            if _c == -1:
                continue
            _mask = [i for i, l in enumerate(_labels) if l == _c]
            if len(_mask) > 0:
                _sub = X.iloc[_mask]
                _results["centroides2D"].append({
                    "cluster": int(_c),
                    "x": round(float(_sub.iloc[:, 0].mean()), 2),
                    "y": round(float(_sub.iloc[:, 1].mean() if len(X.columns) > 1 else _sub.iloc[:, 0].mean()), 2)
                })

    if 'inercia' in globals():
        _results["metricas"]["inercia"] = round(float(inercia), 2)
    if 'silueta' in globals():
        _results["metricas"]["silueta"] = round(float(silueta), 4)
    if 'labels' in globals():
        _labels_set = set(_labels)
        _results["metricas"]["numeroClusters"] = len([c for c in _labels_set if c != -1])
        if -1 in _labels_set:
            _ruido_count = _labels.count(-1)
            _results["metricas"]["porcentajeRuido"] = round((_ruido_count / max(1, len(_labels))) * 100.0, 1)
        else:
            _results["metricas"]["porcentajeRuido"] = 0.0
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
