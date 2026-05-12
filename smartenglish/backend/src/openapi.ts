export function createOpenApiDocument() {
  const port = Number(process.env.PORT) || 4000;
  const serverUrl =
    process.env.API_PUBLIC_URL?.replace(/\/$/, "") ??
    `http://localhost:${port}`;

  return {
    openapi: "3.0.3",
    info: {
      title: "Smart English API",
      description:
        "HTTP API backend Smart English — Phase 1: Google đăng nhập, JWT, dashboard stub.",
      version: "0.2.0-phase1",
    },
    servers: [{ url: serverUrl, description: "Máy chủ API hiện tại" }],
    tags: [
      { name: "System", description: "Kiểm tra & phiên bản" },
      { name: "Auth", description: "Google OAuth & phiên JWT" },
      { name: "Users", description: "Hồ sơ người dùng" },
      { name: "Dashboard", description: "Tổng quan học tập (Phase 1 stub)" },
    ],
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
      "/api/auth/google": {
        post: {
          tags: ["Auth"],
          summary: "Đăng nhập / đăng ký với Google",
          description:
            "Body chứa `credential` hoặc `idToken`: JWT ID token do Google Identity Services trả về sau khi người dùng đăng nhập Google.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GoogleAuthBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "Đã cấp access + refresh token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AuthLoginResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Làm mới access token",
          description:
            "Refresh token chỉ dùng một lần (rotation); nhận refresh token mới trong response.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AuthRefreshResponse",
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Đăng xuất (thu hồi refresh token)",
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogoutBody" },
              },
            },
          },
          responses: {
            "204": { description: "Không nội dung" },
          },
        },
      },
      "/api/me": {
        get: {
          tags: ["Users"],
          summary: "Thông tin người đăng nhập",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MeResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
        patch: {
          tags: ["Users"],
          summary: "Cập nhật hồ sơ nhẹ (locale, onboarding placement)",
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PatchMeBody" },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MeResponse" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
      "/api/dashboard/summary": {
        get: {
          tags: ["Dashboard"],
          summary: "Dashboard cơ bản (Phase 1)",
          description:
            "Dữ liệu stub từ bảng `user_stats`; sẽ được nối Flashcard SRS, Reading, mock test ở các module sau.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/DashboardSummaryResponse",
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
            "503": { $ref: "#/components/responses/ServiceUnavailable" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      responses: {
        BadRequest: {
          description: "Dữ liệu không hợp lệ",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Unauthorized: {
          description: "Chưa đăng nhập hoặc token không hợp lệ",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Không tìm thấy",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        ServiceUnavailable: {
          description: "Thiếu cấu hình / dịch vụ phụ thuộc",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
      schemas: {
        HealthResponse: {
          type: "object",
          required: ["ok", "services"],
          properties: {
            ok: { type: "boolean" },
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
            version: { type: "string", example: "0.2.0-phase1" },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        GoogleAuthBody: {
          type: "object",
          properties: {
            credential: {
              type: "string",
              description: "JWT id_token từ Google Identity Services",
            },
            idToken: {
              type: "string",
              description: "Alias của credential",
            },
          },
          description: "Ít nhất một trong hai trường credential hoặc idToken.",
        },
        RefreshBody: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
        },
        LogoutBody: {
          type: "object",
          properties: {
            refreshToken: {
              type: "string",
              description:
                "Nếu có, refresh token tương ứng sẽ bị xóa khỏi server.",
            },
          },
        },
        PublicUser: {
          type: "object",
          required: [
            "id",
            "email",
            "displayName",
            "avatarUrl",
            "locale",
            "placementCompleted",
            "placementSkipped",
            "createdAt",
            "updatedAt",
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            displayName: { type: "string", nullable: true },
            avatarUrl: { type: "string", nullable: true },
            locale: { type: "string" },
            placementCompleted: { type: "boolean" },
            placementSkipped: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AuthLoginResponse: {
          type: "object",
          required: [
            "accessToken",
            "refreshToken",
            "expiresIn",
            "tokenType",
            "user",
          ],
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            expiresIn: {
              type: "integer",
              description: "TTL access token (giây)",
            },
            tokenType: { type: "string", example: "Bearer" },
            user: { $ref: "#/components/schemas/PublicUser" },
          },
        },
        AuthRefreshResponse: {
          type: "object",
          required: ["accessToken", "refreshToken", "expiresIn", "tokenType"],
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            expiresIn: { type: "integer" },
            tokenType: { type: "string", example: "Bearer" },
          },
        },
        MeResponse: {
          type: "object",
          required: ["user"],
          properties: {
            user: { $ref: "#/components/schemas/PublicUser" },
          },
        },
        PatchMeBody: {
          type: "object",
          properties: {
            locale: { type: "string", maxLength: 16 },
            placementCompleted: { type: "boolean" },
            placementSkipped: { type: "boolean" },
          },
        },
        DashboardSummaryResponse: {
          type: "object",
          required: [
            "phase",
            "user",
            "skills",
            "streak",
            "srs",
            "roadmap",
            "notes",
          ],
          properties: {
            phase: { type: "string", example: "1" },
            user: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                displayName: { type: "string", nullable: true },
                avatarUrl: { type: "string", nullable: true },
                placementCompleted: { type: "boolean" },
                placementSkipped: { type: "boolean" },
              },
            },
            skills: {
              type: "object",
              properties: {
                listening: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
                speaking: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
                reading: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
                writing: { type: "integer", nullable: true, minimum: 0, maximum: 100 },
              },
            },
            streak: {
              type: "object",
              properties: {
                currentDays: { type: "integer" },
                longestDays: { type: "integer" },
              },
            },
            srs: {
              type: "object",
              properties: {
                dueToday: { type: "integer" },
                newCards: { type: "integer" },
              },
            },
            roadmap: {
              type: "object",
              properties: {
                completedPercent: {
                  type: "integer",
                  minimum: 0,
                  maximum: 100,
                },
                nextMilestone: { type: "string", nullable: true },
              },
            },
            notes: { type: "string" },
          },
        },
      },
    },
  };
}
