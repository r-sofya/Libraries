export async function createTemplateWorker(request, env, ctx, config) {
  try {
    const CACHE_NAME = "version"; // Static cache key prefix

    const url = new URL(request.url);

    // === 1. Handle publish endpoint ===
    if (url.pathname === "/__publish") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      const body = await request.json().catch(() => null);
      if (!body || typeof body.password !== "string") {
        return new Response(
          JSON.stringify({ success: false, message: "Missing password" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (body.password !== env.PUBLISH_PASSWORD) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid password" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const newVersion = Date.now().toString();
      await config.CACHE_VERSION.put("version", newVersion);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // === 2. Handle standard requests ===
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

    const cacheKeyStr = CACHE_NAME + "-" + cacheUrl.toString();
    const cacheKey = new Request(cacheKeyStr);
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
        injected += `
          <script>
            (function() {
              function addPreviewToLinks() {
                const anchors = document.querySelectorAll("a[href]");
                for (let anchor of anchors) {
                  try {
                    let linkUrl = new URL(anchor.getAttribute("href"), window.location.href);
                    if (!linkUrl.searchParams.has("preview")) {
                      linkUrl.searchParams.set("preview", "");
                      anchor.href = linkUrl.toString();
                    }
                  } catch (e) {}
                }
              }

              function createPublishButton() {
                const button = document.createElement("button");
                button.innerText = "Publish";
                button.style.position = "fixed";
                button.style.bottom = "20px";
                button.style.right = "20px";
                button.style.padding = "10px 20px";
                button.style.backgroundColor = "#007BFF";
                button.style.color = "white";
                button.style.border = "none";
                button.style.borderRadius = "5px";
                button.style.cursor = "pointer";
                button.style.zIndex = "9999";
                button.addEventListener("click", openPublishModal);
                document.body.appendChild(button);
              }

              function openPublishModal() {
                const overlay = document.createElement("div");
                overlay.style.position = "fixed";
                overlay.style.top = "0";
                overlay.style.left = "0";
                overlay.style.width = "100%";
                overlay.style.height = "100%";
                overlay.style.background = "rgba(0, 0, 0, 0.7)";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.zIndex = "10000";

                const modal = document.createElement("div");
                modal.style.background = "#fff";
                modal.style.borderRadius = "8px";
                modal.style.padding = "30px";
                modal.style.maxWidth = "400px";
                modal.style.width = "90%";
                modal.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.1)";
                modal.style.textAlign = "center";
                modal.style.fontFamily = "Arial, sans-serif";

                const title = document.createElement("h2");
                title.innerText = "Publish Changes";
                title.style.marginBottom = "20px";
                title.style.color = "black";
                modal.appendChild(title);

                const input = document.createElement("input");
                input.type = "password";
                input.placeholder = "Enter publish password";
                input.style.width = "100%";
                input.style.padding = "12px 8px";
                input.style.fontSize = "16px";
                input.style.marginBottom = "20px";
                input.style.border = "1px solid #ccc";
                input.style.borderRadius = "4px";
                modal.appendChild(input);

                const buttonContainer = document.createElement("div");
                buttonContainer.style.display = "flex";
                buttonContainer.style.justifyContent = "space-between";

                const cancelButton = document.createElement("button");
                cancelButton.innerText = "Cancel";
                cancelButton.style.padding = "10px 20px";
                cancelButton.style.background = "#bbb";
                cancelButton.style.border = "none";
                cancelButton.style.borderRadius = "4px";
                cancelButton.style.color = "#fff";
                cancelButton.style.cursor = "pointer";
                cancelButton.addEventListener("click", () => {
                  document.body.removeChild(overlay);
                });

                const submitButton = document.createElement("button");
                submitButton.innerText = "Publish";
                submitButton.style.padding = "10px 20px";
                submitButton.style.background = "#28a745";
                submitButton.style.border = "none";
                submitButton.style.borderRadius = "4px";
                submitButton.style.color = "#fff";
                submitButton.style.cursor = "pointer";
                submitButton.addEventListener("click", () => {
                  const password = input.value;
                  if (password) {
                    fetch("/__publish", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ password })
                    })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) {
                          alert("Published successfully!");
                          window.location.search = "";
                        } else {
                          alert("Publish failed: " + data.message);
                        }
                        document.body.removeChild(overlay);
                      })
                      .catch(err => {
                        alert("Error: " + err.message);
                        document.body.removeChild(overlay);
                      });
                  }
                });

                buttonContainer.appendChild(cancelButton);
                buttonContainer.appendChild(submitButton);
                modal.appendChild(buttonContainer);
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
              }

              if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                  addPreviewToLinks();
                  createPublishButton();
                });
              } else {
                addPreviewToLinks();
                createPublishButton();
              }
            })();
          </script>
        `;
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
