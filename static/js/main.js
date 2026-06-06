// main.js — students will add JavaScript here as features are built

document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("how-it-works-modal");
    if (!modal) return;

    const video = document.getElementById("how-it-works-video");
    const openTriggers = document.querySelectorAll('[data-modal-open="how-it-works"]');
    const closeTriggers = modal.querySelectorAll("[data-modal-close]");

    function openModal() {
        if (video) {
            const src = video.getAttribute("data-src") || "";
            video.setAttribute("src", src + (src.includes("?") ? "&" : "?") + "autoplay=1");
        }
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    function closeModal() {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        if (video) video.setAttribute("src", "");
    }

    openTriggers.forEach(function (el) {
        el.addEventListener("click", function (e) {
            e.preventDefault();
            openModal();
        });
    });

    closeTriggers.forEach(function (el) {
        el.addEventListener("click", function (e) {
            e.preventDefault();
            closeModal();
        });
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal.classList.contains("is-open")) {
            closeModal();
        }
    });
});
