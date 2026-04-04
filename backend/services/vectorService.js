import { index } from "../config/pincone.js";
import { getRawFileContent } from "./githubService.js";

const BATCH_SIZE = 20;
const DEFAULT_TOP_K = 2;
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;

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
  if (!text || typeof text !== "string" || !text.trim()) {
    console.log("Skipping empty embedding");
    return null;
  }

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
  const embedding = data?.data?.[0]?.embedding || null;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    console.log("Skipping empty embedding");
    return null;
  }

  return embedding;
};

const sanitizeForEmbedding = (text) => {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .trim();
};

const splitIntoChunks = (
  text,
  chunkSize = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
) => {
  const source = sanitizeForEmbedding(text);
  if (!source) {
    return [];
  }

  if (source.length <= chunkSize) {
    return [source];
  }

  const chunks = [];
  let start = 0;
  while (start < source.length) {
    const end = Math.min(start + chunkSize, source.length);
    chunks.push(source.slice(start, end));
    if (end >= source.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks;
};

const createEmbedding = async (text) => {
  return generateEmbedding(text);
};

const storeRepoVectors = async (repoId, files = [], repositoryContext = {}) => {
  if (!repoId) {
    throw new Error("repoId is required to store vectors");
  }

  const owner = repositoryContext.owner;
  const repo = repositoryContext.repo;
  const defaultBranch = repositoryContext.defaultBranch || "main";

  if (!owner || !repo) {
    throw new Error("owner and repo are required in repositoryContext");
  }

  const list = Array.isArray(files) ? files.slice(0, 30) : [];
  const vectors = [];

  for (const entry of list) {
    try {
      const filePath = typeof entry === "string" ? entry : entry?.path;
      if (!filePath) {
        continue;
      }

      const rawContent = await getRawFileContent(
        owner,
        repo,
        defaultBranch,
        filePath,
      );
      if (!rawContent) {
        continue;
      }

      const chunks = splitIntoChunks(rawContent, CHUNK_SIZE, CHUNK_OVERLAP);
      for (let i = 0; i < chunks.length; i += 1) {
        const chunkText = chunks[i];
        if (!chunkText) {
          continue;
        }

        let embedding;
        try {
          embedding = await createEmbedding(chunkText);
        } catch (error) {
          console.warn("[storeRepoVectors] embedding failed", {
            repoId,
            filePath,
            chunkIndex: i,
            message: error?.message || String(error),
          });
          continue;
        }

        if (!Array.isArray(embedding) || embedding.length === 0) {
          console.log("Skipping empty embedding");
          continue;
        }

        vectors.push({
          id: `${repoId}:${filePath}:${i}`,
          values: embedding,
          metadata: {
            repoId: String(repoId),
            filePath,
            snippet: chunkText.slice(0, 500),
            chunkIndex: i,
          },
        });
      }
    } catch (error) {
      console.warn("[storeRepoVectors] file processing failed", {
        repoId,
        message: error?.message || String(error),
      });
    }
  }

  if (vectors.length === 0) {
    return { stored: 0 };
  }

  await upsertVectors(String(repoId), vectors);
  return { stored: vectors.length };
};

const queryVectors = async (repoId, queryEmbedding, topK = DEFAULT_TOP_K) => {
  if (!repoId) {
    throw new Error("repoId is required for vector query");
  }

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error("A valid query embedding is required");
  }

  try {
    const response = await index.namespace(String(repoId)).query({
      vector: queryEmbedding,
      topK: Math.min(Number(topK || DEFAULT_TOP_K), DEFAULT_TOP_K),
      includeMetadata: true,
      includeValues: false,
      filter: {
        repoId: { $eq: String(repoId) },
      },
    });

    return Array.isArray(response?.matches) ? response.matches : [];
  } catch (error) {
    console.error("[queryVectors] Pinecone query failed", {
      repoId,
      message: error?.message || String(error),
    });
    return [];
  }
};

const upsertVectors = async (namespace, vectors) => {
  if (!Array.isArray(vectors) || vectors.length === 0) {
    console.log("No valid vectors to insert — skipping Pinecone");
    return;
  }

  console.log("Total vectors:", vectors.length);

  const validVectors = vectors.filter(
    (v) =>
      v &&
      typeof v.id === "string" &&
      v.id.trim() &&
      Array.isArray(v.values) &&
      v.values.length > 0 &&
      v.values.every((num) => typeof num === "number"),
  );

  console.log("Valid vectors:", validVectors.length);

  if (validVectors.length === 0) {
    console.log("No valid vectors to insert — skipping Pinecone");
    return;
  }

  const batchSize = 20;

  for (let i = 0; i < validVectors.length; i += batchSize) {
    const batch = validVectors.slice(i, i + batchSize);

    console.log("Batch size (REAL):", batch.length);

    if (!batch.length) {
      continue;
    }

    try {
      await index.namespace(namespace).upsert({
        vectors: batch,
      });
    } catch (error) {
      console.error("[vectorService] Pinecone upsert batch failed", {
        namespace,
        batchSize: batch.length,
        message: error?.message || String(error),
      });
    }
  }
};

export { generateEmbedding, upsertVectors, BATCH_SIZE };
export { createEmbedding, storeRepoVectors, queryVectors };
