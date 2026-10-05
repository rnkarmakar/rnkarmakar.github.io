---
layout: blog-index
title: Blog
permalink: /blog/
nav_order: 5
---

<section class="clarity-blog" aria-labelledby="blog-heading">
  <header class="clarity-blog__hero">
    <div class="clarity-blog__hero-topline">
      <p class="clarity-blog__eyebrow">Rathin’s corner · Blog</p>
      <a class="clarity-blog__back-link clarity-blog__back-link--site" href="{{ '/' | relative_url }}">← Back to website</a>
    </div>
    <h1 id="blog-heading" class="clarity-blog__title">Unfiltered</h1>
    <p class="clarity-blog__abstract">Reflections, explanations, and occasional explorations from research and beyond.</p>
  </header>

  <div class="clarity-blog__list">
    {% assign blog_posts = site.posts | sort: "date" | reverse %}
    {% if blog_posts.size > 0 %}
      {% for post in blog_posts %}
        <article class="clarity-blog__entry">
          <p class="clarity-blog__meta"><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%B %-d, %Y" }}</time>{% if post.tags and post.tags.size > 0 %} · {{ post.tags | join: ", " }}{% endif %}</p>
          <h2 class="clarity-blog__entry-title"><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></h2>
          <p class="clarity-blog__entry-excerpt">{{ post.excerpt | strip_html | normalize_whitespace | truncatewords: 42 }}</p>
          <a class="clarity-blog__read-more" href="{{ post.url | relative_url }}">Read post <span aria-hidden="true">→</span></a>
        </article>
      {% endfor %}
    {% else %}
      <p>The first post will appear here soon.</p>
    {% endif %}
  </div>

  <p class="clarity-blog__credit">Article styling is adapted from <a href="https://shikun.io/projects/clarity">Clarity</a> by Shikun Liu. This site’s templates and styles are maintained in this repository.</p>
</section>
