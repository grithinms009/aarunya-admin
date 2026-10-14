import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, auth } from '@/api';
import { useViewport } from '@/hooks/useViewport';
import { useAuth } from '@/store/useAuth';
import { useUi } from '@/store/useUi';
import f from '@/styles/form.module.css';
import s from './LoginPage.module.css';

export function LoginPage() {
  const { w } = useViewport();
  const navigate = useNavigate();
  const signIn = useAuth((st) => st.signIn);
  const flash = useUi((st) => st.flash);

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const twoUp = w >= 860;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      signIn(await auth.login(email, pass));
      navigate('/dashboard', { replace: true });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.requestPasswordReset(email);
      setForgot(false);
      flash('If that email is registered, a reset link is on its way.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={s.screen}
      style={{ gridTemplateColumns: twoUp ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr' }}
    >
      {twoUp && (
        <div className={s.brand}>
          <img src="/assets/aarunya-logo-full-sm.png" alt="Aarunya by Veena" className={s.brandLogo} />
          <p className={s.tagline}>Your little jewellery box, behind the scenes.</p>
        </div>
      )}

      <div className={s.panel}>
        <div className={s.col}>
          {!twoUp && (
            <img
              src="/assets/aarunya-logo-full-sm.png"
              alt="Aarunya by Veena"
              style={{ display: 'block', width: 150, height: 'auto', alignSelf: 'center' }}
            />
          )}

          {!forgot ? (
            <form onSubmit={submit} className={s.form}>
              <div className={s.intro}>
                <span className={s.eyebrow}>Store admin</span>
                <h1 className={s.h1}>Welcome back</h1>
                <p className={s.lede}>Sign in to manage products, orders and your storefront.</p>
              </div>

              <label className={f.label}>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErr('');
                  }}
                  placeholder="you@aarunyajewels.in"
                  className={s.input}
                />
              </label>

              <label className={f.label}>
                Password
                <span className={s.passWrap}>
                  <input
                    type={show ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={pass}
                    onChange={(e) => {
                      setPass(e.target.value);
                      setErr('');
                    }}
                    className={s.passInput}
                  />
                  <button type="button" onClick={() => setShow(!show)} className={s.reveal}>
                    {show ? 'Hide' : 'Show'}
                  </button>
                </span>
              </label>

              {err && (
                <p role="alert" className={s.error}>
                  {err}
                </p>
              )}

              <button type="submit" disabled={busy} className={s.submit}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              <button type="button" onClick={() => setForgot(true)} className={s.link}>
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={sendReset} className={s.form}>
              <h1 className={s.h1Reset}>Reset password</h1>
              <p className={s.lede}>
                Enter your admin email and we’ll send you a link to set a new password.
              </p>
              <label className={f.label}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={s.input}
                />
              </label>
              <button type="submit" disabled={busy} className={s.submit}>
                Send reset link
              </button>
              <button type="button" onClick={() => setForgot(false)} className={s.link}>
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
