[AI SDK llms.txt](https://sdk.vercel.ai/llms.txt)

# Building a Chatbot that Streams Responses Using Azure Models

To build a chatbot that streams responses using Azure models, you can follow these high-level steps:

## 1. Configure the Azure Provider

Set up the Azure OpenAI provider (or an Azure-compatible provider) by importing it from the appropriate module (for example, using `@ai-sdk/openai` with your Azure-specific settings). Provide your deployment name, API key, resource name, and any other custom settings so that the provider is correctly authenticated against your Azure endpoint.

## 2. Create a Streaming API Route

Build a backend endpoint (using a framework such as Express or Next.js) that accepts the chat’s conversation history. Inside this route, call the AI SDK’s `streamText` function using your Azure model—for example:

```ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({
    model: openai('your-deployment-name'), // Azure model deployment name
    system: 'You are a helpful assistant.',
    messages,
  });
  return result.toDataStreamResponse();
}
```

The `streamText` call produces a stream of text chunks that are piped into the HTTP response (using `toDataStreamResponse()`), so the client receives the reply as it’s generated.

## 3. Develop the Chat UI on the Client

On the frontend, use a hook like `useChat` (from `ai/react` for React apps) to manage the chat’s state. This hook automatically handles user input, sends messages to your API endpoint, and updates the UI as streaming data arrives:

```tsx
'use client';

import { useChat } from 'ai/react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
    api: '/api/chat', // your API route URL
  });

  return (
    <>
      {messages.map(message => (
        <div key={message.id}>
          <strong>{message.role === 'user' ? 'User: ' : 'AI: '}</strong>
          {message.content}
        </div>
      ))}
      {isLoading && <button onClick={() => stop()}>Stop</button>}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} placeholder="Type your message..." />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

This setup lets the user’s messages be sent to your API, and as the Azure model produces text, the streaming responses are rendered in real time.

## 4. Integrate and Test

Once both your backend and frontend are in place, test your chatbot by submitting messages and watching as the Azure model streams its response. You can further customize the UI (for example, showing loading spinners, error messages, or cancellation controls) based on the state provided by the `useChat` hook.

## Summary

By configuring the Azure provider, creating an API route that leverages the `streamText` function to return a data stream, and building a client-side chat interface using `useChat`, you can create a chatbot that provides a smooth, real-time streaming experience powered by Azure models.