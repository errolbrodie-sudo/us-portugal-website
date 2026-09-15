(function(){function N(){if(document.getElementById("toc-injected-styles"))return;const i=document.createElement("style");i.id="toc-injected-styles",i.textContent=`
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
    `,document.head.appendChild(i)}function C(){if(document.body.classList.contains("no-toc")||document.querySelector(".toc-sidebar-col"))return;N();const i=document.querySelector(".container, .guide-container, .legal-container, main");if(!i)return;const n=Array.from(i.querySelectorAll("h2, h3")).filter(t=>!t.closest("header, footer, dialog, .filter-panel, .calc-container"));if(n.length===0)return;const p={};n.forEach((t,e)=>{if(!t.id){let o=t.textContent.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"");o||(o=`section-${e+1}`),p[o]?(p[o]++,t.id=`${o}-${p[o]}`):(p[o]=1,t.id=o)}});const c=document.createElement("aside");c.className="toc-sidebar-col",c.setAttribute("aria-label","Table of Contents Navigation");const m=document.createElement("div");m.className="toc-sidebar-card";const u=document.createElement("div");u.className="toc-sidebar-title",u.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>On This Page';const s=document.createElement("ul");s.className="toc-nav-list";const d=document.createElement("div");d.className="toc-mobile-container";const l=document.createElement("details");l.className="toc-mobile-dropdown";const f=document.createElement("summary");f.className="toc-mobile-summary",f.innerHTML=`
      <span class="toc-mobile-title-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
        <strong>On This Page:</strong> <span id="toc-mobile-active-label" class="toc-mobile-active-text">${n[0].textContent}</span>
      </span>
      <span class="toc-mobile-chevron">▼</span>
    `;const b=document.createElement("ul");b.className="toc-mobile-list",n.forEach(t=>{const e=t.tagName.toLowerCase()==="h3",o=document.createElement("li");o.className=`toc-item ${e?"toc-item-h3":"toc-item-h2"}`;const a=document.createElement("a");a.className="toc-link",a.href=`#${t.id}`,a.textContent=t.textContent,a.dataset.targetId=t.id,a.addEventListener("click",v=>{v.preventDefault(),k(t)}),o.appendChild(a),s.appendChild(o);const w=document.createElement("li");w.className=`toc-mobile-item ${e?"toc-mobile-item-h3":"toc-mobile-item-h2"}`;const r=document.createElement("a");r.className="toc-mobile-link",r.href=`#${t.id}`,r.textContent=t.textContent,r.dataset.targetId=t.id,r.addEventListener("click",v=>{v.preventDefault(),l.removeAttribute("open"),k(t)}),w.appendChild(r),b.appendChild(w)}),m.appendChild(u),m.appendChild(s),c.appendChild(m),l.appendChild(f),l.appendChild(b),d.appendChild(l);const g=i.querySelector("header"),y=document.querySelector("footer, .app-footer"),x=document.createElement("div");x.className="toc-layout-wrapper";const h=document.createElement("div");h.className="toc-main-col",Array.from(i.childNodes).filter(t=>{var e;return t!==g&&t!==d&&t!==y&&t.tagName!=="FOOTER"&&!((e=t.classList)!=null&&e.contains("app-footer"))}).forEach(t=>h.appendChild(t)),g&&i.appendChild(g),i.appendChild(d),x.appendChild(c),x.appendChild(h),i.appendChild(x),y&&i.appendChild(y);function k(t){const a=t.getBoundingClientRect().top+window.pageYOffset-110;window.scrollTo({top:a,behavior:"smooth"}),history.replaceState(null,null,`#${t.id}`)}const S=Array.from(s.querySelectorAll(".toc-link")),A=Array.from(b.querySelectorAll(".toc-mobile-link")),E=document.getElementById("toc-mobile-active-label");function L(t){S.forEach(e=>{e.dataset.targetId===t?(e.classList.add("active"),e.setAttribute("aria-current","true")):(e.classList.remove("active"),e.removeAttribute("aria-current"))}),A.forEach(e=>{e.dataset.targetId===t?(e.classList.add("active"),E&&(E.textContent=e.textContent)):e.classList.remove("active")})}function T(){const t=window.scrollY+120;for(let e=n.length-1;e>=0;e--){const o=n[e].getBoundingClientRect().top+window.scrollY;if(t>=o){L(n[e].id);break}}}window.addEventListener("scroll",T,{passive:!0}),L(n[0].id)}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",C):C()})();
