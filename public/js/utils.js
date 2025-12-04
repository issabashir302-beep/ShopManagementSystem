// js/utils.js

async function requireAuthAndRole(expectedRole) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  const userId = session.user.id;

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    window.location.href = 'login.html';
    return null;
  }

  if (expectedRole && data.role !== expectedRole) {
    // Wrong role -> redirect
    if (data.role === 'admin') window.location.href = 'admin.html';
    else if (data.role === 'shopkeeper') window.location.href = 'shopkeeper.html';
    return null;
  }

  return { session, role: data.role };
}
