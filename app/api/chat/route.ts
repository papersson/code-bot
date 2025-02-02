import { NextRequest } from "next/server"
import { streamText } from "ai"
import { createAzure } from "@ai-sdk/azure"

// Optional: run on the Edge runtime for lower latency streaming
export const runtime = "edge"

export async function POST(req: NextRequest) {
  try {
    console.log('🔵 Chat API: Received new request');
    
    // The body should include: { messages, model }
    // messages is an array of objects: { role: "user"|"assistant"|"system", content: string }
    const { messages, model } = await req.json()
    console.log('📥 Chat API: Request payload:', { model, messageCount: messages?.length });
    console.log('📝 Chat API: Last message:', messages?.[messages.length - 1]);

    if (!messages || !Array.isArray(messages)) {
      console.error("❌ Chat API: Invalid messages format:", messages)
      return new Response("Invalid messages format", { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME || !process.env.NEXT_PUBLIC_AZURE_API_KEY) {
      console.error("❌ Chat API: Missing Azure credentials")
      return new Response("Server configuration error", { status: 500 })
    }

    console.log('🔷 Chat API: Initializing Azure with model:', model || 'o1');
    // Configure your Azure resource
    const azure = createAzure({
      resourceName: process.env.NEXT_PUBLIC_AZURE_RESOURCE_NAME,
      apiKey: process.env.NEXT_PUBLIC_AZURE_API_KEY,
      apiVersion: "2024-12-01-preview",
    })

    // Use the chosen model (defaults to "o1" if none provided)
    const modelInstance = azure(model || "o1")

    console.log('🚀 Chat API: Starting stream generation');
    // Use the Vercel AI SDK to get a streaming response
    const result = await streamText({
      model: modelInstance,
      messages,
      // temperature: 0.7,
      // maxTokens: 1000,
    })

    console.log('✅ Chat API: Stream generation successful');
    // Convert the stream to a proper response
    return result.toDataStreamResponse()
  } catch (error) {
    console.error("❌ Chat API Error:", error)
    return new Response(error instanceof Error ? error.message : "An unexpected error occurred", { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}
