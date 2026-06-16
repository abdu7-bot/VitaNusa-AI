const panelList = document.querySelector(".panel-list");

if (panelList) {
  const totalPanel = Number(panelList.dataset.totalPanel) || 21;

  for (let i = 1; i <= totalPanel; i++) {
    const figure = document.createElement("figure");
    figure.className = "panel-item";

    const img = document.createElement("img");
    img.src = `panel-${i}.png`;
    img.alt = `Panel ${i}: Reff di Jalan Cahaya`;
    img.loading = i === 1 ? "eager" : "lazy";

    figure.appendChild(img);
    panelList.appendChild(figure);

    if (i < totalPanel) {
      const line = document.createElement("hr");
      line.className = "panel-line";
      line.setAttribute("aria-hidden", "true");
      panelList.appendChild(line);
    }
  }
}