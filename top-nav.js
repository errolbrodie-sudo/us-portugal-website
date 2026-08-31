/**
 * ReloPlan - Sticky Top Navigation Controller
 * Displays sticky top navigation bar with background #C0DDD5.
 * Features filtered guide links and '← Return to Budget Dashboard'.
 */

(function () {
  'use strict';

  const TOP_PAGES = [
    { title: '← Return to Budget Dashboard', href: 'index.html', icon: '🏠', isReturn: true },
    { title: 'Residency Visas & NIF', href: 'visa-report.html', icon: '🛂' },
    { title: 'Shipping & Freight', href: 'shipping-report.html', icon: '📦' },
    { title: 'Rental Housing', href: 'rent-report.html', icon: '🔑' },
    { title: 'Health Insurance', href: 'insurance-report.html', icon: '🏥' },
    { title: 'Education & Schools', href: 'education-report.html', icon: '🎓' },
    { title: 'Pets', href: 'pet-report.html', icon: '🐾' }
  ];

  function injectTopNavStyles() {
    if (document.getElementById('top-nav-injected-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'top-nav-injected-styles';
    styleEl.textContent = `
      .top-site-nav-wrapper {
        position: sticky !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 10000 !important;
        width: 100% !important;
        background: #C0DDD5 !important;
        border-bottom: 1px solid rgba(13, 92, 70, 0.25) !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08) !important;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
      }

      .top-site-nav-container {
        max-width: 1280px !important;
        margin: 0 auto !important;
        padding: 6px 12px !important;
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 6px 8px !important;
      }

      .top-site-nav-container::-webkit-scrollbar {
        display: none !important;
      }

      .top-site-nav-link {
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        font-size: 0.8rem !important;
        font-weight: 600 !important;
        color: #072b22 !important;
        background: rgba(255, 255, 255, 0.65) !important;
        border: 1px solid rgba(13, 92, 70, 0.25) !important;
        padding: 4px 10px !important;
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

  // BroadcastChannel for cross-tab primary page navigation & focusing
  let navChannel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      navChannel = new BroadcastChannel('reloplan_nav_channel');
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // Determine current page filename
  const currentPath = window.location.pathname;
  let currentFile = currentPath.substring(currentPath.lastIndexOf('/') + 1);
  if (!currentFile || currentFile === '') currentFile = 'index.html';

  // Listen on primary page (index.html) for focus requests from secondary tabs
  if (currentFile === 'index.html' && navChannel) {
    navChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'FOCUS_PRIMARY_PAGE') {
        window.focus();
        navChannel.postMessage({ type: 'PRIMARY_PAGE_FOCUSED' });
      }
    };
  }

  function handleReturnToDashboard(e) {
    if (e) e.preventDefault();

    // 1. Check if original primary window (opener) is open
    try {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.focus();
        } catch (err) {
          console.warn('Unable to focus opener window:', err);
        }
        window.close();
        return false;
      }
    } catch (err) {
      console.warn('Opener window check error:', err);
    }

    // 2. BroadcastChannel check for open primary page tab in any window
    if (navChannel) {
      let primaryFound = false;

      const handleChannelMsg = (event) => {
        if (event.data && event.data.type === 'PRIMARY_PAGE_FOCUSED') {
          primaryFound = true;
          window.close();
        }
      };

      navChannel.addEventListener('message', handleChannelMsg);
      navChannel.postMessage({ type: 'FOCUS_PRIMARY_PAGE' });

      setTimeout(() => {
        navChannel.removeEventListener('message', handleChannelMsg);
        if (!primaryFound) {
          window.open('index.html', '_blank', 'opener');
        }
      }, 250);
      return false;
    }

    // 3. Fallback: Open primary page in a new window if not open
    window.open('index.html', '_blank', 'opener');
    return false;
  }

  window.handleReturnToDashboard = handleReturnToDashboard;

  function initTopNav() {
    if (document.querySelector('.top-site-nav-wrapper')) return;

    injectTopNavStyles();

    // Filter pages for top bar
    const displayPages = TOP_PAGES.filter(page => {
      if (currentFile === 'index.html') {
        return !page.isReturn;
      }
      return page.href !== currentFile;
    });

    // Build Top Navigation Bar HTML
    const navWrapper = document.createElement('nav');
    navWrapper.className = 'top-site-nav-wrapper';
    navWrapper.setAttribute('aria-label', 'Sticky Top Navigation');

    const navContainer = document.createElement('div');
    navContainer.className = 'top-site-nav-container';

    displayPages.forEach(page => {
      const a = document.createElement('a');
      a.className = `top-site-nav-link ${page.isReturn ? 'return-link' : ''}`;
      a.href = page.href;
      
      if (page.isReturn) {
        a.addEventListener('click', handleReturnToDashboard);
      } else {
        a.target = '_blank';
        a.rel = 'opener';
      }
      
      a.innerHTML = `<span>${page.icon}</span> <span>${page.title}</span>`;
      navContainer.appendChild(a);
    });

    navWrapper.appendChild(navContainer);

    // Bind return handler to all return links in the body/footer of secondary pages
    if (currentFile !== 'index.html') {
      document.querySelectorAll('.back-btn, .back-link, a[href="index.html"]').forEach(link => {
        if (!link.classList.contains('top-site-nav-link')) {
          link.addEventListener('click', handleReturnToDashboard);
        }
      });
    }

    // Position top links section:
    // On primary page (index.html), move below Logo section above "US to Portugal Move" text (.section-tag-hero)
    if (currentFile === 'index.html') {
      const heroTag = document.querySelector('.section-tag-hero');
      const appHeader = document.querySelector('.app-header');

      if (heroTag && heroTag.parentNode) {
        navWrapper.style.borderRadius = '14px';
        navWrapper.style.marginBottom = '28px';
        heroTag.parentNode.insertBefore(navWrapper, heroTag);
      } else if (appHeader && appHeader.parentNode) {
        appHeader.parentNode.insertBefore(navWrapper, appHeader.nextSibling);
      } else if (document.body.firstChild) {
        document.body.insertBefore(navWrapper, document.body.firstChild);
      } else {
        document.body.appendChild(navWrapper);
      }
    } else {
      // On secondary pages, keep at the very top of document body
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
