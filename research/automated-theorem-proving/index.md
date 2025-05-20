---
layout: page
title: "Automated Theorem Proving"
permalink: /research/automated-theorem-proving/
nav_order: 7
---
<!-- Auto-list every article whose first category matches this slug -->
<ul>
{% assign posts = site.research | where_exp: "p", "p.categories[0] == 'automated-theorem-proving'" | sort: "date" | reverse %}
{% for post in posts %}
  <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a> <small>— {{ post.date | date: '%-d %b %Y' }}</small></li>
{% endfor %}
</ul>
