---
title: "Java Optional 為何不推薦做為類別屬性"
date: 2022-10-01T21:44:34+08:00
slug: "java_optional_not_recommand_as_field"
description: ""
tags: ["java", "optional"]
categories: "concept"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

大家有在寫 Java 1.8+ 的時候使用新出的 `Optional` 類別來處理 `null` 的問題嗎？

那在使用的時候有沒有碰到 IntelliJ 提示 `Optional` 不推薦用來當作類別的 field 的黃色警告 (warning) 呢？訊息應該大致如下

```java
/**
 * A container object which may or may not contain a non-{@code null} value.
 * If a value is present, {@code isPresent()} returns {@code true}. If no
 * value is present, the object is considered <i>empty</i> and
 * {@code isPresent()} returns {@code false}.
 *
 * <p>Additional methods that depend on the presence or absence of a contained
 * value are provided, such as {@link #orElse(Object) orElse()}
 * (returns a default value if no value is present) and
 * {@link #ifPresent(Consumer) ifPresent()} (performs an
 * action if a value is present).
 *
 * <p>This is a <a href="../lang/doc-files/ValueBased.html">value-based</a>
 * class; use of identity-sensitive operations (including reference equality
 * ({@code ==}), identity hash code, or synchronization) on instances of
 * {@code Optional} may have unpredictable results and should be avoided.
 *
 * @apiNote
 * {@code Optional} is primarily intended for use as a method return type where
 * there is a clear need to represent "no result," and where using {@code null}
 * is likely to cause errors. A variable whose type is {@code Optional} should
 * never itself be {@code null}; it should always point to an {@code Optional}
 * instance.
 *
 * @param <T> the type of value
 * @since 1.8
 */
```

我剛碰到的時候感覺很奇怪，用 `Optional` 來當 field 表示我們想表達這個 field 有可能是 `null` 有什麼不對嗎？為什麼 IntelliJ 要警告我呢？

我們今天就來研究一下這個問題吧~

## Java 物件的比較

要回答這個問題，首先要了解 Java 是怎麼對物件做比較的

有在寫 Java 的人應該都知道 primitive type 的比較可以直接用 `==`，但非 primitive type (也就是繼承了 `Object` 的類別) 的類別比較物件是否相同時應該使用 `equals()` 方法，而這兩個方式有什麼差別呢？

首先，`==` 是直接比較變數中的值，這個值在 primitive type 來說，例如 `int a = 1; int b = 2; boolean isEqual = a == b;` 的變數 `a` 在跟變數 `b` 做比較的時候就是比較 1 是否等於 2；但若是非 primitive type 的時候，物件的值是什麼呢？就是該物件實例 (instance) 的 reference，也就是該物件在 JVM Heap 當中的位址

> 重新順一次，非全域 (non-static) 變數本身原則上會保存在 JVM stack 當中；變數型態如果是 primitive type，則值就保存在 stack；變數如果是物件，那物件本身的內容實際上是保存在 JVM heap，而 stack 的變數則是保存指向 heap 當中的位址

再來 `equals()` 方法就是調用方法裡面的實作去做比較，如果類別本身沒有實作，那就是找繼承的類別們當中，有實作 `equals()` 方法且繼承樹中最接近該類別的那個實作去執行比較，如果整顆繼承樹都沒有 override 過，那就是用 `Object` 預設的 `equals()` 方法

接著就要再探究 `Object.equals()` 方法倒底是怎麼比較物件的呢？以 Java 11 的版本來說是這樣的

```java
public boolean equals(Object obj) {
    return (this == obj);
}
```

也就是說他同樣會使用 `==` 來比較物件

## `Optional` 類別

`Optional` 是 Java 1.8 推出的新 feature，目的就是為了處理 Java 惡名昭彰的 `NullPointerException`

> 順帶一提 [Null Reference 的發明者 Tony Hoare 公開承認這是個錯誤](https://www.infoq.com/presentations/Null-References-The-Billion-Dollar-Mistake-Tony-Hoare/)

`Optional` 處理 `null` 的做法其實就是在物件外面做一個包裝，讓使用者間接操作物件；而要使用物件之前，`Optional` 的方法有很強的傾向讓使用者先檢查過物件是否為 `null` 後再來將物件取出來使用，從而避免 `NullPointerException`

所以可見變數如果是 `Optional`，那變數裡面的值則是 `Optional` 實例在 heap 裡面的位址

結合上一段的內容，當兩個 `Optional` 做 `==` 比較的時候，比較的是兩個實例在 heap 裡面的位址；而做 `equals()` 比較的時候呢？我們直接看 code，以下是 JDK 11 版本的 `Optional` 實作

```java
@Override
public boolean equals(Object obj) {
    if (this == obj) {
        return true;
    }

    if (!(obj instanceof Optional)) {
        return false;
    }

    Optional<?> other = (Optional<?>) obj;
    return Objects.equals(value, other.value);
}
```

其中 `Objects` 的 `equals()` 實作如下

```java
public static boolean equals(Object a, Object b) {
    return (a == b) || (a != null && a.equals(b));
}
```

從 code 我們可以看得出來，`Optional` 的 `equals()` 實際上都是用 `==` 的方式去做比較，頂多會驗證另外一個實例是否也為 `Optional` 類別而已

## 用 `Optional` 當作類別的 field 時，類別是怎麼做比較的？

其實講到這邊應該就可以了解為什麼 IntelliJ 會提示 `Optional` 不適合用來當作類別的 field 了吧？

其實主要就在於執行比較動作的時候，採用 `Optional` 當作類別 field 容易造成一些不可預期的結果

一般來說，應該相對少人會特別去自己 override `equals()` 方法吧？要不就是直接用 Lombok 或用 IDE 自動產生的 code

首先我們先寫一個最簡單的類別

```java
import java.util.Optional;

public class Test {
    private Optional<Integer> aField;
}
```

如果採用 Lombok 的 `@Data` annotation 的話，實際 compile 出來的 `equals()` 是這樣的

```java
public boolean equals(final Object o) {
    if (o == this) {
        return true;
    } else if (!(o instanceof Test)) {
        return false;
    } else {
        Test other = (Test)o;
        if (!other.canEqual(this)) {
            return false;
        } else {
            Object this$aField = this.getAField();
            Object other$aField = other.getAField();
            if (this$aField == null) {
                if (other$aField != null) {
                    return false;
                }
            } else if (!this$aField.equals(other$aField)) {
                return false;
            }

            return true;
        }
    }
}

protected boolean canEqual(final Object other) {
    return other instanceof Test;
}
```

從代碼中我們可以看到實際上除了 `instanceof` 以外，其他的比較追根究柢還是用的是 `==` 做比較

那我們改用 IDE 自動產生 code 來看看

```java
@Override
public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof Test)) return false;

    Test test = (Test) o;

    return Objects.equals(aField, test.aField);
}
```

可以看出它同樣也是用 `==` 來做比較

## 結論

一般來說，我們要比較兩個相同類別的不同實例是否實質上相同時，通常都不會期待比較的是兩個實例在 heap 中的位址，而是希望比較物件內容，也就是物件包含的資料是否相同，換句話說應該是要比較物件內每個屬性是否相同

雖然可以使用 Lombok 或 IDE 自動產生 code 來避免物件使用 `Object` 類別預設的 `equals()` 方法去做比較，但實際上這種自動產生出來的 code 即使會把每個 field 都拿出來一一比較，但實際上還是使用 `==` 來做 field 比較

所以如果 field 如果不是 primitive type 的話，就還是很容易比較的不是 field 真正的內容，而是該 field 物件的位址，而造成物件比較的結果不穩定

在這種情況下，應該還是建議要自己 override `equals()` 方法的內容，去確實將每個 field 真正的內容取出來比較

另外我們可以回頭看文章最開始的那段警告訊息，其中最後一段

```java
/**
 * @apiNote
 * {@code Optional} is primarily intended for use as a method return type where
 * there is a clear need to represent "no result," and where using {@code null}
 * is likely to cause errors. A variable whose type is {@code Optional} should
 * never itself be {@code null}; it should always point to an {@code Optional}
 * instance.
 */
```

這段很清楚的指出 `Optional` 類別設計的目的主要是為了用來替代方法回傳 null 來代表「沒有結果」這個容易造成錯誤的問題

但如果你說是想要用 `Optional` 當作 field 的類別來表達該 field 可能為 null 的情況怎麼辦？

我的看法是，如果你不想自己小心的 override 有關物件的 `equals()` 方法的話，建議直接改用 Kotlin，Kotlin 有著原生對於表達變數是否可以為 null 的支援

## 參考

- [Lombok `@EqualsAndHashCode`](https://projectlombok.org/features/EqualsAndHashCode)
