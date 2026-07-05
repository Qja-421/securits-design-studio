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

export const exportToPDF = (cabinet: Cabinet, details: ProjectDetails) => {
  const violations = validateCabinet(cabinet);
  const loads = cabinet.components.filter((c) => c.type === 'load');
  const cabinetSchemaImage = captureActiveCabinetCanvas();

  // Power balance variables
  const installedPowerW = loads.reduce((sum, load) => sum + (load.properties.powerW || 0), 0);
  
  let simultaneityCoeff = 1.0;
  const circuitCount = loads.length;
  if (circuitCount >= 10) {
    simultaneityCoeff = 0.6;
  } else if (circuitCount >= 6) {
    simultaneityCoeff = 0.7;
  } else if (circuitCount >= 4) {
    simultaneityCoeff = 0.8;
  } else if (circuitCount >= 2) {
    simultaneityCoeff = 0.9;
  }

  const simultaneousPowerW = installedPowerW * simultaneityCoeff;
  const totalPowerCosPhi = loads.reduce(
    (sum, load) => sum + ((load.properties.powerW || 0) * (load.properties.cosPhi || 0.8)),
    0
  );
  const avgCosPhi = installedPowerW > 0 ? totalPowerCosPhi / installedPowerW : 0.8;
  const hasThreePhase = loads.some(
    (c) => (c.properties.poles === '3P' || c.properties.poles === '4P') && (c.properties.powerW || 0) > 0
  );
  
  const u = hasThreePhase ? 400 : 230;
  let estimatedCurrentA = 0;
  if (installedPowerW > 0) {
    estimatedCurrentA = hasThreePhase
      ? simultaneousPowerW / (Math.sqrt(3) * u * avgCosPhi)
      : simultaneousPowerW / (u * avgCosPhi);
  }

  let recommendedKVA = 3;
  let recommendedBreakerA = 15;
  if (hasThreePhase) {
    const currentPerPhase = estimatedCurrentA;
    if (currentPerPhase <= 15) {
      recommendedKVA = 9; recommendedBreakerA = 15;
    } else if (currentPerPhase <= 20) {
      recommendedKVA = 12; recommendedBreakerA = 20;
    } else if (currentPerPhase <= 30) {
      recommendedKVA = 18; recommendedBreakerA = 30;
    } else if (currentPerPhase <= 40) {
      recommendedKVA = 24; recommendedBreakerA = 40;
    } else {
      recommendedKVA = 30; recommendedBreakerA = 50;
    }
  } else {
    if (estimatedCurrentA <= 15) {
      recommendedKVA = 3; recommendedBreakerA = 15;
    } else if (estimatedCurrentA <= 30) {
      recommendedKVA = 6; recommendedBreakerA = 30;
    } else if (estimatedCurrentA <= 45) {
      recommendedKVA = 9; recommendedBreakerA = 45;
    } else {
      recommendedKVA = 12; recommendedBreakerA = 60;
    }
  }

  const tableBody: any[] = [
    [
      { text: 'Nom Circuit', style: 'tableHeader' },
      { text: 'Usage', style: 'tableHeader' },
      { text: 'Protect. In', style: 'tableHeader' },
      { text: 'Pôles', style: 'tableHeader' },
      { text: 'P (W)', style: 'tableHeader' },
      { text: 'Sect. (mm²)', style: 'tableHeader' },
      { text: 'Lg (m)', style: 'tableHeader' },
      { text: 'Ib (A)', style: 'tableHeader' },
      { text: 'Iz (A)', style: 'tableHeader' },
      { text: 'ΔU (%)', style: 'tableHeader' },
      { text: 'Icc Min/Max', style: 'tableHeader' },
      { text: 'Statut', style: 'tableHeader' }
    ]
  ];

  loads.forEach((load) => {
    const metrics = calculateComponentMetrics(load);
    const p = load.properties;
    const norm = p.category ? CATEGORY_NORMS[p.category] : null;
    const usageLabel = norm ? norm.labelFr : 'Autre';
    const compViolations = violations.filter(v => v.componentId === load.id);
    const isOk = compViolations.length === 0;

    tableBody.push([
      { text: p.name, fontSize: 8 },
      { text: usageLabel, fontSize: 8 },
      { text: `${p.ratingA}A`, fontSize: 8 },
      { text: p.poles, fontSize: 8 },
      { text: `${p.powerW}W`, fontSize: 8 },
      { text: `${p.cableSectionMm2}mm²`, fontSize: 8 },
      { text: `${p.cableLengthM}m`, fontSize: 8 },
      { text: `${metrics.ibA}A`, fontSize: 8 },
      { text: `${metrics.izA}A`, fontSize: 8 },
      { text: `${metrics.voltageDropPercent}%`, fontSize: 8, color: metrics.voltageDropPercent > (p.category === 'lighting' ? 3 : 5) ? '#F97316' : '#1F2937' },
      { text: `${metrics.minIcc} / ${metrics.maxIcc} A`, fontSize: 7 },
      { text: isOk ? 'Conforme' : 'Non-conforme', fontSize: 8, bold: true, color: isOk ? '#10B981' : '#EF4444' }
    ]);
  });

  const docDefinition: any = {
    content: [
      { text: 'SECURITS TECH', style: 'brandTitle' },
      { text: 'NOTE DE CALCUL TECHNIQUE & CONFORMITÉ NF C 15-100', style: 'docSubtitle' },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, strokeWidth: 1.5, strokeColor: '#1E3A8A' }] },
      
      {
        margin: [0, 15, 0, 15],
        pageBreak: 'after',
        columns: [
          {
            width: '50%',
            text: [
              { text: 'INFORMATIONS PROJET\n', style: 'sectionSubTitle' },
              { text: `Projet : `, bold: true }, { text: `${details.name}\n` },
              { text: `Date de l'étude : `, bold: true }, { text: `${details.date}\n` },
              { text: `Concepteur : `, bold: true }, { text: `${details.author}\n\n` },
              { text: 'INFORMATIONS CLIENT\n', style: 'sectionSubTitle' },
              { text: `Client : `, bold: true }, { text: `${details.clientName}\n` },
              { text: `Adresse : `, bold: true }, { text: `${details.clientAddress}\n` }
            ],
            fontSize: 9
          },
          {
            width: '50%',
            text: [
              { text: 'SYNTHÈSE DU COFFRET & BILAN\n', style: 'sectionSubTitle' },
              { text: `Tableau : `, bold: true }, { text: `${cabinet.name}\n` },
              { text: `Dimensions : `, bold: true }, { text: `${cabinet.rowsCount} rangée(s), ${cabinet.modulesPerRow} modules\n` },
              { text: `Alimentation : `, bold: true }, { text: `${hasThreePhase ? '400V Triphasé (3P+N)' : '230V Monophasé (1P+N)'}\n` },
              { text: `Puissance Installée : `, bold: true }, { text: `${(installedPowerW / 1000).toFixed(2)} kW\n` },
              { text: `Coeff. Foisonnement : `, bold: true }, { text: `${simultaneityCoeff.toFixed(2)}\n` },
              { text: `Puissance Simultanée : `, bold: true }, { text: `${(simultaneousPowerW / 1000).toFixed(2)} kW\n` },
              { text: `Courant de Ligne estimé : `, bold: true }, { text: `${estimatedCurrentA.toFixed(1)} A\n` },
              { text: `Abonnement préconisé : `, bold: true }, { text: `${recommendedKVA} kVA (${recommendedBreakerA}A)\n` }
            ],
            fontSize: 9
          }
        ]
      },

      { text: 'SCHÉMA UNIFILAIRE DU TABLEAU', style: 'sectionTitle' },
      {
        text: `Schéma unifilaire du tableau ${cabinet.name}`,
        fontSize: 10,
        bold: true,
        color: '#2C2C2A',
        margin: [0, 0, 0, 10]
      },
      ...(cabinetSchemaImage
        ? [
            {
              image: cabinetSchemaImage,
              fit: [515, 680],
              alignment: 'center',
              margin: [0, 5, 0, 10]
            }
          ]
        : [
            {
              text: 'Schéma non disponible : ouvrez le coffret actif avant de lancer l\'export PDF.',
              fontSize: 10,
              color: '#8B1E3F',
              margin: [0, 40, 0, 40],
              alignment: 'center'
            }
          ]),
      {
        text: `Coffret : ${cabinet.name} - ${cabinet.rowsCount} rangée(s), ${cabinet.modulesPerRow} modules`,
        fontSize: 8,
        color: '#4B5563',
        alignment: 'center',
        pageBreak: 'after'
      },

      { text: 'CARACTÉRISTIQUES DÉTAILLÉES DES CIRCUITS', style: 'sectionTitle' },
      {
        style: 'tableExample',
        table: {
          headerRows: 1,
          widths: ['14%', '11%', '7%', '6%', '8%', '8%', '7%', '7%', '7%', '7%', '10%', '8%'],
          body: tableBody
        },
        layout: 'lightHorizontalLines'
      },
      
      { text: 'RAPPORT DE CONFORMITÉ NF C 15-100', style: 'sectionTitle', margin: [0, 15, 0, 5] }
    ],
    styles: {
      brandTitle: {
        fontSize: 16,
        bold: true,
        color: '#1E3A8A',
        letterSpacing: 1
      },
      docSubtitle: {
        fontSize: 10,
        bold: true,
        color: '#4B5563',
        margin: [0, 2, 0, 5]
      },
      sectionTitle: {
        fontSize: 11,
        bold: true,
        color: '#1E3A8A',
        margin: [0, 10, 0, 5],
        borderBottom: '1 solid #1E3A8A'
      },
      sectionSubTitle: {
        fontSize: 9,
        bold: true,
        color: '#1E3A8A',
        margin: [0, 5, 0, 3]
      },
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: '#FFFFFF',
        fillColor: '#1E3A8A',
        alignment: 'center'
      },
      tableExample: {
        margin: [0, 5, 0, 15]
      }
    }
  };

  // Add violations summary
  if (violations.length === 0) {
    docDefinition.content.push({
      table: {
        widths: ['100%'],
        body: [[
          {
            text: '✔ CONFORME : L\'armoire électrique est en parfaite conformité avec les prescriptions réglementaires de la NF C 15-100 après examen des calibres, chutes de tension et dimensionnement des différentiels.',
            fontSize: 9,
            color: '#047857',
            fillColor: '#D1FAE5',
            margin: [8, 8, 8, 8],
            bold: true
          }
        ]]
      },
      layout: 'noBorders'
    });
  } else {
    const listViolations = violations.map(v => ({
      text: `• [${v.severity.toUpperCase()}] ${v.message}`,
      fontSize: 8.5,
      margin: [0, 2, 0, 2],
      color: v.severity === 'error' ? '#B91C1C' : '#D97706'
    }));

    docDefinition.content.push({
      table: {
        widths: ['100%'],
        body: [[
          {
            stack: [
              { text: `⚠️ NON-CONFORMITÉS DÉTECTÉES (${violations.length} anomalie(s)) :`, bold: true, fontSize: 9, color: '#B91C1C', margin: [0, 0, 0, 5] },
              ...listViolations
            ],
            fillColor: '#FEF2F2',
            margin: [8, 8, 8, 8]
          }
        ]]
      },
      layout: 'noBorders'
    });
  }

  pdfMake.createPdf(docDefinition).download(`Note_Calcul_${cabinet.name.replace(/\s+/g, '_')}.pdf`);
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
