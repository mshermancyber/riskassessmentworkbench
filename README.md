# riskassessmentworkbench
Independent 2LoD tech &amp; cyber risk assessment workbench aligned to NIST SP 800-53 Rev. 5. Covers 18 control families with inherent/residual scoring, generates a color-coded risk register, and exports a print-ready formal risk opinion memo. JSON import/export for versioning. Built to reflect real financial services 2LoD governance workflows.

Overview
A browser-based, zero-dependency risk assessment workbench that walks a 2LoD risk officer through a structured independent technology and cybersecurity risk assessment aligned to NIST SP 800-53 (Rev. 5) control families. Produces a risk register with inherent/residual scoring and a print-ready formal risk opinion memo.
This is a portfolio project demonstrating 2LoD risk governance methodology, not a production enterprise tool.

Features

5-step guided assessment workflow — Subject intake, NIST 800-53 control scoring, findings capture, risk register, executive summary
18 NIST 800-53 control families — Full Rev. 5 coverage across Cyber, Data, Infrastructure, Application, Governance, and Resilience domains
Residual risk engine — Auto-calculates residual risk from inherent rating × control effectiveness with live color-coded indicator bars
Independent Risk Register — Sorted by residual severity, color-coded Critical/High/Moderate/Low
Formal Risk Opinion Memo export — Generates a print-ready HTML memo styled to bank risk management standards; opens in new tab for browser Print → Save as PDF
JSON export/import — Full assessment state serialized to JSON for versioning, sharing, and re-editing; round-trip load restores all fields and scores
Node.js docx generator — Offline script produces a fully formatted Word memo from any assessment JSON
Sample assessment file — Realistic NBI assessment for a cloud-native lending platform included for testing


Project Structure
2lod-risk-workbench/
├── index.html              # Main application (self-contained, no build step)
├── build_memo.js           # Node.js docx memo generator (offline/CI use)
├── sample/
│   └── RA-20260510-7731.json   # Sample assessment — Digital Lending Platform NBI
├── .gitignore
└── README.md

Usage
Web App
The workbench is fully self-contained in index.html. No build step, no npm install, no server required.
bashgit clone https://github.com/mshermancyber/2lod-risk-workbench
cd 2lod-risk-workbench
open index.html        # macOS
xdg-open index.html    # Linux
Or serve locally:
bashpython3 -m http.server 8080
# open http://localhost:8080
Load the Sample Assessment

Open index.html
Click Load JSON in the header
Select sample/RA-20260510-7731.json
Navigate through all 5 steps
On Step 5 click Export as Formal Risk Opinion Memo → browser Print → Save as PDF

Export / Import Workflow

Export JSON — saves full assessment state as a timestamped JSON file named {ASSESSMENT-ID}.json
Load JSON — restores all fields, control scores, and findings; all steps marked complete; jump to any step to edit
JSON files are version-control friendly and suitable for storage in a risk management repository

Offline Docx Generation (Node.js)
Generates a fully formatted .docx memo from any assessment JSON using the docx library.
bashnpm install docx
node build_memo.js sample/RA-20260510-7731.json ./RA-20260510-7731_Risk_Memo.docx

Assessment Methodology
Risk Scoring
DimensionScaleDescriptionInherent Risk1–5Risk absent any controls (Low → Critical)Control Effectiveness1–5Effectiveness of existing controls (Highly Effective → Ineffective)Residual Risk1–5Computed: round(inherent × (effectiveness/5) × 0.8 + (inherent × 0.2))
Lines of Business
LOBDescriptionRetail BankConsumer-facing banking products and servicesInvestment BankCapital markets, trading, and advisoryWealth ManagementPrivate banking and asset managementCorporate BankCommercial lending and transaction bankingFirmwideEnterprise technology and shared services
NIST 800-53 Control Families Covered
IDControl FamilyDomainACAccess ControlCyberAUAudit & AccountabilityCyberCAAssessment, Authorization & MonitoringGovernanceCMConfiguration ManagementInfrastructureCPContingency PlanningResilienceIAIdentification & AuthenticationCyberIRIncident ResponseCyberMAMaintenanceInfrastructureMPMedia ProtectionDataPEPhysical & Environmental ProtectionInfrastructurePLPlanningGovernancePSPersonnel SecurityGovernancePTPII Processing & TransparencyDataRARisk AssessmentGovernanceSASystem & Services AcquisitionApplicationSCSystem & Communications ProtectionCyberSISystem & Information IntegrityApplicationSRSupply Chain Risk ManagementGovernance
Assessment Types Supported

New Business Initiative (NBI)
Periodic Risk Review
Targeted Control Assessment
Strategic Business Risk Review
Regulatory Impact Assessment


Sample Assessment
The included sample (sample/RA-20260510-7731.json) models an NBI assessment of a cloud-native consumer lending platform:

System: Digital Lending Platform
LOB: Retail Bank
Environment: Cloud (AWS)
Data Classification: Highly Confidential — PII/PFI
Key findings: Untested cloud DR, incomplete third-party risk assessments, ML model explainability gaps, partial MFA coverage on inference APIs
Opinion: Needs Improvement — 3 Critical, 5 High residual risk findings


JSON Schema
json{
  "meta": {
    "assessmentId": "RA-YYYYMMDD-XXXX",
    "exportedAt": "ISO 8601 timestamp",
    "version": "2.0"
  },
  "subject": {
    "name": "string",
    "lob": "Retail Bank | Investment Bank | Wealth Management | Corporate Bank | Firmwide",
    "assessmentType": "string",
    "dataClassification": "string",
    "environment": "string",
    "assessor": "string",
    "date": "string",
    "description": "string"
  },
  "controls": {
    "AC": {
      "inherent": "4 — High",
      "effectiveness": "3 — Partially Effective",
      "direction": "Stable | Improving | Deteriorating | Insufficient Data",
      "scope": "yes | no",
      "finding": "string"
    }
  },
  "findings": {
    "observations": "string",
    "regulatoryNotes": "string",
    "emergingRisk": "string",
    "overallOpinion": "satisfactory | needs-improvement | unsatisfactory",
    "managementActions": "string"
  }
}

Related Portfolio Projects
ProjectDescriptionWaldoHuntGuided SPL generator for insider threat detection, CERT framework-alignedDLP Coverage WebInteractive 3D DLP policy coverage mapping toolepss_risk_metricKRI/KPI vulnerability risk metrics generator with EPSS + CISA KEV integration

Author
Mark Sherman — Cyber Security Specialist, 19+ years in financial services risk governance

GitHub: @mshermancyber
LinkedIn: mshermancyber


License
GPL-3.0 — see LICENSE

This is a portfolio and educational project. It does not represent the views or methodologies of any employer, past or present.
