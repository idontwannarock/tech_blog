---
title: "Sql Server 備份方式"
date: 2021-11-16T11:58:47+08:00
slug: "sql_server_backup"
description: ""
tags: ["sql-server", "database"]
categories: application
featured_image: "https://res.cloudinary.com/dcvgho2zc/image/upload/v1637045622/Tech%20Blog/ms-sql-banner.jpg"
draft: false
comment: true
enableLaTeX: false
---

最近工作上碰到需要對 Sql Server 做 snapshot 的場合，所以就順便來研究一下怎麼對 Sql Server 做備份

按照過去的經驗，我第一個想法就是找 Sql Server 有沒有類似 mysqldump 或 pg_dump 的工具可以直接將 schema 及 data 導出成 SQL 檔，這樣方便閱讀也方便各種場景下重建資料庫，尤其是在資料庫的 table 數量及資料量並不算大的前提下

結果，我太天真了，Microsoft 怎麼可能這麼好用 (誤)，人家就是要走自己的路！

## 備份檔案格式

Sql Server 備份出來的檔案格式有以下幾種

- bak: schema + data + log + file，適合做定時備份，因為他會保持包含 index 在內的資料以維持 single point of time 的 transactionally consistent
- DACPAC: schema，適合建立測試環境或比對各環境版本；但也支持下參數加上 data 的備份。實際上是 xml 的壓縮檔
- BACPAC: schema + data，適合轉移或 archive db。schema 部分與 DACPAC 相同，只是加上用 BCP 匯出資料
- sql

## 備份工具

主要有以下幾種備份工具

- [SqlCmd (官方)](https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility?view=sql-server-ver15)
- [BCP (官方)](https://docs.microsoft.com/en-us/sql/tools/bcp-utility?view=sql-server-ver15)
- [SMO (官方)](https://docs.microsoft.com/en-us/sql/relational-databases/server-management-objects-smo/getting-started-in-smo?view=sql-server-ver15)
- [SqlPackage.exe (官方)](https://docs.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage?view=sql-server-ver15)
- [dbatools](https://dbatools.io/)
- [mssql-scripter](https://github.com/Microsoft/mssql-scripter)

### SqlCmd (官方)

需要安裝 Sql Server 或 Microsoft Command Line Utility。若 powershell 要使用，還需要安裝 SqlServer 模組

只能產生出 bak 檔，可包含 schema 及 data，但本身並不包含建立 database

### BCP (官方)

針對同步大量資料的工具，不支援同步 schema

### SMO (官方)

這已經算是要寫程式來控制備份機制了，除了可以用 powershell 來寫以外，其實也可以直接寫 c# 專案來使用這個 library 做備份工作

只要有安裝過 Sql Server 後就會內附該有的 dll

會產生 schema 及 data 的 sql script，但我沒找到產生建立 database 部分的選項可以做設定

可以參考這篇 [Automated Script-generation with Powershell and SMO](https://www.red-gate.com/simple-talk/databases/sql-server/database-administration-sql-server/automated-script-generation-with-powershell-and-smo/) 來撰寫 powershell 檔

### SqlPackage.exe (官方)

可以不需要安裝 sql server，是獨立的程式，而且跨平台

可以選擇 extract (產出 DACPAC) 或 export (產出 BACPAC)

dacpac 只是壓縮檔，解開後，schema 的部分都是 xml，data 就是用 bcp 輸出的檔案。bacpac 也是一樣

不過 SqlPackage 有幾個問題

- Extract dacpac 也可以包含 data (`ExtractAllTableData='True'`)，而且還可以設定是否要 verify (`VerifyExtraction='False'`)，這樣 Export bacpac 不知道要拿來幹嘛
- 還有 Export 不能關閉 verify (`VerifyExtraction='False'`)，會出現以下警告，所以甚至像是在 store procedure 內有用到別的 database 的狀況也會被拒絕

> *** 'VerifyExtraction' is not a valid argument for the 'Export' action.

### dbatools

這是一個第三方套件，功能多到看不完，但官方文件雖然列的一堆功能，但使用者要怎麼使用坦白說我覺得不是很友善

### mssql-scripter

需要安裝並設定好 Python 的環境變數，然後用 pip 安裝

可以產生 schema 及 data 的 sql script

對本地安裝的 Sql Server 操作沒問題，但我拿它來對 docker container 中的 mssql 操作會報權限問題

## 結論

因為考慮到資料庫 table 以及非 log 資料並不多，所以最後選擇用 powershell 操作 smo 的方式產出 sql 檔的方式做 snapshot

以下是我參考這篇 [Automated Script-generation with Powershell and SMO](https://www.red-gate.com/simple-talk/databases/sql-server/database-administration-sql-server/automated-script-generation-with-powershell-and-smo/) 撰寫的 powershell 檔

```powershell
param($datasource, $username, $password, $backupPath)

# set "Option Explicit" to catch subtle errors
set-psdebug -strict

# you can opt to stagger on, bleeding, if an error occurs
$ErrorActionPreference = "stop"

# create backup directory if not exist
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
cd $backupPath

# get current date in yyyyMMdd format
$currentDate = Get-Date -format yyyyMMdd
Write-Output "Current Date = $currentDate"

# get the latest backup directory
Get-ChildItem -Directory -Path . | Sort-Object CreationTime -Descending | Select-Object -First 1 -ExpandProperty Name -OutVariable latestDir | Out-Null
Write-Output "Latest Backup Directory = $latestDir"

# get the latest version of today's backups
$currentVersion = 0
if ($latestDir -Match $currentDate)
{
    $currentVersion = $latestDir.Substring($currentDate.Length + 1)
}
Write-Output "Current Version = $currentVersion"

# create directory for the next version of backup
$nextVersion = [int]$currentVersion + 1
Write-Output "Next Version = $nextVersion"
$nextVersionDir = "$($backupPath)\$($currentDate)_$($nextVersion)"
New-Item -ItemType Directory -Force -Path $nextVersionDir | Out-Null

# load SMO assembly
$msPrefix = 'Microsoft.SqlServer'
[System.Reflection.Assembly]::LoadWithPartialName("$msPrefix.SMO") | out-null
[System.Reflection.Assembly]::LoadWithPartialName("$msPrefix.SMOExtended") | out-null
$smoPrefix = "$msPrefix.Management.Smo"

# set connection
$server = New-Object ("$smoPrefix.Server") $datasource
$server.ConnectionContext.LoginSecure = $false
$server.ConnectionContext.set_Login($username)
$server.ConnectionContext.set_Password($password)

# check connection
if ($server.Version -eq $null ) {Throw "Can't find the instance $datasource"}

# loop through databases names to do back up
foreach ($database in $server.databases)
{
    # skip system databases
    if ($database.Name -in 'Master','Model','MSDB','TempDB','SSISDB','distribution','ReportServer','ReportServerTempDB') {continue}

    # skip offline databases
    if ($database.Status -ne 'Normal') {
        Write-Output ("Skipping Offline: {0}" -f $database.Name)
        continue
    }

    $backupFile = "$($nextVersionDir)\$($database.Name).sql"
    Write-Output "Start to back up $($database.Name)"

    # manually add create database sql statement at the beginning of the sql file
    New-Item $backupFile -ItemType File | Out-Null
    Add-Content $backupFile "USE [master]"
    Add-Content $backupFile "GO"
    Add-Content $backupFile "Drop Database if exists [$($database.Name)];"
    Add-Content $backupFile "GO"
    Add-Content $backupFile "USE [master]"
    Add-Content $backupFile "GO"
    Add-Content $backupFile "CREATE DATABASE [$($database.Name)]"
    Add-Content $backupFile "GO"
    Add-Content $backupFile "USE [$($database.Name)]"
    Add-Content $backupFile "GO"
    Add-Content $backupFile ""

    # set export configuration
    $transfer = New-Object ("$smoPrefix.Transfer") $database
    $transfer.Options.ScriptSchema = $true
    $transfer.Options.ScriptData = $true
    $transfer.Options.ScriptBatchTerminator = $true
    $transfer.Options.ToFileOnly = $true
    $transfer.Options.AppendToFile = $true
    $transfer.Options.Encoding = New-Object ("System.Text.UTF8Encoding")
    $transfer.Options.AllowSystemObjects = $false
    $transfer.Options.Permissions = $true
    $transfer.Options.SchemaQualify = $true
    $transfer.Options.ExtendedProperties = $true
    $transfer.Options.DRIAll = $true
    $transfer.Options.Indexes = $true
    $transfer.Options.Triggers = $true
    $transfer.Options.IncludeHeaders = $true
    $transfer.Options.IncludeIfNotExists = $true
    $transfer.Options.Filename = "$backupFile"
    $transfer.Options.EnforceScriptingOptions = $true

    # start scripting
    $transfer.EnumScriptTransfer()

    Write-Output "Finished backing up $databaseName to $backupFile"
}
```