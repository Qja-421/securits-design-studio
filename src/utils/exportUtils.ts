import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx';
import * as XLSX from 'xlsx';

import { Cabinet, ProjectDetails } from '../types/electrical';
import { calculateComponentMetrics } from '../engine/calculator';
import { validateCabinet } from '../engine/validator';
import { CATEGORY_NORMS } from '../engine/norms';

// Initialize the virtual file system for pdfmake fonts
if (pdfFonts && (pdfFonts as any).pdfMake && (pdfFonts as any).pdfMake.vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PDF EXPORT: NOTE DE CALCUL TECHNIQUE (via pdfmake)
// ─────────────────────────────────────────────────────────────────────────────
const captureActiveCabinetCanvas = (): string | null => {
  if (typeof document === 'undefined') return null;

  const konvaContainer = document.querySelector('.konvajs-content');
  if (!konvaContainer) return null;

  const layerCanvases = Array.from(konvaContainer.querySelectorAll('canvas'))
    .filter((canvas): canvas is HTMLCanvasElement => canvas.width > 0 && canvas.height > 0);

  if (layerCanvases.length === 0) return null;

  const width = Math.max(...layerCanvases.map((canvas) => canvas.width));
  const height = Math.max(...layerCanvases.map((canvas) => canvas.height));
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;

  const context = exportCanvas.getContext('2d');
  if (!context) return null;

  context.fillStyle = '#F0ECE3';
  context.fillRect(0, 0, width, height);
  layerCanvases.forEach((canvas) => context.drawImage(canvas, 0, 0));

  try {
    return exportCanvas.toDataURL('image/png');
  } catch (error) {
    console.error('Impossible de capturer le schéma du coffret pour le PDF:', error);
    return null;
  }
};

export const exportToPDF = (cabinets: Cabinet[], details: ProjectDetails, options?: { activeCabinetId?: string }) => {
  // ==========================================================================
  // 0. GLOBAL METRICS (aggregated over every cabinet)
  // ==========================================================================
  const referenceId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(Date.now() % 10000).toString().padStart(4, '0')}`;

  const cabinetReports = cabinets.map((cab) => {
    const loads = cab.components.filter((c) => c.type === 'load');
    const violations = validateCabinet(cab);
    const installedPowerW = loads.reduce((s, l) => s + (l.properties.powerW || 0), 0);
    const simultaneousCoeff = (() => {
      const n = loads.length;
      if (n >= 10) return 0.6;
      if (n >= 6) return 0.7;
      if (n >= 4) return 0.8;
      if (n >= 2) return 0.9;
      return 1.0;
    })();
    const simultaneousPowerW = installedPowerW * simultaneousCoeff;
    const hasThreePhase = loads.some(
      (c) => (c.properties.poles === '3P' || c.properties.poles === '4P') && (c.properties.powerW || 0) > 0
    );
    return {
      cabinet: cab,
      loads,
      violations,
      installedPowerW,
      simultaneousPowerW,
      simultaneousCoeff,
      hasThreePhase,
      okCount: cab.components.length - violations.length
    };
  });

  const totalComponents = cabinets.reduce((s, c) => s + c.components.length, 0);
  const totalLoads = cabinetReports.reduce((s, r) => s + r.loads.length, 0);
  const totalInstalledPowerW = cabinetReports.reduce((s, r) => s + r.installedPowerW, 0);
  const totalSimultaneousPowerW = cabinetReports.reduce((s, r) => s + r.simultaneousPowerW, 0);
  const totalErrors = cabinetReports.reduce(
    (s, r) => s + r.violations.filter((v) => v.severity === 'error').length,
    0
  );
  const totalWarnings = cabinetReports.reduce(
    (s, r) => s + r.violations.filter((v) => v.severity === 'warning').length,
    0
  );
  const totalViolations = totalErrors + totalWarnings;
  const allViolations = cabinetReports.flatMap((r) => r.violations);
  const allErrors = allViolations.filter((v) => v.severity === 'error');

  // Global subscription estimate (best-effort)
  const totalCosPhiWeighted = cabinetReports.reduce(
    (acc, r) => {
      const sum = r.loads.reduce(
        (s, l) => s + (l.properties.powerW || 0) * (l.properties.cosPhi || 0.8),
        0
      );
      return { power: acc.power + r.installedPowerW, weighted: acc.weighted + sum };
    },
    { power: 0, weighted: 0 }
  );
  const avgCosPhi = totalCosPhiWeighted.power > 0
    ? totalCosPhiWeighted.weighted / totalCosPhiWeighted.power
    : 0.8;
  const hasAnyThreePhase = cabinetReports.some((r) => r.hasThreePhase);
  const u = hasAnyThreePhase ? 400 : 230;
  const formula = hasAnyThreePhase
    ? (P: number) => P / (Math.sqrt(3) * u * avgCosPhi)
    : (P: number) => P / (u * avgCosPhi);
  const estimatedCurrentA = totalInstalledPowerW > 0 ? formula(totalSimultaneousPowerW) : 0;

  let recommendedKVA = 3;
  let recommendedBreakerA = 15;
  if (hasAnyThreePhase) {
    const c = estimatedCurrentA;
    if (c <= 15) { recommendedKVA = 9; recommendedBreakerA = 15; }
    else if (c <= 20) { recommendedKVA = 12; recommendedBreakerA = 20; }
    else if (c <= 30) { recommendedKVA = 18; recommendedBreakerA = 30; }
    else if (c <= 40) { recommendedKVA = 24; recommendedBreakerA = 40; }
    else { recommendedKVA = 30; recommendedBreakerA = 50; }
  } else {
    const c = estimatedCurrentA;
    if (c <= 15) { recommendedKVA = 3; recommendedBreakerA = 15; }
    else if (c <= 30) { recommendedKVA = 6; recommendedBreakerA = 30; }
    else if (c <= 45) { recommendedKVA = 9; recommendedBreakerA = 45; }
    else { recommendedKVA = 12; recommendedBreakerA = 60; }
  }

  // Capture the visual schema of the cabinet the user is currently viewing.
  // For other cabinets we fall back to text + tables.
  const activeCabinet = cabinets.find((c) => c.id === options?.activeCabinetId) || cabinets[0];
  const cabinetSchemaImage = activeCabinet && activeCabinet.id === (options?.activeCabinetId ?? activeCabinet.id)
    ? captureActiveCabinetCanvas()
    : null;

  // Helper: per-cabinet components table
  const buildCabinetComponentsTableBody = (cab: Cabinet, cabReport: typeof cabinetReports[number]) => {
    const body: any[] = [[
      { text: 'Nom', style: 'tableHeader' },
      { text: 'Type', style: 'tableHeader' },
      { text: 'Calib.', style: 'tableHeader' },
      { text: 'Pôles', style: 'tableHeader' },
      { text: 'P (W)', style: 'tableHeader' },
      { text: 'Sect.', style: 'tableHeader' },
      { text: 'Lg (m)', style: 'tableHeader' },
      { text: 'Statut', style: 'tableHeader' }
    ]];
    cab.components.forEach((comp) => {
      const p = comp.properties;
      const status = cabReport.violations.find((v) => v.componentId === comp.id)
        ? { label: 'NC', color: '#B91C1C' }
        : { label: 'OK', color: '#10B981' };
      body.push([
        { text: p.name, fontSize: 7 },
        { text: comp.type, fontSize: 7, color: '#4B5563' },
        { text: `${p.ratingA}A`, fontSize: 7 },
        { text: p.poles, fontSize: 7 },
        { text: comp.type === 'load' ? `${p.powerW || 0}` : '—', fontSize: 7 },
        { text: comp.type === 'load' ? `${p.cableSectionMm2}mm²` : '—', fontSize: 7 },
        { text: comp.type === 'load' ? `${p.cableLengthM}` : '—', fontSize: 7 },
        { text: status.label, fontSize: 7, bold: true, color: status.color, alignment: 'center' }
      ]);
    });
    return body;
  };

  // Helper: per-cabinet calculations table (loads only)
  const buildCabinetCalculationsTableBody = (cabReport: typeof cabinetReports[number]) => {
    const body: any[] = [[
      { text: 'Circuit', style: 'tableHeader' },
      { text: 'Ib (A)', style: 'tableHeader' },
      { text: 'Iz (A)', style: 'tableHeader' },
      { text: 'ΔU (%)', style: 'tableHeader' },
      { text: 'Icc min/max (A)', style: 'tableHeader' },
      { text: 'Conformité', style: 'tableHeader' }
    ]];
    cabReport.loads.forEach((load) => {
      const metrics = calculateComponentMetrics(load);
      const cat = load.properties.category;
      const dUlimit = cat === 'lighting' ? 3 : 5;
      const isOk = cabReport.violations.find((v) => v.componentId === load.id) === undefined;
      body.push([
        { text: load.properties.name, fontSize: 7 },
        { text: `${metrics.ibA}`, fontSize: 7, alignment: 'right' },
        { text: `${metrics.izA}`, fontSize: 7, alignment: 'right' },
        {
          text: `${metrics.voltageDropPercent}%`,
          fontSize: 7,
          alignment: 'right',
          color: metrics.voltageDropPercent > dUlimit ? '#F97316' : '#1F2937',
          bold: metrics.voltageDropPercent > dUlimit
        },
        { text: `${metrics.minIcc} / ${metrics.maxIcc}`, fontSize: 7, alignment: 'right' },
        {
          text: isOk ? '✓' : '✗',
          fontSize: 8,
          alignment: 'center',
          bold: true,
          color: isOk ? '#10B981' : '#EF4444'
        }
      ]);
    });
    return body;
  };

  // Cabinet-by-cabinet overview table
  const cabinetOverviewBody: any[] = [[
    { text: '#', style: 'tableHeader' },
    { text: 'Coffret', style: 'tableHeader' },
    { text: 'Dim.', style: 'tableHeader' },
    { text: 'Comp.', style: 'tableHeader' },
    { text: 'Circuits', style: 'tableHeader' },
    { text: 'P. Installée', style: 'tableHeader' },
    { text: 'P. Simultanée', style: 'tableHeader' },
    { text: 'Anomalies', style: 'tableHeader' }
  ]];
  cabinetReports.forEach((r, idx) => {
    cabinetOverviewBody.push([
      { text: `${idx + 1}`, fontSize: 8, alignment: 'center' },
      { text: r.cabinet.name, fontSize: 8 },
      { text: `${r.cabinet.rowsCount}R × ${r.cabinet.modulesPerRow}M`, fontSize: 8, alignment: 'center' },
      { text: `${r.cabinet.components.length}`, fontSize: 8, alignment: 'center' },
      { text: `${r.loads.length}`, fontSize: 8, alignment: 'center' },
      { text: `${(r.installedPowerW / 1000).toFixed(2)} kW`, fontSize: 8, alignment: 'right' },
      { text: `${(r.simultaneousPowerW / 1000).toFixed(2)} kW`, fontSize: 8, alignment: 'right' },
      {
        text: r.violations.length === 0 ? '✓ Conforme' : `${r.violations.length} (${r.violations.filter((v) => v.severity === 'error').length} err)`,
        fontSize: 8,
        color: r.violations.length === 0 ? '#10B981' : '#B91C1C',
        bold: true,
        alignment: 'center'
      }
    ]);
  });

  // Recommendations: build actionable list from violations
  type Recommendation = { priority: 'critical' | 'important' | 'advisory'; text: string };
  const recommendations: Recommendation[] = [];

  if (allErrors.some((v) => v.type === 'differential_load')) {
    recommendations.push({
      priority: 'critical',
      text: 'Vérifier le différentiel de tête de chaque tableau — un circuit aval dépasse le calibre.'
    });
  }
  if (allErrors.some((v) => v.type === 'voltage_drop')) {
    recommendations.push({
      priority: 'critical',
      text: 'Reprendre les chutes de tension > 3 % (éclairage) ou > 5 % (autres). Augmenter la section ou réduire la longueur.'
    });
  }
  if (allErrors.some((v) => v.type === 'rating')) {
    recommendations.push({
      priority: 'critical',
      text: 'Calibres disjoncteurs inadaptés par rapport au courant d\'emploi. Reprendre avec les calibres standard (10/16/20/32 A).'
    });
  }
  if (allErrors.some((v) => v.type === 'section')) {
    recommendations.push({
      priority: 'critical',
      text: 'Sections de câble insuffisantes par rapport au calibre. Vérifier les longueurs et choisir une section normalisée supérieure.'
    });
  }
  if (cabinetReports.some((r) => r.loads.length >= 8)) {
    recommendations.push({
      priority: 'advisory',
      text: 'Plus de 8 circuits par différentiel — vérifier la règle de l\'aval et envisager un second différentiel si nécessaire.'
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'advisory',
      text: 'Aucune anomalie détectée. Confirmer l\'installation par un essai d\'isolement et un contrôle visuel sur site avant mise sous tension.'
    });
  }
  recommendations.push({
    priority: 'advisory',
    text: 'Vérifier la mise à la terre de chaque coffret et la continuité des conducteurs de protection (PE) avant la livraison.'
  });

  // ==========================================================================
  // DOCUMENT DEFINITION
  // ==========================================================================
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 70, 40, 60],

    header: (currentPage: number) => currentPage > 1
      ? {
          margin: [40, 25, 40, 0],
          columns: [
            {
              width: '*',
              text: [
                { text: 'SECURITS TECH', bold: true, color: '#1E3A8A', fontSize: 9 },
                { text: `  |  Dossier Technique · ${details.name}`, color: '#64748B', fontSize: 8 }
              ]
            },
            {
              width: 'auto',
              text: `Réf. ${referenceId}`,
              fontSize: 8,
              color: '#64748B',
              alignment: 'right'
            }
          ]
        }
      : null,

    footer: (currentPage: number, pageCount: number) => ({
      margin: [40, 20, 40, 0],
      columns: [
        {
          width: '*',
          text: `Jacques Alphonse MATOKO · Securits Technologies · Pointe-Noire, Congo`,
          fontSize: 7,
          color: '#94A3B8'
        },
        {
          width: 'auto',
          text: `Page ${currentPage}/${pageCount}`,
          fontSize: 7,
          color: '#94A3B8',
          alignment: 'right'
        }
      ]
    }),

    content: [
      // ════════════ PAGE 1 : COUVERTURE ════════════
      { text: '', margin: [0, 60, 0, 0] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'SECURITS TECH', style: 'coverBrand' },
              { text: 'Ingénierie Électrique · NF C 15-100', style: 'coverSub' },
              { canvas: [{ type: 'line', x1: 0, y1: 8, x2: 200, y2: 8, lineWidth: 2, lineColor: '#F7941D' }] }
            ]
          }
        ]
      },
      { text: '', margin: [0, 60, 0, 0] },
      { text: 'DOSSIER TECHNIQUE', style: 'coverTitle' },
      { text: 'D\'INSTALLATION ÉLECTRIQUE', style: 'coverTitle' },
      { text: 'Conforme à la NF C 15-100', style: 'coverTitleSub' },
      { text: '', margin: [0, 30, 0, 0] },

      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              widths: ['auto', 12, 'auto'],
              body: [
                ['Projet', ':', details.name],
                ['Client', ':', details.clientName],
                ['Adresse', ':', details.clientAddress],
                ['Date', ':', details.date],
                ['Auteur', ':', details.author],
                ['Référence', ':', referenceId]
              ].map((row) => [
                { text: row[0], bold: true, color: '#1E3A8A', fontSize: 11 },
                { text: row[1], fontSize: 11, color: '#94A3B8', alignment: 'center' },
                { text: row[2], fontSize: 11, color: '#0F172A' }
              ])
            },
            layout: 'noBorders'
          }
        ]
      },

      { text: '', margin: [0, 90, 0, 0] },
      {
        table: {
          widths: ['100%'],
          body: [[
            {
              stack: [
                { text: 'CONFIDENTIEL', bold: true, color: '#8B1E3F', fontSize: 9 },
                { text: 'Document à l\'usage exclusif du commanditaire et de l\'électricien responsable. Toute reproduction est interdite sans autorisation préalable de Securits Technologies.', fontSize: 8, color: '#475569', margin: [0, 4, 0, 0] }
              ],
              fillColor: '#F8FAFC',
              margin: [10, 10, 10, 10]
            }
          ]]
        },
        layout: 'noBorders'
      },

      { text: '', pageBreak: 'after' },

      // ════════════ PAGE 2 : SYNTHÈSE EXÉCUTIVE ════════════
      { text: 'SYNTHÈSE EXÉCUTIVE', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },
      { text: '', margin: [0, 8, 0, 0] },

      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                stack: [
                  { text: 'VUE D\'ENSEMBLE', bold: true, color: '#1E3A8A', fontSize: 9 },
                  { text: '', margin: [0, 5, 0, 0] },
                  {
                    columns: [
                      { width: '*', text: [{ text: 'Coffrets', fontSize: 8, color: '#64748B' }, { text: `${cabinets.length}`, fontSize: 18, bold: true, color: '#0F172A' }] },
                      { width: '*', text: [{ text: 'Composants', fontSize: 8, color: '#64748B' }, { text: `${totalComponents}`, fontSize: 18, bold: true, color: '#0F172A' }] }
                    ]
                  },
                  { text: '', margin: [0, 6, 0, 0] },
                  {
                    columns: [
                      { width: '*', text: [{ text: 'Circuits', fontSize: 8, color: '#64748B' }, { text: `${totalLoads}`, fontSize: 18, bold: true, color: '#0F172A' }] },
                      { width: '*', text: [{ text: 'Anomalies', fontSize: 8, color: '#64748B' }, { text: `${totalViolations}`, fontSize: 18, bold: true, color: totalViolations === 0 ? '#10B981' : '#B91C1C' }] }
                    ]
                  }
                ],
                margin: [10, 12, 10, 12],
                fillColor: '#F8FAFC'
              },
              {
                stack: [
                  { text: 'BILAN ÉNERGÉTIQUE', bold: true, color: '#1E3A8A', fontSize: 9 },
                  { text: '', margin: [0, 5, 0, 0] },
                  { text: `Puissance installée : ${(totalInstalledPowerW / 1000).toFixed(2)} kW`, fontSize: 9 },
                  { text: `Puissance simultanée : ${(totalSimultaneousPowerW / 1000).toFixed(2)} kW`, fontSize: 9 },
                  { text: `Courant de ligne : ${estimatedCurrentA.toFixed(1)} A`, fontSize: 9 },
                  { text: `Abonnement préconisé : ${recommendedKVA} kVA (${recommendedBreakerA} A)`, fontSize: 9, bold: true, color: '#F7941D', margin: [0, 4, 0, 0] },
                  { text: `Réseau : ${hasAnyThreePhase ? '400V Triphasé (3P+N)' : '230V Monophasé (1P+N)'}`, fontSize: 9 }
                ],
                margin: [10, 12, 10, 12],
                fillColor: '#FFF7ED'
              }
            ]
          ]
        },
        layout: 'noBorders'
      },

      { text: '', margin: [0, 12, 0, 0] },
      {
        table: {
          widths: ['100%'],
          body: [[
            {
              stack: [
                { text: 'CONFORMITÉ GLOBALE', bold: true, fontSize: 9, color: totalViolations === 0 ? '#047857' : '#B91C1C' },
                { text: '', margin: [0, 4, 0, 0] },
                totalViolations === 0
                  ? {
                      text: '✔ CONFORME — L\'installation est en parfaite conformité avec les prescriptions de la NF C 15-100. Aucun calibre inadapté, aucune chute de tension excessive, aucun différentiel sous-dimensionné. Sous réserve d\'un essai d\'isolement sur site, l\'installation peut être mise sous tension.',
                      fontSize: 9,
                      color: '#047857'
                    }
                  : {
                      text: `⚠️ NON-CONFORMITÉS — ${totalErrors} erreur(s) bloquante(s) et ${totalWarnings} avertissement(s) détecté(s) sur l\'ensemble de l\'installation. Voir sections 3 (Détail par coffret) et 4 (Conformité) pour la liste complète. Ne pas mettre sous tension avant correction.`,
                      fontSize: 9,
                      color: '#B91C1C'
                    }
              ],
              fillColor: totalViolations === 0 ? '#D1FAE5' : '#FEF2F2',
              margin: [10, 10, 10, 10]
            }
          ]]
        },
        layout: 'noBorders'
      },

      { text: '', pageBreak: 'after' },

      // ════════════ PAGE 3 : 1. INFORMATIONS PROJET ════════════
      { text: '1. INFORMATIONS PROJET', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },

      { text: '1.1 Identification', style: 'h2' },
      {
        table: {
          widths: ['25%', '*'],
          body: [
            ['Nom du projet', details.name],
            ['Client', details.clientName],
            ['Adresse du site', details.clientAddress],
            ['Date de l\'étude', details.date],
            ['Auteur / Concepteur', details.author],
            ['Référence dossier', referenceId]
          ].map((row) => [
            { text: row[0], bold: true, color: '#475569', fontSize: 9 },
            { text: row[1], fontSize: 9 }
          ])
        },
        layout: 'lightHorizontalLines'
      },

      { text: '1.2 Périmètre', style: 'h2' },
      {
        ul: [
          `Nombre de tableaux : ${cabinets.length}`,
          `Type d\'installation : ${hasAnyThreePhase ? 'Mixte (mono + triphasé)' : 'Résidentielle monophasée 230V'}`,
          `Norme applicable : NF C 15-100 (édition 2025) + guides UTE C 15-712 / C 15-100/52`,
          `Réseau d\'alimentation : ${hasAnyThreePhase ? '400V triphasé (3P+N + PE)' : '230V monophasé (1P+N + PE)'}`,
          `Marques fournisseurs : Legrand / Schneider Electric / Hager / ABB / Télémécanique (sélection par composant)`
        ],
        fontSize: 9,
        color: '#0F172A'
      },

      { text: '1.3 Méthodologie', style: 'h2' },
      {
        text: [
          { text: 'Le présent dossier a été généré à partir du logiciel ', fontSize: 9 },
          { text: 'Securits Design Studio', fontSize: 9, bold: true, color: '#1E3A8A' },
          { text: ', application professionnelle de conception de tableaux électriques développée par Securits Technologies (Pointe-Noire, Congo).', fontSize: 9 },
          { text: '\n\nTous les calculs de ce dossier sont conformes à la NF C 15-100 et prennent en compte :', fontSize: 9 },
          { text: '\n', fontSize: 4 },
          { text: '•  Courant d\'emploi Ib = P / (U·cosφ) en monophasé, P / (√3·U·cosφ) en triphasé', fontSize: 9 },
          { text: '\n', fontSize: 4 },
          { text: '•  Courant admissible Iz selon tableaux 52C / 52E de la NF C 15-100 (5 modes de pose A à E)', fontSize: 9 },
          { text: '\n', fontSize: 4 },
          { text: '•  Chute de tension ΔU = k·ρ·L·Ib / S, avec ρCu = 0,0225 Ω·mm²/m', fontSize: 9 },
          { text: '\n', fontSize: 4 },
          { text: '•  Courants de court-circuit Icc min / Icc max (source ≈ 0,035 Ω)', fontSize: 9 },
          { text: '\n', fontSize: 4 },
          { text: '•  Règle de l\'aval (§ 10.1.1.2) — somme pondérée des calibres aval ≤ calibre différentiel', fontSize: 9 },
          { text: '\n', fontSize: 4 },
          { text: '•  Cohérence Type AC / A / Hpi selon récepteurs (cuisson, LL, EV → Type A obligatoire)', fontSize: 9 }
        ]
      },

      { text: '', pageBreak: 'after' },

      // ════════════ PAGE 4 : 2. ANALYSE DES PUISSANCES ════════════
      { text: '2. ANALYSE DES PUISSANCES', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },

      { text: '2.1 Bilan global', style: 'h2' },
      {
        table: {
          widths: ['40%', '*'],
          body: [
            ['Puissance installée totale', `${(totalInstalledPowerW / 1000).toFixed(2)} kW`],
            ['Coefficient de foisonnement moyen', `${cabinetReports.reduce((s, r) => s + r.simultaneousCoeff, 0) / Math.max(cabinetReports.length, 1) > 0 ? (cabinetReports.reduce((s, r) => s + r.simultaneousCoeff, 0) / cabinetReports.length).toFixed(2) : '1.00'}`],
            ['Puissance simultanée globale', `${(totalSimultaneousPowerW / 1000).toFixed(2)} kW`],
            ['Facteur de puissance moyen', avgCosPhi.toFixed(2)],
            ['Courant de ligne estimé', `${estimatedCurrentA.toFixed(1)} A${hasAnyThreePhase ? ' / phase' : ''}`],
            ['Taux d\'utilisation recommandé', '0,70 (cible d\'ingénierie)'],
            ['Abonnement préconisé', `${recommendedKVA} kVA — Disj. de tête ${recommendedBreakerA} A`]
          ].map((row) => [
            { text: row[0], bold: true, color: '#475569', fontSize: 9 },
            { text: row[1], fontSize: 10, bold: row[0].startsWith('Abonnement'), color: row[0].startsWith('Abonnement') ? '#F7941D' : '#0F172A' }
          ])
        },
        layout: 'lightHorizontalLines'
      },

      { text: '2.2 Bilan par coffret', style: 'h2' },
      {
        table: {
          headerRows: 1,
          widths: [10, '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: cabinetOverviewBody
        },
        layout: 'lightHorizontalLines'
      },

      { text: '', pageBreak: 'after' },

      // ════════════ PAGE 5+ : 3. DÉTAIL PAR COFFRET ════════════
      { text: '3. DÉTAIL PAR COFFRET', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },

      // Schéma unifilaire pour le coffret actif
      ...(activeCabinet ? [
        { text: `3.0 Schéma unifilaire : ${activeCabinet.name} (vue d\'atelier)`, style: 'h2' },
        cabinetSchemaImage
          ? { image: cabinetSchemaImage, fit: [515, 580], alignment: 'center', margin: [0, 8, 0, 8] }
          : {
              table: {
                widths: ['100%'],
                body: [[
                  {
                    text: `Schéma non disponible : ouvrez le tableau "${activeCabinet.name}" dans l\'atelier avant de générer l\'export pour capturer sa vue canvas.`,
                    fontSize: 9,
                    color: '#8B1E3F',
                    margin: [10, 30, 10, 30],
                    alignment: 'center',
                    fillColor: '#FFF1F2'
                  }
                ]]
              },
              layout: 'noBorders'
            }
      ] : []),
      { text: '', pageBreak: 'after' },

      // Un bloc par coffret
      ...cabinetReports.flatMap((report, idx) => {
        const block: any[] = [];
        const cab = report.cabinet;
        const violCount = report.violations.length;

        block.push({ text: `3.${idx + 1} Coffret : ${cab.name}`, style: 'h2' });

        // En-tête compact
        block.push({
          table: {
            widths: ['25%', '*', '25%', '*'],
            body: [
              ['Dimensions', `${cab.rowsCount} rangée(s) × ${cab.modulesPerRow} modules`, 'Composants', `${cab.components.length}`],
              ['Circuits (charges)', `${report.loads.length}`, 'Anomalies', violCount === 0 ? '✓ Aucune' : `${violCount} (${report.violations.filter((v) => v.severity === 'error').length} erreur${report.violations.filter((v) => v.severity === 'error').length > 1 ? 's' : ''})`],
              ['Puissance installée', `${(report.installedPowerW / 1000).toFixed(2)} kW`, 'Coefficient foisonnement', report.simultaneousCoeff.toFixed(2)],
              ['Puissance simultanée', `${(report.simultaneousPowerW / 1000).toFixed(2)} kW`, 'Alimentation', report.hasThreePhase ? '400V Tri' : '230V Mono']
            ].map((r) => r.map((c, i) => ({
              text: c,
              fontSize: 8,
              bold: i === 0 || i === 2,
              color: (i === 1 || i === 3) && typeof c === 'string' && (c.startsWith('✓') || c.includes('erreur'))
                ? (c.includes('✓') ? '#10B981' : '#B91C1C')
                : '#0F172A'
            })))
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8]
        });

        // Table des composants
        block.push({
          text: `Liste des composants (${cab.components.length})`,
          fontSize: 9,
          bold: true,
          color: '#1E3A8A',
          margin: [0, 8, 0, 4]
        });
        block.push({
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: buildCabinetComponentsTableBody(cab, report)
          },
          layout: 'lightHorizontalLines'
        });

        // Table des calculs (charges uniquement)
        if (report.loads.length > 0) {
          block.push({
            text: 'Calculs NF C 15-100',
            fontSize: 9,
            bold: true,
            color: '#1E3A8A',
            margin: [0, 8, 0, 4]
          });
          block.push({
            table: {
              headerRows: 1,
              widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
              body: buildCabinetCalculationsTableBody(report)
            },
            layout: 'lightHorizontalLines'
          });
        }

        // Anomalies du coffret
        if (report.violations.length > 0) {
          block.push({
            text: `Anomalies détectées (${report.violations.length})`,
            fontSize: 9,
            bold: true,
            color: '#B91C1C',
            margin: [0, 8, 0, 4]
          });
          report.violations.forEach((v) => {
            const violationComp = cab.components.find((c) => c.id === v.componentId);
            const compName = violationComp ? violationComp.properties.name : '—';
            block.push({
              table: {
                widths: ['100%'],
                body: [[
                  {
                    stack: [
                      { text: `[${v.severity === 'error' ? 'ERREUR' : 'AVERT.'}] ${compName}`, bold: true, fontSize: 9, color: v.severity === 'error' ? '#B91C1C' : '#D97706' },
                      { text: v.message, fontSize: 8, color: '#0F172A', margin: [0, 3, 0, 0] },
                      ...(v.suggestedValue ? [{ text: `→ Suggestion : ${v.suggestedValue}`, fontSize: 8, color: '#475569', italics: true }] : [])
                    ],
                    fillColor: v.severity === 'error' ? '#FEF2F2' : '#FFFBEB',
                    margin: [8, 6, 8, 6]
                  }
                ]]
              },
              layout: 'noBorders',
              margin: [0, 2, 0, 2]
            });
          });
        }

        // Saut de page entre coffrets (sauf le dernier)
        if (idx < cabinetReports.length - 1) {
          block.push({ text: '', pageBreak: 'after' });
        }
        return block;
      }),

      { text: '', pageBreak: 'after' },

      // ════════════ PAGE FINALE : 4-5-6 ════════════
      { text: '4. CONFORMITÉ NF C 15-100 — SYNTHÈSE GLOBALE', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },

      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              {
                stack: [
                  { text: 'RÉSUMÉ', bold: true, color: '#1E3A8A', fontSize: 9 },
                  { text: '', margin: [0, 6, 0, 0] },
                  { text: `Total anomalies : ${totalViolations}`, fontSize: 10, bold: true, color: totalViolations === 0 ? '#10B981' : '#B91C1C' },
                  { text: `Erreurs bloquantes : ${totalErrors}`, fontSize: 9, color: totalErrors === 0 ? '#10B981' : '#B91C1C' },
                  { text: `Avertissements : ${totalWarnings}`, fontSize: 9, color: totalWarnings === 0 ? '#10B981' : '#D97706' },
                  { text: `Coffrets 100 % conformes : ${cabinetReports.filter((r) => r.violations.length === 0).length} / ${cabinetReports.length}`, fontSize: 9 }
                ],
                margin: [10, 10, 10, 10],
                fillColor: '#F8FAFC'
              },
              {
                stack: [
                  { text: 'RÉPARTITION PAR TYPE', bold: true, color: '#1E3A8A', fontSize: 9 },
                  { text: '', margin: [0, 6, 0, 0] },
                  { text: `Surtension (ΔU) : ${allViolations.filter((v) => v.type === 'voltage_drop').length}`, fontSize: 9 },
                  { text: `Calibre disjoncteur : ${allViolations.filter((v) => v.type === 'rating').length}`, fontSize: 9 },
                  { text: `Section de câble : ${allViolations.filter((v) => v.type === 'section').length}`, fontSize: 9 },
                  { text: `Règle de l\'aval : ${allViolations.filter((v) => v.type === 'differential_load').length}`, fontSize: 9 },
                  { text: `Sélectivité : ${allViolations.filter((v) => v.type === 'selectivity').length}`, fontSize: 9 }
                ],
                margin: [10, 10, 10, 10],
                fillColor: '#FFF7ED'
              }
            ]
          ]
        },
        layout: 'noBorders'
      },

      { text: '', margin: [0, 16, 0, 0] },
      { text: '4.1 Liste exhaustive des anomalies', style: 'h2' },
      ...(totalViolations === 0
        ? [
            {
              table: {
                widths: ['100%'],
                body: [[
                  {
                    text: '✔ Aucune anomalie détectée. L\'installation est conforme à la NF C 15-100.',
                    fontSize: 10,
                    bold: true,
                    color: '#047857',
                    fillColor: '#D1FAE5',
                    margin: [12, 14, 12, 14],
                    alignment: 'center'
                  }
                ]]
              },
              layout: 'noBorders'
            }
          ]
        : allErrors.length === 0
          ? [
              {
                text: 'Aucun erreur bloquante. Seuls des avertissements sont présents — voir section 3 (Détail par coffret).',
                fontSize: 9,
                color: '#D97706',
                italics: true,
                margin: [0, 4, 0, 0]
              }
            ]
          : allErrors.map((v) => ({
              table: {
                widths: ['100%'],
                body: [[
                  {
                    stack: [
                      {
                        text: `[ERREUR] ${cabinetReports.find((r) => r.violations.find((vv) => vv.id === v.id))?.cabinet.name ?? '—'} → ${cabinets.flatMap((c) => c.components).find((c) => c.id === v.componentId)?.properties.name ?? '—'}`,
                        bold: true,
                        fontSize: 9,
                        color: '#B91C1C'
                      },
                      { text: v.message, fontSize: 9, margin: [0, 3, 0, 0], color: '#0F172A' },
                      ...(v.suggestedValue ? [{ text: `Suggestion : ${v.suggestedValue}`, fontSize: 8, italics: true, color: '#475569', margin: [0, 2, 0, 0] }] : [])
                    ],
                    fillColor: '#FEF2F2',
                    margin: [10, 8, 10, 8]
                  }
                ]]
              },
              layout: 'noBorders',
              margin: [0, 3, 0, 3]
            }))),

      { text: '', pageBreak: 'after' },

      // 5. RECOMMANDATIONS
      { text: '5. RECOMMANDATIONS TECHNIQUES', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },
      { text: '5.1 Avant intervention', style: 'h2' },
      ...recommendations
        .filter((r) => r.priority === 'critical' || r.priority === 'important')
        .map((r) => ({
          table: {
            widths: ['*'],
            body: [[
              {
                stack: [
                  { text: `▸ ${r.text}`, fontSize: 9, color: r.priority === 'critical' ? '#B91C1C' : '#D97706', bold: r.priority === 'critical' },
                  ...(r.priority === 'critical' ? [{ text: 'Action bloquante — à corriger impérativement avant pose.', fontSize: 7, italics: true, color: '#94A3B8', margin: [0, 2, 0, 0] }] : [])
                ],
                fillColor: r.priority === 'critical' ? '#FEF2F2' : '#FFFBEB',
                margin: [10, 6, 10, 6]
              }
            ]]
          },
          layout: 'noBorders',
          margin: [0, 3, 0, 3]
        })),

      { text: '5.2 Pendant intervention', style: 'h2' },
      {
        ul: [
          'Poser les composants en respectant l\'ordre : protection générale → différentiels → disjoncteurs.',
          'Respecter les polarités Phase/Neutre/Terre et le repérage des borniers (L1/L2/L3/N/PE).',
          'Couples de serrage des borniers conformes aux prescriptions Legrand/Schneider/Hager (0,8 à 2,5 N·m selon calibre).',
          'Étiquetage des circuits sur le bandeau bas du coffret (gaine thermo-rétractable ou porte-étiquettes).',
          'Serrage mécanique de la barre de terre et continuité des conducteurs PE testée au mégohmmètre.'
        ],
        fontSize: 9,
        color: '#0F172A'
      },

      { text: '5.3 Après intervention', style: 'h2' },
      {
        ul: [
          'Essai d\'isolement sous 500V DC (≥ 0,5 MΩ entre conducteurs actifs et entre actifs et terre).',
          'Vérification du déclenchement des dispositifs différentiels (test bouton T + mesure temps de coupure).',
          'Mesure de la résistance de la prise de terre (≤ 100 Ω en régime TT, ≤ 0,5 Ω si régime TN-C).',
          'Relevé des chutes de tension sur les circuits les plus défavorisés (R+4 dans le cas du R+4 SCI MPITA).',
          'Marquage NF C 15-100 / Securits Tech sur le coffret et dossier remis au client.'
        ],
        fontSize: 9,
        color: '#0F172A'
      },

      { text: '', pageBreak: 'after' },

      // 6. VALIDATION & SIGNATURES
      { text: '6. VALIDATION & SIGNATURES', style: 'h1' },
      { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 515, y2: 2, lineWidth: 0.6, lineColor: '#1E3A8A' }] },

      {
        text: [
          { text: 'Le présent dossier atteste la conformité technique de l\'installation décrite selon la norme NF C 15-100. Il est arrêté à la date du ', fontSize: 10 },
          { text: details.date, fontSize: 10, bold: true },
          { text: ' et référencé ', fontSize: 10 },
          { text: referenceId, fontSize: 10, bold: true, color: '#1E3A8A' },
          { text: '.', fontSize: 10 }
        ],
        margin: [0, 10, 0, 20]
      },

      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'L\'ÉLECTRICIEN RESPONSABLE', bold: true, fontSize: 9, color: '#1E3A8A' },
              { canvas: [{ type: 'line', x1: 0, y1: 50, x2: 160, y2: 50, lineWidth: 0.5, lineColor: '#94A3B8' }] },
              { text: details.author, fontSize: 9, margin: [0, 56, 0, 0] },
              { text: 'Securits Technologies — Pointe-Noire', fontSize: 8, color: '#64748B', italics: true },
              { text: 'Date : ____________________', fontSize: 8, color: '#64748B', margin: [0, 16, 0, 0] },
              { text: 'Signature :', fontSize: 8, color: '#64748B', margin: [0, 4, 0, 0] }
            ]
          },
          {
            width: '*',
            stack: [
              { text: 'LE CLIENT', bold: true, fontSize: 9, color: '#1E3A8A' },
              { canvas: [{ type: 'line', x1: 0, y1: 50, x2: 160, y2: 50, lineWidth: 0.5, lineColor: '#94A3B8' }] },
              { text: details.clientName, fontSize: 9, margin: [0, 56, 0, 0] },
              { text: 'Adresse du site', fontSize: 8, color: '#64748B', italics: true },
              { text: 'Date : ____________________', fontSize: 8, color: '#64748B', margin: [0, 16, 0, 0] },
              { text: 'Signature :', fontSize: 8, color: '#64748B', margin: [0, 4, 0, 0] }
            ]
          }
        ]
      },

      { text: '', margin: [0, 40, 0, 0] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'BUREAU DE CONTRÔLE (optionnel)', bold: true, fontSize: 9, color: '#1E3A8A' },
              { canvas: [{ type: 'line', x1: 0, y1: 50, x2: 160, y2: 50, lineWidth: 0.5, lineColor: '#94A3B8' }] },
              { text: 'Société : ____________________', fontSize: 8, color: '#64748B', margin: [0, 56, 0, 0] },
              { text: 'Avis : ☐ Conforme  ☐ Avec réserves  ☐ Non conforme', fontSize: 8, color: '#64748B', margin: [0, 8, 0, 0] },
              { text: 'Date : ____________________', fontSize: 8, color: '#64748B', margin: [0, 8, 0, 0] },
              { text: 'Signature :', fontSize: 8, color: '#64748B', margin: [0, 4, 0, 0] }
            ]
          },
          { width: '*', text: '' }
        ]
      },

      { text: '', margin: [0, 40, 0, 0] },
      {
        table: {
          widths: ['100%'],
          body: [[
            {
              text: `Document généré par Securits Design Studio · ${referenceId} · le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}.\nToute reproduction ou diffusion non autorisée est interdite. © 2026 Securits Technologies.`,
              fontSize: 7,
              color: '#94A3B8',
              italics: true,
              alignment: 'center',
              margin: [8, 8, 8, 8]
            }
          ]]
        },
        layout: 'noBorders'
      }
    ],

    styles: {
      coverBrand: { fontSize: 18, bold: true, color: '#1E3A8A', characterSpacing: 2 },
      coverSub: { fontSize: 9, color: '#64748B', margin: [0, 4, 0, 0] },
      coverTitle: { fontSize: 22, bold: true, color: '#0F172A', characterSpacing: 1 },
      coverTitleSub: { fontSize: 12, color: '#F7941D', bold: true, margin: [0, 4, 0, 0] },
      h1: {
        fontSize: 14,
        bold: true,
        color: '#1E3A8A',
        margin: [0, 8, 0, 4],
        characterSpacing: 0.5
      },
      h2: {
        fontSize: 11,
        bold: true,
        color: '#1E3A8A',
        margin: [0, 10, 0, 4]
      },
      tableHeader: {
        bold: true,
        fontSize: 7,
        color: '#FFFFFF',
        fillColor: '#1E3A8A',
        alignment: 'center'
      }
    }
  };

  pdfMake.createPdf(docDefinition).download(`Dossier_Technique_${details.name.replace(/\s+/g, '_')}_${referenceId}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. WORD EXPORT: NOTE EXPLICATIVE CLIENT (via docx)
// ─────────────────────────────────────────────────────────────────────────────
export const exportToWord = (cabinet: Cabinet, details: ProjectDetails) => {
  const loads = cabinet.components.filter((c) => c.type === 'load');
  const installedPowerW = loads.reduce((sum, load) => sum + (load.properties.powerW || 0), 0);
  const hasThreePhase = loads.some((c) => (c.properties.poles === '3P' || c.properties.poles === '4P') && (c.properties.powerW || 0) > 0);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header title
          new Paragraph({
            children: [
              new TextRun({
                text: "SECURITS TECH",
                bold: true,
                size: 28,
                color: "1e3a8a",
              }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "NOTE EXPLICATIVE DE VOTRE SYSTÈME ÉLECTRIQUE",
                bold: true,
                size: 36,
                color: "000000",
              }),
            ],
            spacing: { after: 300 },
          }),

          // Intro
          new Paragraph({
            children: [
              new TextRun({
                text: `Cher Client,\n\nNous avons le plaisir de vous transmettre le rapport descriptif et explicatif concernant l'armoire électrique "${cabinet.name}" dimensionnée pour votre projet "${details.name}" situé à ${details.clientAddress}.\n\nCe document a pour vocation d'expliquer, de manière claire et vulgarisée, les différents choix technologiques mis en œuvre par votre électricien ${details.author} afin de garantir une sécurité maximale des personnes et des biens, tout en respectant la norme NF C 15-100.\n\n`,
                size: 22,
              }),
            ],
            spacing: { after: 200 },
          }),

          // Table of Project details
          new Paragraph({
            children: [
              new TextRun({
                text: "1. Fiche Synthétique du Projet",
                bold: true,
                size: 26,
                color: "1e3a8a",
              }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Client", bold: true, size: 20 })] })],
                    width: { size: 30, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: details.clientName, size: 20 })] })],
                    width: { size: 70, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Chantier / Adresse", bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: details.clientAddress, size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Date de l'étude", bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: details.date, size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Réseau requis", bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: hasThreePhase ? "400V Triphasé (Idéal pour les équipements puissants / climatisation centrale)" : "230V Monophasé (Standard résidentiel)", size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Puissance cumulée", bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: `${(installedPowerW / 1000).toFixed(1)} kW installés`, size: 20 })] })],
                  }),
                ],
              }),
            ],
          }),

          // Explanatory Section
          new Paragraph({
            children: [
              new TextRun({
                text: "\n2. Rôle des Organes de Protection",
                bold: true,
                size: 26,
                color: "1e3a8a",
              }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: "• Les Disjoncteurs Divisionnaires : ",
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: "Ils sont installés en tête de chaque circuit individuel (prises, lampes, climatisation...). Leur rôle principal est de protéger vos câbles et vos appareils contre l'échauffement provoqué par une surcharge (trop d'appareils branchés en même temps) ou un court-circuit. Ils coupent instantanément l'électricité en cas de défaut pour éliminer tout risque de départ d'incendie.\n\n",
                size: 22,
              }),
              new TextRun({
                text: "• Les Interrupteurs Différentiels : ",
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: "Ce sont les garants de votre vie humaine. Ils mesurent en permanence le courant entrant et sortant. Si une fuite de courant est détectée (par exemple si une personne touche un fil dénudé ou un appareil ménager défectueux), l'interrupteur différentiel coupe l'alimentation en moins de 30 millisecondes, empêchant ainsi l'électrocution.\n\n",
                size: 22,
              }),
              new TextRun({
                text: "• Pourquoi différents types de différentiels ?\n",
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: "- Le Type AC protège les équipements standards (éclairages, prises classiques).\n- Le Type A est obligatoire pour la plaque de cuisson et le lave-linge, car il est capable de détecter les fuites de courant continu générées par les cartes électroniques modernes.\n- Le Type Hpi est hautement conseillé pour le réfrigérateur et l'informatique : il évite les coupures intempestives dues aux orages ou aux parasites du réseau.",
                size: 22,
              }),
            ],
            spacing: { after: 150 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "3. Choix des Sections de Câbles",
                bold: true,
                size: 26,
                color: "1e3a8a",
              }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "La section (l'épaisseur) de cuivre des fils électriques n'est pas choisie au hasard. Elle répond à deux impératifs de la norme NF C 15-100 :\n" +
                "1. Éviter l'échauffement excessif du fil sous l'intensité du courant demandé.\n" +
                "2. Limiter la chute de tension en fin de ligne (qui fait clignoter les lumières ou endommage les moteurs de clim).\n\n" +
                "Dans votre projet :\n" +
                "- L'éclairage utilise du fil de 1.5 mm² protégé par disjoncteur 10A ou 16A.\n" +
                "- Les prises classiques, le four et le chauffe-eau utilisent du fil de 2.5 mm² protégé par 16A ou 20A.\n" +
                "- La plaque de cuisson utilise du fil de 6 mm² protégé par un gros disjoncteur de 32A.",
                size: 22,
              }),
            ],
            spacing: { after: 150 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "4. Conclusion & Recommandations",
                bold: true,
                size: 26,
                color: "1e3a8a",
              }),
            ],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `L'étude technique confirme que le tableau proposé est sûr et pérenne. Nous vous recommandons de souscrire un abonnement de ${hasThreePhase ? '18 kVA en triphasé' : '9 kVA en monophasé'} auprès de votre fournisseur d'électricité pour exploiter pleinement vos équipements sans disjonction intempestive du compteur général.\n\nRestant à votre entière disposition,\n\nL'équipe Technique Securits Tech`,
                size: 22,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Note_Client_${cabinet.name.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXCEL EXPORT: NOMENCLATURE DU MATÉRIEL (via xlsx)
// ─────────────────────────────────────────────────────────────────────────────
export const exportToExcel = (cabinet: Cabinet, details: ProjectDetails) => {
  const components = cabinet.components;
  const loads = components.filter(c => c.type === 'load');

  // Quantities mapping
  const bom: Record<string, { designation: string; category: string; quantity: number; unit: string; specs: string }> = {};

  // A. Add Cabinet box
  const cabinetKey = `cabinet_${cabinet.rowsCount}_${cabinet.modulesPerRow}`;
  bom[cabinetKey] = {
    designation: `Coffret de répartition électrique ${cabinet.rowsCount} rangée(s), ${cabinet.modulesPerRow} modules`,
    category: "Enveloppe/Coffret",
    quantity: 1,
    unit: "Unité",
    specs: `Enveloppe principale étanche IP40`
  };

  // B. Add components
  components.forEach((c) => {
    if (c.type === 'general_protection') {
      const key = `vistop_${c.properties.ratingA}_${c.properties.poles}`;
      if (!bom[key]) {
        bom[key] = {
          designation: `Interrupteur de coupure générale Legrand VISTOP ${c.properties.ratingA}A`,
          category: "Coupure Générale",
          quantity: 0,
          unit: "Unité",
          specs: `Pôles: ${c.properties.poles}, Calibre: ${c.properties.ratingA}A`
        };
      }
      bom[key].quantity += 1;
    } else if (c.type === 'differential') {
      const key = `diff_${c.properties.ratingA}_${c.properties.sensitivity}_${c.properties.diffType}`;
      if (!bom[key]) {
        bom[key] = {
          designation: `Interrupteur différentiel 30mA Type ${c.properties.diffType} ${c.properties.ratingA}A`,
          category: "Protection Différentielle",
          quantity: 0,
          unit: "Unité",
          specs: `Sensibilité: ${c.properties.sensitivity}, Type: ${c.properties.diffType}, Calibre: ${c.properties.ratingA}A`
        };
      }
      bom[key].quantity += 1;
    } else if (c.type === 'breaker') {
      const key = `breaker_${c.properties.ratingA}_${c.properties.poles}_${c.properties.curve || 'C'}`;
      if (!bom[key]) {
        bom[key] = {
          designation: `Disjoncteur divisionnaire Ph+N Courbe ${c.properties.curve || 'C'} ${c.properties.ratingA}A`,
          category: "Protection Divisionnaire",
          quantity: 0,
          unit: "Unité",
          specs: `Pôles: ${c.properties.poles || '1P+N'}, Calibre: ${c.properties.ratingA}A`
        };
      }
      bom[key].quantity += 1;
    } else if (c.type === 'load') {
      // Breaker for the load
      const key = `breaker_load_${c.properties.ratingA}_${c.properties.poles}`;
      if (!bom[key]) {
        bom[key] = {
          designation: `Disjoncteur divisionnaire ${c.properties.poles} Courbe C ${c.properties.ratingA}A`,
          category: "Protection Divisionnaire",
          quantity: 0,
          unit: "Unité",
          specs: `Pour circuit récepteur type ${c.properties.category || 'autre'}`
        };
      }
      bom[key].quantity += 1;
    }
  });

  // C. Add Cables
  const cablesLengths: Record<string, { section: number; poles: string; length: number }> = {};
  loads.forEach((load) => {
    const section = load.properties.cableSectionMm2;
    const poles = load.properties.poles;
    const length = load.properties.cableLengthM || 0;
    const isTri = poles === '3P' || poles === '4P';
    const cableType = isTri ? `5G${section}` : `3G${section}`;

    if (!cablesLengths[cableType]) {
      cablesLengths[cableType] = { section, poles, length: 0 };
    }
    cablesLengths[cableType].length += length;
  });

  Object.keys(cablesLengths).forEach((key) => {
    const item = cablesLengths[key];
    const isTri = item.poles === '3P' || item.poles === '4P';
    bom[`cable_${key}`] = {
      designation: `Câble cuivre isolé U-1000 R2V ${isTri ? '5G' : '3G'}${item.section} mm²`,
      category: "Câblage/Liaisons",
      quantity: Math.ceil(item.length),
      unit: "Mètre",
      specs: `Liaison sous goulotte/apparent`
    };
  });

  // D. Blanking Modules (Obturateurs de finition)
  const totalModules = cabinet.rowsCount * cabinet.modulesPerRow;
  const usedModules = components.reduce((sum, c) => sum + (c.widthModules || 1), 0);
  const emptyModules = totalModules - usedModules;

  if (emptyModules > 0) {
    bom["obturateurs"] = {
      designation: "Obturateurs de modules en bandes fractionnables (Legrand/Hager)",
      category: "Accessoire de finition",
      quantity: emptyModules,
      unit: "Module",
      specs: "Plaques d'obturateurs pour masquer les espaces vides sur le rail"
    };
  }

  // E. Convert to XLSX formatting
  const rows = Object.values(bom).map(item => [
    item.designation,
    item.category,
    item.quantity,
    item.unit,
    item.specs
  ]);

  const worksheetData = [
    [`SECURITS TECH — Nomenclature de matériel : ${cabinet.name}`],
    [`Client : ${details.clientName} | Chantier : ${details.clientAddress} | Date : ${details.date}`],
    [], // empty row
    ["Désignation du Matériel", "Type de Matériel", "Quantité", "Unité", "Usage recommandé / Spécifications"],
    ...rows
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 60 }, // designation
    { wch: 25 }, // type
    { wch: 10 }, // qty
    { wch: 10 }, // unit
    { wch: 45 }  // specs
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Nomenclature");
  XLSX.writeFile(wb, `Nomenclature_${cabinet.name.replace(/\s+/g, '_')}.xlsx`);
};
