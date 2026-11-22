import { jsPDF } from 'jspdf';
import {
  COMPETENCY_DIMENSIONS,
  CompetencyKey,
  FacultyAnalyticsPayload,
  FacultyHistoricalReport,
  FacultyStudentReport,
} from '../types';

const COMPETENCY_KEYS: CompetencyKey[] = [
  'setup_adherence',
  'measurement_precision',
  'data_interpretation',
  'troubleshooting_safety',
  'experimental_design',
];

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function safeFileSegment(input: string): string {
  return (input || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function addPageHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  metaRight: string
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Top indigo banner
  doc.setFillColor(49, 46, 129); // indigo-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SimLab Competency Hub', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text(subtitle, 14, 18.5);

  doc.setFontSize(8.5);
  doc.setTextColor(224, 231, 255);
  doc.text(metaRight, pageWidth - 14, 12, { align: 'right' });
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 18.5, {
    align: 'right',
  });

  // Document title
  doc.setTextColor(28, 25, 23); // stone-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, 14, 38);

  doc.setDrawColor(231, 229, 228);
  doc.line(14, 41.5, pageWidth - 14, 41.5);

  return 48;
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageHeight - 16) {
    doc.addPage();
    return 18;
  }
  return currentY;
}

function addSectionHeading(doc: jsPDF, y: number, heading: string): number {
  const nextY = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(67, 56, 202); // indigo-700
  doc.text(heading.toUpperCase(), 14, nextY);
  doc.setDrawColor(199, 210, 254);
  doc.line(14, nextY + 2, doc.internal.pageSize.getWidth() - 14, nextY + 2);
  doc.setTextColor(28, 25, 23);
  return nextY + 7.5;
}

function addFooterAllPages(doc: jsPDF, label: string) {
  const count = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= count; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(label, 14, pageHeight - 8);
    doc.text(`Page ${i} of ${count}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

/**
 * 1. Student-wise Competency & Assessment PDF Report
 */
export function generateStudentReportPdf(
  report: FacultyStudentReport,
  facultyName: string
): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = addPageHeader(
    doc,
    `Individual Student Competency Report — ${report.student.name}`,
    'Official Faculty Academic Assessment & Practical Competency Transcript',
    `Faculty: ${facultyName}`
  );

  // Student Metadata Box
  doc.setFillColor(245, 245, 244);
  doc.roundedRect(14, y - 3, pageWidth - 28, 24, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 25, 23);
  doc.text(`Student: ${report.student.name}`, 18, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.text(`Email: ${report.student.email}`, 18, y + 9);
  doc.text(
    `Enrollment Code: ${report.student.enrollmentCode || 'N/A'}   |   Institution: ${report.student.institution}`,
    18,
    y + 15
  );

  const cohortsLabel =
    report.student.enrolledClasses.map((c) => `${c.code}`).join(', ') || 'Unassigned';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(67, 56, 202);
  doc.text(
    `Overall Competency: ${Math.round(report.competencyReport.overallScore)}%`,
    pageWidth - 18,
    y + 5,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(87, 83, 78);
  doc.text(`Cohorts: ${cohortsLabel}`, pageWidth - 18, y + 11, { align: 'right' });
  doc.text(
    `Submissions: ${report.submissions.length} | AI Vivas: ${report.vivaSessions.length}`,
    pageWidth - 18,
    y + 17,
    { align: 'right' }
  );
  y += 28;

  // Competency Dimension Breakdown
  y = addSectionHeading(doc, y, 'Competency Profile (5-Dimension Assessment)');
  for (const dim of report.competencyReport.dimensions) {
    y = ensureSpace(doc, y, 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(28, 25, 23);
    doc.text(dim.label, 14, y);
    doc.text(`${Math.round(dim.score)}%`, 112, y, { align: 'right' });

    // Bar background
    doc.setFillColor(231, 229, 228);
    doc.roundedRect(118, y - 3.2, 60, 3.6, 1, 1, 'F');
    // Bar fill
    if (dim.score >= 85) doc.setFillColor(16, 185, 129);
    else if (dim.score >= 70) doc.setFillColor(79, 70, 229);
    else doc.setFillColor(225, 29, 72);
    doc.roundedRect(118, y - 3.2, Math.max(1, (Math.min(100, dim.score) / 100) * 60), 3.6, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(87, 83, 78);
    doc.text(dim.status.toUpperCase(), pageWidth - 14, y, { align: 'right' });
    y += 7;
  }

  // Strengths & Focus Areas
  y = ensureSpace(doc, y + 2, 16);
  const strongNames =
    report.competencyReport.strongAreas
      .map((k) => COMPETENCY_DIMENSIONS[k]?.shortLabel || k)
      .join(', ') || 'None above 85% yet';
  const weakNames =
    report.competencyReport.weakAreas
      .map((k) => COMPETENCY_DIMENSIONS[k]?.shortLabel || k)
      .join(', ') || 'No areas below 70%';
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`Strengths: `, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(28, 25, 23);
  doc.text(strongNames, 34, y);
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60);
  doc.text(`Focus Areas: `, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(28, 25, 23);
  doc.text(weakNames, 38, y);
  y += 9;

  // Experiment Submission History
  y = addSectionHeading(doc, y, 'Experiment Submission History');
  if (report.submissions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 113, 108);
    doc.text('No laboratory submissions recorded for this student yet.', 14, y);
    y += 8;
  } else {
    for (const sub of report.submissions) {
      y = ensureSpace(doc, y, 18);
      const effective = sub.facultyScore ?? sub.totalScore;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(28, 25, 23);
      doc.text(`${sub.experimentTitle} (Attempt #${sub.attemptNumber})`, 14, y);
      doc.setTextColor(67, 56, 202);
      doc.text(
        `${effective}/${sub.maxScore}  |  ${sub.evaluationStatus.replace(/_/g, ' ').toUpperCase()}`,
        pageWidth - 14,
        y,
        { align: 'right' }
      );
      y += 4.8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(87, 83, 78);
      doc.text(
        `Submitted: ${formatDate(sub.submittedAt)}   |   Auto Score: ${sub.totalScore}   |   Faculty Score: ${
          sub.facultyScore != null ? sub.facultyScore : 'Auto retained'
        }   |   Readings: ${sub.dataReadingsCount}`,
        14,
        y
      );
      y += 4.5;
      if (sub.instructorFeedback) {
        const lines = doc.splitTextToSize(`Instructor Feedback: ${sub.instructorFeedback}`, pageWidth - 28);
        y = ensureSpace(doc, y, lines.length * 4 + 2);
        doc.setTextColor(28, 25, 23);
        doc.text(lines, 14, y);
        y += lines.length * 4 + 1.5;
      }
      doc.setDrawColor(231, 229, 228);
      doc.line(14, y, pageWidth - 14, y);
      y += 5;
    }
  }

  // AI Viva Voce Summary
  y = addSectionHeading(doc, y + 2, 'AI Viva Voce Assessment Summary');
  if (report.vivaSessions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 113, 108);
    doc.text('No AI Viva Voce sessions recorded.', 14, y);
    y += 8;
  } else {
    for (const vs of report.vivaSessions.slice(0, 6)) {
      y = ensureSpace(doc, y, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(28, 25, 23);
      doc.text(
        `${vs.experimentTitle} (Attempt #${vs.attemptNumber}) — ${vs.answeredCount}/${vs.questionsCount} Answered`,
        14,
        y
      );
      doc.setTextColor(67, 56, 202);
      doc.text(`${Math.round(vs.overallScore)}%`, pageWidth - 14, y, { align: 'right' });
      y += 4.5;
      if (vs.summaryFeedback) {
        const fbLines = doc.splitTextToSize(vs.summaryFeedback, pageWidth - 28);
        y = ensureSpace(doc, y, fbLines.length * 4 + 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(87, 83, 78);
        doc.text(fbLines, 14, y);
        y += fbLines.length * 4 + 2;
      }
    }
  }

  // Evaluation History Audit Trail
  if (report.evaluationHistory.length > 0) {
    y = addSectionHeading(doc, y + 2, 'Faculty Evaluation History');
    for (const ev of report.evaluationHistory.slice(0, 10)) {
      y = ensureSpace(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(28, 25, 23);
      doc.text(
        `${formatDate(ev.createdAt)} — ${ev.evaluatorName}: ${(ev.previousStatus || 'auto').replace(
          /_/g,
          ' '
        )} -> ${ev.newStatus.replace(/_/g, ' ')}`,
        14,
        y
      );
      y += 4.2;
      if (ev.feedback) {
        const fb = doc.splitTextToSize(ev.feedback, pageWidth - 28);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(87, 83, 78);
        doc.text(fb, 14, y);
        y += fb.length * 3.8 + 1.5;
      }
    }
  }

  addFooterAllPages(
    doc,
    `SimLab Competency Hub • Student Report (${report.student.enrollmentCode || report.student.id})`
  );

  const filename = `SimLab_Student_Report_${safeFileSegment(report.student.name)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 2. Class-wise Competency Analytics PDF Report
 */
export function generateClassCompetencyPdf(
  analytics: FacultyAnalyticsPayload,
  facultyName: string
): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = addPageHeader(
    doc,
    `Class-wise Competency Analytics Report — ${analytics.scope.code}`,
    `Scope: ${analytics.scope.name}`,
    `Faculty: ${facultyName}`
  );

  // Skill Gaps vs 75% Benchmark
  y = addSectionHeading(doc, y, 'Competency Dimension Benchmarks (75% Target)');
  for (const gap of analytics.skillGaps) {
    y = ensureSpace(doc, y, 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(28, 25, 23);
    doc.text(gap.label, 14, y);
    doc.text(`${Math.round(gap.averageScore)}%`, 115, y, { align: 'right' });

    doc.setFillColor(231, 229, 228);
    doc.roundedRect(120, y - 3.2, 55, 3.6, 1, 1, 'F');
    if (gap.severity === 'strong') doc.setFillColor(16, 185, 129);
    else if (gap.severity === 'on_track') doc.setFillColor(79, 70, 229);
    else if (gap.severity === 'attention') doc.setFillColor(245, 158, 11);
    else doc.setFillColor(225, 29, 72);
    doc.roundedRect(120, y - 3.2, Math.max(1, (Math.min(100, gap.averageScore) / 100) * 55), 3.6, 1, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(87, 83, 78);
    const deltaLabel =
      gap.gapFromBenchmark > 0 ? `-${gap.gapFromBenchmark}% gap` : `+${Math.abs(gap.gapFromBenchmark)}%`;
    doc.text(deltaLabel, pageWidth - 14, y, { align: 'right' });
    y += 7;
  }

  // Class Comparison Matrix
  y = addSectionHeading(doc, y + 3, 'Class-wise Competency Comparison');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(87, 83, 78);
  doc.text('Cohort', 14, y);
  doc.text('Students', 68, y, { align: 'right' });
  doc.text('Overall', 86, y, { align: 'right' });
  doc.text('Setup', 105, y, { align: 'right' });
  doc.text('Meas.', 123, y, { align: 'right' });
  doc.text('Data', 140, y, { align: 'right' });
  doc.text('Safety', 160, y, { align: 'right' });
  doc.text('Design', 180, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(214, 211, 209);
  doc.line(14, y, pageWidth - 14, y);
  y += 5;

  for (const row of analytics.classComparison) {
    y = ensureSpace(doc, y, 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(28, 25, 23);
    doc.text(`${row.code}`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(row.studentCount), 68, y, { align: 'right' });
    doc.text(`${Math.round(row.overallAverage)}%`, 86, y, { align: 'right' });
    doc.text(`${Math.round(row.setup_adherence)}%`, 105, y, { align: 'right' });
    doc.text(`${Math.round(row.measurement_precision)}%`, 123, y, { align: 'right' });
    doc.text(`${Math.round(row.data_interpretation)}%`, 140, y, { align: 'right' });
    doc.text(`${Math.round(row.troubleshooting_safety)}%`, 160, y, { align: 'right' });
    doc.text(`${Math.round(row.experimental_design)}%`, 180, y, { align: 'right' });
    y += 6;
  }

  // Experiment Performance Analysis
  y = addSectionHeading(doc, y + 3, 'Experiment Performance Analysis');
  if (analytics.experimentPerformance.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('No experiment submissions recorded in this scope.', 14, y);
    y += 7;
  } else {
    for (const exp of analytics.experimentPerformance) {
      y = ensureSpace(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(28, 25, 23);
      doc.text(`${exp.title} (${exp.code})`, 14, y);
      doc.setTextColor(67, 56, 202);
      doc.text(
        `Avg: ${exp.averageScorePct}% | Pass: ${exp.passRatePct}% | Subs: ${exp.submissionsCount}`,
        pageWidth - 14,
        y,
        { align: 'right' }
      );
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(87, 83, 78);
      doc.text(
        `Weakest Competency: ${COMPETENCY_DIMENSIONS[exp.weakestCompetency]?.label || exp.weakestCompetency} (${exp.weakestCompetencyAvg}%)`,
        14,
        y
      );
      y += 5.5;
    }
  }

  // Remedial Practice Students
  y = addSectionHeading(doc, y + 3, 'Students Requiring Remedial Practice (<75%)');
  if (analytics.remedialStudents.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text('All evaluated students currently meet or exceed the 75% competency threshold.', 14, y);
  } else {
    for (const st of analytics.remedialStudents) {
      y = ensureSpace(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(28, 25, 23);
      doc.text(`${st.studentName} (${st.classCodes.join(', ')})`, 14, y);
      doc.setTextColor(190, 18, 60);
      doc.text(
        `Mastery: ${Math.round(st.overallMastery)}% [${st.riskLevel.toUpperCase()} RISK]`,
        pageWidth - 14,
        y,
        { align: 'right' }
      );
      y += 4.3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(87, 83, 78);
      doc.text(
        `Weakest: ${st.weakestCompetencyLabel} (${Math.round(st.weakestCompetencyScore)}%)  |  Recommended Practice: ${st.recommendedExperimentTitle}`,
        14,
        y
      );
      y += 5.5;
    }
  }

  addFooterAllPages(
    doc,
    `SimLab Competency Hub • Class Competency Report (${analytics.scope.code})`
  );

  const filename = `SimLab_Class_Competency_${safeFileSegment(analytics.scope.code)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * 3. Historical Assessment Report PDF
 */
export function generateHistoricalReportPdf(
  historical: FacultyHistoricalReport,
  scopeLabel: string,
  facultyName: string
): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = addPageHeader(
    doc,
    `Historical Assessment & Evaluation Report`,
    `Scope: ${scopeLabel}`,
    `Faculty: ${facultyName}`
  );

  // Summary strip
  doc.setFillColor(245, 245, 244);
  doc.roundedRect(14, y - 3, pageWidth - 28, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(28, 25, 23);
  doc.text(`Total Submissions: ${historical.summary.totalSubmissions}`, 18, y + 4);
  doc.text(`Unique Students: ${historical.summary.uniqueStudents}`, 68, y + 4);
  doc.text(`Average Score: ${historical.summary.averageScorePct}%`, 118, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(87, 83, 78);
  doc.text(
    `Approved: ${historical.summary.approvedCount}  |  Needs Revision: ${historical.summary.needsRevisionCount}  |  Rejected: ${historical.summary.rejectedCount}  |  Pending Review: ${historical.summary.pendingReviewCount}`,
    18,
    y + 10.5
  );
  y += 22;

  // Assessment Records Table
  y = addSectionHeading(doc, y, 'Historical Submission Records');
  if (historical.records.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.text('No historical assessment records match the selected criteria.', 14, y);
    y += 8;
  } else {
    for (const rec of historical.records.slice(0, 40)) {
      y = ensureSpace(doc, y, 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(28, 25, 23);
      doc.text(`${rec.studentName} (${rec.classCode}) — ${rec.experimentTitle}`, 14, y);
      doc.setTextColor(67, 56, 202);
      doc.text(
        `${rec.effectiveScorePct}% | ${rec.evaluationStatus.replace(/_/g, ' ').toUpperCase()}`,
        pageWidth - 14,
        y,
        { align: 'right' }
      );
      y += 4.3;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(87, 83, 78);
      const compInline = COMPETENCY_KEYS.map(
        (k) => `${COMPETENCY_DIMENSIONS[k].shortLabel.split(' ')[0]}:${Math.round(rec.competencyScores?.[k] ?? 0)}%`
      ).join('  ');
      doc.text(
        `Submitted: ${formatDate(rec.submittedAt)} | Attempt #${rec.attemptNumber} | ${compInline}`,
        14,
        y
      );
      y += 5.5;
    }
  }

  // Evaluation History Audit Trail
  if (historical.evaluationLogs.length > 0) {
    y = addSectionHeading(doc, y + 3, 'Faculty Evaluation Audit Log');
    for (const log of historical.evaluationLogs.slice(0, 20)) {
      y = ensureSpace(doc, y, 9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(28, 25, 23);
      doc.text(
        `${formatDate(log.createdAt)} • ${log.evaluatorName} • ${(log.previousStatus || 'auto').replace(
          /_/g,
          ' '
        )} -> ${log.newStatus.replace(/_/g, ' ')}`,
        14,
        y
      );
      y += 4.2;
      if (log.feedback) {
        const lines = doc.splitTextToSize(log.feedback, pageWidth - 28);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(87, 83, 78);
        doc.text(lines, 14, y);
        y += lines.length * 3.8 + 1.5;
      }
    }
  }

  addFooterAllPages(doc, `SimLab Competency Hub • Historical Assessment Report (${scopeLabel})`);
  const filename = `SimLab_Historical_Report_${safeFileSegment(scopeLabel)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Helper for iframe-safe authenticated CSV/Excel downloads from /api/teacher/reports/export
 */
export async function downloadAuthenticatedCsv(
  url: string,
  token: string,
  fallbackFilename: string
): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `CSV export failed (HTTP ${res.status}).`);
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;

  const csvText = await res.text();
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
  return filename;
}
