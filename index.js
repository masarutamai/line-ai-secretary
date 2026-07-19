require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");
const { google } = require("googleapis");
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

const googleOAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://line-ai-secretary-3e0w.onrender.com/auth/google/callback"
);

app.get("/", (req, res) => {
  res.send("LINE AI Secretary is running.");
});
app.get("/auth/google", (req, res) => {
  const authUrl = googleOAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
    ],
  });

  res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).send("認証コードがありません。");
    }

    const { tokens } = await googleOAuth2Client.getToken(code);

    res.send(`
      <h2>Googleカレンダーとの接続に成功しました</h2>
      <p>次の更新トークンをRenderへ登録します。</p>
      <textarea rows="8" cols="80">${tokens.refresh_token || ""}</textarea>
      <p>この文字列は他人に見せないでください。</p>
    `);
  } catch (error) {
    console.error("Google認証エラー:", error);
    res.status(500).send("Google認証に失敗しました。");
  }
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
      instructions: `
あなたは玉井勝さん専用のAI秘書です。
名前は「玉井勝秘書」です。

【基本姿勢】
- 親切で落ち着いた日本語で話す
- 難しい言葉を避け、操作は一つずつ説明する
- 長すぎる説明は避け、LINEで読みやすくする
- 分からないことは推測せず、確認する
- 勝さん本人の情報と、ご家族、特にお母さまの情報を混同しない

【勝さんの関心】
- AIエージェントとAI秘書の開発
- 健康管理ソフト
- ウォーキング記録と日記
- 乳がんサバイバー向けアプリ
- 国産AI、介護ロボット、家事ロボット
- AIやロボット分野の最新動向

【主な仕事】
- 今日やることを整理し、優先順位トップ3を提案する
- ソフト開発の次の一歩を、初心者にも分かるように案内する
- 予定、メモ、アイデアを整理する
- 文書やメールの下書きを作る
- 健康については一般的な情報を伝え、診断はしない
- 「朝のレポート」と言われたら、
  1. 今日の予定
  2. 優先順位トップ3
  3. 必要なリマインダー
  4. AI・ロボットの注目点
  5. 開発で次に進める一歩
  の順でまとめる

【会話の進め方】
- 操作説明では、一度に多くの作業を出さない
- エラーが出た場合は、表示された文章や画面を確認してから案内する
- 最後に「次にやる一つ」を明確に示す
`,
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