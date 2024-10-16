---
title: "Percona XtraDB Cluster MySQL with Docker Compose"
date: 2024-10-16T11:06:41+08:00
slug: "pxc_mysql_docker_compose"
description: "How to run MySQL in cluster mode with Percona XtraDB Cluster using Docker Compose"
tags: ["pxc", "percona-xtradb-cluster", "mysql", "docker", "docker-compose"]
categories: "implementation"
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1728273129/Tech%20Blog/pxc_1200_1200.png"
draft: false
comment: true
enableLaTeX: false
---

因為公司 production 採用 Percona XtraDB Cluster 去架設 MySQL cluster，而 cluster mode 有很多預設的環境設定與非 cluster mode 的設定不同，例如 `pxc_strict_mode` 在 cluster mode 下，預設為 `ENFORCING` 或 `MASTER`，但非 cluster mode 的 `pxc_strict_mode` 預設為 `DISABLE` 而且還不能調整為 `ENFORCING`，導致有些 SQL 語法在 production 不支援

為了能夠在本機直接比照 production 環境配置去測試 SQL，所以研究如何快速在本機搭建出 Percona XtraDB Cluster cluster mode 的 MySQL

# 環境

- WSL2 Ubuntu
- Docker and Docker Compose installed and accessible from terminal

# 作法

先在同一個資料夾建立以下幾個文件

## compose.yml

```yaml
services:
  pxc-mysql:
    image: percona/percona-xtradb-cluster:8.0
    container_name: pxc-mysql
    restart: always
    privileged: true
    environment:
      - MYSQL_ROOT_PASSWORD=root
      - MYSQL_DATABASE=mmschat
      - CLUSTER_NAME=pxc-cluster
      - XTRABACKUP_PASSWORD=root
    ports:
      - "3306:3306"
    volumes:
      - "pxc-mysql-data:/var/lib/mysql"
      - "./cert:/cert"
      - "./conf:/etc/percona-xtradb-cluster.conf.d"
      - "./init.sql:/docker-entrypoint-initdb.d/init.sql"
volumes:
  pxc-mysql-data:
```

這份 docker compose 檔建立 pxc cluster mode 的 MySQL

## conf/custom.cnf

在同位置建立 `conf` 資料夾，並在 `conf` 資料夾底下建立 `custom.cnf`

```conf
[mysqld]
ssl-ca = /cert/ca.pem
ssl-cert = /cert/server-cert.pem
ssl-key = /cert/server-key.pem
[client]
ssl-ca = /cert/ca.pem
ssl-cert = /cert/client-cert.pem
ssl-key = /cert/client-key.pem
[sst]
encrypt = 4
ssl-ca = /cert/ca.pem
ssl-cert = /cert/server-cert.pem
ssl-key = /cert/server-key.pem
```

用來配置 SSL 相關檔案位置

## init.sql

```sql
GRANT ALL ON *.* TO 'root'@'%';
FLUSH PRIVILEGES;
```

讓 MySQL 啟動的時候，自動執行此 SQL 設定 root 帳號可以遠端存取

## init.sh

```bash
#!/bin/bash
rm -rf ./cert
mkdir -m 777 -p ./cert
docker run --name pxc-cert --rm -v ./cert:/cert percona/percona-xtradb-cluster:8.0 mysql_ssl_rsa_setup -d /cert
```

這份 script 的步驟如下

1. 清除 `./cert` 資料夾以及其中的所有檔案
2. 重新建立 `./cert` 資料夾
3. 利用 pxc docker image 內建的功能產生 SSL 相關檔案到 `./cert` 資料夾

# 使用

第一次啟動前需要先執行 `sh init.sh` 以建立 SSL 檔案，之後就可以用 docker compose 指令建立、啟動、關閉或銷毀服務

啟動後可以進到 MySQL 使用以下 SQL 指令確認 cluster 狀態

```sql
show status like 'wsrep%';
```

然後檢查以下這幾項的設定，就可以確認 cluster 是否有建立成功

- `wsrep_local_state_comment`: `Synced`
- `wsrep_cluster_size`: `1`
- `wsrep_cluster_status`: `Primary`
- `wsrep_connected`: `ON`
- `wsrep_ready`: `ON`

另外可以使用以下 SQL 指令確認 pxc strict mode，若是 `ENFORCING` 或 `MASTER` 就是跟 production 集群相同

```sql
show variables like 'pxc_strict_mode';
```

# Reference

- [Running Percona XtraDB Cluster in a Docker Container](https://docs.percona.com/percona-xtradb-cluster/8.0/docker.html)
- [使用docker-compose 快速搭建Percona XtraDB Cluster（pxc集群）](https://blog.csdn.net/alwaysbefine/article/details/110748717)
- [[MySQL] Percona XtraDB Cluster on docker-compose](https://piaohua.github.io/post/mysql/20210523-mysql-pxc/)
- [Control startup and shutdown order in Compose](https://docs.docker.com/compose/how-tos/startup-order/)
