---
name: figma-align
description: Make a page, modal, drawer or component in the current repo match its Figma design, then check the result in the browser at desktop and mobile width.
argument-hint: "[figma-url or screen name] [what to align or fix]"
disable-model-invocation: true
---

# Figma align

Match a screen to its Figma frame and prove it in the browser.

This skill grew out of months of design work where first passes kept stopping at "looks close". The user then came back two to five times about:

- **Elements left out** because they looked optional, such as a search bar or a link to the reviews.
- **The wrong source frame:** a designer's suggestion frame, an outdated version, a misnamed layer.
- **Details:** corner radius, a band of colour behind a sticky bar after scrolling, Esc closing the wrong modal.
- **Mobile overflow.**
- **Changes pushed before anyone saw them render,** usually because logging in was a hurdle.
- **The Figma MCP hanging for 5 minutes** on large frames.

Each step below exists to stop one of these. The general method lives here. Everything specific to one repo lives in that repo's **profile**.

## 0. Arguments and profile

**Arguments.** The invocation usually carries a Figma URL, optionally followed by what to do ("validate", "apply the feedback below", "fix mobile overflow"). Once a repo has a profile, it may carry a screen name instead of a URL ("analytics page"). It may also carry pasted design feedback.

**Load the profile.** Run:

```bash
node <skill-dir>/scripts/profile.mjs
```

`<skill-dir>` is the base directory shown when this skill loads. The script prints the profile directory and its status.

- **NONE:** this is the first run in this repo. You need a Figma URL. If the user didn't give one, ask for it. Then follow `references/setup.md` to build the profile, and continue with step 1.
- **PARTIAL:** build only the missing file, using the matching part of `references/setup.md`.
- **READY:** read the three files:
  - `frames.md`: the Figma file, which area of it is current, known frames
  - `design.md`: tokens, components and design rules
  - `run.md`: how to run, log in and check

  If the user gave a screen name instead of a URL, find it in `frames.md`. If the URL points to a different Figma file than the one recorded, add that file to `frames.md`; don't replace the existing one.
- **Not in a repo:** if the script says the folder isn't a git repo but lists repos inside it (a multi-repo ticket folder), rerun it with the frontend repo's path and work there.

**Figma access.**
- **Local MCP:** this skill works through the `figma-desktop` MCP (`http://127.0.0.1:3845/mcp`), with the Figma desktop app open on the file and Dev Mode's MCP server turned on.
- **If its tools are missing,** ask the user to run `claude mcp add --scope user --transport http figma-desktop http://127.0.0.1:3845/mcp` and restart the session. User scope makes it available in every repo and worktree, and tools added mid-session only appear after a restart.
- **Remote MCP:** if the Figma plugin's remote MCP is connected instead, it has the same tools and the advice below still applies.
- **Before your first `get_design_context` call,** load `figma:figma-design-to-code`. The Figma plugin requires it.

Done when the profile is READY, you have read its three files, and the Figma tools are available.

## 1. Pin down the target

1. **Node:** take the node id from the URL. `node-id=2391-20462` and `2391:20462` both work.
2. **Right frame:** make sure it is in the current area of the file recorded in `frames.md`.
   - Frames outside that area are outdated.
   - Frames named like "example", "suggestion" or "exploration" are proposals, not the spec.
   - Layer names can be wrong, so trust the screenshot over the name.
   - Designers edit live. If a node is "not found", re-pull its parent's metadata instead of guessing.
3. **Notes and state frames:** look at the frames next to the target.
   - **Notes:** frames named "Note". "to be discussed" means the design isn't settled; ask before building it.
   - **State frames:** hover, selecting, filtered, scrolled, modal open, empty, draft. They are part of the spec.
4. **Code:** find where the screen lives, using the structure in `design.md`.

Done when you have a node id inside the current area, the notes and state frames that go with it, and the paths of the files that render the screen.

## 2. Read the design without stalling

- **Metadata goes to a file.** A whole page is millions of characters and a big frame about 100K, so Claude Code saves `get_metadata` output to a tool-results file. Read that file with the bundled parser, never inline:
  ```bash
  node <skill-dir>/scripts/figma_tree.mjs <saved-file> --root <node> --depth 3   # structure
  node <skill-dir>/scripts/figma_tree.mjs <saved-file> --root <node> --text      # every text layer, in order
  node <skill-dir>/scripts/figma_tree.mjs <saved-file> --find "Rechercher"        # locate a layer
  node <skill-dir>/scripts/figma_tree.mjs <saved-file> --top [--min-y=N]          # a page's frames, row by row
  ```
  The file is a JSON list of text parts with a trailing note, which is why XML parsers choke on it.
- **`get_screenshot` is the reliable call.** Take one of the whole frame first; that is your visual target. Then take one of each section you will work on.
- **Call `get_design_context` once per section,** never on a full page. Send about three at a time.
  - **Modals:** when the frame is a modal over a page, call it on the modal's own node (`--find modal`). On the full frame it returns the page behind the modal.
  - **Charts and dense vector groups:** these often hang until they time out. Go straight to screenshots, `get_variable_defs` for colours, and `--text` for labels.
  - **Timeouts:** if any call times out, go one level smaller or use that fallback. Don't retry the same node. Say in the report which sections came from screenshots.
- **Assets:** call `get_design_context` on each single icon node and download its asset right away. Asset URLs from calls that span several nodes expire. When turning an SVG into JSX, copy each path's `d` attribute.

Done when you have a screenshot of the whole frame and, for every section you will work on, either its design context or a screenshot plus its text layers.

## 3. Write an inventory before you edit

Using the screenshot and the `--text` output, list every visible element section by section: titles, descriptions, buttons, inputs, search, filters, chips, menus and their items, empty states, pagination, links. Note each one's size, radius, spacing, font and colour. Then mark each against the current code: **present and correct**, **present but different**, or **missing**.

Everything visible in the frame is in scope. Don't park a visible element as "needs a decision". That is exactly how search bars and links went missing before.

The one real exception is a conflict between the frame and the ticket, or an earlier decision by the product owner. When that happens, ask the user one short question rather than choosing silently.

Done when every element visible in the screenshot has a line in the inventory and one of the three marks.

## 4. Implement with the project's conventions

- **Tokens and components:** use the tokens, components and rules in `design.md`. Search for a Figma hex before adding a new one. Reuse the existing primitives rather than rebuilding them.
- **Layout:** treat the code `get_design_context` returns as a picture of the layout, not code to paste. Turn absolute positions into flex or grid that holds up from 375px to 1440px.
- **Copy:** character for character from Figma, including accents, capitalisation and punctuation spacing.
- **Data:** keep it real. Never hardcode numbers from the mockup. If the design needs data the API doesn't return, check the backend named in `run.md`. Then add it, if the user wants backend changes in this task, or report it as a gap.
- **Scope:** stay on the requested screen. List unrelated mismatches you notice instead of fixing them.

Done when every inventory line marked different or missing is either implemented or noted as a gap for the report.

## 5. Check it in the browser before you say it's done

Before you start a server, read `references/browser-check.md`. It covers port checks, forcing an exact viewport width, finding what overflows and measuring computed styles. Then start the app, log in as `run.md` describes, and check:

1. **Desktop, 1440px:** compare against the Figma screenshot section by section. Measure the key elements with `getComputedStyle`. Don't judge by eye.
2. **Mobile, 375px:** no horizontal overflow, and long values stay inside their cards.
3. **Scroll:** sticky bars must not change background colour between rest and pinned.
4. **States:** hover, selected and filtered states, opening and closing every modal and drawer, Esc closing only the topmost layer, and empty and loading states.
5. **Popovers:** open date pickers and dropdowns near the screen edges. They must stay inside the screen.

Fix what you find and check again. Run the lint and test commands from `run.md`, and format only the files you touched. Repo-wide format scripts (`prettier --write .`, some `check` scripts) rewrite files you didn't change.

Done when all five checks pass and lint and tests are clean. If you couldn't log in or render the page, say so in plain words. "Not checked in the browser" is a valid report. "Done" without a check is not.

Stop any servers you started.

## 6. Report, and keep the profile current

End with this table. Mark a row ✅ only if you saw it in the browser.

```
| Section | Status | Note |
|---|---|---|
| Page header | ✅ matches | |
| Filter bar | 🔧 fixed | radius 12→18; transparent until pinned |
| Theme card | ⚠️ differs | API has no `trend` field; shows "—" until backend adds it |
| Chart colours | ⚠️ from screenshot | get_design_context timed out on 2475:11613 |
| Export button | ❓ not in design | kept existing behaviour |
```

After the table, list anything that needs backend data and any open questions for the user or the designer.

Then update the profile with what this run taught you, and say what you added:

- new frames → `frames.md`
- design rules, including ones the user corrected you on → `design.md`, with the date
- environment traps → `run.md`

The profile is what makes the next run faster. A rule the user had to repeat is a rule that should have been saved.

Leave the changes uncommitted so the user can look at the render first. Commit or push only when they ask.

## Pasted design feedback

When the user pastes feedback from a client or designer, turn it into a numbered checklist first, and give each item its own row in the report. When the feedback is in Lebanese Arabizi (Arabic in Latin letters), read `references/arabizi.md` for the common words. Screenshots it mentions ("see image") usually don't come through. Use the Figma frame as the source of truth and say which items you couldn't see.
