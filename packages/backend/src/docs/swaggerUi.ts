import { Hono } from 'hono';
import { openApiSpec } from './openapi';

export function createDocsApp(): Hono {
  const app = new Hono();

  // JSON Specification endpoint
  app.get('/openapi.json', (c) => {
    return c.json(openApiSpec);
  });

  // Swagger UI Interactive Web Interface
  app.get('/', (c) => {
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NusaProc API Documentation - Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://nusanet.net.id/favicon.ico" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    .topbar {
      display: none;
    }
    .swagger-ui .info {
      margin: 20px 0;
    }
    .swagger-ui .info .title {
      color: #0052CC;
    }
    .custom-header {
      background: #0052CC;
      color: white;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .custom-header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }
    .custom-header .badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="custom-header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <h1>NusaProc API Documentation</h1>
      <span class="badge">OpenAPI 3.0.3</span>
    </div>
    <span style="font-size: 13px;">PT Nusanet Enterprise Procurement</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list"
      });
    };
  </script>
</body>
</html>`;
    return c.html(html);
  });

  return app;
}
