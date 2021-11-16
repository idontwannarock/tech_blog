---
title: "2nd Practice: Retina Morning Post"
slug: "retina_morning_post"
date: 2017-09-15T09:44:03+08:00
description: "100 個練習計畫：第二個練習"
tags: ["html", "css", "javascript"]
categories: practice
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1505440548/Tech%20Blog/2nd-practice-cover_pyfetr.jpg"
draft: false
comment: true
---

# 第二個目標

練習報紙排版。

- 作品：[視網膜早報](https://goo.gl/ZEByGt)
- 參考：[視網膜 Retina](https://www.facebook.com/EYECTVretina/) [FB圖片](https://goo.gl/iy9tFF)

# 遇到困難

## 分散對齊

首先遇到的問題就是要讓文字分散對齊，原本以為用 `text-align: justify;` 可以解決，結果才發現這只能用在超過一行的文字上哭哭。

然後查到一個 jQuery 解法如下，我大概理解原理，但細節還待研究。簡單來說就是算每個字元平均要佔該 `div` 多少 `width` 來作分散對齊。
    
```javascript
$.fn.strech_text = function(){
    var elmt = $(this),
    cont_width = elmt.width(),
    txt = elmt.html(),
    one_line = $('' + txt + ''),
    nb_char = elmt.text().length,
    spacing = cont_width/nb_char,
    txt_width;

    elmt.html(one_line);
    txt_width = one_line.width();

    if (txt_width < cont_width){
        var char_width = txt_width/nb_char,
        ltr_spacing = spacing - char_width + (spacing - char_width)/nb_char;

        one_line.css({'letter-spacing': ltr_spacing});
    } else {
        one_line.contents().unwrap();
        elmt.addClass('justify');
    }
};

$(document).ready(function () {
    $('.stretch').each(function(){
        $(this).strech_text();
    });
});
```

然後幫各 `div` 設定 `class="stretch"`，並且一定要設定 `width` 才能算。

## 水平向下對齊

然後碰到第二個問題是水平的欄位如何向下對齊，其實後來查了一下。這個問題好像並不應該很難，只能說我觀念不夠清晰。

總之解決的辦法是針對包住水平欄位的 `container` 設定 `position: relative;`，然後各欄位設定 `position: absolute;`，再用 `top`、`right`、`bottom`、`left` 去調位置就可以了。

`position` 的 `absolute` 跟 `relative` 好難懂 R 囧>

## 分隔線加粗

好，這其實不算問題，只是我忘了加粗的敘述去 google 發現了一種可以相容舊 IE 的方法，藉此作個紀錄，如下：
    
```
hr {
    border: none;
    height: 1px;
    /* Set the hr color */
    color: #333; /* old IE */
    background-color: #333; /* Modern Browsers */
}
```

## 縱排文字

這本來是我認為這個 project 最難的部分，結果 google 到好幾種做法，其中一種解法我覺得超級天才！是開發商 cmonos 作的 taketori-js，還開源！

先用 CSS 的 `transform` 把整個 `block` 轉 +90 度，然後偵測裡面的漢字分別用 `span` 包起來轉 -90 度，再處理斷行與標點等等。這個解法真的太強，實用！

Github 開源：[TAKETORI-JS](https://github.com/cmonos/TAKETORI-JS)

# 感想

切版真的麻煩，而且我還沒做適應手機大小的版本，不過考慮到這是舊報紙版型，沒有也很正常對吧？（其實只是懶）