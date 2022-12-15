---
title: "Maven + Docker Multi-stage Build"
date: 2022-12-14T14:14:44+08:00
slug: "maven_docker_multi_stage_build"
description: "Explained Maven project using Docker multi-stage build"
tags: ["maven", "docker"]
categories: "implementation"
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1671071520/Tech%20Blog/spring_boot_maven_docker.png"
draft: false
comment: true
enableLaTeX: false
---

Java 專案整合 Docker multi-stage build 系列：

- Maven + Docker Multi-stage build
- [Gradle + Docker Multi-stage build]({{< relref "gradle_docker_multi_stage_build" >}})

---

現代常見的 CI/CD 流程經常會使用容器化 (containerized) 的方式來幫助建置環境及部署

以 Java + Maven 專案舉例，一個比較通用的 Dockerfile 可能長這樣：

```sh
FROM maven:3.8-openjdk-11

WORKDIR /opt/app

COPY src/main/resources /opt/app/src/main/resources
COPY src/main/java /opt/app/src/main/java
COPY pom.xml .
RUN mvn -B -e clean package

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "demo.jar"]
```

這個 Dockerfile 其實沒有問題，完全可以正常運行，但它使用上有一個地方不太方便，就是每次運行到 `RUN mvn -B -e clean package` 這行的時候，除非程式碼跟 `pom.xml` 都沒有變動，否則所有 dependencies 都會重新下載一遍，如果專案比較大型，那光下載 dependencies 可能就會要花很久的時間

# Docker Multi-stage Build

於是就有人使出了 Docker multi-stage build 這招

```sh
FROM maven:3.8-openjdk-11 as DEPENDENCIES
WORKDIR /opt/app
COPY pom.xml .
RUN mvn -B -e -C org.apache.maven.plugins:maven-dependency-plugin:3.3.0:go-offline

FROM maven:3.8-openjdk-11 as BUILDER
WORKDIR /opt/app
COPY --from=DEPENDENCIES /root/.m2 /root/.m2
COPY src/main/resources /opt/app/src/main/resources
COPY src/main/java /opt/app/src/main/java
COPY pom.xml .
RUN mvn -B -e clean package

FROM openjdk:11-jre
WORKDIR /opt/app
COPY --from=BUILDER /opt/app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

簡單來說，在過程中會分成三段建置，第一段會依照 `pom.xml` 將所有 dependencies 下載下來；第二段會利用第一段下載的 dependencies 來建置專案；第三段則是運行第二段建置好的專案 jar 檔。

這樣做有什麼好處呢？主要差別在於「建置時間」跟「最終 image 的大小」

## 建置時間

Docker 的 image 是由一層一層的 layer 疊加而成，每一層其實都是一個 image，只是中間層的 image 是 read only 而且一般指令是找不到的，只有最上層的 image 是 read/write 都可以的 layer，也才能被操作

![Relationship between Dockerfile and layered images](https://cdn.buttercms.com/CLQJN3yRRcS7oGqm7yKb)
*source: MetricFire [How to Build Optimal Docker Images](https://www.metricfire.com/blog/how-to-build-optimal-docker-images/)*

在 Dockerfile 當中的每一行都是一層 layer，每層 layer 都是一個 image，而 Docker 在 build 的過程是會針對 image 做 cache，也就是 Dockerfile 當中每一行運行的指令相關的資源沒有變動，Docker 就會直接使用已有的 image

以前面的 Dockerfile 來說，如果第三行 `COPY pom.xml .` 複製進來的 `pom.xml` 沒有變動，則第四行 `RUN mvn -B -e -C org.apache.maven.plugins:maven-dependency-plugin:3.3.0:go-offline` 也不會實際運行，而是直接使用前一次建置出來對應 layer 的 image

利用 Docker 這樣的特性，加上一般開發的時候 `pom.xml` 不太會變動的前提下，在大部分使用這份 Dockerfile 做建置的時候，第一階段的步驟都會使用 cache，從而節省每次建置都要重新下載 dependencies 的時間

## Image 大小

不知道有多少人留意過你 build 出來的 image 大小？

前面第一種作法 build 出來的 image 本身會包含了 base image (本身就包含 maven 及 jdk)、程式碼、下載下來的所有 dependencies，以及建置出來的 jar 檔

其中運行 jar 檔時並不需要 maven，也不需要 JDK 而只需要 JRE，以 Spring Boot 來說，所有運行需要的 dependencies 都已經包在 jar 檔裡面 (fat jar)，所以 image 裡面的 .m2 資料夾也是重複的

這樣 build 出來的 image 動輒幾百 mb，雖然現在硬碟便宜，但有串 CI/CD 的開發流程經常 dev 分支每 push 一次就建置一個 image，那占用的空間就大了，如果是用雲端服務，那燒的就是老闆的錢

所以 image 大小 matters！

先重新順一下前面這份 multi-stage build 的 Dockerfile 流程：

1. 依照 `pom.xml` 下載所有 dependencies
2. 直接使用前一階段下載好的 dependencies 來建置專案 jar 檔
3. 直接使用前一階段建置好的 jar 檔來運行

從流程中我們可以看到最終產出的 image 本身只帶有 base image 以及建置好的 jar 檔、base image 只包含 headless JRE、layer 只有五層、也不帶有前面階段使用到的 dependencies，甚至也不包含建置需要的 maven，因此最終的 image 的大小就會明顯的下降

![Comparison between single-stage build and multi-stage build](https://res.cloudinary.com/dcvgho2zc/image/upload/v1671002088/Tech%20Blog/single-multi-stage-build-image-size.png)

# 優化

## Base Image

但其實前面這份 Dockerfile 還有優化空間，比較簡單的就是使用更精簡的 base image，也就是盡量選擇只包含運行該 stage 需要的最少功能的 image

```sh
FROM maven:3.8-openjdk-11-slim as DEPENDENCIES
WORKDIR /opt/app
COPY pom.xml .
RUN mvn -B -e -C org.apache.maven.plugins:maven-dependency-plugin:3.3.0:go-offline

FROM maven:3.8-openjdk-11-slim as BUILDER
WORKDIR /opt/app
COPY --from=DEPENDENCIES /root/.m2 /root/.m2
COPY src/main/resources /opt/app/src/main/resources
COPY src/main/java /opt/app/src/main/java
COPY pom.xml .
RUN mvn -B -e clean package

FROM azul/zulu-openjdk-alpine:11-jre-headless
WORKDIR /opt/app
COPY --from=BUILDER /opt/app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

一般來說帶有 `alpine` 或 `slim` 結尾的 image 都會是相對比較好的選擇；如果只是要用來運行無 GUI 的 Java 應用程式的話，盡量選擇 `headless`

## Maven

如果你有仔細觀察建置過程的 log 的話，應該會發現在運行第 12 行 `RUN mvn -B -e clean package` 的時候，maven 還是會下載一些 dependencies

這就很奇怪啊，照理來說前一階段應該就把全部的 dependencies 都下載下來啦，畢竟這就是 `dependency:go-offline` 這個 goal 的目的不是嗎？

但很抱歉，你要說這是 plugin 的 bug 或是原本的功能都好，總之，它只會下載 `pom.xml` 上面有明示列出的 artifact，而且甚至連 `<plugin>` 標籤內部的 `<dependencies>` 標籤當中的 artifact 都不會下載

> 這個 issue 從 2007 年開到現在都還沒解決，可以參考 [MDEP-82][1]

再加上有些 maven 預設 lifecycle 或 goal 需要動態載入的 dependencies 也並不在下載的目標當中，就會造成在第二階段真正開始建置專案的時候會需要下載缺少的 dependencies

某些 plugin 的 dependencies 甚至不是列在 `pom.xml` 當中，而是利用 class loader 的方式超級動態載入，這也是 `maven-dependency-plugin` 無能為力的部分

如果建置過程都有連網還好，有些 CI/CD 的流程在建置這個階段是會跟網路隔離的，或是會利用建置這個步驟順便做測試，但為了測試環境的「乾淨」而限制連網功能，這個情況就很尷尬了，各種建置失敗

在 plugin 修正之前，只能採取各種 workaround，以下介紹一種比較麻煩，但相對不會變更太多建置步驟或在建置出來的 jar 檔或甚至 git repo 中增加不必要 dependencies 的方式

### Workaround

首先將 Dockerfile 調整如下：

```sh
FROM maven:3.8-openjdk-11-slim as DEPENDENCIES
WORKDIR /opt/app
COPY pom.xml .
RUN mvn -B -e -C clean org.apache.maven.plugins:maven-dependency-plugin:3.3.0:go-offline

FROM maven:3.8-openjdk-11-slim as BUILDER
WORKDIR /opt/app
COPY --from=DEPENDENCIES /root/.m2 /root/.m2
COPY src/main/resources /opt/app/src/main/resources
COPY src/main/java /opt/app/src/main/java
COPY pom.xml .
RUN mvn -B -e -o clean package

FROM azul/zulu-openjdk-alpine:11-jre-headless
WORKDIR /opt/app
COPY --from=BUILDER /opt/app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

主要改動有兩個部分，一是在第一階段也運行 clean lifecycle 以下載相關的 dependencies；二是在第二階段建置加上 `-o` 參數，這是為了讓 maven 在 offline 的狀況下進行建置，也就是強制 maven 不連網

第一次 build 的時候應該會發現在 `mvn clean package` 階段報錯，這時候往前找一下，應該會找到類似以下這段 log：

```plaintext
#16 1.770 [INFO] --------------------------------[ jar ]---------------------------------
#16 2.025 [WARNING] The POM for org.apache.tomcat:tomcat-annotations-api:jar:9.0.65 is missing, no dependency information available
#16 2.083 [WARNING] The POM for net.minidev:json-smart:jar:2.4.8 is missing, no dependency information available
#16 2.131 [WARNING] The POM for net.bytebuddy:byte-buddy:jar:1.12.13 is missing, no dependency information available
#16 2.131 [WARNING] The POM for net.bytebuddy:byte-buddy-agent:jar:1.12.13 is missing, no dependency information available
#16 2.528 [WARNING] The POM for com.rabbitmq:amqp-client:jar:5.14.2 is missing, no dependency information available
#16 2.589 [WARNING] The POM for org.glassfish.jaxb:jaxb-runtime:jar:2.3.6 is missing, no dependency information available
#16 2.823 [WARNING] The POM for com.fasterxml.jackson.dataformat:jackson-dataformat-yaml:jar:2.13.3 is missing, no dependency information available
#16 2.830 [WARNING] The POM for org.webjars:webjars-locator-core:jar:0.50 is missing, no dependency information available
#16 2.840 [WARNING] The POM for org.apache.httpcomponents:httpcore:jar:4.4.15 is missing, no dependency information available
```

以上這段就是在說明 maven 在執行到 jar 這個 goal 的時候缺少哪些 dependencies

這時候我們就會需要回到 `pom.xml`，依照上面那段 log 缺少的 artifact，在 `<build>` 標籤裡面加入以下這段：

```xml
<pluginManagement>
	<plugins>
		<plugin>
			<groupId>org.apache.maven.plugins</groupId>
			<artifactId>maven-clean-plugin</artifactId>
			<dependencies>
				<dependency>
					<groupId>org.apache.tomcat</groupId>
					<artifactId>tomcat-annotations-api</artifactId>
					<version>9.0.65</version>
				</dependency>
				<dependency>
					<groupId>net.minidev</groupId>
					<artifactId>json-smart</artifactId>
					<version>2.4.8</version>
				</dependency>
				<dependency>
					<groupId>net.bytebuddy</groupId>
					<artifactId>byte-buddy</artifactId>
					<version>1.12.13</version>
				</dependency>
				<dependency>
					<groupId>net.bytebuddy</groupId>
					<artifactId>byte-buddy-agent</artifactId>
					<version>1.12.13</version>
				</dependency>
				<dependency>
					<groupId>com.rabbitmq</groupId>
					<artifactId>amqp-client</artifactId>
					<version>5.14.2</version>
				</dependency>
				<dependency>
					<groupId>org.glassfish.jaxb</groupId>
					<artifactId>jaxb-runtime</artifactId>
					<version>2.3.6</version>
				</dependency>
				<dependency>
					<groupId>com.fasterxml.jackson.dataformat</groupId>
					<artifactId>jackson-dataformat-yaml</artifactId>
					<version>2.13.3</version>
				</dependency>
				<dependency>
					<groupId>org.webjars</groupId>
					<artifactId>webjars-locator-core</artifactId>
					<version>0.50</version>
				</dependency>
				<dependency>
					<groupId>org.apache.httpcomponents</groupId>
					<artifactId>httpcore</artifactId>
					<version>4.4.15</version>
				</dependency>
			</dependencies>
		</plugin>
	</plugins>
</pluginManagement>
```

這段是為了告訴 maven `maven-clean-plugin` 需要指定的這些 dependencies

請注意一定要掛在 `maven-clean-plugin` 底下，因為這就是 clean lifecycle 對應的 plugin，這樣我們在第一階段執行 clean 的時候才會下載這些缺少的 artifact

# 參考

- [How to Build Optimal Docker Images](https://www.metricfire.com/blog/how-to-build-optimal-docker-images/)
- [Pre-download Maven dependencies and work offline](https://blog.virtual7.de/pre-download-maven-dependencies-and-work-offline/)
- [Maven offline - problem with mvn-plugins](https://stackoverflow.com/questions/1245076/maven-offline-problem-with-mvn-plugins/58767388#58767388)
- [MDEP-82 go-offline / resolve-plugins does not resolve all plugin dependencies][1]
- [MNG-6965 Extensions suddenly have org.codehaus.plexus:plexus-utils:jar:1.1 on their classpath](https://issues.apache.org/jira/browse/MNG-6965)
- [Go Offline Maven Plugin](https://github.com/qaware/go-offline-maven-plugin)

[1]: https://issues.apache.org/jira/browse/MDEP-82
