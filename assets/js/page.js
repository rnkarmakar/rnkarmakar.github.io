// Common JavaScript functionality for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Add PDF download functionality for links with download attribute
    document.querySelectorAll('a[download]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            if (this.href.includes('?download=pdf')) {
                e.preventDefault();
                // Here you can add custom PDF download logic
                window.location.href = this.href;
            }
        });
    });

    // Add any other common page functionality here
});
