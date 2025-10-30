const OPENROUTER_API_URL = "https://api.openrouter.com";

const MODELS = {
  text: {
    default: "text-davinci-003",
    options: ["text-davinci-003", "text-ada-001"],
  },
  chat: {
    default: "gpt-3.5-turbo",
    options: ["gpt-3.5-turbo", "gpt-4"],
  },
};

interface OpenRouterRequest {
  model: string;
  prompt: string;
  max_tokens: number;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    text: string;
    index: number;
    logprobs: any;
    finish_reason: string;
  }>;
}

// Constants for cost calculation
const COST_PER_TOKEN = 0.00004;

async function generateContent(request: OpenRouterRequest): Promise<string> {
  try {
    const response = await fetch(`${OPENROUTER_API_URL}/v1/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }

    const data: OpenRouterResponse = await response.json();
    const tokenUsage = data.choices.reduce((acc, choice) => acc + choice.text.split(' ').length, 0);
    trackUsage(tokenUsage);

    return data.choices[0].text;
  } catch (error) {
    console.error("Failed to generate content:", error);
    return "Sorry, I couldn't generate the content at this time."; // Fallback response
  }
}

function trackUsage(tokens: number): void {
  const cost = tokens * COST_PER_TOKEN;
  console.log(`Token consumption: ${tokens}, Cost: $${cost.toFixed(6)}`);
}

export { OPENROUTER_API_URL, MODELS, generateContent };