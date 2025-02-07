---
title: "如何在 MySQL 中進行 insert if not exists"
date: 2025-02-07T09:39:10+08:00
slug: "how_to_insert_if_not_exists_in_mysql"
description: "探討在 MySQL 當中如何用單一 statement 進行 insert if not exists"
tags: ["mysql", "insert"]
categories: "Implementation"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

相信很多 Developer 都會真心的 *~幹譙~* 懷疑為什麼 MySQL 經過這麼多年都沒有 PostgreSQL 的 `INSERT … ON DUPLICATE KEY DO NOTHING` 語法，偏偏這真的是一個很常會碰到的使用情境

所以接下來探討一些單一 SQL 語法方面可行的做法

## 準備

環境為 MySQL server 8.0.37

首先建立以下 table (只是為了情境驗證，合理性就先不計較)

```sql
drop table if exists test_user;
create table if not exists test_user (
    id int unsigned auto_increment primary key,
    user_id int unsigned not null,
    is_active boolean not null default 1,
    constraint uk_user_id_user unique (user_id)
) engine = innodb charset = utf8mb4 collate = utf8mb4_0900_ai_ci;
```

情境就是要在表中新增一筆 user 紀錄，如果該 user id 已經存在，就不做任何變更

> 每個情境測試前都會重新建立整個 table，以避免其他問題影響測試結果
>
> 取得 auto increment 數字前，可能需要 `analyze table` 以校正數據

## `insert`

第一個方法就是直接 `insert`

```sql
mysql> insert into test_user (user_id) value (1);
Query OK, 1 row affected (0.01 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert into test_user (user_id) value (1);
ERROR 1062 (23000): Duplicate entry '1' for key 'test_user.uk_user_id_user'

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              3 |
+------------+----------------+
1 row in set (0.00 sec)
```

可以看到功能完全可以達成

但是有以下兩個問題

- 第二次以後的 `insert` 就會直接噴 duplicate key error
- 即使第二次實際上並沒有變更資料，auto increment 還是會 +1

因為 `insert` 實際上會先按照原有的 auto increment 準備一個新的 row，然後 auto increment 會 +1，接著在檢查到 duplicate key 後，直接拋 duplicate key error 並 reject statement 的執行，auto increment 並不會 rollback

如果這些問題可以處理或忽略，也不妨考慮這個方式，因為語意上比較明確，也可以讓 client 針對各種可能拋出的錯誤做不同的處理

但有時候在某些考量下，例如 Java 的 catch exception 有其 overhead，還是希望有不會 raise duplicate key error 的作法

## `insert ignore`

如果不希望 raise duplicate key error，首先可以考慮 `insert ignore`

```sql
mysql> insert ignore into test_user (user_id) value (1);
Query OK, 1 row affected (0.01 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert ignore into test_user (user_id) value (1);
Query OK, 0 rows affected, 1 warning (0.00 sec)

mysql> show warnings;
+---------+------+---------------------------------------------------------+
| Level   | Code | Message                                                 |
+---------+------+---------------------------------------------------------+
| Warning | 1062 | Duplicate entry '1' for key 'test_user.uk_user_id_user' |
+---------+------+---------------------------------------------------------+
1 row in set (0.00 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              3 |
+------------+----------------+
1 row in set (0.00 sec)
```

可以看到 `insert ignore` 的結果基本上與 `insert` 幾乎一樣，只差在原本第二次 `insert` 的時候會拋 duplicate key error，現在會被 `ignore` 關鍵字 suppress 成 duplicate key warning

這在使用上需要特別小心，因為 `ignore` 是真的會把所有 error 都忽略，可能會有些你意料之外的錯誤不應該忽略的也會被忽略

而且如果是 insert multiple rows 而且只有其中一些 row 有問題的狀況下，沒有問題的 rows 仍然會被成功 insert 不會整個 insert statement 被 reject，當然這個看狀況可能是缺點也有可能是優點

## `replace`

不希望 raise duplicate key error 另一個選擇是採用 `replace`

```sql
mysql> replace into test_user (user_id) value (1);
Query OK, 1 row affected (0.01 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> replace into test_user (user_id) value (1);
Query OK, 2 rows affected (0.04 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  2 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              3 |
+------------+----------------+
1 row in set (0.00 sec)
```

可以看到 `replace` 跟 `insert` 也幾乎一樣，只差在第二次 `replace` 時是 2 rows affected 並且不會有 error 或 warning，並且在第二次 `replace` 後，該筆資料的 `id` 被變更為 2

這是因為 `replace` 實際上是先做 `delete` 再做 `insert`，因此被影響的是 2 個 row，因此也不會有 duplicate key error，因為實際 insert 的時候，原本會 duplicate 的 row 已經被刪掉了

`replace` 除了 id 會被改變、auto increment 還是會 kind of 浪費一個以外，最大的問題是如果 id 被其他 table 設為 foreign key 的時候，可能會產生你意料之外的結果，例如 cascade delete

## `insert … on duplicate key update`

但如果我們既不想 id 被改變，也不希望 raise duplicate key error/warning 呢？

那可以先考慮 `insert ... on duplicate key update` 的做法

```sql
mysql> insert into test_user (user_id) value (1) as new on duplicate key update user_id = new.user_id;
Query OK, 1 row affected (0.05 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert into test_user (user_id) value (1) as new on duplicate key update user_id = new.user_id;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              3 |
+------------+----------------+
1 row in set (0.00 sec)
```

如此就達成既不會改變 id，也不會 raise duplicate key error/warning

但是仍然會造成 auto increment 被多 +1

另外，因為在 8.0.20 之後的 MySQL，`values()` 功能已 deprecated，所以改用 8.0.19 引入的 `alias` 語法以避免 warning

如果是 8.0.20 以前的版本，可以改採用 `values()` 寫法以避免 syntax error

```sql
insert into test_user (user_id) value (1) on duplicate key update user_id = values(user_id)
```

### `insert … on duplicate key update id = id`

這個方式還有一個變種，網路流傳這樣寫，MySQL 會自動辨認如果有 duplicate key 要改作 `update` 也不會造成 auto increment +1，立刻就來做流言驗證！

```sql
mysql> insert into test_user (user_id) value (1) on duplicate key update id = id;
Query OK, 1 row affected (0.06 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert into test_user (user_id) value (1) on duplicate key update id = id;
Query OK, 0 rows affected (0.00 sec)

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              3 |
+------------+----------------+
1 row in set (0.00 sec)
```

結論不用多說了，MYTH BUSTED!

## `insert … select … not exists`

如果我們既不想 raise duplicate key error/warning，也不想改變 id，還不想造成 auto increment waste 呢？*(小孩子才做選擇，我全都要)*

直接上驗證結果

```sql
mysql> insert into test_user (user_id) select temp.* from (select 1 as user_id) as temp where not exists(select * from test_user where user_id = 1) limit 1;
Query OK, 1 row affected (0.06 sec)
Records: 1  Duplicates: 0  Warnings: 0

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert into test_user (user_id) select temp.* from (select 1 as user_id) as temp where not exists(select * from test_user where user_id = 1) limit 1;
Query OK, 0 rows affected (0.00 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_schema = database() and table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)
```

在正常情況下，這個方式差不多已經是最優解，既不會 raise duplicate key error/warning，也不改變 id，還不造成 auto increment 浪費

但這是正常情況下，當你有 high concurrent 的情況下就不見得如此了

簡單來說是因為 `insert ... select` 不是保證 atomic 的，`select` 跟 `insert` 是分段進行

如果剛好有相同 unique key 的兩次 `insert … select … not exists` 在幾乎相同的時間執行，可能還是會形成兩個 `select` 都認為沒有 duplicate row 而執行 `insert`，因而造成其中一個 statement 噴出 duplicate key error

### `insert … select … not exists … on duplicate key`

```sql
mysql> insert into test_user (user_id) select temp.* from (select 1 as user_id) as temp where not exists (select * from test_user where user_id = 1) limit 1 on duplicate key update id = id;
Query OK, 1 row affected (0.04 sec)
Records: 1  Duplicates: 0  Warnings: 0

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert into test_user (user_id) select temp.* from (select 1 as user_id) as temp where not exists (select * from test_user where user_id = 1) limit 1 on duplicate key update id = id;
Query OK, 0 rows affected (0.00 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)
```

這個方案算是結合 `insert … select … not exists` 跟 `insert … on duplicate key`，也就是當 `insert … select … not exists` 因為 concurrent 的關係準備要 `insert` 一個 duplicate row 的時候，就會改為執行 on duplicate key 的部分，而因為 `insert … on duplicate key` 是 atomic 的，所以這樣的操作不會拋出 duplicate key error/warning

在正常的情況下這個 statement 不會拋出 duplicate key error，id 不會變化，也不會造成 auto increment 浪費

但是在 concurrent 而形成其中一個 statement 會 insert duplicate row 的情況下，其實跟 `insert … on duplicate key` 的問題是相同的，就是有可能會造成 auto increment 浪費

### `insert ignore … select … not exists`

```sql
mysql> insert ignore into test_user (user_id) select temp.* from (select 1 as user_id) as temp where not exists (select * from test_user where user_id = 1) limit 1;
Query OK, 1 row affected (0.05 sec)
Records: 1  Duplicates: 0  Warnings: 0

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.01 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)

mysql> insert ignore into test_user (user_id) select temp.* from (select 1 as user_id) as temp where not exists (select * from test_user where user_id = 1) limit 1;
Query OK, 0 rows affected (0.01 sec)
Records: 0  Duplicates: 0  Warnings: 0

mysql> select * from test_user;
+----+---------+-----------+
| id | user_id | is_active |
+----+---------+-----------+
|  1 |       1 |         1 |
+----+---------+-----------+
1 row in set (0.00 sec)

mysql> select table_name, auto_increment from information_schema.tables where table_name = 'test_user';
+------------+----------------+
| TABLE_NAME | AUTO_INCREMENT |
+------------+----------------+
| test_user  |              2 |
+------------+----------------+
1 row in set (0.00 sec)
```

這個方案是將 `insert … select … not exists` 加上 `ingore` 關鍵字，也就式在 concurrent 時，如果發生 duplicate 的狀況，duplicate key error 會被 suppress 成 duplicate key warning

在一般狀況下同樣不會拋出 duplicate key error，造成 id 改變，或造成 auto increment 浪費

但是在 concurrent 而形成其中一個 statement 會 insert duplicate row 的情況下，其實跟 `insert ignore` 的問題是相同的，就是有可能會造成 auto increment 浪費，而且萬一有其他應該被處理的 error 也會同樣被 suppress

## Conclusion

直接做表格幫大家整理結論，MySQL 並沒有一個完美解決方案，只能根據狀況做取捨

|statement|raise duplicate key error/warning|auto increment burn|id change|
|:--|:--|:--|:--|
|`insert`|error and reject|N|N|
|`insert ignore`|warning only|Y|N|
|`replace`|NA|Y|Y|
|`insert … on duplicate key update`|NA|Y|N|
|`insert … select ... not exists`|possible error and reject when concurrent|possible when concurrent|N|
|`insert … select ... not exists … on duplicate key update id = id`|NA|possible when concurrent|N|
|`insert ignore … select … not exists`|possible warning when concurrent|possible when concurrent|N|

另外，本文僅針對各種單一 statement 的方法的硬限制作討論，並不涉及各 statement 速度、空間利用，也不比較 multiple statement 甚至牽涉 client 端的解決方案，而且僅針對預設設定做比較，不涉及改動 isolation level 或 MySQL server config

## Reference

- [15.2.7 INSERT Statement](https://dev.mysql.com/doc/refman/8.0/en/insert.html)
- [15.2.7.2 INSERT ... ON DUPLICATE KEY UPDATE Statement](https://dev.mysql.com/doc/refman/8.0/en/insert-on-duplicate.html)
- [15.2.7.1 INSERT ... SELECT Statement](https://dev.mysql.com/doc/refman/8.0/en/insert-select.html)
- [17.7.3 Locks Set by Different SQL Statements in InnoDB](https://dev.mysql.com/doc/refman/8.0/en/innodb-locks-set.html)
- [17.6.1.6 AUTO_INCREMENT Handling in InnoDB](https://dev.mysql.com/doc/refman/8.0/en/innodb-auto-increment-handling.html)
