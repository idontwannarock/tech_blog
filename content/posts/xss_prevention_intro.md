---
title: "XSS 防範簡介"
date: 2022-11-01T14:00:26+08:00
slug: "xss_prevention_intro"
description: "介紹 XSS 攻擊及簡單防範概念"
tags: ["xss", "owasp"]
categories: "concept"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

XSS 系列：

1. XSS 防範簡介
2. [Spring Boot 後端實作 XSS 防範]({{< relref "xss_prevention_spring_boot" >}})

跨網站指令碼 Cross-site Scripting, XSS，是一種代碼注入的攻擊，讓攻擊者在網頁上注入代碼，而其他使用者在觀看網頁的時候就會受到影響。

## 攻擊模式

以電商系統舉例，例如管理後台網頁表單的商品描述輸入欄位 Input 在沒有進行相對應防範的前提下，攻擊者可以藉由輸入 `<script>alert(document.cookie)</script>` 這段內容，並透過 API 保存到資料庫，如此一來下次其他使用者在瀏覽該商品的時候，也同樣從後端取得資料庫中的這段描述內容，並且顯示在網頁上，則使用者在載入網頁的時候，瀏覽器就可能會跳出彈窗並把使用者當下的 cookie 直接顯示出來。

當然實際的攻擊不會只有跳出彈窗並印出資料這麼簡單，可能是竊取 cookie 或任何 JavaScript 可以存取的敏感資料、側錄使用者行為，或跳轉惡意網址等等行為。

當然注入的代碼也不僅限於 JavaScript，也可以是 Java、VBScript 等，甚至是普通的 HTML。

## 跟 CSRF 的區別

另一種常搞混的攻擊是跨站請求偽造 Cross-site Request Forgery, CSRF，是一種挾制使用者在當前已登入的 Web 應用程式上執行非本意的操作的攻擊方法。

例如使用者可能使用某網路銀行做轉帳，當使用者不小心存取到惡意的網址，就可能因為瀏覽器中之前登錄該網路銀行的登錄資訊尚未過期，所以被存取的網路銀行因為信任瀏覽器保存的登錄資訊，而認為是真正的使用者在進行操作而去執行某些動作。

跟 XSS 相比，XSS 利用的是「**使用者對指定網站的信任**」，CSRF 利用的則是「**網站對使用者網頁瀏覽器的信任**」。

## 防範措施

[OWASP 網站](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) 有提出一些基本的防範措施，但要能真正達到成效，是需要多種手段結合、前後端合作才能達到。並且攻擊手段常常是並用，所以採取防範措施的時候，也要考慮並防範其他種攻擊手段。

### Output Encoding

這部分首先會需要了解使用的 Web Framework 的安全措施跟限制在哪。

例如 React 預設會對 render 內容進行跳脫處理 (escape)，將所有的資料都視為文字字串，等同使用原生的 `textContent`；但有些時候我們就是需要 React 將內容也 render 成 HTML，因此需要使用 `dangerouslySetInnerHTML` 來做 render，那可能就沒辦法依靠框架預設的方式去阻止 XSS，而是要使用其他手段來做處理。

而 React 這種預設對 render 內容作跳脫處理就是一種 Output Encoding 的手法。而跳脫處理並不僅是針對 HTML 內容，也會需要對 HTML 屬性 (Attribute)、JavaScript、CSS、URL 或其他惠可能會造成危險的部分進行處理。

這種手法可能前後端都可以做、也都需要做，但也同樣需要前後端互相的配合，以免處理之後，反而網頁的顯示不如預期。

### HTML Sanitization

在前一段我們有說到一種情況，就是需要將某些內容 render 成 HTML 來做顯示，例如可能網頁有提供簡單的編輯功能，而編輯的內容可能不只是純文字，例如可能會要標記某段文字粗體，或甚至插入圖片等等；因此需要利用 tag 來標註某些特性，而且之後也需要將 tag 正確 render 成 HTML 以做顯示。

在這種情況下如果採用 encoding 的方式，則很可能造成畫面顯示不如預期，但如果如實保存內容，又可能會產生 XSS 漏洞。

此時可以採取另一種方式叫做 HTML Sanitization，也就是對可疑的內容進行移除，只留下安全的內容，這部分通常有黑名單跟白名單兩種做法。

黑名單就是過濾某些不允許的元素或性質，例如只是靜態文字圖片顯示，所以不允許內容包含 `<script>` 標籤；白名單相對就是只留下某些允許的元素或內容，例如雖然允許 `<img>` 標籤做圖片插入，但 `<img>` 標籤的屬性只允許 href 等等，並且此時也要結合 Output Encoding 方法對 href 內容作跳脫處理等等。

但因為大家需求不同的因素，不論是白名單還是黑名單都會需要依照需求確認來做調整，以避免不該擋的擋掉，該擋的卻沒擋掉，反而造成 XSS 漏洞或跟需求不符。

### Content-Security-Policy Header

以上都是我們寫代碼的實作面去做防範，但其實各家主流瀏覽器也都有通用的標準來協助我們阻擋 XSS 攻擊。但須要注意的是，這些瀏覽器的功能都可能可以被關閉 (例如用 Tampermonkey)，所以只是防君子不防小人，不可以僅依賴瀏覽器的防範功能。

比較早期的就是在 Header 中加入 `x-xss-protection` 來指定瀏覽器針對 XSS 內容如何做 filtering，但比較近代的瀏覽器已經不太支援此 Header；當前主流瀏覽器普遍支援的是 `Content-Security-Policy` 這個 Header。

`Content-Security-Policy` 這個 Header 主要是用來控制各種資源 (包含對外部的請求跟內部 inline script 或 css) 的載入，這個資源可以包括 css, js, img, video, iframe等等。

例如 `Content-Security-Policy: script-src 'self'` 表示在此頁面可以載入的合法 JavaScript 或 WebAssembly 來源只有 self，也就是同個來源 (schema + domain + port) 的 script 才可以載入及執行。

詳細設定細節可以參考 [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) 的說明，或乾脆參考例如 Facebook 等網站是怎麼配置。

因為 `Content-Security-Policy` Header 是放在 response header 當中以告訴瀏覽器要如何控制資源載入，所以一般是由伺服器端加上；如果是 server side render 的網站沒有問題，就是在例如 php、jsp 或 cshtml 這種頁面上的 `<head>` 裡面加上例如 `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src *">`；但如果是前後端分離，則是在前端 web server serving 的 html 等檔案上加入，或由 web server 設定在 response header 中加入。

#### RESTful API with Content-Security-Policy Header

這邊額外研究一下如果是 RESTful API 還有需要加上 `Content-Security-Policy` header 嗎？

> 這邊特別指定討論 RESTful API，其實是想表達後端 API 僅提供資料與前端溝通，而不負責提供待 render 的 HTML、CSS、JavaScript 等資源的情況，所以其他相同功能但並不特別遵守 REST 的 API 其實也適用此處的情況。

通常這種情況多發生在前後端分離架構，前端透過 Ajax 呼叫後端 RESTful API 來取得資料進行畫面 render 的場景下，CSP 一般會直接配置在頁面 `<head>` 中。所以原則上不需要後端回傳的 response 來提供 CSP 限制。

但若是硬要在後端 RESTful API 的 response header 中加入 CSP 會對前端造成什麼影響嗎？

我們可以從 W3C 提供的 CSP 文件中 [3.5 Policy applicability](https://www.w3.org/TR/CSP2/#which-policy-applies) 這段可以看到：

> ...If a resource does not create a new execution context (for example, when including a script, image, or stylesheet into a document), then any policies delivered with that resource are discarded without effect. Its execution is subject to the policy or policies of the including context...

CSP 是否 apply 的關鍵是回傳的資源是否會產生新的執行上下文 (execution context)，這樣講很抽象，但可以參考 W3C 文件 [3.5 Policy applicability](https://www.w3.org/TR/CSP2/#which-policy-applies) 列出的表格來參照哪些資源回傳後 CSP 是否會 apply。

但同時也要注意，W3C 文件中同時也有指出其列出的 applicability 並非規範標準，所以實際各家瀏覽器如何實作可能並不一定相同。

> *This section is not normative.*

## 參考

- [Cross-site scripting](https://en.wikipedia.org/wiki/Cross-site_scripting)
- [Cross-site request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN X-XSS-Protection](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-XSS-Protection)
- [MDN Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)
- [W3C Content Security Policy Level 2](https://www.w3.org/TR/CSP2/)
