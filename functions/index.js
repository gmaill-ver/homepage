const functions = require('firebase-functions');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors')({origin: true});

// Claude APIキー
const CLAUDE_API_KEY = 'sk-ant-api03-mnpTDuO-njHFn4I4IbuL-LS-55mNlQcOE0PAtQHyDW2Tm-yJ_1BVCWs3UR6mEEGK5hpJ33Tze2q5SfPGlXNbPg-jMvFdwAA';

const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY,
});

exports.chatWithClaude = functions.https.onRequest((request, response) => {
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
