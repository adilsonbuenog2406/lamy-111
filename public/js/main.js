(function () {
  "use strict";

  /* Mobile nav */
  const navToggle = document.querySelector(".nav__toggle");
  const navLinks = document.querySelector(".nav__links");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("is-open");
        navToggle.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Active nav link on scroll (home page only) */
  const sections = document.querySelectorAll("section[id]");
  const navLinkEls = document.querySelectorAll(".nav__link");

  if (sections.length) {
    function updateActiveNav() {
      const scrollY = window.scrollY + 120;
      let current = "";

      sections.forEach((section) => {
        if (section.offsetTop <= scrollY) {
          current = section.getAttribute("id");
        }
      });

      navLinkEls.forEach((link) => {
        const href = link.getAttribute("href");
        link.classList.toggle("nav__link--active", href === `#${current}`);
      });
    }

    window.addEventListener("scroll", updateActiveNav, { passive: true });
  }

  /* Smooth scroll for anchor links */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* Team carousel */
  const carousel = document.getElementById("team-carousel");
  const prevBtn = document.getElementById("team-prev");
  const nextBtn = document.getElementById("team-next");

  if (carousel && prevBtn && nextBtn) {
    const scrollAmount = 368;

    prevBtn.addEventListener("click", () => {
      carousel.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
      carousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }

  /* Team card — collapsed bio with SAIBA MAIS */
  const teamCards = document.querySelectorAll(".team-card");

  teamCards.forEach((card) => {
    const bio = card.querySelector(".team-card__bio");
    const toggle = card.querySelector(".team-card__toggle");
    if (!bio || !toggle) return;

    const checkOverflow = () => {
      if (card.classList.contains("is-expanded")) return;
      card.classList.toggle("has-overflow", bio.scrollHeight > bio.clientHeight + 1);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    toggle.addEventListener("click", () => {
      const expanded = card.classList.toggle("is-expanded");
      toggle.setAttribute("aria-expanded", String(expanded));
      if (!expanded) checkOverflow();
    });
  });

  /* FAQ — only one open at a time */
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* Contact form validation */
  const form = document.getElementById("contact-form");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      let valid = true;
      const fields = form.querySelectorAll(".form-input[required]");

      fields.forEach((field) => {
        field.classList.remove("form-input--error");
        const existing = field.parentElement.querySelector(".form-error");
        if (existing) existing.remove();

        if (!field.value.trim()) {
          valid = false;
          field.classList.add("form-input--error");
          const err = document.createElement("p");
          err.className = "form-error";
          err.textContent = "Este campo é obrigatório.";
          field.parentElement.appendChild(err);
        } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          valid = false;
          field.classList.add("form-input--error");
          const err = document.createElement("p");
          err.className = "form-error";
          err.textContent = "Informe um e-mail válido.";
          field.parentElement.appendChild(err);
        }
      });

      const contactConsent = form.querySelector('[name="contactConsent"]');
      if (contactConsent && !contactConsent.checked) {
        valid = false;
        alert("É necessário autorizar o contato para enviar o formulário.");
      }

      if (valid) {
        alert("Formulário enviado com sucesso! Entraremos em contato em breve.");
        form.reset();
      }
    });
  }

  /* Placeholder images for missing assets */
  const photoFallbacks = {
    "lucas.jpg": "#000A4A",
    "matheus.jpg": "#070235",
    "bruno.jpg": "#4259F0",
    "helena.jpg": "#47464F",
    "isabelle.jpg": "#000A4A",
    "kerollen.jpg": "#070235",
  };

  document.querySelectorAll(
    ".team-card__photo, .article-card__image, .artigos-card__image, .artigos-featured__image, .artigos-featured__avatar, .artigo-detail__hero-img, .artigo-detail__avatar"
  ).forEach((img) => {
    img.addEventListener("error", function onError() {
      const src = this.getAttribute("src") || "";
      const filename = src.split("/").pop();
      const color = photoFallbacks[filename] || "#000A4A";
      const label = this.alt || "Foto";

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="336" height="352"><rect fill="${color}" width="100%" height="100%"/><text fill="#F4F4F4" font-family="sans-serif" font-size="24" font-weight="600" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;

      this.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      this.removeEventListener("error", onError);
    });
  });

  // #region agent log
  function debugFooterLayout() {
    const footerInner = document.querySelector(".footer__inner");
    const contatoInner = document.querySelector(".contato__inner");
    const brand = document.querySelector(".footer__brand");
    const nav = document.querySelector(".footer__links");
    const logo = document.querySelector(".footer__logo-img");
    const innerStyle = footerInner ? getComputedStyle(footerInner) : null;
    const brandRect = brand?.getBoundingClientRect();
    const navRect = nav?.getBoundingClientRect();
    const contatoRect = contatoInner?.getBoundingClientRect();
    const mapRect = document.querySelector(".contato__map")?.getBoundingClientRect();
    const firstLink = nav?.querySelector(".footer__link");
    const secondLink = nav?.querySelectorAll(".footer__link")[1];

    fetch("http://127.0.0.1:7742/ingest/7432ea2d-ca8e-4386-ba89-76eaa905b809", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6c09b9" },
      body: JSON.stringify({
        sessionId: "6c09b9",
        runId: "footer-figma-v3",
        hypothesisId: "FG1-FG4",
        location: "main.js:debugFooterLayout",
        message: "footer grid alignment audit",
        data: {
          innerDisplay: innerStyle?.display ?? null,
          innerGridCols: innerStyle?.gridTemplateColumns ?? null,
          innerGap: innerStyle?.columnGap ?? null,
          footerHeight: document.querySelector(".footer")?.getBoundingClientRect().height ?? null,
          innerHeight: footerInner?.getBoundingClientRect().height ?? null,
          brandLeft: brandRect?.left ?? null,
          navLeft: navRect?.left ?? null,
          brandNavGap: brandRect && navRect ? navRect.left - brandRect.right : null,
          contatoLeft: contatoRect?.left ?? null,
          mapLeft: mapRect?.left ?? null,
          brandAlignsContato: brandRect && contatoRect ? Math.abs(brandRect.left - contatoRect.left) < 2 : null,
          navAlignsMap: navRect && mapRect ? Math.abs(navRect.left - mapRect.left) < 4 : null,
          logoWidth: logo ? getComputedStyle(logo).width : null,
          logoWrapHeight: document.querySelector(".footer__logo")?.getBoundingClientRect().height ?? null,
          linkGap: firstLink && secondLink
            ? secondLink.getBoundingClientRect().left - firstLink.getBoundingClientRect().right
            : null,
          navVerticalOffset: brandRect && navRect
            ? Math.abs((navRect.top + navRect.height / 2) - (brandRect.top + brandRect.height / 2))
            : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }

  window.addEventListener("load", debugFooterLayout);
  window.addEventListener("resize", debugFooterLayout);
  // #endregion

  // #region agent log
  function debugSegmentCardHover() {
    const cards = document.querySelectorAll(".segmentos .glass-card.segment-card, .segment-card--featured");
    if (!cards.length) return;

    cards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        const icon = card.querySelector(".glass-card__icon img, .segment-card__mark");
        const title = card.querySelector(".glass-card__title, .segment-card__title");
        const samples = [0, 16, 50, 100, 150, 200, 300];

        samples.forEach((delay) => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const iconStyle = icon ? getComputedStyle(icon) : null;
              const titleStyle = title ? getComputedStyle(title) : null;
              const cardStyle = getComputedStyle(card);

              fetch("http://127.0.0.1:7742/ingest/7432ea2d-ca8e-4386-ba89-76eaa905b809", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a79065" },
                body: JSON.stringify({
                  sessionId: "a79065",
                  runId: "hover-post-fix",
                  hypothesisId: delay === 0 ? "A,B,C" : "A",
                  location: "main.js:debugSegmentCardHover",
                  message: "segment card hover sample",
                  data: {
                    delayMs: delay,
                    cardClass: card.className,
                    isFeatured: card.classList.contains("segment-card--featured"),
                    bg: cardStyle.backgroundColor,
                    titleColor: titleStyle?.color ?? null,
                    iconFilter: iconStyle?.filter ?? null,
                    iconTransition: iconStyle?.transition ?? null,
                  },
                  timestamp: Date.now(),
                }),
              }).catch(() => {});
            }, delay);
          });
        });
      });
    });
  }

  window.addEventListener("load", debugSegmentCardHover);
  // #endregion
})();
