import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

export async function parseOrderWithGemini(userInput, inventoryList) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })

  const inventorySummary = inventoryList.map(i =>
    `${i.part_code} | ${i.part_name} | qty:${i.quantity}`
  ).join('\n')

  const prompt = `
You are an electronics component inventory assistant.

The user has typed an order request. It may have spelling mistakes, abbreviations, or informal names.

Here is the current inventory:
${inventorySummary}

User input:
${userInput}

Your job:
1. Parse each line into a part search term and quantity
2. Fix spelling mistakes using electronics domain knowledge
3. Match each item to the BEST inventory item if possible
4. If exact match not found but a similar component exists (e.g. different voltage rating of same capacitor), suggest it as an alternative
5. Treat every component as unique — a 100uF 16V capacitor is different from 100uF 25V
6. For cables, connectors (M2M, M2F, F2F etc.) treat each type as unique

Respond ONLY with a valid JSON array, no explanation, no markdown, no backticks:
[
  {
    "original": "what user typed",
    "cleaned": "corrected part name",
    "quantity": 10,
    "matched_part_code": "exact part_code from inventory or null",
    "matched_part_name": "exact part_name from inventory or null",
    "alternative_part_code": "if no exact match but similar exists, put that part_code here or null",
    "alternative_part_name": "similar part name or null",
    "alternative_reason": "why this alternative could work or null"
  }
]
`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

export async function parseExcelWithGemini(rawData, existingInventory = []) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })

  const inventoryList = existingInventory.map(i =>
    `${i.part_code} | ${i.part_name}`
  ).join('\n')

  const prompt = `
You are an electronics inventory assistant responsible for maintaining consistent part naming.

EXISTING INVENTORY (you MUST reuse these exact part_code and part_name if the part matches):
${inventoryList || 'No existing inventory yet'}

NEW PURCHASE ORDER Excel data to parse:
${JSON.stringify(rawData)}

RULES:
1. If a part already exists in inventory (same component + same spec), use the EXACT same part_code and part_name — do not change even one character
2. If a row has no component name but has a specification, it belongs to the previous component — combine as "ComponentName - Specification"
3. For NEW parts not in inventory, generate a clean consistent part_code like "ESP32-30PIN", "BURGSTRIP-MALE", "SERVO-MG996R" — uppercase, no spaces, use hyphen
4. For NEW parts, part_name should be full descriptive name like "ESP32 Development Board 30Pin"
5. Skip total rows, packing rows, transport rows, empty rows
6. Every part with different specification is a UNIQUE part (e.g. ESP32 30pin and ESP32 38pin are different)
7. Extract quantity, unit_cost (cost price), selling_price

Respond ONLY with valid JSON array, no explanation, no markdown, no backticks:
[
  {
    "part_code": "EXACT-CODE",
    "part_name": "Full descriptive name",
    "category": "IC/Sensor/Motor/Module/Cable/Connector etc",
    "quantity": 10,
    "unit_cost": 5.00,
    "selling_price": 10.00,
    "is_existing": true or false
  }
]
`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}