# dolores-portal

tomoshi: the page where the team on the access list reads the week's pains and decides which to work on. Each person
signs in with their email and an 8-digit code that arrives by email; only addresses on the team's list (the `people`
table in Supabase) see anything. Someone who signs in with another address sees a «sin permiso» screen that tells them
whom to ask.

It is a static site (HTML, CSS and ES modules, no build, no npm dependencies) published with GitHub Pages at
`https://mrshelll.github.io/dolores-portal/`. It talks to the Supabase project `dolores` with the publishable key and
supabase-js 2.117.2 from jsDelivr. The schema, the weekly run and the allow-list live in the private `dolores` repo.

Everything a person reads is in Spanish and addresses them as «tú»; code, comments and tests are in English. The
screens follow the factory's visual manual (fundamentos, marco, estados, navegación and the `formulario` pattern for
signing in), and the code email follows `patrones/correo-aviso.md`, COR-10 to COR-13.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page shell, and a «could not load» notice if the app has not started after 10 seconds |
| `.nojekyll` | Empty: GitHub Pages serves the files as they are, without running Jekyll |
| `config.js` | Public Supabase configuration: the URL, the publishable key and the code length (8) |
| `css/base.css` | The page's one stylesheet, in the category standard: tokens (white ground, grey panels and hairlines, one blue accent, green in range and red out of range, light and dark by the system's setting, Geist with tabular figures, a 4 px spacing step) and every screen's styles: the masthead and its tabs, the rows, a pain's checks, the run's line, the sign-in's panel, buttons, fields and notices |
| `js/app.js` | Session, hash router (`#/` home, `#/dolor/<id>` a pain) and the screens: sign-in (email, then code), «sin permiso», the home with the week's pains, and a pain's card with the team's marks and comments |
| `js/text.js` | Every visible string (`T`), the plain names of the territories (`TOPICS`, `topicName`) and `formatDate` |
| `js/model.js` | The home's logic, without DOM or network: the section of each pain (`buildSections`, with the run's `effectiveMark`), the week's sentence, the notice about the run, what a failed read means (`classifyError`) and loading by parts |
| `js/niches.js` | Nichos' logic, without DOM or network: the board (`nicheBoard`: the week's niche and how its run went, every candidate with its state, figures and pains), the veto mirrored once the base took it (`withVeto`), and the tab's counts in words |
| `js/checks.js` | A pain's checks (`checkRows`, model.js: its judged counts against the run's own thresholds) drawn twice: a closed row's stack of ✓/✗ lines with their words (`checkStack`), and an open row's or a pain's page's box cells, each with its value, its boxes filled to an ink rule at the threshold, its verdict in words and its minimum (`checkCells`) |
| `js/api.js` | `loadHome(client)`, `loadPain(client, id)` and `loadNiches(client)`: what the home, a pain and Nichos read; `setMark`, `addComment`, `deleteComment` and `setNicheVeto`: the four writes, through the base's functions. The client is passed in |
| `js/detail.js` | A pain's logic, without DOM or network: its title, status tag and key data, its card sections and quotes, the marks and comments to show, what a failed write means, and the comment kept across a lost session |
| `js/auth-errors.js` | Turns a Supabase Auth error into what the screen says: rate limit, the hourly email cap, wrong or expired code, no connection, other |
| `js/access.js` | `accessState(peopleRows, email)`: «member» or «no-access» |
| `js/dom.js` | A tiny DOM builder; text always goes in as text, never as markup |
| `js/supabase-client.js` | The only module that loads supabase-js |
| `supabase/templates/` | The sign-in code email: `otp-code.html` and `otp-code.subject.txt`, pasted in the Supabase panel |
| `tests/unit/` | Unit tests for the pure modules and the email template |
| `tests/browser/` | The browser checks: `run-checks.mjs` (the runner), `fixtures.mjs` (the fake Supabase and the scenarios), `static-server.mjs` |

## How access works

The publishable key in `config.js` is public by design: Row Level Security in Supabase holds every rule. A signed-in
person reads `people` (`select email,name`). RLS shows its rows only to people on the list, so a member gets at least
their own row and anyone else gets none: zero rows is «sin permiso», never an empty list. Every screen checks this
again, so someone taken off the list while signed in sees «sin permiso» on their next step. Never put any other key in
this repository.

## Tests

```sh
npm test
```

Runs `node --test tests/unit/` (Node 25 or newer, no browser, no install). The tests cover the auth error mapping, the
access rule, the home's and a pain's logic, reads and writes (with a fake client), the visible strings (none carries an
internal word such as a pain id, a territory slug, «tier», «lente», «score» or «underserved», whole words only, so
«excelente» is fine; and each weekly run is a «corrida», as the «Corridas» tab calls it, never a «revisión»), the
territory names and the code email's rules.

To look at the page locally, serve the folder and open it (signing in needs the real Supabase project):

```sh
python3 -m http.server 8000
```

## Browser checks

Every screen is also measured in Chrome, so the page is known to work at every width and in both colour schemes
before it is published:

```sh
node tests/browser/run-checks.mjs --factory "<software-factory repo>" --out <dir> [--url <base>]
```

- `--factory` (required): the software-factory repo. The runner imports `abrirNavegador` and `rutaAxe` from
  `design-system/assets/playwright-cache.mjs`, which loads playwright-core 1.63.0 and axe-core 4.13.0 from
  `~/.cache/fabrica-software` and uses the installed Google Chrome (or `FABRICA_CHROME`). Nothing is installed in this
  repo. The factory retired its screen rules (`reglas-pantalla.mjs`) on 2026-11-18; the checks below are the page's own.
- `--out` (required): where the screenshots go, one per screen as `<scenario>-<width>-<scheme>.png` (full page). The
  folder is created if missing. Keep it outside the repo; screenshots are never committed.
- `--url` (optional): the page to measure. By default the runner serves this folder on 127.0.0.1 at a free port
  (`tests/browser/static-server.mjs`). To check the published page, pass `--url https://mrshelll.github.io/dolores-portal/`.

Exit codes: `0` everything passed; `1` a check failed (each failure is printed under its `FAIL` line); `2` a usage
error (a missing or unknown flag, a `--factory` without `playwright-cache.mjs`); `3` Chrome, playwright or axe is
missing or Chrome did not start.

The page loads the real supabase-js from jsDelivr and its font from Google Fonts, so the run needs internet; the runner
fetches each once and serves it from memory to every screen. Every request to the Supabase project is answered by a
fake (`tests/browser/fixtures.mjs`, through `page.route`), also with `--url`: no screen ever touches the real base,
and a signed-in screen gets a session injected into `localStorage` under supabase-js's own key. The data has the base's
shapes (run traces, a version-3 card, a version-2 card, a version-1 line card and its version-2 rewrite, 55 rows under
watch, a trace with the niche chooser's fields, proposed niches and territory vetoes), but every text in it is invented and the people are fictional (Ana, Beto and Carla, at example.com): this
repository is public, and quotes, comments and marks are only for the people on the list. No catalog text, source
address, real name, real email or real niche may ever be copied into it. The fake also answers `set_niche_veto` as
the base does (a proposed niche changes its own state, any other name gets or loses its row in `territory_vetoes`), so
a reload reads what a veto left.

What runs:

- **Screens**, each at 320 × 640, 390 × 844, 768 × 1024 and 1440 × 900, in light and in dark:
  - signing in: `sign-in-email`, `sign-in-code`; «sin permiso»: `no-access`;
  - the home: `home` (this week's run and its line), `home-old-trace` (the week's run left no trace: the line is the
    one before, labelled with its date), `home-failed-run`, `home-long-title` (a 48-character title of long Spanish
    words), `home-nothing-to-decide`, `home-empty`, `home-error`;
  - Catálogo: `catalog` (55 under watch, so it shows 20 and «Ver 20 más», and the check asserts the button shows),
    `catalog-empty`;
  - a pain: `detail-v2` and `detail-v3` (a version-3 card opened by direct link, its duel rivals named by title, by
    what hurts for a version-1 card, or as «otro dolor del catálogo»), `detail-no-gate` (a pain stored before the gate
    existed: «Sin análisis guardado para este dolor» where the box cells would be), `detail-long-title`, `detail-line`,
    `detail-line-v1`, `detail-missing`;
  - Corridas: `runs`, `runs-empty`, `run-detail` (the unmapped cuts counted in one line), `run-detail-technical`
    (the same run with «Detalle técnico» open), `run-failed`, `run-missing`;
  - Nichos: `niches` (the week's niche and why, then every candidate: competing, new this month, resting, vetoed
    with who and «Quitar veto», retired, a proposed niche with its summary; never a niche's id), `niches-vetoed-current`
    (the week's niche vetoed after it ran: «Vetado» with who and when, in its block and its row), `niches-counts` (a
    week counted without review: «Ruido» reads «sin medir»), `niches-empty` (no trace has a choice yet: the empty
    sentence and «Volver a cargar», nothing else), `niches-error`.

  Each scenario waits for a selector and an `<h1>` that only its own screen has, so it never measures another screen
  (an error in its place, say), and lets the fonts load and the last transition end before measuring. A screen fails on any
  serious or critical axe violation (moderate and minor ones are printed as a count), a page wider than the window
  (`scrollWidth` over `clientWidth`), a link, button, field or fold smaller than 44 × 44 px, a console error or page
  error, a request the fake does not know, a different `<h1>`, a raw run text (the fixtures mark them `RAW-`) anywhere
  outside «Detalle técnico», a text the scenario expects to read missing (or one it must not read present), or at
  320 × 640 an `<h1>` that ends below 160 px (MAR-14).
- **Behaviours** a screenshot cannot show, at 320 × 640: a comment with markup shows as literal text; the base refusing
  a comment (22023) says so in the field and keeps the text; a session that expires while publishing (401,
  `PGRST303`) says «Tu sesión terminó», keeps the comment, and after signing in again (email, then code) the comment is
  back in its field on the same pain; an unpublished comment asks before a tab leaves the pain, «Seguir escribiendo»
  keeps it and «Salir sin publicar» goes on; a mark from the home is undone and saved again with the same button, in
  the base and in words; «Ver más» under a source puts the focus on the first quote added; at 390 × 844 the first
  station's «Nos interesa» shows without scrolling; the home's line says the cuts nobody mapped once, as a link to that
  run's page; the top bar says the same week, niche and cost on the home and on a pain opened first; a pain's page
  reads as the home's open row (the way back to «Esta semana», the state's pill, the box cells with no box around them
  before the actions, the team's marks before plain sections, the comments last, each attack and duel a ✓ or ✗ beside
  its words), its «Comentar» goes to the comment field and «Ver los testimonios y los ataques» to «Cómo llegamos»
  without leaving the page, and the duel's winner opened from a link shows its tag, the duel's line and a grey dot,
  with «Nos interesa» on a 390 × 844 phone's first screen. And
  Review Focus 5: at
  320 px with the long title the line is the folded strip, the title wraps whole with no ellipsis and no sideways
  scroll. In Nichos: vetoing a competing niche sends `set_niche_veto` with `p_vetoed: true`, its row turns «Vetado»
  with «Lo vetó Carla …» and «Quitar veto» (the focus stays on it), a reload reads the same from the fake, and the
  same button sends `false` and the row competes again; a session that ends while vetoing (401, `PGRST303`) says «Tu
  sesión terminó»; a veto the base refuses (42501) shows «sin permiso»; a base error is said in words beside the
  button, which works again. At 1440 × 900 (the top bar's week data shows from 768 px), the top bar's niche opens
  `#/nichos` on the same niche. Also at 1440 × 900, Catálogo, Corridas, a run and Nichos read in the home's standard:
  each of Catálogo's states is a bordered list headed by its dot, its name and its count, each pain a closed row with
  its checks (or, without a gate, its facts line) and no actions, the waiting state's dots grey; Corridas' runs sit in
  six fixed columns, newest first, each state a pill with its words; a run's page has «Corridas» as the way back, the
  state's pill and the key data, its line across the page's width, then plain sections and «Detalle técnico» folded;
  Nichos' week niche is an open row with why it was chosen, its three figures in cells (the place against the others
  drawn and hidden from a screen reader, «Con señal» in words) and «Vetar este nicho», under plain headings, and a
  competing niche's dot is grey. Signing in (both steps), «sin permiso» and the page that could not load (its module
  refused, the page's clock run 10 seconds at once) share one 400 px panel centred on the ground, «tomoshi» at its top
  as plain text and no masthead; on a 390 px phone the panel is the page, with no edge; the code is one field over
  eight boxes hidden from a screen reader, which show what is typed and ring the next one. At 320 px the four tabs fit
  their row. «Comentar» on a line of its own (at 390 px, beside «Quitar «Nos interesa»») starts at the row's start, on
  the home and on a pain's page, and beside «Descartar» keeps 20 px. Each behaviour also fails on a request the fake
  does not know.

Exceptions, each printed at the end of every run (no check is removed):

- **MAR-14 holds a pain's screens to 180 px.** At 320 × 640, `detail-v2`, `detail-v3`, `detail-no-gate`,
  `detail-long-title` and `detail-line` end their h1 at 180 px: under the two-row masthead band (88 px: the brand, then
  the tabs), the way back to «Esta semana» and a title on two lines. Every other screen ends its h1 within 160 px; these are held to 180
  exactly, so any growth fails.
- **MAR-14 skips `detail-line-v1`.** A version-1 card has no `line.title`, so its h1 is `what_hurts`, a full sentence of
  several lines. This is transitional: the next run rewrites every card with a title. The screen is still measured
  and screenshotted; only the h1 height is not held to 160 px (the runner prints a `NOTE` saying so).
- **Console errors from failures the fake makes on purpose.** When the fake answers with an error (the failed reads of
  `home-error` and `niches-error`, the 400, 401, 403 and 500 of the behaviours), Chrome logs its own «Failed to load resource» line. That line is not
  counted for exactly those URLs; every other console error fails the screen.
- **A link inside a sentence** (other words in the same block) is not held to 44 × 44, as WCAG 2.5.8 allows: its
  height is the line's. Every other target is.
- **axe's moderate and minor violations** are printed as a count and do not fail, as in the factory's
  `measure-pieces.mjs`.

Rubric: on 2026-11-11 the screenshots of every screen were judged against the factory's rubric, «juzgada por un
revisor, no cumplida por máquina»: a reviewer read them, no script scored them. Eight items came out «no pasa» and were
fixed before publishing: `jerarquia-entrecerrada`, `agrupacion-con-sentido`, `cabecera-util`, `estado-no-solo-color`,
`registro-neutro`, `se-entiende-a-la-primera` (three places), `etiquetas-de-quien-usa` and
`duracion-de-microfeedback`; `marco-comun` had a severity-1 note, also addressed. Every other item passed. Any change
to what a screen shows needs the rubric judged again.

DET-04 on a phone: the index folds at the top and the sections stay open, since folding the sections too would put the
quotes' «Texto original» fold at a third level (DET-07). The factory's `indice-si-es-larga` check does not apply below
672 px (the index does not stick on a phone), so this needs no exception.

## The sign-in code email

The email with the one-time code is `supabase/templates/otp-code.html` (HTML only: Supabase Auth's mailer sends no
plain-text part) and its subject is `supabase/templates/otp-code.subject.txt`. The rules are COR-10 to COR-13 of the
factory's visual manual (`patrones/correo-aviso.md`): the code first, large and as real text; how long it lasts; what
to do if it was not asked for; no links, no images. It says tomoshi in the lab report's colours: the code first, in
the report's ink (#14213D) on a near-white sheet, then the report's blue band (#1F4E8C, the portal's masthead) that
closes the email with the lowercase wordmark as near-white text, in Public Sans when the reader has it and Arial
otherwise (no web font is loaded); no pure white or black (COR-09), and every text colour reaches WCAG AA on its own
background. `tests/unit/otp-template.test.mjs` checks what is mechanical, contrast included.

Steps in the Supabase panel, project `dolores` (Miguel does them; the app password is typed in the panel, never in
this repository):

1. **Authentication > SMTP Settings** > enable custom SMTP: host `smtp.gmail.com`, port `465`, username the factory's
   Gmail address, password an app password of that Gmail (Google account > Security > App passwords), sender address
   that same Gmail, sender name `tomoshi`.
2. **Authentication > Rate Limits:** set «emails per hour» to 20, well below Gmail's limit of 500 a day.
3. **Authentication > Sign In / Providers > Email:** turn «Confirm email» on, and «Allow new users to sign up» on (the
   page creates each user the first time they ask for a code). No password sign-up or sign-in is ever used. Why
   «Confirm email» matters: the base lets in whoever's session carries an email on the list, so that email must be one
   the person proved they own; without it, anyone could sign up with a password under a partner's address.
4. **Authentication > Sign In / Providers > Auth Providers > Email:** set «Email OTP Length» to `8` (it must match
   `EMAIL_OTP_LENGTH` in `config.js`).
5. **Read «Email OTP expiration»** on that same screen. The template says «Vale 1 hora.» (Supabase's default, 3600
   seconds). If the panel shows another value, change that line in `otp-code.html` before pasting it.
6. **Authentication > Email Templates:** the page asks for the code with `signInWithOtp` and creates users on the
   fly, so Supabase sends it with the «Magic link» template to an existing address and with «Confirm sign up» to a new
   one. Paste the subject from `otp-code.subject.txt` and the body from `otp-code.html` into both.
7. **Authentication > URL Configuration:** set «Site URL» to `https://mrshelll.github.io/dolores-portal/`.
8. Test: ask for a code from the page with an address that is not the Gmail itself and check that it arrives (and not
   in Junk), with the code first. Signing in with the Gmail address itself works too, but Gmail files a message it
   sent to itself only under «Enviados» (Sent), not in the inbox: the code is there.
