---
layout: page
title: "Automated Theorem Proving"
permalink: /notes/automated-theorem-proving/
nav_order: 7
---
<div class="academic-page">
  <ul class="compact-list">
  {% assign posts = site.notes | where_exp: "p", "p.categories contains 'automated-theorem-proving'" | sort: "date" | reverse %}
  {% for post in posts %}
    <li>
      <span class="date-label">{{ post.date | date: '%Y' }}</span>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
  </ul>
</div>
