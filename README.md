# dolores-portal

The page where the dolores team (Miguel, Jaime and Fabio) reads the week's pains. Each person signs in with their email
and an 8-digit code that arrives by email; only addresses on the team's list (the `people` table in Supabase) see
anything. Someone who signs in with another address sees a «sin permiso» screen that tells them whom to ask.

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
| `css/base.css` | Tokens (greys, one accent, light and dark, system fonts, an 8 px spacing step) and the shared styles: frame and header, text, buttons, fields, the section notice, tags |
| `js/app.js` | Session, hash router (`#/` home, `#/dolor/<id>` a pain) and the screens: sign-in (email, then code), «sin permiso», the home with the week's pains, and a pain's card with the team's marks and comments |
| `js/text.js` | Every visible string (`T`), the plain names of the territories (`TOPICS`, `topicName`) and `formatDate` |
| `js/model.js` | The home's logic, without DOM or network: the section of each pain (`buildSections`, with the run's `effectiveMark`), the week's sentence, the notice about the run, what a failed read means (`classifyError`) and loading by parts |
| `js/api.js` | `loadHome(client)` and `loadPain(client, id)`: what the home and a pain read; `setMark`, `addComment` and `deleteComment`: the three writes, through the base's functions. The client is passed in |
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
access rule, the home's and a pain's logic, reads and writes (with a fake client), the visible strings (none carries an internal word such as a pain id, a territory slug, «tier», «lente»,
«score», «underserved» or «corrida», which the page calls «revisión»; whole words only, so «excelente» is fine), the
territory names and the code email's rules.

To look at the page locally, serve the folder and open it (signing in needs the real Supabase project):

```sh
python3 -m http.server 8000
```

## Browser checks

Every screen is also measured in Chrome with the software factory's verifiers, so the page is known to follow the
visual manual before it is published:

```sh
node tests/browser/run-checks.mjs --factory "<software-factory repo>" --out <dir> [--url <base>]
```

- `--factory` (required): the software-factory repo. The runner imports `verificarPagina` from
  `design-system/assets/reglas-pantalla.mjs` and `abrirNavegador` from `design-system/assets/playwright-cache.mjs`, which
  loads playwright-core 1.63.0 and axe-core 4.13.0 from `~/.cache/fabrica-software` and uses the installed Google
  Chrome (or `FABRICA_CHROME`). Nothing is installed in this repo.
- `--out` (required): where the screenshots go, one per screen as `<scenario>-<width>-<scheme>.png` (full page). The
  folder is created if missing. Keep it outside the repo; screenshots are never committed.
- `--url` (optional): the page to measure. By default the runner serves this folder on 127.0.0.1 at a free port
  (`tests/browser/static-server.mjs`). To check the published page, pass `--url https://mrshelll.github.io/dolores-portal/`.

Exit codes: `0` everything passed; `1` a check failed (each failure is printed under its `FAIL` line); `2` a usage
error (a missing or unknown flag, a `--factory` without the verifiers); `3` Chrome or playwright is missing or Chrome
did not start.

The page loads the real supabase-js from jsDelivr, so the run needs internet. Every request to the Supabase project
is answered by a fake (`tests/browser/fixtures.mjs`, through `page.route`), also with `--url`: no screen ever touches
the real base, and a signed-in screen gets a session injected into `localStorage` under supabase-js's own key. The data
has the base's shapes (a full card, a version-1 line card and its version-2 rewrite, 55 rows under watch), but every
text in it is invented: this repository is public, and quotes, comments and marks are only for the people on the list.
No catalog text, source address or real email may ever be copied into it.

What runs:

- **Screens**, each at 320 × 640, 768 × 1024 and 1440 × 900 in light mode, and 320 and 1440 again in dark mode:
  `sign-in-email` and `sign-in-code` (pattern `formulario`); `home`, `home-failed-run`, `home-empty` and `home-error`
  (`lista`); `detail-full`, `detail-long-title` (a title of 48 characters, the longest allowed), `detail-line` and
  `detail-line-v1` (`detalle`); `no-access` and `detail-missing` («no está en la lista o todavía no tiene ficha»)
  (`otro`). The home has 55 pains under watch, so it shows 20 and «Ver 20 más» (LIS-04), and the check asserts the
  button shows. Each scenario waits for a selector and an `<h1>` that only its own screen has, so it never measures
  another screen (an error in its place, say). A screen fails on any rule of `verificarPagina` with `ok: false`, any
  axe violation, a console error or page error, a request the fake does not know, a different `<h1>`, a page wider
  than the window (NAV-04), or at 320 × 640 an `<h1>` that ends below 160 px (MAR-14).
- **Behaviours** a screenshot cannot show, on the full card at 320 × 640: a comment with markup shows as literal
  text; the base refusing a comment (22023) says so in the field and keeps the text; a session that expires while
  publishing (401, `PGRST303`) says «Tu sesión terminó», keeps the comment, and after signing in again (email, then
  code) the comment is back in its field on the same pain. Each behaviour also fails on a request the fake does not
  know.

Exceptions, each printed at the end of every run (no check is removed):

- **MAR-14 skips `detail-line-v1`.** A version-1 card has no `line.title`, so its h1 is `what_hurts`, a full sentence of
  several lines. This is transitional: the next run rewrites every card with a title. The screen is still measured
  and screenshotted; only the h1 height is not held to 160 px (the runner prints a `NOTE` saying so).
- **Console errors from failures the fake makes on purpose.** When the fake answers with an error (the failed read of
  `home-error`, the 400 and 401 of the behaviours), Chrome logs its own «Failed to load resource» line. That line is not
  counted for exactly those URLs; every other console error fails the screen.

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
to do if it was not asked for; no links, no images. `tests/unit/otp-template.test.mjs` checks what is mechanical.

Steps in the Supabase panel, project `dolores` (Miguel does them; the app password is typed in the panel, never in
this repository):

1. **Authentication > SMTP Settings** > enable custom SMTP: host `smtp.gmail.com`, port `465`, username the factory's
   Gmail address, password an app password of that Gmail (Google account > Security > App passwords), sender address
   that same Gmail, sender name `dolores`.
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
