---
layout: page
title: "Probability Statistics"
permalink: /research/probability-statistics/
nav_order: 1
---
<!-- Auto-list every article whose first category matches this slug -->
<ul>
{% assign posts = site.research | where_exp: "p", "p.categories[0] == 'probability-statistics'" | sort: "date" | reverse %}
{% for post in posts %}
  <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a> <small>— {{ post.date | date: '%-d %b %Y' }}</small></li>
{% endfor %}
</ul>
