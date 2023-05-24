const bttBtn = document.getElementById("back-to-top-btn");

window.addEventListener("scroll", () => {
    const THRESHOLD = 400
    if (
        document.body.scrollTop > THRESHOLD ||
        document.documentElement.scrollTop > THRESHOLD
    ) {
        bttBtn.style.display = "block";
    } else {
        bttBtn.style.display = "none";
    }
})

function backToTop() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}

bttBtn.addEventListener("click", backToTop);
