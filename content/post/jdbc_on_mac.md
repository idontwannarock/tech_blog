---
title: "MacOS 安裝 JDBC"
slug: "jdbc_on_mac"
date: 2017-11-23T14:48:17+08:00
description: "紀錄在 MacOS 上安裝 JDBC 過程"
tags: ["java", "jdbc", "macos"]
categories: ["application"]
featuredImage: ""
featuredImageDescription: ""
dropCap: false
displayInMenu: false
displayInList: false
draft: true
---

# 前言

為了貫徹在不同平台上都能同步工作進度的目標，要想辦法在 MacOS 上也能進行 Java 及 JDBC 開發。

# 安裝

在 MacOS 上要進行 JDBC 的開發，首先必須要安裝好資料庫，這邊以 MySQL 為主。

## 安裝 MySQL

MacOS 原本預設就有安裝好 MySQL，所以不用特別安裝，只需要打開系統偏好設定，最底下的 MySQL，然後 Start MySQL Server，它左邊的字會變成綠色的 running。

## 安裝資料庫管理程式

Mac 上可以考慮 MySQLWorkbench 或 Sequel Pro，免費版的功能算足夠，cask 上都找得到，不知道怎麼用 cask 安裝的可以參考我的 [這篇文章][0]。

## 載入 MySQL JDBC connector


[0]: https://idontwannarock.github.io/hugo_blog/2017/11/%E6%88%91%E5%9C%A8macbook-pro%E7%9A%84%E8%A8%AD%E7%BD%AE---2017%E7%89%88/#軟體環境設置