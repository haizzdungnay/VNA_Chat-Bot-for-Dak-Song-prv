import type { Env } from "../types";
import { jsonResponse, errorResponse } from "../utils/response";
import { authenticateAdmin } from "../services/admin-auth.service";
import { AdminService } from "../services/admin.service";
import { ValidationError } from "../utils/errors";

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function adminOverviewRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  const service = new AdminService(env);
  const data = await service.getOverview();
  return jsonResponse(data, 200, env, NO_STORE);
}

export async function adminProfilesListRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  const service = new AdminService(env);
  const data = await service.getProfiles();
  return jsonResponse(data, 200, env, NO_STORE);
}

export async function adminProfileCreateRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  try {
    const body = await req.json();
    const service = new AdminService(env);
    const created = await service.createProfile(body as any, auth.email || "admin");
    return jsonResponse(created, 201, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400, env, NO_STORE);
    }
    return errorResponse(err.message || "Failed to create profile", 500, env, NO_STORE);
  }
}

export async function adminProfileUpdateRoute(
  req: Request,
  params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  try {
    const body = await req.json();
    const service = new AdminService(env);
    const updated = await service.updateProfile(params.id, body as any, auth.email || "admin");
    return jsonResponse(updated, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400, env, NO_STORE);
    }
    return errorResponse(err.message || "Failed to update profile", 500, env, NO_STORE);
  }
}

export async function adminProfileDeleteRoute(
  req: Request,
  params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  try {
    const service = new AdminService(env);
    const success = await service.deleteProfile(params.id, auth.email || "admin");
    return jsonResponse({ success }, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400, env, NO_STORE);
    }
    return errorResponse(err.message || "Failed to delete profile", 500, env, NO_STORE);
  }
}

export async function adminProfileTestRoute(
  req: Request,
  params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  try {
    const service = new AdminService(env);
    const result = await service.testProfileConnection(params.id, auth.email || "admin");
    return jsonResponse(result, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400, env, NO_STORE);
    }
    return errorResponse(err.message || "Failed to test profile", 500, env, NO_STORE);
  }
}

export async function adminProfileActivateRoute(
  req: Request,
  params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  try {
    const service = new AdminService(env);
    const activeProfileId = await service.activateProfile(params.id, auth.email || "admin");
    return jsonResponse({ success: true, activeProfileId }, 200, env, NO_STORE);
  } catch (err: any) {
    if (err instanceof ValidationError) {
      return errorResponse(err.message, 400, env, NO_STORE);
    }
    return errorResponse(err.message || "Failed to activate profile", 500, env, NO_STORE);
  }
}

export async function adminProfileRollbackRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  try {
    const service = new AdminService(env);
    await service.rollbackToEnv(auth.email || "admin");
    return jsonResponse(
      { success: true, message: "Rollback về cấu hình Worker Environment Variables thành công" },
      200,
      env,
      NO_STORE
    );
  } catch (err: any) {
    return errorResponse(err.message || "Failed to rollback", 500, env, NO_STORE);
  }
}

export async function adminVisitorsRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  const service = new AdminService(env);
  const data = await service.getVisitors();
  return jsonResponse(data, 200, env, NO_STORE);
}

export async function adminLogsRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  const service = new AdminService(env);
  const data = await service.getLogs();
  return jsonResponse(data, 200, env, NO_STORE);
}

export async function adminSystemRoute(
  req: Request,
  _params: Record<string, string>,
  env: Env
): Promise<Response> {
  const auth = await authenticateAdmin(req, env);
  if (!auth.authenticated) {
    return errorResponse(auth.error || "Unauthorized", auth.status || 401, env, NO_STORE);
  }

  const status = {
    runtime: "Cloudflare Workers",
    version: "Phase 5A",
    cfAccessConfigured: Boolean(env.CF_ACCESS_TEAM_NAME && env.CF_ACCESS_AUD),
    encryptionConfigured: Boolean(env.ADMIN_ENCRYPTION_KEY && env.ADMIN_ENCRYPTION_KEY.length >= 16),
    featureFlagActive: env.ADMIN_AI_CONFIG_ENABLED === "true" || env.ADMIN_AI_CONFIG_ENABLED === true,
  };

  return jsonResponse(status, 200, env, NO_STORE);
}

