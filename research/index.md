---
layout: page
title: "Research"
permalink: /research/
nav_order: 3 # Assuming Home is 1, CV is 2
---

<ul class="post-list">
{% assign posts = site.research | sort: "date" | reverse %}
{% for post in posts %}
  <li>
    <h3>{{ post.title }}</h3>
    <small>{{ post.date | date: '%-d %b %Y' }}</small>
    <p>{{ post.excerpt | strip_html | truncatewords: 40 }}</p>
    <a href="{{ post.url | relative_url }}">Read more →</a>
  </li>
{% endfor %}
</ul>
