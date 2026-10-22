import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Every z-index declared for `selector`, in any rule (media queries included) whose
// selector list names it exactly.
function zIndexes(selector) {
  const found = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = selectors.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    const z = body.match(/z-index:\s*(-?\d+)/);
    if (names.includes(selector) && z) found.push(Number(z[1]));
  }
  assert.ok(found.length, `no z-index for ${selector}`);
  return found;
}

const dialog = Math.min(...zIndexes('.modal-overlay'));

test('a dialog opened from a fullscreen view opens above it', () => {
  for (const view of ['.submissions-card.enlarged', '.poker-page-enlarged', '.retro-page-enlarged']) {
    assert.ok(Math.max(...zIndexes(view)) < dialog, `${view} covers dialogs`);
  }
});

test('confirm, alert and prompt open above every other dialog', () => {
  assert.ok(Math.min(...zIndexes('.modal-overlay.dialog-host-overlay')) > dialog);
});

test('the phone drawer, its scrim and the top bar stay under dialogs', () => {
  for (const layer of ['.app-sidebar', '.app-sidebar-scrim', '.app-topbar']) {
    assert.ok(Math.max(...zIndexes(layer)) < dialog, `${layer} covers dialogs`);
  }
});
