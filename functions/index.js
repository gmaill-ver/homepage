const functions = require('firebase-functions');
const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors')({origin: true});

// Claude APIキー（シークレットとして定義）
const claudeApiKey = defineSecret('CLAUDE_API_KEY');

exports.chatWithClaude = onRequest({secrets: [claudeApiKey]}, (request, response) => {
  const anthropic = new Anthropic({
    apiKey: claudeApiKey.value(),
  });
  return cors(request, response, async () => {
    // POSTリクエストのみ許可
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const { messages } = request.body;

      console.log('Received messages:', JSON.stringify(messages));
      console.log('API Key (first 20 chars):', CLAUDE_API_KEY.substring(0, 20));

      if (!messages || !Array.isArray(messages)) {
        response.status(400).send('Invalid request: messages array required');
        return;
      }

      // Claude APIを呼び出し
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: messages,
      });

      console.log('Claude API Success');

      // レスポンスを返す
      response.json(message);

    } catch (error) {
      console.error('Claude API Error:', error.message);
      console.error('Error status:', error.status);
      console.error('Error type:', error.error?.type);
      response.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        type: error.error?.type
      });
    }
  });
});
