import { requireChatGPTUser } from './chatgpt-auth';
import { routeReturn } from '@/lib/route-return';
import MhadaApplication from './mhada-application';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){await requireChatGPTUser(routeReturn('/',await searchParams));return <MhadaApplication/>;}
