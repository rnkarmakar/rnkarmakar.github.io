---
layout: page
title: "Notes"
permalink: /notes/
nav_order: 4
---

<div class="academic-page">

<p>A collection of notes, expositions, and slides from my studies.</p>

<!-- Group notes by Category -->
{% assign all_notes = site.notes | sort: "title" %}
{% assign grouped_notes = all_notes | group_by: "item", "item.categories[0]" %}

{% for group in grouped_notes %}
  <!-- Category Heading -->
  <h2>
    {% if group.name[0] %}
      {{ group.name[0] | replace: '-', ' ' | capitalize }}
    {% else %}
      Uncategorized
    {% endif %}
  </h2>

  <ul class="compact-list">
    {% for note in group.items %}
      <li>
        <a href="{{ note.url | relative_url }}">{{ note.title }}</a>
        <span class="meta-links">
           <!-- Links to the generated HTML page -->
           [<a href="{{ note.url | relative_url }}">Web</a>]
           
           <!-- Logic to guess PDF link location, or use front matter 'pdf_url' if available -->
           [<a href="/assets/pdf/{{ note.slug }}.pdf">PDF</a>]
        </span>
      </li>
    {% endfor %}
  </ul>
{% endfor %}

</div>
