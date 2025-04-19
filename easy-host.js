export default function createWorker(CONFIG) {
  return {
    async fetch(request, env, ctx) {
      try {
        const url = new URL(request.url);

        // Handle publish endpoint
        if (url.pathname === "/__publish") {
          if (request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
          }
          const body = await request.json().catch(() => null);
          if (!body?.password) {
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
          await env[CONFIG.cacheVersionBinding].put("version", newVersion);
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        // Handle normal routing
        const path = url.pathname === "/" ? "" : url.pathname;
        if (url.hostname.includes("webflow.io")) {
          return Response.redirect(`${CONFIG.canonicalDomain}${path}`, 301);
        }

        if (path === "/robots.txt") {
          return new Response("User-agent: *\nAllow: /", {
            headers: { "Content-Type": "text/plain" }
          });
        }

        const previewMode = url.searchParams.has(CONFIG.previewQueryParam);
        const cacheUrl = new URL(request.url);
        cacheUrl.searchParams.delete(CONFIG.previewQueryParam);
        const version = await env[CONFIG.cacheVersionBinding].get("version") || "v1";
        cacheUrl.searchParams.set("v", version);
        const cacheKey = new Request(cacheUrl.toString());
        const cache = caches.default;

        let response = await cache.match(cacheKey);

        if (!response || previewMode) {
          const targetUrl = `${CONFIG.originBaseUrl}/${path}`;
          const originResponse = await fetch(targetUrl, { headers: request.headers });
          let content = await originResponse.text();

          let injected = `
            <link rel="canonical" href="${CONFIG.canonicalDomain}${path}">
            <style>
              #__framer-badge-container,
              .w-webflow-badge {
                display: none !important;
              }
            </style>
          `;

          if (previewMode) {
            injected += `<script>(function(){
              function addPreviewToLinks() {
                document.querySelectorAll("a[href]").forEach(a => {
                  try {
                    const u = new URL(a.href, location.href);
                    if (!u.searchParams.has("${CONFIG.previewQueryParam}")) {
                      u.searchParams.set("${CONFIG.previewQueryParam}", "");
                      a.href = u.toString();
                    }
                  } catch(e){}
                });
              }
              function createPublishButton() {
                const btn = document.createElement("button");
                btn.innerText = "Publish";
                Object.assign(btn.style, {
                  position: "fixed", bottom: "20px", right: "20px", padding: "10px 20px",
                  backgroundColor: "#007BFF", color: "#fff", border: "none", borderRadius: "5px",
                  cursor: "pointer", zIndex: "9999"
                });
                btn.onclick = openModal;
                document.body.appendChild(btn);
              }
              function openModal() {
                const overlay = document.createElement("div");
                Object.assign(overlay.style, {
                  position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                  background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center",
                  alignItems: "center", zIndex: "10000"
                });

                const modal = document.createElement("div");
                Object.assign(modal.style, {
                  background: "#fff", borderRadius: "8px", padding: "30px", width: "90%",
                  maxWidth: "400px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", textAlign: "center",
                  fontFamily: "Arial, sans-serif"
                });

                const title = document.createElement("h2");
                title.innerText = "Publish Changes";
                modal.appendChild(title);

                const input = document.createElement("input");
                Object.assign(input, { type: "password", placeholder: "Enter publish password" });
                Object.assign(input.style, {
                  width: "100%", padding: "12px", fontSize: "16px",
                  margin: "20px 0", border: "1px solid #ccc", borderRadius: "4px"
                });
                modal.appendChild(input);

                const buttons = document.createElement("div");
                buttons.style.display = "flex"; buttons.style.justifyContent = "space-between";

                const cancel = document.createElement("button");
                cancel.innerText = "Cancel";
                cancel.style = "padding:10px 20px;background:#bbb;border:none;border-radius:4px;color:#fff;cursor:pointer";
                cancel.onclick = () => document.body.removeChild(overlay);
                buttons.appendChild(cancel);

                const publish = document.createElement("button");
                publish.innerText = "Publish";
                publish.style = "padding:10px 20px;background:#28a745;border:none;border-radius:4px;color:#fff;cursor:pointer";
                publish.onclick = () => {
                  fetch("/__publish", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: input.value })
                  })
                  .then(r => r.json())
                  .then(d => {
                    alert(d.success ? "Published!" : "Failed: " + d.message);
                    if (d.success) location.search = "";
                    document.body.removeChild(overlay);
                  });
                };
                buttons.appendChild(publish);

                modal.appendChild(buttons);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
              }
              if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                  addPreviewToLinks(); createPublishButton();
                });
              } else {
                addPreviewToLinks(); createPublishButton();
              }
            })()</script>`;
          }

          content = content.replace("</head>", `${injected}</head>`);
          const headers = {
            "Content-Type": "text/html",
            "Cache-Control": previewMode
              ? "no-store"
              : "public, max-age=31536000, immutable"
          };
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
  };
}
