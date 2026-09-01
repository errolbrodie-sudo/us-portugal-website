import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        affiliate: resolve(__dirname, 'affiliate-disclosure.html'),
        contact: resolve(__dirname, 'contact.html'),
        disclaimer: resolve(__dirname, 'disclaimer.html'),
        education: resolve(__dirname, 'education-report.html'),
        insurance: resolve(__dirname, 'insurance-report.html'),
        pet: resolve(__dirname, 'pet-report.html'),
        embassy: resolve(__dirname, 'portuguese-embassy-consulates-usa.html'),
        platforms: resolve(__dirname, 'relocation-platforms-competitive-dossier.html'),
        rent: resolve(__dirname, 'rent-report.html'),
        shipping: resolve(__dirname, 'shipping-report.html'),
        terms: resolve(__dirname, 'terms.html'),
        visa: resolve(__dirname, 'visa-report.html')
      }
    }
  }
});