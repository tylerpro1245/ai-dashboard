export async function generateRoadmapWithOpenAI({ topics, level = 'beginner', weeks = 6, model = 'gpt-4o-mini' }) {
  const key = localStorage.getItem('openai_api_key') || ''
  if (!key) throw new Error('NO_KEY')

  // Structured JSON response schema
  const sys = `You are an AI curriculum planner. Output STRICT JSON ONLY with this shape:
{
  "items": [
    { "id": "slug", "title": "string", "status": "not-started|in-progress|done", "estHours": number, "prereqs": string[] }
  ]
}`

  const user = `Create a ${weeks}-week learning roadmap for level=${level}.
Topics: ${topics}.
Constraints:
- ~6-10 items
- Fill "prereqs" with ids of required previous items
- Reasonable "estHours" (3-25)
- status must be "not-started" for all items`

  // Use Chat Completions or Responses API. Chat Completions is widely supported.
  const body = {
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ],
    temperature: 0.4,
    response_format: { type: "json_object" }
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`OpenAI error: ${res.status} ${t}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content?.trim() || "{}"
  return JSON.parse(content)
}

// Local fallback if no key set
export function localFallbackRoadmap(topics, level='beginner', weeks=6) {
  const base = [
    { id:"foundations", title:"Math & Python Foundations", estHours:12, prereqs:[] },
    { id:"ml-basics", title:"ML Basics", estHours:16, prereqs:["foundations"] },
    { id:"topic-core", title:`Core: ${topics.split(',')[0]?.trim() || 'Topic'}`, estHours:18, prereqs:["ml-basics"] },
    { id:"topic-advanced", title:`Advanced: ${topics.split(',')[1]?.trim() || 'Advanced Topic'}`, estHours:20, prereqs:["topic-core"] },
    { id:"project", title:"Capstone Project", estHours:24, prereqs:["topic-advanced"] }
  ]
  return { items: base.map(x => ({ ...x, status:'not-started' })) }
}
