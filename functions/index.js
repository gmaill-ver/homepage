const functions = require('firebase-functions');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors')({origin: true});

// Claude APIキー（環境変数から取得）
const CLAUDE_API_KEY = 'sk-ant-api03-W2J...1wAA';

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

      // レスポンスを返す
      response.json(message);

    } catch (error) {
      console.error('Claude API Error:', error);
      response.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    }
  });
});
