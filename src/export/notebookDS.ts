import {
  AlgoritmoClustering,
  FichaTecnicaDS,
  HiperparametrosClustering,
} from '../core/schemas';
import {
  generarNotebookJson,
  generarNotebookJupyter,
  JupyterNotebook,
} from '../core/python/pipelineGenerator';

export function exportarNotebookIpynb({
  fichaTecnica,
  algoritmo,
  hiperparametros,
}: {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
}): string {
  return generarNotebookJson({
    fichaTecnica,
    algoritmo,
    hiperparametros,
  });
}

export function obtenerEstructuraNotebook({
  fichaTecnica,
  algoritmo,
  hiperparametros,
}: {
  fichaTecnica: FichaTecnicaDS;
  algoritmo: AlgoritmoClustering;
  hiperparametros?: HiperparametrosClustering;
}): JupyterNotebook {
  return generarNotebookJupyter({
    fichaTecnica,
    algoritmo,
    hiperparametros,
  });
}
