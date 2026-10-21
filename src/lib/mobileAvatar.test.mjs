import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as web from './avatar.js';
import * as phone from '../../mobile/lib/avatar.js';

// The phone cannot import from src/, so mobile/lib/avatar.js carries its own copy of the avatar
// rules: initials, colour, and which Google photo URLs may be shown. Each test below runs the web
// module and the phone copy on the same inputs and demands the same answer, so a rule changed on
// one side and not the other fails here. What the web module answers is pinned by avatar.test.mjs;
// these tables only have to reach every branch and edge of the copied code.

const PHOTO = 'https://lh3.googleusercontent.com/a/x=s96-c';
const OTHER_PHOTO = 'https://lh3.googleusercontent.com/a/other=s96-c';
const NOT_GOOGLE = 'https://evil.example.com/a.png';

const show = (value) => inspect(value, { depth: 1, maxStringLength: 48, breakLength: Infinity });

// What a call gave: its answer, or the kind of error it threw.
function outcome(fn, args) {
  try {
    return { returned: fn(...args) };
  } catch (error) {
    return { threw: error?.name };
  }
}

// Calls `name` from both modules with every argument list and demands equal outcomes.
function sameOnEvery(name, argLists) {
  assert.equal(typeof phone[name], 'function', `mobile/lib/avatar.js does not export ${name}`);
  for (const args of argLists) {
    assert.deepEqual(outcome(phone[name], args), outcome(web[name], args), `${name}(${args.map(show).join(', ')})`);
  }
}

// A Google photo URL exactly `length` characters long.
function googleUrlOfLength(length) {
  const start = 'https://lh3.googleusercontent.com/a/';
  return start + 'x'.repeat(length - start.length);
}

const NAMES = [
  'Rohan KC', 'Anisha Kumari Rai', 'Sanish', 'bikesh',
  '  priya   maharjan ', 'Sita\tGurung\nThapa',
  'Sita Gurung', 'SITA GURUNG', ' sita gurung ',
  'Aarav Shrestha', 'Bikash Thapa', 'Priya Maharjan', 'Kriti Joshi', 'Nabin Tamang', 'Anisha Rai',
  // An ASCII capital and its small letter are 32 apart, which never changes which of four colours
  // a name gets; these capitals are 1 apart from theirs, so only they show whether case is folded.
  'Ānanda Śarma', 'ĐORĐE KOSTIĆ',
  'प्रणय शर्मा', '😀 Smile', 'x'.repeat(500),
  '', '   ', null, undefined, 0, 42,
];

const URLS = [
  PHOTO,
  'https://googleusercontent.com/a/x',
  'https://a.b.googleusercontent.com/a/x',
  'HTTPS://LH3.GoogleUserContent.com/a/x',
  'https://lh3.googleusercontent.com',
  'https://lh3.googleusercontent.com/a/x?sz=50#top',
  'https://someone@lh3.googleusercontent.com/a/x',
  'http://lh3.googleusercontent.com/a/x',
  NOT_GOOGLE,
  'https://googleusercontent.com.evil.com/a',
  'https://evilgoogleusercontent.com/a',
  'https://evil.example.com/@lh3.googleusercontent.com/a',
  'https://evil.example.com\\@lh3.googleusercontent.com/a',
  'https://lh3.googleusercontent.com:8443/a',
  'https://lh3.googleusercontent.com:443/a',
  'https://lh3.googleusercontent.com./a',
  'javascript:alert(1)',
  'data:image/png;base64,AAAA',
  'file:///etc/passwd',
  '//lh3.googleusercontent.com/a/x',
  'not a url',
  '',
  null, undefined, 123, {}, [PHOTO],
  googleUrlOfLength(2047), googleUrlOfLength(2048), googleUrlOfLength(2049), googleUrlOfLength(3000),
];

const PHOTOS = { Bikesh: PHOTO, 'Sita Gurung': OTHER_PHOTO, Rohan: NOT_GOOGLE, Nabin: 'javascript:alert(1)' };
const PHOTO_LOOKUPS = [
  [PHOTOS, 'Bikesh'],
  [PHOTOS, ' bikesh '],
  [PHOTOS, 'BIKESH'],
  [PHOTOS, 'sita gurung'],
  [PHOTOS, 'Sita  Gurung'],
  [PHOTOS, 'Sita'],
  [PHOTOS, 'Rohan'],
  [PHOTOS, 'Nabin'],
  [PHOTOS, ''],
  [PHOTOS, '   '],
  [PHOTOS, null],
  [PHOTOS, undefined],
  [PHOTOS, 42],
  [PHOTOS, 'constructor'],
  [PHOTOS, 'toString'],
  [PHOTOS, '__proto__'],
  [PHOTOS, 'hasOwnProperty'],
  [null, 'Bikesh'],
  [undefined, 'Bikesh'],
  ['Bikesh', 'Bikesh'],
  [42, 'Bikesh'],
  [{ hasOwnProperty: PHOTO }, 'hasOwnProperty'],
  [{ ' Bikesh ': PHOTO }, 'bikesh'],
  [{ bikesh: OTHER_PHOTO, Bikesh: PHOTO }, 'BIKESH'],
  [{ Bikesh: null }, 'Bikesh'],
  [{ Bikesh: 123 }, 'Bikesh'],
  [{ '': PHOTO }, ''],
  [{ ' ': PHOTO }, '   '],
  [Object.assign(() => {}, { Bikesh: PHOTO }), 'Bikesh'],
  [Object.create({ Bikesh: PHOTO }), 'Bikesh'],
  [Object.assign(Object.create(null), { Bikesh: PHOTO }), 'bikesh'],
];

test('AVATAR_COLORS is the same palette as the web', () => {
  assert.deepEqual(phone.AVATAR_COLORS, web.AVATAR_COLORS);
});

test('initials gives what the web gives, for every name', () => {
  sameOnEvery('initials', NAMES.map((name) => [name]));
});

test('avatarColor gives what the web gives, for every name', () => {
  sameOnEvery('avatarColor', NAMES.map((name) => [name]));
});

test('isGooglePhotoUrl gives what the web gives, for every URL', () => {
  sameOnEvery('isGooglePhotoUrl', URLS.map((url) => [url]));
});

test('photoForName gives what the web gives, for every lookup', () => {
  sameOnEvery('photoForName', PHOTO_LOOKUPS);
});
