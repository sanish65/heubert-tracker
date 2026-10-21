import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVATAR_COLORS,
  initials,
  avatarColor,
  isGooglePhotoUrl,
  photoUrlOf,
  photosByName,
  photoForName,
  isActiveEmployeeEmail,
} from './avatar.js';

const PHOTO = 'https://lh3.googleusercontent.com/a/x=s96-c';
const OTHER_PHOTO = 'https://lh3.googleusercontent.com/a/other=s96-c';
const NOT_GOOGLE = 'https://evil.example.com/a.png';

test('initials takes the first letter of the first and last word', () => {
  assert.equal(initials('Rohan KC'), 'RK');
  assert.equal(initials('Anisha Kumari Rai'), 'AR');
});

test('initials of a single word is one letter', () => {
  assert.equal(initials('Sanish'), 'S');
});

test('initials trims and collapses whitespace and uppercases', () => {
  assert.equal(initials('  priya   maharjan '), 'PM');
});

test('initials of an empty name is a question mark', () => {
  assert.equal(initials(''), '?');
});

test('AVATAR_COLORS is the fixed four-colour palette', () => {
  assert.deepEqual(AVATAR_COLORS, ['#3D63F0', '#7C5CE0', '#0B7F90', '#B4471A']);
});

test('avatarColor is stable for a name and comes from the palette', () => {
  assert.equal(avatarColor('Sita Gurung'), avatarColor('Sita Gurung'));
  assert.ok(AVATAR_COLORS.includes(avatarColor('Sita Gurung')));
});

test('avatarColor spreads the sample names over at least three colours', () => {
  const names = [
    'Aarav Shrestha', 'Sita Gurung', 'Bikash Thapa', 'Priya Maharjan',
    'Rohan KC', 'Kriti Joshi', 'Nabin Tamang', 'Anisha Rai',
  ];
  const colours = new Set(names.map(avatarColor));
  assert.ok(colours.size >= 3, `only ${colours.size} distinct colours`);
});

test('avatarColor of an empty name is the first colour', () => {
  assert.equal(avatarColor(''), AVATAR_COLORS[0]);
});

test('isGooglePhotoUrl accepts an https photo on googleusercontent.com or a subdomain', () => {
  assert.equal(isGooglePhotoUrl(PHOTO), true);
  assert.equal(isGooglePhotoUrl('https://googleusercontent.com/a/x'), true);
});

test('isGooglePhotoUrl refuses plain http, other hosts and look-alike hosts', () => {
  assert.equal(isGooglePhotoUrl('http://lh3.googleusercontent.com/a/x'), false);
  assert.equal(isGooglePhotoUrl(NOT_GOOGLE), false);
  assert.equal(isGooglePhotoUrl('https://googleusercontent.com.evil.com/a'), false);
  assert.equal(isGooglePhotoUrl('https://evilgoogleusercontent.com/a'), false);
});

test('isGooglePhotoUrl refuses scripts, data, empty, unparsable and missing values', () => {
  assert.equal(isGooglePhotoUrl('javascript:alert(1)'), false);
  assert.equal(isGooglePhotoUrl('data:image/png;base64,AAAA'), false);
  assert.equal(isGooglePhotoUrl(''), false);
  assert.equal(isGooglePhotoUrl('not a url'), false);
  assert.equal(isGooglePhotoUrl(null), false);
});

test('isGooglePhotoUrl refuses an overlong URL', () => {
  assert.equal(isGooglePhotoUrl(`https://lh3.googleusercontent.com/a/${'x'.repeat(2100)}`), false);
});

test('photoUrlOf reads avatar_url, then picture', () => {
  assert.equal(photoUrlOf({ user_metadata: { avatar_url: PHOTO, picture: OTHER_PHOTO } }), PHOTO);
  assert.equal(photoUrlOf({ user_metadata: { picture: PHOTO } }), PHOTO);
});

test('photoUrlOf skips a non-Google avatar_url for a Google picture', () => {
  assert.equal(photoUrlOf({ user_metadata: { avatar_url: NOT_GOOGLE, picture: PHOTO } }), PHOTO);
});

test('photoUrlOf is null for a non-Google URL and for a user without metadata', () => {
  assert.equal(photoUrlOf({ user_metadata: { avatar_url: NOT_GOOGLE } }), null);
  assert.equal(photoUrlOf({ email: 'a@heubert.com' }), null);
  assert.equal(photoUrlOf(null), null);
});

test('photosByName matches the work email ignoring case and spaces', () => {
  const employees = [{ name: 'Bikesh', work_email: ' Bikesh@Heubert.com ', personal_email: null }];
  const users = [{ email: 'bikesh@heubert.com', user_metadata: { avatar_url: PHOTO } }];
  assert.deepEqual(photosByName(employees, users), { Bikesh: PHOTO });
});

test('photosByName matches the personal email', () => {
  const employees = [{ name: 'Sita', work_email: 'sita@heubert.com', personal_email: 'sita.g@gmail.com' }];
  const users = [{ email: 'Sita.G@gmail.com', user_metadata: { picture: PHOTO } }];
  assert.deepEqual(photosByName(employees, users), { Sita: PHOTO });
});

test('photosByName prefers the work email photo when both emails have one', () => {
  const employees = [{ name: 'Bikesh', work_email: 'bikesh@heubert.com', personal_email: 'bikesh@gmail.com' }];
  const users = [
    { email: 'bikesh@gmail.com', user_metadata: { avatar_url: OTHER_PHOTO } },
    { email: 'bikesh@heubert.com', user_metadata: { avatar_url: PHOTO } },
  ];
  assert.deepEqual(photosByName(employees, users), { Bikesh: PHOTO });
});

test('photosByName leaves out auth users who are not employees', () => {
  const employees = [{ name: 'Bikesh', work_email: 'bikesh@heubert.com', personal_email: null }];
  const users = [
    { email: 'bikesh@heubert.com', user_metadata: { avatar_url: PHOTO } },
    { email: 'stranger@gmail.com', user_metadata: { avatar_url: OTHER_PHOTO } },
  ];
  assert.deepEqual(photosByName(employees, users), { Bikesh: PHOTO });
});

test('photosByName leaves out an employee whose only photo is not Google-hosted', () => {
  const employees = [{ name: 'Bikesh', work_email: 'bikesh@heubert.com', personal_email: null }];
  const users = [{ email: 'bikesh@heubert.com', user_metadata: { avatar_url: NOT_GOOGLE } }];
  assert.deepEqual(photosByName(employees, users), {});
});

test('photosByName never pairs a missing employee email with a user who has no email', () => {
  const employees = [{ name: 'Nabin', work_email: '', personal_email: null }];
  const users = [{ email: '', phone: '9800000000', user_metadata: { avatar_url: PHOTO } }];
  assert.deepEqual(photosByName(employees, users), {});
});

test('photoForName matches the exact name, then ignoring case and spaces', () => {
  assert.equal(photoForName({ Bikesh: PHOTO }, 'Bikesh'), PHOTO);
  assert.equal(photoForName({ Bikesh: PHOTO }, ' bikesh '), PHOTO);
});

test('photoForName is null for an unknown name, no name or no photos', () => {
  assert.equal(photoForName({ Bikesh: PHOTO }, 'Sita'), null);
  assert.equal(photoForName({ Bikesh: PHOTO }, ''), null);
  assert.equal(photoForName(null, 'x'), null);
});

test('photoForName ignores names inherited from Object', () => {
  assert.equal(photoForName({ Bikesh: PHOTO }, 'constructor'), null);
  assert.equal(photoForName({ Bikesh: PHOTO }, 'toString'), null);
});

test('photoForName refuses a URL that is not a Google photo', () => {
  assert.equal(photoForName({ Bikesh: 'javascript:alert(1)' }, 'Bikesh'), null);
});

const STAFF = [
  { name: 'Bikesh', work_email: 'bikesh@heubert.com', personal_email: 'bikesh@gmail.com', status: 'active' },
  { name: 'Sita', work_email: 'sita@heubert.com', personal_email: null, status: 'active' },
  { name: 'Rohan', work_email: 'rohan@heubert.com', personal_email: null, status: 'resigned' },
];

test('isActiveEmployeeEmail refuses a caller with no email', () => {
  assert.equal(isActiveEmployeeEmail(STAFF, null), false);
  assert.equal(isActiveEmployeeEmail(STAFF, ''), false);
});

test('isActiveEmployeeEmail refuses someone who is not an employee', () => {
  assert.equal(isActiveEmployeeEmail(STAFF, 'stranger@gmail.com'), false);
});

test('isActiveEmployeeEmail refuses an employee who is no longer active', () => {
  assert.equal(isActiveEmployeeEmail(STAFF, 'rohan@heubert.com'), false);
});

test('isActiveEmployeeEmail accepts an active employee by work or personal email, ignoring case and spaces', () => {
  assert.equal(isActiveEmployeeEmail(STAFF, ' Bikesh@Heubert.com '), true);
  assert.equal(isActiveEmployeeEmail(STAFF, 'BIKESH@gmail.com'), true);
});
