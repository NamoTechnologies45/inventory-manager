// api/parse-order.js  (Vercel serverless function)
// Keeps your Gemini API key on the server, never in the browser.
// Env var needed on Vercel (and in .env.local for local testing): GEMINI_API_KEY

const MODEL = 'gemini-3.5-flash-lite' // free-tier friendly; model names change, check AI Studio

const INSTRUCTIONS = `You decode customer messages for an electronics components shop.
Extract every component the customer wants and its quantity.

Rules:
- The message may be English, Hindi or Hinglish, with typos and filler words (greetings, "bhai", "please", "urgent"). Ignore the filler.
- Fix obvious typos and expand shorthand: "10k res" -> "10k resistor", "bc 547" -> "BC547", "7805 reg" -> "7805 voltage regulator".
- Keep part numbers exactly as a distributor would write them (no spaces).
- Quantities: "1k" or "1000" -> 1000, "a hundred" -> 100, "50 pcs" -> 50. If no quantity is given, use 1.
- Do not invent parts that are not in the message.
- Reply ONLY with JSON in this shape: {"items":[{"query":"BC547","qty":50}]}

Customer message:
`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const text = (req.body?.text || '').toString().slice(0, 4000)
  if (!text.trim()) return res.status(400).json({ error: 'Empty message' })

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: INSTRUCTIONS + text }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0 },
        }),
      }
    )

    if (!r.ok) {
      const detail = await r.text()
      console.error('Gemini error', r.status, detail)
      return res.status(502).json({
        error: 'AI error ' + r.status,
        keySet: Boolean(process.env.GEMINI_API_KEY),
        detail: detail.slice(0, 500),
      })
    }

    const data = await r.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

    const items = (parsed.items || [])
      .filter(i => i && i.query)
      .map(i => ({ query: String(i.query).trim(), qty: Math.max(1, parseInt(i.qty) || 1) }))

    return res.status(200).json({ items })
  } catch (e) {
    return res.status(500).json({ error: 'Parse failed' })
  }
}