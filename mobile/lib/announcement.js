// The tone of Home's Announcement card (components/EventBanner.js) by the kind of banner. Orange is
// for people moments (intent AC3), so only a celebration, a birthday or a work anniversary, takes
// it; company events, public holidays and the new fiscal year take the cyan signal tone. Pure: no
// imports, so src/lib/mobileAnnouncement.test.mjs holds the text on each tone to 4.5:1.

// The icon on the solid tile: the dark ink the canvas draws on its orange and cyan fills.
const TILE_INK = "#0A0E17";

export function announcementTone(t, kind) {
  if (kind === "celebration") {
    return { fill: t.orangeSoft, edge: t.orangeEdge, tile: t.orange, ink: TILE_INK, title: t.text1, text: t.text2 };
  }
  return { fill: t.pbCyan, edge: t.cyanEdge, tile: t.cyan, ink: TILE_INK, title: t.text1, text: t.text2 };
}
