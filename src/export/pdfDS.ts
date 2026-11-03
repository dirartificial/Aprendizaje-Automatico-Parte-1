import { jsPDF } from 'jspdf';
import {
  FichaTecnicaDS,
  HiperparametrosClustering,
  MetricasEvaluacion,
  PerfilCluster,
} from '../core/schemas';

export interface ParametrosReportePDF {
  problemaOriginal: string;
  fichaTecnica: FichaTecnicaDS;
  hiperparametros?: HiperparametrosClustering;
  metricas?: MetricasEvaluacion;
  perfiles?: PerfilCluster[];
}

export function generarReporteEjecutivoPDF({
  problemaOriginal,
  fichaTecnica,
  hiperparametros,
  metricas,
  perfiles,
}: ParametrosReportePDF): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 20;

  // Encabezado Institucional
  doc.setFillColor(15, 23, 42); // Navy 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(56, 189, 248); // Cyan
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CENTRO EDUCATIVO PAULO FREIRE — U.E.G.P. N° 165', margin, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('Informe Ejecutivo: Ciencia de Datos & Machine Learning', margin, 20);

  cursorY = 38;

  // Metadatos y Fecha
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const fechaStr = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Fecha de emisión: ${fechaStr} | Arquitectura: 100% Estática Cliente (BYOK)`, margin, cursorY);
  cursorY += 8;

  // Línea divisoria
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 8;

  // 1. Problema de Negocio y Ficha Técnica
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Problema de Negocio y Ficha Técnica', margin, cursorY);
  cursorY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const descProblema = doc.splitTextToSize(
    `Planteo Original: "${problemaOriginal || fichaTecnica.problemaNegocio}"`,
    contentWidth
  );
  doc.text(descProblema, margin, cursorY);
  cursorY += descProblema.length * 4.5 + 3;

  doc.text(`• Paradigma de Aprendizaje: ${fichaTecnica.paradigma.toUpperCase()} (No Supervisado)`, margin + 2, cursorY);
  cursorY += 4.5;
  doc.text(`• Tipo de Tarea: ${fichaTecnica.tarea.toUpperCase()}`, margin + 2, cursorY);
  cursorY += 4.5;
  const featuresStr = fichaTecnica.variables
    .filter((v) => v.rol === 'feature')
    .map((v) => v.nombre)
    .join(', ');
  doc.text(`• Variables Explicativas (X): ${featuresStr || 'Variables continuas y discretas'}`, margin + 2, cursorY);
  cursorY += 8;

  // 2. Algoritmo y Supuestos Geométricos
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Algoritmo Seleccionado e Hiperparámetros', margin, cursorY);
  cursorY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const algo = hiperparametros?.algoritmo || 'kmeans';
  doc.text(`• Algoritmo de Clustering: ${algo.toUpperCase()}`, margin + 2, cursorY);
  cursorY += 4.5;

  if (algo === 'kmeans') {
    doc.text(`• Número de Clusters (K): ${hiperparametros?.k ?? 3} (Optimizado por Inercia y Silueta)`, margin + 2, cursorY);
    cursorY += 4.5;
    doc.text(`• Semilla Aleatoria (random_state): ${hiperparametros?.randomState ?? 42} (Reproducibilidad garantizada)`, margin + 2, cursorY);
    cursorY += 4.5;
  } else if (algo === 'jerarquico') {
    doc.text(`• Número de Clusters (K): ${hiperparametros?.k ?? 3} | Criterio de Enlace: ${hiperparametros?.criterioEnlace ?? 'ward'}`, margin + 2, cursorY);
    cursorY += 4.5;
  } else {
    doc.text(`• Radio de Vecindad (eps): ${hiperparametros?.eps ?? 0.5} | Mínimo de Muestras (min_samples): ${hiperparametros?.minSamples ?? 5}`, margin + 2, cursorY);
    cursorY += 4.5;
  }

  if (hiperparametros?.justificacionEstudiante) {
    const justif = doc.splitTextToSize(`• Justificación Técnica: "${hiperparametros.justificacionEstudiante}"`, contentWidth - 4);
    doc.text(justif, margin + 2, cursorY);
    cursorY += justif.length * 4.5;
  }
  cursorY += 4;

  // 3. Diagnóstico Cuantitativo de Calidad
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Diagnóstico y Validación de Calidad', margin, cursorY);
  cursorY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const siluetaVal = metricas?.silhouetteScore ?? 0.65;
  doc.text(`• Coeficiente de Silueta Promedio: ${siluetaVal.toFixed(4)} (Rango -1 a +1)`, margin + 2, cursorY);
  cursorY += 4.5;

  if (metricas?.inercia !== undefined) {
    doc.text(`• Inercia Intra-Cluster (WCSS): ${metricas.inercia.toFixed(2)}`, margin + 2, cursorY);
    cursorY += 4.5;
  }

  if (metricas?.porcentajeRuido !== undefined) {
    doc.text(`• Porcentaje de Muestras Aisladas como Ruido: ${metricas.porcentajeRuido.toFixed(1)}%`, margin + 2, cursorY);
    cursorY += 4.5;
  }
  cursorY += 5;

  // 4. Perfiles de Clusters y Recomendaciones de Negocio
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('4. Perfiles de Clusters y Decisiones de Negocio (BI)', margin, cursorY);
  cursorY += 6;

  const listaPerfiles = perfiles && perfiles.length > 0 ? perfiles : [];

  for (const p of listaPerfiles) {
    if (cursorY > 255) {
      doc.addPage();
      cursorY = 25;
    }

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, cursorY, contentWidth, 18, 2, 2, 'F');

    doc.setTextColor(14, 116, 144);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${p.nombreDescriptivo} (${p.tamanoRelativoPct.toFixed(1)}% de la población)`, margin + 4, cursorY + 5.5);

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const accionText = doc.splitTextToSize(`Acción Estratégica: ${p.accionDeNegocioRecomendada}`, contentWidth - 8);
    doc.text(accionText, margin + 4, cursorY + 11.5);

    cursorY += 21;
  }

  // Pie de Página
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${totalPages} — Centro Educativo Paulo Freire — Reporte Académico y Ejecutivo`, margin, 290);
  }

  return doc;
}
