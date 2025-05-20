---
layout: page
title: "Probability Statistics"
permalink: /research/probability-statistics/
nav_order: 3
---
<!-- Auto-list every article whose first category matches this slug -->
<ul class="post-list">
{% assign posts = site.research
   | where_exp: "p", "p.categories[0] == 'probability-statistics'"
   | sort: "date" | reverse %}
{% for post in posts %}
  <li>
    <h3><a href="{{ post.url | relative_url }}">{{ post.title }}</a></h3>
    <small>{{ post.date | date: '%-d %b %Y' }}</small>
    <p>{{ post.excerpt | strip_html | truncatewords: 40 }}</p>
    <a href="{{ post.url | relative_url }}">Read more →</a>
  </li>
{% endfor %}
</ul>

