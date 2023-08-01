function loadExternalFile(url, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                callback(xhr.responseText);
            } else {
                console.error('Error loading file:', xhr.status, xhr.statusText);
            }
        }
    };
    xhr.send();
}

function injectHTML(elementId, htmlContent) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = htmlContent;
    } else {
        console.error('Element with ID', elementId, 'not found.');
    }
}

function injectCSS(cssContent) {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = cssContent;
    document.head.appendChild(styleTag);
}

const particlesHTMLURL = 'particles.html';
const styleCSSURL = 'style.css';

loadExternalFile(particlesHTMLURL, function (htmlContent) {
    injectHTML('tc-particles', htmlContent);
});

loadExternalFile(styleCSSURL, function (cssContent) {
    injectCSS(cssContent);
});

// Overrides display="none" css for .tc-particles

function injectCSS(cssContent) {
    const overrideStyleTag = document.createElement('style');
    const particlesSelector = '.tc-particles';
    const overrideRule = `${particlesSelector} { display: block !important; }`;

    // Combine the original CSS content with the override rule
    const combinedCSS = cssContent + overrideRule;

    overrideStyleTag.innerHTML = combinedCSS;
    document.head.appendChild(overrideStyleTag);
}
