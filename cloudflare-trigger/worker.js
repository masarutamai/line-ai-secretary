// Cloudflare auto-deploy test
async function writeObservabilityLog(env, eventType, status, detail) {
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/observability_logs`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: eventType,
        status: status,
        detail: detail,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Observability log failed: ${response.status} ${body}`
    );
  }
}
function isMorningReportWindowJST(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);

  const totalMinutes = hour * 60 + minute;

  return totalMinutes >= 6 * 60 + 20 &&
         totalMinutes <= 6 * 60 + 40;
}
async function hasSuccessfulDispatchTodayJST(env) {
  const now = new Date();

  const jstDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const startJST = new Date(`${jstDate}T00:00:00+09:00`).toISOString();

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/observability_logs?event_type=eq.morning_report_dispatch&status=eq.success&created_at=gte.${encodeURIComponent(startJST)}&select=id&limit=1`,
    {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Dispatch history check failed: ${response.status} ${body}`);
  }

  const rows = await response.json();
  return rows.length > 0;
}

async function writeJudgmentLog(env, subject, decision, confidence, reason) {
  const allowedDecisions = ["send", "skip", "defer", "alert"];
  const allowedConfidence = ["high", "medium", "low"];

  if (!allowedDecisions.includes(decision)) {
    throw new Error(`Invalid decision: ${decision}`);
  }

  if (!allowedConfidence.includes(confidence)) {
    throw new Error(`Invalid confidence: ${confidence}`);
  }

  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/judgment_logs`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        subject,
        decision,
        confidence,
        reason,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Judgment log failed: ${response.status} ${body}`
    );
  }
}
async function dispatchMorningReport(env) {
  const url =
    "https://api.github.com/repos/masarutamai/line-ai-secretary/actions/workflows/morning-report.yml/dispatches";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cloudflare-morning-report-trigger"
    },
    body: JSON.stringify({
      ref: "main"
    })
  });

  const body = await response.text();

  console.log("GitHub dispatch:", response.status, body);

  if (!response.ok) {
    throw new Error(
      `GitHub dispatch failed: ${response.status} ${body}`
    );
  }
try {
  await writeObservabilityLog(
    env,
    "morning_report_dispatch",
    "success",
    `GitHub Actions dispatch succeeded with status ${response.status}`
  );
} catch (logError) {
  console.error("Observability log write failed:", logError);
}
  return response.status;
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatchMorningReport(env));
  },

  async fetch(request, env, ctx) {
const url = new URL(request.url);
if (url.pathname === "/favicon.ico") {
  return new Response(null, { status: 204 });
}
const testTime = url.searchParams.get("testTime");
const testAlreadySent = url.searchParams.get("testAlreadySent");
if (url.pathname === "/test-dispatch-history") {
const alreadySent =
  testAlreadySent === "false"
    ? false
    : await hasSuccessfulDispatchTodayJST(env);

  return new Response(
    JSON.stringify({ alreadySent }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
if (url.pathname === "/test-memory") {
const authHeader = request.headers.get("Authorization");

if (authHeader !== `Bearer ${env.MEMORY_TEST_TOKEN}`) {
  return new Response("Unauthorized", {
    status: 401,
  });
}
  try {
    const response = await fetch(
      `${env.SUPABASE_URL}/rest/v1/memories?select=*`,
      {
        headers: {
          apikey: env.SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
        },
      }
    );

    const body = await response.text();
if (response.ok) {
  try {
    await writeObservabilityLog(
      env,
      "memory_read_test",
      "success",
      "Supabase memories read test succeeded"
    );
  } catch (logError) {
    console.error("Observability log write failed:", logError);
  }
}    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}    try {
const alreadySent =
  testAlreadySent === "false"
    ? false
    : testAlreadySent === "true"
      ? true
      : await hasSuccessfulDispatchTodayJST(env);
const withinWindow = isMorningReportWindowJST(
  testTime ? new Date(`2026-08-14T${testTime}:00+09:00`) : new Date()
);

const decision =
  alreadySent ? "skip" :
  withinWindow ? "send" : "skip";

const reason =
  alreadySent
    ? "Morning report already dispatched successfully today"
    : withinWindow
      ? "Current time is within the morning report window"
      : "Current time is outside the morning report window";
await writeJudgmentLog(
  env,
  "morning_report",
  decision,
  "high",
  reason
);
if (decision === "skip") {
  return new Response(
    reason,
    { status: 200 }
  );
}
if (testTime !== null || testAlreadySent !== null) {
  return new Response(
    JSON.stringify({
      testMode: true,
      alreadySent,
      withinWindow,
      decision,
      reason,
      dispatched: false
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
      const status = await dispatchMorningReport(env);

      return new Response(
        `Morning Report dispatched successfully. GitHub status: ${status}`,
        { status: 200 }
      );
    } catch (error) {
      console.error(error);

      return new Response(
        `Dispatch failed: ${error.message}`,
        { status: 500 }
      );
    }
  }
};
