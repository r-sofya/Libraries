// Get all elements with the attribute tc-section-scroll="link"
const linkElements = document.querySelectorAll('[tc-section-scroll="link"]');

// Process each link element
linkElements.forEach((linkElement) => {
    const originalText = linkElement.textContent;
    const formattedText = originalText
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase(); // Convert to lowercase

    // Create the formatted link
    const formattedLink = `#${formattedText}`;

    // Add the formatted link to the page URL
    linkElement.href = window.location.href + formattedLink;
});

// Get all elements with the attribute tc-section-scroll="section-name"
const sectionNameElements = document.querySelectorAll('[tc-section-scroll="section-name"]');

// Process each section name element
sectionNameElements.forEach((sectionNameElement) => {
    const originalText = sectionNameElement.textContent;
    const formattedText = originalText
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .toLowerCase(); // Convert to lowercase

    // Get the parent section element
    const sectionElement = sectionNameElement.closest('[tc-section-scroll="section"]');

    // Change the tag to "section" and set the formatted text as the element ID
    sectionElement.tagName = 'section';
    sectionElement.id = formattedText;
});