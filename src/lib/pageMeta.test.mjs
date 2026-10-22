import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_META, greetingFor, pageMetaFor } from './pageMeta.js';
import { TAB_IDS } from './navigation.js';

test('greeting turns at 5, 12 and 17', () => {
  assert.equal(greetingFor(5), 'Good morning');
  assert.equal(greetingFor(11), 'Good morning');
  assert.equal(greetingFor(12), 'Good afternoon');
  assert.equal(greetingFor(16), 'Good afternoon');
  assert.equal(greetingFor(17), 'Good evening');
  assert.equal(greetingFor(2), 'Good evening');
});

test('the dashboard title is the greeting, with the first name when there is one', () => {
  assert.equal(pageMetaFor('dashboard', { firstName: 'Sanish', hour: 9 }).title, 'Good morning, Sanish');
  assert.equal(pageMetaFor('dashboard', { firstName: '', hour: 9 }).title, 'Good morning');
});

test('a section heading takes its group label as the eyebrow', () => {
  assert.deepEqual(pageMetaFor('records', { groupLabel: 'Records' }), {
    eyebrow: 'Records',
    title: 'Late fines',
    subtitle: 'Late arrivals, fine seasons and the fine jar.',
  });
});

test('the standup page is the Team group\'s daily standup, for either day', () => {
  assert.deepEqual(pageMetaFor('standup-form', { groupLabel: 'Team' }), {
    eyebrow: 'Team',
    title: 'Daily standup',
    subtitle: 'Your update for the meeting, and a thank-you for someone who helped. Fill or edit either day, any time.',
  });
});

test('every tab has a heading, and an unknown tab falls back to the dashboard', () => {
  for (const id of TAB_IDS) assert.ok(PAGE_META[id] && PAGE_META[id].title, id);
  assert.deepEqual(pageMetaFor('nope', { hour: 9 }), pageMetaFor('dashboard', { hour: 9 }));
});
