---
title: "Java 有關時間的物件、方法"
slug: "java_date_time"
date: 2017-11-18T15:44:37+08:00
description: "紀錄 Java 中有關時間的物件及方法"
tags: ["java", "date"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1568906236/Tech%20Blog/javase-logo_jayzns.png"
draft: true
comment: true
---

紀錄 Java 內較常用跟時間有關的物件、方法。

# 時間物件、方法簡述

## `System.currentTimeMillis()`

`System.currentTimeMillis()` 方法會傳回系統時間，是取從 1970.1.1 的 0 時 0 分 0 秒開始以來的毫秒總數，型態為 long。

## `java.util.Date` 物件

預設建構子是用 `currentTimeMillis()` 取出的毫秒，但顯示為 `www MMM dd hh:mm:ss TTT yyyy`；也可在建構子中輸入long型態參數，`Date` 類別物件會將 long 型態參數視為毫秒總數作轉換。

## `java.sql.Date` 物件

建構子會要求提供 long 型態的參數，顯示為 `yyyy-MM-dd`。

## `java.util.Calendar`

注意 `Calendar` 類別本身是 `abstract` 抽象類別，不可直接用建構子建構物件，必須間接的用它提供的靜態方法或靜態變數來取時間的值。

### `Calendar` 類別靜態變數

比較重要的靜態變數有

### `java.util.GregorianCalendar`

## `java.text.SimpleDateFormat`

# 比較

`System.currentTimeMillis()` 方法，跟 `Date d = new Date()` (預設建構子) 後用 `Date` 類別物件的 `getTime()` 方法取出的值是一樣的 long 數值。

# 轉換