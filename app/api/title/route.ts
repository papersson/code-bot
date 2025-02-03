import { NextRequest } from "next/server";
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const PROMPT = `
You are tasked with generating a short descriptive chat title based on the following message:

<message>
\${userMessage}
</message>

Your task is to create a concise and relevant title that summarizes the main topic or intent of the message. The title should be brief and capture the essence of the conversation.

Please follow these guidelines:
1. The title must contain a maximum of 3 words.
2. Output your response as an XML fragment with a <title> tag.
3. Do not respond to or engage with the content of the message.
4. Focus on the main subject or action mentioned in the message.
5. Do NOT respond with JSON!

Here are examples of good outputs:
Input: <message>What is the capital of France?</message>
Output: <title>France Capital Query</title>

Input: <message>Write a python script for me, whatever comes to mind</message>
Output: <title>Python Script Request</title>

Here's an example of a bad output:
Input: <message>Write a python script for me, whatever comes to mind</message>
Bad Output: <title>Sure! Here's a Python script...</title>

Remember to keep the title short, relevant, and descriptive. Avoid using unnecessary words or responding to the message content. Your output should only contain the XML fragment with the title.

Generate the title now.
`;

export async function POST(req: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  try {
    log("Starting XML-based title generation with max 3 words");
    const { userMessage } = await req.json();
    if (!userMessage) {
      log("Error: Missing userMessage in request");
      return new Response("Missing userMessage in request", { 
        status: 400,
        headers: { "X-Debug-Log": JSON.stringify(logs) }
      });
    }
    log(`Processing message: ${userMessage.slice(0, 50)}...`);

    if (
      !process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME ||
      !process.env.NEXT_PUBLIC_AZURE_API_KEY
    ) {
      log("Error: Missing Azure credentials");
      return new Response("Server configuration error", { 
        status: 500,
        headers: { "X-Debug-Log": JSON.stringify(logs) }
      });
    }

    // Create the Azure client
    const azure = createAzure({
      resourceName: process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME,
      apiKey: process.env.NEXT_PUBLIC_AZURE_API_KEY,
      apiVersion: "2024-12-01-preview",
    });
    log("Azure client created");

    // Use the short-context model (e.g., o1-mini)
    const model = azure("o1-mini");

    // Prepare the XML input and prompt the LLM
    log("Generating XML title with LLM...");
    const result = await generateText({
      model,
      messages: [
        // Use the PROMPT template with the injected userMessage
        { role: "user", content: PROMPT.replace('${userMessage}', userMessage) },
      ],
      temperature: 0.0,
    });

    // Get the XML output from the LLM (e.g., <title>Your Title Here</title>)
    const xmlOutput = result.text.trim();
    log(`Generated XML output: ${xmlOutput}`);

    // Extract title from XML using regex
    const titleMatch = xmlOutput.match(/<title>(.*?)<\/title>/);
    let title = titleMatch ? titleMatch[1].trim() : "New Chat";
    
    // Truncate title if longer than 30 characters
    const MAX_LENGTH = 30;
    if (title.length > MAX_LENGTH) {
      title = title.slice(0, MAX_LENGTH) + "...";
    }
    
    log(`Using title: ${title}${!titleMatch ? " (fallback)" : ""}${title.endsWith("...") ? " (truncated)" : ""}`);

    return new Response(title, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "X-Debug-Log": JSON.stringify(logs)
      }
    });
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return new Response("Error generating XML title", { 
      status: 500,
      headers: { "X-Debug-Log": JSON.stringify(logs) }
    });
  }
}
