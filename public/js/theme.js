// js/theme.js - Shared theme management

(function() {
  'use strict';

  // Initialize theme on page load
  function initTheme() {
    const themeToggle = document.querySelector('.theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Check for saved theme or prefer color scheme
    const savedTheme = localStorage.getItem('theme');
    const currentTheme = savedTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
    
    // Apply the current theme
    if (currentTheme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
    
    // Update toggle state if exists
    if (themeToggle) {
      updateToggleState(themeToggle, currentTheme === 'light');
    }
  }

  // Update toggle visual state
  function updateToggleState(toggle, isLight) {
    const thumb = toggle.querySelector('.theme-toggle-thumb');
    if (thumb) {
      if (isLight) {
        thumb.style.transform = 'translateX(24px)';
      } else {
        thumb.style.transform = 'translateX(0)';
      }
    }
  }

  // Setup theme toggle handler
  function setupThemeToggle() {
    const themeToggle = document.querySelector('.theme-toggle');
    if (!themeToggle) return;

    themeToggle.addEventListener('click', function() {
      const isLightTheme = document.body.classList.contains('light-theme');
      
      if (isLightTheme) {
        // Switch to dark theme
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        localStorage.setItem('theme', 'dark');
        updateToggleState(themeToggle, false);
      } else {
        // Switch to light theme
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        updateToggleState(themeToggle, true);
      }
      
      // Add click animation
      themeToggle.style.transform = 'scale(0.95)';
      setTimeout(() => {
        themeToggle.style.transform = '';
      }, 150);
    });

    // Listen for system theme changes (only if no saved preference)
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    prefersDarkScheme.addEventListener('change', function(e) {
      if (!localStorage.getItem('theme')) {
        if (e.matches) {
          document.body.classList.remove('light-theme');
          document.body.classList.add('dark-theme');
          updateToggleState(themeToggle, false);
        } else {
          document.body.classList.remove('dark-theme');
          document.body.classList.add('light-theme');
          updateToggleState(themeToggle, true);
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initTheme();
      setupThemeToggle();
    });
  } else {
    initTheme();
    setupThemeToggle();
  }
})();

