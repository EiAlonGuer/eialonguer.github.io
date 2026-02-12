const gallery = document.getElementById("gallery");

const handleOnDown = e => gallery.dataset.mouseDownAt = e.clientX;

const handleOnUp = () => {
  gallery.dataset.mouseDownAt = "0";  
  gallery.dataset.prevPercentage = gallery.dataset.percentage;
}

const handleOnMove = e => {
  if(gallery.dataset.mouseDownAt === "0") return;
  
  const mouseDelta = parseFloat(gallery.dataset.mouseDownAt) - e.clientX,
        maxDelta = window.innerWidth / 2;
  
  const percentage = (mouseDelta / maxDelta) * -100,
        nexP1 = parseFloat(gallery.dataset.prevPercentage) + percentage,
        nextPercentage = Math.max(Math.min(nexP1, 0), -100);
  
  gallery.dataset.percentage = nextPercentage;
  
  gallery.animate({
    transform: `translate(${nextPercentage}%, -50%)`
  }, { duration: 1200, fill: "forwards" });
  
  for(const image of gallery.getElementsByClassName("image")) {
    image.animate({
      objectPosition: `${100 + nextPercentage}% center`
    }, { duration: 1200, fill: "forwards" });
  }
}

/* -- Had to add extra lines for touch events -- */

window.onmousedown = e => handleOnDown(e);

window.ontouchstart = e => handleOnDown(e.touches[0]);

window.onmouseup = e => handleOnUp(e);

window.ontouchend = e => handleOnUp(e.touches[0]);

window.onmousemove = e => handleOnMove(e);

window.ontouchmove = e => handleOnMove(e.touches[0]);