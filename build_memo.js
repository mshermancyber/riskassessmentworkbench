const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ─── Color palette ───────────────────────────────────────────────────────────
const NAVY   = '1B2E4B';
const GOLD   = 'B8860B';
const LGRAY  = 'F2F4F7';
const MGRAY  = 'D0D4DC';
const DGRAY  = '4A5568';
const WHITE  = 'FFFFFF';
const RED    = 'C0392B';
const AMBER  = 'D4790A';
const YELLOW = 'B8860B';
const GREEN  = '1E6B3C';

// ─── Risk scoring helpers ─────────────────────────────────────────────────────
function getRes(inh, eff) {
  if (!inh || !eff) return null;
  const i = parseInt(inh.charAt(0));
  const e = parseInt(eff.charAt(0));
  return Math.min(5, Math.max(1, Math.round(i * (e / 5) * 0.8 + (i * 0.2))));
}
function scoreLabel(n) {
  if (!n) return '—';
  if (n >= 5) return 'Critical';
  if (n >= 4) return 'High';
  if (n >= 3) return 'Moderate';
  if (n >= 2) return 'Moderate-Low';
  return 'Low';
}
function scoreColor(n) {
  if (!n) return DGRAY;
  if (n >= 5) return RED;
  if (n >= 4) return AMBER;
  if (n >= 3) return YELLOW;
  return GREEN;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────
const inputPath  = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node build_memo.js <input.json> <output.docx>');
  console.error('Example: node build_memo.js sample/RA-20260510-7731_ccb_digital_lending_platform.json ./RA-20260510-7731_Risk_Memo.docx');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Error: input file not found — ${inputPath}`);
  process.exit(1);
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const { meta, subject, controls, findings } = data;

const CONTROL_META = {
  AC: 'Access Control', AU: 'Audit & Accountability', CA: 'Assessment, Authorization & Monitoring',
  CM: 'Configuration Management', CP: 'Contingency Planning', IA: 'Identification & Authentication',
  IR: 'Incident Response', MA: 'Maintenance', MP: 'Media Protection',
  PE: 'Physical & Environmental Protection', PL: 'Planning', PS: 'Personnel Security',
  PT: 'PII Processing & Transparency', RA: 'Risk Assessment', SA: 'System & Services Acquisition',
  SC: 'System & Communications Protection', SI: 'System & Information Integrity',
  SR: 'Supply Chain Risk Management'
};

const inScopeControls = Object.entries(controls)
  .filter(([, v]) => v.scope === 'yes' && v.inherent)
  .map(([id, v]) => {
    const res = getRes(v.inherent, v.effectiveness);
    return { id, name: CONTROL_META[id] || id, ...v, residual: res, residualLabel: scoreLabel(res) };
  })
  .sort((a, b) => (b.residual || 0) - (a.residual || 0));

const critCount  = inScopeControls.filter(c => c.residual >= 5).length;
const highCount  = inScopeControls.filter(c => c.residual === 4).length;
const modCount   = inScopeControls.filter(c => c.residual === 3).length;
const lowCount   = inScopeControls.filter(c => c.residual && c.residual <= 2).length;
const keyRisks   = inScopeControls.filter(c => c.residual >= 4);

const opinionMap = { satisfactory: 'SATISFACTORY', 'needs-improvement': 'NEEDS IMPROVEMENT', unsatisfactory: 'UNSATISFACTORY' };
const opinionText = opinionMap[findings.overallOpinion] || 'NEEDS IMPROVEMENT';

// ─── Shared border / cell helpers ────────────────────────────────────────────
const thinBorder  = { style: BorderStyle.SINGLE, size: 1, color: MGRAY };
const thickBorder = { style: BorderStyle.SINGLE, size: 6, color: NAVY };
const noBorder    = { style: BorderStyle.NONE, size: 0, color: WHITE };
const allThin     = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const allNone     = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function cell(children, opts = {}) {
  return new TableCell({
    borders: opts.borders || allThin,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: opts.topPad||80, bottom: opts.botPad||80, left: opts.lPad||120, right: opts.rPad||120 },
    verticalAlign: opts.vAlign || VerticalAlign.TOP,
    columnSpan: opts.span,
    children: Array.isArray(children) ? children : [children]
  });
}

function run(text, opts = {}) {
  return new TextRun({
    text,
    font: opts.font || 'Arial',
    size: opts.size || 20,
    bold: opts.bold || false,
    color: opts.color || '000000',
    italics: opts.italic || false,
    allCaps: opts.caps || false,
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 80, line: opts.line || 276 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    border: opts.border,
    children: Array.isArray(children) ? children : [children]
  });
}

function spacer(pts = 80) {
  return para([run('')], { before: 0, after: pts });
}

function sectionHeader(text) {
  return new Paragraph({
    spacing: { before: 240, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 } },
    children: [
      run(text, { bold: true, size: 22, color: NAVY, caps: true, font: 'Arial' })
    ]
  });
}

function bodyPara(text, opts = {}) {
  return para([run(text, { size: 19, color: '1A1A1A', ...opts })], { before: 0, after: 120, line: 300 });
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function buildHeader() {
  return new Header({
    children: [
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [5200, 4160],
        borders: { top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY }, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
        rows: [new TableRow({ children: [
          cell(para([run('BANKING CORP — RISK FUNCTION', { bold: true, size: 16, color: NAVY, caps: true })], { after: 0 }), { borders: allNone, width: 5200 }),
          cell(para([run('TECHNOLOGY & CYBER RISK — INDEPENDENT ASSESSMENT', { size: 15, color: DGRAY, italic: true })], { after: 0, align: AlignmentType.RIGHT }), { borders: allNone, width: 4160 })
        ]})]
      }),
      spacer(40)
    ]
  });
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 60, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
        tabStops: [{ type: TabStopType.CENTER, position: 4680 }, { type: TabStopType.RIGHT, position: 9360 }],
        children: [
          run('CONFIDENTIAL — FOR INTERNAL USE ONLY', { size: 15, color: DGRAY, italic: true }),
          new TextRun({ text: '\t', font: 'Arial', size: 15 }),
          run(meta.assessmentId, { size: 15, color: DGRAY }),
          new TextRun({ text: '\t', font: 'Arial', size: 15 }),
          run('Page ', { size: 15, color: DGRAY }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 15, color: DGRAY }),
          run(' of ', { size: 15, color: DGRAY }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 15, color: DGRAY }),
        ]
      })
    ]
  });
}

// ─── MEMO HEADER BLOCK ────────────────────────────────────────────────────────
function buildMemoHeader() {
  const rows = [
    ['TO:', `${subject.lob} Technology Risk Committee; Chief Technology Officer`],
    ['FROM:', `${subject.assessor} | Banking Corp — Risk Function`],
    ['DATE:', subject.date],
    ['RE:', `Independent Technology & Cyber Risk Assessment — ${subject.name}`],
    ['ASSESSMENT ID:', meta.assessmentId],
    ['CLASSIFICATION:', 'Confidential — Internal Distribution Only'],
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1560, 7800],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: rows.map(([label, value]) => new TableRow({ children: [
      cell(para([run(label, { bold: true, size: 19, color: NAVY })], { after: 60 }), { borders: allNone, width: 1560 }),
      cell(para([run(value, { size: 19 })], { after: 60 }), { borders: allNone, width: 7800 })
    ]}))
  });
}

// ─── OPINION BANNER ───────────────────────────────────────────────────────────
function buildOpinionBanner() {
  const fillColor = findings.overallOpinion === 'satisfactory' ? '1E6B3C' : findings.overallOpinion === 'unsatisfactory' ? 'C0392B' : 'B8860B';
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 6760],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
    rows: [new TableRow({ children: [
      cell(
        para([run('2LoD RISK OPINION', { bold: true, size: 18, color: WHITE, caps: true })], { after: 0, align: AlignmentType.CENTER }),
        { borders: allNone, fill: NAVY, width: 2600, vAlign: VerticalAlign.CENTER, topPad: 120, botPad: 120 }
      ),
      cell(
        para([run(opinionText, { bold: true, size: 22, color: WHITE, caps: true })], { after: 0, align: AlignmentType.CENTER }),
        { borders: allNone, fill: fillColor, width: 6760, vAlign: VerticalAlign.CENTER, topPad: 120, botPad: 120 }
      )
    ]})]
  });
}

// ─── RISK SUMMARY SCORECARD ───────────────────────────────────────────────────
function buildScorecard() {
  const items = [
    { label: 'Critical', count: critCount, color: RED },
    { label: 'High', count: highCount, color: AMBER },
    { label: 'Moderate', count: modCount, color: YELLOW },
    { label: 'Low / Mod-Low', count: lowCount, color: GREEN },
    { label: 'Total In Scope', count: inScopeControls.length, color: NAVY },
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1872, 1872, 1872, 1872, 1872],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: { style: BorderStyle.SINGLE, size: 1, color: MGRAY } },
    rows: [
      new TableRow({ children: items.map(item => cell(
        para([run(String(item.count), { bold: true, size: 36, color: item.color })], { after: 20, align: AlignmentType.CENTER }),
        { borders: { top: { style: BorderStyle.SINGLE, size: 12, color: item.color }, bottom: noBorder, left: noBorder, right: noBorder }, fill: LGRAY, width: 1872, topPad: 120, botPad: 40 }
      ))}),
      new TableRow({ children: items.map(item => cell(
        para([run(item.label, { bold: true, size: 17, color: DGRAY, caps: true })], { after: 0, align: AlignmentType.CENTER }),
        { borders: { top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: LGRAY }, left: noBorder, right: noBorder }, fill: LGRAY, width: 1872, topPad: 40, botPad: 100 }
      ))}),
    ]
  });
}

// ─── FULL RISK REGISTER TABLE ─────────────────────────────────────────────────
function buildRegisterTable() {
  const hdrs = ['Control ID', 'Control Family', 'Domain', 'Inherent Risk', 'Control Effectiveness', 'Residual Risk', 'Direction', 'Key Finding / Observation'];
  const widths = [680, 1500, 740, 760, 1060, 760, 780, 3080];

  const headerRow = new TableRow({
    tableHeader: true,
    children: hdrs.map((h, i) => cell(
      para([run(h, { bold: true, size: 17, color: WHITE, caps: true })], { after: 0, align: AlignmentType.CENTER }),
      { borders: allNone, fill: NAVY, width: widths[i], topPad: 100, botPad: 100, lPad: 80, rPad: 80, vAlign: VerticalAlign.CENTER }
    ))
  });

  const dataRows = inScopeControls.map((c, idx) => {
    const inh = c.inherent ? parseInt(c.inherent.charAt(0)) : null;
    const rowFill = idx % 2 === 0 ? WHITE : LGRAY;
    const dirColor = c.direction === 'Deteriorating' ? RED : c.direction === 'Improving' ? GREEN : DGRAY;

    return new TableRow({ children: [
      cell(para([run(c.id, { bold: true, size: 17, color: NAVY })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: rowFill, width: widths[0], vAlign: VerticalAlign.CENTER }),
      cell(para([run(c.name, { size: 17 })], { after: 0 }), { borders: allThin, fill: rowFill, width: widths[1] }),
      cell(para([run(c.domain||'—', { size: 17, color: DGRAY })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: rowFill, width: widths[2], vAlign: VerticalAlign.CENTER }),
      cell(para([run(inh ? scoreLabel(inh) : '—', { bold: true, size: 17, color: scoreColor(inh) })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: rowFill, width: widths[3], vAlign: VerticalAlign.CENTER }),
      cell(para([run(c.effectiveness ? c.effectiveness.split(' — ')[1] || c.effectiveness : '—', { size: 16, color: DGRAY })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: rowFill, width: widths[4], vAlign: VerticalAlign.CENTER }),
      cell(para([run(c.residualLabel, { bold: true, size: 17, color: scoreColor(c.residual) })], { after: 0, align: AlignmentType.CENTER }), { borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: { style: BorderStyle.SINGLE, size: 6, color: scoreColor(c.residual) } }, fill: rowFill, width: widths[5], vAlign: VerticalAlign.CENTER }),
      cell(para([run(c.direction||'—', { size: 16, color: dirColor, italic: c.direction === 'Deteriorating' })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: rowFill, width: widths[6], vAlign: VerticalAlign.CENTER }),
      cell(para([run(c.finding||'—', { size: 16, color: '1A1A1A' })], { after: 0, line: 260 }), { borders: allThin, fill: rowFill, width: widths[3080] }),
    ]});
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows]
  });
}

// ─── KEY RISKS DETAIL TABLE ───────────────────────────────────────────────────
function buildKeyRisksTable() {
  const rows = [];
  keyRisks.forEach(c => {
    rows.push(new TableRow({ children: [
      cell(
        para([run(`${c.id} — ${c.name}`, { bold: true, size: 19, color: WHITE })], { after: 0 }),
        { borders: allNone, fill: NAVY, width: 9360, span: 3, topPad: 100, botPad: 100 }
      )
    ]}));
    rows.push(new TableRow({ children: [
      cell([
        para([run('Inherent Risk', { bold: true, size: 16, color: NAVY, caps: true })], { after: 20 }),
        para([run(c.inherent ? scoreLabel(parseInt(c.inherent.charAt(0))) : '—', { bold: true, size: 20, color: scoreColor(parseInt(c.inherent?.charAt(0))) })], { after: 0 })
      ], { borders: allThin, fill: LGRAY, width: 1560, vAlign: VerticalAlign.CENTER }),
      cell([
        para([run('Control Effectiveness', { bold: true, size: 16, color: NAVY, caps: true })], { after: 20 }),
        para([run(c.effectiveness ? c.effectiveness.split(' — ')[1] || c.effectiveness : '—', { size: 18, color: DGRAY })], { after: 0 })
      ], { borders: allThin, fill: LGRAY, width: 1560, vAlign: VerticalAlign.CENTER }),
      cell([
        para([run('Residual Risk', { bold: true, size: 16, color: NAVY, caps: true })], { after: 20 }),
        para([run(c.residualLabel, { bold: true, size: 20, color: scoreColor(c.residual) })], { after: 0 })
      ], { borders: allThin, fill: LGRAY, width: 1560, vAlign: VerticalAlign.CENTER }),
    ]}));
    rows.push(new TableRow({ children: [
      cell([
        para([run('Finding / Observation', { bold: true, size: 16, color: NAVY, caps: true })], { after: 30 }),
        para([run(c.finding || '—', { size: 18, color: '1A1A1A' })], { after: 0, line: 300 })
      ], { borders: { top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 6, color: MGRAY }, left: noBorder, right: noBorder }, fill: WHITE, width: 9360, span: 3, topPad: 100, botPad: 120 })
    ]}));
    rows.push(new TableRow({ children: [
      cell(para([run('')], { after: 0 }), { borders: allNone, fill: WHITE, width: 9360, span: 3, topPad: 40, botPad: 40 })
    ]}));
  });

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows
  });
}

// ─── MANAGEMENT ACTIONS TABLE ─────────────────────────────────────────────────
function buildActionsTable() {
  const actions = findings.managementActions
    .split(/\d+\.\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const rows = [
    new TableRow({ children: [
      cell(para([run('#', { bold: true, size: 17, color: WHITE, caps: true })], { after: 0, align: AlignmentType.CENTER }), { borders: allNone, fill: NAVY, width: 400, topPad: 80, botPad: 80 }),
      cell(para([run('Required Management Action', { bold: true, size: 17, color: WHITE, caps: true })], { after: 0 }), { borders: allNone, fill: NAVY, width: 7360, topPad: 80, botPad: 80 }),
      cell(para([run('Priority', { bold: true, size: 17, color: WHITE, caps: true })], { after: 0, align: AlignmentType.CENTER }), { borders: allNone, fill: NAVY, width: 1600, topPad: 80, botPad: 80 }),
    ]}),
    ...actions.map((action, i) => {
      const priority = i < 2 ? ['Pre-Launch', RED] : i < 4 ? ['Pre-Launch', AMBER] : ['60 Days', YELLOW];
      return new TableRow({ children: [
        cell(para([run(String(i + 1), { bold: true, size: 20, color: NAVY })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: i % 2 === 0 ? WHITE : LGRAY, width: 400, vAlign: VerticalAlign.CENTER }),
        cell(para([run(action, { size: 18 })], { after: 0, line: 300 }), { borders: allThin, fill: i % 2 === 0 ? WHITE : LGRAY, width: 7360 }),
        cell(para([run(priority[0], { bold: true, size: 17, color: priority[1] })], { after: 0, align: AlignmentType.CENTER }), { borders: allThin, fill: i % 2 === 0 ? WHITE : LGRAY, width: 1600, vAlign: VerticalAlign.CENTER }),
      ]});
    })
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [400, 7360, 1600],
    rows
  });
}

// ─── DOCUMENT ─────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 20 } } }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    headers: { default: buildHeader() },
    footers: { default: buildFooter() },
    children: [

      // ── MEMORANDUM TITLE ──
      para([run('INTERNAL MEMORANDUM', { bold: true, size: 32, color: NAVY, caps: true })], { align: AlignmentType.CENTER, after: 0 }),
      para([run('Second Line of Defense — Independent Risk Assessment', { size: 20, color: DGRAY, italic: true })], { align: AlignmentType.CENTER, after: 200 }),
      new Paragraph({ spacing: { before: 0, after: 160 }, border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: NAVY, space: 2 } }, children: [] }),
      spacer(120),

      // ── MEMO HEADER ──
      buildMemoHeader(),
      spacer(160),

      // ── OPINION BANNER ──
      buildOpinionBanner(),
      spacer(200),

      // ── 1. EXECUTIVE SUMMARY ──
      sectionHeader('1.  Executive Summary'),
      spacer(60),
      bodyPara(`This memorandum presents the independent second line of defense (2LoD) technology and cybersecurity risk assessment of the ${subject.name}, a ${subject.assessmentType.toLowerCase()} submitted by ${subject.lob} Technology. The assessment was conducted in accordance with the firm's Operational Risk Management Framework and evaluated the system's control environment against the NIST Special Publication 800-53 (Rev. 5) control families.`),
      bodyPara(`The assessment covered ${inScopeControls.length} control families and identified ${critCount + highCount} control areas rated at High or Critical residual risk. The 2LoD risk opinion for this initiative is ${opinionText}. Management action is required to address identified control gaps prior to the planned Q3 2026 production launch.`),
      bodyPara(subject.description),
      spacer(80),

      // ── 2. RISK PROFILE SUMMARY ──
      sectionHeader('2.  Risk Profile Summary'),
      spacer(80),
      buildScorecard(),
      spacer(160),

      // ── 3. SCOPE & METHODOLOGY ──
      sectionHeader('3.  Assessment Scope & Methodology'),
      spacer(60),
      bodyPara(`Assessment Type: ${subject.assessmentType}    |    Environment: ${subject.environment}    |    Data Classification: ${subject.dataClassification}`),
      bodyPara('This assessment was conducted by the Banking Corp Risk Function as an independent 2LoD review. The evaluation encompassed review of control documentation, architecture artifacts, configuration evidence, and interviews with 1LoD Technology and Technology Risk Control personnel. Control effectiveness ratings reflect evidence reviewed at the time of assessment and are subject to revision as additional evidence is provided.'),
      bodyPara('Risk ratings are assigned on a 1–5 scale (Low through Critical) for inherent risk and control effectiveness. Residual risk is computed as a function of inherent risk adjusted for control effectiveness. The overall risk opinion reflects the aggregate residual risk profile, the severity of open control gaps, and the regulatory environment applicable to the platform.'),
      spacer(80),

      // ── PAGE BREAK before register ──
      new Paragraph({ children: [new PageBreak()] }),

      // ── 4. FULL RISK REGISTER ──
      sectionHeader('4.  NIST 800-53 Control Family Risk Register'),
      spacer(80),
      buildRegisterTable(),
      spacer(200),

      // ── PAGE BREAK before key risks ──
      new Paragraph({ children: [new PageBreak()] }),

      // ── 5. KEY RISK FINDINGS ──
      sectionHeader(`5.  Key Risk Findings (Critical & High Residual — ${keyRisks.length} Control Families)`),
      spacer(80),
      buildKeyRisksTable(),
      spacer(80),

      // ── 6. THEMATIC OBSERVATIONS ──
      sectionHeader('6.  Thematic Control Observations'),
      spacer(60),
      bodyPara(findings.observations),
      spacer(80),

      // ── 7. REGULATORY CONSIDERATIONS ──
      sectionHeader('7.  Regulatory Considerations'),
      spacer(60),
      bodyPara(findings.regulatoryNotes),
      spacer(80),

      // ── 8. EMERGING RISK FACTORS ──
      sectionHeader('8.  Emerging Risk Factors'),
      spacer(60),
      bodyPara(findings.emergingRisk),
      spacer(80),

      // ── 9. MANAGEMENT ACTIONS ──
      sectionHeader('9.  Required Management Actions'),
      spacer(60),
      bodyPara('The following management actions are required to be addressed by 1LoD Technology in accordance with the timelines specified. The Risk Function will track completion of these actions and reserves the right to escalate unresolved gaps to the Technology Risk Committee.'),
      spacer(80),
      buildActionsTable(),
      spacer(200),

      // ── 10. CONCLUSION ──
      sectionHeader('10.  Conclusion & 2LoD Opinion'),
      spacer(60),
      bodyPara(`Based on the findings of this independent assessment, the Banking Corp Risk Function assigns a risk opinion of ${opinionText} to the ${subject.name} initiative. This opinion reflects the presence of ${critCount} Critical and ${highCount} High residual risk findings across the NIST 800-53 control families evaluated.`),
      bodyPara('Where foundational controls are well-implemented, the platform demonstrates sound use of cloud-native security services for Configuration Management, Audit & Accountability, and Physical & Environmental controls. However, material gaps in Contingency Planning, Supply Chain Risk Management, PII/PFI transparency, and authentication controls must be remediated before proceeding to production launch.'),
      bodyPara('This opinion is issued as of the assessment date noted above and is subject to revision upon receipt of updated evidence. The Risk Function reserves the right to issue a revised opinion or escalate to the Technology Risk Committee if required management actions are not completed within stated timelines.'),
      spacer(160),

      // ── SIGNATURE BLOCK ──
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4680, 4680],
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder },
        rows: [new TableRow({ children: [
          cell([
            para([run('Issued by:', { size: 17, color: DGRAY })], { after: 40 }),
            para([run(subject.assessor, { bold: true, size: 20, color: NAVY })], { after: 20 }),
            para([run('Banking Corp — Risk Function', { size: 17, color: DGRAY })], { after: 20 }),
            para([run('Technology & Cyber Risk — 2nd Line of Defense', { size: 17, color: DGRAY })], { after: 0 }),
          ], { borders: { top: noBorder, bottom: noBorder, left: noBorder, right: { style: BorderStyle.SINGLE, size: 4, color: MGRAY } }, fill: WHITE, width: 4680 }),
          cell([
            para([run('Assessment Reference:', { size: 17, color: DGRAY })], { after: 40 }),
            para([run(meta.assessmentId, { bold: true, size: 20, color: NAVY })], { after: 20 }),
            para([run(`Assessment Date: ${subject.date}`, { size: 17, color: DGRAY })], { after: 20 }),
            para([run(`LOB: ${subject.lob}`, { size: 17, color: DGRAY })], { after: 0 }),
          ], { borders: allNone, fill: WHITE, width: 4680, lPad: 200 }),
        ]})]
      }),
      spacer(160),
      new Paragraph({
        spacing: { before: 60, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: MGRAY } },
        children: [run('CONFIDENTIAL — This document is intended solely for the named recipients and contains non-public risk assessment information. Distribution, reproduction, or disclosure to any other party is prohibited without prior written authorization from the Risk Function.', { size: 15, color: DGRAY, italic: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log(`Done — memo written to ${outputPath}`);
});
