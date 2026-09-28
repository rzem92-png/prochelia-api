// PROCHÉLIA V7 - MODULE SERVEUR ADDITIF
// Ce fichier ne remplace aucune route existante.
// Il fournit uniquement les contrôles V7 qui seront branchés ensuite.

const V7_VERSION = "7.0.0";

function v7Result(ok, data = {}, error = null) {
  return {
    ok,
    version: V7_VERSION,
    ...data,
    ...(error ? { error } : {})
  };
}

function v7NormalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function v7IsValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    v7NormalizeEmail(email)
  );
}

function v7Required(value) {
  return value !== undefined &&
    value !== null &&
    String(value).trim() !== "";
}

function v7RoleAllowed(role, allowed) {
  return Array.isArray(allowed) &&
    allowed.includes(String(role || ""));
}

function v7IdempotencyKey(value) {
  return String(value || "").trim();
}

function v7CheckIdempotency(value) {
  const key = v7IdempotencyKey(value);

  if (!key) {
    return v7Result(
      false,
      {},
      "Clé d'idempotence obligatoire"
    );
  }

  return v7Result(true, {
    idempotencyKey: key
  });
}

function v7CheckMission(mission) {
  if (!mission) {
    return v7Result(
      false,
      {},
      "Mission introuvable"
    );
  }

  const blocked = [
    "ANNULEE",
    "ANNULÉE",
    "TERMINEE",
    "TERMINÉE"
  ];

  if (
    blocked.includes(
      String(mission.statut || "").toUpperCase()
    )
  ) {
    return v7Result(
      false,
      {},
      "Cette mission ne peut plus être démarrée"
    );
  }

  return v7Result(true);
}

function v7CheckTransport(profile) {
  const documents = profile?.documents || {};

  const required = [
    "permis",
    "carteGrise",
    "assurance"
  ];

  const missing = required.filter(
    key => !documents[key]
  );

  if (missing.length) {
    return v7Result(
      false,
      { missing },
      "Documents de mobilité incomplets"
    );
  }

  const invalid = required.filter(key => {
    const document = documents[key];

    return (
      document.verifie !== true ||
      (
        document.expiration &&
        new Date(document.expiration) < new Date()
      )
    );
  });

  if (invalid.length) {
    return v7Result(
      false,
      { invalid },
      "Documents de mobilité non vérifiés ou expirés"
    );
  }

  return v7Result(true, {
    transportAuthorized: true
  });
}

function v7CheckDocument(document) {
  if (!document) {
    return v7Result(
      false,
      { statut: "A_VERIFIER" },
      "Document absent"
    );
  }

  if (document.expiration) {
    const expiration = new Date(
      document.expiration
    );

    if (expiration < new Date()) {
      return v7Result(
        false,
        { statut: "EXPIRE" },
        "Document expiré"
      );
    }
  }

  if (document.verifie !== true) {
    return v7Result(
      false,
      { statut: "A_VERIFIER" },
      "Document non vérifié"
    );
  }

  return v7Result(true, {
    statut: "CONFORME"
  });
}

function v7CheckQr(mission, qr) {
  if (!mission) {
    return v7Result(
      false,
      {},
      "Mission introuvable"
    );
  }

  if (!qr) {
    return v7Result(
      false,
      {},
      "QR code absent"
    );
  }

  if (
    qr.missionId &&
    String(qr.missionId) !== String(mission.id)
  ) {
    return v7Result(
      false,
      {},
      "QR code non associé à cette mission"
    );
  }

  return v7Result(true, {
    qrValidated: true
  });
}

function v7CalculateFinance({
  clientAmount = 0,
  commissionRate = 0,
  paymentFees = 0,
  otherFees = 0
} = {}) {
  const client = Number(clientAmount) || 0;
  const rate = Number(commissionRate) || 0;
  const payment = Number(paymentFees) || 0;
  const other = Number(otherFees) || 0;

  const commission =
    client * rate / 100;

  const intervenant =
    client - commission;

  const margin =
    commission -
    payment -
    other;

  return v7Result(true, {
    clientAmount: client,
    commissionRate: rate,
    commissionAmount: commission,
    intervenantAmount: intervenant,
    paymentFees: payment,
    otherFees: other,
    grossMargin: margin
  });
}

function v7CheckPayment(payment) {
  if (!payment) {
    return v7Result(
      false,
      {},
      "Paiement absent"
    );
  }

  if (
    payment.status !== "PAID" &&
    payment.status !== "SUCCEEDED"
  ) {
    return v7Result(
      false,
      { status: payment.status || "UNKNOWN" },
      "Paiement non confirmé par le prestataire"
    );
  }

  return v7Result(true, {
    paymentConfirmed: true
  });
}

function v7CheckPermissions({
  role,
  permission,
  permissions = {}
} = {}) {
  if (
    role === "Gérante" ||
    role === "Administrateur" ||
    role === "gerante" ||
    role === "admin"
  ) {
    return v7Result(true);
  }

  if (
    permissions &&
    permissions[permission] === true
  ) {
    return v7Result(true);
  }

  return v7Result(
    false,
    {},
    "Permission insuffisante"
  );
}

function v7CheckAccount(account) {
  if (!account) {
    return v7Result(
      false,
      {},
      "Compte introuvable"
    );
  }

  if (!v7Required(account.email)) {
    return v7Result(
      false,
      {},
      "E-mail obligatoire"
    );
  }

  if (!v7IsValidEmail(account.email)) {
    return v7Result(
      false,
      {},
      "E-mail invalide"
    );
  }

  const blocked = [
    "Désactivé",
    "Suspendu"
  ];

  if (
    blocked.includes(
      String(account.statut || "")
    )
  ) {
    return v7Result(
      false,
      {},
      "Compte non actif"
    );
  }

  return v7Result(true);
}

function v7CheckDateExpiration(date) {
  if (!date) {
    return {
      statut: "AUCUNE_DATE",
      joursRestants: null,
      alerte: false,
      bloque: false
    };
  }

  const target = new Date(date);
  const now = new Date();

  if (Number.isNaN(target.getTime())) {
    return {
      statut: "DATE_INVALIDE",
      joursRestants: null,
      alerte: true,
      bloque: true
    };
  }

  const days = Math.ceil(
    (target - now) / 86400000
  );

  return {
    statut:
      days < 0
        ? "EXPIRE"
        : days <= 30
          ? "EXPIRE_BIENTOT"
          : "VALIDE",
    joursRestants: days,
    alerte: days <= 30,
    bloque: days < 0
  };
}

function v7AuditEvent({
  actorId = null,
  actorRole = null,
  action,
  entity = null,
  entityId = null,
  result = "OK",
  detail = null
} = {}) {
  return {
    id:
      "AUD-" +
      Date.now() +
      "-" +
      Math.random().toString(36).slice(2, 8),
    date: new Date().toISOString(),
    actorId,
    actorRole,
    action: String(action || "UNKNOWN"),
    entity,
    entityId,
    result,
    detail
  };
}

function v7StrategicIndicators({
  clients = 0,
  intervenants = 0,
  missions = 0,
  revenue = 0,
  cancellations = 0,
  refunds = 0
} = {}) {
  const missionCount = Number(missions) || 0;
  const cancellationCount =
    Number(cancellations) || 0;

  const cancellationRate =
    missionCount > 0
      ? cancellationCount / missionCount * 100
      : 0;

  return {
    clients: Number(clients) || 0,
    intervenants: Number(intervenants) || 0,
    missions: missionCount,
    revenue: Number(revenue) || 0,
    cancellations: cancellationCount,
    refunds: Number(refunds) || 0,
    cancellationRate:
      Number(cancellationRate.toFixed(2))
  };
}

export const procheliaV7 = {
  version: V7_VERSION,

  normalizeEmail: v7NormalizeEmail,
  isValidEmail: v7IsValidEmail,

  checkAccount: v7CheckAccount,
  checkPermissions: v7CheckPermissions,

  checkMission: v7CheckMission,
  checkTransport: v7CheckTransport,

  checkDocument: v7CheckDocument,
  checkExpiration: v7CheckDateExpiration,

  checkQr: v7CheckQr,

  calculateFinance: v7CalculateFinance,
  checkPayment: v7CheckPayment,

  checkIdempotency: v7CheckIdempotency,

  auditEvent: v7AuditEvent,

  strategicIndicators: v7StrategicIndicators
};

export default procheliaV7;
