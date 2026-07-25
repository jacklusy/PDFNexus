'use client';

import { useState, FormEvent } from 'react';
import { Settings as SettingsIcon, Lock, Mail, Save, Shield } from 'lucide-react';
import {
  adminChangePasswordRequest,
  adminChangePasswordConfirm,
  adminChangeEmailRequest,
  adminChangeEmailConfirm,
} from '@/features/admin/api';
import { PageHeader } from '@/features/admin/ui';
import { useAdminAuth } from '@/features/admin/AdminAuthProvider';

type PasswordStep = 'initial' | 'code';
type EmailStep = 'initial' | 'code';

export default function SettingsPage() {
  const { user } = useAdminAuth();
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('initial');
  const [emailStep, setEmailStep] = useState<EmailStep>('initial');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const handlePasswordRequest = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      await adminChangePasswordRequest(currentPassword);
      setPasswordSuccess('Verification code sent! Check your email.');
      setPasswordStep('code');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to request password change');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);

    try {
      await adminChangePasswordConfirm(passwordCode, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setPasswordStep('initial');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordCode('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to confirm password change');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEmailRequest = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    if (!newEmail.includes('@')) {
      setEmailError('Invalid email address');
      return;
    }

    setEmailLoading(true);
    try {
      await adminChangeEmailRequest(emailCurrentPassword, newEmail);
      setEmailSuccess('Verification code sent! Check your new email.');
      setEmailStep('code');
    } catch (err: any) {
      setEmailError(err.message || 'Failed to request email change');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');
    setEmailLoading(true);

    try {
      await adminChangeEmailConfirm(emailCode);
      setEmailSuccess('Email changed successfully! Please log in again.');
      setTimeout(() => {
        window.location.href = '/admin/login';
      }, 2000);
    } catch (err: any) {
      setEmailError(err.message || 'Failed to confirm email change');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your account and security settings"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[var(--color-accent-soft)] rounded-lg">
              <Lock className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">Change Password</h3>
          </div>

          {passwordSuccess && (
            <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">{passwordSuccess}</p>
            </div>
          )}

          {passwordError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{passwordError}</p>
            </div>
          )}

          {passwordStep === 'initial' ? (
            <form onSubmit={handlePasswordRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Shield className="w-4 h-4" />
                {passwordLoading ? 'Sending Code...' : 'Request Change'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordConfirm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={passwordCode}
                  onChange={(e) => setPasswordCode(e.target.value)}
                  required
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordStep('initial');
                    setPasswordCode('');
                    setPasswordError('');
                  }}
                  className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {passwordLoading ? 'Confirming...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[var(--color-accent-soft)] rounded-lg">
              <Mail className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">Change Email</h3>
          </div>

          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Current email: <span className="font-semibold">{user?.email}</span>
            </p>
          </div>

          {emailSuccess && (
            <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">{emailSuccess}</p>
            </div>
          )}

          {emailError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{emailError}</p>
            </div>
          )}

          {emailStep === 'initial' ? (
            <form onSubmit={handleEmailRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  New Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              <button
                type="submit"
                disabled={emailLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Shield className="w-4 h-4" />
                {emailLoading ? 'Sending Code...' : 'Request Change'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailConfirm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  required
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-2 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Check your new email address for the verification code
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEmailStep('initial');
                    setEmailCode('');
                    setEmailError('');
                  }}
                  className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {emailLoading ? 'Confirming...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
