// Every string a person reads on the page, in Spanish and addressing the reader as «tú» (FUN-45). Nothing internal
// (a pain id, a territory slug, tier, lente, score…) may appear here: tests/unit/text.test.mjs checks it.
// The only visible text outside this file is index.html's fallback, which must work when no module loads.

export const T = Object.freeze({
  brand: "tomoshi",
  brandHome: "tomoshi, ir a Esta semana",
  pageTitle: "{title} · tomoshi",

  // The shell: the tabs, the lamp beside the brand (how the latest run went) and the week's data at the right.
  tabsLabel: "Secciones",
  tabWeek: "Esta semana",
  tabCatalog: "Catálogo",
  tabRuns: "Corridas",
  brandLampGreen: "La última corrida terminó completa",
  brandLampAmber: "La última corrida quedó a medias, es vieja o todavía no hay ninguna",
  brandLampRed: "La última corrida falló",
  // The same state in two or three words, shown beside the brand at every width (the lamp's label keeps the long one).
  brandShortComplete: "Corrida completa",
  brandShortPartial: "Corrida a medias",
  brandShortOld: "Corrida vieja",
  brandShortFailed: "Corrida fallida",
  brandShortNone: "Sin corridas aún",
  metaWeek: "Semana del",
  metaNiche: "Nicho:",
  metaCost: "Costó",

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
  noAccess: "Esta página es solo para el equipo. Si deberías entrar, pídele a Miguel que agregue tu correo.",
  signedInAs: "Entraste como {email}.",

  // Home («Esta semana»): «Para decidir», the stations waiting for a mark.
  homeTitle: "Para decidir",
  leadNoPending: "Ya marcaste todos los de esta lista.",
  leadPendingOne: "1 espera tu marca.",
  leadPendingMany: "{count} esperan tu marca.",
  leadOrderWinnerWeighty: "Primero, el ganador del duelo; luego, los que tienen peso para trabajar.",
  leadOrderWinner: "Primero, el ganador del duelo.",
  leadOrderWeighty: "Primero, los que tienen peso para trabajar.",
  decideEmpty: "No hay nada para decidir ahora. Los demás dolores están en el catálogo.",
  seeCatalog: "Ver el catálogo",
  // Under the list, the whole catalog by state in one line, each count before its words (a state with none is left out).
  catalogLine: "En el catálogo: {counts}",
  catalogLineWeighty: "con peso para trabajar",
  catalogLineInterestedOne: "marcado «Nos interesa»",
  catalogLineInterested: "marcados «Nos interesa»",
  catalogLineWatching: "en observación",
  catalogLineDiscardedOne: "descartado por el equipo",
  catalogLineDiscarded: "descartados por el equipo",
  openCatalog: "Abrir el catálogo",
  // A row's chevron (its open or closed state is the button's own) and, open, the way to its evidence.
  stationDetail: "Detalle",
  stationEvidence: "Ver los testimonios y los ataques",
  whoLabel: "Quién lo sufre",
  tagWinner: "Ganó el duelo",
  tagWinnerDated: "Ganó el duelo del {date}",
  tagFresh: "Evidencia nueva",
  noMarksYet: "Sin marcas aún",
  // Why a station is there: its testimonies, the attacks it held and, for the duel's winner, why it won.
  factsLabel: "Por qué está aquí",
  factTestimoniesOne: "1 testimonio",
  factTestimoniesMany: "{count} testimonios",
  factAttacks: "Resistió {held} de {total} ataques",
  factAttacksOne: "Resistió {held} de 1 ataque",
  // The checks: the counts the run judged a pain by, each against the threshold the run used (the gate's own numbers,
  // never fixed here). A box cell says the count's name, its value, in or out of range and its minimum.
  analysisCaption: "Análisis",
  analysisValueLabel: "Valor",
  analysisFlagLabel: "Indicador",
  analysisTestimonies: "Testimonios",
  analysisTiers: "Tipos de fuente",
  analysisSurvivals: "Ataques resistidos",
  analysisStatement: "Descrito por quien lo sufre",
  analysisRange: "Mínimo {n}",
  analysisRangeOf: "Mínimo {n} de {total}",
  analysisIn: "Dentro del rango",
  analysisOut: "Fuera del rango",
  analysisHeld: "{held} de {total}",
  analysisIncomplete: "Sin resultado completo ({n} de {total} respondieron)",
  analysisNoAttacks: "Sin ataques evaluados",
  analysisMissing: "Falta",
  analysisPerCountry: "Contado dentro de un solo país",
  // The same checks in a few words, stacked in a closed row: the count, and what it lacks when it is out of range.
  checkTestimoniesOne: "1 testimonio",
  checkTestimonies: "{n} testimonios",
  checkTiersOne: "1 tipo de fuente",
  checkTiers: "{n} tipos de fuente",
  checkAttacksOne: "{held} de 1 ataque",
  checkAttacks: "{held} de {total} ataques",
  checkMissingOne: "falta 1",
  checkMissing: "faltan {n}",
  checkStatement: "Falta cómo lo cuenta quien lo sufre",
  // A stacked check's result, for a screen reader only: the ✓ and ✗ say it to the eye.
  checkSaidPass: "dentro del rango",
  checkSaidFail: "fuera del rango",
  // Where the checks would be, on a full result or a pain's page, when the pain has no gate (stored before it existed).
  analysisNone: "Sin análisis guardado para este dolor",
  duelReasonLabel: "En el duelo:",
  commentAction: "Comentar",
  stationInterested: "Nos interesa",
  markSavedInterested: "Guardamos tu marca «Nos interesa».",
  markRemoved: "Quitaste tu marca.",

  // The run's line: one station per stage, the sources under the first.
  lineLabel: "Línea de la corrida",
  lineTitle: "Línea de la corrida",
  lineTitleOld: "Recorrido de la corrida del {date}",
  lineTitleOldUndated: "Recorrido de una corrida anterior",
  lineNoTrace: "Esta corrida no dejó su recorrido.",
  lineOlderNote: "La última corrida no dejó su recorrido. Este es el de la última que sí lo dejó.",
  lineNoRun: "Todavía no hay ninguna corrida.",
  lineStripCutsOne: "1 etapa con recorte",
  lineStripCuts: "{count} etapas con recorte",
  lineStripClean: "Sin recortes",
  // The line as a step list: how many steps, how many had a cut, and its two column heads.
  lineStepsOne: "1 paso",
  lineSteps: "{count} pasos",
  lineCutsOne: "Hubo recorte en 1 paso",
  lineCuts: "Hubo recorte en {count} pasos",
  lineColStep: "Paso",
  lineColLeft: "Quedan",
  durationMinutes: "duró {minutes} min",
  durationHours: "duró {hours} h {minutes} min",
  durationShort: "duró menos de un minuto",
  costUsd: "{amount} USD",
  costCards: "Fichas",
  costLabel: "Costo por modelo",
  stageOk: "Sin recortes",
  stageCut: "Con recorte",
  stageNoData: "Sin dato",
  stageCap: "tope de {cap}",
  sourcesLabel: "Fuentes",
  sourceOk: "completa",
  sourceTruncated: "recortada",
  sourceEmpty: "no aportó nada",
  sourceFailed: "falló",
  sourceUnknown: "sin dato",
  sourceOf: "de {available}",
  otherCuts: "Otros recortes",
  // Corridas' column of each run's state; a source's name, said as one for a screen reader.
  lineColFlag: "Indicador",
  sourceRowLabel: "Fuente:",
  // The cuts the page cannot explain, said once on the home's line, as a link to the run's page.
  cutOtherLinkOne: "Hubo un recorte más; míralo en su corrida",
  cutsOtherLinkMany: "Hubo {count} recortes más; míralos en su corrida",

  // Catálogo: every pain by state, one section per state with its count; an empty section says so.
  catalogTitle: "Catálogo",
  catalogLoading: "Cargando el catálogo…",
  catalogEmptyWeighty: "Ahora ningún dolor tiene peso para trabajar.",
  catalogEmptyInterested: "Ahora no hay ninguno. Aquí van los dolores marcados «Nos interesa» que todavía no tienen peso para trabajar.",
  catalogEmptyWatching: "Ahora no hay ningún dolor en observación.",
  catalogEmptyDiscarded: "Nadie del equipo ha descartado ningún dolor.",
  // Nichos: the week's niche and why, every candidate, and the veto (js/niches.js builds the board). What measures,
  // proposes and retires niches is named by the product's name, «tomoshi», never «dolores».
  tabNiches: "Nichos",
  nichesTitle: "Nichos",
  nichesLead: "Cada lunes tomoshi mide todos los nichos sin gastar y paga la corrida del que trae a la vez quejas y dinero. Si uno no les interesa, vétenlo: deja de competir desde el lunes siguiente.",
  nichesEmpty: "Todavía no hay sondeo de nichos. El primero llega con la próxima corrida del lunes.",
  nicheVetoDone: "Vetaste «{name}». Deja de competir desde el próximo lunes.",
  nicheVetoUndone: "Quitaste el veto a «{name}». Vuelve a competir desde el próximo lunes.",
  nicheUnnamed: "Nicho sin nombre",
  nicheProposedUnnamed: "Nicho propuesto sin nombre",
  nicheOriginMine: "Elegido a mano",
  nicheOriginProposed: "Propuesto por tomoshi el {date}",
  nicheOriginProposedUndated: "Propuesto por tomoshi",
  // The niche that ran: «Corrió esta semana» only for this week's complete or incomplete run; an older one by its day
  // («Corrió el <día>», nicheRanOn); a run that did not finish says it failed. Vetoed since, it says both.
  nicheStateCurrent: "Corrió esta semana",
  nicheStateRanUndated: "Ya corrió",
  nicheStateFailed: "Se eligió el {date}; la corrida falló",
  nicheStateFailedUndated: "Se eligió; la corrida falló",
  nicheStateVetoedThisWeek: "Vetado · corrió esta semana",
  nicheStateVetoedRanOn: "Vetado · corrió el {date}",
  nicheStateVetoedRanUndated: "Vetado · ya corrió",
  nicheStateVetoedFailed: "Vetado · la corrida falló",
  nicheStateCompeting: "Compite",
  nicheStateResting: "Descansa",
  nicheStateVetoed: "Vetado",
  nicheStateRetired: "Retirado",
  nicheNew: "Nuevo este mes",
  nicheRestingUntil: "Se estancó; vuelve a más tardar el {date}",
  nicheRestingUndated: "Se estancó",
  nicheVetoedBy: "Lo vetó {name} el {date}",
  nicheVetoedByUndated: "Lo vetó {name}",
  nicheRetiredOn: "Lo retiró tomoshi el {date} para dejar lugar a otros propuestos",
  nicheRetiredUndated: "Lo retiró tomoshi para dejar lugar a otros propuestos",
  nicheNoisePercent: "{n} %",
  nicheNoiseUnmeasured: "sin medir",
  nicheNoiseOf: "de lo que se leyó",
  nicheWhyMissing: "Esta corrida no guardó por qué se eligió",
  nicheComplaints: "Quejas reales",
  nicheSpending: "Gasto real",
  nicheNoise: "Ruido",
  nicheRankTop: "el más alto",
  nicheRank: "{n}.º de {total}",
  nicheSignalIn: "CON SEÑAL",
  nicheSignalOut: "SIN SEÑAL",
  nicheNoteJudge: "Gana el nicho con más en su lado más débil; aquí, {value} de {side}.",
  nicheSideComplaints: "quejas",
  nicheSideSpending: "gasto",
  nicheNoteCounts: "Esta semana se contó sin revisar: el ruido no se midió.",
  nicheAdvancedOne: "1 se acercó a tener peso en sus últimas semanas",
  nicheAdvancedMany: "{count} se acercaron a tener peso en sus últimas semanas",
  nicheVetoNext: "Si lo vetan, el próximo lunes corre otro.",
  nicheVetoNextVetoed: "Vetado: el próximo lunes corre otro.",
  // The screen around the board (js/app.js, showNiches): loading, the two sections, the week's block, the table's
  // columns, each niche's counts in words, the veto's buttons and what a failed veto says.
  nichesLoading: "Cargando los nichos…",
  nichesError: "No pudimos cargar los nichos. Vuelve a intentarlo en un momento.",
  nicheWeekLabel: "Esta semana",
  nicheCandidatesLabel: "Candidatos",
  nicheWhyLabel: "Por qué se eligió:",
  nicheRanOn: "Corrió el {date}",
  nicheProbeCaption: "Sondeo del {date}",
  nicheProbeCaptionUndated: "Sondeo de la semana",
  nicheVersus: "Frente a los otros {n}",
  nicheVersusOne: "Frente al otro",
  nicheVersusNone: "Frente a los otros",
  nicheOwnPains: "Sus dolores",
  nichePainsFull: "{weighty} con peso para trabajar · {watching} en observación",
  nichePainsShort: "{weighty} con peso · {watching} en obs.",
  nichePainsInterestedOne: "1 marcado «Nos interesa»",
  nichePainsInterestedMany: "{count} marcados «Nos interesa»",
  nichePainsNone: "Sin dolores aún",
  nichePainsNoneRetired: "Sin dolores",
  nichePaidRunsNone: "sin corridas aún",
  nichePaidRunsOne: "1 corrida pagada",
  nichePaidRunsMany: "{count} corridas pagadas",
  nichePaidRunsNoneLong: "Sin corridas pagadas en este nicho",
  nichePaidRunsOneLong: "1 corrida pagada en este nicho",
  nichePaidRunsManyLong: "{count} corridas pagadas en este nicho",
  nicheNoVeto: "Sin veto",
  nicheVetoWeek: "Vetar este nicho",
  nicheVeto: "Vetar",
  nicheUnveto: "Quitar veto",
  nicheColState: "Indicador",
  nicheColName: "Nicho",
  nicheColComplaints: "Quejas",
  nicheColSpending: "Gasto",
  nicheColVeto: "Veto",
  nicheNoValue: "sin dato",
  nicheFootnote: "Quejas y gasto: cuántos de los textos nuevos de la semana son quejas reales y gastos reales, sin contar el ruido. Un nicho sin quejas o sin gasto no puede ganar.",
  nicheVetoError: "No pudimos guardar el cambio del veto. Vuelve a intentarlo en un momento.",
  nicheVetoOffline: "No hay conexión y el cambio del veto no se guardó. Vuelve a intentarlo cuando tengas internet.",
  // Corridas: every run that left its trace, week by week, and each one opened.
  runsTitle: "Corridas",
  runsLead: "Lo que hizo cada corrida, semana a semana, la más reciente primero. Abre una para ver su línea completa, sus recortes y sus duelos.",
  runsLoading: "Cargando las corridas…",
  runsError: "No pudimos cargar las corridas. Vuelve a intentarlo en un momento.",
  runsEmpty: "Todavía ninguna corrida dejó su recorrido. Cuando termine la del lunes, aparece aquí.",
  runsListLabel: "Corridas, la más reciente primero",
  runMissing: "Esta corrida no está en la lista: puede que no haya dejado su recorrido.",
  runsBack: "← Corridas",
  runsBackLabel: "Volver a las corridas",
  seeAllRuns: "Ver todas las corridas",
  runTitle: "Corrida",
  runTitleDated: "Corrida del {date}",
  runTitleUndated: "Corrida sin fecha",
  runStateComplete: "Completa",
  runStateIncomplete: "Incompleta",
  runStateIngestOnly: "Solo juntó publicaciones",
  runStateFailed: "Falló",
  runStateUnknown: "Sin dato del estado",
  runMiniLabel: "Conteos de cada etapa",
  runMiniNone: "Esta corrida no dejó conteos.",
  newPainsNone: "Ningún dolor nuevo",
  newPainsOne: "1 dolor nuevo",
  newPainsMany: "{count} dolores nuevos",
  keyNiche: "Nicho",
  keyAgents: "Agentes",
  keyFound: "Encontró",
  agentsOfCap: "{used} usados de {cap}",
  agentsUsed: "{used} usados",
  runCostTitle: "Costo",
  costTotal: "Total",
  runCostNone: "Esta corrida no dejó su costo.",
  runCutsTitle: "Lo que se recortó",
  runCutsNone: "Esta corrida no anotó recortes.",
  cutsOtherMany: "Hubo {count} recortes más",
  runCutsOtherOne: "Hubo un recorte más; lo verás en el detalle técnico",
  runCutsOtherMany: "Hubo {count} recortes más; los verás en el detalle técnico",
  runDuelsTitle: "Duelos",
  runDuelsNone: "Esta corrida no anotó duelos.",
  duelLine: "{a} contra {b} · {winner}",
  duelOnePain: "un dolor del catálogo",
  duelWinner: "ganó {name}",
  duelWinnerFirst: "ganó el primero",
  duelWinnerSecond: "ganó el segundo",
  duelNoWinner: "sin ganador anotado",
  techTitle: "Detalle técnico",
  techLead: "Los textos internos de la corrida, tal como los anotó, sin traducir ni revisar. Sirven para buscar un problema; para decidir no hace falta leerlos.",
  techCuts: "Recortes sin explicar",
  techNotes: "Notas de las fuentes",
  techReasons: "Razones de los duelos",
  techNone: "Esta corrida no dejó textos internos.",
  techSourceUnnamed: "Fuente sin nombre",

  // The empty states and the sections by state (the home and Catálogo).
  homeLoading: "Cargando los dolores…",
  emptyReviewedOne: "Revisamos 1 publicación y no trajo ningún dolor. La próxima corrida es el lunes.",
  emptyReviewedOneTopic: "Revisamos 1 publicación sobre «{topic}» y no trajo ningún dolor. La próxima corrida es el lunes.",
  emptyReviewedMany: "Revisamos {count} publicaciones y ninguna trajo un dolor. La próxima corrida es el lunes.",
  emptyReviewedManyTopic: "Revisamos {count} publicaciones sobre «{topic}» y ninguna trajo un dolor. La próxima corrida es el lunes.",
  emptyNoRun: "Todavía no hay ninguna corrida. La primera es el lunes.",
  emptyNoItems: "Esta semana no apareció ningún dolor. La próxima corrida es el lunes.",
  emptyNoItemsLatest: "En la última corrida no apareció ningún dolor. La próxima corrida es el lunes.",
  emptyUnfinished: "La corrida de esta semana no terminó, así que no hay dolores nuevos. La próxima corrida es el lunes.",
  emptyUnfinishedLatest: "La última corrida no terminó, así que no hay dolores nuevos. La próxima corrida es el lunes.",
  reload: "Volver a cargar",
  homeError: "No pudimos cargar los dolores. Vuelve a intentarlo en un momento.",
  runFailed: "La corrida de esta semana falló. Ves la lista de la última corrida que terminó.",
  runIncomplete: "La corrida de esta semana quedó incompleta: puede faltar algún dolor.",
  runIncompleteDated: "La corrida de esta semana quedó incompleta: puede faltar algún dolor. Ves la lista del {date}.",
  runIngestOnly: "Esta semana solo se juntaron publicaciones; no se revisaron.",
  runStale: "La última corrida es del {date}.",
  runStaleFailed: "La última corrida es del {date} y falló.",
  runStaleIncomplete: "La última corrida es del {date} y quedó incompleta: puede faltar algún dolor.",
  runStaleIngestOnly: "La última corrida es del {date} y solo juntó publicaciones; no llegó a leerlas.",
  runNone: "Todavía no hay ninguna corrida.",
  sectionWeighty: "Con peso para trabajar",
  sectionInterested: "Nos interesa",
  sectionWatching: "En observación",
  sectionDiscarded: "Descartados por el equipo",
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
  statusOut: "Fuera de la lista",
  keyTrend: "Cómo viene",
  keyEvidence: "Última evidencia",
  keyTopic: "Tema",
  keyRuns: "Visto en",
  keyRunsValue: "{count} corridas",
  markInterestedAction: "Marcar «Nos interesa»",
  unmarkInterestedAction: "Quitar «Nos interesa»",
  markDiscardAction: "Descartar",
  unmarkDiscardAction: "Quitar descarte",
  ownInterested: "Marcaste «Nos interesa» el {date}.",
  ownInterestedUndated: "Marcaste «Nos interesa».",
  ownDiscarded: "Lo descartaste el {date}.",
  ownDiscardedUndated: "Lo descartaste.",
  discardedNote: "Lo descartaste. La próxima corrida no lo volverá a presentar. Puedes deshacerlo con el mismo botón.",
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
  lineNotice: "Este dolor está en observación y por ahora solo tiene este resumen. Si lo marcas «Nos interesa», la próxima corrida escribe su ficha completa.",
  lineNoticeMarked: "Ya está marcado «Nos interesa». La próxima corrida, el lunes, escribe su ficha completa.",

  // A pain: «Cómo llegamos a este dolor», the quotes by source, the attacks and the duels of its latest run.
  secHowWeGot: "Cómo llegamos a este dolor",
  howQuotesTitle: "Lo que dice la gente",
  howQuotesLead: "Las citas van textuales y en su idioma, las más recientes primero.",
  quoteCountOne: "1 cita",
  quoteCountMany: "{count} citas",
  howAttacksTitle: "Las preguntas que le hicimos",
  lensExistingSolution: "¿Ya existe una solución?",
  lensEvidence: "¿Alcanza la evidencia?",
  lensBuyer: "¿Hay quién pague?",
  lensRootCause: "¿Es la causa de fondo?",
  lensFeasibility: "¿Se puede construir?",
  lensOther: "Otra pregunta",
  attackHeld: "Resistió",
  attackRefuted: "Lo tumbó",
  howDuelTitle: "El duelo",
  howDuelsTitle: "Los duelos",
  duelWon: "Ganó",
  duelLost: "Perdió",
  duelAgainst: "Contra «{title}»",
  duelAgainstOther: "Contra otro dolor del catálogo",
  duelOtherPain: "otro dolor del catálogo",

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
  // A cut of the run that came with no plain words (the run's own: dolores/scripts/lib/i18n.mjs, trace.cut.other).
  cutOther: "Hubo un recorte más",
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

// Each source of evidence by the run's own name and kind (dolores/scripts/lib/i18n.mjs, trace.source and trace.country,
// as lib/trace.mjs names them): the run's line and a pain's quotes call a source the same. Evidence comes as `hn`,
// `github`, `cfpb`, `socrata` (SECOP's open data) or `adzuna` with its country apart; the trace's `adzuna:US` and
// `socrata:p6dx-8zbt` (SECOP's dataset) are read too. Another Socrata dataset is not SECOP. A source the page does not
// know keeps its id as its name, as the run does.
const SOURCES = new Map([
  ["hn", { name: "Hacker News", kind: "Foro de programadores" }],
  ["github", { name: "GitHub", kind: "Proyectos de código libre" }],
  ["secop", { name: "SECOP · Colombia", kind: "Contratos públicos" }],
  ["cfpb", { name: "CFPB", kind: "Quejas de consumidores" }],
]);
const SECOP_IDS = new Set(["socrata", "socrata:p6dx-8zbt"]);
const JOBS = "Ofertas de empleo";
const OTHER_SOURCE = "Otra fuente";
export const COUNTRIES = new Map([["US", "Estados Unidos"], ["MX", "México"], ["BR", "Brasil"], ["CO", "Colombia"]]);

export function sourceName(source, country = null) {
  const id = typeof source === "string" ? source.trim() : "";
  if (!id) return { name: OTHER_SOURCE, kind: OTHER_SOURCE };
  if (SECOP_IDS.has(id)) return SOURCES.get("secop");
  if (SOURCES.has(id)) return SOURCES.get(id);
  const jobs = /^adzuna(?::(.+))?$/.exec(id);
  if (jobs) {
    const code = String(jobs[1] ?? country ?? "").trim().toUpperCase();
    return { name: code ? `${JOBS} · ${COUNTRIES.get(code) ?? code}` : JOBS, kind: JOBS };
  }
  return { name: id, kind: OTHER_SOURCE };
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

// «16 de noviembre» (no year: it says a week, next to the run's own date in full where that matters). A date without a
// time is read in UTC, like formatDate. "" for nothing or a bad date.
const DAY_MONTH = new Intl.DateTimeFormat("es", { day: "numeric", month: "long" });
const DAY_MONTH_UTC = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: "UTC" });
export function formatDayMonth(iso) {
  if (typeof iso !== "string" || !iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return (DATE_ONLY.test(iso) ? DAY_MONTH_UTC : DAY_MONTH).format(date);
}

const NUMBER = new Intl.NumberFormat("es");
const USD = new Intl.NumberFormat("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatNumber = (value) => NUMBER.format(value);
// «3,66» for 3.6649; null for anything that is not a finite number.
export const formatUsd = (value) => (typeof value === "number" && Number.isFinite(value) ? USD.format(value) : null);
