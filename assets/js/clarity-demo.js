/* Local interactions for the Clarity-inspired functionality demo. */
(() => {
  "use strict";

  const init = () => {
    document.querySelectorAll(".clarity-demo__slideshow").forEach((root) => {
      const slides = [...root.querySelectorAll("[data-slide]")];
      const buttons = [...root.querySelectorAll("[data-slide-to]")];
      let current = 0;
      const show = (index) => {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          slide.hidden = i !== current;
          slide.classList.toggle("is-active", i === current);
        });
        buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === current)));
      };
      buttons.forEach((button, i) => button.addEventListener("click", () => show(i)));
      if (slides.length) show(0);
    });

    document.querySelectorAll("[data-autoplay]").forEach((root) => {
      const track = root.querySelector(".clarity-demo__auto-track");
      const items = [...root.querySelectorAll(".clarity-demo__auto-card")];
      let index = 0;
      const visible = () => window.matchMedia("(max-width: 600px)").matches ? 1 : 2;
      const max = () => Math.max(0, items.length - visible());
      const update = () => {
        index = Math.min(index, max());
        const gap = parseFloat(getComputedStyle(track).columnGap) || 12;
        const width = items[0]?.getBoundingClientRect().width || 0;
        track.style.transform = `translateX(-${index * (width + gap)}px)`;
      };
      root.querySelector("[data-prev]")?.addEventListener("click", () => { index = index <= 0 ? max() : index - 1; update(); });
      root.querySelector("[data-next]")?.addEventListener("click", () => { index = index >= max() ? 0 : index + 1; update(); });
      let timer = window.setInterval(() => { index = index >= max() ? 0 : index + 1; update(); }, 3600);
      root.addEventListener("mouseenter", () => window.clearInterval(timer));
      root.addEventListener("mouseleave", () => { window.clearInterval(timer); timer = window.setInterval(() => { index = index >= max() ? 0 : index + 1; update(); }, 3600); });
      window.addEventListener("resize", update);
      update();
    });

    const palette = document.querySelector("[data-palette]");
    if (palette) palette.addEventListener("change", () => {
      const art = document.querySelector("[data-selection-art]");
      const caption = document.querySelector("[data-selection-caption]");
      art.dataset.theme = palette.value;
      art.setAttribute("aria-label", `Abstract local illustration in the ${palette.options[palette.selectedIndex].text} theme`);
      caption.textContent = `${palette.options[palette.selectedIndex].text} theme selected.`;
    });

    const range = document.querySelector("[data-compare-range]");
    if (range) range.addEventListener("input", () => {
      document.querySelector("[data-compare]").style.setProperty("--compare", `${range.value}%`);
    });

    const player = document.querySelector("[data-player]");
    if (player) {
      const orbit = player.querySelector("[data-orbit]");
      const speedText = player.querySelector("[data-speed]");
      let speed = 1;
      const setSpeed = () => {
        orbit.style.animationDuration = `${5 / speed}s`;
        speedText.value = `${speed}×`;
      };
      player.querySelector("[data-slower]").addEventListener("click", () => { speed = Math.max(0.25, +(speed - 0.25).toFixed(2)); setSpeed(); });
      player.querySelector("[data-faster]").addEventListener("click", () => { speed = Math.min(3, +(speed + 0.25).toFixed(2)); setSpeed(); });
      player.querySelector("[data-toggle]").addEventListener("click", (event) => {
        const paused = orbit.style.animationPlayState === "paused";
        orbit.style.animationPlayState = paused ? "running" : "paused";
        event.currentTarget.textContent = paused ? "Pause" : "Play";
        event.currentTarget.setAttribute("aria-pressed", String(!paused));
      });
      player.querySelector("[data-reset]").addEventListener("click", () => {
        speed = 1;
        orbit.style.animationPlayState = "running";
        orbit.style.animation = "none";
        void orbit.offsetWidth;
        orbit.style.animation = "";
        player.querySelector("[data-toggle]").textContent = "Pause";
        player.querySelector("[data-toggle]").setAttribute("aria-pressed", "false");
        setSpeed();
      });
      setSpeed();
    }

    document.querySelectorAll("[data-copy-code]").forEach((button) => button.addEventListener("click", async () => {
      const code = button.closest(".clarity-demo__code").querySelector("code");
      const status = button.closest(".clarity-demo__code").querySelector(".clarity-demo__copy-status");
      try {
        await navigator.clipboard.writeText(code.textContent);
        status.textContent = "Copied.";
      } catch {
        status.textContent = "Copy is unavailable in this browser context.";
      }
    }));

    const code = document.querySelector("[data-highlight]");
    if (code) {
      const escaped = code.textContent.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]);
      code.innerHTML = escaped.replace(/(#.*$)|\b(def|return)\b|\b(mean)\b|\b\d+(?:\.\d+)?\b/gm, (token, comment, keyword, fn) => {
        const klass = comment ? "tok-comment" : keyword ? "tok-keyword" : fn ? "tok-function" : "tok-number";
        return `<span class="${klass}">${token}</span>`;
      });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
