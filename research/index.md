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
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <small>{{ post.date | date: '%-d %b %Y' }}</small>
    <p>{{ post.excerpt | strip_html | truncatewords: 40 }}</p>
    <a href="{{ post.url | relative_url }}">Read more →</a>
  </li>
{% endfor %}
</ul>
