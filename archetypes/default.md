---
title: "{{ replace .Name "_" " " }}"
date: {{ .Date }}
slug: "{{ .Name }}"
url: "/{{ now.Year }}/{{ dateFormat "01" now }}/{{ .Name }}"
description: ""
tags: ["", ""]
categories: ["Misc"]
# featuredImage: ""
# featuredImageDescription: ""
dropCap: false
displayInMenu: false
displayInList: false
draft: true
resources:
- name: featuredImage
  src: "Filename of the page's featured image, used as the card image and the image at the top of the article"
  params:
    description: "Description for the featured image, used as the alt text"
---

