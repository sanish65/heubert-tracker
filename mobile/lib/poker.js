// Planning poker's deck and how a revealed round reads: the average story points, the card nearest
// it and the votes each card got. Mirrors src/components/PlanningPokerPage.js (FIBONACCI, hasVoted,
// summariseVotes) because the app cannot import from src/; src/lib/mobilePoker.test.mjs runs the
// web's own code on the same rounds and fails when the answers differ. Change a rule there and here
// together. Pure: no imports.

export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];

// A seat holds a card once its vote is anything but the "waiting" the join leaves.
export const hasVoted = (v) => Boolean(v.vote) && v.vote !== "waiting";

// The average of the numeric votes ("?" and empty seats left out), the Fibonacci number nearest
// it, and how many votes each card got, in deck order.
export function summariseVotes(votes) {
  const numericVotes = votes.map((v) => Number(v.vote)).filter((n) => !isNaN(n) && n > 0);
  const average =
    numericVotes.length > 0 ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1) : null;
  const nearestFib =
    average !== null
      ? FIBONACCI.filter((f) => typeof f === "number").reduce((a, b) =>
          Math.abs(b - parseFloat(average)) < Math.abs(a - parseFloat(average)) ? b : a
        )
      : null;

  const counts = {};
  votes.filter(hasVoted).forEach((v) => {
    counts[v.vote] = (counts[v.vote] || 0) + 1;
  });
  const top = Math.max(0, ...Object.values(counts));
  const perCard = FIBONACCI.map(String)
    .filter((card) => counts[card])
    .map((card) => ({
      card,
      count: counts[card],
      width: Math.round((counts[card] / top) * 100),
      isTop: counts[card] === top,
    }));

  return { average, nearestFib, perCard };
}

// A card read out: "1 point", "13 points", and "?" as "Not sure". The vote may be the number you
// tapped or the string the API stores.
export function pointsLabel(value) {
  const card = String(value);
  if (card === "?") return "Not sure";
  return `${card} ${card === "1" ? "point" : "points"}`;
}

// The title of the card you hold, as the canvas's "Your estimate".
export function estimateTitle(value) {
  if (value === null || value === undefined) return "No card yet";
  if (String(value) === "?") return "Not sure yet";
  return pointsLabel(value);
}
