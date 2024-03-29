---
title: "HTTP/2 系列 - HTTP/2 概念"
date: 2021-12-21T09:06:29+08:00
slug: "http2"
description: "釐清 HTTP/2 概念"
tags: ["http", "http2", "http3", "tcp", "udp", "quic"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1639532467/Tech%20Blog/http2.png"
draft: false
comment: true
enableLaTeX: false
---

從 2015 年 RFC 7540 正式發表後，至今 HTTP/2 已經被絕大多數主流瀏覽器所支援，並且是正當紅的 gRPC 的基礎，在研究 gPRC 之前，先來釐清一下 HTTP/2 的概念

這篇是 HTTP/2 系列文章的第一篇:

1. HTTP/2 系列 - HTTP/2 概念
2. [HTTP/2 系列 - HTTP Server Push 技術]({{< relref "http_server_push" >}})

不過，我其實只想研究我想研究的部分，所以不見得會把 HTTP/2 所有相關的內容都研究一遍

## 從遠古 HTTP/1.0 開始

HTTP 是定義在 OSI 模型第七層 Application Layer 網路協議，HTTP/1.0 採取先進先出 (first-in first-out, FIFO) 策略，每次請求/回應都是有序的，必須等到請求收到對應回應後，才能進行下一次請求

HTTP 在 Transport Layer 採用 TCP 連線來通訊，而 TCP 要在 client/server 之間建立連線，是靠著三向交握 (three-way handshake) 來完成；而傳輸完成要斷線時則要做四次握手 (four-way handshake)。如果還有 TLS，那握手的來回通訊次數 (round-trip time, RTT) 就更多次了

而在最初的 HTTP/1.0 的年代，硬體普遍效能都不高，為了提高系統的效率，所以 HTTP/1.0 規定 client/server 只能保持短暫的連線，所以 client 每次請求最少都要經過三向交握建立 TCP 連線，而 server 完成該請求的處理後也必須立刻進行四次握手斷開連線

這樣的作法節省了 server 端的效能，但這同樣也會造成一些其他效能上的問題，例如當網頁元素越來越多的時候，即使每個元素都不大，但 client/server 每個元素都還是要重新建立連線，不但費時，而且同樣會影響 client/server 的效能

而且 TCP 為了避免網路阻塞，有慢啟動 (**slow start**) 的控制，所以同樣連線的傳輸速率會依照演算法隨著時間而增加直到出現遺失包、達到慢啟動閾值 (ssthresh)、或者接收方的接收窗口進行限制為止

大量建立連線的動作在高延遲的網路環境下對效率影響明顯，慢啟動則對大檔案請求影響較大。這兩點主要都是連線不能複用所造成

為了克服連線不能複用的問題，當時有些伺服器跟瀏覽器有實作 **keep-alive** 機制如圖，但必須自行在 header 中帶上 `Connection: Keep-Alive`

![Multiple Connection vs Persistent Conneciton](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639979286/Tech%20Blog/persistent-connection.jpg)

*Image from [Wiki](https://en.wikipedia.org/wiki/HTTP_persistent_connection)*

## 進化到 HTTP/1.1

HTTP/1.1 開始預設就支援持久連線 (**keep-alive**) 機制，允許在同一條 TCP 連線上多次進行 request/response，雖然還是必須保持收到 response 後才能發出下一次 request 的順序，但仍然降低了大量建立連線的效能損耗

除此之外 HTTP/1.1 還設計了 **pipelining** 機制，讓同一條 TCP 連線中，client 端可以在還未收到上次 request 的 response 時，就發出下一次 request，但 server 端仍然必須按照接收到 client 端 request 的順序返回 response，但仍然有機會進一步降低多請求的反應時間

![HTTP pipelining](https://res.cloudinary.com/dcvgho2zc/image/upload/c_scale,h_309/v1639969180/Tech%20Blog/pipelining.png)

*Image from [Head-of-line (HOL) blocking in HTTP/1 and HTTP/2](https://abhishekvrshny.medium.com/head-of-line-hol-blocking-in-http-1-and-http-2-50b24e9e3372)*

HTTP/1.1 在繼承了 HTTP/1.0 的優點的同時，也很好的解決了 TCP 連線不能複用的問題

BUT，人生就是這個 BUT

即使有了 keep-alive 跟 pipelining 的機制，HTTP/1.1 仍然有 **Head-of-line Blocking** (HOL Blocking) 問題

因為 pipelining 要求在同一個 TCP 連線中

- 前一個 request 發送成功後 client 才能發出下一個
- 前一個 response 被 client 收到後 server 才能發出下一個 response
- 每個 response 也必須依序處理

因此當連線網路不穩定時，request 或 response 容易傳送失敗，造成在同一條 TCP 連線上的後續 request 或 response 被阻塞；或者某一個 request 或 response 內容較大，也會造成連線被阻塞，這就是 HTTP/1.x 的 HOL Blocking 問題

另外這種機制還容易造成瀏覽器實作上的 bug，尤其是當連線中間還有代理存在時更容易出錯

也是因為這個問題，現今大部分瀏覽器並不支援 pipeline 機制，或預設被關閉，例如 Chrome 曾經支援但現已停止、Mozilla 預設關閉、IE11 不支援等等

另外，HTTP/1.1 的 HOL Blocking 問題是 Application Layer 層的問題，不是 Transport Layer 因為 TCP congestion control 造成的 HOL Blocking 問題

> TCP 的 HOL Blocking 是指因為一個 packet 遺失，導致後續的 packet 必須等到該 packet 重新傳輸並接收到後才能繼續傳送的問題

## 終於要講到 HTTP/2

HTTP/1.1 固然是一個劃時代的結晶，直到今日還是瀏覽器主要使用的通訊協議之一，但在大環境的變化以致對於通訊協議的需求也有變化的今日，還是有它的侷限在

於是經過許多人的努力，HTTP/2 誕生了

在維持 HTTP/1.1 語意上不變的前提，HTTP/2 主要有以下特點

- Binary protocol
- Multiplexing
- Stream prioritization
- Header compression
- Server push

基本上，HTTP/2 出現的目的就是為了解決 HTTP/1.x 的效能問題

### HTTP/2 New Feature

#### Binary Protocol

首先 HTTP/2 改變了 HTTP/1.x 的傳輸機制，在 Application Layer 跟 Session Layer 或 Transport Layer 間插入 Binary Framing Layer 如下圖

![Binary Framing Layer](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639984557/Tech%20Blog/binary-framing.png)

*Image from [grpc.io](https://grpc.io/docs/what-is-grpc/introduction/)*

更白話一點就是將封包結構從文本格式改為二進制格式，並且將所有傳輸訊息分隔為更小的 message 跟 frame 在 stream 裡面傳輸

- frame 則是所有傳輸訊息 (包含 header) 切分後的最小單位。每個 frame 都會帶有一種 data，所以要馬是 HEADER frame 要馬是 DATA frame。另外每一個 frame 都會帶有 frame header 來標識其所屬的 stream
- message 就是一系列的 frame 組合成，對應邏輯上的 request 或 response
- stream 就是在一個 TCP connection 中雙向且抽象的 bytes flow，一個 stream 可以傳遞一個或多個 message。一個 TCP connection 可以有任意數量的 stream

首先 **為什麼要改成二進制？** 是為了提升解析訊息的速度

在 HTTP/1.x 的時代，光解析訊息就有四種方法，但在 HTTP/2，因為訊息都是 binary 所以只需要一種方法就可以通用的解析所有訊息

接下來， **為什麼要切分訊息？** 是為了提升連線的傳輸利用率

HTTP/1.x 的時候傳輸訊息雖然也可以被切成 chunk 來傳輸，但因為沒有 stream 的概念，所以不等同一 request/response 所有的 chunk 傳送完畢，是不能傳送下一個，否則無法識別該 chunk 屬於哪一個 request/reponse

而在 HTTP/2 因為傳輸訊息都被切成 frame 並且可以識別屬於哪一個 stream，所以可以交錯且雙向的發出，也就引出下一個特性

#### Multiplexing

基於 Binary Protocol 的機制，HTTP/2 允許 client 透過同一個 TCP connection 同步發送多個 request 給 server，而 server 也能透過同一個 TCP connection 同步回傳，減少額外的 RTT，並且因為每個 frame 都能識別屬於哪一個 stream，所以不需要依照收到的順序回覆，而可以交錯的回傳 frame，client 端會依照 frame 本身攜帶的 stream header 組裝相關的 frame

> multiplexing 多路複用通常表示在一個頻道上傳輸多路訊號或資料流的過程和技術

以 stream 的角度來看，因為每條 stream 在同一時間只會容納一個 request 以及對應的一系列 response，所以 stream 並不能達成 multiplexing

![HTTP/2 Stream](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639989101/Tech%20Blog/stream.png)

*Image from [How Does HTTP/2 Work?](https://sookocheff.com/post/networking/how-does-http-2-work/)*

但 TCP connection 實際上可以容納多條 stream，所以同一條 TCP connection 是可以達成 multiplexing 的

![HTTP/2 Multiplexing](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639989278/Tech%20Blog/multiplexing.png)

*Image from [How is HTTP/1.1 different from HTTP/2?](https://freecontent.manning.com/mental-model-graphic-how-is-http-1-1-different-from-http-2/)*

也就是說 HTTP/2 並不需要在同一 TCP connection 上等待前一個 request 或 response 完成，就可以發送下一個 request 或 response，因此解決了 HTTP/1.x 的 HOL Blocking 問題，並且也因此真正達到只需要在 client/server 之間建立一條 TCP connection 即可完成所有通訊，也大幅降低 server 端為了對不同 client 維持多條連線的效能損耗

#### Stream Prioritization

即使 HTTP/2 已經透過 multiplexing 大大提升連線傳輸效率，但在現今網頁可能動輒上百個不同的元素需要分別下載的環境下，但畢竟頻寬還是有限的，而且 TCP 連線初始的 slow start 仍然存在，意味著除非有 cache，否則網頁剛載入的速度仍然是有限的，而不見得網頁每一個元素都有立即下載的急迫性，或者有些元素下載是有相依性的

所以 HTTP/2 提供在 stream 標記相依關係 (dependency) 及權重 (weight) 的機制，之後 HTTP/2 會自行處理以滿足條件

![Stream Prioritization](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639990493/Tech%20Blog/stream-prioritization.png)

Image from [Http2特性——Binary framing layer--push---HPACK](https://www.twblogs.net/a/5eec25f11f92b2f1a17cc4aa)

#### Header Compression

另外在 HTTP/1.1 中，因為要支援許多擴充功能，所以在 header 中加了許多特性，造成傳輸上的 overhead

但在實際應用上，例如同一個網頁的 request 雖然很多，但 header 可能都長得 87 趴像，但是每次都還是要傳輸一樣的 header 就造成重複浪費

所以在 HTTP/2 中就針對 header 採用 HPACK 演算法做壓縮，原理大致上就是

- 將 header 區分靜態字典 (static table) 及動態字典 (dynamic table)
- static table 就是一些常見的 header 表
- dynamic table 則是依據 FIFO 原則動態添加內容的表
- client/server 都支援依據 RFC 7541 的 Appendix B 所列的霍夫曼編碼表 (Huffman Code) 來對 header 進行編碼

![HPACK Header Compression](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639991899/Tech%20Blog/hpack.png)

*Image from [为 HTTP/2 头压缩专门设计的 HPACK](https://www.cnblogs.com/ghj1976/p/4586529.html)*

#### Server Push

為了達成 server 端主動推送訊息給 client 端，一直以來都有各種嘗試在 HTTP 上達成類似的效果，包括 Polling, Long Polling, Server Sent Event(SSE) 等等，但實際上除了 WebSocket 有利用到 HTTP 建立連線這種沾到邊的協定以外，其他透過 HTTP 的傳送訊息的方式都不能真正做到兩端不經請求主動推送訊息給對方 (bidirectional unsolicited communication)，**包括 HTTP/2 也沒有達成**

> - Polling 是在 client 端設 timer 輪詢，以達到近似 server 端有準備好的資料就可以隨時推送到 client 端的效果
> - Long Polling 則是維持 request 直到 server 端準備好後送出 response，client 端收到後再立刻發出 request 等待下一次 server 端的 response，以達成類似 server 端隨時推送 response 的效果
> - SSE 則是利用 HTTP event-stream 讓 server 端可以針對同一個 request 多次回覆 response，來達成類似 server 端主動 push 的效果

實際上 HTTP/2 的 server push 在效果上等同 SSE，讓 server 端可以針對一個 request 進行多次的 response

由於不像 SSE 會占用一整個 TCP connection，HTTP/2 的一個 request 的 context 只佔用一個 stream，而不影響其他 stream，所以並不會阻塞其他 request/response，所以在許多應用情況下，這樣的 server push 已經跟真正不依賴 client request 而進行主動 server push 的效果相差無幾

![HTTP/2 Server Push](https://res.cloudinary.com/dcvgho2zc/image/upload/v1639994509/Tech%20Blog/server-push.webp)

*Image from [High Performance with HTTP / 2 PUSH](https://www.medianova.com/en-blog/high-performance-with-http-2-push/)*

### HTTP/2 Problem

HTTP/2 就如同曾經的 HTTP/1.1 一樣，繼承了前一代的優點，並更進一步優化了效能，但同樣也少不了一些問題，有些爭議在協商階段就已浮現，例如有關加密跟 HOL Blocking 等問題

#### Mandate TLS Encryption

其實在協商過程就已經針對這代協定是否要強制 TLS 加密有過爭論，因為加密連線畢竟在效能上有所損耗，而有些應用場景並不需要使用加密連線，甚至有些場景不適合使用 TLS 加密方式，例如在許多小型裝置上的通訊，並不適合使用 TLS 加密，因為 TLS 憑證需要定時更新，而小型裝置更新不便且數量眾多，因此並不適合使用該加密方式

因此實際上最終 HTTP/2 的協定並沒有強制要求實作 TLS 加密

BUT，又是這個 BUT

其實許多主流瀏覽器實際上都只實作了基於 TLS 的 HTTP/2，因而成為事實上 (de facto) 的標準

#### Opportunistic Encryption

另外還有被批評未能支援機會性加密 (opportunistic encryption)，類似 SMTP 常用的 STARTTLS，主要用來防禦被動監聽 (passive monitoring)

> 被動監聽就是利用複製網路流量來取得通訊訊息的手法，例如 wireshark 擷取封包。但其實被動監聽並不一定都用來攻擊，也常被用做 trouble shooting 的手段

機會性加密不像 TLS 加密涉及到身分認證、金鑰管理並需要事先設定組態，否則無法開始安全通訊，因此變成要馬「完全安全」要馬「完全不安全」；機會性加密則不進行身分驗證，在建立連接時，如果對方也支援加密連接時才開始進行加密請求，如果加密請求失敗，則退回到明文

雖然機會性加密無法防禦主動攻擊 (例如中間人攻擊)，也不能替代完整的加密方案，但其主要用意就是在條件允許時就盡可能使用加密通訊

> 中間人攻擊就是類似同時對 client 偽造 server、對 server 偽造 client，並交換其所收到的資料，使兩端都認為它們正通過一個私密的連接與對方直接對話

並且因為 IETF 制定的 RFC 7528 Best Current Practive 188 中指出，被動監聽應被當作一種攻擊，而 IETF 制定的標準應採取抵禦被動監聽的手段，因此 HTTP/2 也被批評違反 IETF 自身制定的準則

#### TCP HOL Blocking

前面有提到 HTTP/2 解決了 Application Layer 的 HOL Blocking 問題，但並沒有處理 Transport Layer 的 TCP Blocking 問題

TCP 作為一個 Transport Layer 的協定，其特點就是可靠的傳輸，而且同樣也是有序的，所以在一系列有序的 packet 傳輸過程中，只要其中一個 packet 因為某種原因傳輸失敗需要重新傳輸或尚未收到，就會導致後續 packet 只能等待前面的 packet 完成傳輸，而形成 TCP HOL Blocking 問題

![TCP HOL Blocking](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640057331/Tech%20Blog/tcp-hol-blocking.png)

*Image from [HTTP/3 deep dive](https://medium.com/ably-realtime/http-3-deep-dive-9318f7d6834d)*

而因為 HTTP/2 仍然是基於 TCP 的協定，所以同樣受到 TCP HOL Blocking 問題的影響，即使在單一 TCP connection 用上 multiplexing，但仍可能因為 packet loss 而導致整條 TCP connection 的所有 stream 被阻塞

## What's Next?

對於 TCP HOL Blocking 問題的處理，因為 TCP 已經是廣泛使用的協定，要直接對 TCP 做修改影響太大，所以就產生 QUIC (Quick UDP Internet Connections) 這個也是 Transport Layer 的協定直接避開 TCP HOL Blocking 問題，並且更適合在現今移動端的環境使用

QUIC 從名稱就看的出來是基於 UDP 這個同樣也是 Transport Layer 協定而制定出來協定，它的主要目標就在提供幾乎等同於 TCP 的可靠性，但同時減少延遲

首先是簡化建立連線期間的握手，將多個步驟整合，這就大大降低了建立連線的成本

![QUIC HTTPS handshake](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640057493/Tech%20Blog/quic-https-handshake.gif)

*Image from [Google Cloud](https://cloud.google.com/blog/products/gcp/introducing-quic-support-https-load-balancing)*

接著使用 UDP 傳輸，但為了達成接近 TCP 的可靠性，選擇在 QUIC 層級進行資料糾錯恢復的控制，QUIC 在修復單一 stream 時仍可以自由處理其他資料，所以即使單一請求發生錯誤也不會影響到其他請求

QUIC 還有一個目標是提高切換網路期間的效能，這點在移動端環境非常重要，例如我們手機常常在 WiFi 跟行動網路之間切換，如果在 TCP 上發生了，首先需要等待現有連接一個一個逾時，然後再根據需要重新建立，這中間的延遲就高了。而 QUIC 會包含一個連接識別碼 Connection ID，用來標識 client/server 之間的連接，而不論 IP 位址，如此只需要傳送一個包含此 Connection ID 的 packet 即可重新建立連接

因為有著這些更符合現今網路環境的優點，所以 HTTP-over-QUIC 也已被正式提出要求更名為 HTTP/3，雖然仍還只是 Internet Draft，但已經被超過七成的瀏覽器所支援或實作，包括 Chrome, Edge, Firefox, Safari 14 等

HTTP/3 同樣在語意上繼承 HTTP/2，不過 HTTP/2 並不能直接與 QUIC 兼容，因為 HTTP/2 在 Application Layer 的 frame 與 QUIC 在 Transport Layer 切分的 packet 不能直接映射，而且 QUIC 已經在 Transport Layer 處理了 multiplexing，所以不需要 HTTP/2 在 Application Layer 再處理一次

![TCP vs QUIC](https://res.cloudinary.com/dcvgho2zc/image/upload/v1640057950/Tech%20Blog/TCP-vs-QUIC-Basic-Diagram.png)

*Image from [Google’s QUIC protocol: moving the web from TCP to UDP](https://ma.ttias.be/googles-quic-protocol-moving-web-tcp-udp/)*

## 參考連結

- [HTTP/2 Wiki](https://en.wikipedia.org/wiki/HTTP/2)
- [HTTP／1.0／1.1／2.0的區別以及http和https的區別](https://codertw.com/%E7%A8%8B%E5%BC%8F%E8%AA%9E%E8%A8%80/496897/)
- [TCP congestion control](https://en.wikipedia.org/wiki/TCP_congestion_control)
- [HTTP pipelining](https://en.wikipedia.org/wiki/HTTP_pipelining)
- [Why is pipelining disabled in modern browsers?](https://stackoverflow.com/a/40688337/7605040)
- [Head-of-line blocking](https://en.wikipedia.org/wiki/Head-of-line_blocking)
- [Head-of-line (HOL) blocking in HTTP/1 and HTTP/2](https://abhishekvrshny.medium.com/head-of-line-hol-blocking-in-http-1-and-http-2-50b24e9e3372)
- [How Does HTTP/2 Work?](https://sookocheff.com/post/networking/how-does-http-2-work/)
- [RFC-7541](https://datatracker.ietf.org/doc/html/rfc7541)
- [Best current practice](https://en.wikipedia.org/wiki/Best_current_practice)
- [HTTP/2 Server Push](https://en.wikipedia.org/wiki/HTTP/2_Server_Push)
- [HTTP/3 Wiki](https://en.wikipedia.org/wiki/HTTP/3)
- [HTTP/2 in Action](https://livebook.manning.com/book/http2-in-action)
