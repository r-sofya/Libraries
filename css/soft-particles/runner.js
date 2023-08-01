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
    injectHTML('particles', htmlContent);
});

loadExternalFile(styleCSSURL, function (cssContent) {
    injectCSS(cssContent);
});
