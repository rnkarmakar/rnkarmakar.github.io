---
layout: page
title: "Notes"
permalink: /notes/
nav_order: 4
---

<div class="academic-page">

<p>A collection of notes, expositions, and slides from my studies.</p>

<!-- 
  FIX: Use group_by_exp with 'item.categories[0]' 
  This extracts the first category string (e.g., "machine-learning") 
  instead of the array object (["machine-learning"]).
-->
{% assign all_notes = site.notes | sort: "title" %}
{% assign grouped_notes = all_notes | group_by_exp: "item", "item.categories[0]" %}

{% for group in grouped_notes %}
  <h2>
    {% if group.name %}
      <!-- Replace hyphens with spaces and capitalize words -->
      {{ group.name | replace: '-', ' ' | capitalize }}
    {% else %}
      Uncategorized
    {% endif %}
  </h2>

  <ul class="compact-list">
    {% for note in group.items %}
      <li>
        <a href="{{ note.url | relative_url }}"><strong>{{ note.title }}</strong></a>
        
        <!-- Optional: Add concise description or date -->
        <!-- <span style="color:#666; font-size: 0.9em;"> – {{ note.excerpt | strip_html | truncatewords: 10 }}</span> -->

        <span class="meta-links">
           <!-- Link to the web page -->
           [<a href="{{ note.url | relative_url }}">Web</a>]
           
           <!-- Link to PDF (assumes file exists at /assets/pdf/slug.pdf) -->
           [<a href="/assets/pdf/{{ note.slug }}.pdf">PDF</a>]
        </span>
      </li>
    {% endfor %}
  </ul>
{% endfor %}

</div>
