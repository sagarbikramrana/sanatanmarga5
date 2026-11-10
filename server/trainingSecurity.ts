import crypto from "crypto";

// SEC-03 Remediation: Active signing key must come strictly from server environment.
// No fallback secret is ever used for issuing/signing new credentials.
export function getActiveTrainingSecret(): string {
  const secret = process.env.TRAINING_HMAC_SECRET || process.env.CERT_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "CREDENTIAL_SECURITY_UNCONFIGURED: Server HMAC secret is not configured in environment (TRAINING_HMAC_SECRET / CERT_SECRET_KEY). Issuance and signing failed closed."
    );
  }
  return secret;
}

export function isTrainingSecretConfigured(): boolean {
  return Boolean(process.env.TRAINING_HMAC_SECRET || process.env.CERT_SECRET_KEY);
}

// Backward compatibility: Historical secret used strictly for read-only verification
// of legacy pilot certificates issued prior to 5.0 hardening. NEVER used for issuance.
const LEGACY_FALLBACK_SECRET = "sanatan-marga-training-cryptographic-master-key-2026";

// Deprecated export for backward-compatibility if any external module reads it
export const TRAINING_HMAC_SECRET = process.env.TRAINING_HMAC_SECRET || process.env.CERT_SECRET_KEY || "";

export function normalizeCertId(id: string): string {
  if (!id) return "";
  const clean = id.trim().toLowerCase();
  const map: Record<string, string> = {
    "cert-01": "cert_reader",
    "cert-02": "cert_journalist",
    "cert-03": "cert_media_operator",
    "cert-04": "cert_sgis_researcher",
    "cert-05": "cert_academy_instructor",
    "cert-06": "cert_editor",
    "cert-07": "cert_platform_admin",
    "cert-08": "cert_commerce_manager",
    "sm-cert-rdr": "cert_reader",
    "sm-cert-jrn": "cert_journalist",
    "sm-cert-edt": "cert_editor",
    "sm-cert-med": "cert_media_operator",
    "sm-cert-sgis": "cert_sgis_researcher",
    "sm-cert-ins": "cert_academy_instructor",
    "sm-cert-com": "cert_commerce_manager",
    "sm-cert-adm": "cert_platform_admin",
    "cert_system_architect": "cert_platform_admin"
  };
  return map[clean] || clean;
}

export const CERT_METADATA: Record<string, { 
  code: string; 
  title: string; 
  titleNepali: string; 
  role: string; 
  roleNepali: string; 
  validityMonths: number; 
  minPassingScore: number; 
  trackId: string;
}> = {
  "cert_reader": { 
    code: "SM-CERT-RDR", 
    title: "SanatanMarga Certified Reader", 
    titleNepali: "सनातनमार्ग प्रमाणित पाठक", 
    role: "Reader & Civilizational Scholar", 
    roleNepali: "पाठक तथा सभ्यता अन्वेषक", 
    validityMonths: 12, 
    minPassingScore: 75, 
    trackId: "track-reader" 
  },
  "cert_journalist": { 
    code: "SM-CERT-JRN", 
    title: "Verified AI Newsroom Journalist", 
    titleNepali: "सनातनमार्ग प्रमाणित पत्रकार", 
    role: "Field Correspondent & Investigative Reporter", 
    roleNepali: "स्थलगत संवाददाता तथा खोज पत्रकार", 
    validityMonths: 12, 
    minPassingScore: 80, 
    trackId: "track-ai-newsroom" 
  },
  "cert_editor": { 
    code: "SM-CERT-EDT", 
    title: "Editorial Integrity & Governance Editor", 
    titleNepali: "सनातनमार्ग प्रमाणित सम्पादक", 
    role: "Senior Newsroom Editor & Truth Guardian", 
    roleNepali: "वरिष्ठ सम्पादक तथा तथ्य संरक्षक", 
    validityMonths: 12, 
    minPassingScore: 80, 
    trackId: "track-ai-newsroom" 
  },
  "cert_media_operator": { 
    code: "SM-CERT-MED", 
    title: "Certified Broadcast Engineer & Media Director", 
    titleNepali: "सनातनमार्ग प्रमाणित मिडिया अपरेटर", 
    role: "Broadcast Engineer & Audio/Video Director", 
    roleNepali: "प्रसारण इन्जिनियर तथा अडियो/भिडियो निर्देशक", 
    validityMonths: 12, 
    minPassingScore: 80, 
    trackId: "track-media-os" 
  },
  "cert_sgis_researcher": { 
    code: "SM-CERT-SGIS", 
    title: "SGIS Epigraphist & Manuscript Specialist", 
    titleNepali: "सनातनमार्ग प्रमाणित एसजिआइएस अनुसन्धानकर्ता", 
    role: "Manuscript Specialist & Epigraphist", 
    roleNepali: "पाण्डुलिपि विशेषज्ञ तथा अभिलेख अनुसन्धाता", 
    validityMonths: 24, 
    minPassingScore: 80, 
    trackId: "track-sgis" 
  },
  "cert_academy_instructor": { 
    code: "SM-CERT-INS", 
    title: "Sanatan Academy Certified Pedagogy Instructor", 
    titleNepali: "सनातनमार्ग प्रमाणित अकादेमी शिक्षक", 
    role: "Pedagogy Specialist & Curriculum Designer", 
    roleNepali: "शिक्षण विधि विशेषज्ञ तथा पाठ्यक्रम निर्माता", 
    validityMonths: 18, 
    minPassingScore: 80, 
    trackId: "track-academy-assessment" 
  },
  "cert_commerce_manager": { 
    code: "SM-CERT-COM", 
    title: "Cultural Merchandise & Artisan Store Administrator", 
    titleNepali: "सनातनमार्ग प्रमाणित वाणिज्य प्रबन्धक", 
    role: "Store Administrator & Artisan Liaison", 
    roleNepali: "स्टोर प्रशासक तथा शिल्पकार समन्वयकर्ता", 
    validityMonths: 12, 
    minPassingScore: 75, 
    trackId: "track-commerce-store" 
  },
  "cert_platform_admin": { 
    code: "SM-CERT-ADM", 
    title: "Platform Systems Architect & Mission Controller", 
    titleNepali: "सनातनमार्ग प्रमाणित प्रणाली प्रशासक", 
    role: "System Architect & Mission Controller", 
    roleNepali: "प्रणाली वास्तुकार तथा मिसन कन्ट्रोलर", 
    validityMonths: 24, 
    minPassingScore: 85, 
    trackId: "track-admin-mission-control" 
  }
};

export const OFFICIAL_EXAM_KEYS: Record<string, Record<string, number>> = {
  "cert_reader": { "q_rdr_1": 1, "q_rdr_2": 1, "q_rdr_3": 1, "q_rdr_4": 1, "q1": 1, "q2": 1, "q3": 1, "q4": 1 },
  "cert_journalist": { "q_jrn_1": 1, "q_jrn_2": 1, "q_jrn_3": 1, "q_jrn_4": 1, "q1": 1, "q2": 1, "q3": 1, "q4": 1 },
  "cert_editor": { "q_edt_1": 1, "q_edt_2": 1, "q_edt_3": 1, "q_edt_4": 1, "q1": 1, "q2": 1, "q3": 1, "q4": 1 },
  "cert_media_operator": { "q_med_1": 1, "q_med_2": 1, "q_med_3": 1, "q_med_4": 0, "q1": 1, "q2": 1, "q3": 1, "q4": 0 },
  "cert_sgis_researcher": { "q_sgis_1": 1, "q_sgis_2": 0, "q_sgis_3": 1, "q_sgis_4": 1, "q1": 1, "q2": 0, "q3": 1, "q4": 1 },
  "cert_academy_instructor": { "q_ins_1": 1, "q_ins_2": 1, "q_ins_3": 1, "q_ins_4": 1, "q1": 1, "q2": 1, "q3": 1, "q4": 1 },
  "cert_commerce_manager": { "q_com_1": 1, "q_com_2": 1, "q_com_3": 1, "q_com_4": 0, "q1": 1, "q2": 1, "q3": 1, "q4": 0 },
  "cert_platform_admin": { "q_adm_1": 1, "q_adm_2": 1, "q_adm_3": 1, "q_adm_4": 1, "q1": 1, "q2": 1, "q3": 1, "q4": 1 }
};

export function generateCertificateVerificationHash(
  userId: string,
  certId: string,
  issuedAt: string,
  scorePercent?: number,
  tenantId?: string
): string {
  // SEC-03: Must FAIL CLOSED if server environment secret is unconfigured
  const secret = getActiveTrainingSecret();
  const canonical = normalizeCertId(certId);
  const payload = `${userId}:${canonical}:${issuedAt}:${scorePercent ?? ""}:${tenantId ?? ""}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `0x${hmac.slice(0, 32).toUpperCase()}`;
}

export function verifyCertificateCryptographicSeal(cert: any): boolean {
  if (!cert || !cert.verificationHash) return false;
  const canonical = normalizeCertId(cert.certificationId);

  // 1. Check with authoritative configured server environment secret first
  if (isTrainingSecretConfigured()) {
    try {
      const activeSecret = getActiveTrainingSecret();
      const expectedNew = `0x${crypto.createHmac("sha256", activeSecret)
        .update(`${cert.userId}:${canonical}:${cert.issuedAt}:${cert.scorePercent ?? ""}:${cert.tenantId ?? ""}`)
        .digest("hex").slice(0, 32).toUpperCase()}`;
      if (cert.verificationHash === expectedNew) return true;

      const activeLegacy1 = `0x${crypto.createHmac("sha256", activeSecret)
        .update(`${cert.userId}:${cert.certificationId}:${cert.issuedAt}`)
        .digest("hex").slice(0, 32).toUpperCase()}`;
      if (cert.verificationHash === activeLegacy1) return true;

      const activeLegacy2 = `0x${crypto.createHmac("sha256", activeSecret)
        .update(`${cert.userId}:${canonical}:${cert.issuedAt}`)
        .digest("hex").slice(0, 32).toUpperCase()}`;
      if (cert.verificationHash === activeLegacy2) return true;
    } catch (e) {}
  }

  // 2. Safe backward-compatibility: verify pre-existing pilot certificates against legacy hash
  // (Read-only verification only; new issuance strictly rejects missing/fallback keys)
  const legacyNew = `0x${crypto.createHmac("sha256", LEGACY_FALLBACK_SECRET)
    .update(`${cert.userId}:${canonical}:${cert.issuedAt}:${cert.scorePercent ?? ""}:${cert.tenantId ?? ""}`)
    .digest("hex").slice(0, 32).toUpperCase()}`;
  if (cert.verificationHash === legacyNew) return true;

  const legacy1 = `0x${crypto.createHmac("sha256", LEGACY_FALLBACK_SECRET)
    .update(`${cert.userId}:${cert.certificationId}:${cert.issuedAt}`)
    .digest("hex").slice(0, 32).toUpperCase()}`;
  if (cert.verificationHash === legacy1) return true;

  const legacy2 = `0x${crypto.createHmac("sha256", LEGACY_FALLBACK_SECRET)
    .update(`${cert.userId}:${canonical}:${cert.issuedAt}`)
    .digest("hex").slice(0, 32).toUpperCase()}`;
  return cert.verificationHash === legacy2;
}

export function generateAuditSignature(payload: string): string {
  // SEC-03: Must FAIL CLOSED if server environment secret is unconfigured
  const secret = getActiveTrainingSecret();
  return `0x${crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 40).toUpperCase()}`;
}
