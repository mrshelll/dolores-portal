// The browser checks' fake Supabase and their scenarios. Every request to the project's URL is answered here through
// page.route, so the real supabase-js (from jsDelivr) runs against data we choose, both on the local server and on the
// published page. A signed-in scenario injects a session into localStorage under supabase-js's own key before the page
// loads. The data has the base's shapes (a full card, a version-1 line card and its version-2 rewrite), but every text
// in it is invented: this repository is public and carries no catalog data.

import { T } from "../../js/text.js";

export const SUPABASE_ORIGIN = "https://hphrlkvkefztxvlamrmh.supabase.co";
export const STORAGE_KEY = "sb-hphrlkvkefztxvlamrmh-auth-token";
export const ME = "miguel@example.com";
export const CODE = "12345678";

// ---- data -------------------------------------------------------------------------------------

const PEOPLE = [
  { email: "miguel@example.com", name: "Miguel" },
  { email: "jaime@example.com", name: "Jaime" },
  { email: "fabio@example.com", name: "Fabio" },
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
const summary = (status = "complete") => ({
  run_id: "2026-11-10-3", date: today(), status, territory: "documents-for-ai", reasons: [], new_pains: 6, items_reviewed: 480,
});

const PAIN_0027 = { id: "dol-0027", territory: "accounting-automation", status: "alive", team_discard: null };
const PAIN_0002 = { id: "dol-0002", territory: null, status: "watching", team_discard: null };

// The home: one pain with weight (dol-0027, Miguel finds it interesting), one marked interested while under watch
// (dol-0002, the store's version-1 line card), 55 under watch, and one the team discarded (dol-0030).
function homeData(status = "complete") {
  const watching = watchingPains(WATCHING_ROWS);
  return {
    people: PEOPLE,
    summary: summary(status),
    pains: [
      PAIN_0027,
      PAIN_0002,
      ...watching.pains,
      { id: "dol-0030", territory: "document-data-extraction", status: "manually-discarded", team_discard: { previous_status: "watching" } },
    ],
    cards: [
      { pain_id: "dol-0027", kind: "full", card: FULL_CARD },
      { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V1 },
      ...watching.cards,
      { pain_id: "dol-0030", kind: "line", card: { ...LINE_CARD_V2, pain_id: "dol-0030", line: {
        title: "Exportar tablas de PDF a hojas de cálculo",
        who: "Analistas que reciben informes en PDF; todavía no sabemos quién paga por esto.",
        what_hurts: "Copiar a mano las tablas de un PDF a una hoja de cálculo lleva horas y mete errores.",
      } } },
    ],
    marks: [
      { pain_id: "dol-0027", author: "miguel@example.com", mark: "interested", created_at: "2026-11-10T22:10:00Z" },
      { pain_id: "dol-0002", author: "jaime@example.com", mark: "interested", created_at: "2026-11-10T21:00:00Z" },
      { pain_id: "dol-0030", author: "fabio@example.com", mark: "discarded", created_at: "2026-11-09T18:30:00Z" },
    ],
    comments: [],
  };
}

// A pain's detail: its row, its card, both marks (Miguel interested, Jaime discarded) and two comments, one of them
// Miguel's own with markup that must show as literal text.
export const MARKUP_COMMENT = "<b>Ojo</b> con el precio: <script>alert(1)</script>";
function detailData(painRow, cardRow) {
  return {
    people: PEOPLE,
    summary: summary(),
    pains: [painRow],
    cards: [cardRow],
    marks: [
      { pain_id: painRow.id, author: "miguel@example.com", mark: "interested", created_at: "2026-11-10T22:10:00Z" },
      { pain_id: painRow.id, author: "jaime@example.com", mark: "discarded", created_at: "2026-11-10T20:40:00Z" },
    ],
    comments: [
      { id: 1, pain_id: painRow.id, author: "fabio@example.com", body: "Conozco dos clubes con este problema.", created_at: "2026-11-10T22:15:00Z" },
      { id: 2, pain_id: painRow.id, author: "miguel@example.com", body: MARKUP_COMMENT, created_at: "2026-11-10T23:05:00Z" },
    ],
  };
}

const empty = () => ({ people: PEOPLE, summary: summary(), pains: [], cards: [], marks: [], comments: [] });

// ---- scenarios ----------------------------------------------------------------------------------

// Each scenario: its pattern for verificarPagina, the hash it opens, whether a session is injected, a pending sign-in
// (the code screen), the data, the reads or calls that fail, the selector that says the screen is ready, and the h1 the
// screen must have. The ready selector and the h1 together belong to that screen alone, so a scenario never measures
// another screen (the access error, a pain's load error, the home behind a notice). `mustShow` lists selectors that must
// be visible. `mar14: false` leaves a scenario out of the MAR-14 h1 check; `note` says why (printed as a NOTE line).
const HOME_LIST = ".pain-list";
const MORE_BUTTON = `button.link-button:text-is("${T.showMore.replace("{count}", "20")}")`;
export function scenarios() {
  return [
    { name: "sign-in-email", pattern: "formulario", hash: "", signedIn: false, data: empty(), ready: "#email", expectedTitle: T.signInTitle },
    { name: "sign-in-code", pattern: "formulario", hash: "", signedIn: false, pendingSignIn: ME, data: empty(), ready: "#code", expectedTitle: T.codeTitle },
    { name: "home", pattern: "lista", hash: "#/", data: homeData(), ready: HOME_LIST, expectedTitle: T.homeTitle, mustShow: [MORE_BUTTON] },
    { name: "home-failed-run", pattern: "lista", hash: "#/", data: homeData("failed"), ready: `[data-rol=avisos]:has(.notice--warning) ~ [data-rol=cuerpo] ${HOME_LIST}`,
      expectedTitle: T.homeTitle, mustShow: [MORE_BUTTON] },
    { name: "home-empty", pattern: "lista", hash: "#/", data: empty(), ready: "[data-rol=vacio] .week-sentence", expectedTitle: T.homeTitle },
    { name: "home-error", pattern: "lista", hash: "#/", data: homeData(), ready: "[data-rol=avisos] .notice--error", expectedTitle: T.homeTitle,
      fail: { pains: { status: 500, body: { code: "XX000", message: "fixture failure", details: null, hint: null }, sticky: true } } },
    { name: "no-access", pattern: "otro", hash: "#/", data: { ...homeData(), people: [] }, ready: "[data-rol=cuerpo] .stack > .notice", expectedTitle: T.noAccessTitle },
    { name: "detail-full", pattern: "detalle", hash: "#/dolor/dol-0027",
      data: detailData(PAIN_0027, { pain_id: "dol-0027", kind: "full", card: FULL_CARD }), ready: ".detail-actions", expectedTitle: FULL_CARD.line.title },
    { name: "detail-long-title", pattern: "detalle", hash: "#/dolor/dol-0027",
      data: detailData(PAIN_0027, { pain_id: "dol-0027", kind: "full", card: FULL_CARD_LONG_TITLE }), ready: ".detail-actions", expectedTitle: LONGEST_TITLE },
    { name: "detail-line", pattern: "detalle", hash: "#/dolor/dol-0002",
      data: detailData(PAIN_0002, { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V2 }), ready: ".detail-notice", expectedTitle: LINE_CARD_V2.line.title },
    { name: "detail-line-v1", pattern: "detalle", hash: "#/dolor/dol-0002",
      data: detailData(PAIN_0002, { pain_id: "dol-0002", kind: "line", card: LINE_CARD_V1 }), ready: ".detail-notice",
      mar14: false, expectedTitle: LINE_CARD_V1.line.what_hurts,
      note: "detail-line-v1 is left out of MAR-14: a version-1 card has no line.title, so its h1 is what_hurts (a full sentence of several lines). It is a transitional exception: the next run rewrites every card with a title." },
    { name: "detail-missing", pattern: "otro", hash: "#/dolor/dol-9999", data: detailData(PAIN_0027, { pain_id: "dol-0027", kind: "full", card: FULL_CARD }),
      ready: "[data-rol=avisos] .notice--info", expectedTitle: T.painTitle },
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

// Rows of a table filtered by PostgREST `col=eq.value` parameters.
function filtered(rows, params) {
  const eqs = [...params].filter(([key, value]) => key !== "select" && value.startsWith("eq.")).map(([key, value]) => [key, value.slice(3)]);
  return rows.filter((row) => eqs.every(([key, value]) => String(row[key]) === value));
}

// Installs the fake on a page. `state` is { data, fail } and may change while the page runs (a behaviour check sets
// `state.fail.add_comment` before pressing «Publicar»). A failure is { status, body, sticky }: without `sticky` it
// answers once. Returns what the page asked that the fake does not know (`unknown`) and the URLs it failed on purpose
// (`failedUrls`, so the runner can tell the browser's «Failed to load resource» for them from a real error).
export async function installFakeSupabase(page, state) {
  const log = { unknown: [], failedUrls: new Set(), calls: [] };
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
    const table = /^\/rest\/v1\/(people|pains|pain_cards|marks|comments)$/.exec(path);
    if (table && method === "GET") {
      const name = table[1];
      const failure = takeFailure(name);
      if (failure) { log.failedUrls.add(url.href); return json(failure.status, failure.body); }
      const rows = { people: data.people, pains: data.pains, pain_cards: data.cards, marks: data.marks, comments: data.comments }[name];
      return json(200, filtered(rows, url.searchParams));
    }

    // Functions.
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (rpc && method === "POST") {
      const name = rpc[1];
      const failure = takeFailure(name);
      if (failure) { log.failedUrls.add(url.href); return json(failure.status, failure.body); }
      if (name === "week_summary") return json(200, data.summary);
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
