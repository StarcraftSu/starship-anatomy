// Each figure arrives as the code that draws it. Fig 1 is drawn at once; the others when they come within a screen
// of view or when the browser is next idle, whichever is first, so scrolling never waits on a drawing. Then each
// figure's live script starts on the drawn stage.
{
  const drawn = new Set();
  const draw = (fig) => {
    if (!fig || drawn.has(fig.id)) return;
    drawn.add(fig.id);
    const { art, data } = fig.build();
    document.getElementById(fig.id).querySelector(".ss-stage").innerHTML = art;
    fig.live(data);
  };
  const [first, ...rest] = SS_FIGS;
  draw(first);

  const near = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) draw(rest.find((fig) => fig.id === entry.target.id));
    },
    { rootMargin: "100% 0px" },
  );
  for (const fig of rest) near.observe(document.getElementById(fig.id));

  const idle = window.requestIdleCallback ? (next) => requestIdleCallback(next, { timeout: 3000 }) : (next) => setTimeout(next, 400);
  const drawNext = () => {
    const fig = rest.find((item) => !drawn.has(item.id));
    if (!fig) return;
    draw(fig);
    idle(drawNext);
  };
  idle(drawNext);
}
