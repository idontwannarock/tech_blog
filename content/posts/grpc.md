---
title: "gRPC 系列 - gRPC 概念"
date: 2021-12-24T16:44:31+08:00
slug: "grpc"
description: "釐清 gRPC 概念"
tags: ["grpc", "http2"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/c_scale,h_315/v1640335954/Tech%20Blog/grpc-icon.png"
draft: false
comment: true
enableLaTeX: false
---

在上一篇大略了解 HTTP/2 的概念後，就可以來了解 gRPC 的運作概念了

嗄？你說 gRPC 的另外一個支柱 Protocol Buffer (ProtoBuf)？這個我暫時沒打算要理解它的演算法細節，大概知道他是一種跨平台、跨語言的「可擴展的序列化資料結構」，就是類似 XML 或是 JSON 那樣的資料結構，只是設計的體積更小、傳輸更快，我暫時理解到這邊就夠了

gRPC 系列:

1. [gRPC 系列 - HTTP/2 概念](https://idontwannarock.github.io/tech_blog/2021/12/http2/)
2. gRPC 系列 - gRPC 概念
3. gRPC 系列 - HTTP Server Push 技術

## 概念

gRPC 原本是 Google 內部的 RPC 系統，後來開源後，近年成為很熱門的 RPC 系統，採用 HTTP/2 做傳輸，ProtoBuf 作為介面描述語言 (interface description language)，提供身分驗證 (authentication)、雙向串流 (bidirectional streaming)、流量控制 (flow control)、阻塞或非阻塞綁定 (blocking or nonblocking binding)、取消 (cancellation) 及逾時 (timeouts) 等特性

> RPC Remote Procedure Call 遠端程序呼叫指服務之間互相溝通就如同呼叫本地程式一般，不須關注呼叫互動的細節。例如以前的 CORBA, Java RMI 等

### 使用 gRPC API

主要是透過 .proto 檔定義 service 結構，再透過 ProtoBuf compiler 的幫助產生各語言的 client/server 端代碼

- client 端會有一個本地物件 stub 實作 service 中相同的方法，讓 client 端可以直接呼叫該本地物件的方法，gRPC 會處理發出 request 以及從 server 端的 ProtoBuf response
- server 端會真正實作 service 中宣告的方法，並運行 gRPC server 來處理 client 端的呼叫，gRPC infra 會將 request 解碼，執行 service 方法，再將 service response 編碼

![gRPC 呼叫關係](https://res.cloudinary.com/dcvgho2zc/image/upload/c_scale,h_304/v1640339739/Tech%20Blog/grpc-call.png)

*Image from [gRPC Official Documentation](https://grpc.io/docs/what-is-grpc/introduction/)*

### 同步 vs 非同步

同步 RPC 呼叫會阻塞直到獲得回應，這是最接近 RPC 希望模仿的 procedure call 的抽象，但從另一方面來說，網路天生就是非同步的，而且在很多場景下觸發不會阻塞當下 thread 的 RPC 是很有用的

gRPC 在大部分語言的 API 都有同步及非同步的版本

### 四種類型的 Service

在 gRPC 中可以定義四種類型的 service

> 就是定義在 ProtoBuf 的 .proto 檔

- Unary RPC: 如同一般 function call 一樣，client 端發出一個 request，server 收到後回覆一個 response
- Server streaming RPC: client 端發出一個 request 並取得一個 stream 來讀取 server 回傳的一系列 messages
- Client streaming RPC: client 端發出一系列 messages 給 server 並等待 server 完整讀取後回覆一個 response
- Bidirectional streaming RPC: 在 client 端呼叫 service 方法建立好跟 server 之間的 connection 後，兩端都可以以任意順序、時間發送一系列 messages 給對方

### RPC 生命週期

#### Unary RPC

這是最簡單的類型，client 發出單一的 request，然後 server 端回覆單一的 response

1. client 呼叫 stub 方法，client 會立即發出 client 端的 metatdata 通知 server 端該方法被觸發
2. server 端可以立即回覆自己的初始 metadata (metadata 必須在任何 response 之前傳送) 或等待 client 端的 request message。實際上哪個先發生要看應用
3. 一旦 server 端獲得 request message 後就開始執行該做的邏輯以產生 response，然後 response 就會連同 status details (status code 及可能的 status message) 及可能的隨附的 metadata 回覆給 client
4. 如果 response status 為 OK，client 就會取得 response，在 client 端結束整個呼叫

#### Server streaming RPC

基本跟 Unary RPC 類似，除了 server 端會對應 client 的 request 回覆一系列的 messages，在發送完所有 messages 後，server 端才會回覆 status details 及可選的 metadata 給 client

#### Client streaming RPC

基本也跟 Unary RPC 類似，除了 client 端會發送一系列的 messages，然後 server 端回覆單一的 response，通常會在 server 端接收到 client 端所有的 messages 之後，但並非必要

#### Bidirectional streaming RPC

與 Unary RPC 前兩個步驟相同，只是 client 端及 server 端都可以隨時以任意順序發送一系列的 message 給對方

## 參考連結

- [Core concepts, architecture and lifecycle](https://www.grpc.io/docs/what-is-grpc/core-concepts/)
- [gRPC: A Deep Dive into the Communication Pattern](https://thenewstack.io/grpc-a-deep-dive-into-the-communication-pattern/)
- [gRPC Up and Running](https://www.oreilly.com/library/view/grpc-up-and/9781492058328/)
