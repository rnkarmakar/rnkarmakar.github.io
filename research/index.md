---
layout: page
title: "Research"
permalink: /research/
nav_order: 3
---

<div class="academic-page">

{% assign publications = site.research | sort: "date" | reverse %}
{% assign grouped_pubs = publications | group_by_exp: "item", "item.date | date: '%Y'" %}

{% for year_group in grouped_pubs %}
  <h2>{{ year_group.name }}</h2>
  <ul class="compact-list">
    {% for post in year_group.items %}
      <li>
        <!-- If you want to link to an external PDF directly, add 'pdf: url' to front matter -->
        <!-- Otherwise, it links to the internal page -->
        <a href="{{ post.url | relative_url }}"><strong>{{ post.title }}</strong></a>.
        
        <!-- Optional: Add co-authors or journal here manually or via front matter -->
        {% if post.tags %}
          <span style="color:#666; font-size: 0.9em;">({{ post.tags | join: ", " }})</span>
        {% endif %}

        <span class="meta-links">
          [<a href="{{ post.url | relative_url }}">HTML</a>]
          <!-- Example: Check if a PDF exists in assets with the slug name -->
          <!-- You can customize this logic based on how you store PDFs -->
          [<a href="/assets/pdf/{{ post.slug }}.pdf">PDF</a>]
        </span>
      </li>
    {% endfor %}
  </ul>
{% endfor %}

</div>
