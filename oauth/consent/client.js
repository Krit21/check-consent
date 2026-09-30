import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = id => document.getElementById(id);
const authorizationId = new URLSearchParams(location.search).get('authorization_id');
const configURL = 'https://sycimszumiigmkdidgzm.supabase.co/functions/v1/consent/config';

async function main() {
  if (!authorizationId) {
    $('status').textContent = 'Missing authorization request.';
    return;
  }

  const response = await fetch(configURL);
  if (!response.ok) throw new Error('Check sign-in is temporarily unavailable.');
  const config = await response.json();
  const supabase = createClient(config.url, config.publishableKey);
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  let user = null;
  if (session) {
    const result = await supabase.auth.getUser();
    if (result.error) throw result.error;
    user = result.data.user;
  }

  if (new URLSearchParams(location.search).get('recovery') === '1') {
    if (!user) throw new Error('The password reset link has expired. Request a new one.');
    $('status').textContent = 'Choose a new password for Check.';
    $('recovery').hidden = false;
    $('set-password').onclick = async () => {
      const password = $('new-password').value;
      if (!password) return;
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { $('status').textContent = error.message; return; }
      const next = new URL(location.href);
      next.searchParams.delete('recovery');
      next.searchParams.delete('code');
      location.assign(next);
    };
    return;
  }

  if (!user) {
    $('status').textContent = 'Sign in to approve this connection.';
    $('providers').hidden = false;
    for (const provider of ['apple', 'google']) {
      $(provider).onclick = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: location.href } });
        if (error) $('status').textContent = error.message;
      };
    }
    $('email-login').onclick = async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: $('email').value.trim(), password: $('password').value
      });
      if (error) { $('status').textContent = error.message; return; }
      location.reload();
    };
    $('email-signup').onclick = async () => {
      const { data, error } = await supabase.auth.signUp({
        email: $('email').value.trim(), password: $('password').value,
        options: { emailRedirectTo: location.href }
      });
      if (error) { $('status').textContent = error.message; return; }
      if (data.session) { location.reload(); return; }
      $('status').textContent = 'Check your email to confirm your account, then return here.';
    };
    $('email-recovery').onclick = async () => {
      const redirectTo = new URL(location.href);
      redirectTo.searchParams.set('recovery', '1');
      const { error } = await supabase.auth.resetPasswordForEmail($('email').value.trim(), {
        redirectTo: redirectTo.toString()
      });
      $('status').textContent = error ? error.message :
        'If an account exists for that address, check your email for a reset link.';
    };
    return;
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) throw error ?? new Error('Invalid authorization request.');
  if (!('authorization_id' in data)) {
    location.assign(data.redirect_url);
    return;
  }

  $('status').textContent = 'Review this connection before allowing access to your tasks.';
  $('client').textContent = 'App: ' + data.client.name;
  $('scope').textContent = 'Permissions: ' + (data.scope || 'Check tasks and lists');
  $('redirect').textContent = 'Return to: ' + data.redirect_uri;
  $('details').hidden = false;

  async function decide(approved) {
    $('approve').disabled = $('deny').disabled = true;
    const result = approved
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (result.error) {
      $('status').textContent = result.error.message;
      $('approve').disabled = $('deny').disabled = false;
    } else {
      location.assign(result.data.redirect_url);
    }
  }

  $('approve').onclick = () => decide(true);
  $('deny').onclick = () => decide(false);
}

main().catch(error => { $('status').textContent = error.message || 'Could not load this request.'; });
