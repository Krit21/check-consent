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
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  if (!user) {
    $('status').textContent = 'Sign in to approve this connection.';
    $('providers').hidden = false;
    for (const provider of ['apple', 'google']) {
      $(provider).onclick = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: location.href } });
        if (error) $('status').textContent = error.message;
      };
    }
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
