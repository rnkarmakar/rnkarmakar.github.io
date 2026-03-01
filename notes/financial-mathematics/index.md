---
layout: page
title: "Financial Mathematics"
permalink: /notes/financial-mathematics/
nav_order: 6
---
<div class="academic-page">
  <ul class="compact-list">
  {% assign posts = site.notes | where_exp: "p", "p.categories contains 'financial-mathematics'" | sort: "date" | reverse %}
  {% for post in posts %}
    <li>
      <span class="date-label">{{ post.date | date: '%Y' }}</span>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
  </ul>
</div>

