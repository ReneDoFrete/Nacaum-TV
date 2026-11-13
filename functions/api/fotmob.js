const SOURCE='https://www.fotmob.com/api/data/tvguide?country=br&timezone=America%2FSao_Paulo';
export async function onRequestGet({env}) {
 try {
  const relay=String(env.FOTMOB_RELAY_URL||'').trim();
  const headers={};
  if(relay&&env.FOTMOB_RELAY_TOKEN)headers.Authorization=`Bearer ${env.FOTMOB_RELAY_TOKEN}`;
  const response=await fetch(relay||SOURCE,{headers,signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Origem retornou HTTP ${response.status}`);
  const data=await response.json();
  return Response.json(data,{headers:{'Cache-Control':'public, max-age=60'}});
 }catch(e){return Response.json({error:'Falha ao consultar FotMob',detail:e.message},{status:502})}
}
