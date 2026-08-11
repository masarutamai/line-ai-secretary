// Cloudflare auto-deploy test
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

  return response.status;
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dispatchMorningReport(env));
  },

  async fetch(request, env, ctx) {
const url = new URL(request.url);

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

    return new Response(body, {
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
