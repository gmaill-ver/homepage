const {onRequest} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {defineSecret} = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors')({origin: true});
const admin = require('firebase-admin');

// Firebase Admin初期化
admin.initializeApp();

// Claude APIキー（シークレットとして定義）
const claudeApiKey = defineSecret('CLAUDE_API_KEY');

exports.chatWithClaude = onRequest({secrets: [claudeApiKey]}, (request, response) => {
  return cors(request, response, async () => {
    const apiKey = process.env.CLAUDE_API_KEY;

    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });
    // POSTリクエストのみ許可
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    try {
      const { messages, userId } = request.body;

      console.log('Received messages:', JSON.stringify(messages));
      console.log('User ID:', userId);

      if (!messages || !Array.isArray(messages)) {
        response.status(400).send('Invalid request: messages array required');
        return;
      }

      // Claude APIを呼び出し
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: messages,
      });

      console.log('Claude API Success');

      // Firestoreにメッセージを保存（userIdが提供されている場合のみ）
      if (userId) {
        const db = admin.firestore();
        const batch = db.batch();

        // ユーザーメッセージを保存
        const userMessageRef = db.collection('chatrooms').doc(userId).collection('messages').doc();
        batch.set(userMessageRef, {
          role: 'user',
          content: messages[messages.length - 1].content,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          model: 'claude-haiku-4-5-20251001'
        });

        // アシスタントメッセージを保存
        const assistantMessageRef = db.collection('chatrooms').doc(userId).collection('messages').doc();
        batch.set(assistantMessageRef, {
          role: 'assistant',
          content: message.content[0].text,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          model: 'claude-haiku-4-5-20251001',
          usage: message.usage
        });

        await batch.commit();
        console.log('Messages saved to Firestore');
      }

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

// 古いメッセージを自動削除・アーカイブする定期実行関数（毎週日曜日午前2時）
exports.archiveOldMessages = onSchedule('0 2 * * 0', async (event) => {
  const db = admin.firestore();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  console.log('Starting archive process for messages older than:', threeMonthsAgo);

  try {
    // 全チャットルームを取得
    const chatroomsSnapshot = await db.collection('chatrooms').listDocuments();

    let totalArchived = 0;
    let totalDeleted = 0;

    for (const chatroomRef of chatroomsSnapshot) {
      // 3ヶ月以上前のメッセージを取得
      const oldMessagesSnapshot = await chatroomRef
        .collection('messages')
        .where('timestamp', '<', threeMonthsAgo)
        .get();

      if (oldMessagesSnapshot.empty) {
        continue;
      }

      // Cloud Storageにアーカイブ
      const archiveData = [];
      oldMessagesSnapshot.forEach(doc => {
        archiveData.push({
          id: doc.id,
          ...doc.data(),
          archivedAt: new Date().toISOString()
        });
      });

      // Storage バケットに保存
      const bucket = admin.storage().bucket();
      const archiveFileName = `chat-archives/${chatroomRef.id}/${threeMonthsAgo.getFullYear()}-${threeMonthsAgo.getMonth() + 1}.json`;
      const file = bucket.file(archiveFileName);

      await file.save(JSON.stringify(archiveData, null, 2), {
        contentType: 'application/json',
        metadata: {
          userId: chatroomRef.id,
          archivedAt: new Date().toISOString(),
          messageCount: archiveData.length
        }
      });

      totalArchived += archiveData.length;

      // Firestoreから削除
      const batch = db.batch();
      oldMessagesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      totalDeleted += oldMessagesSnapshot.size;

      console.log(`Archived ${archiveData.length} messages for user ${chatroomRef.id}`);
    }

    console.log(`Archive complete. Total archived: ${totalArchived}, Total deleted: ${totalDeleted}`);
    return { success: true, totalArchived, totalDeleted };

  } catch (error) {
    console.error('Archive error:', error);
    throw error;
  }
});

// 1年以上前のアーカイブファイルを削除（オプション）
exports.deleteOldArchives = onSchedule('0 3 1 * *', async (event) => {
  const bucket = admin.storage().bucket();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  console.log(`Deleting archives older than: ${oneYearAgo.toISOString()}`);

  try {
    const [files] = await bucket.getFiles({ prefix: 'chat-archives/' });
    let deletedCount = 0;

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const createdDate = new Date(metadata.timeCreated);

      if (createdDate < oneYearAgo) {
        await file.delete();
        deletedCount++;
        console.log(`Deleted old archive: ${file.name}`);
      }
    }

    console.log(`Deleted ${deletedCount} old archive files`);
    return { success: true, deletedCount };

  } catch (error) {
    console.error('Delete archives error:', error);
    throw error;
  }
});
