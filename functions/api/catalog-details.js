export async function onRequestGet(){
  try {
    const response=await fetch('https://filmes-saimo.pages.dev/detalhes.txt',{cf:{cacheTtl:3600,cacheEverything:true}});
    if(!response.ok)return new Response('Metadados indisponíveis',{status:502});
    return new Response(response.body,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=1800'}});
  } catch {return new Response('Falha ao consultar metadados',{status:502});}
}
