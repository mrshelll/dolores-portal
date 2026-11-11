// Every string a person reads on the page, in Spanish and addressing the reader as «tú» (FUN-45). Nothing internal
// (a pain id, a territory slug, tier, lente, score…) may appear here: tests/unit/text.test.mjs checks it.
// The only visible text outside this file is index.html's fallback, which must work when no module loads.

export const T = Object.freeze({
  brand: "dolores",
  brandHome: "dolores, ir al inicio",
  pageTitle: "{title} · dolores",

  // Sign-in: the email.
  signInPageTitle: "Entrar",
  signInTitle: "Entra con tu correo",
  signInLead: "Aquí ves los dolores de la semana y decides con tu equipo cuáles trabajar.",
  emailLabel: "Tu correo",
  emailHint: "Usa el correo con el que estás en el equipo.",
  sendCode: "Enviarme el código",
  sending: "Enviando…",
  haveCode: "Ya tengo un código",
  emailRequired: "Escribe tu correo para recibir el código.",
  emailInvalid: "Ese correo no parece completo. Revisa que tenga @ y un dominio, como nombre@empresa.com.",
  stepsTitle: "Entras en tres pasos",
  step1: "Escribe tu correo.",
  step2: "Te llega un correo con un código de {length} números.",
  step3: "Escribe el código aquí y verás los dolores de la semana.",

  // Sign-in: the code.
  codeTitle: "Escribe el código",
  codeSentTo: "Te enviamos un código de {length} números a {email}. Puede tardar un minuto; si no lo ves, revisa el correo no deseado.",
  codeLabel: "Código de {length} números",
  verify: "Entrar",
  verifying: "Comprobando…",
  codeIncomplete: "Faltan números: el código tiene {length}.",
  codeExpired: "Ese código no sirve: está mal escrito o ya venció. Revísalo o pide uno nuevo.",
  codeInvalid: "Ese código no es válido. Copia los {length} números del último correo que te llegó.",
  tooManyAttempts: "Hubo demasiados intentos. Espera un minuto y vuelve a intentarlo.",
  rateLimitSend: "Ya te enviamos un código hace poco. Puedes pedir otro en {seconds} segundos.",
  emailCap: "Se enviaron muchos códigos en la última hora. Vuelve a intentarlo más tarde.",
  resendIn: "Puedes pedir otro código en {seconds} segundos.",
  resend: "Enviar otro código",
  codeResent: "Te enviamos otro código.",
  useOtherEmail: "Usar otro correo",

  // Errors and the session.
  networkError: "No hay conexión. Revisa tu internet y vuelve a intentarlo.",
  otherError: "Algo falló de nuestro lado. Vuelve a intentarlo en un momento.",
  sessionExpired: "Tu sesión terminó. Vuelve a entrar.",
  signOut: "Salir",
  signedOutOffline: "Saliste en este dispositivo. No había conexión, pero no tienes que hacer nada más.",
  retry: "Reintentar",

  // Access.
  checkingAccess: "Comprobando tu acceso…",
  accessErrorTitle: "No pudimos abrir la página",
  accessError: "No pudimos comprobar tu acceso. Revisa tu conexión y vuelve a intentarlo.",
  noAccessTitle: "No tienes acceso",
  noAccess: "Esta página es solo para el equipo de dolores. Si deberías entrar, pídele a Miguel que agregue tu correo.",
  signedInAs: "Entraste como {email}.",

  // Home: the week's pains.
  homeTitle: "Dolores de la semana",
  homeLoading: "Cargando los dolores…",
  emptyReviewedOne: "Revisamos 1 publicación y no trajo ningún dolor. La próxima revisión es el lunes.",
  emptyReviewedOneTopic: "Revisamos 1 publicación sobre «{topic}» y no trajo ningún dolor. La próxima revisión es el lunes.",
  emptyReviewedMany: "Revisamos {count} publicaciones y ninguna trajo un dolor. La próxima revisión es el lunes.",
  emptyReviewedManyTopic: "Revisamos {count} publicaciones sobre «{topic}» y ninguna trajo un dolor. La próxima revisión es el lunes.",
  emptyNoRun: "Todavía no hay ninguna revisión. La primera es el lunes.",
  emptyNoItems: "Esta semana no apareció ningún dolor. La próxima revisión es el lunes.",
  emptyNoItemsLatest: "En la última revisión no apareció ningún dolor. La próxima revisión es el lunes.",
  emptyUnfinished: "La revisión de esta semana no terminó, así que no hay dolores nuevos. La próxima revisión es el lunes.",
  emptyUnfinishedLatest: "La última revisión no terminó, así que no hay dolores nuevos. La próxima revisión es el lunes.",
  homeOnlyDiscarded: "No hay dolores activos esta semana. Los descartados están abajo.",
  homeOnlyDiscardedLatest: "No hay dolores activos. Los descartados están abajo.",
  reload: "Volver a cargar",
  homeError: "No pudimos cargar los dolores. Vuelve a intentarlo en un momento.",
  weekNone: "Esta semana ningún dolor tiene peso suficiente para trabajar.",
  weekOne: "Esta semana hay 1 dolor con peso para trabajar.",
  weekMany: "Esta semana hay {count} dolores con peso para trabajar.",
  pastNone: "En esa revisión no hubo ningún dolor con peso para trabajar.",
  pastOne: "En esa revisión hubo 1 dolor con peso para trabajar.",
  pastMany: "En esa revisión hubo {count} dolores con peso para trabajar.",
  lastNone: "En la última revisión no hubo ningún dolor con peso para trabajar.",
  lastOne: "En la última revisión hubo 1 dolor con peso para trabajar.",
  lastMany: "En la última revisión hubo {count} dolores con peso para trabajar.",
  reviewedOne: "Revisamos 1 publicación.",
  reviewedOneTopic: "Revisamos 1 publicación sobre «{topic}».",
  reviewedMany: "Revisamos {count} publicaciones.",
  reviewedManyTopic: "Revisamos {count} publicaciones sobre «{topic}».",
  runFailed: "La revisión de esta semana falló. Ves la lista de la última revisión que terminó.",
  runIncomplete: "La revisión de esta semana quedó incompleta: puede faltar algún dolor.",
  runIncompleteDated: "La revisión de esta semana quedó incompleta: puede faltar algún dolor. Ves la lista del {date}.",
  runIngestOnly: "Esta semana solo se juntaron publicaciones; no se revisaron.",
  runStale: "La última revisión es del {date}.",
  runStaleFailed: "La última revisión es del {date} y falló.",
  runStaleIncomplete: "La última revisión es del {date} y quedó incompleta: puede faltar algún dolor.",
  runStaleIngestOnly: "La última revisión es del {date} y solo juntó publicaciones; no llegó a leerlas.",
  runNone: "Todavía no hay ninguna revisión.",
  sectionWeighty: "Con peso para trabajar",
  sectionInterested: "Nos interesa",
  sectionWatching: "En observación",
  sectionDiscarded: "Descartados",
  sectionCount: "{title} ({count})",
  trendNew: "Dolor nuevo",
  trendRising: "Gana fuerza",
  trendFalling: "Pierde fuerza",
  trendSteady: "Igual que la semana pasada",
  markInterested: "Nos interesa",
  markDiscarded: "Descartado",
  markedBy: "{mark}: {names}",
  showMore: "Ver {count} más",

  // A pain: the frame and its states.
  painTitle: "Detalle del dolor",
  back: "← Volver",
  backToList: "Volver a la lista",
  painLoading: "Cargando el dolor…",
  painError: "No pudimos cargar este dolor. Vuelve a intentarlo en un momento.",
  painMissing: "Este dolor no está en la lista o todavía no tiene ficha.",

  // A pain: the header.
  statusWeighty: "Con peso para trabajar",
  statusWatching: "En observación",
  statusInterested: "Nos interesa",
  statusDiscarded: "Descartado por el equipo",
  keyTrend: "Cómo viene",
  keyEvidence: "Última evidencia",
  keyTopic: "Tema",
  keyRuns: "Visto en",
  keyRunsValue: "{count} revisiones",
  markInterestedAction: "Marcar «Nos interesa»",
  unmarkInterestedAction: "Quitar «Nos interesa»",
  markDiscardAction: "Descartar",
  unmarkDiscardAction: "Quitar descarte",
  ownInterested: "Marcaste «Nos interesa» el {date}.",
  ownInterestedUndated: "Marcaste «Nos interesa».",
  ownDiscarded: "Lo descartaste el {date}.",
  ownDiscardedUndated: "Lo descartaste.",
  discardedNote: "Lo descartaste. La próxima revisión no lo volverá a presentar. Puedes deshacerlo con el mismo botón.",
  discardedKept: "Lo descartaste, pero alguien del equipo lo marcó «Nos interesa», así que sigue en la lista.",
  markPainGone: "Este dolor ya no está en la lista y tu marca no se guardó.",
  markError: "No pudimos guardar tu marca. Vuelve a intentarlo en un momento.",
  markOffline: "No hay conexión y tu marca no se guardó. Vuelve a intentarlo cuando tengas internet.",

  // A pain: the card.
  indexLabel: "En esta página",
  secWhatHurts: "Qué le duele a la gente",
  secWho: "A quién le duele",
  secBuyer: "A quién se lo venderíamos",
  secSolution: "Qué podríamos construir",
  secWhyReal: "Por qué creemos que es real",
  secValidate: "Cómo validarlo esta semana",
  secRisk: "Lo que podría salir mal",
  secTeamView: "Lo que opina el equipo",
  secGlossary: "Palabras técnicas",
  secMarks: "Marcas y comentarios",
  seeSource: "Ver la fuente",
  originalText: "Texto original",
  lineNotice: "Este dolor está en observación y por ahora solo tiene este resumen. Si lo marcas «Nos interesa», la próxima revisión escribe su ficha completa.",
  lineNoticeMarked: "Ya está marcado «Nos interesa». La próxima revisión, el lunes, escribe su ficha completa.",

  // A pain: marks and comments.
  marksTitle: "Marcas",
  noMarks: "Nadie lo ha marcado todavía.",
  markLine: "{name}: {mark}",
  markLineDated: "{name}: {mark} · {date}",
  commentsTitle: "Comentarios",
  noComments: "Todavía no hay comentarios.",
  commentMeta: "{name} · {date}",
  commentLabel: "Tu comentario",
  commentCount: "{count} de {max} caracteres",
  publish: "Publicar comentario",
  publishing: "Publicando…",
  published: "Publicaste tu comentario.",
  commentEmpty: "Escribe algo antes de publicar.",
  commentTooLong: "Tu comentario tiene {count} caracteres y el máximo es {max}. Lo que escribiste sigue aquí: acórtalo y vuelve a publicarlo.",
  commentRefused: "No se pudo publicar porque un comentario debe tener entre 1 y 500 caracteres. Lo que escribiste sigue aquí: revisa su largo y vuelve a publicarlo.",
  commentError: "No pudimos publicar tu comentario. Lo que escribiste sigue aquí: vuelve a intentarlo en un momento.",
  commentOffline: "No hay conexión. Lo que escribiste sigue aquí: publícalo cuando vuelvas a tener internet.",
  commentPainGone: "Este dolor ya no está en la lista, así que no se pudo publicar. Lo que escribiste sigue aquí.",
  deleteComment: "Borrar",
  deleteConfirm: "¿Borrar tu comentario?",
  cancel: "Cancelar",
  deleted: "Borraste tu comentario.",
  deleteError: "No pudimos borrar tu comentario. Vuelve a intentarlo en un momento.",
  deleteOffline: "No hay conexión y tu comentario no se borró. Vuelve a intentarlo cuando tengas internet.",
  leaveUnsent: "Tienes un comentario sin publicar. Si sales ahora, lo pierdes.",
  leaveAnyway: "Salir sin publicar",
  keepWriting: "Seguir escribiendo",
});

// «Código de {length} números» → «Código de 8 números». A placeholder without a value stays as it is.
export function fill(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}

// Each territory by a plain name. A Map, so a territory called «constructor» or «null» never reads a prototype or
// the null entry.
export const TOPICS = new Map([
  ["documents-for-ai", "Preparar documentos para la IA"],
  ["document-data-extraction", "Sacar datos de documentos"],
  ["accounting-automation", "Automatizar la contabilidad"],
  ["us-consumer-finance", "Finanzas personales en EE. UU."],
  ["developer-tools", "Herramientas para programadores"],
  [null, "Sin tema"],
]);
const OTHER_TOPIC = "Otro tema";

export function topicName(territory) {
  return TOPICS.get(territory) ?? OTHER_TOPIC;
}

const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" });
// A date without a time ("2026-09-18") is UTC midnight: read it in UTC, or west of Greenwich it shows the day before.
const DATE_UTC = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// «18 sept 2026» (the short month as the browser's Intl writes it). "" for nothing or a bad date.
export function formatDate(iso) {
  if (typeof iso !== "string" || !iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (DATE_ONLY.test(iso) ? DATE_UTC : DATE).format(date);
}
