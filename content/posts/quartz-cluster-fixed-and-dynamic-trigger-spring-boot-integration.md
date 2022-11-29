---
title: "Spring Boot 整合 Quartz 集群執行預設及動態排程"
date: 2022-11-15T16:54:13+08:00
slug: "quartz-cluster-fixed-and-dynamic-trigger-spring-boot-integration"
description: "介紹如何在 Spring Boot 整合 Quartz 集群框架中同時實作預設及動態排程"
tags: ["spring-boot", "quartz", "quartz-cluster", "dynamic-trigger"]
categories: "implementation"
featured_image: ""
draft: false
comment: true
enableLaTeX: false
---

Quartz 系列：

- [Quartz 介紹](https://idontwannarock.github.io/tech_blog/2022/11/quartz-intro/)
- Spring Boot 整合 Quartz 集群執行預設及動態排程
- Quartz Misfire Handling Instruction

Spring Boot 官方本身就有 `spring-boot-starter-quartz` 來提供 Quartz 整合，所以在 Spring Boot 當中使用基本 Quartz 功能已經非常簡單

至於動態產生排程，網路上也很多教學，只是大多是採用 API 呼叫的方式去動態產生、運行、暫停、刪除排程等功能，而幾乎沒看到利用預設排程定時從 database 取得動態排程設定，並動態產生或移除排程的功能

接下來探討如何在 Spring Boot 整合 Quartz 的框架中實作以上需求，來達成依照自訂動態排程來發通知的需求

> 以下討論採用 Spring Boot 2.7.5 及 Quartz 2.3.2 版本並搭配 MySQL 做持久化

# Database Schema

首先需要在 MySQL 內建立相關的 schema，可以利用官方提供的這個 [script](https://github.com/quartz-scheduler/quartz/blob/master/quartz-core/src/main/resources/org/quartz/impl/jdbcjobstore/tables_mysql_innodb.sql) 來建立，並額外依照以下 sql 建立動態通知排程的 table：

```sql
create table if not exist NOTIFICATION_SCHEDULE
(
    ID                int auto_increment
        primary key,
    CRON              varchar(100)                          not null comment 'Quartz type cron',
    TIMEZONE          varchar(64) default 'Asia/Taipei'     null,
    TEMPLATE_ID       int                                   not null,
    IS_ONLINE         tinyint(1)  default 1                 null,
    IS_DELETED        tinyint(1)  default 0                 null,
    CREATE_TIME       datetime    default CURRENT_TIMESTAMP null,
    UPDATE_TIME       datetime                              null on update CURRENT_TIMESTAMP
) comment '紀錄通知排程資訊';
```

# Dependency

接著在 pom 檔引用以下依賴：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-quartz</artifactId>
</dependency>
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <optional>true</optional>
</dependency>
```

# Properties

在 `application.yml` 檔中加入以下 property：

```yml
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3306/mms?characterEncoding=UTF-8&useSSL=false
    username: root
    password: root
    driver-class-name: com.mysql.cj.jdbc.Driver
    tomcat:
      init-s-q-l: SET NAMES utf8mb4
  jpa:
    open-in-view: false
    database-platform: org.hibernate.dialect.MySQL57Dialect
    hibernate:
      ddl-auto: none
      naming:
        physical-strategy: org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl
        implicit-strategy: org.hibernate.boot.model.naming.ImplicitNamingStrategyLegacyJpaImpl
  quartz:
    job-store-type: jdbc
    overwrite-existing-jobs: true
    properties:
      org:
        quartz:
          scheduler:
            instanceName: demo-scheduler
            instanceId: AUTO
          jobStore:
            clusterCheckinInterval: 5000
            isClustered: true
```

其中主要是 `spring.quartz.job-store-type=jdbc` 這條 property 的設定告訴 Quartz 要使用 JDBC 的 JobStore，再加上 Spring Boot 預設就會啟用 `JobStoreCMT` 來保存資料到 database，並利用自帶的 transaction management

另外 `spring.quartz.properties.org.quartz.jobStore.isClustered=true` 則是開啟 Quartz 集群功能

# Autowire Configuration

接著要來設定在我們動態產生 `Trigger` 及相關的 `Job` 時能同樣利用 Spring 的 autowire 功能，要先建立一個繼承 `SpringBeanJobFactory` 的類別：

```java
import org.quartz.spi.TriggerFiredBundle;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.scheduling.quartz.SpringBeanJobFactory;
import org.springframework.util.Assert;

public class AutowireCapableBeanJobFactory extends SpringBeanJobFactory {

    private final AutowireCapableBeanFactory beanFactory;

    public AutowireCapableBeanJobFactory(AutowireCapableBeanFactory beanFactory) {
        Assert.notNull(beanFactory, "Bean factory must not be null");
        this.beanFactory = beanFactory;
    }

    @Override
    protected Object createJobInstance(TriggerFiredBundle bundle) throws Exception {
        final Object job = super.createJobInstance(bundle);
        this.beanFactory.autowireBean(job);
        return job;
    }
}
```

再來要將這個 JobFactory 設定到 `SchedulerFactoryBean` 裡面，但這邊很多網路文章都教直接 `new` 一個 `SchedulerFactoryBean` 出來後再標記 `@Bean` 的做法，但 [官方文件](https://docs.spring.io/spring-boot/docs/current/reference/html/io.html#io.quartz) (雖然只有短短幾行) 有提到

> Quartz Scheduler configuration can be customized using `spring.quartz` properties and `SchedulerFactoryBeanCustomizer` beans, which allow programmatic `SchedulerFactoryBean` customization.

所以我們要利用 Spring Boot 整合 Quartz 提供的 `SchedulerFactoryBeanCustomizer` 來做設定

```java
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.quartz.SchedulerFactoryBeanCustomizer;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;

import javax.sql.DataSource;

@RequiredArgsConstructor
@Configuration
public class CustomSchedulerFactoryBeanCustomizer implements SchedulerFactoryBeanCustomizer {

    private final DataSource dataSource;

    private final ThreadPoolTaskExecutor schedulerExecutor;

    private final ApplicationContext applicationContext;
    
    @Override
    public void customize(SchedulerFactoryBean schedulerFactoryBean) {
        var jobFactory = new AutowireCapableBeanJobFactory(applicationContext.getAutowireCapableBeanFactory());
        schedulerFactoryBean.setDataSource(dataSource);
        schedulerFactoryBean.setTaskExecutor(schedulerExecutor);
        schedulerFactoryBean.setJobFactory(jobFactory);
        schedulerFactoryBean.setWaitForJobsToCompleteOnShutdown(true);
        schedulerFactoryBean.setStartupDelay(5);
    }
}
```

其中因為要讓 Quartz 保存資料到 database，所以需要提供 `DataSource`；然後如果想要控制 Quartz 運行使用的 thread pool，也可以提供自訂的 `Executor`，預設 Quartz 會自己使用 `SimpleThreadPool` 來操作

最後就是要注入 `ApplicationContext`，因為我們需要取得 `AutowireCapableBeanFactory` 來給我們前面建立的 `AutowireCapableBeanJobFactory` 提供必需的 `BeanFactory` 以在建立 `Job` 實例時做 autowire

至此，基本架構設定已經完成

# 建立任務

接著要來建立會定時掃描 `NOTIFICATION_SCHEDULE` 並建立、更新、刪除對應排程的 `Job`

但首先先建立對應的 entity 及 repository

```java
import lombok.Data;

import javax.persistence.*;
import java.io.Serializable;

@Data
@Entity
@Table(name = "NOTIFICATION_SCHEDULE")
public class NotificationScheduleDo implements Serializable {

    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Id
    @Column(name = "ID")
    private Integer id;
    @Column(name = "CRON", columnDefinition = "VARCHAR(100)", nullable = false)
    private String cron;
    @Column(name = "TIMEZONE", columnDefinition = "VARCHAR(64) DEFAULT 'Asia/Taipei'")
    private String timezone;
    @Column(name = "TEMPLATE_ID", nullable = false)
    private Integer templateId;
    @Column(name = "IS_ONLINE")
    private Boolean online;
    @Column(name = "IS_DELETED")
    private Boolean deleted;
}
```

這裡有個細節要注意，因為在設定 `JobDetail` 的時候，可以設定在建立 `Job` 實例時動態帶上的資料，只是要放在 `JobDataMap` 裡面，它本質是個 `Map<String, Object>`

如果你想把這整個 entity 保存到 `JobDataMap` 裡面的話，就必須要實作 `Serializable` 介面

```java
import com.example.demospringbootquartzcluster.adapter.dao.entity.NotificationScheduleDo;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationScheduleRepository extends JpaRepository<NotificationScheduleDo, Integer> {
}
```

接著要建立 `CreateNotificationSchedulerJob`

```java
import com.example.demospringbootquartzcluster.adapter.dao.entity.NotificationScheduleDo;
import com.example.demospringbootquartzcluster.adapter.dao.repository.NotificationScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.*;
import org.springframework.scheduling.quartz.QuartzJobBean;

import java.time.ZoneId;
import java.util.List;
import java.util.TimeZone;

@Slf4j
@RequiredArgsConstructor
@DisallowConcurrentExecution
public class CreateNotificationSchedulerJob extends QuartzJobBean {

    private final NotificationScheduleRepository notificationScheduleRepository;

    private final Scheduler scheduler;

    @Override
    protected void executeInternal(JobExecutionContext context) {
        for (NotificationScheduleDo schedule : retrieveNotificationSchedules()) {
            try {
                String name = getName(schedule);
                String group = getGroup(schedule);
                if (checkIfTriggerExist(name, group)) {
                    if (scheduleDisabledOrDeleted(schedule)) {
                        deleteTrigger(name, group);
                    } else if (checkIfScheduleModified(name, group, schedule)) {
                        updateTrigger(name, group, schedule);
                    }
                } else {
                    createTrigger(name, group, schedule);
                }
            } catch (SchedulerException e) {
                log.error(e.getMessage(), e);
            }
        }
    }

    private List<NotificationScheduleDo> retrieveNotificationSchedules() {
        return notificationScheduleRepository.findAll();
    }

    private boolean checkIfTriggerExist(String name, String group) {
        try {
            return scheduler.checkExists(TriggerKey.triggerKey(name, group));
        } catch (SchedulerException e) {
            return false;
        }
    }

    private boolean scheduleDisabledOrDeleted(NotificationScheduleDo schedule) {
        return !schedule.getOnline() || schedule.getDeleted();
    }

    private void deleteTrigger(String name, String group) {
        try {
            scheduler.unscheduleJob(TriggerKey.triggerKey(name, group));
        } catch (SchedulerException ignored) { }
    }

    private boolean checkIfScheduleModified(String name, String group, NotificationScheduleDo schedule) {
        try {
            CronTrigger trigger = (CronTrigger) scheduler.getTrigger(TriggerKey.triggerKey(name, group));
            return !trigger.getCronExpression().equals(schedule.getCron())
                    || !trigger.getTimeZone().getID().equals(schedule.getTimezone());
        } catch (SchedulerException e) {
            return false;
        }
    }

    private void updateTrigger(String name, String group, NotificationScheduleDo schedule) {
        JobDetail jobDetail = createJobDetail(name, group, schedule);
        Trigger newTrigger = buildTrigger(jobDetail, schedule.getCron(), schedule.getTimezone());
        try {
            scheduler.rescheduleJob(TriggerKey.triggerKey(name, group), newTrigger);
            log.info("Job with key - {} updated successfully", newTrigger.getJobKey());
        } catch (SchedulerException e) {
            log.error("Could not update job with key - {} due to error - {}", newTrigger.getJobKey(), e.getMessage());
            e.printStackTrace();
        }
    }

    private void createTrigger(String name, String group, NotificationScheduleDo schedule) throws SchedulerException {
        JobDetail jobDetail = createJobDetail(name, group, schedule);
        Trigger trigger = buildTrigger(jobDetail, schedule.getCron(), schedule.getTimezone());
        try {
            scheduler.scheduleJob(jobDetail, trigger);
            log.info("Job with key - {} saved successfully", trigger.getJobKey());
        } catch (SchedulerException e) {
            log.error("Could not save job with key - {} due to error - {}", trigger.getJobKey(), e.getMessage());
            e.printStackTrace();
        }
    }

    private static String getName(NotificationScheduleDo schedule) {
        return String.valueOf(schedule.getId());
    }

    private static String getGroup(NotificationScheduleDo schedule) {
        return String.valueOf(schedule.getTemplateId());
    }

    private static JobDetail createJobDetail(String name, String group, NotificationScheduleDo schedule) {
        var jobDataMap = new JobDataMap();
        jobDataMap.put("notificationSchedule", schedule);
        return JobBuilder.newJob()
                .ofType(NotificationJob.class)
                .requestRecovery()
                .storeDurably()
                .usingJobData(jobDataMap)
                .withIdentity(name, group)
                .build();
    }

    private static Trigger buildTrigger(JobDetail jobDetail, String cron, String zoneId) {
        return TriggerBuilder.newTrigger()
                .forJob(jobDetail)
                .withIdentity(jobDetail.getKey().getName(), jobDetail.getKey().getGroup())
                .usingJobData("cron", cron)
                .startNow()
                .withSchedule(CronScheduleBuilder.cronSchedule(cron)
                        .withMisfireHandlingInstructionFireAndProceed()
                        .inTimeZone(TimeZone.getTimeZone(ZoneId.of(zoneId))))
                .build();
    }
}
```

這裡的重點就是用注入的 `Scheduler` 來操作建立、檢查、更新、刪除 `Trigger` 的動作

這當中建立 `Trigger` 跟 `JobDetail` 的 name 及 group 不是一定要這樣定義，只要 unique 即可，再者 group 也不是必須

這裡也有一個小細節，到底我們應該要實作 Quartz 提供的 `Job` 介面？還是繼承 Spring Boot 提供的 `QuartzJobBean` 類別？

答案是看狀況，因為 `QuartzJobBean` 類別實際上也是實作 Quartz 的 `Job`，只是它額外提供幫你從 `JobDataMap` 裡面自動幫你將指定 key 的 value 注入的功能，所以如果有需要用到就用 `QuartzJobBean`，沒有需要就用 Quartz 原生的 `Job` 也是沒有問題

不過這邊還有另外的問題，如果你想要讓 `QuartzJobBean` 自動幫你注入的是自訂物件而不是 primitive type 或 `String` 的話，可能要另外想辦法提供 converter，但我沒有找到哪邊可以提供這個部分

寫完 `CreateNotificationSchedulerJob` 的邏輯後，就要把它的排程註冊起來

```java
import org.quartz.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CreateNotificationScheduler {

    @Bean
    public JobDetail createNotificationSchedulerJobDetail() {
        return JobBuilder.newJob()
                .ofType(CreateNotificationSchedulerJob.class)
                .requestRecovery(false)
                .storeDurably()
                .withIdentity("create_notification_scheduler", "scheduler_creator")
                .build();
    }

    @Bean
    public Trigger createNotificationSchedulerTrigger(JobDetail createNotificationSchedulerJobDetail) {
        return TriggerBuilder.newTrigger()
                .forJob(createNotificationSchedulerJobDetail)
                .withIdentity("create_notification_scheduler", "scheduler_creator")
                .startNow()
                .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(30))
                .build();
    }
}
```

最後的最後，就是要提供 `NotificationJob` 啦！

```java
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.scheduling.quartz.QuartzJobBean;

public class NotificationJob extends QuartzJobBean {

    @Override
    protected void executeInternal(JobExecutionContext context) throws JobExecutionException {
        JobDataMap map = context.getMergedJobDataMap();
        System.out.format("Map: [%s]\n", map.getWrappedMap());
    }
}
```

# 結論

其實 Quartz 提供 cluster 分散式排程的功能原理講起來很簡單，但它身為一個在 Java 生態系中廣泛使用的排程框架，內部有做了很多 fail safe 的處理並且經歷過時間跟廣大工程師群眾的考驗，所以雖然我們利用樂觀鎖也可以達成部分的功能，但可以不用重複造輪子，在 Quartz 能夠支援使用情境的前提下，可以幫大家省下很多測試修正的時間，也提供一定程度的保障

# Reference

- [MySQL schema script](https://github.com/quartz-scheduler/quartz/blob/master/quartz-core/src/main/resources/org/quartz/impl/jdbcjobstore/tables_mysql_innodb.sql)
- [Spring Boot Quartz Scheduler Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/io.html#io.quartz)
