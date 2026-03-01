---
layout: page
title: "Machine Learning"
permalink: /notes/machine-learning/
nav_order: 4
---
<div class="academic-page">
  <ul class="compact-list">
  {% assign posts = site.notes | where_exp: "p", "p.categories contains 'machine-learning'" | sort: "date" | reverse %}
  {% for post in posts %}
    <li>
      <span class="date-label">{{ post.date | date: '%Y' }}</span>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
    </li>
  {% endfor %}
  </ul>
</div>

