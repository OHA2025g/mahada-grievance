import { notFound } from 'next/navigation';
import { requireChatGPTUser } from '../../chatgpt-auth';
import MhadaApplication from '../../mhada-application';
import { routeReturn } from '@/lib/route-return';
import { screenById } from '@/lib/forms';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({params,searchParams}: {params: Promise<{screen: string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {screen} = await params;
  if (!screenById[screen]) notFound();
  await requireChatGPTUser(routeReturn('/workspace/' + screen,await searchParams));
  return <MhadaApplication />;
}
