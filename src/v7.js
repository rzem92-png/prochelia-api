// =====================================================
// PROCHÉLIA V7 - MODULE SERVEUR ADDITIF
// =====================================================
// Version : 7.0.0
//
// Objectif :
// - conformité
// - sécurité
// - permissions
// - missions
// - documents
// - mobilité
// - QR
// - paiements
// - finances
// - idempotence
// - audit
// - disponibilité
// - conflits
// - tarification
// - indicateurs
//
// IMPORTANT :
// - Ne remplace aucune route existante.
// - Ne supprime aucune donnée.
// - Ne modifie aucune table.
// - Compatible avec les statuts V2 existants.
// - Fonctionnement additif uniquement.
// =====================================================

const V7_VERSION = "7.0.0";


// =====================================================
// STATUTS MISSIONS PROCHÉLIA V2
// =====================================================

const V7_MISSION_STATUSES = [
  "requested",
  "proposed",
  "confirmed",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
  "rejected"
];


// =====================================================
// TRANSITIONS AUTORISÉES
// =====================================================

const V7_MISSION_TRANSITIONS = {

  requested: [
    "proposed",
    "confirmed",
    "cancelled",
    "rejected"
  ],

  proposed: [
    "confirmed",
    "accepted",
    "cancelled",
    "rejected"
  ],

  confirmed: [
    "accepted",
    "in_progress",
    "cancelled"
  ],

  accepted: [
    "in_progress",
    "cancelled"
  ],

  in_progress: [
    "completed",
    "cancelled"
  ],

  completed: [],

  cancelled: [],

  rejected: []
};


// =====================================================
// OUTIL DE RÉPONSE V7
// =====================================================

function v7Result(
  ok,
  data = {},
  error = null
) {

  return {
    ok,
    version: V7_VERSION,
    ...data,
    ...(error ? { error } : {})
  };
}


// =====================================================
// VALEUR OBLIGATOIRE
// =====================================================

function v7Required(value) {

  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ""
  );
}


// =====================================================
// E-MAIL
// =====================================================

function v7NormalizeEmail(email) {

  return String(email || "")
    .trim()
    .toLowerCase();
}


function v7IsValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    v7NormalizeEmail(email)
  );
}


// =====================================================
// RÔLES
// =====================================================

function v7RoleAllowed(
  role,
  allowed
) {

  return (
    Array.isArray(allowed) &&
    allowed.includes(
      String(role || "")
    )
  );
}


// =====================================================
// COMPTE
// =====================================================

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

  if (
    !v7IsValidEmail(
      account.email
    )
  ) {

    return v7Result(
      false,
      {},
      "E-mail invalide"
    );
  }

  const blocked = [

    "Désactivé",
    "Suspendu",

    "DESACTIVE",
    "SUSPENDU",

    "BLOQUE",
    "BLOQUÉ",

    "blocked",
    "disabled",
    "suspended"

  ];

  const status =
    String(
      account.statut ??
      account.status ??
      ""
    );

  if (
    blocked.includes(status)
  ) {

    return v7Result(
      false,
      {},
      "Compte non actif"
    );
  }

  return v7Result(
    true,
    {
      email:
        v7NormalizeEmail(
          account.email
        )
    }
  );
}


// =====================================================
// PERMISSIONS
// =====================================================

function v7CheckPermissions({
  role,
  permission,
  permissions = {}
} = {}) {

  const administratorRoles = [

    "Gérante",
    "Administrateur",

    "gerante",
    "admin",

    "GERANTE",
    "ADMIN"
  ];

  if (
    administratorRoles.includes(
      String(role || "")
    )
  ) {

    return v7Result(
      true,
      {
        role,
        permission
      }
    );
  }

  if (
    permissions &&
    permissions[permission] === true
  ) {

    return v7Result(
      true,
      {
        role,
        permission
      }
    );
  }

  return v7Result(
    false,
    {
      role,
      permission
    },
    "Permission insuffisante"
  );
}


// =====================================================
// DOCUMENT
// =====================================================

function v7CheckDocument(
  document
) {

  if (!document) {

    return v7Result(
      false,
      {
        statut:
          "A_VERIFIER"
      },
      "Document absent"
    );
  }

  if (document.expiration) {

    const expiration =
      new Date(
        document.expiration
      );

    if (
      Number.isNaN(
        expiration.getTime()
      )
    ) {

      return v7Result(
        false,
        {
          statut:
            "DATE_INVALIDE"
        },
        "Date d'expiration invalide"
      );
    }

    if (
      expiration < new Date()
    ) {

      return v7Result(
        false,
        {
          statut:
            "EXPIRE"
        },
        "Document expiré"
      );
    }
  }

  if (
    document.verifie !== true
  ) {

    return v7Result(
      false,
      {
        statut:
          "A_VERIFIER"
      },
      "Document non vérifié"
    );
  }

  return v7Result(
    true,
    {
      statut:
        "CONFORME"
    }
  );
}


// =====================================================
// EXPIRATION
// =====================================================

function v7CheckDateExpiration(
  date
) {

  if (!date) {

    return {
      statut:
        "AUCUNE_DATE",

      joursRestants:
        null,

      alerte:
        false,

      bloque:
        false
    };
  }

  const target =
    new Date(date);

  const current =
    new Date();

  if (
    Number.isNaN(
      target.getTime()
    )
  ) {

    return {

      statut:
        "DATE_INVALIDE",

      joursRestants:
        null,

      alerte:
        true,

      bloque:
        true
    };
  }

  const days =
    Math.ceil(
      (
        target -
        current
      ) / 86400000
    );

  return {

    statut:
      days < 0
        ? "EXPIRE"
        : days <= 30
          ? "EXPIRE_BIENTOT"
          : "VALIDE",

    joursRestants:
      days,

    alerte:
      days <= 30,

    bloque:
      days < 0
  };
}


// =====================================================
// MOBILITÉ
// =====================================================

function v7CheckTransport(
  profile
) {

  const documents =
    profile?.documents || {};

  const required = [

    "permis",
    "carteGrise",
    "assurance"

  ];

  const missing =
    required.filter(
      key =>
        !documents[key]
    );

  if (
    missing.length
  ) {

    return v7Result(
      false,
      {
        missing
      },
      "Documents de mobilité incomplets"
    );
  }

  const invalid =
    required.filter(
      key => {

        const document =
          documents[key];

        if (
          document.verifie !== true
        ) {
          return true;
        }

        if (
          document.expiration
        ) {

          const expiration =
            new Date(
              document.expiration
            );

          if (
            Number.isNaN(
              expiration.getTime()
            )
          ) {
            return true;
          }

          if (
            expiration < new Date()
          ) {
            return true;
          }
        }

        return false;
      }
    );

  if (
    invalid.length
  ) {

    return v7Result(
      false,
      {
        invalid
      },
      "Documents de mobilité non vérifiés ou expirés"
    );
  }

  return v7Result(
    true,
    {
      transportAuthorized:
        true
    }
  );
}


// =====================================================
// MISSION
// =====================================================

function v7CheckMission(
  mission
) {

  if (!mission) {

    return v7Result(
      false,
      {},
      "Mission introuvable"
    );
  }

  const status =
    String(
      mission.status ??
      mission.statut ??
      ""
    ).toLowerCase();

  if (
    status === "completed" ||
    status === "cancelled" ||
    status === "rejected"
  ) {

    return v7Result(
      false,
      {
        missionId:
          mission.id || null,

        status
      },
      "Cette mission ne peut plus être démarrée"
    );
  }

  if (
    status &&
    !V7_MISSION_STATUSES.includes(
      status
    )
  ) {

    return v7Result(
      false,
      {
        missionId:
          mission.id || null,

        status
      },
      "Statut de mission inconnu"
    );
  }

  return v7Result(
    true,
    {
      missionId:
        mission.id || null,

      status:
        status || null
    }
  );
}


// =====================================================
// TRANSITION MISSION
// Compatible V2
// =====================================================

function v7CheckMissionTransition(
  currentStatus,
  nextStatus
) {

  const current =
    String(
      currentStatus || ""
    ).trim().toLowerCase();

  const next =
    String(
      nextStatus || ""
    ).trim().toLowerCase();

  if (
    !V7_MISSION_STATUSES.includes(
      current
    )
  ) {

    return v7Result(
      false,
      {
        currentStatus:
          current,

        nextStatus:
          next
      },
      "Statut actuel de mission inconnu"
    );
  }

  if (
    !V7_MISSION_STATUSES.includes(
      next
    )
  ) {

    return v7Result(
      false,
      {
        currentStatus:
          current,

        nextStatus:
          next
      },
      "Nouveau statut de mission inconnu"
    );
  }

  const allowed =
    V7_MISSION_TRANSITIONS[
      current
    ] || [];

  if (
    !allowed.includes(next)
  ) {

    return v7Result(
      false,
      {
        currentStatus:
          current,

        nextStatus:
          next
      },
      "Transition de statut non autorisée"
    );
  }

  return v7Result(
    true,
    {
      currentStatus:
        current,

      nextStatus:
        next
    }
  );
}


// =====================================================
// DISPONIBILITÉ
// =====================================================

function v7CheckAvailability({
  date,
  heureDebut,
  heureFin,
  available = true
} = {}) {

  if (!date) {

    return v7Result(
      false,
      {},
      "Date obligatoire"
    );
  }

  if (!heureDebut) {

    return v7Result(
      false,
      {},
      "Heure de début obligatoire"
    );
  }

  if (!heureFin) {

    return v7Result(
      false,
      {},
      "Heure de fin obligatoire"
    );
  }

  if (
    available !== true
  ) {

    return v7Result(
      false,
      {},
      "Créneau indisponible"
    );
  }

  return v7Result(
    true,
    {
      available:
        true,

      date,
      heureDebut,
      heureFin
    }
  );
}


// =====================================================
// CONFLIT
// =====================================================

function v7CheckConflict({
  conflict = false,
  conflicts = []
} = {}) {

  if (
    conflict === true ||
    (
      Array.isArray(
        conflicts
      ) &&
      conflicts.length > 0
    )
  ) {

    return v7Result(
      false,
      {
        conflicts
      },
      "Conflit détecté"
    );
  }

  return v7Result(
    true,
    {
      conflict:
        false
    }
  );
}


// =====================================================
// TARIFICATION
// =====================================================

function v7CheckPricing({
  amount,
  minimum = 0,
  maximum = null
} = {}) {

  const value =
    Number(amount);

  if (
    !Number.isFinite(value)
  ) {

    return v7Result(
      false,
      {},
      "Tarif invalide"
    );
  }

  if (
    value < Number(minimum)
  ) {

    return v7Result(
      false,
      {},
      "Tarif inférieur au minimum autorisé"
    );
  }

  if (
    maximum !== null &&
    value > Number(maximum)
  ) {

    return v7Result(
      false,
      {},
      "Tarif supérieur au maximum autorisé"
    );
  }

  return v7Result(
    true,
    {
      amount:
        value
    }
  );
}


// =====================================================
// QR CODE
// =====================================================

function v7CheckQr(
  mission,
  qr
) {

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
    String(
      qr.missionId
    ) !==
    String(
      mission.id
    )
  ) {

    return v7Result(
      false,
      {},
      "QR code non associé à cette mission"
    );
  }

  if (
    qr.mission_id &&
    String(
      qr.mission_id
    ) !==
    String(
      mission.id
    )
  ) {

    return v7Result(
      false,
      {},
      "QR code non associé à cette mission"
    );
  }

  return v7Result(
    true,
    {
      qrValidated:
        true
    }
  );
}


// =====================================================
// PAIEMENT
// =====================================================

function v7CheckPayment(
  payment
) {

  if (!payment) {

    return v7Result(
      false,
      {},
      "Paiement absent"
    );
  }

  const status =
    String(
      payment.status ||
      ""
    ).toUpperCase();

  const confirmed = [
    "PAID",
    "SUCCEEDED",
    "SUCCESS",
    "COMPLETED"
  ];

  if (
    !confirmed.includes(
      status
    )
  ) {

    return v7Result(
      false,
      {
        status:
          payment.status ||
          "UNKNOWN"
      },
      "Paiement non confirmé par le prestataire"
    );
  }

  return v7Result(
    true,
    {
      paymentConfirmed:
        true
    }
  );
}


// =====================================================
// CALCUL FINANCIER
// =====================================================

function v7CalculateFinance({
  clientAmount = 0,
  commissionRate = 0,
  paymentFees = 0,
  otherFees = 0
} = {}) {

  const client =
    Number(
      clientAmount
    ) || 0;

  const rate =
    Number(
      commissionRate
    ) || 0;

  const payment =
    Number(
      paymentFees
    ) || 0;

  const other =
    Number(
      otherFees
    ) || 0;

  const commission =
    client *
    rate /
    100;

  const intervenant =
    client -
    commission;

  const margin =
    commission -
    payment -
    other;

  return v7Result(
    true,
    {

      clientAmount:
        client,

      commissionRate:
        rate,

      commissionAmount:
        commission,

      intervenantAmount:
        intervenant,

      paymentFees:
        payment,

      otherFees:
        other,

      grossMargin:
        margin
    }
  );
}


// =====================================================
// IDEMPOTENCE
// =====================================================

function v7IdempotencyKey(
  value
) {

  return String(
    value || ""
  ).trim();
}


function v7CheckIdempotency(
  value
) {

  const key =
    v7IdempotencyKey(
      value
    );

  if (!key) {

    return v7Result(
      false,
      {},
      "Clé d'idempotence obligatoire"
    );
  }

  return v7Result(
    true,
    {
      idempotencyKey:
        key
    }
  );
}


// =====================================================
// AUDIT
// =====================================================

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
      Math.random()
        .toString(36)
        .slice(2, 8),

    date:
      new Date().toISOString(),

    actorId,

    actorRole,

    action:
      String(
        action ||
        "UNKNOWN"
      ),

    entity,

    entityId,

    result,

    detail
  };
}


// =====================================================
// INDICATEURS STRATÉGIQUES
// =====================================================

function v7StrategicIndicators({
  clients = 0,
  intervenants = 0,
  missions = 0,
  revenue = 0,
  cancellations = 0,
  refunds = 0
} = {}) {

  const missionCount =
    Number(
      missions
    ) || 0;

  const cancellationCount =
    Number(
      cancellations
    ) || 0;

  const cancellationRate =
    missionCount > 0
      ? (
          cancellationCount /
          missionCount
        ) * 100
      : 0;

  return {

    clients:
      Number(clients) || 0,

    intervenants:
      Number(intervenants) || 0,

    missions:
      missionCount,

    revenue:
      Number(revenue) || 0,

    cancellations:
      cancellationCount,

    refunds:
      Number(refunds) || 0,

    cancellationRate:
      Number(
        cancellationRate.toFixed(2)
      )
  };
}


// =====================================================
// PROFIL INTERVENANT
// =====================================================

function v7CheckIntervenantProfile(
  profile
) {

  if (!profile) {

    return v7Result(
      false,
      {},
      "Profil intervenant introuvable"
    );
  }

  const errors = [];

  if (
    !v7Required(
      profile.nom ??
      profile.last_name
    )
  ) {
    errors.push(
      "Nom obligatoire"
    );
  }

  if (
    !v7Required(
      profile.prenom ??
      profile.first_name
    )
  ) {
    errors.push(
      "Prénom obligatoire"
    );
  }

  const email =
    profile.email;

  if (
    email &&
    !v7IsValidEmail(
      email
    )
  ) {
    errors.push(
      "E-mail invalide"
    );
  }

  if (
    errors.length
  ) {

    return v7Result(
      false,
      {
        errors
      },
      "Profil intervenant incomplet"
    );
  }

  return v7Result(
    true,
    {
      profileValid:
        true
    }
  );
}


// =====================================================
// PRÉ-CONTRÔLE AVANT MISSION
// =====================================================

function v7PreMissionCheck({
  account,
  profile,
  mission,
  transport = false,
  documents = [],
  payment = null
} = {}) {

  const checks = [];

  if (account) {

    checks.push(
      v7CheckAccount(
        account
      )
    );
  }

  if (profile) {

    checks.push(
      v7CheckIntervenantProfile(
        profile
      )
    );
  }

  if (mission) {

    checks.push(
      v7CheckMission(
        mission
      )
    );
  }

  if (transport) {

    checks.push(
      v7CheckTransport(
        profile
      )
    );
  }

  if (
    Array.isArray(
      documents
    )
  ) {

    for (
      const document
      of documents
    ) {

      checks.push(
        v7CheckDocument(
          document
        )
      );
    }
  }

  if (payment) {

    checks.push(
      v7CheckPayment(
        payment
      )
    );
  }

  const failed =
    checks.filter(
      check =>
        check.ok !== true
    );

  if (
    failed.length
  ) {

    return v7Result(
      false,
      {
        checks,
        failed
      },
      "Contrôle préalable de mission non conforme"
    );
  }

  return v7Result(
    true,
    {
      checks,
      missionAuthorized:
        true
    }
  );
}


// =====================================================
// EXPORT PUBLIC V7
// =====================================================

export const procheliaV7 = {

  version:
    V7_VERSION,

  // E-mail
  normalizeEmail:
    v7NormalizeEmail,

  isValidEmail:
    v7IsValidEmail,

  // Général
  required:
    v7Required,

  roleAllowed:
    v7RoleAllowed,

  // Comptes
  checkAccount:
    v7CheckAccount,

  // Permissions
  checkPermissions:
    v7CheckPermissions,

  // Profils
  checkIntervenantProfile:
    v7CheckIntervenantProfile,

  // Documents
  checkDocument:
    v7CheckDocument,

  checkExpiration:
    v7CheckDateExpiration,

  // Mobilité
  checkTransport:
    v7CheckTransport,

  // Missions
  checkMission:
    v7CheckMission,

  checkMissionTransition:
    v7CheckMissionTransition,

  preMissionCheck:
    v7PreMissionCheck,

  // Disponibilité
  checkAvailability:
    v7CheckAvailability,

  // Conflits
  checkConflict:
    v7CheckConflict,

  // Tarification
  checkPricing:
    v7CheckPricing,

  // QR
  checkQr:
    v7CheckQr,

  // Paiements
  checkPayment:
    v7CheckPayment,

  calculateFinance:
    v7CalculateFinance,

  // Sécurité
  checkIdempotency:
    v7CheckIdempotency,

  // Audit
  auditEvent:
    v7AuditEvent,

  // Statistiques
  strategicIndicators:
    v7StrategicIndicators
};


// =====================================================
// EXPORT PAR DÉFAUT
// =====================================================

export default procheliaV7;
