/**
 * ReloPlan - Dynamic Sticky Table of Contents (TOC) Controller
 * Automatically injects required styles, extracts h2 & h3 headings,
 * creates a sticky left-hand nav on desktop, a collapsible dropdown on mobile,
 * and highlights active sections on scroll.
 */

(function () {
  'use strict';

  // Inject required TOC styles into document head
  function injectStyles() {
    if (document.getElementById('toc-injected-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'toc-injected-styles';
    styleEl.textContent = `
      /* Desktop 2-Column TOC Layout */
      .toc-layout-wrapper {
        display: flex !important;
        flex-direction: row !important;
        gap: 32px !important;
        align-items: flex-start !important;
        width: 100% !important;
        max-width: 1280px !important;
        margin: 0 auto !important;
      }

      .toc-sidebar-col {
        width: 260px !important;
        min-width: 260px !important;
        flex-shrink: 0 !important;
        position: sticky !important;
        top: 60px !important;
        max-height: calc(100vh - 75px) !important;
        overflow-y: auto !important;
        z-index: 20 !important;
        margin-top: 10px !important;
      }

      .toc-sidebar-card {
        padding: 20px !important;
        border-radius: 14px !important;
        background: rgba(255, 255, 255, 0.75) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(0, 0, 0, 0.12) !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05) !important;
      }

      .toc-sidebar-title {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
        font-size: 0.9rem !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 1px !important;
        color: #0d5c46 !important;
        margin-bottom: 12px !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
        display: flex !important;
        align-items: center !important;
      }

      .toc-nav-list {
        list-style: none !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .toc-item {
        margin-bottom: 3px !important;
      }

      .toc-item-h3 {
        padding-left: 14px !important;
      }

      .toc-link {
        display: block !important;
        font-size: 0.88rem !important;
        line-height: 1.4 !important;
        color: #4a5568 !important;
        text-decoration: none !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        border-left: 3px solid transparent !important;
        transition: all 0.2s ease !important;
        word-break: break-word !important;
      }

      .toc-link:hover {
        color: #0d5c46 !important;
        background: rgba(13, 92, 70, 0.05) !important;
      }

      .toc-link.active {
        color: #0d5c46 !important;
        font-weight: 700 !important;
        border-left-color: #0d5c46 !important;
        background: rgba(13, 92, 70, 0.09) !important;
      }

      .toc-main-col {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        width: 100% !important;
      }

      /* Mobile Dropdown Styling */
      .toc-mobile-container {
        display: none !important;
        margin-bottom: 20px !important;
      }

      .toc-mobile-dropdown {
        background: rgba(255, 255, 255, 0.92) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border: 1px solid rgba(0, 0, 0, 0.12) !important;
        border-radius: 12px !important;
        padding: 12px 16px !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.06) !important;
      }

      .toc-mobile-summary {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
        font-size: 0.92rem !important;
        font-weight: 600 !important;
        color: #0d5c46 !important;
        cursor: pointer !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        user-select: none !important;
        outline: none !important;
      }

      .toc-mobile-title-wrap {
        display: flex !important;
        align-items: center !important;
      }

      .toc-mobile-active-text {
        font-weight: 500 !important;
        color: #4a5568 !important;
        margin-left: 6px !important;
        max-width: 210px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        display: inline-block !important;
        vertical-align: bottom !important;
      }

      .toc-mobile-chevron {
        font-size: 0.75rem !important;
        transition: transform 0.2s ease !important;
      }

      .toc-mobile-dropdown[open] .toc-mobile-chevron {
        transform: rotate(180deg) !important;
      }

      .toc-mobile-list {
        list-style: none !important;
        padding: 12px 0 4px !important;
        margin: 10px 0 0 !important;
        border-top: 1px solid rgba(0, 0, 0, 0.1) !important;
      }

      .toc-mobile-item-h3 {
        padding-left: 16px !important;
      }

      .toc-mobile-link {
        display: block !important;
        font-size: 0.9rem !important;
        padding: 8px 10px !important;
        color: #4a5568 !important;
        text-decoration: none !important;
        border-radius: 6px !important;
      }

      .toc-mobile-link.active {
        color: #0d5c46 !important;
        font-weight: 700 !important;
        background: rgba(13, 92, 70, 0.08) !important;
      }

      /* Responsive Media Query */
      @media (max-width: 1024px) {
        .toc-layout-wrapper {
          flex-direction: column !important;
        }
        .toc-sidebar-col {
          display: none !important;
        }
        .toc-mobile-container {
          display: block !important;
          position: sticky !important;
          top: 50px !important;
          z-index: 100 !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  function initTOC() {
    // Do not run on primary page (index.html) or if TOC already exists
    if (document.body.classList.contains('no-toc') || document.querySelector('.toc-sidebar-col')) {
      return;
    }

    injectStyles();

    // Find main container
    const mainContainer = document.querySelector('.container, .guide-container, .legal-container, main');
    if (!mainContainer) return;

    // Extract headings
    const headings = Array.from(mainContainer.querySelectorAll('h2, h3')).filter(heading => {
      return !heading.closest('header, footer, dialog, .filter-panel, .calc-container');
    });

    if (headings.length === 0) return;

    // Ensure headings have unique IDs
    const slugCounts = {};
    headings.forEach((heading, idx) => {
      if (!heading.id) {
        let slug = heading.textContent
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        
        if (!slug) slug = `section-${idx + 1}`;
        if (slugCounts[slug]) {
          slugCounts[slug]++;
          heading.id = `${slug}-${slugCounts[slug]}`;
        } else {
          slugCounts[slug] = 1;
          heading.id = slug;
        }
      }
    });

    // Build Desktop Sidebar HTML
    const sidebarCol = document.createElement('aside');
    sidebarCol.className = 'toc-sidebar-col';
    sidebarCol.setAttribute('aria-label', 'Table of Contents Navigation');

    const sidebarCard = document.createElement('div');
    sidebarCard.className = 'toc-sidebar-card';

    const sidebarTitle = document.createElement('div');
    sidebarTitle.className = 'toc-sidebar-title';
    sidebarTitle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>On This Page`;

    const navList = document.createElement('ul');
    navList.className = 'toc-nav-list';

    // Build Mobile Dropdown HTML
    const mobileContainer = document.createElement('div');
    mobileContainer.className = 'toc-mobile-container';

    const mobileDetails = document.createElement('details');
    mobileDetails.className = 'toc-mobile-dropdown';

    const mobileSummary = document.createElement('summary');
    mobileSummary.className = 'toc-mobile-summary';
    mobileSummary.innerHTML = `
      <span class="toc-mobile-title-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        <strong>On This Page:</strong> <span id="toc-mobile-active-label" class="toc-mobile-active-text">${headings[0].textContent}</span>
      </span>
      <span class="toc-mobile-chevron">▼</span>
    `;

    const mobileNavList = document.createElement('ul');
    mobileNavList.className = 'toc-mobile-list';

    // Populate TOC Links
    headings.forEach(heading => {
      const isH3 = heading.tagName.toLowerCase() === 'h3';
      
      // Desktop item
      const li = document.createElement('li');
      li.className = `toc-item ${isH3 ? 'toc-item-h3' : 'toc-item-h2'}`;
      
      const a = document.createElement('a');
      a.className = 'toc-link';
      a.href = `#${heading.id}`;
      a.textContent = heading.textContent;
      a.dataset.targetId = heading.id;
      
      a.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToHeading(heading);
      });

      li.appendChild(a);
      navList.appendChild(li);

      // Mobile item
      const mobileLi = document.createElement('li');
      mobileLi.className = `toc-mobile-item ${isH3 ? 'toc-mobile-item-h3' : 'toc-mobile-item-h2'}`;
      
      const mobileA = document.createElement('a');
      mobileA.className = 'toc-mobile-link';
      mobileA.href = `#${heading.id}`;
      mobileA.textContent = heading.textContent;
      mobileA.dataset.targetId = heading.id;

      mobileA.addEventListener('click', (e) => {
        e.preventDefault();
        mobileDetails.removeAttribute('open');
        scrollToHeading(heading);
      });

      mobileLi.appendChild(mobileA);
      mobileNavList.appendChild(mobileLi);
    });

    sidebarCard.appendChild(sidebarTitle);
    sidebarCard.appendChild(navList);
    sidebarCol.appendChild(sidebarCard);

    mobileDetails.appendChild(mobileSummary);
    mobileDetails.appendChild(mobileNavList);
    mobileContainer.appendChild(mobileDetails);

    // Rearrange DOM into 2-column layout wrapper
    const pageHeader = mainContainer.querySelector('header');
    const pageFooter = document.querySelector('footer, .app-footer');

    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = 'toc-layout-wrapper';

    const mainCol = document.createElement('div');
    mainCol.className = 'toc-main-col';

    // Collect content nodes except header, footer, mobileContainer
    const childrenToMove = Array.from(mainContainer.childNodes).filter(node => {
      return node !== pageHeader && node !== mobileContainer && node !== pageFooter && node.tagName !== 'FOOTER' && !node.classList?.contains('app-footer');
    });

    childrenToMove.forEach(node => mainCol.appendChild(node));

    // Re-assemble mainContainer
    if (pageHeader) mainContainer.appendChild(pageHeader);
    mainContainer.appendChild(mobileContainer);
    layoutWrapper.appendChild(sidebarCol);
    layoutWrapper.appendChild(mainCol);
    mainContainer.appendChild(layoutWrapper);
    if (pageFooter) mainContainer.appendChild(pageFooter);

    // Smooth Scroll Helper
    function scrollToHeading(targetElement) {
      const offset = 110;
      const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      history.replaceState(null, null, `#${targetElement.id}`);
    }

    // Scroll-Spy Highlighting
    const desktopLinks = Array.from(navList.querySelectorAll('.toc-link'));
    const mobileLinks = Array.from(mobileNavList.querySelectorAll('.toc-mobile-link'));
    const mobileLabel = document.getElementById('toc-mobile-active-label');

    function setActiveHeading(activeId) {
      desktopLinks.forEach(link => {
        if (link.dataset.targetId === activeId) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'true');
        } else {
          link.classList.remove('active');
          link.removeAttribute('aria-current');
        }
      });

      mobileLinks.forEach(link => {
        if (link.dataset.targetId === activeId) {
          link.classList.add('active');
          if (mobileLabel) mobileLabel.textContent = link.textContent;
        } else {
          link.classList.remove('active');
        }
      });
    }

    // Scroll-spy listener
    function checkActiveScroll() {
      const scrollPos = window.scrollY + 120;
      for (let i = headings.length - 1; i >= 0; i--) {
        const top = headings[i].getBoundingClientRect().top + window.scrollY;
        if (scrollPos >= top) {
          setActiveHeading(headings[i].id);
          break;
        }
      }
    }

    window.addEventListener('scroll', checkActiveScroll, { passive: true });
    setActiveHeading(headings[0].id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTOC);
  } else {
    initTOC();
  }

})();
