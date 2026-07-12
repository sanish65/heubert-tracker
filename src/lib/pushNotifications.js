const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100; // Expo's push API caps each request at 100 messages.

// Sends the same title/body/data to every given Expo push token, chunked to
// respect Expo's push API limits. Invalid/missing tokens are silently dropped.
export async function sendPushNotifications(tokens, { title, body, data }) {
  const validTokens = [...new Set(tokens)].filter(
    (t) => typeof t === "string" && t.startsWith("ExponentPushToken")
  );
  if (validTokens.length === 0) return { sent: 0 };

  const chunks = [];
  for (let i = 0; i < validTokens.length; i += CHUNK_SIZE) {
    chunks.push(validTokens.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(
    chunks.map((chunk) =>
      fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk.map((to) => ({ to, title, body, data, sound: "default" }))),
      }).catch((err) => console.error("Expo push send error:", err))
    )
  );

  return { sent: validTokens.length };
}
