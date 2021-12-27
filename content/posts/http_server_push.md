---
title: "HTTP/2 系列 - HTTP Server Push 技術"
date: 2021-12-24T15:49:27+08:00
slug: "http_server_push"
description: "探討建構在 HTTP 協定上的 Server Push 技術"
tags: ["http", "server push", "long polling", "server sent event", "sse", "http2", "websocket"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/c_scale,h_304/v1640335304/Tech%20Blog/http2_server_push.png"
draft: true
comment: true
enableLaTeX: false
---

這篇預計是 gRPC 系列的最後一篇，之前在系列前面已經釐清了 gRPC 跟其立基的 HTTP/2 的概念了，其中我比較有興趣的就是 gRPC 的 server push 新特性，這邊就繼續來了解一下吧~

gRPC 系列:

1. [HTTP/2 系列 - HTTP/2 概念](https://idontwannarock.github.io/tech_blog/2021/12/http2/)
2. HTTP/2 系列 - HTTP Server Push 技術

## HTTP Server Push 技術

首先來探討一下有哪些基於 HTTP 協定的 server push 技術

相對於 request-response 模型必須要一端發出 request 後另一端再對應的發出 response，server push 一般是指不經 client 端發出指定的 request 就由 server 端發出 message 給 client 端

這種技術在某些情況是很有用的，像是需要「即時」更新資料的應用場景，例如比賽分數，當然這可以在 client 端採用定時輪詢 (polling) 的方式來實作，但這樣其實對於 client 端或 server 端都會造成資源的浪費，因為可能大多數請求實際上都沒有需要更新的資料，實際上知道資料有變動的就是 server 端，如果可以由 server 端在資料真正有變動的時候主動通知 client 端，就可以將資料元的浪費降到最低

也因為在許多需要「即時」的情況下由 server 端主動通知 client 端都可以節省大量效能浪費，所以才會一直都有追求 server push 技術的需求存在

### Polling

而在 HTTP 協定制定的過程以來，一直也都有追求利用 HTTP 協定的可靠性以及泛用性下實作 server push 的功能，但 HTTP 一開始就是基於 request-response 模型建構起來的，所以就有比較早期的嘗試例如 polling

Polling 其實就是前面講的 client 端定時發出 request 請求資料更新，以達到類似資料即時更新的效果

![Polling](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640575513/Tech%20Blog/ajax-polling.jpg)

*Image from [stackoverflow](https://stackoverflow.com/a/30259130/7605040)*

### Long Polling

但這樣其實完全不是 server push，而只是頻繁的 request-response 而已，所以後來又有 long polling 的技術出現

long polling 是由 client 發出 request 後，server 可以決定等待到有更新資料後再回傳 response，而 client 在收到 response 後再立刻發出下一次的 request，重複這個過程，以達到類似 server push 的效果

![Long polling](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640576916/Tech%20Blog/long-polling.jpg)

*Image from [stackoverflow](https://stackoverflow.com/a/30259130/7605040)*

但 long polling 其實只是隨時準備好一個 request 給 server 並讓 server hold 住以自行決定何時回傳 response 的技術，實際上還是需要 client 端先發出 request，而且因為需要 hold 住 request 的緣故，要使用 long polling 就必須要另外考量如何處理 timeout 的問題，不過畢竟在效果上已經蠻接近 server push 並且整體來說也的確降低了 request-response 的頻率，達到較好的效能，所以 long polling 技術也的確被使用的蠻長的時間

### Server-sent Event, SSE

也因為 long polling 有著例如 scaling、ordering、guaranteed delivery 等等問題，所以後來又出現了 server-sent events (SSE) 的技術

SSE 實際上也是一種利用 HTTP streaming 來達成類似 server push 效果的技術

首先 client 端利用幾乎各大瀏覽器都有支援的 EventSource API 發出 request 給 server，server 端就可以開啟單向從 server 到 client 端的 streaming，讓 server 可以在任意時間點單向傳送 data 給 client

雖然 EventSource API 的支援度很高，但 SSE 最大的問題其實是它只能單向的從 server 端傳送 data 到 client 端，也就是它會占用一條 TCP connection，這點在瀏覽器對伺服器的通訊中尤其重要，因為現在多數瀏覽器針對同一域名都有限制開啟的 connection 數量，例如 Chrome 就是六條，不論開啟個 tab 都一樣

在一個 SSE 就要佔掉一條 connection 的情況下，萬一 SSE 需要多開幾個，可能到最後 client 端連發新 request 的能力都沒有了

不過這個問題在我們前一篇討論 HTTP/2 特性時，就知道 HTTP/2 有 multiplexing 特性可以讓多個 request/response 共用 connection，而 SSE 完全可以利用 HTTP/2 的這個特性來避開它的弱點，所以 SSE 在 HTTP/2 的時代還是有用武之地的，尤其某些只需要單向更新資訊的應用場景之下

## HTTP Server Push 特性

### 名詞解釋

在討論 HTTP server push 特性之前，我想先來釐清幾個名詞的概念，bidirectional、full-duplex 跟 unsolicited communication

bidirectional 意思是可以雙向的發送 data；相對的 unidirectional 就是只能單向的傳送 data

![Unidirectional and bidirectional communication](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640569881/Tech%20Blog/unidirectional-and-bidirectional-communication.png)

*Image from [ZF](https://switches-sensors.zf.com/energy-harvesting-faqs/what-is-the-difference-between-unidirectional-and-bidirectional-communication/#)*

full-duplex 全雙工的意思是可以雙向「同時」傳送 data，也就是兩端都可以「同時」傳送以及接收 data；相對的還有 half-duplex (semiduplex) 半雙工，也就是容許雙向傳送 data，但不允許同時進行；最後還有相對於 duplex 雙工的 simplex 單工，定義上就是在特定時間底下只能單向傳送 data

> 這邊討論的最多只到 Transport Layer 的邏輯傳輸，並不是討論 Data Link Layer 的傳輸，所以不討論分時雙工 (Time-Division Duplexing, TDD) 或分頻雙工 (Frequency-Division Duplexing, FDD)

![Simplex, half-duplex and full-duplex](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640570115/Tech%20Blog/simplex-half-duplex-full-duplex.jpg)

*Image from [G-NiceRF](https://www.nicerf.com/articles/detail/single-and-duplex-wireless-module.html)*

再來是 unsolicited communication，在網路通訊來說，就是指可以不經對方 request 就主動發出 message 給對方，或者說發出的 message 不是為了回覆對方某一個 request；相對應的就是基本的 request-response 模型

### HTTP Server Push 通訊特性

經過名詞解釋後，就可以來討論 HTTP 的通訊特性了

因為 HTTP/2 有著 multiplexing 特性，所以 HTTP/2 的確是 bidirectional 且 full-duplex 的，只是我認為它基本上仍然還是遵循 request-response 模型，而不能達到真正 bidirectional 的 unsolicited communication

一方面是就算是像 gRPC 的 bidirectional streaming RPC 的用法，實際上也只是在同一個 request-response 的 context 底下，畢竟沒有 client 首先呼叫的這個步驟，server 端根本無法自行發出任何訊息，就算是 connection 已經建立好也一樣

另一方面則是有關 HTTP/2 的 server push 特性，實際上也是必須依賴 client 端首先發出一個 request，雖然 server 之後可以主動推送 client 端沒有請求的資源到 client 端的 cache 當中，但畢竟還是必須首先有 client 發出的那一個 request

所以雖然沒看到有哪邊有這部分的定義，但我個人認為實際上 HTTP/2 並不能做到真正的 bidirectional uncolicited communication

順便談一下，HTTP/1.x 是 bidirectional 這沒問題，但應該很多人不知道其實 HTTP/1.x 也是 full-duplex 吧？

實際上雖然 HTTP/1.x 一般的 request-response 還是 half-duplex，也就是收到 request 後再回覆 response，同時間一個 TCP connection 只會有 request 或 response，不過事實上因為 request 可以 streaming，server 端完全可以在 request streaming 還沒結束就同樣開啟 streaming 回傳給 client，達到同時上傳/下載的功能，也就是 full-duplex

另外如同前面討論過的不論是 polling、long polling 或 SSE 都還是 request-response 模型，所以我認為實際上目前包含 HTTP/2 及 HTTP/1.x 都是 bidirectional、full-duplex，但也都無法達成 bidirectional unsolicited communication，也就是都只能模擬出 server push 的效果，而不能達到真正的 server push 功能

不過這點只是需要知道就好，畢竟我們不見得需要真正的 server push，只要能達成效果就好，除非有特別的應用場景

真的要達到 bidirectional、full-duplex、unsolicited communication，應該還是要考慮 WebSocket 或 WebRTC 這類的技術

> WebSocket 雖然一開始是利用 HTTP 建立連線，但同時也會「升級」成為別的通訊協定，所以這邊並不把 WebSocket 列入基於 HTTP 的技術來討論

## 參考連結

- [Simplex communication](https://en.wikipedia.org/wiki/Simplex_communication)
- [Duplex (telecommunications)](https://en.wikipedia.org/wiki/Duplex_(telecommunications))
- [full-duplex](https://www.techtarget.com/searchnetworking/definition/full-duplex)
- [confusion regarding bidirectional and full-duplex in articles about http/2](https://stackoverflow.com/a/54942254/7605040)
- [Difference between a normal ajax and long polling](https://stackoverflow.com/questions/30252471/difference-between-a-normal-ajax-and-long-polling)
- [Question about socket programming for solicited and unsolicited traffic](https://www.linuxquestions.org/questions/linux-server-73/question-about-socket-programming-for-solicited-and-unsolicited-traffic-4175583350/)
- [Do you really need WebSockets?](https://stanko.io/do-you-really-need-websockets-343aed40aa9b)
- [WebSockets protocol vs HTTP](https://stackoverflow.com/a/14711517/7605040)
- [What are Long-Polling, Websockets, Server-Sent Events (SSE) and Comet?](https://stackoverflow.com/a/12855533/7605040)
- [How do server-sent events actually work?](https://stackoverflow.com/a/11998868/7605040)
- [What is the difference between HTTP streaming and server sent events?](https://stackoverflow.com/a/42560354/7605040)
- [Will WebSocket survive HTTP/2?](https://www.infoq.com/articles/websocket-and-http2-coexist/)
