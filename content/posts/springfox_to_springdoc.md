---
title: "SpringFox to SpringDoc"
date: 2022-12-12T09:24:17+08:00
slug: "springfox_to_springdoc"
description: "Migrate from SpringFox to SpringDoc"
tags: ["java", "spring-boot", "springfox", "springdoc", "swagger"]
categories: "implementation"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

以 Spring Boot 生態來說，比較主流的 documentation 方式應該就是 Swagger，以往應該多數人都是使用 SpringFox library，但近幾年也漸漸興起使用 SpringDoc，所以就做了一點筆記，紀錄要怎麼從 SpringFox 轉移到 SpringDoc

# 比較

這兩者同樣都有實作 OpenAPI 3.0，為什麼我們需要從 SpringFox 轉移使用 SpringDoc？

- `springfox-boot-starter` 包含許多 Spring 的 transitive dependencies；`springdoc-openapi-ui` 則是 standalone 的 library，並沒有跟 Spring 的依賴
- `springfox-boot-starter` 需要額外 dependency 才有 Swagger UI 的呈現；`springdoc-openapi-ui` 則已經內含 Swagger UI
- SpringDoc 在一些細節功能上更強大，例如提供陣列參數更好的 UI 做輸入
- 最重要的一點，SpringFox 幾乎已經不再更新；而 SpringDoc 還有在常態維護，因此也能跟較新版本的 Spring 有更好的整合，也能更即時的修正 bug

# 升級步驟

相當簡單，參考 [官方文件](https://springdoc.org/#migrating-from-springfox) 即可

因為都是實作 OpenAPI，就算 SpringFox 有實作 2.0 版，但跟 3.0 其實差異也不大

主要就是改一下 dependency，然後 annotation 調整一下，其他幾乎沒有不同

# 注意事項

## Spring Security

若有整合 Spring Security，則可以在 controller 透過加註 `@AuthenticationPrincipal` 註解注入驗證過的 principal 物件，但這個物件不需要呈現在 Swagger 上

以往 SpringFox 的作法是用 `@ApiIgnore` 註解來隱藏；SpringDoc 也可以透過 `@Parameter(hidden = true)` 來隱藏

不過 SpringDoc 還有提供另外一種做法，就是加上以下 dependency，Swagger 上就會自動忽略 `@AuthenticationPrincipal`

```xml
<dependency>
  <groupId>org.springdoc</groupId>
  <artifactId>springdoc-openapi-security</artifactId>
  <version>1.6.13</version>
</dependency>
```

## 反向代理

如果有使用反向代理，[官方文件](https://springdoc.org/#how-can-i-deploy-springdoc-openapi-ui-behind-a-reverse-proxy) 中有建議可以設定 `server.forward-headers-strategy` 為 `framework` 或 `native` 的方式；但要注意的是，SpringDoc 是從以下 headers 當中取得 url，並只在第一次產生 ui 的時候取得該值：

- RFC7239 規範的 [Forwarded Headers](https://www.rfc-editor.org/rfc/rfc7239)
- `X-Forwarded-Host`
- `X-Forwarded-Port`
- `X-Forwarded-Proto`
- `X-Forwarded-Ssl`
- `X-Forwarded-Prefix`

但萬一反向代理做 upstream 的時候沒有帶上這些 headers，或我們可能需要從 Referer header 取得真實來源的 domain，好讓 Swagger UI 做 HTTP 呼叫的時候可以使用

以往在 SpringFox 我們需要從 request 當中取得 `Referer` header 並解析；但 SpringDoc 可以有更簡單的作法，也就是直接設定 `OpenAPI` 的 servers 為 `/` 或是 Spring Boot 的 `server.servlet.context-path`

以下為 annotation 方式設定範例

```java
@Configuration
@OpenAPIDefinition(info = @Info(
		title = "Product API",
		version = "1.0.0"),
		servers = @Server(url = "${server.servlet.context-path}/")
)
public class SwaggerConfig {
}
```

或以 programmatic 方式設定：

```java
@Configuration
public class SwaggerConfig {
	
	@Value("${server.servlet.context-path}")
	private String serversUrl;

	@Bean
	OpenAPI openAPI() {
		return new OpenAPI()
				.info(new Info()
						.title("Product API")
						.version("1.0.0"))
				.servers(List.of(new Server()
						.url(serversUrl + "/")));
	}
}
```

# 參考

- [官方文件](https://springdoc.org/)
- [Are there any advantages of using/migrating to springdoc-openapi from Springfox?](https://stackoverflow.com/a/72480207/7605040)
- [Spring Boot REST API: SpringDoc + OpenAPI 3 (springdoc-openapi-ui) or Swagger2 v3 (springfox-boot-starter)](https://stackoverflow.com/a/65672670/7605040)
- [SpringFox GitHub](https://github.com/springfox/springfox)
