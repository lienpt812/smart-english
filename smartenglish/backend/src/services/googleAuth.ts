import { OAuth2Client } from "google-auth-library";

let oauthClient: OAuth2Client | null = null;

function getAudience(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) {
    throw Object.assign(new Error("GOOGLE_CLIENT_ID chưa được cấu hình"), {
      statusCode: 503,
    });
  }
  return id;
}

export type GoogleProfile = {
  googleSub: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export async function verifyGoogleCredential(
  credential: string
): Promise<GoogleProfile> {
  const audience = getAudience();
  if (!oauthClient) oauthClient = new OAuth2Client(audience);
  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw Object.assign(new Error("Google token không hợp lệ"), {
      statusCode: 401,
    });
  }
  return {
    googleSub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    displayName: payload.name ?? null,
    avatarUrl: payload.picture ?? null,
  };
}
