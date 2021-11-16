---
title: "Hugo 半自動部署"
date: 2021-11-03T16:29:03+08:00
slug: "hugo_semi_auto_deploy"
description: "將手動部署 Hugo 到 GitHub Pages 轉為半自動"
tags: ["hugo", "git", "github", "github-pages"]
categories: application
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1568903691/Tech%20Blog/hugo-logo_zjncdo.png"
draft: false
comment: true
enableLaTeX: false
---

這篇主要在講將以往所有手動的步驟，包括網站建置及發佈到 GitHub Pages 等，盡量調整為一個 script 來處理

起因是因為種種因素，所以這個 Blog 停更了很久，其實也就是懶，還有之前沒有找到符合我要求的佈景主題。所以把手動的步驟減少，懶惰的理由就少了一個

至於佈景主題我自己是有幾個要求:

1. 主要是給 Blog 用。這個要求是因為其實有很多佈景主題是給 Portfolio, Landing Page 等等使用的，所以首頁或 pages 的功能很強，文件都在講這些，但我都不需要
2. 文章要在側邊自動生成 Table of Content。這個就是 Blog 的要求，很多佈景主題是沒有支援這個功能的
3. 要有 Category 跟 Tag 的功能
4. 風格簡單

這些要求看起來很基本，但不知道為什麼，就算只滿足 2、3 項的交集都極少。目前找到最符合要求的就是 [Diary](https://themes.gohugo.io/themes/hugo-theme-diary/)

換 theme 的部分參考[官網](https://gohugo.io/getting-started/quick-start/#step-3-add-a-theme)，沒什麼好說的

主要講如何部署到 GitHub Pages 的部分

## 部署到 GitHub Pages

以我的了解，主要有三種方式

- 直接部署
- 資料夾部署
- 分支部署

### 直接部署

就是只單獨把建置 (`hugo`) 出來的 `public` 資料夾推到 GitHub main branch，然後在 repo 的 Pages 設定頁面指定 Source 為 main branch

### 資料夾部署

這個方式是把整個專案包含原始檔都推到 GitHub main branch，然後在 repo 的 Pages 設定頁面指定 Source 為 main branch 的 docs 資料夾

因為 GitHub 只認根目錄或 docs 資料夾的內容，所以在 config 檔裡面要加上 `publishDir: "docs"` 的設定項，建置出來的靜態網站才會在 docs 資料夾裡面

### 分支部署

這個方式是將專案原始檔跟建置出來的靜態網站放在不同的分支，讓 GitHub 以分支來部署

這有兩種做法，要看你 Git 的版本 (2.5+) 是否有支援 [`git worktree`](https://git-scm.com/docs/git-worktree) 指令，如果沒有支援，就要改用 `git clone` 的方式

`git worktree` 指令是在 2.5 版 2015 年加入的，所以我只研究 `git worktree` 的作法

首先先把 public 資料夾加入 .gitignore 檔，讓 public 資料夾的內容都不會被 commit 到放原始檔的 main 分支

> btw，之前 GitHub 為了政治正確，所以把行之有年的 master 分支名稱都改為 main，所以你看到官網的文件都只會看到 main 分支，指的就是 master。但其實你要用 master 也沒有不行的樣子

接著建立要放靜態網站的分支 gh-pages (名稱應該也是隨意)，但要將其建立為 orphan branch 以免將原始碼帶進去，並建立一個空的 commit 並設定對應 GitHub 的遠端分支

```shell
git checkout --orphan gh-pages
git reset --hard
git commit --allow-empty -m "feat: init gh-pages branch"
git push origin gh-pages
git checkout master
```

接著就是做幾件事:

1. 移除 public 資料夾以清除前一次建置出來的靜態網站
2. 以 `git worktree` 指令將 gh-pages 分支開在 public 資料夾
3. 建置網站
4. 將 public 資料夾建置出來的內容 commit 到 gh-pages
5. 將 gh-pages 分支推送到 GitHub

以下是我用來建置並部署到 GitHub Pages 的 script

```shell
DIR=$(dirname "$0")

cd "$DIR" || (echo "$DIR does not exist" & exit)

if [ "$(git status -s)" ]
then
  echo "The working directory is dirty. Please commit any pending changes."
  exit 1;
fi

echo "Deleting old publication"
rm -rf public
mkdir public
git worktree prune
rm -rf .git/worktree/public/

echo "Checking out gh-pages branch into public"
git worktree add -B gh-pages public origin/gh-pages

echo "Removing existing files"
rm -rf public/*

echo "Generating site"
hugo

echo "Updating gh-pages branch"
cd public && git add --all && git commit -m "feat: publish to gh-pages (publish.sh)" && cd ..

# publish
git push origin gh-pages
```

在 script 裡面我有先檢查是否還有未 commit 的修改，然後做完整的清除，才去建置網站

推到 GitHub 後，要記在 repo 的 Pages 設定頁面指定 Source 為 gh-pages branch

## Reference

- [Hosting on GitHub Pages](https://bwaycer.github.io/hugo_tutorial.hugo/tutorials/github-pages-blog/)
