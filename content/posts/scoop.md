---
title: "Scoop 介紹及用法"
date: 2023-06-20T10:51:39+08:00
slug: "scoop"
description: "簡介 Scoop 及使用 Scoop 切換 JDK 版本"
tags: ["scoop", "jdk"]
categories: "implementation"
featured_image: "https://avatars.githubusercontent.com/u/16618068?v=4"
draft: false
comment: true
enableLaTeX: false
---
Linux 有 [apt](https://salsa.debian.org/apt-team/apt), [yum](http://yum.baseurl.org/gitweb/)、MacOS 有 [Homebrew](https://brew.sh/)、Windows 有 [Chocolatey](https://chocolatey.org/)

但今天要介紹 Windows 環境的另外一個 command line 套件管理工具 [Scoop](https://scoop.sh/)

在 Windows 環境，比較有名的 command line 套件管理工具是 Chocolatey，但今天要介紹的 Scoop 有一項 Chocolatey 沒辦法做到的好處，就是可以切換 Path Environment Variable

# 安裝

Scoop 的安裝非常簡單，打開 **非** Administrator (系統管理員) 的 Powershell，並輸入以下指令即可安裝

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

# 使用

Scoop 既然是套件管理工具，那重要的工作就是安裝套件，而 Scoop 有支援什麼套件固然可以直接 Google 的到，但其實也不是沒有方式直接在 command line 搜尋

例如想安裝 7zip 壓縮工具，可以在 powershell 當中這樣搜尋

```powershell
scoop search 7zip
```

應該會出現如下的結果

![Scoop Search Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230278/Tech%20Blog/Scoop/image-20230620-014307.png)

第一行說明代表這次結果是在本地的 bucket 當中搜尋到的，表格當中的 Name 就是套件名稱，之後所有操作都要輸入 Name 當中顯示的完整名稱，Source 就是指套件所在的 bucket

這邊如果你不確定是哪個套件名稱，也可以用以下指令看一下簡介，例如

```powershell
scoop info 7zip
```

![Scoop Info Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230369/Tech%20Blog/Scoop/image-20230620-014436.png)

這時候確定要安裝哪一個套件名稱，這時候就可以輸入以下指令做安裝

```powershell
scoop install 7zip
```

這時候 console 會顯示經過一連串的操作，最後看到這一行就代表安裝成功

![Scoop Installation Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230433/Tech%20Blog/Scoop/image-20230620-014915.png)

如果要解除安裝也是簡單輸入以下指令

```powershell
scoop uninstall 7zip
```

![Scoop Uninstallation Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230487/Tech%20Blog/Scoop/image-20230620-015010.png)

如果想查詢本地安裝了哪些套件

```powershell
scoop list
```

![Scoop Local Installed App Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230536/Tech%20Blog/Scoop/image-20230620-021418.png)

也可以搜尋本地安裝的套件名稱

```powershell
scoop list maven
```

![Scoop Search Local Installed App Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230599/Tech%20Blog/Scoop/image-20230620-021507.png)

最後如果要更新某個套件，可以輸入

```powershell
scoop update maven
```

## Bucket

接著這邊要了解的是 Scoop 並不像 Chocolatey 的搜尋是在網路上對所有套件做即時搜尋，Scoop 有 bucket 的概念，每個 bucket 都像是一組套件的資料夾

在安裝 Scoop 時就會預設安裝 main bucket，裡面應該預設就有一千多種常用套件，而 Scoop 的搜尋也是優先在本地已安裝的 bucket 裡面做搜尋，如果本地的 bucket 搜尋不到，才會到網路上其他已知 (known) 的 bucket 中做搜尋

![Scoop Remote Search Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230679/Tech%20Blog/Scoop/image-20230620-020010.png)

所以首先想要確認本地安裝了哪些 bucket 就輸入以下指令

```powershell
scoop bucket list
```

![Scoop Local Installed Bucket Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230729/Tech%20Blog/Scoop/image-20230620-015142.png)

如果想查詢有哪些已知的 bucket (本地及遠端)

```powershell
scoop bucket known
```

![Scoop Known Bucket Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230786/Tech%20Blog/Scoop/image-20230620-015400.png)

但這個列表也許已過時，這時候可以輸入以下指令更新 Scoop 後，再做查詢

```powershell
scoop update
```

![Scoop Update Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230834/Tech%20Blog/Scoop/image-20230620-015513.png)

如果想安裝指定 bucket 到本地

```powershell
scoop bucket add games
```

![Scoop Add Bucket Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230885/Tech%20Blog/Scoop/image-20230620-020309.png)

移除 bucket

```powershell
scoop bucket rm games
```

以上差不多就是 Scoop 常見的基本用法

# JDK 切換

有一種情境我們會安裝某一種套件，但要同時安裝多種版本，使用的時候需要切換不同的版本，例如安裝 JDK，可能會需要同時安裝 1.8、11 甚至 17，但使用的時候會需要按照需要執行的專案來切換不同版本的環境變數

在 Unix-like 的環境，大多都可以使用 [SDKMAN](https://sdkman.io/)，但偏偏 SDKMAN 原生並不支援在 Powershell 操作，只能透過 [Cygwin](https://www.cygwin.com/) 等方式 workaround，但同時也限制環境變數只在 Cygwin 當中生效，而無法使用 Powershell 操作

如果要在 Powershell 中操作，以往只能安裝好 JDK 後，再設定環境變數 JAVA_HOME 指定到安裝好的位置，然後每次要使用不同 JDK 版本，就要手動修改 JAVA_HOME 環境變數，或輸入不太好記的指令去操作，如果 JDK 版本更新，又要整個重頭再來，相當的麻煩

但 Scoop 本身提供了相當方便的指令，可以如 SDKMAN 一樣簡單的安裝多種不同版本的 JDK，並且在需要的時候非常簡單的切換不同的版本

首先我們可以先安裝幾種不同版本的 JDK

```powershell
scoop bucket add java
scoop install zulu-jdk
scoop install zulu11-jdk
```

![Scoop List Local JDK Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687230995/Tech%20Blog/Scoop/image-20230620-021710.png)

此時我們本地已安裝了 11 及 20 兩種版本的 JDK，在安裝的時候就會自動設定好環境變數

![Java Version after JDKs Installation](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687231043/Tech%20Blog/Scoop/image-20230620-021833.png)

![JDK Position after JDKs Installation](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687231095/Tech%20Blog/Scoop/image-20230620-022019.png)

接著如果我們要切換使用 JDK 20

```powershell
scoop reset zulu-jdk
```

![Scoop Reset JDK Version Result](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687231153/Tech%20Blog/Scoop/image-20230620-022207.png)

![Java Version after Scoop Reset](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687231188/Tech%20Blog/Scoop/image-20230620-022226.png)

![JDK Position after Scoop Reset](https://res.cloudinary.com/dcvgho2zc/image/upload/v1687231222/Tech%20Blog/Scoop/image-20230620-022245.png)

這時我們就可以看到 Java 的版本被改變了

# Reference

- [Scoop](https://scoop.sh/)
- [How to Install and Use the Scoop Windows Package Manager](https://adamtheautomator.com/scoop-windows/)
- [SDKMAN](https://sdkman.io/)
- [Cygwin](https://www.cygwin.com/)
- [通过Scoop安装和切换Java(JDK)、Python、Ruby的版本](https://www.thisfaner.com/p/install-and-switch-versions-of-java-python-ruby-via-scoop/)
