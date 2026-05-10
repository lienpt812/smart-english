export function createOpenApiDocument() {
  const port = Number(process.env.PORT) || 4000;
  const serverUrl =
    process.env.API_PUBLIC_URL?.replace(/\/$/, "") ??
    `http://localhost:${port}`;

  return {
    openapi: "3.0.3",
    info: {
      title: "Smart English API",
      description: "HTTP API đồ backend Smart English Learning Platform.",
      version: "0.1.0",
    },
    servers: [{ url: serverUrl, description: "Máy chủ API hiện tại" }],
    tags: [{ name: "System", description: "Kiểm tra & phiên bản" }],
    paths: {
      "/health": {
        get: {
          tags: ["System"],
          summary: "Health check",
          description:
            "Trạng thái kết nối PostgreSQL và Redis (SRS engine / cache).",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
      "/api/version": {
        get: {
          tags: ["System"],
          summary: "Phiên bản API",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/VersionResponse" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        HealthResponse: {
          type: "object",
          required: ["ok", "services"],
          properties: {
            ok: {
              type: "boolean",
              description: "true khi Postgres và Redis đều reachable",
            },
            services: {
              type: "object",
              required: ["postgres", "redis"],
              properties: {
                postgres: { type: "boolean" },
                redis: { type: "boolean" },
              },
            },
          },
        },
        VersionResponse: {
          type: "object",
          required: ["name", "version"],
          properties: {
            name: { type: "string", example: "smartenglish-backend" },
            version: { type: "string", example: "0.1.0" },
          },
        },
      },
    },
  } as const;
}
