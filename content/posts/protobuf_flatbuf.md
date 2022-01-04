---
title: "ProtoBuf FlatBuf Benchmark in Java"
date: 2022-01-04T15:36:17+08:00
slug: "protobuf_flatbuf_java"
description: "Benchmarking ProtoBuf and FlatBuf with Java"
tags: ["protobuf", "protocol buffers", "flatbuf", "flat buffers"]
categories: implementation
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1641282508/Tech%20Blog/protobuf.png"
draft: false
comment: true
enableLaTeX: false
---

繼續之前研究的 gRPC，除了 HTTP/2 以外，另外一個支柱就是 Protocol Buffers (ProtoBuf)

ProtoBuf 是一種二進制的序列化資料格式，透過介面描述語言 (Interface description language, IDL) 來描述資料結構，再利用工具依據 IDL 產生程式碼，這些程式碼可以用來生成或解析代表這些資料結構的位元組流

ProtoBuf 是 Google 原本用來內部使用的資料格式，但現在已開源，加上被 gRPC 原生支援，現在已經是重要的序列化 library

Google 官方支援了許多語言的工具用來轉換 IDL 為代碼，但其中很不巧的不包含我目前工作上避不開的 Lua 或 TypeScript，所以我又另外找到同樣也是 Google 推出的 FlatBuffers (FlatBuf)，同樣也是二進制的序列化 library，但官方支援的語系就很多了，正好也包括 Lua 及 TypeScript

雖然 Google 官方已經在努力讓 FlatBuf 也被 gRPC 支援，但目前官方文件上還只有 C++ 的版本，並沒有我日常使用的語言

不過沒關係，我工作上的專案目前並不是一定要使用 gRPC，我完全可以利用其他傳輸協定例如 HTTP, WebSocket 或甚至 Socket 來傳輸資料，我只需要一種能夠讓各語系通用的資料格式，並且盡可能有官方長期支援即可

## Benchmark 方法

雖然剛好 FlatBuf 都符合我的需求，但 FlatBuf 使用的人似乎還不多，雖然官方文件上說 Facebook 已經將 FlatBuf 使用在 Android App 上，不過總是沒有自己親身試驗來的準，也一併試驗開發的困難度

所以乾脆來做 ProtoBuf 跟 FlatBuf 的 benchmark 來比較一下各自序列化的速度以及記憶體大致用量

因為要順帶試驗開發的困難度，所以只要是各自有支援的資料格式，我都盡量加入測試的資料結構當中，以下為我用來建立測資的 Java 物件

```java
@Value
@Builder
public class Passenger {

    Integer id;
    String firstName;
    String lastName;
    Boolean isMale;
    List<Belonging> belongings;
    Ticket ticket;
}

@Value
@Builder
public class Belonging {

    Integer id;
    BelongingType type;
    Float weightInKilogram;

    public enum BelongingType {
        SUITCASE, BACKPACK
    }
}

@Value
@Builder
public class Ticket {

    Integer id;
    Transportation transportation;
    Currency currency;
    BigDecimal price;
    Location departure;
    OffsetDateTime departureTime;
    Location arrival;
    OffsetDateTime arrivalTime;

    public enum Transportation {
        AIRLINE, TRAIN
    }

    public enum Currency {
        USD, NTD
    }

    public enum Location {
        TPE, TSA, NRT, LAX
    }
}
```

我也盡量將 Java 常用的資料型別加入其中來試驗各序列化 Library 的支援度

以下是 ProtoBuf 對應的 .proto 檔

```proto
syntax = "proto3";

package protobuf;

option java_multiple_files = true;
option java_package = "org.example.serialization.benchmark.protobuf";
option java_generate_equals_and_hash = true;
option java_string_check_utf8 = true;
option java_outer_classname = "PassengerProto";

message ProtoPassenger {
  int32 id = 1;
  string firstName = 2;
  string lastName = 3;
  bool isMale = 4;
  ProtoTicket ticket = 5;
  repeated ProtoBelonging belongings = 6;
}

message ProtoBelonging {
  int32 id = 1;
  BelongingType type = 2;
  float weightInKilogram = 3;

  enum BelongingType {
    SUITCASE = 0;
    BACKPACK = 1;
  }
}

message ProtoTicket {
  int32 id = 1;
  Transportation transportation = 2;
  Currency currency = 3;
  string price = 4;
  Location departure = 5;
  string departureTime = 6;
  Location arrival = 7;
  string arrivalTime = 8;

  enum Transportation {
    AIRLINE = 0;
    TRAIN = 1;
  }

  enum Currency {
    USD = 0;
    NTD = 1;
  }

  enum Location {
    TPE = 0;
    TSA = 1;
    NRT = 2;
    LAX = 3;
  }
}
```

接著是 FlatBuf 對應的 fbs 檔

```fbs
namespace org.example.serialization.benchmark.flatbuf;

enum FlatBelongingType : ubyte {SUITCASE, BACKPACK}

table FlatBelonging {
    id:int;
    type:FlatBelongingType;
    weight_in_kilogram:float;
}

enum FlatTransportation : ubyte {AIRLINE, TRAIN}

enum FlatCurrency : ubyte {USD, NTD}

enum FlatLocation : ubyte {TPE, TSA, NRT, LAX}

table FlatTicket {
    id:int;
    transportation:FlatTransportation;
    currency:FlatCurrency;
    price:string;
    departure:FlatLocation;
    departure_time:string;
    arrival:FlatLocation;
    arrival_time:string;
}

table FlatPassenger {
    id:int;
    first_name:string;
    last_name:string;
    is_male:bool;
    ticket:FlatTicket;
    belongings:[FlatBelonging];
}

root_type FlatPassenger;
```

測試的過程大致上為將自動產生的 Passenger 物件 map 到各自的物件中並進行序列化 (serialization)，接著再進行反序列化 (deserialization) 並 map 回 Passenger 物件，最後會進行 assert 以確保反序列化回來的物件與一開始產生的一致

之所以 mapping 階段也要計入，一是這樣貼近真實世界應用，二來 FlatBuf 並沒有單獨「反序列化」的過程，所以將 mapping 階段都一併計入比較公平

然後就是將序列化反序列化的回合執行一百萬次，以避免有 warm up 問題

## Benchmark 結果

直接上測試結果

![Gson, ProtoBuf, and FlatBuf Benchmark](https://res.cloudinary.com/dcvgho2zc/image/upload/v1641285735/Tech%20Blog/gson-protobuf-flatbuf-benchmark.png)

從圖中可以得知其實 ProtoBuf 與 FlatBuf 在速度上其實差不多，頂多 ProtoBuf 在序列化上稍微快一點點，相對 FlatBuf 在反序列化上也稍微快一點點，但整體上相差不是很大

不過在最大記憶體用量上，FlatBuf 完勝 ProtoBuf，以 FlatBuf 的特性而言這當然也是可預期的結果

至於 Gson 嘛...全都墊底也是可預期的結果，畢竟 JSON 強項本來就不在效能上，可讀性、跨平台、廣泛支援度等才是它的主戰場

## 結論

其實在撰寫的過程可以感受到 Gson 的程式碼撰寫絕對是最容易的，即使是 mapper 也幾乎不用額外多寫太多程式碼，portable 方面絕對是最強的，被廣泛使用還是有道理的

而 ProtoBuf 也是相對成熟的 library，雖然也不需要寫太多額外的程式碼，但它支援的資料型別就少很多了，像是不支援日期相關型別或 `BigDecimal` 這種

> 當然，JSON 其實原生支援的型別也不多，但成熟的 library 讓你不需要考慮資料型別問題，幾乎 Java 所有原生型別全都能夠順利序列化再反序列化；而 ProtoBuf 轉換的程式碼是由工具自動產生，所以有很多型別是不可能會自動產生的

至於 FlatBuf 則是三者當中最不成熟的 library，沒辦法，這個專案 2014 才開始，不像 ProtoBuf 是從 2001 開始

FlatBuf 在序列化上是相對最麻煩的一個，因為它其實在設定物件各 properties 的過程中就一併開始轉換二進制格式的機制；反序列化後的使用上倒是與其他 library 相同，可以直接從從物件取得 property，但受限於它原生支援的資料型別比 ProtoBuf 更少，所以不做 mapping 的話就更難使用一點

最後，附上測試專案的程式碼以供參考

[Serialization Libraries Benchmark](https://github.com/idontwannarock/serialization-lib-benchmark)

## 參考連結

- [Protocol Buffers](https://developers.google.com/protocol-buffers/)
- [Protocol Buffers Wiki](https://en.wikipedia.org/wiki/Protocol_Buffers)
- [FlatBuffers](https://google.github.io/flatbuffers/index.html)
- [FlatBuffers Wiki](https://en.wikipedia.org/wiki/FlatBuffers)
