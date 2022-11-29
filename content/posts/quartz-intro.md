---
title: "Quartz 介紹"
date: 2022-11-15T16:24:46+08:00
slug: "quartz-intro"
description: "簡介 Quartz 這個 Java 生態圈有名的排程框架"
tags: ["quartz", "scheduling", "java"]
categories: "concept"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

Quartz 系列：

- Quartz 介紹
- [Spring Boot 整合 Quartz 集群執行預設及動態排程](https://idontwannarock.github.io/tech_blog/2022/11/quartz-cluster-fixed-and-dynamic-trigger-spring-boot-integration/)
- Quartz Misfire Handling Instruction

Quartz 是 Java 生態中一套成熟的開源排程框架，其完整的排程功能包含多樣排程設定、自動任務調度、任務持久化，以及支援分散式排程調度、自動負載平衡，讓排程可以輕鬆運行、應用可以輕鬆 scale out

# 概念

## 核心元件

- `Job`: 任務需要執行的內容；`Job` 有區分是否可併行執行，不能併行執行意思是只有上一次觸發的任務執行完後才能觸發下一次執行；另外，一個 `Job` 可以關聯到多個 `Trigger`，也就是同一個 `Job` 可以以不同時間規則多次觸發，但一個 `Trigger` 只能關聯一個 `Job`
- `JobDetail`: 包含任務的設定，也就是要實例化 `Job` 時的相關設定；由 `JobKey` (Job 名稱 name 和分組 group)、`JobClass`、`JobDataMap` (任務相關數據)、`JobBuilder` 組成，並可以設定任務調度的方案和策略，並指定要調度的 `Job` 類別
- `Trigger`: 設定觸發執行 `Job` 實例的時間規則；`Scheduler` 負責掃描需要執行的 `Job` 任務，而 `Trigger` 負責告訴 `Scheduler` 何時執行；Quartz 2.3.2 版提供 `SimpleTrigger`、`CronTrigger`、`DailyTimeIntervalTrigger` 及 `CalendarIntervalTrigger` 等 `Trigger`
- `Scheduler`: 任務調度器，會讀取 `Trigger` 從而觸發以 `JobDetail` 產生的 `Job` 實例；一個調度器中可以註冊多個 `JobDetail` 及 `Trigger`，只要 `JobDetail` 與 `Trigger` 組合，就可以被 `Scheduler` 調度

## 單體 stand-alone 模式運作

流程很簡單，就是 `Scheduler` 負責管理 `Trigger` 及 `Job`，會讀取 `Trigger` 並按照設定觸發時間規則，到時間就依照 `JobDetail` 設定產生跟該 `Trigger` 關聯的 `Job` 實例並運行

## 集群 cluster 模式原理

集群模式就不如單體模式這麼單純，有以下三個問題需要處理：

- `Job` 資訊的保存
- 各節點狀態更新以及 failover
- 保證任務執行的一致性，避免重複執行

而 Quartz 的集群並不需要節點之間互相通訊，只依賴可以共同存取的的資料，就可達成分散式任務調度，也不需要在不同應用實例之間做額外配置

### 資料保存方式

首先 Quartz 中的 `Trigger` 和 `Job` 需要保存下來才能使用，目前 Quartz 提供四種保存方式：

- `RAMJobStore`: 資料保存在記憶體，只適合 stand-alone 應用
- `JobStoreTX`: 資料以 JDBC 方式保存，會自行透過 db connection 處理 transaction，適合 stand-alone 應用
- `JobStroeCMT`: 資料以 JDBC 方式保存，但依賴應用去管理 transaction，適合分散式 transaction，例如使用 JTA 操作分散式 transaction 的應用
- `TerracottaJobStore`: 資料保存在 Terracotta server (Terracotta 公司開發專門用來提供 Terracotta 公司產品分散式 in-memory 資料管理的應用)，因為 Terracotta server 有特別優化，所以適合需要比保存資料在 database 效能更高，但也同時需要分散式調度排程的應用

#### 資料庫 schema

以下是 Quartz 2.3.2 版本採用 `JobStoreTX` 或 `JobStoreCMT` 所需要的 11 張資料表

|Table Name|Description|
|:--|:--|
|QRTZ_BLOB_TRIGGERS|以 Blob 類型保存的 `Trigger`|
|QRTZ_CALENDARS|保存日曆資訊|
|QRTZ_CRON_TRIGGERS|保存 Cron 類型的 `Trigger`，包含 Quartz cron expression 及時區|
|QRTZ_FIRED_TRIGGERS|保存已觸發 `Trigger` 相關的狀態資訊，以及相關 `Job` 的執行資訊|
|QRTZ_JOB_DETAILS|保存 `JobDetail` 的設定跟資訊|
|QRTZ_LOCKS|保存悲觀鎖的資訊|
|QRTZ_PAUSED_TRIGGER_GRPS|保存已暫停的 `Trigger` 分組相關資訊|
|QRTZ_SCHEDULER_STATE|保存 `Scheduler` 相關的狀態資訊|
|QRTZ_SIMPLE_TRIGGERS|以 Simple 類型保存的 `Trigger`，包含重複次數、間隔及已觸發的次數|
|QRTZ_SIMPROP_TRIGGERS|作用未明|
|QRTZ_TRIGGERS|保存已設定的 `Trigger` 基本資訊|

### 節點狀態更新及 Failover

前面有提到 Quartz 並不需要節點之間互相通訊，而是透過各節點自行定時保持心跳更新 `QRTZ_SCHEDULER_STATE` 當中的 `LAST_CHECKIN_TIME`

再來是每個節點都會檢查所有其他節點的 `LAST_CHECKIN_TIME` 是否過期，如果過期就認為該節點失效：

```java
protected List<SchedulerStateRecord> findFailedInstances(Connection conn) throws JobPersistenceException {
	try {
		...
		List<SchedulerStateRecord> states = getDelegate().selectSchedulerStateRecords(conn, null);

		for(SchedulerStateRecord rec: states) {

			// find own record...
			if (rec.getSchedulerInstanceId().equals(getInstanceId())) {
				foundThisScheduler = true;
				if (firstCheckIn) {
					failedInstances.add(rec);
				}
			} else {
				// find failed instances...
				if (calcFailedIfAfter(rec) < timeNow) {
					failedInstances.add(rec);
				}
			}
		}
		...
	}
	...
}

protected long calcFailedIfAfter(SchedulerStateRecord rec) {
	return rec.getCheckinTimestamp() +
		Math.max(rec.getCheckinInterval(), 
			(System.currentTimeMillis() - lastCheckin)) +
		7500L;
}
```

接著就會依照檢查到的 fail 節點列表去取得那些實例在處理的 `Trigger`，並將那些 `Trigger` 從 `QRTZ_FIRED_TRIGGERS` 表中刪除，再從 `QRTZ_SCHEDULER_STATE` 表中刪除那些 fail 的節點，即可達成 failover：

```java
protected void clusterRecover(Connection conn, List<SchedulerStateRecord> failedInstances) throws JobPersistenceException {

	if (failedInstances.size() > 0) {
		...

		// release acquired triggers..
		getDelegate().updateTriggerStateFromOtherState(
				conn, tKey, STATE_WAITING,
				STATE_ACQUIRED);
		...

		getDelegate().deleteFiredTriggers(conn, rec.getSchedulerInstanceId());
		...

		if (!rec.getSchedulerInstanceId().equals(getInstanceId())) {
			getDelegate().deleteSchedulerState(conn, rec.getSchedulerInstanceId());
		}
		...
	}
}
```

所以我們可以得知 Quartz 更新節點狀態是依靠運行環境的時間來進行同步，所以實際情況下，如果各節點運行在不同環境，需要注意各環境之間時間的同步

### 保證任務執行的一致性

> 以下討論皆以採用 `JobStroeTX` 並配合 MySQL 來繼續討論 Quartz 集群機制，可以比較清楚看到 Quartz 實作的步驟；若是採用 `JobStoreCMT` 則要看應用本身提供怎樣的 transaction 機制，例如 JTA，但除了 transaction 的部分，其他概念大致上還是相同，所以其餘步驟也是大致相同

Quartz 保證任務執行一致性的方式實際上是在各節點認領 `Trigger` 時，先透過 database 本身支援的 row lock，例如 MySQL 在開啟 transaction 後，可透過 `select * from QRTZ_LOCKS where SCHED_NAME = <scheduleName> AND LOCK_NAME = ? for update` 語句取得 row lock 實作悲觀鎖，以確保任務不會被重複執行：

```java
protected <T> T executeInNonManagedTXLock(
	String lockName, 
	TransactionCallback<T> txCallback, final TransactionValidator<T> txValidator) throws JobPersistenceException {
	...

	transOwner = getLockHandler().obtainLock(conn, lockName);
	...

	final T result = txCallback.execute(conn);
	...

	releaseLock(lockName, transOwner);
	...
}

protected List<OperableTrigger> acquireNextTrigger(Connection conn, long noLaterThan, int maxCount, long timeWindow) throws JobPersistenceException {
	...

	List<TriggerKey> keys = getDelegate().selectTriggerToAcquire(conn, noLaterThan + timeWindow, getMisfireTime(), maxCount);  
	...

	for(TriggerKey triggerKey: keys) {
		...

		JobDetail job = = retrieveJob(conn, jobKey);
		...

		int rowsUpdated = getDelegate().updateTriggerStateFromOtherState(conn, triggerKey, STATE_ACQUIRED, STATE_WAITING);
		...

		getDelegate().insertFiredTrigger(conn, nextTrigger, STATE_ACQUIRED, null);
		...

		acquiredTriggers.add(nextTrigger);
		...
	}
	...

	return acquiredTriggers;
}
```

# 結語

這篇簡單探討過 Quartz 單體跟集群的任務分配機制後，下一篇就要進入實作部分

# Reference

- [Quartz简介](https://blog.csdn.net/ThinkWon/article/details/109936696)
- [Creating the Quartz Database Structure](https://flylib.com/books/en/2.65.1/creating_the_quartz_database_structure.html)
