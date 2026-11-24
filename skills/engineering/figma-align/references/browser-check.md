# Checking a screen in the browser

This covers general techniques, using the Chrome tools (`mcp__claude-in-chrome__*`). How to start this repo's app and log in is in the profile's `run.md`.

## Before starting servers

- **Check the ports:** `lsof -nP -iTCP:<port> -sTCP:LISTEN`. If a port is taken, run `ps -o command= -p <pid>` to see what holds it. Another project holding the backend port is a classic: every route then returns 404. Don't kill a process you didn't start; ask the user.
- **Run servers in the background,** with logs in the session scratchpad, so you can grep them for magic links or errors.

## Exact viewport widths

Call `resize_window` (for example 1440×1000), then check `window.innerWidth` with `javascript_tool`. Browser zoom often keeps the real width at 1920, or stuck somewhere else.

If the width doesn't match, frame the current page at an exact width. The iframe is same-origin, so the login carries over:

```js
const f = document.createElement('iframe');
f.id = 'vp'; f.src = location.href;
f.style.cssText = 'position:fixed;inset:0 auto auto 0;width:375px;height:812px;z-index:99999;border:2px solid red;background:#fff';
document.body.appendChild(f);
```

Change `width` for other breakpoints. Remove the frame with `document.getElementById('vp').remove()`.

## Horizontal overflow

Once the iframe has loaded (or on the page itself, with `window` and `document`):

```js
const w = document.getElementById('vp').contentWindow, d = w.document;
({ overflow: d.documentElement.scrollWidth > w.innerWidth,
   culprits: [...d.querySelectorAll('body *')]
     .filter(e => e.getBoundingClientRect().right > w.innerWidth + 1)
     .slice(0, 10).map(e => `${e.tagName}.${String(e.className).slice(0, 80)}`) })
```

The usual cause is the min-content width of nowrap text (URLs, slugs, emails, long names) pushing up through flex or grid items that still have `min-width: auto`. Fix the whole chain with `min-w-0` (or `min-width: 0`) plus `truncate` or wrapping. For a compound field, use a container query (`@container`) so it adapts to its card rather than to the viewport.

## Measure instead of eyeballing

```js
const s = getComputedStyle(document.querySelector('<selector>'));
({ size: `${s.width} x ${s.height}`, radius: s.borderRadius, pad: s.padding, gap: s.gap,
   font: `${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily.split(',')[0]}`,
   color: s.color, bg: s.backgroundColor, border: s.border })
```

Compare these against the Figma numbers from `get_design_context` or `get_variable_defs`.

If text looks too thin or the wrong width, check which font weights actually loaded before changing sizes. For example, `document.fonts.check('600 14px "<family>"')`. Browser extensions can inject fonts that win over yours.

## Scroll and sticky elements

Scroll the content container, not just the window; many app shells scroll an inner `main`. Compare the sticky bar's background at rest and when pinned. A translucent card over a page background image shows any solid fill as a band.

If you need to detect "pinned" in code, a scroll listener comparing `getBoundingClientRect().top` is more reliable than IntersectionObserver when the bar pins exactly at its container's edge.

## Browser gotchas

- Keep the tab you're testing in front. Background tabs pause CSS transitions and IntersectionObserver, which makes animations and sticky logic look broken.
- The first click after a navigation is sometimes swallowed. If nothing happened, click again before debugging.
- Don't call `location.reload()` inside `javascript_tool`; the eval dies with "Inspected target navigated". Use `navigate`.
- Responses can be cached (look for `Cache-Control: max-age`). After a backend change, hard-reload or wait out the cache before deciding the fix didn't work.
