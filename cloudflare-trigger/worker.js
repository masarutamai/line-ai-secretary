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
  return new Response("test-memory route reached", {
    status: 200,
  });
}
    try {
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
