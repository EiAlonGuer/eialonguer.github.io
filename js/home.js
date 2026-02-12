const gallery = document.getElementById("gallery");

window.onmousedown = e => {
    if(gallery.dataset.mousedownAt === "0") return;

    const mouseDelta = parseFloat(TrackEvent.dataset.mousedownAt) - e.clientX;
    const maxDelta = window.innerWidth / 2;

    const percentage = (mouseDelta / maxDelta) * -100;
    const nextPercentage = parseFloat(gallery.dataset.prevPercentage) + percentage;
    
    gallery.dataset.percentage = nextPercentage;

    gallery.animate(
        {transform: `translate(${nextPercentage}, -50%)`}, 
        {duration:1200, fill: "forwards"}
    );

    for(const image of gallery.getElementsByClassName("image")){
        image.animate(
            {objectPosition: `${nextPercentage + 100} 50%`},
            {duration:1200, fill: "forwards"}
        );
    }
}

window.onmouseup = () => {
    gallery.dataset.mousedownAt = "0";
    gallery.dataset.prevPercentage = gallery.dataset.percentage;
}