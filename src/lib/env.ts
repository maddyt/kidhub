// Central place for configuration, with errors that say exactly what is missing.
function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example and README "Setup".`);
  return value;
}

export const env = {
  supabaseUrl: () => need('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => need('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => need('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  demoMode: () => process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  demoPassword: () => process.env.DEMO_PASSWORD ?? '',
  signupCode: () => process.env.OWNER_SIGNUP_CODE ?? '',
  anthropicKey: () => process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: () => process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  cronSecret: () => process.env.CRON_SECRET ?? '',
};
