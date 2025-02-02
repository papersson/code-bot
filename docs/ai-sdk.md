Below is a step‐by‐step example of how to call your custom “o1” and “o1-mini” deployments in Azure Foundry using the AI SDK’s Azure provider. In short, you will:

1. Create an Azure provider instance, passing in your resource name, API key, and (optionally) region.
2. Call `azure("<deploymentName>")` with either "o1" or "o1-mini" (exactly matching your Azure deployment name).
3. Use standard AI SDK methods such as `generateText` or `streamText`, just like you would with any other model.

## 1. Install the Azure Provider

If you have not already, install the `@ai-sdk/azure` package:

```bash
pnpm add @ai-sdk/azure

# or
npm install @ai-sdk/azure

# or
yarn add @ai-sdk/azure
```

## 2. Create the Azure Provider Instance

In your code, import `createAzure` (or use the default `azure`) from `@ai-sdk/azure` and pass in your Azure credentials. For example:

```ts
import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';

// 1. Create your Azure provider instance
const azure = createAzure({
  // The Azure resource name of your OpenAI Foundry instance:
  resourceName: process.env.AZURE_RESOURCE_NAME ?? 'my-azure-resource',

  // The Azure OpenAI API key. Falls back to AZURE_API_KEY if not set:
  apiKey: process.env.AZURE_API_KEY,

  // (Optional) region is only used if you do not have a custom resourceName or baseURL:
  location: 'swedencentral',

  // (Optional) If you have a custom baseURL or query params, you can set them here:
  // baseURL: 'https://my-azure-endpoint.openai.azure.com/openai/deployments',
  // queryParams: { 'api-version': '2023-07-01-preview' },
});
```

Your Azure resource must already have two deployments named `o1` and `o1-mini` (or whichever names you used in your “AI Foundry” setup).

**Tip:** Azure docs on naming deployments if you need to confirm how your deployment names map.

## 3. Use o1 or o1-mini in generateText

Below is an example using `generateText`, but you can also use `streamText`, `generateObject`, etc. Exactly the same as any other AI SDK usage—just pass `azure('o1')` or `azure('o1-mini')` as the model.

```ts
(async () => {
  // 2. Generate text with the “o1” model
  const { text, usage } = await generateText({
    model: azure('o1'), // this must match your Azure deployment name
    prompt: 'Please summarize the main achievements of Marie Curie.',
    temperature: 0.1,
    maxTokens: 512,
  });

  console.log('Text:', text);
  console.log('Token Usage:', usage);
})();
```

If you also want to try the “o1-mini” deployment:

```ts
const result = await generateText({
  model: azure('o1-mini'),
  prompt: 'Explain Newton’s laws of motion in simple terms.',
});
console.log(result.text);
```

## 4. Reasoning Models in Azure

OpenAI’s “o1” and “o1-mini” are reasoning models that can produce or consume special reasoning tokens. The AI SDK supports them the same as any other chat‐type model, so there’s no extra code needed beyond specifying the model ID "o1" or "o1-mini" in your call.

If you would like to parse out or stream the “reasoning” portion of the text, you can:

- Set your prompts to instruct the model to reveal chain of thought or partial reasoning.
- Use the AI SDK’s `extractReasoningMiddleware` if the model encloses its chain-of-thought in a specific tag or delimiter, such as `<think></think>`.

Here’s a quick snippet of how to use the built‐in “extract reasoning” middleware if your “o1” model encloses the chain‐of-thought in e.g. `<explanation>` tags (this depends on how your actual model is configured!):

```ts
import { wrapLanguageModel, extractReasoningMiddleware } from 'ai';

// Suppose your model encloses chain-of-thought in <explanation>…</explanation>
const azureO1WithReasoning = wrapLanguageModel({
  model: azure('o1'),
  middleware: extractReasoningMiddleware({ tagName: 'explanation' }),
});

// Then use azureO1WithReasoning in generateText or streamText
const { text, reasoning } = await generateText({
  model: azureO1WithReasoning,
  prompt: 'Explain Newton’s laws of motion in simple terms.',
});

console.log('Answer:', text);
console.log('Reasoning tokens:', reasoning); // extracted from <explanation>…</explanation>
```