// The colours of a day in the Leaves calendar (components/LeaveCalendar.js), from the theme's
// tokens. Pure: no imports, so src/lib/mobileLeaveCalendar.test.mjs holds every number on every
// kind of cell to 4.5:1 (intent AC10) in both themes.
//
// Orange is kept for people moments (intent AC3), so a holiday takes the grey pill tone: the pbGray
// fill on a stronger hairline, its number in pfGray. Today stays cyan, a weekend is dashed and
// dimmer, the day you tapped is edged in primary.
//
// On a tinted cell (a holiday, today) text3 falls under 4.5:1, so the BS day there takes text2; the
// first of a BS month is the deep cyan of the on-page eyebrows, which reads on every cell where
// cyanText does not (on the light theme's tints).
export function dayCellTone(t, { weekend, holiday, today, selected, bsFirst }) {
  let fill = t.raised;
  let edge = t.line;
  let num = t.text1;
  if (weekend) {
    fill = "transparent";
    num = t.text3;
  }
  if (holiday) {
    fill = t.pbGray;
    edge = t.lineStrong;
    num = t.pfGray;
  }
  if (today) {
    fill = t.pbCyan;
    edge = t.cyan;
    num = t.text1;
  }
  if (selected) edge = t.primary;
  const tinted = holiday || today;
  return {
    fill,
    edge,
    num,
    bs: bsFirst ? t.pageEyebrow : tinted ? t.text2 : t.text3,
    edgeWidth: today || selected ? 1.5 : 1,
    dashed: weekend && !holiday && !today && !selected,
  };
}

// A strip under the grid for each of the month's holidays: the same grey tone, a flag, the title and
// the dates.
export function holidayStripTone(t) {
  return { fill: t.pbGray, edge: t.lineStrong, flag: t.pfGray, title: t.text1, date: t.text2 };
}
