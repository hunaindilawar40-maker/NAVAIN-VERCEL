export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY environment variable is not set." });
  }

  try {
    let { messages } = req.body;

    // Backend safety: truncate any oversized messages
    const MAX_CHARS_PER_MESSAGE = 10000;
    messages = messages.map(msg => {
      if (typeof msg.content === 'string' && msg.content.length > MAX_CHARS_PER_MESSAGE) {
        msg.content = msg.content.slice(0, MAX_CHARS_PER_MESSAGE) + 
          `\n\n[... Truncated by server: ${msg.content.length - MAX_CHARS_PER_MESSAGE} chars removed ...]`;
      }
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.map(part => {
          if (part.type === 'text' && part.text && part.text.length > MAX_CHARS_PER_MESSAGE) {
            part.text = part.text.slice(0, MAX_CHARS_PER_MESSAGE) + 
              `\n\n[... Truncated by server ...]`;
          }
          return part;
        });
      }
      return msg;
    });

    const hasImage = messages.some(m =>
      Array.isArray(m.content) && m.content.some(c => c.type === "image_url")
    );

    const model = hasImage ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages,
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error: " + err.message });
  }
}
