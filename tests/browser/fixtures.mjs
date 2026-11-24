// The browser checks' fake Supabase and their scenarios. Every request to the project's URL is answered here through
// page.route, so the real supabase-js (from jsDelivr) runs against data we choose, both on the local server and on the
// published page. A signed-in scenario injects a session into localStorage under supabase-js's own key before the page
// loads. The data has the base's shapes (a full card, a version-1 line card and its version-2 rewrite), but every text
// in it is invented: this repository is public and carries no catalog data.

import { T, fill, formatDate, formatDayMonth } from "../../js/text.js";

export const SUPABASE_ORIGIN = "https://hphrlkvkefztxvlamrmh.supabase.co";
export const STORAGE_KEY = "sb-hphrlkvkefztxvlamrmh-auth-token";
export const ME = "carla@example.com";
export const CODE = "12345678";

// ---- data -------------------------------------------------------------------------------------

const PEOPLE = [
  { email: "carla@example.com", name: "Carla" },
  { email: "beto@example.com", name: "Beto" },
  { email: "ana@example.com", name: "Ana" },
];

const FULL_CARD = {
  kind: "full",
  line: {
    title: "Cobrar las cuotas del club a tiempo",
    who: "Tesoreros voluntarios de clubes deportivos pequeños que cobran una cuota mensual a decenas de familias.",
    what_hurts: "Saber quién pagó la cuota del mes sigue exigiendo cruzar a mano el banco con una lista, y se escapan cobros.",
  },
  full: {
    what_hurts: "Cada mes el tesorero cruza los movimientos del banco con la lista de socios para saber quién pagó la cuota, y aun así se le escapan pagos repetidos o familias que llevan meses sin pagar. Se busca que ese cruce se haga solo.",
    buyer: {
      text: "Sufren el problema los tesoreros de clubes de barrio, casi siempre madres o padres voluntarios. Quien paga parece ser el club: hay federaciones que recomiendan a sus clubes una herramienta de cobro y ofrecen ayudas para pagarla.",
      known: true,
      sources: ["foro-1001", "aviso-2002", "foro-1003"],
    },
    solution: {
      text: "Una herramienta que lea los movimientos del banco, marque quién pagó y avise a quien se retrasa. Ya hay programas para gestionar socios, pero son caros para un club pequeño y muchos vuelven a la hoja de cálculo.",
      sources: ["lens:existing-solution", "foro-1004", "foro-1005"],
    },
    why_real: {
      text: "Cuatro personas distintas lo cuentan en foros de clubes y grupos de familias, y dos federaciones recomiendan buscar una herramienta así. Todavía no sabemos si un club pagaría por una solución completa.",
      quotes: [
        { url: "https://example.org/foro/clubes/1001", hash: "foro-1001", original: "every month I spend a whole evening matching bank transfers against the member list by hand", translation: "cada mes paso una tarde entera cruzando a mano las transferencias del banco con la lista de socios" },
        { url: "https://example.com/familias/hilo/1003", hash: "foro-1003", original: "Two families paid twice and one had not paid since March, and nobody noticed until the season ended", translation: "Dos familias pagaron dos veces y una no pagaba desde marzo, y nadie se dio cuenta hasta que terminó la temporada" },
        { url: "https://example.org/federacion/avisos/2002", hash: "aviso-2002", original: "Recomendamos a los clubes una herramienta sencilla para llevar el cobro de las cuotas.", translation: "Recomendamos a los clubes una herramienta sencilla para llevar el cobro de las cuotas." },
      ],
    },
    validate: "Las pistas vienen de foros de clubes, grupos de familias y avisos de federaciones. Esta semana, llamar a entre 5 y 10 tesoreros de clubes pequeños y preguntarles cuántas horas dedican al cobro y si el club pagaría por ahorrárselas.",
    risk: { lens: null, text: "Nadie puso una pega seria a la idea, pero muchos clubes tienen poco dinero y podrían preferir seguir con la hoja de cálculo." },
    team_view: null,
    glossary: [
      { term: "Conciliar", meaning: "Comprobar, uno por uno, que los pagos que muestra el banco coinciden con los que se esperaban." },
      { term: "Domiciliación", meaning: "Orden para que el banco cobre cada mes una cantidad de la cuenta de la familia sin que tenga que hacer nada." },
    ],
  },
  trend: { runs: 8, direction: "steady", territory: "accounting-automation", last_evidence: "2026-09-18" },
  review: { plain: true, round: 1, offending: [] },
  run_id: "cards-2026-11-10",
  pain_id: "dol-0027",
  version: 2,
  language: "es",
  source_hash: "fixture-full",
};

// The pain's evidence and verdicts as pains.doc has them (dolores/scripts/record-run.mjs), every text invented: quotes in
// English and Spanish from five sources (one unknown to the page), one source with more than three quotes, a link the
// page must not follow (javascript:). A verdict's argument carries RAW- so a check can tell it never shows.
const EVIDENCE = [
  ["hn", "en", "2026-10-28T09:12:00Z", "every month I spend a whole evening matching bank transfers against the member list by hand"],
  ["hn", "en", "2026-10-02T18:40:00Z", "we only found out at the end of the season that two families had paid twice"],
  ["hn", "en", "2026-09-14T07:05:00Z", "the treasurer job is the one nobody wants, mostly because of chasing late dues"],
  ["hn", "en", "2026-08-30T21:30:00Z", "our club gave up on the membership software and went back to a spreadsheet"],
  ["hn", "en", "2026-07-11T11:00:00Z", "there is no cheap tool that reads the bank export and ticks off who paid"],
  ["github", "en", "2026-10-20T15:00:00Z", "importing the bank CSV drops the payer reference, so every payment has to be matched by hand"],
  ["socrata", "es", "2026-09-01", "Contratar el servicio de conciliación de cuotas de la liga de clubes deportivos del municipio", "CO"],
  ["adzuna", "es", "2026-10-15", "Se busca auxiliar contable para conciliar cuotas de socios de un club deportivo", "MX"],
  ["adzuna", "en", "2026-09-22", "Part-time treasurer assistant to reconcile member dues for a youth football club", "US"],
  ["foro-nuevo", "es", "2026-06-05", "La cuota del club la cobramos a mano y siempre se nos escapa alguien"],
].map(([source, language, date, quote, country = null], i) => ({
  hash: `${source}-${i}`, url: i === 3 ? "javascript:alert(1)" : `https://example.org/${source}/${1000 + i}`,
  source, tier: 2, country, language, quote, date,
}));
const LENSES = ["existing-solution", "evidence", "buyer", "root-cause", "feasibility"];
const verdicts = (runId, refuted = []) => LENSES.map((lens) => ({
  pain_id: "dol-0027", lens, refuted: refuted.includes(lens), confidence: "medium", argument: `RAW-ARGUMENT ${lens}`, proof: [], run_id: runId,
}));
const VERDICTS = [...verdicts("2026-11-03-1", ["buyer"]), ...verdicts("2026-11-10-3", ["root-cause"])];

// The same card as version 3 writes it: a plain line per attack of the latest run and one per duel it played. One duel
// is against a watched pain the home knows (so it goes by its title after the home) and one against a pain the page
// never loaded (so it reads «otro dolor del catálogo»).
const FULL_CARD_V3 = {
  ...FULL_CARD,
  version: 3,
  attacks: [
    { lens: "existing-solution", held: true, plain: "Hay programas para llevar socios, pero cuestan más de lo que un club pequeño puede pagar." },
    { lens: "evidence", held: true, plain: "Cuatro personas distintas lo cuentan con sus propias palabras, y dos federaciones lo recomiendan." },
    { lens: "buyer", held: true, plain: "Quien sufre el problema es el tesorero, pero quien pagaría es el club, y algunos ya pagan por otras herramientas." },
    { lens: "root-cause", held: false, plain: "El problema de fondo puede ser que el banco no deja poner una referencia clara en cada pago." },
    { lens: "feasibility", held: true, plain: "Leer el archivo del banco y marcar quién pagó se puede construir con lo que ya existe." },
  ],
  duels: [
    { against: "dol-0101", won: false, plain: "El otro dolor tiene más gente que lo cuenta y más clubes que ya pagan por resolverlo." },
    { against: "dol-0420", won: true, plain: "Este dolor tiene un comprador más claro que el otro." },
  ],
};

// A version-1 line card, as the store has it: no line.title, so the page titles it with what hurts.
const LINE_CARD_V1 = {
  kind: "line",
  line: {
    who: "Quienes organizan las excursiones de un colegio; todavía no sabemos quién paga por esto.",
    what_hurts: "Hay que juntar a mano la autorización firmada de cada familia porque el colegio solo acepta el papel para las excursiones.",
  },
  trend: { runs: 1, direction: "new", territory: null, last_evidence: "2026-08-18" },
  review: null,
  run_id: "cards-2026-11-10",
  pain_id: "dol-0002",
  version: 1,
  language: "es",
  source_hash: "fixture-line",
};

// The same line card as the next run writes it (version 2, with its title).
const LINE_CARD_V2 = { ...LINE_CARD_V1, version: 2, line: { ...LINE_CARD_V1.line, title: "Autorizaciones de excursión en papel" } };

// A full card whose title is as long as a title may be (48 characters), to measure MAR-14 at its worst.
export const LONGEST_TITLE = "Cobrar las cuotas del club sin perseguir a nadie";
const FULL_CARD_LONG_TITLE = { ...FULL_CARD, line: { ...FULL_CARD.line, title: LONGEST_TITLE } };

// Review Focus 5: a title of 48 characters made of long Spanish words, the hardest to wrap at 320 px.
export const LONG_WORDS_TITLE = "Desincronización de inscripciones extraescolares";

// 55 pains under watch, each with its own version-2 line card: more than 50, so the home shows 20 and «Ver 20 más»
// (LIS-04). Every title is different (6 × 10 combinations).
export const WATCHING_ROWS = 55;
const DOINGS = ["Conciliar", "Clasificar", "Revisar", "Archivar", "Traducir", "Firmar"];
const THINGS = ["facturas de proveedores", "contratos de alquiler", "recibos de gastos", "extractos bancarios", "nóminas mensuales",
  "facturas de clientes", "pedidos de compra", "albaranes de entrega", "pólizas de seguro", "presupuestos de obra"];
const DIRECTIONS = ["new", "rising", "falling", "steady"];
const TERRITORIES = ["documents-for-ai", "document-data-extraction", "accounting-automation", null];

function watchingPains(count) {
  const pains = [];
  const cards = [];
  for (let i = 0; i < count; i += 1) {
    const id = `dol-${String(100 + i).padStart(4, "0")}`;
    const title = `${DOINGS[i % DOINGS.length]} ${THINGS[Math.floor(i / DOINGS.length) % THINGS.length]} a mano`;
    const day = String(28 - (i % 28)).padStart(2, "0");
    pains.push({ id, territory: TERRITORIES[i % TERRITORIES.length], status: "watching", team_discard: null });
    cards.push({ pain_id: id, kind: "line", card: {
      kind: "line",
      line: { title, who: "Pequeñas oficinas contables; todavía no sabemos quién paga por esto.", what_hurts: `Hay que ${title.toLowerCase()} cada mes.` },
      trend: { runs: 1 + (i % 3), direction: DIRECTIONS[i % DIRECTIONS.length], territory: null, last_evidence: `2026-10-${day}` },
      review: null, run_id: "cards-2026-11-10", pain_id: id, version: 2, language: "es", source_hash: "fixture",
    } });
  }
  return { pains, cards };
}

// The run's day is today, so the home never reads it as an old run whatever day the checks run.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const RUN_ID = "2026-11-10-3";
const summary = (status = "complete", runId = RUN_ID) => ({
  run_id: runId, date: today(), status, territory: "documents-for-ai", reasons: [], new_pains: 6, items_reviewed: 480,
});

// A day `days` before today, as YYYY-MM-DD.
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The run's trace in buildTrace's shape (dolores/scripts/lib/trace.mjs), every source, count and niche invented. The
// raw texts (a source's note, a cut's original, a duel's reason) carry RAW- so a check can tell they never show.
function runTrace(runId = RUN_ID, date = today()) {
  return {
    version: 1, run_id: runId, date, niche: { id: "nicho-ficticio", name: "Cuotas y cobros de clubes" }, status: "complete",
    started_at: `${date}T09:00:00Z`, finished_at: `${date}T09:26:00Z`,
    cost: { total_usd: 2.73, by_model: [{ model: "Sonnet", usd: 1.64 }, { model: "Haiku", usd: 0.71 }], cards_usd: 0.38 },
    agents: { used: 158, cap: 180 },
    sources: [
      { name: "Foro de tesoreros", kind: "Foro", collected: 72, kept: 64, available: null, truncated: false, note: "RAW-NOTE", ok: true },
      { name: "Grupos de familias", kind: "Foro", collected: 240, kept: 29, available: 1830, truncated: true, note: "RAW-NOTE", ok: true },
      { name: "Avisos de federaciones", kind: "Avisos", collected: 90, kept: 90, available: 470, truncated: true, note: "RAW-NOTE", ok: true },
      { name: "Empleo ficticio", kind: "Empleo", collected: 0, kept: 0, available: null, truncated: false, note: "RAW-NOTE", ok: true },
      { name: "Licitaciones ficticias", kind: "Contratos", collected: 215, kept: 209, available: null, truncated: false, note: "RAW-NOTE", ok: true },
    ],
    ingest: null,
    funnel: [
      { stage: "collected", label: "Juntadas", count: 617, cap: null },
      { stage: "read", label: "Leídas", count: 392, cap: null },
      { stage: "with_signals", label: "Con señales de dolor", count: 297, cap: null },
      { stage: "analyzed", label: "Analizadas a fondo", count: 44, cap: 50 },
      { stage: "quotes_checked", label: "Con citas comprobadas", count: 41, cap: null },
      { stage: "grouped", label: "Dolores agrupados", count: 15, cap: null },
      { stage: "candidates", label: "Candidatos", count: 12, cap: 12 },
      { stage: "attacked", label: "Puestos a prueba", count: 12, cap: null },
      { stage: "survivors", label: "Resistieron", count: 2, cap: null },
      { stage: "duel", label: "Duelos", count: 1, cap: null },
    ],
    cuts: [
      { kind: "extraction-cap", count: 253, cap: 50, text: "253 testimonios con señales quedaron sin analizar a fondo", original: null },
      { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "RAW-ORIGINAL" },
    ],
    duels: [{ a: "dol-0100", b: "dol-0101", winner: "dol-0101", reason: "RAW-REASON" }],
    ranking: ["dol-0101", "dol-0100"], duel_kind: "survivors", new_pains: 6, cards: null,
  };
}
const OLD_RUN_ID = "2026-11-03-1";

// A pain's history as record-run.mjs writes it: each run that saw it, with the inputs of its score (the home reads the
// latest entry's testimonies for the station's facts).
const seen = (...runs) => runs.map(([run_id, date], i) => ({ run_id, date, score: 10, inputs: { testimonies: 3 + i, tiers: 2 } }));
export const WINNER_REASON = "Más tesoreros lo cuentan y dos federaciones ya pagan por algo parecido.";
const PAIN_0027 = { id: "dol-0027", territory: "accounting-automation", status: "alive", team_discard: null, evidence: EVIDENCE, verdicts: VERDICTS };

// The counts a run judged a pain by (dolores' decideStatus, `gate` on the pain's doc), with the run's own thresholds.
// On the home, the pain with weight (dol-0027) passes every one; the duel's winner, still under watch, has one type of
// source of the two required, and its testimonies were counted within one country.
const THRESHOLDS = { testimonies: 3, tiers: 2, survivals: 3, verdicts: 5 };
const GATE_IN_RANGE = { testimonies: 4, tiers: 2, survivals: 4, verdicts: 5, has_statement: true, per_country: false, thresholds: THRESHOLDS };
const GATE_ONE_TIER = { testimonies: 4, tiers: 1, survivals: 4, verdicts: 5, has_statement: true, per_country: true, thresholds: THRESHOLDS };
const PAIN_0002 = { id: "dol-0002", territory: null, status: "watching", team_discard: null };
// A pain's detail opens with its analysis. The detail's dol-0027 has one count out of range (one type of source of the
// two required), so the page shows both flags; with it the run keeps the pain under watch (decideStatus: fewer types of
// source than required is never «con peso»), and Carla's «Nos interesa» puts it in «Nos interesa», which is why its card
// is full. The detail scenarios without a gate (detail-no-gate, a pain stored before the gate existed, and the line
// card's dol-0002) show no table and claim nothing: one line says there is no analysis.
const GATE_DETAIL = { testimonies: 4, tiers: 1, survivals: 4, verdicts: 5, has_statement: true, per_country: false, thresholds: THRESHOLDS };
const PAIN_0027_DETAIL = { ...PAIN_0027, status: "watching", gate: GATE_DETAIL };

// The home: one pain with weight (dol-0027, Carla finds it interesting), one marked interested while under watch
// (dol-0002, the store's version-1 line card, with new evidence this run), 55 under watch, and one the team discarded
// (dol-0030). The trace's duel is between two of the watched (dol-0100 and dol-0101, the winner); dol-0102 is new in this
// run. So «Para decidir» has five stations and Catálogo lists all of them. dol-0027 carries a gate in range and the
// winner (dol-0101) one with a single type of source; the others have none. With `oldTrace` the week's run left no trace
// and the line is the one before (Review Focus 2). With `longTitle` the first station's title is LONG_WORDS_TITLE
// (Review Focus 5). With `gates: false` no pain has a gate (stored before it existed): the full results read their
// facts line instead of the analysis table.
function homeData(status = "complete", { oldTrace = false, longTitle = false, gates = true } = {}) {
  const watching = watchingPains(WATCHING_ROWS);
  const week = [RUN_ID, today()];
  const before = [OLD_RUN_ID, daysAgo(7)];
  const touched = new Map([
    ["dol-0100", seen(before, week)], ["dol-0101", seen(before, week)], ["dol-0102", seen(week)],
  ]);
  watching.pains.forEach((pain) => { pain.history = touched.get(pain.id) ?? seen(before); });
  // The duel's winner (dol-0101) has a version-3 card that says why it won.
  const winner = watching.cards.find((row) => row.pain_id === "dol-0101");
  winner.card = { ...winner.card, version: 3, duels: [{ against: "dol-0100", won: true, plain: WINNER_REASON }] };
  if (gates) watching.pains.find((pain) => pain.id === "dol-0101").gate = GATE_ONE_TIER;
  return {
    people: PEOPLE,
    summary: summary(status, oldTrace ? "2026-11-17-1" : RUN_ID),
    traces: [runTrace(RUN_ID, oldTrace ? daysAgo(7) : today())],
    pains: [
      { ...PAIN_0027, history: seen(before), ...(gates ? { gate: GATE_IN_RANGE } : {}) },
      { ...PAIN_0002, history: seen(before, week) },
      ...watching.pains,
      { id: "dol-0030", territory: "document-data-extraction", status: "manually-discarded", team_discard: { previous_status: "watching" } },
    ],
    cards: [
      { pain_id: "dol-0027", kind: "full", card: longTitle ? { ...FULL_CARD_V3, line: { ...FULL_CARD_V3.line, title: LONG_WORDS_TITLE } } : FULL_CARD_V3 },
      { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V1 },
      ...watching.cards,
      { pain_id: "dol-0030", kind: "line", card: { ...LINE_CARD_V2, pain_id: "dol-0030", line: {
        title: "Exportar tablas de PDF a hojas de cálculo",
        who: "Analistas que reciben informes en PDF; todavía no sabemos quién paga por esto.",
        what_hurts: "Copiar a mano las tablas de un PDF a una hoja de cálculo lleva horas y mete errores.",
      } } },
    ],
    marks: [
      { pain_id: "dol-0027", author: "carla@example.com", mark: "interested", created_at: "2026-11-10T22:10:00Z" },
      { pain_id: "dol-0002", author: "beto@example.com", mark: "interested", created_at: "2026-11-10T21:00:00Z" },
      { pain_id: "dol-0030", author: "ana@example.com", mark: "discarded", created_at: "2026-11-09T18:30:00Z" },
    ],
    comments: [],
  };
}

// A pain's detail: its row, its card, both marks (Carla interested, Beto discarded) and two comments, one of them
// Carla's own with markup that must show as literal text. Carla is the one signed in (ME).
export const MARKUP_COMMENT = "<b>Ojo</b> con el precio: <script>alert(1)</script>";
// It carries the week's trace too, as the base would: a pain opened first reads the week (loadWeek) for the top bar.
function detailData(painRow, cardRow) {
  return {
    people: PEOPLE,
    summary: summary(),
    traces: [runTrace(RUN_ID, today())],
    pains: [painRow],
    cards: [cardRow],
    marks: [
      { pain_id: painRow.id, author: "carla@example.com", mark: "interested", created_at: "2026-11-10T22:10:00Z" },
      { pain_id: painRow.id, author: "beto@example.com", mark: "discarded", created_at: "2026-11-10T20:40:00Z" },
    ],
    comments: [
      { id: 1, pain_id: painRow.id, author: "ana@example.com", body: "Conozco dos clubes con este problema.", created_at: "2026-11-10T22:15:00Z" },
      { id: 2, pain_id: painRow.id, author: "carla@example.com", body: MARKUP_COMMENT, created_at: "2026-11-10T23:05:00Z" },
    ],
  };
}

// detail-v3's data: the pain and its version-3 card with one more duel, against the version-1 line card (no title, so
// it goes by what hurts, also opened by direct link); and the cards of the rival it lost to and of that one.
export const V1_RIVAL_PLAIN = "Este dolor tiene más evidencia que el de las autorizaciones.";
function detailV3Data() {
  const card = { ...FULL_CARD_V3, duels: [...FULL_CARD_V3.duels, { against: "dol-0002", won: true, plain: V1_RIVAL_PLAIN }] };
  const data = detailData(PAIN_0027_DETAIL, { pain_id: "dol-0027", kind: "full", card });
  const rival = watchingPains(WATCHING_ROWS).cards.find((row) => row.pain_id === "dol-0101");
  data.cards.push(rival, { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V1 });
  return data;
}

const empty = () => ({ people: PEOPLE, summary: summary(), pains: [], cards: [], marks: [], comments: [] });

// A catalog with only a pain the team discarded: nothing to decide, so the home says so and points to the catalog.
function nothingToDecide() {
  const home = homeData();
  const only = (rows) => rows.filter((row) => (row.id ?? row.pain_id) === "dol-0030");
  return { ...home, pains: only(home.pains), cards: only(home.cards), marks: only(home.marks) };
}

// Corridas: this week's complete run, with a cut nobody mapped (kind `other`, Review Focus 3) and three duels (two
// pains the page has a card for, and one it does not); an incomplete run two weeks ago with some counts missing; and
// an older run that failed early with no sources, no counts, no cost and no end time. The raw texts carry RAW- so a
// check can tell they only show inside «Detalle técnico».
const INCOMPLETE_RUN_ID = "2026-10-27-1";
function fullRunTrace() {
  const base = runTrace(RUN_ID, today());
  return {
    ...base,
    cost: { total_usd: 3.66, by_model: [{ model: "Sonnet", usd: 1.64 }, { model: "Opus", usd: 0.93 }, { model: "Haiku", usd: 0.71 }], cards_usd: 0.38 },
    funnel: base.funnel.map((stage) => (stage.stage === "duel" ? { ...stage, count: 3 } : stage)),
    cuts: [
      ...base.cuts,
      { kind: "candidate-cap", count: 3, cap: 12, text: "3 candidatos no se pusieron a prueba por el tope de 12 por corrida; quedan en el catálogo con su evidencia", original: null },
      { kind: "other", count: null, cap: null, text: "Hubo un recorte más", original: "RAW-ORIGINAL second sentence the page cannot explain" },
    ],
    duels: [
      ...base.duels,
      { a: "dol-0100", b: "dol-0420", winner: "dol-0100", reason: "RAW-REASON second" },
      { a: "dol-0420", b: "dol-0421", winner: "dol-0421", reason: null },
    ],
  };
}
function incompleteRunTrace() {
  const base = runTrace(INCOMPLETE_RUN_ID, daysAgo(14));
  return {
    ...base, status: "incomplete", niche: { id: "nicho-ficticio-2", name: "Autorizaciones escolares" },
    finished_at: null, new_pains: 1, agents: { used: 180, cap: 180 },
    cost: { total_usd: 1.4, by_model: [{ model: "Sonnet", usd: 1.4 }], cards_usd: null },
    funnel: base.funnel.map((stage, i) => ({ ...stage, count: i === 2 || i > 6 ? null : stage.count })),
    cuts: [{ kind: "missing-verdicts", count: 4, cap: null, text: "4 pruebas a los candidatos quedaron sin respuesta; esos dolores no pueden darse por vivos esta semana", original: null }],
    duels: [],
  };
}
function failedRunTrace() {
  const base = runTrace(OLD_RUN_ID, daysAgo(7));
  return {
    ...base, status: "failed", niche: { id: null, name: null }, finished_at: null,
    cost: { total_usd: null, by_model: null, cards_usd: null }, agents: { used: null, cap: null },
    sources: null, ingest: null, funnel: base.funnel.map((stage) => ({ ...stage, count: null, cap: null })),
    cuts: [], duels: null, ranking: null, duel_kind: null, new_pains: null, cards: null,
  };
}
function runsData({ traces = [fullRunTrace(), failedRunTrace(), incompleteRunTrace()] } = {}) {
  const watching = watchingPains(WATCHING_ROWS);
  return {
    people: PEOPLE, summary: summary(), traces, pains: [], marks: [], comments: [],
    cards: watching.cards.filter((row) => row.pain_id === "dol-0100" || row.pain_id === "dol-0101"),
  };
}

// Nichos: the newest trace carries the chooser's fields (dolores/scripts/lib/trace.mjs: `choice`, `probe`, `why`,
// `territories`), every niche invented. Four territories: the one that ran this week, one competing, one vetoed by Ana
// in territory_vetoes (its stale ranking entry still listed, the veto wins) and one resting; two proposed niches, one
// active with its label and summary, one retired. Pains on two territories; an older paid run on the week's niche and
// one from before the chooser (no `choice`). With `counts` the week was counted without the judge (Review Focus 4); with
// `vetoedCurrent` Beto vetoed the week's niche after it ran (Review Focus 1); with `empty` no trace has a choice yet
// (Review Focus 2). The slugs are only ids: the page must never show one (NICHE_IDS).
export const NICHE_WEEK = "Huertos compartidos";
export const NICHE_COMPETING = "Clases de música a domicilio";
export const NICHE_COMPETING_ID = "music-lessons";
const NICHE_PROPOSED_SUMMARY = "Panaderías pequeñas que toman encargos por mensajes y pierden pedidos entre una conversación y otra.";
const NICHE_TERRITORIES = [
  { id: "shared-gardens", name: NICHE_WEEK },
  { id: NICHE_COMPETING_ID, name: NICHE_COMPETING },
  { id: "boat-rentals", name: "Alquiler de barcas de recreo" },
  { id: "pet-sitting", name: "Cuidado de mascotas en vacaciones" },
];
const NICHE_IDS = [...NICHE_TERRITORIES.map((t) => t.id), "bakery-orders", "tailor-shops"];
const NICHE_ANA_VETOED_AT = `${daysAgo(5)}T12:00:00Z`;
const NICHE_BETO_VETOED_AT = `${daysAgo(1)}T12:00:00Z`;
const NICHE_WHY = "Huertos compartidos trajo esta semana a la vez más quejas y más gasto que los otros nichos.";

function nicheTrace({ counts = false } = {}) {
  const source = counts ? "counts" : "judge";
  const entry = (name, score, complaints, spending, extra = {}) => ({
    name, score, complaints, spending, source, resting: false, resting_until: null, advanced_pains: null, ...extra,
  });
  return {
    ...runTrace(RUN_ID, today()),
    niche: { id: "shared-gardens", name: NICHE_WEEK },
    why: NICHE_WHY,
    territories: NICHE_TERRITORIES,
    choice: {
      territory: "shared-gardens", reason: "first", stalled: false,
      ranking: [
        entry("shared-gardens", 38, 41, 38, { advanced_pains: 2 }),
        entry("music-lessons", 22, 30, 22),
        entry("bakery-orders", 12, 18, 12),
        entry("boat-rentals", 9, 15, 9),
        entry("pet-sitting", 4, 9, 4, { resting: true, resting_until: daysAgo(-14) }),
      ],
    },
    probe: [
      { name: "shared-gardens", noise_share: counts ? null : 0.28, source },
      { name: "music-lessons", noise_share: counts ? null : 0.35, source },
      { name: "bakery-orders", noise_share: counts ? null : 0.41, source },
      { name: "boat-rentals", noise_share: counts ? null : 0.5, source },
      { name: "pet-sitting", noise_share: counts ? null : 0.2, source },
    ],
  };
}

function nichesData({ counts = false, vetoedCurrent = false, empty: noChoice = false } = {}) {
  // A trace from before the chooser: no `choice` at all.
  const older = { ...runTrace(OLD_RUN_ID, daysAgo(7)), niche: { id: "shared-gardens", name: NICHE_WEEK } };
  const traces = noChoice ? [{ ...runTrace(RUN_ID, today()), choice: null }, older] : [nicheTrace({ counts }), older];
  const pain = (id, territory, status) => ({ id, territory, status, team_discard: null });
  return {
    people: PEOPLE, summary: summary(), traces, cards: [], comments: [], marks: [],
    pains: [
      pain("dol-0500", "shared-gardens", "alive"), pain("dol-0501", "shared-gardens", "watching"),
      pain("dol-0502", "shared-gardens", "watching"), pain("dol-0510", "music-lessons", "watching"),
    ],
    niches: [
      { name: "bakery-orders", label: "Pedidos de panaderías de barrio", summary: NICHE_PROPOSED_SUMMARY, state: "active",
        state_by: null, state_changed_at: null, proposed_at: `${daysAgo(10)}T08:00:00Z` },
      { name: "tailor-shops", label: "Arreglos en talleres de costura", summary: "Talleres que apuntan los arreglos en papel y no saben cuándo avisar al cliente.",
        state: "retired", state_by: null, state_changed_at: `${daysAgo(20)}T08:00:00Z`, proposed_at: `${daysAgo(120)}T08:00:00Z` },
    ],
    vetoes: [
      { name: "boat-rentals", vetoed_by: "ana@example.com", vetoed_at: NICHE_ANA_VETOED_AT },
      ...(vetoedCurrent ? [{ name: "shared-gardens", vetoed_by: "beto@example.com", vetoed_at: NICHE_BETO_VETOED_AT }] : []),
    ],
  };
}

// ---- scenarios ----------------------------------------------------------------------------------

// Each scenario: the hash it opens, whether a session is injected, a pending sign-in (the code screen), the data, the
// reads or calls that fail, the selector that says the screen is ready, and the h1 the screen must have. The ready
// selector and the h1 together belong to that screen alone, so a scenario never measures another screen (the access
// error, a pain's load error, the home behind a notice). `open` lists what is pressed once the screen is ready (a
// fold's summary). `mustShow` lists selectors that must be visible; `mustRead` and `mustNotRead` texts that must or must
// not be on the screen as a person reads it (innerText: a closed fold's text is not read). `mar14: false` leaves a
// scenario out of the MAR-14 h1 check, and `mar14: <px>` holds it to that figure instead of 160 (both in EXCEPTIONS);
// `note` says why (printed as a NOTE line).
const PAIN_MAR14 = 180; // a pain at 320 × 640: the masthead (88 px), «← Volver» and a title on two lines
const HOME_LIST = ".stations";
const ANALYSIS = [T.analysisCaption.toLocaleUpperCase("es"), T.analysisIn, T.analysisOut];
const CATALOG_LIST = ".pain-list";
const MORE_BUTTON = `button.link-button:text-is("${T.showMore.replace("{count}", "20")}")`;
const runTitleOn = (day) => fill(T.runTitleDated, { date: formatDate(day) });
const NICHE_TABLE = ".niche-table";
const NICHE_JUDGE_NOTE = T.nicheNoteJudge.split("{")[0];
export function scenarios() {
  const oldLine = fill(T.lineTitleOld, { date: formatDate(daysAgo(7)) });
  const weekRow = `.niche-table tr:has(.niche-name:text-is("${NICHE_WEEK}"))`; // the week's niche's own row in the table
  return [
    { name: "sign-in-email", hash: "", signedIn: false, data: empty(), ready: "#email", expectedTitle: T.signInTitle },
    { name: "sign-in-code", hash: "", signedIn: false, pendingSignIn: ME, data: empty(), ready: "#code", expectedTitle: T.codeTitle },
    { name: "no-access", hash: "#/", data: { ...homeData(), people: [] }, ready: "[data-rol=cuerpo] .stack > .notice", expectedTitle: T.noAccessTitle },
    // This week's run left its trace: the line is «Línea de la corrida», each stage drawn in its final state; its one
    // unmapped cut is counted.
    // The pain with weight reads in range, the winner out of range on its types of source (counted within one country),
    // and the compact ones without a gate keep their facts line.
    { name: "home", hash: "#/", data: homeData(), ready: HOME_LIST, expectedTitle: T.homeTitle,
      mustRead: [T.lineTitle, WINNER_REASON, T.resultsLabel.toLocaleUpperCase("es"), T.analysisIn, T.analysisOut, T.analysisPerCountry,
        fill(T.factTestimoniesMany, { count: 4 })],
      mustNotRead: [T.analysisNone] },
    // Review Focus 2: the week's run left no trace; the line is the one before, by its date, drawn in its final state.
    // Its pains were stored before the gate existed: the full results say so in words where the table would be, and why
    // they are there in their facts line, with no range.
    { name: "home-old-trace", hash: "#/", data: homeData("complete", { oldTrace: true, gates: false }), ready: HOME_LIST, expectedTitle: T.homeTitle,
      mustRead: [oldLine, T.analysisNone, fill(T.factAttacks, { held: 4, total: 5 }), fill(T.factTestimoniesMany, { count: 4 })],
      mustNotRead: [T.analysisIn, T.analysisOut] },
    { name: "home-failed-run", hash: "#/", data: homeData("failed", { oldTrace: true }),
      ready: `[data-rol=avisos]:has(.notice--warning) ~ [data-rol=cuerpo] ${HOME_LIST}`, expectedTitle: T.homeTitle, mustRead: [T.runFailed, oldLine] },
    // Review Focus 5: the first station's title is 48 characters of long Spanish words.
    { name: "home-long-title", hash: "#/", data: homeData("complete", { longTitle: true }), ready: HOME_LIST, expectedTitle: T.homeTitle,
      mustRead: [LONG_WORDS_TITLE] },
    { name: "home-nothing-to-decide", hash: "#/", data: nothingToDecide(), ready: ".decide-empty", expectedTitle: T.homeTitle, mustRead: [T.decideEmpty] },
    { name: "home-empty", hash: "#/", data: empty(), ready: "[data-rol=vacio] .week-sentence", expectedTitle: T.homeTitle },
    { name: "home-error", hash: "#/", data: homeData(), ready: "[data-rol=avisos] .notice--error", expectedTitle: T.homeTitle,
      fail: { pains: { status: 500, body: { code: "XX000", message: "fixture failure", details: null, hint: null }, sticky: true } } },
    { name: "catalog", hash: "#/catalogo", data: homeData(), ready: CATALOG_LIST, expectedTitle: T.catalogTitle, mustShow: [MORE_BUTTON] },
    { name: "catalog-empty", hash: "#/catalogo", data: empty(), ready: "[data-rol=vacio] .week-sentence", expectedTitle: T.catalogTitle },
    // A version-2 card: «Cómo llegamos» has the quotes and each attack's question and result, with no plain line.
    { name: "detail-v2", mar14: PAIN_MAR14, hash: "#/dolor/dol-0027",
      data: detailData(PAIN_0027_DETAIL, { pain_id: "dol-0027", kind: "full", card: FULL_CARD }), ready: ".detail-actions", expectedTitle: FULL_CARD.line.title,
      mustRead: ANALYSIS, mustNotRead: [T.statusWeighty, T.analysisNone] },
    // A version-3 card: a plain line per attack and per duel, opened directly (the Monday email's link). The rival with
    // a title (dol-0101) goes by it, the version-1 one (dol-0002) by what hurts, and the one without a card (dol-0420)
    // by «otro dolor del catálogo».
    { name: "detail-v3", mar14: PAIN_MAR14, hash: "#/dolor/dol-0027", data: detailV3Data(), ready: ".how-rows", expectedTitle: FULL_CARD.line.title,
      mustRead: [fill(T.duelAgainst, { title: LINE_CARD_V1.line.what_hurts }), T.duelAgainstOther, V1_RIVAL_PLAIN, ...ANALYSIS] },
    // A full card whose pain was stored before the gate existed: no «Análisis», one line in words where it would be.
    { name: "detail-no-gate", mar14: PAIN_MAR14, hash: "#/dolor/dol-0027",
      data: detailData(PAIN_0027, { pain_id: "dol-0027", kind: "full", card: FULL_CARD }), ready: ".detail-actions", expectedTitle: FULL_CARD.line.title,
      mustRead: [T.statusWeighty, T.analysisNone], mustNotRead: ANALYSIS },
    { name: "detail-long-title", mar14: PAIN_MAR14, hash: "#/dolor/dol-0027",
      data: detailData(PAIN_0027_DETAIL, { pain_id: "dol-0027", kind: "full", card: FULL_CARD_LONG_TITLE }), ready: ".detail-actions", expectedTitle: LONGEST_TITLE },
    { name: "detail-line", mar14: PAIN_MAR14, hash: "#/dolor/dol-0002",
      data: detailData(PAIN_0002, { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V2 }), ready: ".detail-notice", expectedTitle: LINE_CARD_V2.line.title,
      mustRead: [T.analysisNone], mustNotRead: ANALYSIS },
    { name: "detail-line-v1", hash: "#/dolor/dol-0002",
      data: detailData(PAIN_0002, { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V1 }), ready: ".detail-notice",
      mar14: false, expectedTitle: LINE_CARD_V1.line.what_hurts,
      note: "detail-line-v1 is left out of MAR-14: a version-1 card has no line.title, so its h1 is what_hurts (a full sentence of several lines). It is a transitional exception: the next run rewrites every card with a title." },
    { name: "detail-missing", hash: "#/dolor/dol-9999", data: detailData(PAIN_0027, { pain_id: "dol-0027", kind: "full", card: FULL_CARD }),
      ready: "[data-rol=avisos] .notice--info", expectedTitle: T.painTitle },
    { name: "runs", hash: "#/corridas", data: runsData(), ready: ".run-list", expectedTitle: T.runsTitle },
    { name: "runs-empty", hash: "#/corridas", data: runsData({ traces: [] }), ready: "[data-rol=vacio] .week-sentence", expectedTitle: T.runsTitle },
    // Review Focus 3: the two cuts nobody mapped are counted in one line; their raw sentences stay inside the closed
    // «Detalle técnico».
    // Finish review 6: said once, in «Lo que se recortó», pointing to «Detalle técnico»; the line has no «Otros recortes».
    { name: "run-detail", hash: `#/corridas/${RUN_ID}`, data: runsData(), ready: ".run-line", expectedTitle: runTitleOn(today()),
      mustRead: [fill(T.runCutsOtherMany, { count: 2 })], mustNotRead: [T.cutOther, T.otherCuts] },
    { name: "run-detail-technical", hash: `#/corridas/${RUN_ID}`, data: runsData(), ready: ".run-line", expectedTitle: runTitleOn(today()),
      open: ["details.run-tech > summary"], mustShow: [".run-tech-body"], mustRead: [T.techLead, "RAW-ORIGINAL", "RAW-REASON second", "RAW-NOTE"] },
    { name: "run-failed", hash: `#/corridas/${OLD_RUN_ID}`, data: runsData(), ready: ".run-line", expectedTitle: runTitleOn(daysAgo(7)) },
    { name: "run-missing", hash: "#/corridas/2020-01-01-1", data: runsData(), ready: "[data-rol=avisos] .notice--info", expectedTitle: T.runTitle },
    // Nichos: the week's niche and why, then every candidate in each state, the proposed one with its summary, and the
    // vetoed one with who and «Quitar veto». No slug anywhere.
    { name: "niches", hash: "#/nichos", data: nichesData(), ready: NICHE_TABLE, expectedTitle: T.nichesTitle,
      mustRead: [T.nicheWhyLabel, T.nicheSignalIn, T.nicheStateResting, T.nicheStateVetoed, T.nicheStateRetired, T.nicheUnveto,
        NICHE_PROPOSED_SUMMARY, fill(T.nicheVetoedBy, { name: "Ana", date: formatDayMonth(NICHE_ANA_VETOED_AT) })],
      mustNotRead: [...NICHE_IDS, T.nicheNoiseUnmeasured] },
    // Review Focus 1: the week's niche was vetoed after it ran. The week block says «Vetado» with who and when, that the
    // next Monday runs another, and offers «Quitar veto»; its row in the table agrees.
    { name: "niches-vetoed-current", hash: "#/nichos", data: nichesData({ vetoedCurrent: true }), ready: NICHE_TABLE, expectedTitle: T.nichesTitle,
      mustRead: [T.nicheVetoNextVetoed, fill(T.nicheVetoedBy, { name: "Beto", date: formatDayMonth(NICHE_BETO_VETOED_AT) }), T.nicheUnveto],
      mustNotRead: [T.nicheVetoWeek, T.nicheNoVeto, T.nicheVetoNext, ...NICHE_IDS],
      mustShow: [".niche-week .station-state[data-lamp=red]", `${weekRow} .niche-state[data-lamp=red]`,
        `${weekRow} .niche-who:text-is("${fill(T.nicheVetoedBy, { name: "Beto", date: formatDayMonth(NICHE_BETO_VETOED_AT) })}")`,
        `${weekRow} .niche-veto:text-is("${T.nicheUnveto}")`] },
    // Review Focus 4: the week was counted, not judged: «Ruido» reads «sin medir» and the note says why.
    { name: "niches-counts", hash: "#/nichos", data: nichesData({ counts: true }), ready: NICHE_TABLE, expectedTitle: T.nichesTitle,
      mustRead: [T.nicheNoiseUnmeasured, T.nicheNoteCounts], mustNotRead: [NICHE_JUDGE_NOTE, ...NICHE_IDS] },
    // Review Focus 2: no trace has a choice yet: the empty sentence and the way to load again, nothing else.
    { name: "niches-empty", hash: "#/nichos", data: nichesData({ empty: true }), ready: "[data-rol=vacio] .week-sentence", expectedTitle: T.nichesTitle,
      mustRead: [T.nichesEmpty, T.reload], mustNotRead: [T.nicheWhyLabel, T.nicheVeto, T.nichesError, ...NICHE_IDS] },
    { name: "niches-error", hash: "#/nichos", data: nichesData(), ready: "[data-rol=avisos] .notice--error", expectedTitle: T.nichesTitle,
      mustRead: [T.nichesError], mustNotRead: NICHE_IDS,
      fail: { niches: { status: 500, body: { code: "XX000", message: "fixture failure", details: null, hint: null }, sticky: true } } },
  ];
}

// ---- the fake Supabase --------------------------------------------------------------------------

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

// A session as supabase-js stores it, valid for an hour. The token is JWT-shaped; nothing checks its signature.
export function fakeSession(email = ME) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email,
    email_confirmed_at: "2026-11-01T00:00:00Z", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
    identities: [], created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", is_anonymous: false,
  };
  const token = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: user.id, email, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now })}.fixture`;
  return { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "fixture-refresh", user };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range, x-supabase-api-version",
};

// Rows of a table filtered by PostgREST `col=eq.value` and `col=in.(a,b)` parameters.
function filtered(rows, params) {
  const eqs = [...params].filter(([key, value]) => key !== "select" && value.startsWith("eq.")).map(([key, value]) => [key, value.slice(3)]);
  const ins = [...params].filter(([key, value]) => key !== "select" && value.startsWith("in.("))
    .map(([key, value]) => [key, value.slice(4, -1).split(",").map((v) => v.replace(/^"(.*)"$/, "$1"))]);
  return rows.filter((row) => eqs.every(([key, value]) => String(row[key]) === value)
    && ins.every(([key, values]) => values.includes(String(row[key]))));
}

// The one projection the fake makes: the duel rivals' titles and what hurts (api.js, rivalTitles), as PostgREST answers
// it (`->>` gives a string or null).
const TITLES_SELECT = "pain_id,title:card->line->>title,what_hurts:card->line->>what_hurts";
const lineText = (row, key) => (row.card && row.card.line && typeof row.card.line[key] === "string" ? row.card.line[key] : null);
const project = (rows, select) => (select === TITLES_SELECT
  ? rows.map((row) => ({ pain_id: row.pain_id, title: lineText(row, "title"), what_hurts: lineText(row, "what_hurts") }))
  : rows);

// Installs the fake on a page. `state` is { data, fail } and may change while the page runs (a behaviour check sets
// `state.fail.add_comment` before pressing «Publicar»). A failure is { status, body, sticky }: without `sticky` it
// answers once. Returns what the page asked that the fake does not know (`unknown`) and the URLs it failed on purpose
// (`failedUrls`, so the runner can tell the browser's «Failed to load resource» for them from a real error), and every
// function called with what it was sent (`rpcs`, so a behaviour can check a veto's `p_vetoed`).
export async function installFakeSupabase(page, state) {
  const log = { unknown: [], failedUrls: new Set(), calls: [], rpcs: [] };
  const data = state.data;
  const takeFailure = (name) => {
    const failure = state.fail && state.fail[name];
    if (failure && !failure.sticky) delete state.fail[name];
    return failure || null;
  };

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (status, body) => route.fulfill({
      status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
      body: body === undefined ? "" : JSON.stringify(body),
    });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = url.pathname;
    log.calls.push(`${method} ${path}`);
    let payload = {};
    try { payload = request.postData() ? JSON.parse(request.postData()) : {}; } catch { payload = {}; }

    // Auth.
    if (path === "/auth/v1/user") return json(200, fakeSession().user);
    if (path === "/auth/v1/otp" && method === "POST") return json(200, {});
    if (path === "/auth/v1/verify" && method === "POST") {
      if (payload.token !== CODE) {
        log.failedUrls.add(url.href);
        return json(403, { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid" });
      }
      return json(200, fakeSession(String(payload.email || ME)));
    }
    if (path === "/auth/v1/logout" && method === "POST") return route.fulfill({ status: 204, headers: CORS });

    // Tables.
    const table = /^\/rest\/v1\/(people|pains|pain_cards|marks|comments|niches|territory_vetoes)$/.exec(path);
    if (table && method === "GET") {
      const name = table[1];
      const failure = takeFailure(name);
      if (failure) { log.failedUrls.add(url.href); return json(failure.status, failure.body); }
      const rows = {
        people: data.people, pains: data.pains, pain_cards: data.cards, marks: data.marks, comments: data.comments,
        niches: data.niches ?? [], territory_vetoes: data.vetoes ?? [],
      }[name];
      return json(200, project(filtered(rows, url.searchParams), url.searchParams.get("select")));
    }

    // Functions.
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (rpc && method === "POST") {
      const name = rpc[1];
      log.rpcs.push({ name, payload });
      const failure = takeFailure(name);
      if (failure) { log.failedUrls.add(url.href); return json(failure.status, failure.body); }
      if (name === "week_summary") return json(200, data.summary);
      if (name === "run_traces") return json(200, data.traces ?? []);
      if (name === "set_mark") {
        data.marks = data.marks.filter((m) => !(m.pain_id === payload.p_pain_id && m.author === ME));
        if (payload.p_mark) data.marks.push({ pain_id: payload.p_pain_id, author: ME, mark: payload.p_mark, created_at: new Date().toISOString() });
        return json(200, null);
      }
      if (name === "add_comment") {
        const body = String(payload.p_body ?? "").trim();
        if (!body || [...body].length > 500) {
          log.failedUrls.add(url.href);
          return json(400, { code: "22023", message: "comment must be 1 to 500 characters", details: null, hint: null });
        }
        const id = Math.max(0, ...data.comments.map((c) => c.id)) + 1;
        data.comments.push({ id, pain_id: payload.p_pain_id, author: ME, body, created_at: new Date().toISOString() });
        return json(200, id);
      }
      if (name === "delete_comment") {
        const before = data.comments.length;
        data.comments = data.comments.filter((c) => !(c.id === payload.p_id && c.author === ME));
        if (before === data.comments.length) {
          log.failedUrls.add(url.href);
          return json(400, { code: "P0002", message: "comment not found", details: null, hint: null });
        }
        return json(200, null);
      }
      // As the base's set_niche_veto: a proposed niche (a name in `niches`) changes its own state, by and when, lifting
      // only a vetoed one; any other slug is a territory, its row in territory_vetoes added (the first one kept) or
      // removed; anything else is not a slug (P0002). So a reload reads what the veto left.
      if (name === "set_niche_veto") {
        const slug = String(payload.p_name ?? "");
        const at = new Date().toISOString();
        data.niches = data.niches ?? [];
        data.vetoes = data.vetoes ?? [];
        const niche = data.niches.find((n) => n.name === slug);
        if (niche) {
          if (payload.p_vetoed) Object.assign(niche, { state: "vetoed", state_by: ME, state_changed_at: at });
          else if (niche.state === "vetoed") Object.assign(niche, { state: "active", state_by: ME, state_changed_at: at });
          return json(200, null);
        }
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) {
          log.failedUrls.add(url.href);
          return json(400, { code: "P0002", message: `set_niche_veto: unknown niche ${slug}`, details: null, hint: null });
        }
        if (!payload.p_vetoed) data.vetoes = data.vetoes.filter((v) => v.name !== slug);
        else if (!data.vetoes.some((v) => v.name === slug)) data.vetoes.push({ name: slug, vetoed_by: ME, vetoed_at: at });
        return json(200, null);
      }
    }

    log.unknown.push(`${method} ${path}`);
    log.failedUrls.add(url.href);
    return json(404, { code: "PGRST000", message: "not in the browser checks' fake" });
  });
  return log;
}

// Before the page's own scripts: a session under supabase-js's key (signed-in scenarios) and, for the code screen, the
// address a code was just sent to.
export async function prepareStorage(page, { signedIn, pendingSignIn }) {
  await page.addInitScript(({ key, session, pending }) => {
    try {
      if (session) localStorage.setItem(key, JSON.stringify(session));
      if (pending) sessionStorage.setItem("dolores-portal.pending-sign-in", JSON.stringify({ email: pending, sentAt: Date.now() }));
    } catch { /* storage blocked: the page will show the sign-in */ }
  }, { key: STORAGE_KEY, session: signedIn ? fakeSession() : null, pending: pendingSignIn || null });
}
