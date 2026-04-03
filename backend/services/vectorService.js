import { index } from "../config/pincone.js";

const BATCH_SIZE = 20;

const chunk = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const buildEmbeddingProviderConfig = () => {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (openRouterApiKey) {
    return {
      apiKey: openRouterApiKey,
      endpoint:
        process.env.OPENROUTER_BASE_URL ||
        "https://openrouter.ai/api/v1/embeddings",
      model:
        process.env.OPENROUTER_EMBEDDING_MODEL ||
        process.env.EMBEDDING_MODEL ||
        "openai/text-embedding-3-small",
      provider: "OpenRouter",
      extraHeaders: {
        ...(process.env.OPENROUTER_SITE_URL
          ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME
          ? { "X-Title": process.env.OPENROUTER_APP_NAME }
          : {}),
      },
    };
  }

  if (openAiApiKey) {
    return {
      apiKey: openAiApiKey,
      endpoint: "https://api.openai.com/v1/embeddings",
      model:
        process.env.OPENAI_EMBEDDING_MODEL ||
        process.env.EMBEDDING_MODEL ||
        "text-embedding-3-small",
      provider: "OpenAI",
      extraHeaders: {},
    };
  }

  throw new Error(
    "Missing embedding API key. Configure OPENROUTER_API_KEY or OPENAI_API_KEY",
  );
};

const generateEmbedding = async (text) => {
  const { apiKey, endpoint, model, provider, extraHeaders } =
    buildEmbeddingProviderConfig();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `${provider} embedding API failed: ${response.status} ${details}`,
    );
  }

  const data = await response.json();
  return data?.data?.[0]?.embedding || null;
};

const upsertVectors = async (namespace, vectors) => {
  if (!Array.isArray(vectors) || vectors.length === 0) {
    return;
  }

  const chunks = chunk(vectors, BATCH_SIZE);
  for (const current of chunks) {
    if (current.length === 0) {
      continue;
    }

    try {
      await index.namespace(namespace).upsert(current);
    } catch (error) {
      console.error("[vectorService] Pinecone upsert batch failed", {
        namespace,
        batchSize: current.length,
        message: error?.message || String(error),
      });
    }
  }
};

export { generateEmbedding, upsertVectors, BATCH_SIZE };
