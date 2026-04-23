/**
 * PanicLens — Geração de relatório técnico em PDF.
 * Usa jsPDF + autoTable. Layout Noir & Gold em escala adaptada para print.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ReportInput = {
  caseTitle: string;
  caseStatus?: string;
  reportedDefect?: string | null;
  customerName?: string | null;
  deviceModel?: string | null;
  deviceSerial?: string | null;
  iosVersion?: string | null;
  createdAt: string;
  engineVersion: string;
  rulesetVersion: string;
  modelCalibrationVersion?: string | null;

  executiveSummary: string;
  primaryCategory: string;
  severity: string;
  confidenceScore: number;
  confidenceLabel: string;
  riskOfMisdiagnosis: number;
  likelyRepairTier: string;
  simpleSwapChance: number;
  boardRepairChance: number;
  suspectedComponents: string[];
  technicalAlerts: string[];
  testSequence: string[];

  primaryHypothesis?: { title: string; explanation: string; confidence: number } | null;
  secondaryHypotheses: { title: string; category: string; confidence: number }[];
  evidences: { category: string; matchedText: string; weight: number }[];
  suggestions: { title: string; type: string; difficulty: string; risk: string; resolveChance: number; why: string; whenToEscalate?: string | null }[];
  organizationName?: string;
};

const GOLD: [number, number, number] = [201, 168, 76];
const INK: [number, number, number] = [22, 22, 22];
const MUTED: [number, number, number] = [110, 110, 110];
const BG_SOFT: [number, number, number] = [248, 245, 235];

export function generateAnalysisPdf(input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // Header
  doc.setFillColor(...INK);
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('PanicLens', margin, 32);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'normal');
  doc.text('iOS panic intelligence · relatório técnico', margin, 50);
  doc.setFontSize(8);
  const metaVersion = [
    `Engine v${input.engineVersion}`,
    `Ruleset v${input.rulesetVersion}`,
    input.modelCalibrationVersion ? `Model calibration v${input.modelCalibrationVersion}` : null,
  ].filter(Boolean).join(' · ');
  const meta = `${metaVersion} · ${new Date(input.createdAt).toLocaleString('pt-BR')}`;
  doc.text(meta, pageW - margin, 32, { align: 'right' });
  if (input.organizationName) {
    doc.text(input.organizationName, pageW - margin, 50, { align: 'right' });
  }
  y = 90;

  // Case title
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(input.caseTitle, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const subline = [
    input.customerName,
    input.deviceModel,
    input.deviceSerial && `SN ${input.deviceSerial}`,
    input.iosVersion && `iOS ${input.iosVersion}`,
  ].filter(Boolean).join(' · ');
  if (subline) { doc.text(subline, margin, y); y += 14; }
  if (input.reportedDefect) {
    const lines = doc.splitTextToSize(`Defeito relatado: ${input.reportedDefect}`, pageW - margin * 2);
    doc.text(lines, margin, y); y += lines.length * 11 + 4;
  }

  // KPIs row
  y += 6;
  drawKpiRow(doc, margin, y, pageW - margin * 2, [
    { label: 'Categoria', value: input.primaryCategory.replace(/_/g, ' ') },
    { label: 'Severidade', value: input.severity.toUpperCase() },
    { label: 'Confiança', value: `${input.confidenceScore}/100` },
    { label: 'Risco diag.', value: `${input.riskOfMisdiagnosis}%` },
    { label: 'Repair tier', value: input.likelyRepairTier.replace(/_/g, ' ') },
  ]);
  y += 56;

  // Executive summary
  y = section(doc, 'Resumo executivo', margin, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
  const sumLines = doc.splitTextToSize(input.executiveSummary, pageW - margin * 2);
  doc.text(sumLines, margin, y); y += sumLines.length * 12 + 8;

  // Primary hypothesis
  if (input.primaryHypothesis) {
    y = ensureSpace(doc, y, 90, margin);
    y = section(doc, 'Hipótese principal', margin, y);
    doc.setFillColor(...BG_SOFT);
    const boxH = 60;
    doc.roundedRect(margin, y, pageW - margin * 2, boxH, 4, 4, 'F');
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(input.primaryHypothesis.title, margin + 10, y + 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    const expLines = doc.splitTextToSize(input.primaryHypothesis.explanation, pageW - margin * 2 - 20);
    doc.text(expLines.slice(0, 3), margin + 10, y + 32);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...GOLD);
    doc.text(`${input.primaryHypothesis.confidence}/100`, pageW - margin - 10, y + 18, { align: 'right' });
    y += boxH + 12;
  }

  // Suspected components
  if (input.suspectedComponents.length) {
    y = ensureSpace(doc, y, 40, margin);
    y = section(doc, 'Componentes suspeitos', margin, y);
    doc.setFontSize(10); doc.setTextColor(...INK); doc.setFont('helvetica', 'normal');
    const compLines = doc.splitTextToSize(input.suspectedComponents.join(' · '), pageW - margin * 2);
    doc.text(compLines, margin, y); y += compLines.length * 12 + 8;
  }

  // Alerts
  if (input.technicalAlerts.length) {
    y = ensureSpace(doc, y, 60, margin);
    y = section(doc, 'Alertas técnicos', margin, y);
    doc.setFontSize(9); doc.setTextColor(...INK);
    for (const a of input.technicalAlerts) {
      const lines = doc.splitTextToSize(`• ${a}`, pageW - margin * 2);
      y = ensureSpace(doc, y, lines.length * 11 + 2, margin);
      doc.text(lines, margin, y); y += lines.length * 11 + 2;
    }
    y += 4;
  }

  // Suggestions table
  if (input.suggestions.length) {
    y = ensureSpace(doc, y, 80, margin);
    y = section(doc, 'Ações recomendadas', margin, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Ação', 'Tipo', 'Dif.', 'Risco', 'Resolve %', 'Por quê / Escalar quando']],
      body: input.suggestions.map((s, i) => [
        String(i + 1),
        s.title,
        s.type.replace(/_/g, ' '),
        s.difficulty,
        s.risk,
        `${s.resolveChance}%`,
        [s.why, s.whenToEscalate ? `Escalar: ${s.whenToEscalate}` : ''].filter(Boolean).join('\n'),
      ]),
      styles: { fontSize: 8, cellPadding: 5, textColor: INK, lineColor: [220, 220, 220] },
      headStyles: { fillColor: INK, textColor: GOLD, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 18 }, 5: { cellWidth: 50 } },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Test sequence
  if (input.testSequence.length) {
    y = ensureSpace(doc, y, 60, margin);
    y = section(doc, 'Sequência recomendada de testes', margin, y);
    doc.setFontSize(10); doc.setTextColor(...INK);
    input.testSequence.forEach((t, i) => {
      const line = `${String(i + 1).padStart(2, '0')}.  ${t}`;
      const lines = doc.splitTextToSize(line, pageW - margin * 2);
      y = ensureSpace(doc, y, lines.length * 12 + 2, margin);
      doc.text(lines, margin, y); y += lines.length * 12 + 2;
    });
    y += 6;
  }

  // Secondary hypotheses
  if (input.secondaryHypotheses.length) {
    y = ensureSpace(doc, y, 80, margin);
    y = section(doc, 'Hipóteses secundárias', margin, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Categoria', 'Título', 'Confiança']],
      body: input.secondaryHypotheses.map(h => [h.category.replace(/_/g, ' '), h.title, `${h.confidence}/100`]),
      styles: { fontSize: 9, cellPadding: 5, textColor: INK },
      headStyles: { fillColor: INK, textColor: GOLD },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Evidences
  if (input.evidences.length) {
    y = ensureSpace(doc, y, 80, margin);
    y = section(doc, 'Evidências extraídas do log', margin, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Categoria', 'Trecho', 'Peso']],
      body: input.evidences.slice(0, 60).map(e => [
        e.category.replace(/_/g, ' '),
        e.matchedText.length > 140 ? e.matchedText.slice(0, 140) + '…' : e.matchedText,
        String(e.weight),
      ]),
      styles: { fontSize: 8, cellPadding: 4, textColor: INK, font: 'courier' },
      headStyles: { fillColor: INK, textColor: GOLD, font: 'helvetica' },
      columnStyles: { 2: { cellWidth: 30 } },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
    doc.text('PanicLens · relatório gerado automaticamente. Use o julgamento profissional do técnico.', margin, pageH - 18);
    doc.text(`${i} / ${pages}`, pageW - margin, pageH - 18, { align: 'right' });
  }

  return doc;
}

function section(doc: jsPDF, title: string, x: number, y: number): number {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...GOLD);
  doc.text(title.toUpperCase(), x, y);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(x, y + 3, x + 30, y + 3);
  doc.setLineWidth(0.2);
  return y + 14;
}

function drawKpiRow(doc: jsPDF, x: number, y: number, w: number, items: { label: string; value: string }[]) {
  const gap = 8;
  const cellW = (w - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const cx = x + i * (cellW + gap);
    doc.setFillColor(245, 242, 235);
    doc.roundedRect(cx, y, cellW, 50, 3, 3, 'F');
    doc.setFontSize(7); doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal');
    doc.text(it.label.toUpperCase(), cx + 8, y + 14);
    doc.setFontSize(11); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
    const val = it.value.length > 18 ? it.value.slice(0, 18) + '…' : it.value;
    doc.text(val, cx + 8, y + 34);
  });
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 50) { doc.addPage(); return margin; }
  return y;
}
