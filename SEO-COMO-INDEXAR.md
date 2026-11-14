# Miniatura no WhatsApp e pesquisa no Google

O projeto já está configurado para usar a imagem `public/assets/compartilhar.png` na prévia do WhatsApp, com título e descrição. A URL da imagem é montada automaticamente com o domínio de acesso no Cloudflare Pages ou no servidor Express.

## Publicar

1. Publique esta versão do projeto no Cloudflare Pages (diretório de saída: `public`; funções na pasta `functions/`) ou no seu servidor Node.
2. Acesse `https://SEU-DOMINIO/assets/compartilhar.png` e confirme que a imagem abre.
3. Abra o código-fonte de `https://SEU-DOMINIO/` e procure `og:image`: deve aparecer uma URL completa com o seu domínio, e não `__SITE_ORIGIN__`.
4. Compartilhe o link completo `https://SEU-DOMINIO/` no WhatsApp. A prévia pode demorar a atualizar por causa do cache.

## Aparecer no Google

1. Entre em https://search.google.com/search-console e adicione seu domínio ou a propriedade de prefixo URL.
2. Confirme a propriedade pelo método indicado pelo Google (DNS, arquivo HTML etc.).
3. Em **Sitemaps**, envie `https://SEU-DOMINIO/sitemap.xml`.
4. Em **Inspeção de URL**, informe `https://SEU-DOMINIO/` e clique em **Solicitar indexação** quando disponível.
5. Aguarde o rastreamento. A indexação e a posição nas pesquisas por **Naçaum TV** ou **Nacaum TV** não são garantidas.

Se tiver domínio próprio, use-o como propriedade principal e redirecione o endereço secundário para ele, evitando duplicação.
