import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, TAB_IDS, navGroupsFor, normalizeTab, allowedTab } from './navigation.js';

const ids = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));

test('sidebar groups read Overview, Records, Team, Admin in that order (AC 1)', () => {
  assert.deepEqual(navGroupsFor({ isAdmin: true }).map((g) => g.label), ['Overview', 'Records', 'Team', 'Admin']);
  assert.deepEqual(ids(navGroupsFor({ isAdmin: true })), [
    'dashboard', 'records', 'standup', 'leaves', 'attendance',
    'tasks', 'calendar', 'poker', 'retro', 'words', 'events',
    'employees', 'projects', 'settings',
  ]);
});

test('a non-admin keeps Employees but not Projects or Settings (AC 4)', () => {
  const shown = ids(navGroupsFor({ isAdmin: false }));
  assert.ok(shown.includes('employees'));
  assert.ok(!shown.includes('projects'));
  assert.ok(!shown.includes('settings'));
});

test('every row has a label and an icon, and ids are unique', () => {
  const all = NAV_GROUPS.flatMap((g) => g.items);
  for (const item of all) assert.ok(item.label && item.icon, item.id);
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
});

test('saved tabs survive the reload, old settings tabs land on Settings (AC 3)', () => {
  assert.equal(normalizeTab('records'), 'records');
  assert.equal(normalizeTab('memories'), 'memories');
  assert.equal(normalizeTab('standup-form'), 'standup-form');
  assert.equal(normalizeTab('leave-settings'), 'settings');
  assert.equal(normalizeTab('privilege-settings'), 'settings');
  assert.equal(normalizeTab('nonsense'), 'dashboard');
  assert.equal(normalizeTab(null), 'dashboard');
});

test('an admin-only tab falls back to the dashboard for everyone else (AC 4)', () => {
  assert.equal(allowedTab('settings', { isAdmin: false }), 'dashboard');
  assert.equal(allowedTab('projects', { isAdmin: false }), 'dashboard');
  assert.equal(allowedTab('settings', { isAdmin: true }), 'settings');
  assert.equal(allowedTab('employees', { isAdmin: false }), 'employees');
});

test('TAB_IDS covers every row plus the tabs reached another way', () => {
  for (const id of [...ids(NAV_GROUPS), 'standup-form', 'memories', 'capacity']) assert.ok(TAB_IDS.includes(id), id);
});
