// template-hosting-worker.js 

export async function createTemplateWorker(request, env, ctx, config) {
  const CACHE_NAME = "version";

  try {
    const url = new URL(request.url);

    if (url.pathname === "/__publish") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      const body = await request.json().catch(() => null);
      if (!body || typeof body.password !== "string") {
        return new Response(JSON.stringify({ success: false, message: "Missing password" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (body.password !== env.PUBLISH_PASSWORD) {
        return new Response(JSON.stringify({ success: false, message: "Invalid password" }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }

      const newVersion = Date.now().toString();
      await config.CACHE_VERSION.put("version", newVersion);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const path = url.pathname === "/" ? "" : url.pathname;
    const targetHost = new URL(config.TARGET_URL).hostname;

    if (url.hostname.includes(targetHost)) {
      return Response.redirect(`${config.CANONICAL_DOMAIN}${path}`, 301);
    }

    if (path === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /`, {
        headers: { "Content-Type": "text/plain" }
      });
    }

    const previewMode = url.searchParams.has("preview");
    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.delete("preview");
    const version = (await config.CACHE_VERSION.get("version")) || "v1";
    cacheUrl.searchParams.set("v", version);

    const cacheKey = new Request(CACHE_NAME + "-" + cacheUrl.toString());
    const cache = caches.default;

    let response = await cache.match(cacheKey);

    if (!response || previewMode) {
      const targetUrl = `${config.TARGET_URL}/${path}`;
      const originResponse = await fetch(targetUrl, { headers: request.headers });
      let content = await originResponse.text();

      let injected = `
        <link rel="canonical" href="${config.CANONICAL_DOMAIN}${path}">
        <style>
          #__framer-badge-container,
          .w-webflow-badge {
            display: none !important;
          }
        </style>
      `;

      if (previewMode) {
        injected += `<script>(function(){ /* preview logic omitted */ })();</script>`;
      }

      content = content.replace("</head>", injected + "</head>");

      const headers = { "Content-Type": "text/html" };
      headers["Cache-Control"] = previewMode
        ? "no-store"
        : "public, max-age=31536000, immutable";

      response = new Response(content, { headers });

      if (!previewMode) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
    }

    return response;
  } catch (e) {
    return new Response("An error occurred: " + e.message, { status: 500 });
  }
}
