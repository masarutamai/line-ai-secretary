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
googleOAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const calendar = google.calendar({
  version: "v3",
  auth: googleOAuth2Client,
});
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
function getJstDateString(dayOffset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const target = new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day) + dayOffset
    )
  );

  return target.toISOString().slice(0, 10);
}

async function getCalendarSchedule(dayOffset, label) {
  const startDate = getJstDateString(dayOffset);
  const endDate = getJstDateString(dayOffset + 1);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: `${startDate}T00:00:00+09:00`,
    timeMax: `${endDate}T00:00:00+09:00`,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: "Asia/Tokyo",
  });

  const events = response.data.items || [];

  if (events.length === 0) {
    return `📅 ${label}の予定はありません。`;
  }

  const lines = events.map((calendarEvent) => {
    const title = calendarEvent.summary || "タイトルなし";

    if (calendarEvent.start?.date) {
      return `・終日　${title}`;
    }

    const startTime = new Date(
      calendarEvent.start.dateTime
    ).toLocaleTimeString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
    });

    return `・${startTime}　${title}`;
  });

  return `📅 ${label}の予定\n\n${lines.join("\n")}`;
}
async function handleEvent(event) {
  if (
    event.type !== "message" ||
    event.message.type !== "text"
  ) {
    return null;
  }

  const userText = event.message.text;
console.log("LINE_SOURCE:", JSON.stringify(event.source));
console.log("LINE_USER_ID:", event.source?.userId || "取得できません");
const compactText = userText.replace(/\s/g, "");

if (
  compactText.includes("今日の予定") ||
  compactText.includes("本日の予定")
) {
  try {
    const scheduleText = await getCalendarSchedule(0, "今日");

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: scheduleText,
        },
      ],
    });
  } catch (error) {
    console.error("今日の予定取得エラー:", error);

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: "申し訳ありません。Googleカレンダーの予定を取得できませんでした。",
        },
      ],
    });
  }
}

if (compactText.includes("明日の予定")) {
  try {
    const scheduleText = await getCalendarSchedule(1, "明日");

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: scheduleText,
        },
      ],
    });
  } catch (error) {
    console.error("明日の予定取得エラー:", error);

    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: "申し訳ありません。Googleカレンダーの予定を取得できませんでした。",
        },
      ],
    });
  }
}
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
async function sendMorningReport() {

  const report = `
🌅 おはようございます！

📅 今日の予定
・・・

✅ 今日の優先順位TOP3
・・・

🤖 AIニュース
・・・

💻 今日の開発
・・・
`;

await lineClient.pushMessage({
  to: process.env.LINE_USER_ID,
  messages: [
    {
      type: "text",
      text: report,
    },
  ],
});
}
app.listen(port, () => {
  console.log(`サーバー起動：http://localhost:${port}`);

  sendMorningReport()
    .then(() => {
      console.log("朝レポートのテスト送信に成功しました。");
    })
    .catch((error) => {
      console.error("朝レポート送信エラー:", error);
    });
});