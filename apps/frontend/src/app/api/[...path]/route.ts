import type { NextRequest } from 'next/server';
import { forwardToApi } from '@/core/apiProxy';

// `/api/*` on the frontend origin → the API server (see core/apiProxy.ts).
// Only reached when no reverse proxy routes /api to the server itself.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContextT = { params: Promise<{ path: string[] }> };

const handler = async (req: NextRequest, { params }: RouteContextT): Promise<Response> =>
  forwardToApi(req, (await params).path);

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
