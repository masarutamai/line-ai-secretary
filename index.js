require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

app.get("/", (req, res) => {
  res.send("LINE AI Secretary is running.");
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  res.status(200).end();

  try {
    await Promise.all(req.body.events.map(handleEvent));
  } catch (error) {
    console.error("Webhook処理エラー:", error);
  }
});

async function handleEvent(event) {
  if (
    event.type !== "message" ||
    event.message.type !== "text"
  ) {
    return null;
  }

  const userText = event.message.text;

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `秘書です。「${userText}」と受け取りました。`,
      },
    ],
  });
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`サーバー起動：http://localhost:${port}`);
});