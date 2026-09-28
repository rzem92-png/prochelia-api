// =====================================================
// PROCHÉLIA V7 - MODULE SERVEUR ADDITIF
// =====================================================
// Version : 7.0.0
// Objectif : contrôles, conformité, sécurité,
// finances, permissions, audit et indicateurs.
//
// IMPORTANT :
// - Ne remplace aucune route existante.
// - Ne supprime aucune donnée.
// - Ne modifie pas les tables existantes.
// - Fonctionnement additif uniquement.
// =====================================================

const V7_VERSION = "7.0.0";


// =====================================================
// OUTIL DE RÉPONSE V7
// =====================================================

function v7Result(ok, data = {}, error = null) {
  return {
    ok,
    version: V7_VERSION,
    ...data,
    ...(error ? { error } : {})
  };
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
// OUTILS GÉNÉRAUX
// =====================================================

function v7Required(value) {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ""
  );
}

function v7RoleAllowed(role, allowed) {
  return (
    Array.isArray(allowed) &&
    allowed.includes(String(role || ""))
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

  if (!v7IsValidEmail(account.email)) {
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
    "BLOQUÉ"
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

  return v7Result(true, {
    email: v7NormalizeEmail(account.email)
  });
}


// =====================================================
// PERMISSIONS / RÔLES
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
    return v7Result(true, {
      role,
      permission
    });
  }

  if (
    permissions &&
    permissions[permission] === true
  ) {
    return v7Result(true, {
      role,
      permission
    });
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
// DOCUMENTS
// =====================================================

function v7CheckDocument(document) {

  if (!document) {
    return v7Result(
      false,
      {
        statut: "A_VERIFIER"
      },
      "Document absent"
    );
  }

  if (document.expiration) {

    const expiration =
      new Date(document.expiration);

    if (
      Number.isNaN(
        expiration.getTime()
      )
    ) {
      return v7Result(
        false,
        {
          statut: "DATE_INVALIDE"
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
          statut: "EXPIRE"
        },
        "Document expiré"
      );
    }
  }

  if (document.verifie !== true) {
    return v7Result(
      false,
      {
        statut: "A_VERIFIER"
      },
      "Document non vérifié"
    );
  }

  return v7Result(true, {
    statut: "CONFORME"
  });
}


// =====================================================
// EXPIRATION DES DOCUMENTS
// =====================================================

function v7CheckDateExpiration(date) {

  if (!date) {
    return {
      statut: "AUCUNE_DATE",
      joursRestants: null,
      alerte: false,
      bloque: false
    };
  }

  const target =
    new Date(date);

  const now =
    new Date();

  if (
    Number.isNaN(
      target.getTime()
    )
  ) {
    return {
      statut: "DATE_INVALIDE",
      joursRestants: null,
      alerte: true,
      bloque: true
    };
  }

  const days =
    Math.ceil(
      (target - now) /
      86400000
    );

  return {
    statut:
      days < 0
        ? "EXPIRE"
        : days <= 30
          ? "EXPIRE_BIENTOT"
          : "VALIDE",

    joursRestants: days,

    alerte:
      days <= 30,

    bloque:
      days < 0
  };
}


// =====================================================
// MOBILITÉ / TRANSPORT
// =====================================================

function v7CheckTransport(profile) {

  const documents =
    profile?.documents || {};

  const required = [
    "permis",
    "carteGrise",
    "assurance"
  ];

  const missing =
    required.filter(
      key => !documents[key]
    );

  if (missing.length) {
    return v7Result(
      false,
      {
        missing
      },
      "Documents de mobilité incomplets"
    );
  }

  const invalid =
    required.filter(key => {

      const document =
        documents[key];

      return (
        document.verifie !== true ||
        (
          document.expiration &&
          new Date(
            document.expiration
          ) < new Date()
        )
      );
    });

  if (invalid.length) {
    return v7Result(
      false,
      {
        invalid
      },
      "Documents de mobilité non vérifiés ou expirés"
    );
  }

  return v7Result(true, {
    transportAuthorized: true
  });
}


// =====================================================
// MISSION
// =====================================================

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
      String(
        mission.statut || ""
      ).toUpperCase()
    )
  ) {
    return v7Result(
      false,
      {},
      "Cette mission ne peut plus être démarrée"
    );
  }

  return v7Result(true, {
    missionId:
      mission.id || null
  });
}


// =====================================================
// QR CODE
// =====================================================

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
    String(qr.missionId) !==
      String(mission.id)
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


// =====================================================
// PAIEMENT
// =====================================================

function v7CheckPayment(payment) {

  if (!payment) {
    return v7Result(
      false,
      {},
      "
