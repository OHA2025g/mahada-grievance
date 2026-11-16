import { env } from 'cloudflare:workers';
import { handle } from '@/lib/service';
import type { ApiEnv } from '@/lib/types';
export const dynamic='force-dynamic';
export async function GET(request:Request){return handle(request,env as unknown as ApiEnv);}
export async function POST(request:Request){return handle(request,env as unknown as ApiEnv);}
