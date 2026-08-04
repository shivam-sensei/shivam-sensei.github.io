const bootText = document.getElementById("boot-text");
const bootScreen = document.getElementById("boot-screen");
const desktop = document.getElementById("desktop");

const bootLines = [
    "PortfolioOS boot sequence initialized",
    "Checking firmware integrity",
    "Loading embedded runtime",
    "Preparing workspace",
    "Launching interface",
    "System ready"
];

let index = 0;

function typeBootLine(line, onComplete) {
    bootText.textContent += (bootText.textContent ? "\n" : "");

    let charIndex = 0;
    const typing = setInterval(() => {
        bootText.textContent += line[charIndex];
        charIndex += 1;

        if (charIndex >= line.length) {
            clearInterval(typing);
            setTimeout(onComplete, 90);
        }
    }, 24);
}

function bootNextLine() {
    if (index >= bootLines.length) {
        setTimeout(() => {
            bootScreen.classList.add("hidden");
            desktop.classList.remove("hidden");
            window.dispatchEvent(new Event("boot-complete"));
        }, 220);
        return;
    }

    typeBootLine(bootLines[index], () => {
        index += 1;
        setTimeout(bootNextLine, 50);
    });
}

setTimeout(bootNextLine, 220);