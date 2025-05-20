---
layout: page
title: "Financial Mathematics"
permalink: /research/financial-mathematics/
nav_order: 6
---
<!-- Auto-list every article whose first category matches this slug -->
<ul class="post-list">
{% assign posts = site.research
   | where_exp: "p", "p.categories[0] == 'financial-mathematics'"
   | sort: "date" | reverse %}
{% for post in posts %}
  <li>
    <h3>{{ post.title }}</h3>
    <small>{{ post.date | date: '%-d %b %Y' }}</small>
    <p>{{ post.excerpt | strip_html | truncatewords: 40 }}</p>
    <a href="{{ post.url | relative_url }}">Read more →</a>
  </li>
{% endfor %}
</ul>

