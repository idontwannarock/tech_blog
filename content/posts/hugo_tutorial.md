---
title: "Hugo 入門教學"
slug: "hugo_tutorial"
date: 2019-05-07T16:03:07+08:00
description: "介紹 Hugo 及基本使用"
tags: ["hugo", "git", "github", "github-pages"]
categories: application
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1568903691/hugo-logo_zjncdo.png"
draft: false
---

我個人在建立部落格的路上碰到了很多問題：

- Wordpress 要花錢，雖然好像不多，但作為一個沒有人看的部落格，這樣還要花錢就是不爽
- 沒有網路無法寫文章，就算寫了純文字的內容，等有網路後貼到 Wordpress 的編輯器還要重新設定字體大小等等
- 沒辦法在自己的電腦或電腦們很方便的做備份，而且我只是個<i>~~簡單的男人~~</i>簡單的部落格，不需要備份一堆只有 Wordpress 能用的東西好嗎
- 不能用工程師宅宅必備命令列工具裝潮，假裝駭客任務
- 最重要的，身為一個工程師宅宅，用 Wordpress 寫部落格說得出口嗎？很顯然可以，但要付錢我就不想用

如果你對以上絕大多數的問題都有切身之痛，那可以考慮繼續閱讀下去，否則建議還是直接使用 Wordpress 或 Wix 吧

# Hugo 與靜態網站

唉唷，還繼續，那大概不是 M 就是工程師宅宅相關種，那靜態網站不用講了，Hugo 自己研究就好啦，本篇結束

<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>

不能醬喔？那好吧

Hugo 是一種 Static Site Generator, SSG 靜態網站產生器，靜態網站簡單來說就是有固定內容的網站，所謂的固定內容就是 HTML 這種瀏覽器可以直接開啟的網頁檔案，配合 CSS, Javascript 做美化，這些檔案只要沒有被修改過，每次打開都會產生固定的內容，所以稱為靜態網站

而基於後面會提到 Hugo 這個工具的特性，它很適合用來產生部落格，使用者只需要撰寫 Markdown 這種純文字檔案作為每篇文章的內容，就可以透過 Hugo 快速的建立或修改網站，而不必每次都要修改相對應的 HTML 甚至 CSS 及 Javascript 檔案

Hugo 作為一個世界範圍內前三熱門的 SSG 工具，它還有很多熱心工程師宅宅幫他寫了很多佈景主題讓使用者可以直接套用來產生網站，所以使用者只需要把文章內容寫成 Markdown 這種純文字檔案，就可以直接用 Hugo 將文章按照佈景主題產生出美美的網站了

# 這樣誰看的到？

不過這樣產生出來的網站有一個關鍵的問題，這些檔案只放在你電腦裡，沒人看得到，除了你自己

所以我們需要「把它放到網路上」

一般要做到「把它放到網路上」並且「誰都看得見」，其實要做很多事情，例如租用網路空間、買域名、部署網站等等，Wordpress 的好處就在這，它提供一條龍的服務幫你做到底

但現在沒有 Wordpress 而且要堅持不花錢的懶惰工程師宅宅原則，所以我們要走另一條路，使用 Git 跟 GitHub

# Git、GitHub 與 GitHub Pages

Git 是一種版本控制工具，簡單來說就是可以保存每次改動檔案的紀錄的工具，所以要做修改或要放棄修改，也不會因為存了檔或沒存檔就整個完蛋

GitHub 可以理解為一個全世界最多工程師宅宅在用的<i>~~交友網站~~</i>免費空間，只不過它原生就支援 Git 可以對你放在這個免費空間的檔案做版本控制，也可以直接跟你電腦上的 Git 做同步

GitHub 有幾個好處，裝潮、幾乎無限空間、免費，對，免費，免費就贏 Wordpress 了

GitHub 還有一個方便的功能，就是它可以根據你放在空間中的靜態檔案自動建立一個靜態網站，還自帶域名，不用付錢給 Wordpress、GoDaddy 或中華電信，也就是我們要用的 GitHub Pages

# 安裝 Hugo

坐而言不如起而行，沒有能不能只有行不行，高雄發大財！

首先有關安裝 Hugo，順帶說明一下 Hugo 雖然是用 Go 寫得，但跟其他也很紅的 SSG 如 Jekyll 要裝 Ruby 或 Hexo 要裝 Node.js 跟 NPM 不同，它不用安裝 Go，所以可以直接裝 Hugo 就好

當然安裝 Hugo 有幾種方式，[官方說明](https://gohugo.io/getting-started/installing)中說可以直接下載 Binary 檔然後自己設定變數，MacOS 系統推薦用 Homebrew 做安裝，Windows 系統推薦用 Chocolatey 或 Scoop

我是推薦用 Homebrew 或 Chocolatey 這種管理工具，這樣你就不用自己設定變數，安裝跟解安裝都很方便，要升級也很方便

Hugo 的操作都在命令列執行，所以MacOS 請打開 Terminal 終端機或 iTerm2 這種命令列工具，Windows 開 Powershell，輸入以下命令做安裝

```bash
// MacOs
brew install hugo

// Windows
choco install hugo
// or
scoop install hugo
```

裝完之後，輸入以下命令檢查有沒有裝好

```bash
hugo version
```

應該會出現類似以下這行訊息，有出現就 ok 啦

> Hugo Static Site Generator v0.55.5-A83256B9 windows/amd64 BuildDate: 2019-05-02T13:04:07Z

# 建立新網站

一樣在命令列工具輸入命令就可以產生一個基本的靜態網站

但記得要先移動到你要建立這網站檔案的目錄底下，MacOS 幾乎都是用 `cd <目錄名稱>` 就可以，Windows 比較麻煩要先確定是在哪一個磁碟機， `<磁碟機編號>:` 可以移動到該磁碟機，例如 `C:` 就是移到 C 槽，然後再用 `cd <目錄名稱>` 移動到目的地的目錄

要回到上一層資料夾則用 `cd..`

移動的過程中，如果你不清楚目前資料夾底下有哪些資料夾跟檔案，或不知道資料夾完整名稱，可以簡單用 `ls` 命令來列出資料夾跟檔案名稱列表

如果要建立資料夾，可用以下命令

```bash
mkdir <資料夾名稱>
```

移動到目的地資料夾後，再輸入以下命令

```bash
hugo new site <網站名稱>
```

Hugo 預設會直接用你給的網站名稱，假設就叫 test，在當前目錄底下建立 test 資料夾，並將網站生成在該資料夾中

# 安裝佈景主題

再來講一下不是必須但可以浪費很多生命的安裝佈景主題

有兩種做法，簡單跟裝逼

先講簡單

就是到 [Hugo Themes](https://themes.gohugo.io/) 這個網站選一個主題，以下都以 [aether](https://themes.gohugo.io/aether/) 來舉例，不要問為什麼，問了就不簡單了

首先要先下載主題包，所以點 [aether](https://themes.gohugo.io/aether/) 網頁中的 Download 按鈕；再點綠色的 Clone or download 按鈕，然後點 Download ZIP 下載壓縮檔

然後在剛建立的 Hugo 網站 test 資料夾中建立一個 themes 資料夾，然後將主題包解壓縮到 themes 資料夾，應該會產生一個 aether-master 資料夾，裡面是一堆不知道在幹嘛的檔案

不要緊張，先回到 test 資料夾，打開那個唯一的檔案 config.toml，這是個純文字檔，所以看你是要用筆記本、WordPad 或隨便什麼文字編輯器打開都可以

裡面目前大概只有這樣

```toml
baseURL = "http://example.org/"
languageCode = "en-us"
title = "My New Hugo Site"
```

但我們應該起碼要將它填到這樣

```toml
baseURL = "https://yourwebsitenamegoeshere.com/"
languageCode = "The language code for the language the website is written in"
title = "The website title that is used in each page title, displayed in the browser tab and search results"
theme = "aether"
googleAnalytics = "Your google analytics tracking ID - optional"
disqusShortname = "Your shortname for Disqus - optional"

[params]
brand = "The name that is displayed in the top left of the website, consider it the website name"
description = "The website's description"
homeimg = "URL to the image used for the home button at the bottom of each post - optional"
bgimg = "URL to the image used for the page background - optional"
```

其中有 `- optional` 的選項都不是必填，像是 googleAnalytics 跟 disqusShortname；如果不想填，就在該行最左邊加一個 `#`

簡單的大概是降

裝逼的做法首先你電腦要裝好 Git，什麼？你不會，那你裝什麼逼？

總之一樣到 [aether](https://themes.gohugo.io/aether/) 主題的 [GitHub Repo 頁面](https://github.com/josephhutch/aether) 請流利的使用 Git 指令將這個主題用 `git submodule` 的方式加到 test 資料夾下的 themes 資料夾

然後一樣針對 config.toml 檔案做設定

安裝佈景主題的流程就降

# 新增文章

使用以下命令，可以生成一篇新的 Markdown 檔，裡面就可以撰寫你的部落格文章內容，但要記得利用 Markdown 語法，各種方便啊

```bash
hugo new post/<文章檔案名稱>.md
```

注意 `post/` 不能省略，這是 aether 這個主題預設會掃描文章內容的資料夾，如果你放錯位置，那文章就白寫了好嗎

# 測試網站

裝好主題也寫好文章以後，想看一下網站實際上長怎樣，就在命令列輸入以下命令

```bash
hugo server -D
```

然後隨便開一個瀏覽器，在網址列輸入 `http://localhost:1313/` 就可以看到成果啦

測試完畢就按 Ctrl + C 結束

# 生成網站

剛才只是在自己的電腦上模擬生成的網站，但實際上真正可以讓瀏覽器直接開啟的靜態網站並沒有永久生成，在你按下 Ctrl + C 或關掉命令列工具的同時，它就死了哭哭

所以現在要來真正的生成靜態網站的檔案，其實就是在 test 資料夾輸入 `hugo`，Hugo 就會自動在 test 資料夾底下建立 public 資料夾，並在 public 資料夾依照 config.toml 裡選擇的 theme 生成靜態網站，而這步驟生成的靜態網站內容，其實就跟上一步你在測試網站看到的內容一模一樣

不信你可以用瀏覽器打開 public 資料夾中的 index.html 檔案就知道了

# GitHub Pages

最後我們來解決「把它放到網路上」這個問題

前面說了要用 GitHub Pages，但並不是說這個世界上只有 GitHub Pages 才有這種免費的功能啊，只是這邊用它舉例，你也可以自己玩玩看 GitLab Pages，基本上是一樣的概念，但還自帶 CI/CD 功能，CI/CD 是什麼請點 [這裡](http://bfy.tw/BJQS)

請先自己到 GitHub 申請個帳號，免費；然後新增一個 Repository，名字隨意，或可以取得跟你網站資料夾一樣的名字方便你之後辨識

不會申請或開 repo？不會自己 google 啊？申請免費帳號這種事情還要我教？

接著我們要把網站搬到新建的 repo 中，這邊也有簡單跟裝逼兩種做法

一樣先講簡單

請進入剛生成靜態網站檔案的 public 資料夾，然後全選，用拖曳的方式直接拉到新建 repo 的頁面當中，它就會自己上傳了，就這麼簡單

但記得之後每新增一篇文章就要做一次 [生成網站](#生成網站) 這段的內容，然後再將 public 資料夾裡面的東西整個上傳到 GitHub repo 中

接著點 Settings，往下拉到倒數第二個區塊 GitHub Pages，然後點第一個下拉選單選 master branch，應該就會出現你的網站網址，如此就大功告成啦！可喜可賀可喜可賀

最後講一下裝逼做法

為了適應到不同電腦都能同步作業，而且不會變動到部落格基本設定的目的，我們會希望把整個 test 資料夾上傳

所以要先在 config.toml 裡面新增一行 `publishDir = "docs"` 讓生成靜態網站的資料夾從 public 改為 docs

然後用 `git add .`、`git commit -m "<commit message>"`、`git push` 的組合技把整個 test 資料夾 push 到指定的 repo master branch

最後到 Settings 的 GitHub Pages 區塊，下拉選單選 master branch /docs folder，如此 GitHub 就會自動讀取 docs 資料夾中的靜態網站資料

什麼？你跟我說不會 Git？再說一次，那你裝什麼逼？