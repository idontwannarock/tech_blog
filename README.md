# Howard Tech Blog

## Prerequisite

- Hugo 0.88+
- Git 2.33.1+

## Init After Git Clone

```git
git submodule update --init --recursive
```

## Hugo Basic Operation

- `hugo new posts/<fileName>.md`: generate new post in Markdown file
- `hugo new pages/<fileName>.md`: generate new page in Markdown file
- `hugo server`: test locally
- `hugo`: generate site

## Quick Publish

1. Commit any changes in main branch.
2. Execute `publish.sh`.

## Update Theme

```git
git submodule update --remote --merge
```

## Reference

- [Markdown Syntax Highlight Support Language](https://github.com/jincheng9/markdown_supported_languages?tab=readme-ov-file#heres-a-full-list-of-supported-languages)
