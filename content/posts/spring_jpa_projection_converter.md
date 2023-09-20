---
title: "Spring JPA Projection with Converter"
date: 2023-09-20T09:37:21+08:00
slug: "spring_jpa_projection_converter"
description: "紀錄使用 Spring JPA projection 時遇到的一些 type 轉換問題"
tags: ["java", "spring-jpa"]
categories: "implementation"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

# Pre-requisite

- JDK 11+
- Spring Boot 2+

# 情境描述

使用 JPA 做單表查詢非常方便，但有時候因為效能考量，會出現 DB data type 與 Java data type 無法直接對應或需要做一些客製化調整

例如在保存狀態時，因為狀態通常有固定且少量的值，所以會考慮採用 `int` 而非 `varchar` 來保存，在存儲大小跟查詢效能上都較優

```sql
CREATE TABLE CHATROOM
(
  ...
  `STATUS` INT NOT NULL,
  ...
);
```

但在程式面都採用 Java 的 `int` 來操作狀態，可讀性相對較低，所以可能會考慮採用 `enum` 來操作，可讀性較佳且有 type check


```java
public enum ChatroomStatus {
    CLOSED, ACTIVE
}
```

# 設定 Converter

但 JPA 預設並不能將 Java `enum` 與 MySQL `int` 做 mapping，所以會需要提供 converter 讓 JPA 知道怎麼做轉換

首先需要調整 `enum` 如下

```java
public enum ChatroomStatus {
    CLOSED(0),
    ACTIVE(1);
  
    private final int value;
  
    ChatroomStatus(int value) {
        this.value = value;
    }
  
    public int value() {
        return this.value;
    }
  
    public static ChatroomStatus of(int value) {
        for (ChatroomStatus target : ChatroomStatus.values()) {
            if (target.value == value) {
                return target;
            }
        }
        return null;
    }
}
```

接著要提供 converter

```java
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ChatroomStatusConverter implements AttributeConverter<ChatroomStatus, Integer> {

	@Override
	public Integer convertToDatabaseColumn(ChatroomStatus attribute) {
		if (attribute == null) {
			return null;
		}
		return attribute.value();
	}

	@Override
	public ChatroomStatus convertToEntityAttribute(Integer dbData) {
		if (dbData == null) {
			return null;
		}
		return ChatroomStatus.of(dbData);
	}
}
```

最後提供 entity

```java
@Entity
@Table(name = "CHATROOM")
public class ChatroomDo {
    ...
    @NotNull
	@Column(name = "STATUS", nullable = false)
	private ChatroomStatus status;
	...
}
```

就可以正常使用 repository 做 CRUD 操作，而同時在 DB 當中 STATUS 為 `0` 代表 chatroom closed、`1` 代表 chatroom active

# 第二種情境描述

有時候我們會需要做一些複雜查詢，尤其是使用到其他 table 做 join 查詢，而且 select 的欄位不一定只選擇一個 entity 包含的欄位，此時就會需要利用 JPA 的 projection 功能

> 有些情況可以用關聯來處理，但以下假設並沒有在 JPA 設定關聯，而是直接用 native SQL join 的方式做查詢

例如以下 table

```sql
CREATE TABLE MESSAGE
(
  ...
  TYPE INT NOT NULL,
  REPLIED_MESSAGE_ID BIGINT,
  ...
)
```

對應的 `MessageDo` entity 如下

```java
@Entity
@Table(name = "MESSAGE")
public class MessageDo {
    ...
    @Column(name = "TYPE")
    private MessageType type;
    @Column(name = "REPLIED_MESSAGE_ID")
    private Long repliedMessageId;
    ...
}
```

其中 `MessageType` 如下

```java
public enum MessageType {
    TEXT(1),
    IMAGE(2),
    ...
    
    private final int value;
    
    MessageType(int value) {
        this.value = value;
    }
    
    public int value() {
        return this.value;
    }
    
    public static MessageType of(int value) {
		for (MessageType target : MessageType.values()) {
			if (target.value() == value) {
				return target;
			}
		}
		return null;
	}
}
```

按照慣例，提供 converter 如下

```java
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class MessageTypeConverter implements AttributeConverter<MessageType, Integer> {

	@Override
	public Integer convertToDatabaseColumn(MessageType attribute) {
		if (attribute == null) {
			return null;
		}
		return attribute.value();
	}

	@Override
	public MessageType convertToEntityAttribute(Integer dbData) {
		if (dbData == null) {
			return null;
		}
		return MessageType.of(dbData);
	}
}
```

此時若需要取得一個 message 以及其回覆 message 的內容，則 JPA query method 就無法 return MessageDo，所以此時我們採用 JPA interface-based projection 來達成此操作，首先按照官方 doc 提供 interface 如下

```java
public interface MessageViewDo {
    ...
    MessageType getType();
    Long getRepliedMessageId();
    MessageType getRepliedMessageType();
    ...
}
```

然後是 query 如下

```java
public interface MessageDao extends JpaRepository<MessageDo, Long> {

    @Query(value = "SELECT " +
    ...
    "  m.TYPE, " +
    "  rm.ID AS repliedMessageId, "
    "  rm.TYPE AS repliedMessageType, "
    ...
    "FROM MESSAGE m " +
    "LEFT JOIN MESSAGE rm ON m.REPLIED_MESSAGE_ID = rm.ID " +
    "WHERE m.ID = :id", nativeQuery = true)
    Optional<MessageViewDo> findMessageViewById(Long id);
}
```

此時當我們使用的時候，會開心地發現取出來的 `MessageType` 值有問題，要不是取出來的值不對，就是會報 `org.springframework.core.convert.ConversionFailedException` 的錯誤，仔細看 cause 還是 `Caused by: java.lang.ArrayIndexOutOfBoundsException`？

這是因為 JPA 的 interface-based projection 實際上是用 proxy 來包住取得的 result，等到使用者要使用到物件的時候才做轉換，而且因為我們做的是 open projection (projection 的結果並非基於 entity class)，所以 JPA 無法像 closed projection (projection 結果基於 entity) 那樣從原始的 entity 身上取得 metadata 做轉換，所以只能用 Spring 預設的 converter 來做轉換

是的，因為無法取得 entity 的 metadata，所以此時使用的不是 JPA 的 converter 而是 Spring Core 自帶的 converter，而我們並沒有將我們自定義的 Spring converter 註冊給 Spring DI container，所以它只會用預設的方式去做 `int` -> `enum` 的轉換

而 Spring 預設對 `int` -> `enum` 的轉換是依照 `enum` 的 ordinal (順序) 做轉換，而且 ordinal 是從 0 開始，所以你可能會很容易看到轉換出來的 `MessageType` 比 DB 中的剛好大一號，例如 DB 中的 `TYPE` 是 `1` 應該代表的是 `TEXT`，但取出來卻變成 `IMAGE` 這樣的情況；更甚者，如果 DB 的值剛好大於等於 `enum` 的 size 就會報 `org.springframework.core.convert.ConversionFailedException`

因此，很自然的我們就應該要提供 converter 給 Spring

```java
import org.springframework.core.convert.converter.Converter;
import org.springframework.lang.NonNull;

import java.util.Arrays;

public class MessageTypeConverter implements Converter<Integer, MessageType> {

	@Override
	public MessageType convert(@NonNull Integer source) {
		if (Arrays.stream(MessageType.values()).anyMatch(target -> target.value == source)) {
			return MessageType.of(source);
		}
		return null;
	}
}
```

但這時候問題就來了，要怎麼註冊這個 converter？這個時候就要看 Spring Boot 的版本了

## Spring Boot 2.4.0 以前

```java
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.core.convert.support.DefaultConversionService;

@Configuration
public class ConverterConfig {

    @EventListener(ApplicationReadyEvent.class)
    public void config() {
        DefaultConversionService conversionService = (DefaultConversionService) DefaultConversionService.getSharedInstance();
        conversionService.addConverter(new MessageTypeConverter());
    }
}
```

## Spring Boot 2.4.0 以後

因為 Spring Boot 2.4.0 以後沒辦法用 `DefaultConversionService.getSharedInstance()` 的方式，所以最後參考了 [這裡](https://stackoverflow.com/a/65355897) 提供的方式，用反射來註冊 converter

```java
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.core.convert.support.GenericConversionService;

import java.lang.reflect.Field;

@Configuration
public class JpaProjectionConverterConfig {

	@EventListener(ApplicationReadyEvent.class)
	public void offsetDateTimeConversion() throws ClassNotFoundException, NoSuchFieldException, IllegalAccessException {
		Class<?> aClass = Class.forName("org.springframework.data.projection.ProxyProjectionFactory");
		Field field = aClass.getDeclaredField("CONVERSION_SERVICE");
		field.setAccessible(true);
		GenericConversionService service = (GenericConversionService) field.get(null);

		service.addConverter(new MessageTypeConverter());
	}
}
```

如此就可以利用框架自動 mapping Java `enum` 與 MySQL `int`

另外提一下，Java 的 `Instant` 或 `OffsetDateTime` 與 MySQL `datetime` 之間也有類似的問題，所以也需要提供一個 converter 做 `Instant` 或 `OffsetDateTime` 與 `java.sql.Timestamp` 之間做轉換

> JPA 會把 MySQL 的 `datetime` 以 `java.sql.Timestamp` 取出來

# Reference

- [Spring Data JPA - Reference Documentation](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/#projections)
- [Spring JPA - "java.lang.IllegalArgumentException: Projection type must be an interface!" (using native query)](https://stackoverflow.com/a/65355897)
