---
title: "在 Batch Script 壓縮檔案"
date: 2021-12-16T15:32:25+08:00
slug: "zip_in_batch_script"
description: "紀錄如何在 Batch Script 中壓縮檔案"
tags: ["batch", "compression"]
categories: implementation
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1639640493/Tech%20Blog/batch-file.webp"
draft: false
comment: true
enableLaTeX: false
---

因為目前公司沒有專職 SRE 或 DevOps 幫忙做 CI/CD，身為小小後端工程師只好自己想辦法，偏偏目前用到的 tech stack 包括 .net framework，所以必須跟 Windows 環境的 batch file 打交道來替代習慣的 shell 檔，其中有個步驟必須要壓縮/解壓縮資料夾

## Tar

研究了一下，很興奮的發現 tar 在 command prompt 跟 powershell 都可以用，那代表我在 batch 檔裡面使用沒問題ＲＲＲ

所以可以這樣用

```batch
:: zip
tar -cvzf "path and name to archive.tar" "path to folder to compress"

:: unzip
tar -xvzf "path and name to archive.tar"
```

## Microsoft.Powershell.Archive Module

很可惜，這個方法有一個小小的問題

tar 基本上是從 Windows 10 或 Windows Server 2019 才開始支援，很不巧，我手上有個環境是 Windows Server 2016...

基於可以用原生就絕不多安裝東西的自虐原則，好險又找到了另一個方法，powershell 有個 archive 的模組可以用！

```powershell
# zip
Compress-Archive -Path "path to folder to compress" -DestinationPath "path and name to archive.zip"

# unzip
Expand-Archive -Path "path and name to archive.zip" -DestinationPath "path to unzip archive.zip"
```

## 參考連結

- [Tar and Curl Come to Windows!](https://techcommunity.microsoft.com/t5/containers/tar-and-curl-come-to-windows/ba-p/382409)
- [Microsoft.PowerShell.Archive](https://docs.microsoft.com/zh-tw/powershell/module/microsoft.powershell.archive/?view=powershell-7.2&viewFallbackFrom=powershell-5.0)
