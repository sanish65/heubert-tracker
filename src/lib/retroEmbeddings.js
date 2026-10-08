// Turns retro card text into vectors in the browser, for grouping cards by meaning.
// Card text never leaves the browser: the only network traffic is the one-time download
// of transformers.js (jsDelivr) and the all-MiniLM-L6-v2 model (~23 MB, Hugging Face),
// both cached by the browser afterwards. The import is deliberately not bundled: the
// webpackIgnore comment leaves it to the browser at runtime (Next.js lazy-loading guide,
// "Magic Comments" — honoured by Turbopack too). Client components only.
const LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL = 'Xenova/all-MiniLM-L6-v2';

let extractorPromise = null;

// Loads once per page; a failed load is forgotten so the next call can retry.
export function loadGroupingModel() {
  if (!extractorPromise) {
    extractorPromise = import(/* webpackIgnore: true */ LIBRARY_URL)
      .then(({ pipeline }) => pipeline('feature-extraction', MODEL, { dtype: 'q8' }))
      .catch((err) => {
        extractorPromise = null;
        throw err;
      });
  }
  return extractorPromise;
}

// texts → one normalised vector (plain number array) per text, same order.
export async function embedTexts(texts) {
  if (!texts.length) return [];
  const extractor = await loadGroupingModel();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
}
