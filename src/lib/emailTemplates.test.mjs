import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  initialsOf,
  firstNameOf,
  formatLongDate,
  birthdayEmail,
  anniversaryEmail,
  fineEmail,
  attendanceReminderEmail,
} from './emailTemplates.js';

const EMOJI = /\p{Extended_Pictographic}/u;

test('text is escaped before it goes into HTML', () => {
  assert.equal(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  const { html } = birthdayEmail({ name: '<script>alert(1)</script> Kumar', date: '2026-10-21' });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('names give initials and a first name', () => {
  assert.equal(initialsOf('Sita Gurung'), 'SG');
  assert.equal(initialsOf('Sanish'), 'S');
  assert.equal(initialsOf(''), '?');
  assert.equal(firstNameOf('Sita Gurung'), 'Sita');
  assert.equal(formatLongDate('2026-10-20'), 'Tuesday, October 20, 2026');
});

test('birthday and anniversary emails greet by first name, with no emoji', () => {
  const b = birthdayEmail({ name: 'Sita Gurung', date: '2026-10-21' });
  assert.equal(b.subject, 'Happy birthday, Sita!');
  assert.ok(b.html.includes('>SG<'));
  assert.ok(b.text.startsWith('Hi Sita,'));
  const a = anniversaryEmail({ name: 'Nabin Tamang', years: 3, date: '2026-10-21' });
  assert.equal(a.subject, 'Happy 3-year work anniversary, Nabin!');
  assert.ok(a.html.includes('3 years'));
  assert.equal(anniversaryEmail({ name: 'X', years: 1 }).html.includes('1 year<'), true);
  for (const mail of [b, a]) assert.ok(!EMOJI.test(mail.subject + mail.html + mail.text));
});

test('a late fine shows its amount, date, status and who recorded it', () => {
  const f = fineEmail({ kind: 'late', name: 'Rohan KC', date: '2026-10-20', amount: 50, status: 'unpaid', recordedBy: 'Pratisha' });
  assert.equal(f.subject, 'Late fine recorded — Tuesday, October 20, 2026');
  assert.ok(f.html.includes('Rs 50'));
  assert.ok(f.html.includes('Unpaid'));
  assert.ok(f.html.includes('Pratisha'));
  assert.ok(f.html.includes('View my fines'));
  assert.ok(f.text.includes('A late fine of Rs 50 has been recorded against you for Tuesday, October 20, 2026.'));
});

test('the status row follows the fine, and is left out when unknown', () => {
  assert.ok(fineEmail({ kind: 'late', name: 'R', date: '2026-10-20', amount: 50, status: 'paid' }).html.includes('>Paid<'));
  const unknown = fineEmail({ kind: 'standup', name: 'R', date: '2026-10-20' }).html;
  assert.ok(!unknown.includes('Unpaid') && !unknown.includes('>Paid<'));
  assert.ok(unknown.includes('Standup fine'));
  assert.ok(!unknown.includes('Rs '));
});

test('attendance reminders name the missing punch', () => {
  assert.equal(attendanceReminderEmail({ kind: 'checkin', name: 'A B' }).subject, 'Missed punch-in reminder');
  assert.ok(attendanceReminderEmail({ kind: 'checkout', name: 'A B' }).html.includes("You haven&#39;t punched out yet"));
});

test('links and the logo follow the app address', () => {
  const { html } = fineEmail({ kind: 'late', name: 'R', date: '2026-10-20', amount: 50, appUrl: 'https://example.test/' });
  assert.ok(html.includes('href="https://example.test/"'));
  assert.ok(html.includes('src="https://example.test/logo.png"'));
});

test('task emails say who did what, quote the mention, and link the issue', async () => {
  const { taskNotificationEmail } = await import('./emailTemplates.js');
  const a = taskNotificationEmail({ kind: 'assigned', name: 'Cara QA', actorName: 'Bob Dev', issueKey: 'POR-4', issueTitle: 'Build login', issueUrl: 'https://t.test/#issue=POR-4' });
  assert.equal(a.subject, 'Bob Dev assigned POR-4 to you');
  assert.ok(a.html.includes('href="https://t.test/#issue=POR-4"'));
  const m = taskNotificationEmail({ kind: 'mentioned', name: 'Alice', actorName: 'Bob Dev', issueKey: 'POR-4', issueTitle: 'Build login', excerpt: '@Alice <b>review</b>?', issueUrl: 'https://t.test/#issue=POR-4' });
  assert.equal(m.subject, 'Bob Dev mentioned you on POR-4');
  assert.ok(m.html.includes('@Alice &lt;b&gt;review&lt;/b&gt;?'));
  assert.ok(m.text.includes('"@Alice <b>review</b>?"'));
  assert.ok(!EMOJI.test(m.html + a.html));
});
