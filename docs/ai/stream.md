# Backend – Streaming in a Next.js API Route

## Create an API Route:

In Next.js (using the App Router), create an API route (e.g. `app/api/stream/route.ts`) that uses an AI SDK streaming function. For example, using `streamText` to generate a text stream:

```ts
// app/api/stream/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  // Start streaming a text completion from the model
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  // Convert the stream to a Next.js-compatible Response.
  return result.toTextStreamResponse();
}
```

### Optional Custom Data & Error Handling:

You can also use methods like `toDataStreamResponse()` to add custom data or handle errors. See the AI SDK documentation for additional options.

# Frontend – Consuming a Streaming Response in Next.js

## Fetch the API and Process the Stream:

In your client component (for example in a page component under `app/page.tsx`), call your API route with `fetch()` and use a `ReadableStream` reader to process incoming chunks. For example:

```tsx
// app/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function StreamPage() {
  const [text, setText] = useState('');

  useEffect(() => {
    async function fetchStream() {
      const response = await fetch('/api/stream', { method: 'POST' });
      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        // Append the new chunk to the existing text state
        setText((prev) => prev + chunk);
      }
    }

    fetchStream().catch((err) => console.error('Streaming error:', err));
  }, []);

  return (
    <div>
      <h1>Streaming Response</h1>
      <pre>{text}</pre>
    </div>
  );
}
```

## Updating the UI:

In the above code, each received chunk is appended to the component’s state, so your UI updates in real time as data arrives.

# Summary

**Backend:**
- Use the AI SDK’s streaming functions (e.g. `streamText`) in your Next.js API route.
- Convert the stream to a Response using methods like `toTextStreamResponse()` or `toDataStreamResponse()`.

**Frontend:**
- Fetch the API route from your client-side component.
- Read the response’s `ReadableStream` chunk by chunk and update your UI state.

# Generating and Streaming Text

Large language models (LLMs) can generate text in response to a prompt, which can contain instructions and information to process. For example, you can ask a model to come up with a recipe, draft an email, or summarize a document.

The AI SDK Core provides two functions to generate text and stream it from LLMs:

- **generateText**: Generates text for a given prompt and model.
- **streamText**: Streams text from a given prompt and model.

Advanced LLM features such as tool calling and structured data generation are built on top of text generation.

## generateText

You can generate text using the `generateText` function. This function is ideal for non-interactive use cases where you need to write text (e.g. drafting email or summarizing web pages) and for agents that use tools.

```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: yourModel,
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

You can use more advanced prompts to generate text with more complex instructions and content:

```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: yourModel,
  system:
    'You are a professional writer. ' +
    'You write simple, clear, and concise content.',
  prompt: `Summarize the following article in 3-5 sentences: ${article}`,
});
```

The result object of `generateText` contains several promises that resolve when all required data is available:

- `result.text`: The generated text.
- `result.finishReason`: The reason the model finished generating text.
- `result.usage`: The usage of the model during text generation.
- `result.reasoning`: The reasoning text of the model (only available for some models).

## streamText

Depending on your model and prompt, it can take a large language model (LLM) up to a minute to finish generating its response. This delay can be unacceptable for interactive use cases such as chatbots or real-time applications, where users expect immediate responses.

AI SDK Core provides the `streamText` function which simplifies streaming text from LLMs:

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: yourModel,
  prompt: 'Invent a new holiday and describe its traditions.',
});

// example: use textStream as an async iterable
for await (const textPart of result.textStream) {
  console.log(textPart);
}
```

`result.textStream` is both a ReadableStream and an AsyncIterable.

You can use `streamText` on its own or in combination with AI SDK UI and AI SDK RSC. The result object contains several helper functions to make the integration into AI SDK UI easier:

- `result.toDataStreamResponse()`: Creates a data stream HTTP response (with tool calls etc.) that can be used in a Next.js App Router API route.
- `result.pipeDataStreamToResponse()`: Writes data stream delta output to a Node.js response-like object.
- `result.toTextStreamResponse()`: Creates a simple text stream HTTP response.
- `result.pipeTextStreamToResponse()`: Writes text delta output to a Node.js response-like object.

`streamText` is using backpressure and only generates tokens as they are requested. You need to consume the stream in order for it to finish.

It also provides several promises that resolve when the stream is finished:

- `result.text`: The generated text.
- `result.finishReason`: The reason the model finished generating text.
- `result.usage`: The usage of the model during text generation.

## onChunk callback

When using `streamText`, you can provide an `onChunk` callback that is triggered for each chunk of the stream.

It receives the following chunk types:

- `text-delta`
- `reasoning`
- `tool-call`
- `tool-result`
- `tool-call-streaming-start` (when toolCallStreaming is enabled)
- `tool-call-delta` (when toolCallStreaming is enabled)

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: yourModel,
  prompt: 'Invent a new holiday and describe its traditions.',
  onChunk({ chunk }) {
    // implement your own logic here, e.g.:
    if (chunk.type === 'text-delta') {
      console.log(chunk.text);
    }
  },
});
```

## onFinish callback

When using `streamText`, you can provide an `onFinish` callback that is triggered when the stream is finished. It contains the text, usage information, finish reason, messages, and more:

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: yourModel,
  prompt: 'Invent a new holiday and describe its traditions.',
  onFinish({ text, finishReason, usage, response }) {
    // your own logic, e.g. for saving the chat history or recording usage

    const messages = response.messages; // messages that were generated
  },
});
```

## fullStream property

You can read a stream with all events using the `fullStream` property. This can be useful if you want to implement your own UI or handle the stream in a different way. Here is an example of how to use the `fullStream` property:

```typescript
import { streamText } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: yourModel,
  tools: {
    cityAttractions: {
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => ({
        attractions: ['attraction1', 'attraction2', 'attraction3'],
      }),
    },
  },
  prompt: 'What are some San Francisco tourist attractions?',
});

for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta': {
      // handle text delta here
      break;
    }
    case 'reasoning': {
      // handle reasoning here
      break;
    }
    case 'tool-call': {
      switch (part.toolName) {
        case 'cityAttractions': {
          // handle tool call here
          break;
        }
      }
      break;
    }
    case 'tool-result': {
      switch (part.toolName) {
        case 'cityAttractions': {
          // handle tool result here
          break;
        }
      }
      break;
    }
    case 'finish': {
      // handle finish here
      break;
    }
    case 'error': {
      // handle error here
      break;
    }
  }
}
```

## Stream transformation

You can use the `experimental_transform` option to transform the stream. This is useful for filtering, changing, or smoothing the text stream.

The transformations are applied before the callbacks are invoked and the promises are resolved. If you have a transformation that changes all text to uppercase, the `onFinish` callback will receive the transformed text.

### Smoothing streams

The AI SDK Core provides a `smoothStream` function that can be used to smooth out text streaming.

```typescript
import { smoothStream, streamText } from 'ai';

const result = streamText({
  model,
  prompt,
  experimental_transform: smoothStream(),
});
```

### Custom transformations

You can also implement your own custom transformations. The transformation function receives the tools that are available to the model and returns a function that is used to transform the stream. Tools can either be generic or limited to the tools that you are using.

Here is an example of how to implement a custom transformation that converts all text to uppercase:

```typescript
const upperCaseTransform =
  <TOOLS extends ToolSet>() =>
  (options: { tools: TOOLS; stopStream: () => void }) =>
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(chunk, controller) {
        controller.enqueue(
          // for text-delta chunks, convert the text to uppercase:
          chunk.type === 'text-delta'
            ? { ...chunk, textDelta: chunk.textDelta.toUpperCase() }
            : chunk,
        );
      },
    });
```

You can also stop the stream using the `stopStream` function. This is useful if you want to stop the stream when model guardrails are violated, e.g. by generating inappropriate content.

When you invoke `stopStream`, it is important to simulate the step-finish and finish events to guarantee that a well-formed stream is returned and all callbacks are invoked.

```typescript
const stopWordTransform =
  <TOOLS extends ToolSet>() =>
  ({ stopStream }: { stopStream: () => void }) =>
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      // note: this is a simplified transformation for testing;
      // in a real-world version more there would need to be
      // stream buffering and scanning to correctly emit prior text
      // and to detect all STOP occurrences.
      transform(chunk, controller) {
        if (chunk.type !== 'text-delta') {
          controller.enqueue(chunk);
          return;
        }

        if (chunk.textDelta.includes('STOP')) {
          // stop the stream
          stopStream();

          // simulate the step-finish event
          controller.enqueue({
            type: 'step-finish',
            finishReason: 'stop',
            logprobs: undefined,
            usage: {
              completionTokens: NaN,
              promptTokens: NaN,
              totalTokens: NaN,
            },
            request: {},
            response: {
              id: 'response-id',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            warnings: [],
            isContinued: false,
          });

          // simulate the finish event
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            logprobs: undefined,
            usage: {
              completionTokens: NaN,
              promptTokens: NaN,
              totalTokens: NaN,
            },
            response: {
              id: 'response-id',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
          });

          return;
        }

        controller.enqueue(chunk);
      },
    });
```

### Multiple transformations

You can also provide multiple transformations. They are applied in the order they are provided.

```typescript
const result = streamText({
  model,
  prompt,
  experimental_transform: [firstTransform, secondTransform],
});
```

## Generating Long Text

Most language models have an output limit that is much shorter than their context window. This means that you cannot generate long text in one go, but it is possible to add responses back to the input and continue generating to create longer text.

`generateText` and `streamText` support such continuations for long text generation using the `experimental_continueSteps` setting:

```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const {
  text, // combined text
  usage, // combined usage of all steps
} = await generateText({
  model: openai('gpt-4o'), // 4096 output tokens
  maxSteps: 5, // enable multi-step calls
  experimental_continueSteps: true,
  prompt:
    'Write a book about Roman history, ' +
    'from the founding of the city of Rome ' +
    'to the fall of the Western Roman Empire. ' +
    'Each chapter MUST HAVE at least 1000 words.',
});
```

When `experimental_continueSteps` is enabled, only full words are streamed in `streamText`, and both `generateText` and `streamText` might drop the trailing tokens of some calls to prevent whitespace issues.

Some models might not always stop correctly on their own and keep generating until `maxSteps` is reached. You can hint the model to stop by using a system message such as "Stop when sufficient information was provided."


# Stream Text Example

Text generation can sometimes take a long time to complete, especially when you're generating a couple of paragraphs. In such cases, it is useful to stream the text generation process to the client in real-time. This allows the client to display the generated text as it is being generated, rather than have users wait for it to complete before displaying the result.

[http://localhost:3000](http://localhost:3000)

## Answer

The sky appears blue because of a phenomenon called Rayleigh scattering. When sunlight reaches the Earth's atmosphere, the gases and particles in the air scatter the shorter blue wavelengths of light more effectively than the other colors in the spectrum. This scattered blue light is what we see when we look up at the sky.

## Client

Let's create a simple React component that imports the `useCompletion` hook from the `ai/react` module. The `useCompletion` hook will call the `/api/completion` endpoint when a button is clicked. The endpoint will generate text based on the input prompt and stream it to the client.

### app/page.tsx

```typescript
'use client';

import { useCompletion } from 'ai/react';

export default function Page() {
  const { completion, complete } = useCompletion({
    api: '/api/completion',
  });

  return (
    <div>
      <div
        onClick={async () => {
          await complete('Why is the sky blue?');
        }}
      >
        Generate
      </div>

      {completion}
    </div>
  );
}
```

## Server

Let's create a route handler for `/api/completion` that will generate text based on the input prompt. The route will call the `streamText` function from the `ai` module, which will then generate text based on the input prompt and stream it to the client.

### app/api/completion/route.ts

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt }: { prompt: string } = await req.json();

  const result = streamText({
    model: openai('gpt-4'),
    system: 'You are a helpful assistant.',
    prompt,
  });

  return result.toDataStreamResponse();
}
```