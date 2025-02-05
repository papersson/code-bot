import { NextRequest } from "next/server";
import { smoothStream, streamText } from "ai";
import { createAzure } from "@ai-sdk/azure";

// Optional: run on Edge
export const runtime = "edge";
// Ensure Next.js does not buffer or cache
export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `
You are an AI assistant.

You use Markdown for code. Use standard code fences for code blocks with triple backticks and the language name. You ALWAYS refer to the file name on the first line of the code block. Do NOT refer to the file name before the code block! The next immediate line should be a code line, not an empty line. When outputting code for a specific file, you should always output the whole file so it can be copy and pasted; do NOT omit any code for brevity unless instructed by the user.

You use Markdown formatting. When using Markdown, you always follows best practices for clarity and consistency. You always uses a single space after hash symbols for headers (e.g., "# Header 1") and leaves a blank line before and after headers, lists, and code blocks. For emphasis, you uses asterisks or underscores consistently (e.g., italic or bold). When creating lists, you aligns items properly and uses a single space after the list marker. For nested bullets in bullet point lists, you uses two spaces before the asterisk (*) or hyphen (-) for each level of nesting. For nested bullets in numbered lists, you uses three spaces before the number and period (e.g., "1.") for each level of nesting.

If you provide bullet points in its response, each bullet point should be at least 1-2 sentences long unless the human requests otherwise. You should not use bullet points or numbered lists unless the human explicitly asks for a list and should instead write in prose and paragraphs without any lists, i.e. its prose should never include bullets or numbered lists anywhere. Inside prose, it writes lists in natural language like "some things include: x, y, and z" with no bullet points, numbered lists, or newlines.
`;

export async function POST(req: NextRequest) {
  try {
    const { messages, model } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid messages format", { status: 400 });
    }

    // Validate env vars
    if (
      !process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME ||
      !process.env.NEXT_PUBLIC_AZURE_API_KEY
    ) {
      console.error("❌ Chat API: Missing Azure credentials");
      return new Response("Server configuration error", { status: 500 });
    }

    // Create Azure instance
    const azure = createAzure({
      resourceName: process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME,
      apiKey: process.env.NEXT_PUBLIC_AZURE_API_KEY,
      apiVersion: "2024-12-01-preview",
    });

    // Model configuration mapping
    const MODEL_CONFIG = {
      'o3-mini-low': {
        baseModel: 'o3-mini',
        providerOptions: { azure: { reasoningEffort: 'low' } }
      },
      'o3-mini-high': {
        baseModel: 'o3-mini',
        providerOptions: { azure: { reasoningEffort: 'high' } }
      }
    } as const;

    // Get model configuration or use default
    const config = MODEL_CONFIG[model as keyof typeof MODEL_CONFIG];
    const modelInstance = azure(config?.baseModel || model);

    // Stream text from the model
    const result = await streamText({
      model: modelInstance,
      messages,
      system: SYSTEM_PROMPT,
      experimental_transform: smoothStream(),
      ...(config?.providerOptions && { providerOptions: config.providerOptions })
      // temperature: 0.7, etc.
    });

    // Return as plain text
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("❌ Chat API Error:", error);
    return new Response(
      error instanceof Error ? error.message : "An unexpected error occurred",
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }
    );
  }
}
