import { Readable } from 'node:stream';
import { HttpRequest, InvocationContext, HttpResponseInit, app } from '@azure/functions';
import { AIChatCompletionRequest, AIChatCompletionDelta } from '@microsoft/ai-chat-protocol';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import { badRequest, data, serviceUnavailable } from '../http-response.js';
import { getUserId } from '../security.js';
import setupModelAndResources from '../utils/setup-model-and-resources.js';

const ragSystemPrompt = `You are an assistant writing a response to a bid document for Kainos, a software consultancy.. Be brief in your answers. Answer only plain text, DO NOT use Markdown.
Answer ONLY with information from the sources below. If there isn't enough information in the sources, say you don't know. Do not generate answers that don't use the sources. If asking a clarifying question to the user would help, ask the question.
If the user question is not in English, answer in the language used in the question.

Each source has the format "[filename]: information". ALWAYS reference the source filename for every part used in the answer. Use the format "[filename]" to reference a source, for example: [info1.txt]. List each source separately, for example: [info1.txt][info2.pdf].

Generate 3 very brief follow-up questions that the user would likely ask next.
Enclose the follow-up questions in double angle brackets. Example:
<<Am I allowed to invite friends for a party?>>
<<How can I ask for a refund?>>
<<What If I break something?>>

Do no repeat questions that have already been asked.
Make sure the last question ends with ">>".

SOURCES:
{context}`;

const titleSystemPrompt = `Create a title for this chat session, based on the user question. The title should be less than 32 characters. Do NOT use double-quotes.`;

export async function postChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const requestBody = (await request.json()) as AIChatCompletionRequest;
    const { messages, context: chatContext } = requestBody;
    const userId = getUserId(request, requestBody);

    if (!messages || messages.length === 0 || !messages.at(-1)?.content) {
      return badRequest('Invalid or missing messages in the request body');
    }

    const sessionId = ((chatContext as any)?.sessionId as string) || uuidv4();
    context.log(`userId: ${userId}, sessionId: ${sessionId}`);

    const { model, store, chatHistory } = await setupModelAndResources(context, sessionId, userId, true, true);

    if (!chatHistory || !store) throw new Error('Chat history should not be null');

    // Create the chain that combines the prompt with the documents
    const ragChain = await createStuffDocumentsChain({
      llm: model,
      prompt: ChatPromptTemplate.fromMessages([
        ['system', ragSystemPrompt],
        ['human', '{input}'],
      ]),
      documentPrompt: PromptTemplate.fromTemplate('[{source}]: {page_content}\n'),
    });
    // Handle chat history
    const ragChainWithHistory = new RunnableWithMessageHistory({
      runnable: ragChain,
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
      getMessageHistory: async () => chatHistory,
    });
    // Retriever to search for the documents in the database
    const retriever = store.asRetriever(3);
    const question = messages.at(-1)!.content;
    const responseStream = await ragChainWithHistory.stream(
      {
        input: question,
        context: await retriever.invoke(question),
      },
      { configurable: { sessionId } },
    );
    const jsonStream = Readable.from(createJsonStream(responseStream, sessionId));

    // Create a short title for this chat session
    const { title } = await chatHistory.getContext();
    if (!title) {
      const response = await ChatPromptTemplate.fromMessages([
        ['system', titleSystemPrompt],
        ['human', '{input}'],
      ])
        .pipe(model)
        .invoke({ input: question });
      context.log(`Title for session: ${response.content as string}`);
      chatHistory.setContext({ title: response.content });
    }

    return data(jsonStream, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    });
  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(`Error when processing chat-post request: ${error.message}`);

    return serviceUnavailable('Service temporarily unavailable. Please try again later.');
  }
}

// Transform the response chunks into a JSON stream
async function* createJsonStream(chunks: AsyncIterable<string>, sessionId: string) {
  for await (const chunk of chunks) {
    if (!chunk) continue;

    const responseChunk: AIChatCompletionDelta = {
      delta: {
        content: chunk,
        role: 'assistant',
      },
      context: {
        sessionId,
      },
    };

    // Format response chunks in Newline delimited JSON
    // see https://github.com/ndjson/ndjson-spec
    yield JSON.stringify(responseChunk) + '\n';
  }
}

app.setup({ enableHttpStream: true });
app.http('chats-post', {
  route: 'chats/stream',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: postChats,
});
