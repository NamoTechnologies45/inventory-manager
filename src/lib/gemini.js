import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

const MODEL_FALLBACKS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isRetryableError(error) {
  const message = String(error?.message ?? error)
  const status = Number(
    error?.status ?? error?.statusCode ?? error?.response?.status
  )
  return (
    [408, 429, 500, 502, 503, 504].includes(status) ||
    /\b(408|429|500|502|503|504)\b/.test(message) ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded/i.test(message)
  )
}

async function generateJson(prompt) {
  const errors = []

  for (const modelName of MODEL_FALLBACKS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.info(`Trying Gemini model: ${modelName}`)
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleaned = text
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()
        const parsed = JSON.parse(cleaned)
        console.info(`Success with model: ${modelName}`)
        return parsed
      } catch (error) {
        errors.push({
          model: modelName,
          message: String(error?.message ?? error),
        })
        if (!isRetryableError(error)) {
          console.warn(`${modelName} failed; trying fallback.`, error)
          break
        }
        if (attempt === 0) {
          await sleep(1000 + Math.random() * 1000)
        } else {
          console.warn(`${modelName} failed twice; trying next model.`)
        }
      }
    }
  }

  throw new Error('All Gemini models failed. ' + JSON.stringify(errors))
}

// Parse customer order (quotation)
export async function parseOrderWithGemini(userInput, inventoryList) {
  const inventorySummary = inventoryList
    .map((i) => `${i.part_code} | ${i.part_name} | qty:${i.quantity}`)
    .join('\n')

  const prompt = `
You are an electronics component inventory assistant.

The user has typed an order request. It may have spelling mistakes, abbreviations, or informal names.

Here is the current inventory:
${inventorySummary}

User input:
${userInput}

Your job:
1. Parse each line into a part search term and quantity.
2. Fix spelling mistakes using electronics domain knowledge.
3. Match each item to the BEST inventory item if possible.
4. If an exact match is not found but a similar component exists, suggest it as an alternative.
5. Treat every component as unique. A 100uF 16V capacitor is different from a 100uF 25V capacitor.
6. For cables and connectors (M2M, M2F, F2F, etc.), treat each type as unique.
7. Never invent a part_code or part_name. Matched values must come directly from the supplied inventory.
8. If no exact match exists, use null for matched fields.
9. Suggest an alternative only if it is genuinely similar.
10. Quantity must be a number. If the user does not specify quantity, use 1.
11. Return one object for each requested component.

Respond ONLY with a valid JSON array, no explanation, no Markdown, no backticks:
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

// Parse purchase order Excel
export async function parseExcelWithGemini(rawData, existingInventory = []) {
  const inventoryList = existingInventory
    .map((i) => `${i.part_code} | ${i.part_name}`)
    .join('\n')

  const prompt = `
You are an electronics inventory assistant responsible for maintaining consistent part naming.

EXISTING INVENTORY (you MUST reuse these exact part_code and part_name if the part matches):
${inventoryList || 'No existing inventory yet'}

NEW PURCHASE ORDER Excel data to parse:
${JSON.stringify(rawData)}

RULES:
1. If a part already exists in inventory, use the EXACT same part_code and part_name
2. If a row has no component name but has a specification, combine with previous component as "ComponentName - Specification"
3. For NEW parts, generate clean consistent part_code like "ESP32-30PIN" — uppercase, hyphens, no spaces
4. For NEW parts, part_name should be full descriptive name
5. Skip total rows and empty rows
6. Every part with different specification is a UNIQUE part
7. Extract quantity, unit_cost, selling_price
8. Separately detect extra charges like packing, delivery, transport, shipping, handling

Respond ONLY with valid JSON object, no explanation, no markdown, no backticks:
{
  "parts": [
    {
      "part_code": "EXACT-CODE",
      "part_name": "Full descriptive name",
      "category": "IC/Sensor/Motor/Module/Cable/Connector etc",
      "quantity": 10,
      "unit_cost": 5.00,
      "selling_price": 10.00,
      "is_existing": true
    }
  ],
  "expenses": [
    {
      "description": "Packing charges",
      "amount": 235,
      "category": "Packaging"
    }
  ]
}
`

  // parseExcelWithGemini returns object not array
  // so we use generateJson differently here
  const errors = []

  for (const modelName of MODEL_FALLBACKS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.info(`Trying Gemini model: ${modelName}`)
        const result = await model.generateContent(prompt)
        const text = result.response.text()
        const cleaned = text
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()
        const parsed = JSON.parse(cleaned)
        console.info(`Success with model: ${modelName}`)
        return parsed
      } catch (error) {
        errors.push({
          model: modelName,
          message: String(error?.message ?? error),
        })
        if (!isRetryableError(error)) {
          console.warn(`${modelName} failed; trying fallback.`, error)
          break
        }
        if (attempt === 0) {
          await sleep(1000 + Math.random() * 1000)
        } else {
          console.warn(`${modelName} failed twice; trying next model.`)
        }
      }
    }
  }

  throw new Error('All Gemini models failed. ' + JSON.stringify(errors))
}