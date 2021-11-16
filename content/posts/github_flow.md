---
title: "Github Flow 簡介"
slug: "github_flow_intro"
date: 2019-05-29T10:52:45+08:00
description: "依照官方說明簡述 GitHub flow"
tags: ["github-flow"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1559100843/Tech%20Blog/github-flow-cover_dlhcbl.png"
draft: false
comment: true
---

[Understanding the GitHub flow](https://guides.github.com/introduction/flow/)

GitHub flow 只有一條原則：

> **在 master 的任何 commit 永遠都是可以被部署的**

所以所有要做開發的 branch 都直接從 master 分支出去，不論是 feature 或 fix

開發的每個 commit 都要寫清楚 message，註明該 commit 做的變動以及理由等等

當開發到一定階段後，就可以對 master 開 Pull Request, PR，這在 GitHub flow 很重要

如果是用 Fork & Pull 模式，PR 就是用來通知專案維護者關於你希望他們考慮的變更；如果是用 Shared Repository 模式，則 PR 就像是用來開一個討論空間，在 merge 到 master 之前來做 code review 或針對特定變更的討論

> Fork & Pull 模式就是需要先 fork 後再 pull 到本機做開發，完成並 push 後，開 PR 要求合併到主專案
> 
> Shared Repository 模式則是直接可以對主專案開 branch 做開發

在開 PR 之後，還是可以在該分支繼續開發，可以是有關討論的變更或 fix 等，重要的是要在 commit message 寫清楚變更以及變更的理由或決策的脈絡

在變更經過討論並測試完畢後，在 merge 到 master 之前，直接用分支的 commit 部署到 production 做最後的驗證，如果有問題，則用 master 上的 commit 重新部署到 production 來回復

> 所以在 GitHub flow 中，測試是很重要的部分

當變更通過部署在 production 的驗證後，就可以將該變更 merge 到 master，此時 PR 就結束，並會留下該變更的整個紀錄，讓其他人了解整個變更的流程以及脈絡

而且因為 PR 可以連結 Issue，當 PR 被 merge 後，關聯到的 Issue 也會同時關閉
