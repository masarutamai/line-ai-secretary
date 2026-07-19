require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        "あなたは親切で簡潔な日本語のAI秘書です。予定整理、やることの優先順位、健康管理、AIやロボット、ソフト開発の相談を手伝ってください。医療上の診断はせず、必要な場合は専門家への相談を勧めてください。LINEで読みやすい長さで返答してください。",
      input: userText,
    });

    const answer =
      response.output_text || "申し訳ありません。返事を作れませんでした。";

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: answer.slice(0, 4900),
        },
      ],
    });
  } catch (error) {
    console.error("OpenAI APIエラー:", error);

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: "申し訳ありません。AIとの通信でエラーが発生しました。少し待ってから、もう一度お試しください。",
        },
      ],
    });
  }
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`サーバー起動：http://localhost:${port}`);
});