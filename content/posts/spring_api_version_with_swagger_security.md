---
title: "Spring Boot 實作 API 版本控制"
slug: "spring_api_version_with_swagger_security"
date: 2019-09-19T15:53:36+08:00
description: "在 Spring Boot Web 專案實作動態 API 版本控制，並能兼容 Swagger 及 Spring Security"
tags: ["java", "spring-boot", "spring-security", "swagger", "api-versioning"]
categories: "implementation"
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1568911044/Tech%20Blog/icon-spring-framework_lskrrp.svg"
draft: false
comment: true
---

本文目的是為了探討在 Spring Boot Web 專案中，實作 API 版本控制，並兼容 Swagger 及 Spring Security 的解決方式

需要有 Spring Boot、Spring MVC、Spring Security 及 Swagger 的基礎概念會比較好理解

# API 版本控制

常見的 API 版本控制方式有三種: URI, header, content-type

考量到 RESTful API 其中的一個好處是方便快取，使用 header 跟 content-type 的方式則可能無法正確的快取以及達成 idempotent，所以我個人採用的是在 URI 中加入版本號的方式

再來因為有時候面對的專案有數量眾多的 handler，導致每次修改版本號都要手動修改每一支 handler 對應的 uri，這樣既麻煩又不潮，所以一定要研究一下怎麼在 Spring Boot 專案中利用註解的方式自動幫 handler 對應的 uri 自動插入版本號

# Tech Stack

專案採用的是 Spring Boot 2.0 架構，Java 1.8 版本

有關 Maven 依賴如下:

- org.springframework.boot:spring-boot-starter-web:2.1.x
- org.springframework.boot:spring-boot-starter-security:2.1.x
- io.springfox:springfox-swagger2:2.9.2
- io.springfox:springfox-swagger-ui:2.9.2

這邊強調要採用 Spring Boot 主要是因為想要利用 Spring Boot auto configuration 的功能，也因為想要利用這個功能，所以過程才會這麼曲折...

# 常見作法及整合問題

網路上 API 版本控制的文章的做法都雷同

通常都是先建立自訂 `ApiVersion` 註解，裡面有版本號屬性，可以是 `int` 也可以是字串，通常都會有預設值，然後容許加註在類別或方法

```java
import java.lang.annotation.*;

@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface ApiVersion {

    int value() default 1;
}
```

再來寫 `ApiVersionCondition` 實作 `RequestCondition` 介面來判斷 request 跟 handler mapping 的條件

```java
import org.springframework.web.servlet.mvc.condition.RequestCondition;

import javax.servlet.http.HttpServletRequest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ApiVersionCondition implements RequestCondition<ApiVersionCondition> {

    private int apiVersion;

    private final static Pattern VERSION_PREFIX_PATTERN = Pattern.compile("/v(\\d+)/");

    public ApiVersionCondition(int apiVersion) {
        this.apiVersion = apiVersion;
    }

    @Override
    public ApiVersionCondition combine(ApiVersionCondition other) {
        return new ApiVersionCondition(other.getApiVersion());
    }

    @Override
    public ApiVersionCondition getMatchingCondition(HttpServletRequest request) {
        Matcher m = VERSION_PREFIX_PATTERN.matcher(request.getRequestURI());
        if (m.find()) {
            int version = Integer.parseInt(m.group(1));
            if (version >= getApiVersion()) {
                return this;
            }
        }
        return null;
    }

    @Override
    public int compareTo(ApiVersionCondition other, HttpServletRequest request) {
        return other.getApiVersion() - getApiVersion();
    }

    public int getApiVersion() {
        return apiVersion;
    }

    public void setApiVersion(int apiVersion) {
        this.apiVersion = apiVersion;
    }
}
```

接著寫自訂 `CustomRequestMappingHandlerMapping` 類別，繼承 `RequestMappingHandlerMapping` 並 override `getCustomTypeCondition(Class<?> handlerType)` 跟 `getCustomMethodCondition(Method method)` 這兩個方法，以分別取得類別跟方法上的 `ApiVersion` 註解，並據此建立 `ApiVersionCondition` 給 Spring MVC 做 request mapping 時調用

```java
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.web.servlet.mvc.condition.*;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.reflect.Method;

public class ApiVersionHandlerMapping extends RequestMappingHandlerMapping {

    @Override
    public RequestCondition<?> getCustomTypeCondition(Class<?> handlerType) {
        ApiVersion apiVersion = AnnotationUtils.findAnnotation(handlerType, ApiVersion.class);
        return createRequestCondition(apiVersion);
    }

    @Override
    public RequestCondition<?> getCustomMethodCondition(Method method) {
        ApiVersion apiVersion = AnnotationUtils.findAnnotation(method, ApiVersion.class);
        return createRequestCondition(apiVersion);
    }

    private RequestCondition<ApiVersionCondition> createRequestCondition(ApiVersion apiVersion) {
        if (apiVersion == null || apiVersion.value() < 1) {
            return null;
        }
        return new ApiVersionCondition(apiVersion.value());
    }
}
```

最後再建立一個設定類別繼承 `WebMvcConfigurationSupport` 類別並 override `requestMappingHandlerMapping()` 方法來提供自訂的 `CustomRequestMappingHandlerMapping`

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurationSupport;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@Configuration
public class WebMvcConfig extends WebMvcConfigurationSupport {

    @Override
    public RequestMappingHandlerMapping requestMappingHandlerMapping() {
        ApiVersionHandlerMapping handlerMapping = new ApiVersionHandlerMapping();
        handlerMapping.setOrder(0);
        handlerMapping.setInterceptors(getInterceptors());
        return handlerMapping;
    }
}
```

這樣就可以在 controller 開心地加上 `ApiVersion` 註解啦

```java
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@ApiVersion
@RequestMapping("home")
@RestController
public class HomeController {

    @GetMapping("hello")
    public ResponseEntity<?> hello() {
        return ResponseEntity.ok("Hello world!");
    }

    @ApiVersion(2)
    @GetMapping("hello")
    public ResponseEntity<?> helloV2() {
        return ResponseEntity.ok("Nice to meet you!");
    }
}
```

**BUT，人生就是這個 BUT**

當你要兼容 Swagger 的時候，事情就沒這麼簡單惹，你會發現馬德，swagger-ui.html 開起來打 API 怎麼都沒有版本號？！

其實到這邊本文才要正式開始，否則你隨便 google 都是這樣的內容，我還寫個毛

## 兼容 Swagger

首先，要整合 Swagger 有個問題，Swagger 會讀取 handler 的 `RequestMappingInfo` 來產生文件；但前面的作法其實是 request 進來後，利用 `RequestCondition` 來邏輯上將 request 導向 handler，實際上的 path 沒有改變，所以 Swagger 當然讀不到正確的 uri 來產生文件

於是就有了另外一種做法

在前面寫好的 `CustomRequestMappingHandlerMapping` 中，另外再 override `getMappingForMethod(Method method, Class<?> handlerType)` 方法去調整 `RequestMappingInfo`

這部分的作法其實要看狀況，但網路上有些範例不知道是不是比較早期的文章，還有用到 `Proxy` 來操作的寫法，我是覺得有點不必要

Spring MVC 其實在 `RequestMappingInfo` 裡面已經有很靈活的 constructor 可以做這方面的設定，並且提供方法可以跟原有的 `RequestMappingInfo` 做合併

```java
@Override
public RequestMappingInfo getMappingForMethod(Method method, Class<?> handlerType) {
    RequestMappingInfo info = super.getMappingForMethod(method, handlerType);
    if (info == null) return null;

    ApiVersion methodAnnotation = AnnotationUtils.findAnnotation(method, ApiVersion.class);
    if (methodAnnotation != null) {
        RequestCondition<?> methodCondition = getCustomMethodCondition(method);
        info = createApiVersionInfo(methodAnnotation, methodCondition).combine(info);
    } else {
        ApiVersion typeAnnotation = AnnotationUtils.findAnnotation(handlerType, ApiVersion.class);
        if (typeAnnotation != null) {
            RequestCondition<?> typeCondition = getCustomTypeCondition(handlerType);
            info = createApiVersionInfo(typeAnnotation, typeCondition).combine(info);
        }
    }
    return info;
}

private RequestMappingInfo createApiVersionInfo(ApiVersion annotation, RequestCondition<?> customCondition) {
    return new RequestMappingInfo(
            new PatternsRequestCondition("v".concat(String.valueOf(annotation.value()))),
            new RequestMethodsRequestCondition(),
            new ParamsRequestCondition(),
            new HeadersRequestCondition(),
            new ConsumesRequestCondition(),
            new ProducesRequestCondition(),
            customCondition);
}
```

這時候再打開 swagger-ui.html，就會覺得空氣是多麼清新，世界是多麼美好

## Spring Security 設定

當然，因為現在很多 handler 的 uri 不一樣了，設定 Spring Security 哪些請求要擋哪些不用的部分當然也要改

最簡單就是在繼承 `WebSecurityConfigurerAdapter` 的設定類別那邊手動加版本號，我自己是採用這種方式，因為考慮 Spring Security 本來就是安全考量要盡量嚴謹，會開放不用做驗證的部分應該本來就很少，所以手動修改這部分我覺得可以接受

另外提醒一下如果要使用 swagger-ui.html，要將相關的靜態資源開放，建議可以做在繼承 `WebSecurityConfigurerAdapter` 的設定類別的 `configure(HttpSecurity httpSecurity)` 方法中，可以省下另外註冊 resource 的功夫

## Spring Boot auto configuration 失效問題

其實這樣寫完還有一個問題，萬一我有其他自訂部分有用到從 `WebMvcConfigurer` 繼承來的方法，你會發現馬德，全都失效了

崩╰(〒皿〒)╯潰

這是因為前面繼承到萬惡的 `WebMvcConfigurationSupport` 了

Spring Boot 的原則是 convention over configuration，所以它有很多自動設定，關於 Spring MVC 的部分就是 `WebMvcAutoConfiguration` 在管

而不論是 `@EnableWebMvc` 註解或直接繼承 `WebMvcConfigurationSupport` 都會停用 `WebMvcAutoConfiguration`，Spring Boot 就會改用你 `@EnableWebMvc` 註解的類別或直接繼承 `WebMvcConfigurationSupport` 的類別來做設定；如果剛好你需要的自訂部分在這裡沒有想辦法設定進去，那你繼承 `WebMvcConfigurer` 的設定就白寫了

解決的關鍵點就是 `WebMvcRegistrations` 介面，看是要實作介面還是匿名類別的 `@Bean` 給 Spring Boot 都可以

我是寫在繼承 `WebMvcConfigurer` 的設定類別裡面，讓 Sring MVC 相關設定集中

```java
import org.springframework.boot.autoconfigure.web.servlet.WebMvcRegistrations;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@Configuration
public class CustomWebMvcConfigurer implements WebMvcConfigurer {

    @Bean
    public WebMvcRegistrations webMvcRegistrationsRequestMappingHandlerMapping() {
        return new WebMvcRegistrations() {
            
            @Override
            public RequestMappingHandlerMapping getRequestMappingHandlerMapping() {
                return new ApiVersionHandlerMapping();
            }
        };
    }
}
```

至此就可以把前面寫的 `WebMvcConfig` 刪掉啦

至於沒找到 `WebMvcRegistrations` 介面的朋友，要不就是你 Spring Boot 版本太低，不然就只能改用 `WebMvcRegistrationsAdpater` 試試看了 (攤手)