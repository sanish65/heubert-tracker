import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, TAB_IDS, navGroupsFor, normalizeTab, allowedTab } from './navigation.js';

const ids = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));

test('sidebar groups read Overview, Records, Team, Admin in that order (AC 1)', () => {
  assert.deepEqual(navGroupsFor({ isAdmin: true }).map((g) => g.label), ['Overview', 'Records', 'Team', 'Admin']);
  assert.deepEqual(ids(navGroupsFor({ isAdmin: true })), [
    'dashboard', 'records', 'standup', 'leaves', 'attendance',
    'standup-form', 'tasks', 'calendar', 'poker', 'retro', 'words', 'events',
    'employees', 'projects', 'settings',
  ]);
});

test('a non-admin keeps Employees but not Projects or Settings (AC 4)', () => {
  const shown = ids(navGroupsFor({ isAdmin: false }));
  assert.ok(shown.includes('employees'));
  assert.ok(shown.includes('standup-form'));
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
  for (const id of [...ids(NAV_GROUPS), 'memories', 'capacity']) assert.ok(TAB_IDS.includes(id), id);
  assert.equal(new Set(TAB_IDS).size, TAB_IDS.length);
});

test('the Standup row opens the Team group, before Tasks, with the message icon', () => {
  const team = NAV_GROUPS.find((g) => g.id === 'team');
  assert.deepEqual(team.items.slice(0, 2).map((i) => i.id), ['standup-form', 'tasks']);
  const row = team.items[0];
  assert.equal(row.label, 'Standup');
  assert.equal(row.icon, 'message');
  assert.ok(!row.adminOnly);
  const records = NAV_GROUPS.find((g) => g.id === 'records');
  assert.ok(!records.items.some((i) => i.id === 'standup-form'));
});
