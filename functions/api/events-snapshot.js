import { ensureDailySnapshot } from './events.js';

export async function onRequestPost({request,env}) {
  const secret=env.EVENTS_CRON_SECRET;
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`)
    return Response.json({error:'Não autorizado'},{status:401});
  try {
    const result=await ensureDailySnapshot(env);
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    console.error('[EVENTS SNAPSHOT CRON]',error);
    return Response.json({error:error.message},{status:502});
  }
}
