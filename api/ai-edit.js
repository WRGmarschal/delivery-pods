const { authenticate } = require("./_cms-utils");

module.exports = async function handler(req, res) {
  try {
    if (!authenticate(req)) return res.status(401).json({ error: "Invalid CMS access token" });
    if (req.method !== "POST") return res.status(405).json({ error: "POST required" });
    const { instruction, fields, page } = req.body || {};
    if (typeof instruction !== "string" || instruction.trim().length < 3) {
      return res.status(400).json({ error: "Describe the change you want" });
    }
    if (!Array.isArray(fields) || fields.length > 80) return res.status(400).json({ error: "Invalid page fields" });

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CMS_MODEL || "gpt-5.4-mini",
        reasoning: { effort: "low" },
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: "You edit conversion-focused B2B landing-page copy for White Rabbit Group. Preserve factual claims, company names, pricing, links, and HTML-free plain text unless the user explicitly requests a change. Return JSON only with shape {\"fields\":[{\"id\":\"existing id\",\"value\":\"revised text\"}],\"summary\":\"short summary\"}. Include only changed fields. Never invent customer facts or metrics." }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify({ page, instruction: instruction.trim(), fields }) }],
          },
        ],
        text: { format: { type: "json_object" } },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "OpenAI request failed");
    const output = (data.output || []).flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
    if (!output) throw new Error("AI returned no editable copy");
    const result = JSON.parse(output);
    const validIds = new Set(fields.map((field) => field.id));
    result.fields = (result.fields || []).filter((field) => validIds.has(field.id) && typeof field.value === "string");
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || "AI edit failed" });
  }
};
