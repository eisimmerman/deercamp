(() => {
  const links = Array.from(document.querySelectorAll(".nav-link"));
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  if (!sections.length) return;

  const onIntersect = (entries) => {
    const visible = entries
      .filter((e) => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    const id = "#" + visible.target.id;
    links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === id));
  };

  const io = new IntersectionObserver(onIntersect, {
    root: null,
    threshold: 0.3,
  });

  sections.forEach((s) => io.observe(s));
})();
