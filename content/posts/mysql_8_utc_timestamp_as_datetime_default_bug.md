---
title: "MySQL 8.0 使用 UTC_TIMESTAMP() 當作 DATETIME 欄位預設值 bug"
date: 2023-10-31T11:59:03+08:00
slug: "mysql_8_utc_timestamp_as_datetime_default_bug"
description: "描述在使用 MySQL 8.0 早期版本當中，採用 UTC_TIMESTAMP() function 當作 DATETIME 型態欄位預設值的 bug"
tags: ["mysql", "utc_timestamp", "datetime"]
categories: "bug"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

# 情境描述

最近在處理 MySQL 的時候採到一個坑

我的使用情境是需要一個 create date 紀錄資料產生時的 UTC 時間精準到 millisecond

首先考慮到 MySQL 的 `TIMESTAMP` 資料型態是採用 epoch second 加上額外的 fractional seconds 精準到 microseconds，也就是最多記錄到 '2038-01-19 03:14:07.999999' 就會 overflow，如果採用 `DATETIME(3)` 可以記錄到 '9999-12-31 23:59:59.999'

接著因為欄位必填，所以考慮設定預設值，此時有幾種選擇，`NOW()`、`CURRENT_TIMESTAMP`、`UTC_TIMESTAMP`，其中 `NOW()` 與 `CURRENT_TIMESTAMP` 都會依照 MySQL 系統時區產生時間，但是 `DATETIME` 並不保存時區資訊，所以為了避免時區問題，所以選擇預設值設定為 `(UTC_TIMESTAMP(3))`，剛好在 8.0.13 開始可以將 `DATETIME` 資料型態的欄位預設值設為 function `(UTC_TIMESTAMP())`

但是設定完後發生了很奇怪的問題，後續進行的 `ALTER TABLE` DDL 操作都會失敗並拋出 `ERROR 1067: Invalid default value for <columnName>` 錯誤，例如執行以下 sql

```sql
ALTER TABLE tableName ADD COLUMN newColumnName BIGINT NULL;
```

明明新增的是 `BIGINT` 而且沒有預設值，卻拋出 `ERROR 1067: Invalid default value for createdDateColumn` 的錯誤，簡直莫名其妙讓人丈二和尚摸不著頭腦

# Bug 狀況

經過確認是 MySQL 在 8.0.23 以前的 bug，在 8.0.24 之後已經修正，可以參考這張 [bug report](https://bugs.mysql.com/bug.php?id=101486) 的描述

簡單來說就是如果在 table 中有欄位的預設值不是 constant，例如我使用的 `(UTC_TIMESTAMP(3))`，則後續的 `ALTER TABLE` DDL 操作都會失敗並拋出 1067 錯誤

# 重現步驟

建議使用 docker 啟動一個 8.0.13-8.0.23 之間版本的 MySQL

```sh
docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql:8.0.23
```

然後連上 MySQL

```sh
docker exec -it some-mysql bash
mysql -uroot -p
```

建立 table

```sql
use test;
create table test_timestamp (id int not null auto_increment, created datetime not null default (utc_timestamp()), primary key (id));
```

此時執行 `ALTER TABLE` DDL

```sql
alter table test_timestamp add column test varchar(63) null;
```

應該就會看到 `ERROR 1067: Invalid default value for created` 的錯誤訊息

# 解決方式

以我碰到的情況而言其實有兩種解決方式

第一種就是乖乖升級，bug 自解

第二種就是 bug report 裡面有人提出來的 workaround 方式

流程大致上就是把原本設定為 `UTC_TIMESTAMP()` function 的欄位預設值改為 `CURRENT_TIMESTAMP()` function，然後執行原本預定要執行的 `ALTER TABLE` DDL，最後再把 `CURRENT_TIMESTAMP()` 的欄位型態改回 `UTC_TIMESTAMP()` function 即可

這兩個方式我都實測過可行，但各有需要考慮的狀況

第一種方式當然是怕升級過程有 downtime 或甚至其他升級失敗的狀況，這主要就考驗公司 SRE 之類單位的強度

第二種方式則是要自己考量在改成 `CURRENT_TIMESTAMP()` 期間產生髒資料的處理，例如可能新增的一筆資料時區可能不是 UTC 的問題，如果時區是 UTC+X 的還好處理，如果是 UTC-X 的就會很麻煩，可能要預先做其他處理，例如可能要額外新增時區欄位

# Reference

- [11.2.2 The DATE, DATETIME, and TIMESTAMP Types](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)
- [Changes in MySQL 8.0.13 (2018-10-22, General Availability)#Data Type Notes](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-13.html#mysqld-8-0-13-data-types)
- [Error when UTC_TIMESTAMP set as default value](https://bugs.mysql.com/bug.php?id=101486)
- [Changes in MySQL 8.0.24 (2021-04-20, General Availability)#Bug Fixed](https://dev.mysql.com/doc/relnotes/mysql/8.0/en/news-8-0-24.html#mysqld-8-0-24-bug)
