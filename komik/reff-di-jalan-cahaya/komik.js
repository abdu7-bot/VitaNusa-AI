const panelList = document.querySelector(".panel-list");

if (panelList) {
  const totalPanel = Number(panelList.dataset.totalPanel) || 30;

  const markPanelOrientation = (img, figure) => {
    const applyOrientation = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;

      const ratio = img.naturalWidth / img.naturalHeight;

      figure.classList.remove("panel-portrait", "panel-landscape", "panel-square");

      if (ratio > 1.18) {
        figure.classList.add("panel-landscape");
      } else if (ratio < 0.85) {
        figure.classList.add("panel-portrait");
      } else {
        figure.classList.add("panel-square");
      }
    };

    if (img.complete) {
      applyOrientation();
    } else {
      img.addEventListener("load", applyOrientation, { once: true });
    }
  };

  for (let i = 1; i <= totalPanel; i++) {
    const figure = document.createElement("figure");
    figure.className = "panel-item";

    const img = document.createElement("img");
    img.src = `panel-${i}.png`;
    img.alt = `Panel ${i}: Reff di Jalan Cahaya`;
    img.loading = i === 1 ? "eager" : "lazy";
    img.decoding = "async";

    figure.appendChild(img);
    panelList.appendChild(figure);

    markPanelOrientation(img, figure);

    if (i < totalPanel) {
      const line = document.createElement("hr");
      line.className = "panel-line";
      line.setAttribute("aria-hidden", "true");
      panelList.appendChild(line);
    }
  }
}
