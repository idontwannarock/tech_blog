---
title: "Java Time 保存到 MySQL DATETIME 時區問題"
date: 2023-12-27T09:26:23+08:00
slug: "java_time_mapping_mysql_datetime_timezone"
description: "研究 JPA/JDBC 如何對 Java Time 與 MySQL DATETIME 資料型態 mapping 時做時區轉換的機制"
tags: ["java", "time", "mysql", "datetime", "timezone"]
categories: "application"
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1703640991/Tech%20Blog/its-about-time.jpg"
draft: false
comment: true
enableLaTeX: false
---

最近開發遇到一個對我的系統需求來說很合適，但我感覺不合理的狀況

目前有 Spring Boot 系統在 JPA 是用 `OffsetDateTime` 在 Entity 中對應 MySQL 表中的 `DATETIME` 欄位，JVM 時區以及 MySQL 的系統時區都是 +8，沒有特別在任何地方進行時區設定，也就是所有地方應該都是預設設定

然而當 `OffsetDateTime` 保存到 `DATETIME` 當中時，卻會被自動轉換成 UTC 時區的時間保存，並且之後再用 JPA 重新取出後，`OffsetDateTime` 也依然是 UTC 時區

這就讓人感覺很奇怪了，感覺要馬就應該是 MySQL `DATETIME` 保存時用 JVM 跟 MySQL 相同的系統 +8 時區時間保存，取出也是 +8 時間；要馬就是保存時會轉成 UTC，但取出應該會自動轉換回 JVM 的 +8 才合理，畢竟 `DATETIME` 欄位資料格式不保存時區資訊，所以要馬就是完全不轉換，要馬就是會依照某種機制保存時用 UTC，但使用時會自動轉換成 JVM 時區之類的模式才對

雖然我原本就希望在系統中盡量都使用 UTC 時區而不要隨著 MySQL/JVM 時區變動以避免造成資料錯誤的問題，但機制不如預期就應該要弄清楚，免得其實是有什麼未知的狀況造成日後踩到坑

# Pre-requisite

首先要先說明這篇文章的研究都是基於下列版本，不同的版本「可能」會有不同的行為，請查詢官網文件或自行測試

- Spring Boot Data JPA 3.1.4
- Hibernate 6.2.9.Final
- MySQL JDBC Driver 8.0.33
- MySQL server 8.0.33

# 資料類型選擇的考量

首先說明為什麼要選擇用 `OffsetDateTime` 對應 MySQL `DATETIME` 的考量

在 MySQL 當中可以同時保存日期及時間的格式只有 `TIMESTAMP` 及 `DATETIME` 兩種，其中 `TIMESTAMP` 資料格式只支援到 `2038-01-19 03:14:07` UTC，而 `DATETIME` 格式可以支援到 `9999-12-31 23:59:59`

> MySQL 因為用 signed 32-bit integer 來保存 `TIMESTAMP` 資料格式包含秒以上的資料，因此最多只能記錄到從 `1970-01-01 00:00:01` UTC 開始後的 2147483647 秒，也就是 `2038-01-19 03:14:07` UTC，超過一秒就會 stackoverflow；而 `DATETIME` 則採用完全不同的保存策略，所以可以支援到 `9999-12-31 23:59:59`

另外 `TIMESTAMP` 資料格式可能不見得適合在高併發的情況下使用，因為在 MySQL 官方文件的「[5.1.15 MySQL Server Time Zone Support#Time Zone Variables][0]」中有以下這段

> **Note**
>
> If set to SYSTEM, every MySQL function call that requires a time zone calculation makes a system library call to determine the current system time zone. This call may be protected by a global mutex, resulting in contention.

這段是在說 MySQL 系統的 `time_zone` 變數如果是預設的 `SYSTEM`，在每次需要做時區運算的時候，MySQL 系統就會取得全域鎖 (global mutex) 來做資料正確性的確保，導致鎖爭用 (lock contention)

而因為 `TIMESTAMP` 的時區自動轉換功能雖然能確保時間時區的正確性，卻容易導致每次存取都需要做時區轉換運算，進而導致鎖爭用發生，而對效能有影響

但另一方面來說，雖然 `DATETIME` 並不記錄時區而避免鎖爭用的問題，但卻相對容易衍生時區相關的問題

因為我的系統流量不小，加上不想在未來面對資料搬遷的問題，所以才選擇 `DATETIME`

而說到在 Java 這邊，因為舊的 `java.sql.Timestamp` 等時間相關的類別有許多問題，所以從 Java 8 開始推出了 `java.time` 系列的類別來處理時間相關的資料

當遇到要處理帶時區的時間時，比較常用到的類別就是 `Instant` 及 `OffsetDateTime`，而 Hibernate 官方文件中「[2.2.48. Handling temporal data][1]」有列出帶時區時間支援的類別只有 `java.time.OffsetDateTime` 及 `java.time.ZonedDateTime` 這兩個

而因為我的系統並沒有需要針對不同地方的時間做運算的需求，尤其是不需要計算日光節約時間，而只需要用 UTC 計算即可，所以才選用 `OffsetDateTime`

談完選用資料型態的考量後，就開始研究時區轉換的機制吧

# 時區轉換機制

在研究時區轉換機制之前，要先了解 JPA 是怎麼跟 MySQL 互動的

首先 Spring Boot Data JPA 是 Spring Boot 實作方便整合到 Spring Boot 系統並且符合 JPA 規範的介面，主要機制還是圍繞在操作預設使用的 Hibernate 實作，而 Hibernate 這個 ORM 則會透過內部機制去操作 JDBC Driver 最終跟 MySQL server 進行互動

在這個流程中，MySQL `DATETIME` 並不保存時區也不對保存的時間進行時區轉換，而 Spring Boot Data JPA 只是介接符合 JPA 實作的 ORM 框架以及 Spring Boot 系統，所以時區轉換的機制比較大的可能發生在 Hibernate 或 MySQL JDBC Driver 這兩者當中

## MySQL JDBC Driver 的時區轉換

這邊我首先懷疑的是 JDBC Driver，因為 MySQL 的官網上很容易就能找到這份文件「[6.6.1 Preserving Time Instants][2]」有以下說明

> The situation is less straightforward with the `DATETIME` data type: it does not represent an instant and, when no time zone offset is specified, there is no time zone conversion for `DATETIME` values, so they are stored and retrieved as they are. However, with a specified time zone offset, the input value is converted to the session time zone before it is stored; the result is that, when retrieved in a different session with a different time zone offset as the specified one, the `DATETIME` value becomes different from the original input value.

也就是說 `DATETIME` 資料格式不會做時區轉換，所以怎麼保存就怎麼取出來；但是如果保存的時候有帶上時區，會先將時間轉換成 session timezone 後再保存，因此當取出時，是在不同 timezone 的 session 中，取得的值會跟原先保存的原始值不同

> MySQL 依照 session timezone 轉換時區的效果可以參考官網這份文件「[9.1.3 Date and Time Literals][3]」

這聽起來好像有可能符合我遇到的狀況，所以問題就在於 session timezone 是怎麼決定的

MySQL server timezone 的設定可以在這份文件「[5.1.15 MySQL Server Time Zone Support][4]」，但在使用 ORM 的時候這裡面提到的方式都不是合適的方法，因為其中要不是全域設定就是要額外下 sql 去變動，而且我也沒有做任何類似的設定

另外還有一種方式就是在 JDBC Driver connection url 上加上設定參數去調整連線的 timezone，如這份文件「[6.3.11 Datetime types processing][5]」說的 `connectionTimeZone` 及 `forceConnectionTimeZoneToSession` 參數也可以調整 session timezone，但是我也沒有做這個設定

這邊我透過 `select @@system_time_zone, @@time_zone, @@global.time_zone, @@session.time_zone;` 實際去查 timezone 的結果如下

|@@system_time_zone|@@time_zone|@@global.time_zone|@@session.time_zone|
|:--|:--|:--|:--|
|CST|SYSTEM|SYSTEM|SYSTEM|

可以看到基本上全部 timezone 都是比照 `SYSTEM` 也就是 MySQL 的系統時區 CST(+8)

那就很奇怪了，因為按照前面文件描述，`DATETIME` 欄位型態在面對插入的時間帶有時區的時候會按照 session timezone 來轉換時區後保存，但我面對的 session timezone 明明就是 +8，它到底是怎麼保存成 UTC 的呢？

## Hibernate 的時區轉換

於是我們轉向另外一個嫌疑人 Hibernate，Hibernate 到底是怎麼做時區轉換的呢？或者說有沒有做時區轉換呢？

首先就是 Hibernate 有提供一個參數 `hibernate.jdbc.time_zone` 可以設定，這會讓 Hibernate 在將時間傳送到 DB 之前就先將時區轉換成參數設定的時區，取出來的時候也是會將時間轉回參數設定的時區

如果我設定這個參數為 UTC 的話，其行為就與我觀測到的相同，但是我並沒有設定這個參數，而這個參數的預設值是 JVM 時區，所以看來應該還有別的機制在作用

### JDBC 4.2 時間格式規範

在講到 Hibernate 另外一個機制之前，要先提一下 JDBC 4.2 對於時間的規範

JDBC 4.2 新增了 [JDBCType][6]，其中對於時間資料規範了以下四種類型

- `DATE`: 代表日期，保存年月日
- `TIME`: 代表時間，保存時分秒
- `TIMESATMP`: 代表日期及時間，保存年月日時分秒加上奈秒 (nanosecond)
- `TIMESTAMP_WITH_TIMEZONE`: 代表日期及時間以及時區，保存年月日時分秒加上奈秒 (nanosecond) 以及時區 id 或 offset

### MySQL JDBC Driver 時間格式支援

但是就如我們所知道的，MySQL 對於保存完整日期及時間的資料格式只有兩種，`TIMESTAMP` 及 `DATETIME`

其中 `TIMESATMP` 會把所有時間轉成 UTC 後再保存成 unix timestamp，而我們也知道 `DATETIME` 則是不保存時區的，所以 MySQL JDBC Driver 實際上是不支援 `TIMESTAMP_WITH_TIMEZONE` 這個 jdbc type 的，它實際上都會先處理好時間的時區後，再用 `TIMESTAMP` 這個 jdbc type 來傳送時間資料

至於 driver 內部怎麼處理時區，我們前面一段也已經講過，並不如我觀測到的狀況，所以現在才會要來看 Hibernate 是怎麼處理這個問題

### Hibernate 5 的 normalization

但畢竟 Hibernate 還是要透過 JDBC Driver 才能真正跟 DB 互動，所以針對 MySQL JDBC Driver 不支援 `TIMESTAMP_WITH_TIMEZONE` 的問題，從 Hibernate 5 開始採取了一種策略，就是先將帶有時區資訊的時間先 normalize 成沒有時區的時間後再保存，normalize 的過程其實就是會將時間轉換成 JVM 的時區，而取出來的無時區時間再加上 JVM 時區做還原

例如今天 JVM 時區為 +8，而你要將時間為 `2023-12-25 11:30:00+6` 的 `OffsetDateTime` 保存起來，Hibernate 5 會先將 `2023-12-25 11:30:00+6` 轉換成 JVM 的時區並去掉時區資訊，也就是變成 `2023-12-25 13:30:00` 後再保存起來；而取出來後的 `2023-12-25 13:30:00` 則會直接加上 JVM 的時區 +8 後還原成時間為 `2023-12-25 13:30:00+8` 的 `OffsetDateTime`

採取這樣的機制的確可以避開 MySQL JDBC Driver 不支援 `TIMESTAMP_WITH_TIMEZONE` 的問題，但除非符合以下三個條件，否則時區資訊還是有可能會混亂

- 不使用有日光節約 (daylight saving) 的時區
- 所有 JVM instance 的時區都一致
- 永遠不會改變時區

### Hibernate 6 的 `TimeZoneStorageType` 設定

這三個條件其實某種程度上是很嚴苛的，畢竟仍然有很多地區在使用日光節約時間，所以 Hibernate 6 就提出更進階的設定，讓使用者可以自己決定要如何將帶時區的時間 mapping 到資料庫的無時區時間資料欄位上

這裡我們可以直接參考 `org.hibernate.annotations.TimeZoneStorageType` 這個 enum，其中提供了六種設定選項

- `NATIVE`
- `NORMALIZE`
- `NORMALIZE_UTC`
- `COLUMN`
- `AUTO`
- `DEFAULT`

首先看名稱就知道是預設值的 `DEFAULT`，而 `DEFAULT` 到底是採取怎樣的策略呢？這邊我們可以直接參考 `DEFAULT` 的說明

> Stores the time zone either with `NATIVE` if `Dialect.getTimeZoneSupport()` is `org.hibernate.dialect.TimeZoneSupport.NATIVE`, otherwise uses the `NORMALIZE_UTC` strategy.

簡單來說就是除非有特別設定，預設就是 `NORMALIZE_UTC`

那 `NORMALIZE_UTC` 又是怎麼運作呢？這邊先講 `NORMALIZE` 是怎麼運作的

`NORMALIZE` 的機制基本上就跟 Hibernate 5 的處理方式一樣，只差在可以透過 `hibernate.jdbc.time_zone` 這個參數設定 normalize 過程中要轉換的時區，也就是將帶時區時間轉換成無時區時間時，如果沒有設定 `hibernate.jdbc.time_zone` 則一樣轉成 JVM 時區；若是有設定 `hibernate.jdbc.time_zone` 就轉成 `hibernate.jdbc.time_zone` 設定的時區；反過來要將無時區時間轉回帶時區時間的時候，沒有設定 `hibernate.jdbc.time_zone` 就一樣直接帶上 JVM 時區，若是有設定則直接帶上 `hibernate.jdbc.time_zone` 設定的時區

> 這就是設定 `hibernate.jdbc.time_zone` 這個參數後的實際運作機制，如果使用 Spring Boot Data JPA 則是設定 `spring.jpa.properties.hibernate.jdbc.time_zone`

但這樣的機制仍然不能避免處理日光節約時間以及換時區的問題

所以就有 `NORMALIZE_UTC` 的出現，其實機制跟 `NORMALIZE` 非常相似，只差在它會強制將帶時區時間轉成 UTC 時間後再去掉時區資訊，轉回來的時候同樣也是直接將無時區資訊加上 UTC 時區

而因為任何時間在保存的時候都是保存成 UTC 的時間，取出來的時候也是一律轉換成 UTC 時間，所以就解決了日光節約時間以及換時區的問題

> 注意 `NORMALIZE_UTC` 直到 Hibernate 6.0.1.Final 才修正成為以上機制，並且直到 Hibernate 6.2+ 後才成為預設處理 database 不支援帶時區時間的機制

至此，這個機制的描述已經完全符合我觀測到的現象，但是盡信書不如無書，這邊還是要寫個測試來驗證一下

# 測試

首先建立測試的 schema 如下

```sql
create table dt
(
    id        bigint auto_increment primary key,
    timestamp timestamp(3) not null,
    datetime  datetime(3)  not null
);
```

設定 Entity 如下

```java
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;

@Entity
@Table(name = "dt")
public class DtEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    private OffsetDateTime timestamp;

    @CreationTimestamp
    private OffsetDateTime datetime;
    
    // getter, setter omitted...
}
```

Repository

```java
import com.example.lab.spring.boot.jpa.persistent.data.DtEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DtRepository extends JpaRepository<DtEntity, Long> {
}
```

然後透過正常的 JPA `save()` 方式新增記錄

```java
var newDt = new DtEntity();
dtRepository.save(newDt);
```

也透過正常的 JPA `findById()` 方式取得資料

```java
dtRepository.findById(id).ifPresent(dt -> System.out.println(dt));
```

我在執行的時候 JVM 跟 MySQL 的時區都是 +8，但這邊印出取得的資料確定是 UTC 時間如下

```plaintext
DtEntity(id=1, timestamp=2023-12-25T03:30:27.660Z, datetime=2023-12-25T03:30:27.660Z)
```

但我們想更進一步確定運作得是我們前面提到的機制，所以要在 `application.properties` 中再加上以下 log 設定

```properties
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type=TRACE
logging.level.org.hibernate.orm.jdbc.bind=DEBUG
logging.level.org.hibernate.orm.results=DEBUG
logging.level.org.hibernate.resource.jdbc.internal.ResourceRegistryStandardImpl=TRACE
```

於是我們可以在 console 中看到以下這行 log 可以證實在 Hibernate 這層處理的時候就已經將時間轉換成 UTC 時間並轉成字串做 insert

```plaintext
2023-12-25T11:31:52.418+08:00 TRACE 29184 --- [nio-8080-exec-1] o.h.r.j.i.ResourceRegistryStandardImpl   : Releasing statement [HikariProxyPreparedStatement@1053261670 wrapping com.mysql.cj.jdbc.ClientPreparedStatement: insert into dt (datetime,timestamp) values ('2023-12-25 03:31:52.399456','2023-12-25 03:31:52.399456')]
```

另外還可以看到以下幾行 log，此處即可證明 Hibernate 取出來的時候同樣是取得 UTC 時間做綁定

```plaintext
2023-12-25T11:31:56.682+08:00 DEBUG 29184 --- [nio-8080-exec-2] org.hibernate.SQL                        : select d1_0.id,d1_0.datetime,d1_0.timestamp from dt d1_0 where d1_0.id=?
2023-12-25T11:31:56.682+08:00 TRACE 29184 --- [nio-8080-exec-2] o.h.r.j.i.ResourceRegistryStandardImpl   : Registering statement [HikariProxyPreparedStatement@2074824531 wrapping com.mysql.cj.jdbc.ClientPreparedStatement: select d1_0.id,d1_0.datetime,d1_0.timestamp from dt d1_0 where d1_0.id=** NOT SPECIFIED **]
2023-12-25T11:31:56.684+08:00 TRACE 29184 --- [nio-8080-exec-2] o.h.r.j.i.ResourceRegistryStandardImpl   : Registering result set [HikariProxyResultSet@310872211 wrapping com.mysql.cj.jdbc.result.ResultSetImpl@5b842ce6]
2023-12-25T11:31:56.685+08:00 DEBUG 29184 --- [nio-8080-exec-2] o.hibernate.orm.results.loading.entity   : (EntityResultInitializer) Hydrated EntityKey (com.example.lab.spring.boot.jpa.persistent.data.DtEntity): 2
2023-12-25T11:31:56.686+08:00 DEBUG 29184 --- [nio-8080-exec-2] o.hibernate.orm.results.loading.entity   : (EntityResultInitializer) Created new entity instance [com.example.lab.spring.boot.jpa.persistent.data.DtEntity#2] : 1223328396
2023-12-25T11:31:56.686+08:00 DEBUG 29184 --- [nio-8080-exec-2] org.hibernate.orm.results                : Extracted JDBC value [1] - [2023-12-25T03:31:52.399Z]
2023-12-25T11:31:56.686+08:00 DEBUG 29184 --- [nio-8080-exec-2] org.hibernate.orm.results                : Extracted JDBC value [2] - [2023-12-25T03:31:52.399Z]
```

可以參考我寫的 [lab-spring-boot-datetime-with-timezon][7] 範例專案

# 結論

原則上最好的情況就是 server 端不論接收、傳送或是計算時間都採用 UTC 時區為準，才能最大程度保證時間資料的正確性，而不同時區的變換則在 client 端依照需求自行轉換；除非有需要依照不同 client 端時區做相對時間 (例如本週、本月等) 的計算才會需要依照 client 提供的時區做某種程度的轉換，但也應該最終都要轉成 UTC 時區時間做最終計算，因此不論在後端或 DB 保存上，也都最好一致採用 UTC 做交互及保存

而由前面的討論可以得知原則上 Hibernate 預設已經是採取這樣的方案，但如果有需要越過 JPA/Hibernate 去使用到 JDBC API 的話，建議依照 MySQL JDBC Driver 不同的版本，在 JDBC Url 上加上設定 session timezone 的參數，如在 MySQL JDBC Driver 8.0.23 之後的版本可以加上 `connectionTimeZone=UTC` 及 `forceConnectionTimeZoneToSession=TRUE` 兩項參數，來確保 JDBC 在保存及取得 `TIMESTAMP` 或 `DATETIME` 資料型態時都會維持 UTC 時區時間

而 server 端最好也能設定 JVM 時區為 UTC，而不要依賴 OS 的時區，比較能保證運行的穩定性

另外就是要考量是否會直接使用到 JDBC API 或只會只用 JPA 介面，如果要使用到 JDBC API 則考慮使用 `ZonedDateTime` 或 `OffsetDateTime` 來做 MySQL `TIMESTAMP` 或 `DATETIME` 的 mapping，如果只使用到 JPA，那可以考慮選用 `Instant` 會讓時區轉換更單純

但以上設定最好都是在專案或環境剛開始的時候就能設定好，如果是 legacy 專案環境，就只能視狀況做不同的調整，而不能一概而論

# Reference

- [11.2.2 The DATE, DATETIME, and TIMESTAMP Types](https://dev.mysql.com/doc/refman/8.0/en/datetime.html)
- [5.1.15 MySQL Server Time Zone Support#Time Zone Variables][0]
- [2.2.48. Handling temporal data][1]
- [6.6.1 Preserving Time Instants][2]
- [9.1.3 Date and Time Literals][3]
- [5.1.15 MySQL Server Time Zone Support][4]
- [6.3.11 Datetime types processing][5]
- [A.3 JDBC Settings](https://docs.jboss.org/hibernate/orm/6.2/userguide/html_single/Hibernate_User_Guide.html#settings-jdbc)
- [JDBC_TIME_ZONE](https://docs.jboss.org/hibernate/orm/6.2/javadocs/org/hibernate/cfg/JdbcSettings.html#JDBC_TIME_ZONE)
- [JDBCType][6]
- [How to store timestamps in UTC using the new hibernate.jdbc.time_zone configuration property](https://in.relation.to/2016/09/12/jdbc-time-zone-configuration-property/)
- [Working with ZonedDateTime](https://thorben-janssen.com/hibernate-jpa-date-and-time/#Working_with_ZonedDateTime)
- [TimezoneStorageType – Hibernate’s improved timezone mapping](https://thorben-janssen.com/hibernate-6-offsetdatetime-and-zoneddatetime/)

[0]: https://dev.mysql.com/doc/refman/8.0/en/time-zone-support.html#time-zone-variables
[1]: https://docs.jboss.org/hibernate/orm/6.2/userguide/html_single/Hibernate_User_Guide.html#basic-temporal
[2]: https://dev.mysql.com/doc/connector-j/en/connector-j-time-instants.html
[3]: https://dev.mysql.com/doc/refman/8.0/en/date-and-time-literals.html
[4]: https://dev.mysql.com/doc/refman/8.0/en/time-zone-support.html
[5]: https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-datetime-types-processing.html
[6]: https://docs.oracle.com/javase/8/docs/api/java/sql/JDBCType.html
[7]: https://github.com/idontwannarock/lab-spring-boot-datetime-with-timezone