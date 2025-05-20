---
layout: page
title: "Financial Mathematics"
permalink: /research/financial-mathematics/
nav_order: 4
---
<!-- Auto-list every article whose first category matches this slug -->
<ul>
{% assign posts = site.research | where_exp: "p", "p.categories[0] == 'financial-mathematics'" | sort: "date" | reverse %}
{% for post in posts %}
  <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a> <small>— {{ post.date | date: '%-d %b %Y' }}</small></li>
{% endfor %}
</ul>
