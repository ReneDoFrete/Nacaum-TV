export default {
  async scheduled(event,env,ctx) {
    ctx.waitUntil((async()=>{
      const response=await fetch(`${env.EVENTS_SITE_URL}/api/events-snapshot`,{
        method:'POST',headers:{Authorization:`Bearer ${env.EVENTS_CRON_SECRET}`},
      });
      const body=await response.text();
      if(!response.ok)throw new Error(`Snapshot HTTP ${response.status}: ${body.slice(0,400)}`);
      console.log('[EVENTS CRON]',body);
    })());
  },
};
