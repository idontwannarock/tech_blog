---
title: ".gitattributes 引發的慘案"
date: 2024-05-22T09:25:13+08:00
slug: "gitattributes_glowroot_error"
description: "研究 Glowroot 作為 Java Agent 在 Docker 啟動時，碰到 Error opening zip file or JAR manifest missing 錯誤訊息的問題"
tags: ["git", "gitattributes", "glowroot", "javaagent"]
categories: "bug"
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1716343505/Tech%20Blog/git-logo-banner.jpg"
draft: false
comment: true
enableLaTeX: false
---

# 情況描述

最近在嘗試建立新專案的基礎專案架構，因為剛好看到常用的 APM 工具 [Glowroot 0.14.2 版 release][0] 開始支援 Java 21，讓我產生使用 [multi-staged build]({{< relref "maven_docker_multi_stage_build" >}}) + [jlink][1] 盡量縮小 image 大小，並且掛上 [Glowroot][2] 作為 Java Agent 來運行專案的念頭

因為以往已經將 Glowroot 使用在 Java 8, 11, 17 等版本的專案上，所以 Dockerfile 的基本架構已經確立，理論上只需要調整 base image 為 Java 21 應該就沒問題

```dockerfile
FROM eclipse-temurin:21
ENV CONFIG_java_opts="-server -XX:+UseG1GC"
COPY extras/glowroot /extras/glowroot
COPY target/*jar app.jar
ENTRYPOINT exec java $CONFIG_java_opts -javaagent:/extras/glowroot/glowroot.jar -Dglowroot.collector.address=$CONFIG_glowroot_address -Dglowroot.agent.id=$CONFIG_app_name:: -jar /app.jar
```

其中

- `extras/glowroot` 資料夾包含我直接從 [Glowroot 0.14.2 Release][0] 這邊下載後解壓縮出來的 `glowroot.jar` 檔，並且直接 commit 到 git 上
- `$CONFIG_java_opts`、`$CONFIG_glowroot_address` 及 `$CONFIG_app_name` 都是定義在 K8S config map 中的變數，會在 K8S 運行這個 image 的時候從 pod 的環境變數取得

這樣的 Dockerfile 產出的 image 大約是 520MB，`app.jar` 檔大約 65MB，所以代表 image 的其他部分就有 455MB，其實有點大

如果我專案複雜一點可能光 `app.jar` 就會來到 4-500MB，那 image 甚至可能會將近 1GB，這樣在 CICD 頻繁的情況下對於 image 傳輸的壓力太大，而且 K8S rolling start pod 的速度也會很慢，所以才要盡量改成 multi-staged build 來縮小 image 大小

另外因為這套寫法已經在公司太多專案上運行了，所以我並沒有特別測試，就直接開始調整為 multi-staged build + jlink

```dockerfile
FROM eclipse-temurin:21 AS jre-build
WORKDIR /app
COPY target/*.jar app.jar
# Analyze dependent modules of the app
RUN jar xf app.jar
RUN jdeps \
        --ignore-missing-deps \
        --print-module-deps \
        --multi-release 21 \
        --recursive \
        --class-path 'BOOT-INF/lib/*' \
        app.jar > modules.info
# Create a custom Java runtime
RUN $JAVA_HOME/bin/jlink \
        --add-modules $(cat modules.info) \
        --strip-debug \
        --no-man-pages \
        --no-header-files \
        --compress=0 \
        --output /javaruntime
# Define base image
FROM debian:stable-slim
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH "${JAVA_HOME}/bin:${PATH}"
COPY --from=jre-build /javaruntime $JAVA_HOME
# Continue with app deployment
ENV CONFIG_java_opts="-server -XX:+UseG1GC"
COPY extras/glowroot /extras/glowroot
COPY target/*.jar app.jar
ENTRYPOINT exec java $CONFIG_java_opts -javaagent:/extras/glowroot/glowroot.jar -Dglowroot.collector.address=$CONFIG_glowroot_address -Dglowroot.agent.id=$CONFIG_app_name:: -jar /app.jar
```

這邊 `app.jar` 檔一樣大約 65MB，`debian:stable-slim` image 本身大約 75MB，而我最終產出的 image 大約 252MB，也就是說 jlink 產出的 JRE 大約 112MB 而已 (原生的 Java 21 JRE 約 143MB)，這代表除去 `app.jar` 檔以外，image 本身只有 187MB，相較於前一份 Dockerfile 產出的 455MB，大幅縮減了約 288MB

但是當我很開心的運行這個 image 的時候，卻碰到以下的錯誤訊息，導致程式完全無法運行

```plaintext
Error occurred during initialization of VM
agent library failed Agent_OnLoad: instrument
Error opening zip file or JAR manifest missing : /extras/glowroot/glowroot.jar
```

# 問題原因

我整個矇，因為 Glowroot 0.14.2 這版 release 已經出了一個多月，如果 jar 檔有問題，應該很多人都會碰到才對，而且搜尋了一下，還真沒有人開 issue，表示真的沒有其他人碰到這個問題，我只好反求諸己

## 權限問題？

我一開始的思路是權限問題，因為 stackoverflow 上很多碰到 `Error opening zip file or JAR manifest missing` 錯誤訊息的關鍵都是 jar 檔是否存在以及 jar 檔權限問題

首先 image 裡面 `glowroot.jar` 檔肯定是存在的，所以我開始查是不是權限問題，這裡我直接把 Dockerfile 精簡做測試

```dockerfile
FROM eclipse-temurin:21
COPY target/*jar app.jar
ENTRYPOINT exec java -jar /app.jar
```

這樣運行完全沒有問題

於是簡單加上 Glowroot

```dockerfile
FROM eclipse-temurin:21
COPY extras/glowroot /extras/glowroot
COPY target/*jar app.jar
ENTRYPOINT exec java -javaagent:/extras/glowroot/glowroot.jar -Dglowroot.collector.address=$CONFIG_glowroot_address -Dglowroot.agent.id=$CONFIG_app_name:: -jar /app.jar
```

很抱歉，立刻就報 `Error opening zip file or JAR manifest missing` 錯誤

這就很奇怪了，這邊 `glowroot.jar` 複製進 image 的方式跟 `app.jar` 一模一樣，`app.jar` 可以執行，沒有道理 `glowroot.jar` 會不行才對呀？

挖賽，光在這邊我就卡關了兩天，一直查 Dockerfile 權限問題想找出兩個 jar 檔的差異

直到我看到某一篇解答 `Error opening zip file or JAR manifest missing` 錯誤的時候提到

> 除了檢查 jar 檔是否存在及權限以外，也要檢查 jar 檔本身是否毀損

## Jar 檔毀損？

我原本認為我是直接從官方 URL 下載下來的 jar 檔不可能有問題，但死馬當作活馬醫，於是我將 Dockerfile 改成每次都重新抓 Glowroot 的 jar 檔下來試試看

```dockerfile
FROM eclipse-temurin:21
RUN apt-get update && apt-get install unzip
ADD https://github.com/glowroot/glowroot/releases/download/v0.14.2/glowroot-0.14.2-dist.zip /tmp/glowroot.zip
RUN mkdir /extras && unzip /tmp/glowroot.zip -d /extras
COPY target/*jar app.jar
ENTRYPOINT exec java -javaagent:/extras/glowroot/glowroot.jar -Dglowroot.collector.address=$CONFIG_glowroot_address -Dglowroot.agent.id=$CONFIG_app_name:: -jar /app.jar
```

這樣還真的就可以運行了！！！

看來是我 commit 上去的 `glowroot.jar` 檔真的是有問題，但我是從同一個 URL 下載下來的，怎麼可能有什麼問題呢？

## `.gitattributes` 4 ni？！

於是我回到專案本身去查有沒有哪裡有可能動到 jar 檔，最後還真的讓我想到可能的兇手：`.gitattributes`

`.gitattributes` 檔是用來方便 Git 幫我們管理文件的屬性，Git 會在檔案在 repository, staging area 跟 working area 間轉換時，依照 `.gitattributes` 的設定調整對應的檔案，常用於統一設定檔案的換行符號

例如我的專案當中的 `.gitattributes` 如下

```plaintext
* text=auto

* text eol=lf
*.java text eol=lf
*.xml text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
```

就我的理解，除了從第三行開始特別設定的檔案類型以外，Git 會先自己判斷檔案類型是 `text` 或 `binary`，如果是 `text` 類型的檔案，就會自動設定檔案的 eol(end-of-line) 為 `lf`

而一般人應該很自然地就會認為 jar 檔會被判斷為 `binary` 類型而不會受到影響

BUT，就是這個 BUT

我的第三行就設定了所有檔案都預設為 `text`...

而且 Git 在自動判斷檔案是 `text` 或 `binary` 的時候是採用 heuristics 的方式，所以就算讓 Git 自行判斷也不能保證絕對正確

而在我的情況，以往的 `glowroot.jar` 被視為 binary 檔因此沒有被改動，而這次卻被視為 `text` 類型的檔案，因此被 Git 改動而毀損

# 解決辦法

知道問題後就簡單了，在 `.gitattributes` 當中註明 jar 檔不是 text 檔如下

```plaintext
* text=auto

* text eol=lf
*.java text eol=lf
*.xml text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.jar -text
```

所以剛好藉此機會提醒自己，往後設定這種會變動到檔案的部分都要特別注意，在 `.gitattributes` 的部分，最好將所有會被 commit 的檔案類型都列出來，以避免 Git 判斷檔案類型會有出乎意料之外的問題

# 後記

我在查資料的時候，還找到 [gitattributes][3] 這個 repo，裡面紀錄了各種 `.gitattributes` 的樣板，裡面就有 Java 的版本，裡面就有特別將 `*.jar` 設定為 `binary`

還有這個 [網頁版的 `.gitattributes` 產生器][4]，類似 [gitignore.io][5] 的用法，輸入語系就可以依照樣板產出對應的 `.gitattributes` 檔

# Reference

- [Release Version 0.14.2 · glowroot/glowroot][0]
- [jlink][1]
- [Glowroot][2]
- [eclipse-temurin - Official Image | Docker Hub](https://hub.docker.com/_/eclipse-temurin)
- [Using JLink to create smaller Docker images for your Spring Boot Java application](https://medium.com/@snyksec/using-jlink-to-create-smaller-docker-images-for-your-spring-boot-java-application-5e21a3377965)
- [Ways To Reduce JVM Docker Image Size](https://dzone.com/articles/ways-to-reduce-jvm-docker-image-size)
- [Git - gitattributes Documentation](https://git-scm.com/docs/gitattributes)
- [GitHub - gitattributes][3]
- [gitattributes.io - Create .gitattributes file for your project][4]
- [gitignore.io][5]

[0]: https://github.com/glowroot/glowroot/releases/tag/v0.14.2
[1]: https://docs.oracle.com/en/java/javase/11/tools/jlink.html
[2]: https://glowroot.org/
[3]: https://github.com/gitattributes/gitattributes
[4]: https://gitattributes.com/
[5]: https://gitignore.io/
