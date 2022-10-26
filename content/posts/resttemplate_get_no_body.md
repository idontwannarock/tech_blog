---
title: "RestTemplate 做 GET 請求無法帶 Request Body"
date: 2022-10-26T21:30:34+08:00
slug: "resttemplate_get_no_body"
description: ""
tags: ["java", "resttemplate", "httpget"]
categories: "implementation"
featured_image: ""
draft: true
comment: true
enableLaTeX: false
---

最近正好在協助整理專案中呼叫第三方 HTTP API 的部分，剛做到將用各種方式發出 request 的部分通通改為簡單的 `RestTemplate` 去做，加上套用泛型，讓呼叫的邏輯可以集中共用，且有一致的錯誤處理方式以及 log 紀錄

結果碰到一個問題，有一支第三方的 API 要求要用 GET 請求，但需要提供的 UUID 竟然要求放在 request body 裡面，更不巧的是我實際用 `RestTemplate` 發出的 GET 請求還真的沒有帶上我提供的 request body

那只好來研究怎麼解決這個問題

## GET with Request Body

首先我們先來看看 GET 請求是否可以有 request body

一般來說，我直覺就是認為 GET 請求當然不能有 request body，有什麼需要的參數就應該以 query string 形式放在 URL 後面才對，因為 GET 請求常被拿來 cache 或甚至當書籤，有 body 還搞屁？

但實際上 RFC 文件裡面並沒有特意規定 GET 請求是否可以有 request body，只是要注意實作是否接受而已

> A payload within a GET request message has no defined semantics; sending a payload body on a GET request might cause some existing implementations to reject the request.

## `RestTemplate` 實作

既然 RFC 都說要看實作了，那就來稍微研究一下 Spring Boot 提供的 `RestTemplate` 是怎麼實作這部分的



## 參考

- [RFC 7231 4.3.1](https://datatracker.ietf.org/doc/html/rfc7231#section-4.3.1)
- [Spring Boot RestTemplate: test GET request with JSON body is not working](https://marco.dev/spring-boot-test-get-body)
- [Get requests with a request body: Spring RestTemplate vs Apache HttpClient](https://mekaso.rocks/get-requests-with-a-request-body-spring-resttemplate-vs-apache-httpclient)
