---
layout: page
title: "Research Articles"
permalink: /research/
nav_order: false
---

<ul>
{% assign sorted = site.research | sort: 'date' | reverse %}
{% for post in sorted %}
  <li>
    <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    <small> — {{ post.date | date: '%-d %b %Y' }}</small><br>
    <em>{{ post.categories | join: ', ' }}</em>
  </li>
{% endfor %}
</ul>