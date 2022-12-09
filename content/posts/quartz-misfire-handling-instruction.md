---
title: "Quartz Misfire Handling Instruction"
date: 2022-11-29T15:21:19+08:00
slug: "quartz-misfire-handling-instruction"
description: "介紹 Quartz 遇到 misfire 的各種 handling instruction 跟情境"
tags: ["quartz", "misfire"]
categories: "concept"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

Quartz 系列：

- [Quartz 介紹]({{< relref "quartz-intro" >}})
- [Spring Boot 整合 Quartz 集群執行預設及動態排程]({{< relref "quartz-cluster-fixed-and-dynamic-trigger-spring-boot-integration" >}})
- Quartz Misfire Handling Instruction

使用 Quartz 來幫助排程管理很方便，但還有一個需要注意的地方，就是設定 misfire handling instruction

# Misfire 概念

首先要來釐清在 Quartz 的架構下，什麼情況能稱為 misfire，其實講到底就只有一種：「Job 在到達預定該觸發的時間未觸發」

但怎樣算是未觸發，其實主要有兩個條件，第一個是設定的「觸發時間」，第二個則是「`misfireThreshold`」

舉例來說如果有一個 Job 設定 12:00 觸發，並且 Quartz 的 `misfireThreshold` 設定為 2min，因此當我在 12:01 準備要執行的時候，因為已經超過設定的觸發時間，但還沒有超過 `misfireThreshold` 的 2min，所以並不會被 Quartz 認為是 misfire

那另一方面來說，以同樣的例子而言，如果 Quartz 準備要執行的時候已經是 12:03，那這個 Job 的這次執行就會被認為是 misfire，這時候 Quartz 就會依照設定好的 misfire handling instruction 來執行未觸發時的動作

這樣舉例就能很清楚的理解 `misfireThreshold` 的意義

> 要在 Spring Boot 整合 Quartz 專案中設定 `misfireThreshold`，可在 properties 檔中設定 `spring.quartz.properties.org.quartz.jobStore.misfireThreshold=60000`，這個參數的 default 就是 60000 milliseconds 也就是一分鐘

而 misfire handling instruction 會因為不同類型的 Trigger 而會有些不同，以下來討論常見的 `SimpleTrigger` 跟 `CronTrigger` 有提供的 misfire handling instruction

# Misfire Handling Instruction

## SimpleTrigger

以 `SimpleTrigger` 來說，有提供以下七種 misfire handling instruction：

- `MISFIRE_INSTRUCTION_SMART_POLICY`
- `MISFIRE_INSTRUCTION_IGNORE_MISFIRE_POLICY`
- `MISFIRE_INSTRUCTION_FIRE_NOW`
- `MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_EXISTING_COUNT`
- `MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`
- `MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT`
- `MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`

因為 `SimpleTrigger` 有分為「不重複執行」、「執行固定次數」及「無限次執行」三種狀況，所以各種 misfire handling instruction 的實際執行狀況就會有所不同

### 不重複執行

|Instruction|解釋|情境舉例|
|:--|:--|:--|
|`MISFIRE_INSTRUCTION_SMART_POLICY`|同 `MISFIRE_INSTRUCTION_FIRE_NOW`||
|`MISFIRE_INSTRUCTION_IGNORE_MISFIRE_POLICY`|同 `MISFIRE_INSTRUCTION_FIRE_NOW`||
|`MISFIRE_INSTRUCTION_FIRE_NOW`|當 Quartz 發現 job misfire，會立刻執行|例如有個原本預計在 12:00 執行的系統清理的 job，但 Quartz 應用程式可能因為維護的關係，13:00 才啟動<br>所以 scheduler 在 13:00 一啟動的時候，就會立刻執行 misfire 的那次 job|
|`MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_EXISTING_COUNT`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`||
|`MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`|因為已經沒有下一次觸發，所以不執行任何動作|例如預計錄製一個電視節目，如果已經超過兩個小時才發現 misfire，已經沒有必要再執行錄製的工作|
|`MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT`|同 `MISFIRE_INSTRUCTION_FIRE_NOW`||
|`MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`|同 `MISFIRE_INSTRUCTION_FIRE_NOW`||

### 執行固定次數

例如有個從今天 9:00 開始每隔一個小時執行一次，總共執行 8 次的任務，正常情況下應該在 16:00 執行最後一次

但因為某種原因 scheduler 沒辦法執行 9:00 跟 10:00 這兩次任務，並且直到 10:15 才發現有 2 次 misfire:

|Instruction|解釋|情境舉例|
|:--|:--|:--|
|`MISFIRE_INSTRUCTION_SMART_POLICY`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT`||
|`MISFIRE_INSTRUCTION_IGNORE_MISFIRE_POLICY`|以最快的速度執行所有 misfire 的 job，然後再回到正常的 schedule|scheduler  會以最快的速度執行 9:00 及 10:00 這兩次 misfire 的 job，並等到 11:00 回復到正常的排程|
|`MISFIRE_INSTRUCTION_FIRE_NOW`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`||
|`MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_EXISTING_COUNT`|scheduler 當下不會做任何動作，而是依照設定的執行間隔，在下一次預定執行的時間，重新開始執行所有 misfire 的任務|scheduler 會等到 11:00 再開始重新以每小時執行一次的間隔，依序執行原定的任務直到 18:00 結束|
|`MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`|scheduler 會放棄 misfire 的任務，等到下次執行的時間，執行剩下的任務<br>**任務總執行次數會比原本預計的較少**|scheduler 10:15 發現有 2 次 misfire，但會執行放棄那兩次 misfire，仍然等到 11:00 開始執行下次任務直到原訂的 16:00<br>所以總執行次數只會有 6 次，而不是原定的 8 次|
|`MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT`|第一次 misfire 會被立刻執行，其餘的 misfire 及原定任務會被以設定好的執行間隔，重新排程執行<br>**任務總執行次數不會改變**|當 scheduler 10:15 發現有 2 次 misfire 時，第一個 misfire 會被立刻執行，然後 scheduler 會等待一個小時到 11:15 執行第二次任務，最後 8 次任務執行結束的時間為 17:15|
|`MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`|第一次 misfire 會被立刻執行，其他的 misfire 會被放棄，scheduler 會以設定好的執行間隔，重新排程執行剩下未被 misfire 的任務<br>**如果 misfire 超過一次，任務總執行次數會比原本預定地少**|當 scheduler 10:15 發現有 2 次 misfire 時，第一個 misfire 會被立刻執行，第二個 misfire 會被放棄，然後 scheduler 會等待一個小時到 11:15 執行剩下的任務，最後 7 次任務執行結束時間為 16:15|

### 無限次執行

例如有一個任務從 9:00 開始每隔一個小時觸發，但因為某種原因 scheduler 沒辦法執行 9:00 跟 10:00 這兩次任務，並且直到 10:15 才發現有 2 次 misfire:

|Instruction|解釋|情境舉例|
|:--|:--|:--|
|`MISFIRE_INSTRUCTION_SMART_POLICY`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`||
|`MISFIRE_INSTRUCTION_IGNORE_MISFIRE_POLICY`|以最快的速度執行所有 misfire 的 job，然後再回到正常的 schedule|scheduler  會以最快的速度執行 9:00 及 10:00 這兩次 misfire 的 job，並等到 11:00 回復到正常的排程|
|`MISFIRE_INSTRUCTION_FIRE_NOW`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`||
|`MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_EXISTING_COUNT`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`||
|`MISFIRE_INSTRUCTION_RESCHEDULE_NEXT_WITH_REMAINING_COUNT`|scheduler 會放棄 misfire 的任務，等到下次執行的時間，執行接下來的任務|scheduler 10:15 發現有 2 次 misfire，但會執行放棄那兩次 misfire，等到 11:00 開始執行下次任務|
|`MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_EXISTING_REPEAT_COUNT`|同 `MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`||
|`MISFIRE_INSTRUCTION_RESCHEDULE_NOW_WITH_REMAINING_REPEAT_COUNT`|第一次 misfire 會被立刻執行，其他的 misfire 會被放棄，scheduler 會以設定好的執行間隔，重新排程執行接下來的任務|當 scheduler 10:15 發現有 2 次 misfire 時，第一個 misfire 會被立刻執行，第二個 misfire 會被放棄，然後 scheduler 會等待一個小時到 11:15 執行接下來的任務|

## CronTrigger

`CronTrigger` 有提供以下四種 misfire handling instruction:

- `MISFIRE_INSTRUCTION_SMART_POLICY`
- `MISFIRE_INSTRUCTION_IGNORE_MISFIRE_POLICY`
- `MISFIRE_INSTRUCTION_FIRE_ONCE_NOW`
- `MISFIRE_INSTRUCTION_DO_NOTHING`

舉例來說，我們安排了一個星期一到五，每天 9:00 到 17:00 之間，每隔一個小時執行一次的任務 (`0 0 9-17 ? * MON-FRI`)，但同樣的錯過了頭兩次執行，並在 10:15 發現有兩次 misfire:

|Instruction|解釋|情境舉例|
|:--|:--|:--|
|`MISFIRE_INSTRUCTION_SMART_POLICY`|同 `MISFIRE_INSTRUCTION_FIRE_ONCE_NOW`||
|`MISFIRE_INSTRUCTION_IGNORE_MISFIRE_POLICY`|以最快的速度執行所有 misfire 的 job，然後再回到正常的 schedule|scheduler  會以最快的速度執行 9:00 及 10:00 這兩次 misfire 的 job，並等到 11:00 回復到正常的排程|
|`MISFIRE_INSTRUCTION_FIRE_ONCE_NOW`|第一次 misfire 會被立刻執行，其他的 misfire 會被放棄，等到下次執行的時間，執行接下來的任務|當 scheduler 10:15 發現有 2 次 misfire 時，第一個 misfire 會被立刻執行，第二個 misfire 會被放棄，然後 scheduler 會等到 11:00 開始執行下次任務|
|`MISFIRE_INSTRUCTION_DO_NOTHING`|scheduler 會放棄 misfire 的任務，等到下次執行的時間，執行接下來的任務|scheduler 10:15 發現有 2 次 misfire，但會執行放棄那兩次 misfire，等到 11:00 開始執行下次任務|

另外可以注意的是，還有以下兩種 trigger 也支援跟 `CronTrigger` 相同的 misfire handling instruction:

- `DailyTimeIntervalTrigger`: 例如每 25 分鐘執行一次
- `CalendarIntervalTrigger`: 例如每五個月執行一次

# 參考

- [Quartz scheduler misfire instructions explained](https://nurkiewicz.com/2012/04/quartz-scheduler-misfire-instructions.html)