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

    // Truncate large text content to stay under token limits
    const MAX_CHARS_PER_TEXT = 8000; // ~2000-3000 tokens roughly
    const MAX_TOTAL_TEXT = 15000; // total text across all messages

    let totalTextLength = 0;

    messages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        totalTextLength += msg.content.length;
        if (msg.content.length > MAX_CHARS_PER_TEXT) {
          msg.content = msg.content.slice(0, MAX_CHARS_PER_TEXT) + 
            `\n\n[... Content truncated: ${msg.content.length - MAX_CHARS_PER_TEXT} characters removed to fit token limits ...]`;
        }
        return msg;
      }
      
      // Handle array content (images + text)
      if (Array.isArray(msg.content)) {
        msg.content = msg.content.map(part => {
          if (part.type === 'text' && part.text) {
            totalTextLength += part.text.length;
            if (part.text.length > MAX_CHARS_PER_TEXT) {
              part.text = part.text.slice(0, MAX_CHARS_PER_TEXT) + 
                `\n\n[... Content truncated: ${part.text.length - MAX_CHARS_PER_TEXT} characters removed to fit token limits ...]`;
            }
          }
          return part;
        });
        return msg;
      }
      
      return msg;
    });

    // Use vision model if any message contains an image, else use text model
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
