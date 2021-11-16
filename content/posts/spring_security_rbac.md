---
title: "Spring Security 整合 RBAC"
slug: "spring_security_rbac"
date: 2019-05-30T15:33:07+08:00
description: "探討如何利用 Spring Security 提供的自訂方式整合 RBAC"
tags: ["java", "spring-security", "rbac"]
categories: concept
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1568907350/Tech%20Blog/spring-security-icon_qahaqz.png"
draft: false
comment: true
---

目前比較主流的 [Role-based Access Control, RBAC](https://en.wikipedia.org/wiki/Role-based_access_control) 算是比較成熟且彈性的權限架構，若要在 Spring Security 實作 RBAC 並搭配 JWT 或 OAuth 2.0，大概要探討兩個問題

1. 是否值得為了減少查詢資料源的次數，而將角色或權限直接置入 JWT 或 Authorization Server 回傳的 token
2. 是否採取 Spring Security 原生只使用最細粒度的權限來進行存取控制

關於第一個問題，目前的思考點大概就是考量系統的併發度跟使用者總數

如果需要高併發，那自然希望盡量減少查詢資料的次數或資料量，盡量避免同時大量消耗 DB 資源；相反的，如果不需要高併發，那每次驗證都重新取得角色及權限資料也沒關係

使用者數量的考量也是類似，如果每次查詢的成本太高，則盡量減少查詢的次數

而第二個問題，則是要考量實際的業務場景

如果角色跟權限很大量且複雜，或可能要考慮角色分層甚至使用者群組，或不同 Domain 有不同的權限邏輯，則可能用 Spring Security 原生方式會不敷使用，相對如果角色權限結構簡單，則直接使用原生方式可能成本較低

所以以下探討主要專注於使用 Spring Security 提供的自訂空間來實作較為複雜的存取控制

# Spring Security 權限架構

首先要探討 Spring Security 原生提供的權限架構

- GrantedAuthority: 可以將每個 GrantedAuthority 想成是個別的 privilege，所以在 Spring Security 中，authority 就是 privilege 的概念
- Role: 在 Spring Security 中為了保持彈性，Role 可以當作 Authority 也可以當作一組 Authority 的組合
    - Role as Authority: 直接把 Role 當成一種 Authority 的情況，就是將 Role 當作一個有 ROLE_ 前綴的字串，這種情況下 Role 跟 Authority 就只是語意上的差別
    - Role as Container: Role 可以包含一組 Authority，Spring Security 在這個概念上沒有提供太多指引說明，需要自行實作

> [Granted Authority Versus Role in Spring Security](https://www.baeldung.com/spring-security-granted-authority-vs-role)

所以概念上 Spring Security 的 Role 比較像是有特別命名方式 (ROLE_ 前綴) 的一種 Authority，因此在預設中，`hasAuthority('ROLE_ADMIN')` 跟 `hasRole('ADMIN')` 是一樣的

在 Spring Security 中 Role as Authority 最明顯的例子就是 SimpleGrantedAuthority，建構子直接吃 role 字串，`getAuthority()` 方法也直接吐回 role 字串屬性

因此，如果要建立 Role 跟 Authority 分離的權限架構，首先要確認的是在設定 access control 時，`hasRole()` 跟 `hasAuthority()` 兩個方法到底是用什麼機制、從哪裡取得

Spring Security 的整體架構分成驗證跟存取控制兩個部分，由於驗證部分會由 API 搭配 JWT 做掉大部分，甚至未來整合 OAuth 2.0，所以需要探討的只有如何在驗證過程將使用者資料及權限放入 SecurityContext 中讓後續的存取控制使用，並且存取控制部分如何依照使用者資料及權限進行控制

## `UserDetailsService`

要在驗證過程將使用者資料及權限放入 SecurityContext 中，最簡單就是實作 `UserDetailsService` 的 `loadUserByUsername` 方法，然後將自訂的 `UserDetailsService` 提供給 `AuthenticationManager` 即可

這部分主要還是要考慮繼承 `UserDetails` 物件後，如何設定權限部分以及該將什麼樣的資料放入 Authentication 的 authorities 中

## `AccessDecisionVoter` 及 `AccessDecisionManager`

而存取控制的邏輯部分就要實作 `AccessDecisionVoter` 的 `vote` 方法

voter 可以選擇回傳三種決策:

- `ACCESS_GRANTED`: 通過
- `ACCESS_DENIED`: 否決
- `ACCESS_ABSTAIN`: 棄權

實作完 voter 後，要將 voter 加入 `AccessDecisionManager`，而 `AccessDecisionManager` 預設有三種決策策略

- `AffirmativeBased`: 任何 voter 回傳通過即可
- `ConsensusBased`: 通過數大於否決數，忽略棄權
- `UnanimousBased`: 所有 voter 通過或棄權，也就是不能有任何否決

> [Custom AccessDecisionVoters in Spring Security](https://www.baeldung.com/spring-security-custom-voter)

這部分就只能基於實際業務邏輯做考量