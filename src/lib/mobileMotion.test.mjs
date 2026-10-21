import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motionAllowed } from '../../mobile/lib/motion.js';

// mobile/lib/motion.js decides whether the phone's decorative motion (the loader, the skeleton
// shimmer) may play: the app's Animations setting and the phone's reduce-motion setting, either
// one off means still (docs/mobile-ui-revamp/intent.md, criterion 11).

test('moves when Animations is on and the phone has not asked for less motion', () => {
  assert.equal(motionAllowed(true, false), true);
});

test('stays still when Animations is off in the app', () => {
  assert.equal(motionAllowed(false, false), false);
});

test("stays still when the phone's reduce-motion setting is on", () => {
  assert.equal(motionAllowed(true, true), false);
});

test('stays still while the phone has not answered yet, so reduce-motion never sees a flash of motion', () => {
  assert.equal(motionAllowed(true, null), false);
  assert.equal(motionAllowed(true, undefined), false);
});

test('an Animations value not loaded yet counts as on, as the app has always read it', () => {
  assert.equal(motionAllowed(undefined, false), true);
});
