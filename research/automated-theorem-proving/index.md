---
layout: page
title: "Automated Theorem Proving"
permalink: /research/automated-theorem-proving/
nav_order: 7
---
<!-- Auto-list every article whose first category matches this slug -->
<ul class="post-list">
{% assign posts = site.research
   | where_exp: "p", "p.categories[0] == 'automated-theorem-proving'"
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
