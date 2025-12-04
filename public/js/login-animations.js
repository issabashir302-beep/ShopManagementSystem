// Initialize animations
document.addEventListener('DOMContentLoaded', function() {
  // Password toggle functionality
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('login_password');
  const eyeIcon = togglePassword.querySelector('i');

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      // Toggle eye icon
      if (type === 'text') {
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });
  }

  // Form submission animation
  const loginForm = document.getElementById('login-form');
  const submitButton = document.getElementById('submitButton');
  const btnLoader = document.getElementById('btnLoader');
  const btnText = submitButton.querySelector('.btn-text');

  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      // Add loading state
      submitButton.classList.add('loading');
      submitButton.disabled = true;
      
      // Simulate loading animation for 2 seconds
      setTimeout(() => {
        submitButton.classList.remove('loading');
        submitButton.disabled = false;
      }, 2000);
    });
  }

  // Input focus animations
  const inputs = document.querySelectorAll('.form-input');
  inputs.forEach(input => {
    const focusLine = input.parentElement.querySelector('.input-focus-line');
    
    input.addEventListener('focus', function() {
      if (focusLine) {
        focusLine.style.width = '100%';
      }
    });
    
    input.addEventListener('blur', function() {
      if (focusLine && !this.value) {
        focusLine.style.width = '0';
      }
    });
  });

  // Apple-style hover effects for buttons
  const buttons = document.querySelectorAll('.alt-btn, .submit-btn');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });

  // Add floating animation to form inputs
  inputs.forEach((input, index) => {
    input.style.animationDelay = `${index * 0.1}s`;
    input.classList.add('animated-input');
  });

  // Error message handling
  window.showLoginError = function(message) {
    const errorElement = document.getElementById('login-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('show');
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        errorElement.classList.remove('show');
      }, 5000);
    }
  };
});

// Add CSS for animated inputs
const style = document.createElement('style');
style.textContent = `
  .animated-input {
    animation: slideUp 0.5s ease-out forwards;
    opacity: 0;
    transform: translateY(20px);
  }
  
  @keyframes slideUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);