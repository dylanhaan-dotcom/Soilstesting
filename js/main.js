/* =====================================================
   Materials Testing Lab — Main JS
   ===================================================== */

// Mobile navigation toggle
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close on nav link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Active nav link highlight on scroll
const sections = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav__links a[href^="#"]');

function updateActiveNav() {
  const scrollY = window.scrollY + 80;
  sections.forEach(section => {
    const top    = section.offsetTop;
    const height = section.offsetHeight;
    const id     = section.getAttribute('id');
    const link   = document.querySelector(`.nav__links a[href="#${id}"]`);
    if (!link) return;
    if (scrollY >= top && scrollY < top + height) {
      navAnchors.forEach(a => a.style.removeProperty('background'));
      link.style.background = 'var(--clr-bg-alt)';
      link.style.color = 'var(--clr-primary)';
    }
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
