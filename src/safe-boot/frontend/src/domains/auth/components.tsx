/**
 * Authentication Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import type { DeviceInfo, MFAMethod } from './types';

/* ------------------------------------------------------------------ */
/*  LoginForm                                                          */
/* ------------------------------------------------------------------ */

export interface LoginFormProps {
  onSubmit: (email: string, password: string, orgId?: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onSocialLogin?: (provider: 'google' | 'facebook') => void;
}

export function LoginForm({
  onSubmit,
  isLoading = false,
  error,
  onSocialLogin,
}: LoginFormProps): React.ReactElement | null {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgId, setOrgId] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    await onSubmit(email, password, orgId || undefined);
  };

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.loginTitle}>Sign In</Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#888"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#888"
      />

      <TextInput
        style={styles.input}
        placeholder="Organization ID (optional)"
        value={orgId}
        onChangeText={setOrgId}
        placeholderTextColor="#888"
      />

      <Pressable
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Sign In</Text>
        )}
      </Pressable>

      {onSocialLogin && (
        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => onSocialLogin('google')}
          >
            <Text style={styles.socialButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => onSocialLogin('facebook')}
          >
            <Text style={styles.socialButtonText}>Sign in with Facebook</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  MfaSetupForm                                                       */
/* ------------------------------------------------------------------ */

export interface MFASetupFormProps {
  method: MFAMethod;
  qrCode: string | null;
  onSubmit: (code: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onCancel?: () => void;
}

export function MFASetupForm({
  method,
  qrCode,
  onSubmit,
  isLoading = false,
  error,
  onCancel,
}: MFASetupFormProps): React.ReactElement | null {
  const [code, setCode] = useState('');

  const handleSubmit = async () => {
    if (!code) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    await onSubmit(code);
  };

  return (
    <View style={styles.setupContainer}>
      <Text style={styles.setupTitle}>
        {method === 'totp' ? 'Setup Two-Factor Authentication' : 'Verify Your Code'}
      </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {method === 'totp' && qrCode && (
        <View style={styles.qrCodeContainer}>
          <Text style={styles.qrCodeLabel}>Scan this code with your authenticator app</Text>
          {/* QR code would be rendered here using a library like react-native-qrcode-svg */}
          <View style={styles.qrCodePlaceholder}>
            <Text style={styles.qrCodePlaceholderText}>[QR Code]</Text>
          </View>
          <Text style={styles.qrCodeHint}>Or enter this secret: abc123def456</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Verification code"
        value={code}
        onChangeText={setCode}
        keyboardType="numeric"
        maxLength={6}
        placeholderTextColor="#888"
      />

      <Pressable
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Verify</Text>
        )}
      </Pressable>

      {onCancel && (
        <Pressable
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  MfaVerifyForm                                                      */
/* ------------------------------------------------------------------ */

export interface MFAVerifyFormProps {
  onSubmit: (code: string) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onCancel?: () => void;
}

export function MFAVerifyForm({
  onSubmit,
  isLoading = false,
  error,
  onCancel,
}: MFAVerifyFormProps): React.ReactElement | null {
  const [code, setCode] = useState('');

  const handleSubmit = async () => {
    if (!code) {
      Alert.alert('Error', 'Please enter the MFA code');
      return;
    }
    await onSubmit(code);
  };

  return (
    <View style={styles.verifyContainer}>
      <Text style={styles.verifyTitle}>Enter MFA Code</Text>
      <Text style={styles.verifySubtitle}>
        Please enter the code sent to your device
      </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Enter code"
        value={code}
        onChangeText={setCode}
        keyboardType="numeric"
        maxLength={6}
        placeholderTextColor="#888"
      />

      <Pressable
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitButtonText}>Verify</Text>
        )}
      </Pressable>

      {onCancel && (
        <Pressable
          style={styles.cancelButton}
          onPress={onCancel}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  loginContainer: { padding: 16, backgroundColor: '#121212' },
  setupContainer: { padding: 16, backgroundColor: '#121212' },
  verifyContainer: { padding: 16, backgroundColor: '#121212' },
  loginTitle: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  setupTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  verifyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  verifySubtitle: { color: '#888', fontSize: 14, marginBottom: 24, textAlign: 'center' },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    borderColor: '#333',
    borderWidth: 1,
    color: '#ffffff',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#6366f1', fontSize: 16 },
  errorContainer: {
    padding: 12,
    backgroundColor: '#331111',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorText: { color: '#ff6b6b', fontSize: 14 },
  socialButtons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  socialButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  socialButtonText: { color: '#ffffff', fontSize: 14 },
  qrCodeContainer: { alignItems: 'center', marginBottom: 24 },
  qrCodeLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  qrCodePlaceholder: {
    width: 150,
    height: 150,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  qrCodePlaceholderText: { color: '#888' },
  qrCodeHint: { color: '#666', fontSize: 11, marginTop: 8 },
});