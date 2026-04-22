"use client";

import { useState, FormEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import styles from './page.module.css';

const roles = [
  {
    id: 'admin',
    name: 'Administrator',
    desc: 'Full system access',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
    )
  },
  {
    id: 'coo',
    name: 'COO',
    desc: 'Executive overview',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
    )
  },
  {
    id: 'gm',
    name: 'General Manager',
    desc: 'Branch management',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    )
  },
  {
    id: 'tl',
    name: 'Team Lead',
    desc: 'Team operations',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    )
  }
];

export default function Login() {
  const [selectedRole, setSelectedRole] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Get the user's role from metadata
      let userRole = data.user?.user_metadata?.role;
      if (userRole === 'tl1') userRole = 'tl'; // Map backend Enum TL1 to frontend role 'tl'

      if (userRole && userRole !== selectedRole) {
        setError(`Your account is assigned to the "${userRole}" role. Please select the correct role.`);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Redirect to the role's dashboard
      window.location.href = `/${selectedRole}/dashboard`;
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Animated Background Blobs */}
      <div className={styles.backgroundElements}>
        <div className={styles.blob1}></div>
        <div className={styles.blob2}></div>
        <div className={styles.blob3}></div>
      </div>

      {/* Main Glassmorphism Card */}
      <div className={styles.glassCard}>
        
        {/* Left Branding Section */}
        <div className={styles.brandSection}>
          <div className={styles.brandContent}>
            <div className={styles.logoContainer}>
              {!logoError ? (
                <img 
                  src="/logo.png" 
                  alt="TrueUp Media" 
                  className={styles.mainLogo}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <h1 style={{ color: 'var(--primary)', fontSize: '2.5rem', margin: 0 }}>TrueUp Media</h1>
              )}
            </div>
          </div>
          <div className={styles.welcomeText}>
            <h1>Welcome Back</h1>
            <p>Access your personalized dashboard by selecting your designated role below.</p>
          </div>
        </div>

        {/* Right Login Section */}
        <div className={styles.loginSection}>
          <div className={styles.loginHeader}>
            <h2>Select your role</h2>
            <p>Choose your workspace to continue</p>
          </div>

          <div className={styles.roleGrid}>
            {roles.map((role) => (
              <button 
                key={role.id}
                type="button"
                className={`${styles.roleCard} ${selectedRole === role.id ? styles.roleCardActive : ''}`}
                onClick={() => setSelectedRole(role.id)}
              >
                <div className={styles.roleIcon}>
                  {role.icon}
                </div>
                <div className={styles.roleInfo}>
                  <div className={styles.roleName} style={{ textAlign: 'left' }}>{role.name}</div>
                  <div className={styles.roleDesc} style={{ textAlign: 'left' }}>{role.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address</label>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input 
                  type="email" 
                  id="email" 
                  className={styles.input} 
                  placeholder="name@trueupmedia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <div className={styles.inputWrapper}>
                <svg className={styles.inputIcon} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input 
                  type="password" 
                  id="password" 
                  className={styles.input} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            <a href="#" className={styles.forgotPassword}>Forgot password?</a>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In as {roles.find(r => r.id === selectedRole)?.name}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
