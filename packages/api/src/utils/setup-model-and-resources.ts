import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { VectorStore } from '@langchain/core/vectorstores';
import { AzureChatOpenAI, AzureOpenAIEmbeddings } from '@langchain/openai';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { InvocationContext } from '@azure/functions';
import { AzureCosmosDBNoSQLVectorStore, AzureCosmsosDBNoSQLChatMessageHistory } from '@langchain/azure-cosmosdb';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system';
import { faissStoreFolder, ollamaChatModel, ollamaEmbeddingsModel } from '../constants.js';
import { getAzureOpenAiTokenProvider, getCredentials } from '../security.js';

export default async function setupModelAndResources(
  context: InvocationContext,
  sessionId: string,
  userId?: string,
  setupVectorStore = false,
  setupChatHistoryStore = false,
): Promise<{
  model: BaseChatModel;
  store: VectorStore | undefined;
  chatHistory: FileSystemChatMessageHistory | AzureCosmsosDBNoSQLChatMessageHistory | undefined;
}> {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;

  let model: BaseChatModel;
  let store;
  let chatHistory;

  if (azureOpenAiEndpoint) {
    const credentials = getCredentials();
    const azureADTokenProvider = getAzureOpenAiTokenProvider();

    model = new AzureChatOpenAI({
      // Controls randomness. 0 = deterministic, 1 = maximum randomness
      temperature: 0.7,
      azureADTokenProvider,
    });
    if (setupVectorStore) {
      const embeddings = new AzureOpenAIEmbeddings({ azureADTokenProvider });
      store = new AzureCosmosDBNoSQLVectorStore(embeddings, { credentials });
    }

    if (setupChatHistoryStore) {
      // Initialize chat history
      chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
        sessionId,
        userId,
        credentials,
      });
    }
  } else {
    context.log('No Azure OpenAI endpoint set, using Ollama models and local DB');

    model = new ChatOllama({
      temperature: 0.7,
      model: ollamaChatModel,
    });
    if (setupVectorStore) {
      const embeddings = new OllamaEmbeddings({ model: ollamaEmbeddingsModel });
      store = await FaissStore.load(faissStoreFolder, embeddings);
    }

    if (setupChatHistoryStore) {
      // Initialize chat history
      chatHistory = new FileSystemChatMessageHistory({
        sessionId,
        userId,
      });
    }
  }

  return { model, store, chatHistory };
}
