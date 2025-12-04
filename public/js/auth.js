// js/auth.js
//import the supabase client

// Helper: redirect based on role
async function redirectByRole(userId) {
  const { data, error } = await supabase
    .from('users')         // public.users table
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error(error);
    alert('Unable to determine user role.');
    return;
  }

  if (data.role === 'admin') {
    window.location.href = 'admin.html';
  } else if (data.role === 'shopkeeper') {
    window.location.href = 'shopkeeper.html';
  } else {
    alert('Unknown role: ' + data.role);
  }
}

// SIGNUP
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const errorEl = document.getElementById('signup-error');

    errorEl.textContent = '';

    // 1. Create auth user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) {
      errorEl.textContent = signUpError.message;
      return;
    }

    const user = signUpData.user;
    if (!user) {
      errorEl.textContent = 'Sign up failed.';
      return;
    }

    // 2. Insert into public.users
    const { error: insertError } = await supabase.from('users').insert({
      user_id: user.id,
      email,
      full_name: fullName,
      role
    });

    if (insertError) {
      errorEl.textContent = 'Created account but failed to save profile.';
      console.error(insertError);
      return;
    }

    // 3. Redirect based on role
    await redirectByRole(user.id);
  });
}

// LOGIN
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login_email').value.trim();
    const password = document.getElementById('login_password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.textContent = '';

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      errorEl.textContent = error.message;
      return;
    }

    const user = data.user;
    if (!user) {
      errorEl.textContent = 'Login failed.';
      return;
    }

    await redirectByRole(user.id);
  });
}
