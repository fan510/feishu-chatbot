const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const APP_ID = process.env.FEISHU_APP_ID || 'cli_a92f3005df78dbce';
const APP_SECRET = process.env.FEISHU_APP_SECRET || 'Wm1AAJ3GZ7LBdBw4qLTO4eEMbTOOwH3Y';

let tenantAccessToken = null;
let tokenExpireTime = 0;

async function getTenantAccessToken() {
  if (tenantAccessToken && Date.now() < tokenExpireTime) {
    return tenantAccessToken;
  }
  try {
    const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: APP_ID,
      app_secret: APP_SECRET
    });
    if (response.data.code === 0) {
      tenantAccessToken = response.data.tenant_access_token;
      tokenExpireTime = Date.now() + (response.data.expire - 300) * 1000;
      return tenantAccessToken;
    }
    throw new Error('Failed to get token');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

async function replyToMessage(rootId, messageText) {
  const token = await getTenantAccessToken();
  try {
    await axios.post(
      `https://open.feishu.cn/open-apis/im/v1/messages/${rootId}/reply`,
      { msg_type: 'text', content: JSON.stringify({ text: messageText }) },
      { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Reply error:', error.message);
  }
}

function generateAIResponse(userMessage) {
  return `收到消息: "${userMessage}"。这是飞书聊天机器人的自动回复。你可以告诉我你想做什么，我会尽力帮助你！`;
}

app.use(bodyParser.json());

app.get('/api/feishu/verify', (req, res) => {
  res.json({ challenge: req.query.challenge });
});

app.post('/api/feishu/event', async (req, res) => {
  const { type, challenge } = req.body;
  if (type === 'url_verification') {
    res.json({ challenge });
    return;
  }
  if (type === 'event_callback') {
    const { event } = req.body;
    if (event && event.type === 'im.message') {
      const message = event.message;
      if (message.message_type === 'text') {
        const content = JSON.parse(message.content);
        const userMessage = content.text || '';
        const aiResponse = generateAIResponse(userMessage);
        await replyToMessage(message.message_id, aiResponse);
      }
    }
  }
  res.json({ code: 0, msg: 'success' });
});

app.get('/', (req, res) => {
  res.json({ name: 'Feishu Chatbot', status: 'running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
