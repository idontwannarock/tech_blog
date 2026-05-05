# Howard Tech Blog

Hugo blog at <https://blog.idontwannarock.dev/>, deployed from `main` via GitHub Actions.

## Prerequisite

- Git 2.33.1+
- Hugo extended 0.156+ (optional — only for local preview; CI handles publishing)

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

The [`deploy.yml`](.github/workflows/deploy.yml) workflow builds the site with Hugo extended and deploys to GitHub Pages. End-to-end time is typically under a minute.

## Update Theme

```bash
git submodule update --remote --merge
git add themes/diary
git commit -m "chore(theme): bump"
git push
```

## Reference

- [Markdown Syntax Highlight Support Language](https://github.com/jincheng9/markdown_supported_languages?tab=readme-ov-file#heres-a-full-list-of-supported-languages)
