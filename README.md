# Howard Tech Blog

Hugo blog at <https://blog.idontwannarock.dev/>, deployed from `main` via Cloudflare Pages.

## Prerequisite

- Git 2.33.1+
- Hugo extended 0.156+ (optional — only for local preview; Cloudflare Pages handles publishing)

## Init After Git Clone

```bash
git submodule update --init --recursive
```

The `themes/diary` submodule points at [`idontwannarock/hugo-theme-diary`](https://github.com/idontwannarock/hugo-theme-diary) (personal fork) on `fix/site-author-params-compat`, which patches `layouts/index.rss.xml` for Hugo 0.156+ compatibility. Upstream PR pending: [AmazingRise/hugo-theme-diary#202](https://github.com/AmazingRise/hugo-theme-diary/pull/202). Once merged the submodule can be repointed back to `AmazingRise/main`.

If you intend to push theme changes from this clone, set an SSH push URL on the submodule (fetch stays HTTPS for CI auth):

```bash
git -C themes/diary remote set-url --push origin git@github.com:idontwannarock/hugo-theme-diary.git
```

## Local Preview (Optional)

- `hugo server` — serve at <http://localhost:1313> with live reload
- `hugo new posts/<fileName>.md` — scaffold new post
- `hugo new pages/<fileName>.md` — scaffold new page

## Publish

Commit and push to `main`:

```bash
git push origin main
```

[Cloudflare Pages](https://pages.cloudflare.com/) auto-builds the site with Hugo extended and deploys to <https://blog.idontwannarock.dev/>. Pushes to non-production branches and pull requests get unique preview URLs on the project's `*.pages.dev` domain. End-to-end time is typically 30-60 seconds.

Build settings live in the Cloudflare Pages dashboard, not in the repo:

- Build command: `hugo --gc --minify`
- Build output directory: `public`
- Environment variable: `HUGO_VERSION=0.161.1`

Edge behaviour configured via repo files:

- [`static/_headers`](static/_headers) — HTTP response headers (RFC 8288 `Link` header for AI agent discovery).
- [`functions/_middleware.ts`](functions/_middleware.ts) — Cloudflare Pages middleware that honours `Accept: text/markdown` content negotiation, serving the raw post body in markdown.

## Update Theme

```bash
git submodule update --remote --merge
git add themes/diary
git commit -m "chore(theme): bump"
git push
```

## Reference

- [Markdown Syntax Highlight Support Language](https://github.com/jincheng9/markdown_supported_languages?tab=readme-ov-file#heres-a-full-list-of-supported-languages)
