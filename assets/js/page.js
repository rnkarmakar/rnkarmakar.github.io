// Common JavaScript functionality for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Add PDF download functionality for links with download attribute
    document.querySelectorAll('a[download]').forEach(function(link) {
        link.addEventListener('click', function(e) {
            if (this.href.includes('?download=pdf')) {
                e.preventDefault();
                const element = document.querySelector('.note-box iframe').contentDocument.body;
                
                // Set up PDF options
                const opt = {
                    margin: 0.5,
                    filename: 'quantum-entanglement-notes.pdf',
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };

                // Convert and trigger download
                html2pdf().set(opt).from(element).save().then(() => {
                    console.log('PDF downloaded successfully');
                }).catch(err => {
                    console.error('PDF generation failed:', err);
                });
            }
        });
    });
});
