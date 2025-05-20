---
layout: page
title: "Quantum Probability"
permalink: /research/quantum-probability/
nav_order: 3
---
<!-- Auto-list every article whose first category matches this slug -->
<ul>
{% assign posts = site.research | where_exp: "p", "p.categories[0] == 'quantum-probability'" | sort: "date" | reverse %}
{% for post in posts %}
  <li><a href="{{ post.url | relative_url }}">{{ post.title }}</a> <small>— {{ post.date | date: '%-d %b %Y' }}</small></li>
{% endfor %}
</ul>
