/**
 * ReloPlan - Sticky Top Navigation Controller
 * Displays sticky top navigation bar with background #C0DDD5.
 * Features filtered guide links and '← Return to Budget Dashboard'.
 */

// Initialize Vercel Web Analytics
import { inject } from '@vercel/analytics';
inject();

(function () {
  'use strict';

  const TOP_PAGES = [
    { title: '← Return to Budget Dashboard', href: '/index.html', icon: '🏠', isReturn: true },
    { title: 'Residency Visas & NIF', href: '/visa-report.html', icon: '🛂' },
    { title: 'Shipping & Freight', href: '/shipping-report.html', icon: '📦' },
    { title: 'Rental Housing', href: '/rent-report.html', icon: '🔑' },
    { title: 'Health Insurance', href: '/insurance-report.html', icon: '🏥' },
    { title: 'Education & Schools', href: '/education-report.html', icon: '🎓' },
    { title: 'Pets', href: '/pet-report.html', icon: '🐾' }
  ];

  function injectTopNavStyles() {
    if (document.getElementById('top-nav-injected-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'top-nav-injected-styles';
    styleEl.textContent = `
      .top-site-nav-wrapper {
        z-index: 10000 !important;
        width: 100% !important;
        background: #C0DDD5 !important;
        border-bottom: 1px solid rgba(13, 92, 70, 0.25) !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08) !important;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
      }

      /* Sticky on secondary pages; in-flow below header on the home landing page */
      body:not(.is-home-page) .top-site-nav-wrapper {
        position: sticky !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
      }

      body.is-home-page .top-site-nav-wrapper {
        position: relative !important;
        margin: 0 auto !important;
      }

      .top-site-nav-container {
        max-width: 1280px !important;
        margin: 0 auto !important;
        padding: 8px 12px !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        justify-content: center !important;
        align-items: center !important;
        gap: 8px 12px !important;
      }

      .top-site-nav-container::-webkit-scrollbar {
        display: none !important;
      }

      .top-site-nav-link {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        font-size: 0.85rem !important;
        font-weight: 600 !important;
        color: #072b22 !important;
        background: rgba(255, 255, 255, 0.65) !important;
        border: 1px solid rgba(13, 92, 70, 0.25) !important;
        padding: 5px 12px !important;
        border-radius: 20px !important;
        text-decoration: none !important;
        transition: all 0.2s ease !important;
        white-space: nowrap !important;
        flex-shrink: 0 !important;
      }

      .top-site-nav-link.return-link {
        background: #0d5c46 !important;
        color: #ffffff !important;
        font-weight: 700 !important;
        border-color: #0d5c46 !important;
      }

      .top-site-nav-link.return-link:hover {
        background: #094232 !important;
        border-color: #094232 !important;
      }

      .top-site-nav-link:hover {
        background: #0d5c46 !important;
        color: #ffffff !important;
        border-color: #0d5c46 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 8px rgba(13, 92, 70, 0.2) !important;
      }

      @media (max-width: 768px) {
        .top-site-nav-container {
          padding: 6px 8px !important;
          gap: 6px !important;
          justify-content: flex-start !important;
        }

        .top-site-nav-link {
          font-size: 0.76rem !important;
          padding: 4px 8px !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Determine current page filename
  let currentFile = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/').pop() || 'index.html';
  if (!currentFile.endsWith('.html') && currentFile !== '') {
    currentFile += '.html';
  }
  const isHomePage = currentFile === 'index.html' || currentFile === '';

  function handleReturnToDashboard(e) {
    if (e) e.preventDefault();
    window.location.href = '/index.html';
  }

  window.handleReturnToDashboard = handleReturnToDashboard;

  function initTopNav() {
    if (document.querySelector('.top-site-nav-container')) return;

    injectTopNavStyles();

    if (isHomePage) {
      document.body.classList.add('is-home-page');
    }

    // Create navigation element
    let navWrapper = document.querySelector('.top-site-nav-wrapper');
    if (!navWrapper) {
      navWrapper = document.createElement('nav');
      navWrapper.className = 'top-site-nav-wrapper';
      navWrapper.setAttribute('aria-label', 'Top Navigation');
    }

    const navContainer = document.createElement('div');
    navContainer.className = 'top-site-nav-container';

    // Filter pages
    const displayPages = TOP_PAGES.filter(page => {
      if (isHomePage) return !page.isReturn;
      return page.href.replace('/', '') !== currentFile;
    });

    displayPages.forEach(page => {
      const a = document.createElement('a');
      a.className = `top-site-nav-link ${page.isReturn ? 'return-link' : ''}`;
      a.href = page.href;

      if (page.isReturn) {
        a.addEventListener('click', handleReturnToDashboard);
      }

      a.innerHTML = `<span>${page.icon}</span> <span>${page.title}</span>`;
      navContainer.appendChild(a);
    });

    navWrapper.innerHTML = '';
    navWrapper.appendChild(navContainer);

    // Landing page: Place directly below <header class="app-header"> (Logo section)
    if (isHomePage) {
      const appHeader = document.querySelector('.app-header');
      if (appHeader && appHeader.parentNode) {
        appHeader.parentNode.insertBefore(navWrapper, appHeader.nextSibling);
      } else if (document.body.firstChild) {
        document.body.insertBefore(navWrapper, document.body.firstChild);
      } else {
        document.body.appendChild(navWrapper);
      }
    } else {
      // Secondary pages: Stick directly at top of body
      if (document.body.firstChild) {
        document.body.insertBefore(navWrapper, document.body.firstChild);
      } else {
        document.body.appendChild(navWrapper);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTopNav);
  } else {
    initTopNav();
  }
})();