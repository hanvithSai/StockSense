import mongoose from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { todayISO } from "@/lib/format";
import { can, type Capability } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { fieldErrors } from "@/lib/validation/common";
import { getCurrentUser } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { AppError, badRequest, forbidden, unauthorized, validationError } from "@/server/errors";

type Params = Record<string, string>;
type RouteContext = { params: Promise<Params> };

interface HandlerContext {
  req: NextRequest;
  params: Params;
}

const DUPLICATE_LABELS: Record<string, string> = {
  loginId: "This login ID is already taken",
  email: "An account with this email already exists",
  sku: "Another product already uses this SKU",
  shortCode: "This short code is already in use",
  name: "This name is already in use",
  fullName: "A location with this short code already exists in the warehouse",
};

function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return errorResponse(validationError(fieldErrors(error)));
  }
  if (error instanceof mongoose.Error.CastError) {
    return errorResponse(badRequest("Invalid identifier"));
  }
  if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
    const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? "value";
    const message = DUPLICATE_LABELS[field] ?? "This value is already in use";
    return errorResponse(new AppError(409, "DUPLICATE", message, { [field]: message }));
  }
  console.error("[api] unexpected error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please retry." } },
    { status: 500 },
  );
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite cookies). */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  // An opaque or malformed origin ("null" from sandboxed frames, garbage) is never same-origin.
  if (!host || !URL.canParse(origin) || new URL(origin).host !== host) throw forbidden("Cross-origin request blocked");
}

function respond(result: unknown): Response {
  return result instanceof Response ? result : NextResponse.json({ data: result ?? null });
}

/** Authenticated route: connects to the DB, resolves the session user and checks the capability. */
export function route(
  options: { capability?: Capability },
  handler: (ctx: HandlerContext & { user: SessionUser }) => Promise<unknown>,
) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      assertSameOrigin(req);
      await connectDB();
      const user = await getCurrentUser();
      if (!user) throw unauthorized();
      if (options.capability && !can(user.role, options.capability)) throw forbidden();
      return respond(await handler({ req, params: await context.params, user }));
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Public route (sign-up, login, password reset). */
export function publicRoute(handler: (ctx: HandlerContext) => Promise<unknown>) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      assertSameOrigin(req);
      await connectDB();
      return respond(await handler({ req, params: await context.params }));
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Parses and validates a JSON body with a zod schema. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const body = await req.json().catch(() => {
    throw badRequest("Request body must be valid JSON");
  });
  return schema.parse(body);
}

/** Control characters never belong in a filter or search term (MongoDB patterns cannot contain NUL). */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function searchParam(req: NextRequest, key: string): string | undefined {
  const value = req.nextUrl.searchParams.get(key)?.replace(CONTROL_CHARACTERS, "").trim();
  return value ? value : undefined;
}

export function listParam(req: NextRequest, key: string): string[] | undefined {
  const value = searchParam(req, key);
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : undefined;
}

/** The client's local date (`today=YYYY-MM-DD`), falling back to the server date. */
export function todayParam(req: NextRequest): string {
  const value = searchParam(req, "today");
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayISO();
}

/** The client's IANA time zone (`tz=Asia/Kolkata`), falling back to UTC when missing or unknown. */
export function timeZoneParam(req: NextRequest): string {
  const value = searchParam(req, "tz");
  if (!value) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

/** Reads an optional JSON body (empty body => `{}`). */
export async function optionalBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}

/** Deepest page served; keeps database skips in range whatever the query string says. */
const MAX_PAGE = 10_000;

export function pageParams(req: NextRequest, defaultLimit = 20) {
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(searchParam(req, "page") ?? "1", 10) || 1));
  const limit = Math.min(200, Math.max(1, Number.parseInt(searchParam(req, "limit") ?? "", 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}
