---
title: "Gradle + Docker Multi-stage build"
date: 2022-12-15T10:18:10+08:00
slug: "gradle_docker_multi_stage_build"
description: "Explained Gradle project using Docker multi-stage build"
tags: ["gradle", "docker"]
categories: "implementation"
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1671071520/Tech%20Blog/spring_boot_gradle_docker.png"
draft: false
comment: true
enableLaTeX: false
---

Java 專案整合 Docker multi-stage build 系列：

- [Maven + Docker Multi-stage build]({{< relref "maven_docker_multi_stage_build" >}})
- Gradle + Docker Multi-stage build

---

前一篇講過 Maven 配合 Docker multi-stage build 的優化概念跟實作，這篇順便來講一下 Gradle 的部分

# Docker Multi-stage Build

前一篇已經介紹過建置 Java 專案配合 Docker multi-stage build 的優化概念，這邊就不再贅述，直接上 Dockerfile：

```sh
FROM gradle:7.6-alpine AS Cache
WORKDIR /opt/app
ENV GRADLE_USER_HOME /cache
COPY build.gradle ./
RUN gradle --no-daemon dependencies --stacktrace

FROM gradle:7.6-jdk11-alpine AS Builder
WORKDIR /opt/app
COPY --from=Cache /cache /home/gradle/.gradle
COPY build.gradle settings.gradle ./
COPY src /opt/app/src
RUN gradle --no-daemon build --stacktrace --offline

FROM azul/zulu-openjdk-alpine:11-jre-headless
WORKDIR /opt/app
COPY --from=Builder /opt/app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

步驟同樣大致如下：

1. 依照 `build.gradle` 下載所有 dependencies 
2. 利用前一階段下載好的 dependencies 離線建置專案
3. 利用前一階段建置好的 jar 檔運行應用程式

Gradle 單就配合 Docker multi-stage build 的實作方面比 Maven 方便得多，最起碼就沒有 [default lifecycle plugin 的 dependencies 不會自動下載的 bug](https://issues.apache.org/jira/browse/MDEP-82)，所以直接使用 `gradle dependencies` 的指令就可以直接下載到所有建置時需要用到的 dependencies，完全不需要像 Maven 那樣為了要下載 plugin 抓不到的 dependencies 而去做 workaround

另外同樣要注意盡量選用較精簡的 base image，在 Gradle 這邊就盡量都選用 alpine 結尾的 image

# 參考

- [Gradle Docker Hub](https://hub.docker.com/_/gradle)
- [Leveraging Multi-Stage Docker Builds for Your Compiled Applications](https://we-are.bookmyshow.com/leveraging-multi-stage-docker-builds-for-your-compiled-applications-c997d17cf4d4)
- [Slow gradle build in Docker. Caching gradle build](https://stackoverflow.com/a/59022743/7605040)
- [Gradle dependency caching during docker multi stage build?](https://stackoverflow.com/a/59133542/7605040)
- [gradle - task to only download maven dependencies](https://stackoverflow.com/a/50219857/7605040)
