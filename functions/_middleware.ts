interface Env {
  ASSETS: Fetcher;
}

const wantsMarkdown = (accept: string): boolean =>
  /\b(text\/markdown|application\/markdown)\b/i.test(accept);

const isPageRequest = (pathname: string): boolean =>
  pathname.endsWith("/") || !/\.[^/]+$/.test(pathname);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next, env } = context;

  const accept = request.headers.get("Accept") ?? "";
  if (!wantsMarkdown(accept)) return next();

  const url = new URL(request.url);
  if (!isPageRequest(url.pathname)) return next();

  const mdPathname = url.pathname.endsWith("/")
    ? `${url.pathname}index.md`
    : `${url.pathname}/index.md`;

  const mdRequest = new Request(new URL(mdPathname, url.origin).toString(), {
    headers: { Accept: "text/markdown" },
  });
  const mdResponse = await env.ASSETS.fetch(mdRequest);

  if (mdResponse.status !== 200) return next();

  return new Response(mdResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Vary": "Accept",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
