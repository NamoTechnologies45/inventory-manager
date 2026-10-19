
import { GoogleGenerativeAI } from '@google/generative-ai'

// --------------------------------------------------
// 1. INITIALIZE GEMINI
// --------------------------------------------------

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

if (!API_KEY) {
  throw new Error('Missing VITE_GEMINI_API_KEY environment variable')
}

const genAI = new GoogleGenerativeAI(API_KEY)

const model = genAI.getGenerativeModel({
  model: 'gemini-3.8-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1,
  },
})

// --------------------------------------------------
// 2. HELPER: WAIT BEFORE RETRY
// --------------------------------------------------

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// --------------------------------------------------
// 3. HELPER: GENERATE JSON WITH AUTOMATIC RETRIES
// --------------------------------------------------

async function generateJson(prompt, maxRetries = 4) {
  let result

  for (let attempt = 0; ; attempt++) {
    try {
      result = await model.generateContent(prompt)
      break
    } catch (error) {
      const message = String(error?.message ?? error)

      const status = Number(
        error?.status ??
        error?.statusCode ??
        error?.response?.status
      )

      const isRetryable =
        [408, 429, 500, 502, 503, 504].includes(status) ||
        /\b(408|429|500|502|503|504)\b/.test(message) ||
        /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(
          message
        )

      if (!isRetryable || attempt >= maxRetries) {
        console.error('Gemini API request failed:', error)
        throw error
      }

      const delay =
        Math.min(1000 * 2 ** attempt, 16000) +
        Math.floor(Math.random() * 1000)

      console.warn(
        `Gemini request failed. Retrying in ${delay}ms ` +
        `(${attempt + 1}/${maxRetries})`
      )

      await sleep(delay)
    }
  }

  // Parse outside the retry loop. Invalid JSON is not
  // automatically retried as though it were a server error.
  const responseText = result.response.text()

  const cleanText = responseText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleanText)

    if (!Array.isArray(parsed)) {
      throw new Error('Gemini response must be a JSON array')
    }

    return parsed
  } catch (error) {
    console.error('Invalid JSON returned by Gemini:', responseText)
    throw new Error(
      `Failed to parse Gemini JSON response: ${error.message}`
    )
  }
}

// --------------------------------------------------
// 4. PARSE CUSTOMER ORDER
// --------------------------------------------------

export async function parseOrderWithGemini(
  userInput,
  inventoryList
) {
  const inventorySummary = inventoryList
    .map((i) =>
      `${i.part_code} | ${i.part_name} | qty:${i.quantity}`
    )
    .join('\n')

  const prompt = `
You are an electronics component inventory assistant.

The user has typed an order request. It may have spelling
mistakes, abbreviations, or informal names.

Here is the current inventory:
${inventorySummary}

User input:
${userInput}

Your job:
1. Parse each line into a part search term and quantity.
2. Fix spelling mistakes using electronics domain knowledge.
3. Match each item to the BEST inventory item if possible.
4. If an exact match is not found but a similar component
   exists, suggest it as an alternative.
5. Treat every component as unique. A 100uF 16V capacitor
   is different from a 100uF 25V capacitor.
6. For cables and connectors (M2M, M2F, F2F, etc.),
   treat each type as unique.
7. Never invent a part_code or part_name. Matched values
   must come directly from the supplied inventory.
8. If no exact match exists, use null for matched fields.
9. Suggest an alternative only if it is genuinely similar.
10. Quantity must be a number. If the user does not specify
    quantity, use 1.
11. Return one object for each requested component.
12. If the request is ambiguous, do not claim an exact match
    unless the specifications are sufficiently clear.

Respond ONLY with a valid JSON array, no explanation,
no Markdown, no backticks:

[
  {
    "original": "what user typed",
    "cleaned": "corrected part name",
    "quantity": 10,
    "matched_part_code": "exact part_code from inventory or null",
    "matched_part_name": "exact part_name from inventory or null",
    "alternative_part_code": "similar part_code or null",
    "alternative_part_name": "similar part name or null",
    "alternative_reason": "why this alternative could work or null"
  }
]
`

  return await generateJson(prompt)
}

// --------------------------------------------------
// 5. PARSE PURCHASE ORDER EXCEL DATA
// --------------------------------------------------

export async function parseExcelWithGemini(
  rawData,
  existingInventory = []
) {
  const inventoryList = existingInventory
    .map((i) => `${i.part_code} | ${i.part_name}`)
    .join('\n')

  const prompt = `
You are an electronics inventory assistant responsible
for maintaining consistent part naming.

EXISTING INVENTORY:
You MUST reuse the exact part_code and part_name if the
part matches an existing inventory item.

${inventoryList || 'No existing inventory yet'}

NEW PURCHASE ORDER EXCEL DATA:
${JSON.stringify(rawData)}

RULES:

1. If a part already exists in inventory with the same
   component and same specifications, use the EXACT same
   part_code and part_name. Do not change any characters.

2. If a row has no component name but has a specification,
   it belongs to the previous component. Combine them as
   "ComponentName - Specification".

3. For NEW parts not in inventory, generate a clean,
   consistent part_code, such as:
   "ESP32-30PIN", "BURGSTRIP-MALE", "SERVO-MG996R".
   Use uppercase letters, no spaces, and hyphens.

4. For NEW parts, part_name should be a full descriptive
   name, such as "ESP32 Development Board 30Pin".

5. Skip total rows, packing rows, transport rows,
   empty rows, and other non-product rows.

6. Every part with different specifications is a UNIQUE
   part. ESP32 30-pin and ESP32 38-pin are different parts.

7. Extract quantity, unit_cost (purchase cost), and
   selling_price.

8. Do not merge components just because their names look
   similar. Preserve voltage, capacitance, resistance,
   current rating, pin count, connector type, dimensions,
   and other meaningful specifications.

9. Reuse existing part codes only when the component and
   its relevant specifications match.

10. If a field is missing from the source, do not invent
    a factual price or quantity. Use 0 for missing numeric
    values if the source provides no value.

11. Set is_existing to true only when the item matches an
    existing inventory item. Otherwise, set it to false.

12. Quantity, unit_cost, and selling_price must be numbers,
    not strings. Use decimal numbers for prices.

13. Return one object per valid product line item.

Respond ONLY with a valid JSON array, no explanation,
no Markdown, no backticks:

[
  {
    "part_code": "EXACT-CODE",
    "part_name": "Full descriptive name",
    "category": "IC/Sensor/Motor/Module/Cable/Connector etc",
    "quantity": 10,
    "unit_cost": 5.00,
    "selling_price": 10.00,
    "is_existing": true
  }
]
`

  return await generateJson(prompt)
}
