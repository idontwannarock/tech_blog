---
title: "Spring Boot 後端實作 XSS 防範"
date: 2022-11-01T15:28:32+08:00
slug: "xss_prevention_spring_boot"
description: "介紹 Spring Boot 整合 Spring Security 後端專案如何提供 XSS 基本防範"
tags: ["xss", "owasp", "spring-boot", "spring-security"]
categories: "implementation"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

XSS 系列：

1. XSS 防範簡介
2. Spring Boot 後端實作 XSS 防範

身為一個 Java 後端工程師，今天要來討論如何在 Spring Boot 的後端專案進行 general 的 XSS 防範。

> 請還是注意，general 的手段並不能很良好的防範 XSS 攻擊，而只是提供一個基本程度的防範。

## CSP Header

如果專案有整合 Spring Security，Spring Security 原生就已經預設在 response header 中加入 `X-XSS-Protection: 1; mode=block`，但因為 CSP 需要自行設定資源允許的來源，所以 Spring Security 並沒有預設，需要在 `SecurityFilterChain` 當中設定，舉例如下：

```java
@Bean
SecurityFilterChain filterChain(HttpSecurity httpSecurity) throws Exception {
  httpSecurity.headers().contentSecurityPolicy("script-src 'self'");
  ...
}
```

如此就會在 response header 中加入 `Content-Security-Policy: script-src 'self'`。

## Output Encoding

再來，後端也可以對接收到或回傳的資料做 escape，例如採取將內容都做 escape，將符號都轉換成 HTML Entities 的方式。

首先可以加入 Apache Commons Text dependency，有現成的方法可以處理文字中符號轉換的部分：

```xml
<dependency>
	<groupId>org.apache.commons</groupId>
	<artifactId>commons-text</artifactId>
	<version>1.10.0</version>
</dependency>
```

如此就可以在需要的時候直接使用 `StringEscapeUtils.escapeHtml4(input)` 即可。

接著有幾處地方要處理，首先針對 request 的部分。

### Query String, Posted Form Data, and Header

先對 query string、posted form data 及 header 的部分作處理，首先我們建立一個 `HttpSevletRequestWrapper` 來加上從 request 取得 query string、posted form data 以及 header 時要做的處理：

```java
import org.apache.commons.text.StringEscapeUtils;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

public class XssRequestWrapper extends HttpServletRequestWrapper {

    /**
     * Constructs a request object wrapping the given request.
     *
     * @param request The request to wrap
     * @throws IllegalArgumentException if the request is null
     */
    public XssRequestWrapper(HttpServletRequest request) {
        super(request);
    }

    /**
     * 處理請求參數 (單一值)<br>
     * 此請求參數只會從 query string 或 posted form data 取得
     */
    @Override
    public String getParameter(String name) {
        String parameter = super.getParameter(name);

        if (StringUtil.isNotNullOrBlank(parameter)) {
            parameter = StringEscapeUtils.escapeHtml4(parameter);
        }

        return parameter;
    }

    /**
     * 處理請求參數 (多值)<br>
     * 此請求參數只會從 query string 或 posted form data 取得
     */
    @Override
    public String[] getParameterValues(String name) {
        String[] parameterValues = super.getParameterValues(name);

        if (parameterValues == null) return null;

        for (int index = 0; index < parameterValues.length; index++) {
            parameterValues[index] = StringEscapeUtils.escapeHtml4(parameterValues[index]);
        }

        return parameterValues;
    }

    /**
     * 處理請求 header
     */
    @Override
    public Enumeration<String> getHeaders(String name) {
        Enumeration<String> headers = super.getHeaders(name);

        List<String> result = new ArrayList<>();
        while (headers.hasMoreElements()) {
            String[] tokens = headers.nextElement().split(",");
            for (String token : tokens) {
                result.add(StringEscapeUtils.escapeHtml4(token));
            }
        }

        return Collections.enumeration(result);
    }
}
```

接下來要在 Spring Boot Web 框架處理 request 的過程中，用新建立的 `XssRequestWrapper` 去包裝原本的 `HttpServletRequest`。這部分其實有許多方式可以做處理，例如 `HandlerInterceptor` 或 `OncePerRequestFilter`。但這裡我選擇 `Filter`，因為其實方式都大同小異：

```java
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.servlet.*;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@WebFilter(filterName = "xssFilter", urlPatterns = "/*")
@Component
public class XssFilter implements Filter {

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
            throws IOException, ServletException {
        filterChain.doFilter(new XssRequestWrapper((HttpServletRequest) servletRequest), servletResponse);
    }
}
```

此處可以注意的是，`@Order` 標籤是用來指定 `Filter` 的執行優先順序，內容是一個 `int`，值越大，優先度越高；另外就是 `@WebFilter` 這個標籤，裡面有一個 `urlPatterns` 的屬性，可以用來指定 `Filter` 適用的 url pattern，而且可以指定多個 pattern。

### Request/Response Body - JSON

接著要處理 request/response body 的部分，先處理 JSON 格式的 body。

因為 Spring Boot Web 預設處理 JSON 整合的是 Jackson 這個 library，所以可以直接利用 Jackson 本身的功能，直接針對類型為 `String` 的 value 做處理。

將 JSON 轉換為物件的部分如下：

```java
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import org.apache.commons.text.StringEscapeUtils;

import java.io.IOException;

public class XssJsonDeserializer extends JsonDeserializer<String> {

    @Override
    public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (parser.getCurrentToken() == JsonToken.VALUE_STRING) {
            return StringEscapeUtils.escapeHtml4(parser.getText());
        }
        return null;
    }
}
```

將物件轉換為 JSON 的部分如下：

```java
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import org.apache.commons.text.StringEscapeUtils;

import java.io.IOException;

public class XssJsonSerializer extends JsonSerializer<String> {

    @Override
    public void serialize(String value, JsonGenerator generator, SerializerProvider serializers) throws IOException {
        if (value == null) {
            return;
        }
        generator.writeString(StringEscapeUtils.escapeHtml4(value));
    }
}
```

然後將 serializer 跟 deserializer 註冊到 Spring Boot Web 中，當有 Jackson 2 在依賴時會預設使用來對 JSON 做轉換的 `MappingJackson2HttpMessageConverter` 當中：

```java
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.example.config.security.xss.XssJsonDeserializer;
import org.example.config.security.xss.XssJsonSerializer;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class CustomWebConfigurer implements WebMvcConfigurer {

    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {        
        // register XssJsonDeserializer
        var module = new SimpleModule();
        module.addDeserializer(String.class, new XssJsonDeserializer());
        module.addSerializer(String.class, new XssJsonSerializer());
        converters.stream()
                .filter(converter -> converter.getClass().getSimpleName().equals("MappingJackson2HttpMessageConverter"))
                .forEach(converter -> ((MappingJackson2HttpMessageConverter) converter).getObjectMapper().registerModule(module));

        WebMvcConfigurer.super.extendMessageConverters(converters);
    }
}
```

其實要註冊 serializer 跟 deserializer 也有好幾種方式，不論是用 `Jackson2ObjectMapperBuilder` 還是用 `Jackson2ObjectMapperBuilderCustomizer` 都可以。

### Request/Response Body - String

最後要來處理 request/response body 裡面直接提供 `String` 的情況。

首先要知道的是 Spring Boot Web 預設處理這種情況會使用的是 `StringHttpMessageConverter`，但這個 converter 本身並沒有什麼原生的方法接受客製調整，所以只好直接繼承開一個新的 converter：

```java
import org.apache.commons.text.StringEscapeUtils;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.MediaType;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.lang.Nullable;
import org.springframework.util.Assert;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

public class XssStringHttpMessageConverter extends StringHttpMessageConverter {

    private static final MediaType APPLICATION_PLUS_JSON = new MediaType("application", "*+json");

    @Override
    protected String readInternal(Class<? extends String> clazz, HttpInputMessage inputMessage) throws IOException {
        Charset charset = getContentTypeCharset(inputMessage.getHeaders().getContentType());
        String input = StreamUtils.copyToString(inputMessage.getBody(), charset);

        return StringEscapeUtils.escapeHtml4(input);
    }

    private Charset getContentTypeCharset(@Nullable MediaType contentType) {
        if (contentType != null) {
            Charset charset = contentType.getCharset();
            if (charset != null) {
                return charset;
            }
            else if (contentType.isCompatibleWith(MediaType.APPLICATION_JSON) ||
                    contentType.isCompatibleWith(APPLICATION_PLUS_JSON)) {
                // Matching to AbstractJackson2HttpMessageConverter#DEFAULT_CHARSET
                return StandardCharsets.UTF_8;
            }
        }
        Charset charset = getDefaultCharset();
        Assert.state(charset != null, "No default charset");
        return charset;
    }
}
```

接著也是要將這個客製的 converter 註冊起來，同樣在 `WebMvcConfigurer` 的 `extendMessageConverters` 方法裡面加上這兩行：

```java
// replace with customized StringHttpMessageConverter
converters.removeIf(converter -> converter.getClass().getSimpleName().equals("StringHttpMessageConverter"));
converters.add(1, new XssStringHttpMessageConverter());
```

注意 converters 是有順序的，Spring Boot Web 預設第一個 converter 是 `ByteArrayHttpMessageConverter`，第二個就是原本的 `StringHttpMessageConverter`，所以我們這邊直接用客製的 converter 取代原位置的 `StringHttpMessageConverter`。

## 結論

XSS 攻擊的手段有很多種，而且因為各網站需求不同的關係，也沒有一個統一的方式可以做絕對的防範，其核心的防範概念主要就圍繞在對於各種 Input 的檢查是否符合預期。

例如前面提過針對文字欄位做 HTML Sanitization 的白名單，明確規定可接受的內容、長度等等，就可以盡量提高安全性，但也因為如此，需要前後端互相配合；再加上攻擊手法不停推陳出新，這也可能是個長期的過程。

## 參考

- [在 Spring 應用程序中防止跨站點腳本（XSS）](https://www.1ju.org/article/spring-prevent-xss)
- [SpringBoot Xss 漏洞修复](https://www.cnblogs.com/zhangruifeng/p/16082741.html)
- [XSS 防禦 - CSP script-src 設定](https://blog.darkthread.net/blog/csp-script-src/)
- [Http Message Converters with the Spring Framework](https://www.baeldung.com/spring-httpmessageconverter-rest)
