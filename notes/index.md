---
layout: page
title: "Notes"
permalink: /notes/
nav_order: 4 # Assuming Home is 1, CV is 2, Research is 3
---

<ul class="post-list">
{% assign posts = site.notes | sort: "date" | reverse %}
{% for post in posts %}
  <li>
    <h3>{{ post.title }}</h3>
    <small>{{ post.date | date: '%-d %b %Y' }}</small>
    <p>{{ post.excerpt | strip_html | truncatewords: 40 }}</p>
    <a href="{{ post.url | relative_url }}">Read more →</a>
  </li>
{% endfor %}
</ul>
