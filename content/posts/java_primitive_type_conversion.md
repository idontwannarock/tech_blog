---
title: "Java 基本型態的轉換方式"
slug: "java_primitive_type_conversion"
date: 2018-02-09T10:00:29+08:00
description: "探討 Java 的基本型態間的轉換方式"
tags: ["java", "primitive-type"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1568906236/javase-logo_jayzns.png"
draft: true
comment: true
---

紀錄自己在學習 Java 中歸納的各種資料型態轉換的方式，這篇先探討基本型態的轉換。

# 基本型態

## 基本型態簡介

Java 裡規定了資料的八種基本型態 `boolean`、`char`、`byte`、`short`、`int`、`long`、`float`、`double`。

其中 `boolean` 布林值是一種表示 `true` 真跟 `false` 偽的值，而不是數值，因此是唯一一種無法轉換成其他基本型態的資料。

而 `char` 則是字元，注意在 Java 中，字元跟字串是不一樣的，這部分 Javascript 就很不同，Javascript 中沒有字元字串之分。

然後 `byte`、`short`、`int`、`long` 這四種就是整數型態，預設分別使用 1、2、4、8 個 byte 的空間來儲存其整數值。

最後 `float`、`double` 這兩種是浮點數

## 變數與常數

## 基本型態 -> 基本型態

除了 `boolean` 以外的其他七種型態之間有兩種轉換方式，一種是確認相容之後直接 `=` 轉換，另外一種則是用 `(cast)` 的方式轉換。

而基本型態之間的相容性首先要注意是變數還是常數