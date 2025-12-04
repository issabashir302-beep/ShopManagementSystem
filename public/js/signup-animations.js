// Initialize signup animations
document.addEventListener('DOMContentLoaded', function() {
  // Form section navigation
  const sections = document.querySelectorAll('.form-section');
  const steps = document.querySelectorAll('.step');
  const progressLines = document.querySelectorAll('.progress-line');
  let currentSection = 1;

  // Password toggle
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function() {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      const eyeIcon = this.querySelector('i');
      
      if (type === 'text') {
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });
  }

  // Next button for section 1
  const nextBtn1 = document.getElementById('nextBtn1');
  if (nextBtn1) {
    nextBtn1.addEventListener('click', function() {
      if (validateSection1()) {
        navigateToSection(2);
      }
    });
  }

  // Back button for section 2
  const backBtn2 = document.getElementById('backBtn2');
  if (backBtn2) {
    backBtn2.addEventListener('click', function() {
      navigateToSection(1);
    });
  }

  // Role selection
  const roleOptions = document.querySelectorAll('.role-option');
  const roleSelect = document.getElementById('role');
  
  roleOptions.forEach(option => {
    option.addEventListener('click', function() {
      // Remove selected class from all options
      roleOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      this.classList.add('selected');
      
      // Update hidden select
      const role = this.dataset.role;
      roleSelect.value = role;
    });
  });

  // Password strength indicator
  if (passwordInput) {
    passwordInput.addEventListener('input', checkPasswordStrength);
  }

  // Form submission
  const signupForm = document.getElementById('signup-form');
  const submitButton = document.getElementById('submitButton');
  
  if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      if (validateSection2()) {
        // Show loading state
        submitButton.classList.add('loading');
        submitButton.disabled = true;
        
        // Simulate API call and show success
        setTimeout(() => {
          submitButton.classList.remove('loading');
          showSuccessSection();
        }, 2000);
      }
    });
  }

  // Navigation functions
  function navigateToSection(sectionNumber) {
    // Hide all sections
    sections.forEach(section => section.classList.remove('active'));
    
    // Show target section
    document.getElementById(`section-${sectionNumber}`).classList.add('active');
    
    // Update progress indicator
    updateProgress(sectionNumber);
    
    // Update current section
    currentSection = sectionNumber;
  }

  function updateProgress(step) {
    steps.forEach((stepEl, index) => {
      if (index + 1 <= step) {
        stepEl.classList.add('active');
      } else {
        stepEl.classList.remove('active');
      }
    });
    
    progressLines.forEach((line, index) => {
      if (index + 1 < step) {
        line.classList.add('active');
      } else {
        line.classList.remove('active');
      }
    });
  }

  // Validation functions
  function validateSection1() {
    const fullName = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    let isValid = true;
    const errorElement = document.getElementById('signup-error');
    
    // Clear previous error
    errorElement.classList.remove('show');
    
    if (!fullName) {
      showError('Please enter your full name');
      isValid = false;
    } else if (!email) {
      showError('Please enter your email address');
      isValid = false;
    } else if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      isValid = false;
    } else if (!password) {
      showError('Please enter a password');
      isValid = false;
    } else if (password.length < 8) {
      showError('Password must be at least 8 characters long');
      isValid = false;
    }
    
    return isValid;
  }

  function validateSection2() {
    const role = roleSelect.value;
    const terms = document.getElementById('terms').checked;
    
    let isValid = true;
    const errorElement = document.getElementById('signup-error');
    
    // Clear previous error
    errorElement.classList.remove('show');
    
    if (!role) {
      showError('Please select a role');
      isValid = false;
    } else if (!terms) {
      showError('Please agree to the terms and conditions');
      isValid = false;
    }
    
    return isValid;
  }

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function showError(message) {
    const errorElement = document.getElementById('signup-error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    
    // Auto-hide error after 5 seconds
    setTimeout(() => {
      errorElement.classList.remove('show');
    }, 5000);
  }

  // Password strength checker
  function checkPasswordStrength() {
    const password = passwordInput.value;
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const requirements = document.querySelectorAll('.requirement');
    
    let score = 0;
    const totalRules = 5;
    
    // Check each rule
    const rules = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    // Update requirement indicators
    requirements.forEach(req => {
      const rule = req.dataset.rule;
      if (rules[rule]) {
        req.classList.add('valid');
        req.querySelector('i').style.color = '#34C759';
        score++;
      } else {
        req.classList.remove('valid');
        req.querySelector('i').style.color = '#C7C7CC';
      }
    });
    
    // Update strength bar
    const percentage = (score / totalRules) * 100;
    strengthFill.style.width = `${percentage}%`;
    
    // Update strength text
    if (score === 0) {
      strengthText.textContent = 'Password strength';
      strengthFill.style.background = 'linear-gradient(90deg, #FF3B30, #FF3B30)';
    } else if (score < 3) {
      strengthText.textContent = 'Weak password';
      strengthFill.style.background = 'linear-gradient(90deg, #FF3B30, #FF9500)';
    } else if (score < 5) {
      strengthText.textContent = 'Good password';
      strengthFill.style.background = 'linear-gradient(90deg, #FF9500, #FFCC00)';
    } else {
      strengthText.textContent = 'Strong password';
      strengthFill.style.background = 'linear-gradient(90deg, #34C759, #28A745)';
    }
  }

  // Success section
  function showSuccessSection() {
    navigateToSection(3);
    
    // Populate account details
    const fullName = document.getElementById('full_name').value;
    const email = document.getElementById('email').value;
    const role = roleSelect.value;
    
    document.getElementById('detailName').textContent = fullName;
    document.getElementById('detailEmail').textContent = email;
    document.getElementById('detailRole').textContent = role.charAt(0).toUpperCase() + role.slice(1);
    
    // Add click handlers for success buttons
    document.getElementById('verifyEmailBtn').addEventListener('click', function() {
      this.classList.add('loading');
      this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending verification...';
      
      setTimeout(() => {
        this.innerHTML = '<i class="fas fa-check"></i> Verification Sent!';
        this.style.background = 'linear-gradient(135deg, #34C759, #28A745)';
      }, 1500);
    });
  }

  // Initialize first section
  navigateToSection(1);
});