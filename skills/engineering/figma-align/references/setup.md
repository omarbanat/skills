# First run in a repo: build the profile

The profile is three files in `<skill-dir>/projects/<key>/`. `scripts/profile.mjs` prints the exact path. They hold what the alignment workflow needs to know about this repo, so later runs can skip the exploring:

| File | Answers |
|---|---|
| `frames.md` | Which Figma file, which part of it is current, which frame is which screen |
| `design.md` | How Figma values map to this codebase: tokens, components, layout, rules |
| `run.md` | How to start the app, log in, and check the work; which commands to use or avoid |

Tell the user up front that this is a one-time setup for the repo and roughly what you'll look at. Then do the three parts below, ask your questions in one batch, write the files, show a short summary, and carry on with the task they asked for.

**Never put secrets in a profile:** no passwords, tokens or API keys. Record where to get them instead, such as "ask the user" or "in `.env.staging` as `X`".

## Part 1: Figma → `frames.md`

1. **From the URL,** take the file key (the part after `/design/`) and the node id.
2. **Find the pages.** Call `get_metadata` with no node id to list the file's pages. The target is usually on the main design page. Skip pages like "Components", "Trash" or "Archive" unless the node is there.
3. **Pull the page.** Call `get_metadata` on that page once; it is large and gets saved to a file. Then run `figma_tree.mjs <file> --top`. It lists every top-level frame row by row, and adds the text of banners, notes and section labels in brackets.
4. **Find the current area.** Look for version banners and labels: "V1", "V2", "Old", "Archive", "Inspiration", "WIP", "Explorations".
   - If it's clear which area is current (say, everything below a "V2" banner), record it with its y threshold, so `--top --min-y=<y>` shows only that area.
   - If it isn't clear, put it in your questions.
5. **Write `frames.md`:**
   - the file name and key, the page, the current area and how to refresh the list
   - the current frames grouped by their section labels, as `| Node | Frame | Notes |` tables
   - notes on suggestion frames, designer notes and misnamed layers when you spot them

   Keep the outdated area out, apart from one line saying it exists.

## Part 2: The codebase → `design.md`

For a large repo, hand the scan to an Explore subagent with the headings below as its brief, and keep only its conclusions. Find:

- **Stack.**
  - The framework and router.
  - The styling system: Tailwind v4 `@theme` in CSS, Tailwind v3 `tailwind.config`, CSS modules, CSS-in-JS, or a component-library theme (MUI, Chakra, Mantine).
  - The class-merge helper (`cn`, `clsx`) and the UI libraries (Headless UI, Radix, shadcn).
- **Tokens.** Where colours, radii, spacing and fonts are defined, and their values. Also global CSS rules that change how things render: custom fonts, corner smoothing or squircle, scrollbars, autofill and background styles.
- **What the code actually uses.** Tally it, because tokens alone don't tell you:
  ```bash
  grep -rhoE 'rounded-(\[[0-9]+px\]|[a-z0-9]+)' --include='*.tsx' src | sort | uniq -c | sort -rn | head -15
  grep -rhoE 'text-\[[0-9]+px\]|text-(xs|sm|base|lg|xl|2xl)\b' --include='*.tsx' src | sort | uniq -c | sort -rn | head -12
  grep -rhoE '(bg|text|border)-\[#[0-9a-fA-F]{3,8}\]' --include='*.tsx' src | sort | uniq -c | sort -rn | head -20
  ```
  Adapt these to the stack, for example `.vue` files or CSS modules.
- **Layout shell.** The sidebar, topbar, main content card and page header pattern. Also where search and filters normally go.
- **Primitives.** Buttons and their variants, text inputs, selects, date pickers, modals, drawers, toasts, tabs, tables, pagination, cards, KPI tiles. Record the path of each, plus the radius and height it already uses.
- **Icons.** Where icon sets live, and whether icons are inline SVG components or an icon library.
- **Copy.** Which language the UI uses, and whether it uses i18n files or literal strings.

Write `design.md` with these sections: **Stack**, **Page structure**, **Corner radius** (a Figma value → class table), **Colour**, **Typography**, **Controls**, **Popups, drawers and popovers**, **Mobile**, **Primitives to reuse** (a table), **Icons and assets**, and **Rules from design reviews**. That last one starts empty and grows run by run.

## Part 3: Running and checking → `run.md`

- **Commands.** Dev server (script and port), lint, typecheck, tests, and format. Flag any script that rewrites the whole repo, such as `prettier --write .` behind a `check` script, and say to format touched files only.
- **The API.** Which environment variable sets the API base URL, and what it points to locally.
  - Where the backend lives: a sibling repo, a monorepo package, or a remote URL only.
  - Its start commands, and **which data each one uses**: a local database, or a shared staging or production database. Shared data means reading is fine, but writing needs permission.
  - Note any preview-environment switch.
- **Logging in.** Read the login page and the backend's auth code.
  - Work out the method: password, magic link, one-time code, OAuth or SSO.
  - Check whether the dev backend logs the link or code (look for `console.log` near the email sending), and whether it also sends a real email.
  - Note any dev bypass.
- **Port and process traps.** Note other projects on this machine known to use the same ports, if you find any.

Write `run.md` with these sections: **Commands**, **Servers**, **Log in**, and **Known traps**.

## Questions for the user

Ask once, in a single batch of three questions at most, and only for what you couldn't find:

- which part of the Figma file is current, if the banners don't say
- which account to log in with, and how a session is normally obtained if the code doesn't make it clear
- whether reading from a shared or staging backend is OK for checking designs

Write their answers into the profile so nobody has to ask again.
