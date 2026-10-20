/* ==========================================
   ReloPlan - Account controls
   Adds "Account" (or "Admin") and "Log out" links to the existing navigation.
   Purely a convenience: access control is enforced on the server.
   ========================================== */

async function logout(event) {
  event.preventDefault();
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    location.replace('/login.html');
  }
}

function makeLink(label, href, className, onClick) {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = label;
  a.className = className;
  if (onClick) a.addEventListener('click', onClick);
  return a;
}

function links(role, className) {
  const account = role === 'admin'
    ? makeLink('Admin', '/admin.html', className)
    : makeLink('Account', '/account.html', className);
  return [account, makeLink('Log out', '/login.html', className, logout)];
}

function whenAvailable(selector, timeoutMs = 3000) {
  return new Promise(resolve => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { observer.disconnect(); resolve(el); }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(null); }, timeoutMs);
  });
}

async function init() {
  let me;
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) return;
    me = await response.json();
  } catch {
    return;
  }

  // Home page: desktop header and mobile menu.
  const mainNav = document.querySelector('.app-header .main-nav');
  if (mainNav) {
    links(me.role, 'nav-link').forEach(a => {
      a.style.cssText = 'font-weight: 600; color: var(--color-primary); text-decoration: none; margin-left: 16px;';
      mainNav.appendChild(a);
    });
    const mobileNav = document.querySelector('.mobile-nav');
    if (mobileNav) {
      links(me.role, '').forEach(a => {
        a.style.cssText = 'font-weight: 600; color: var(--color-primary); text-decoration: none; margin-top: 12px; display: block;';
        mobileNav.appendChild(a);
      });
    }
    return;
  }

  // Other pages: the sticky pill bar rendered by top-nav.js.
  const bar = await whenAvailable('.top-site-nav-container');
  if (bar) links(me.role, 'top-site-nav-link').forEach(a => bar.appendChild(a));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
