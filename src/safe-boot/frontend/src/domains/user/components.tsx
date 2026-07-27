/**
 * User/Auth Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 2 (IdentityAggregate)
 * @traceability DOC-006: Login form fields derived from LoginUser command
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export interface LoginFormProps {
  onSubmit: (email: string, password: string) => void;
  isLoading: boolean;
  error?: string | null;
}

/**
 * Minimal login form for MVP auth flow.
 * Validates email format client-side before submission.
 */
export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateEmail = useCallback((value: string) => {
    if (!value || !value.includes('@')) {
      setValidationError('Invalid email address');
      return false;
    }
    setValidationError(null);
    return true;
  }, []);

  const handleLogin = useCallback(() => {
    const isValid = validateEmail(email);
    if (!isValid || !password) return;
    onSubmit(email, password);
  }, [email, password, onSubmit, validateEmail]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Lumina</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="admin@lumina.app"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="email-input"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry
        accessibilityLabel="password-input"
      />

      {(error ?? validationError) && (
        <Text style={styles.errorText}>{error ?? validationError}</Text>
      )}

      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={handleLogin} disabled={isLoading}>
        <Text style={styles.buttonText}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#ffffff' },
  label: { fontSize: 14, fontWeight: '500', color: '#a0a0a0', marginTop: 4 },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffff',
  },
  errorText: { fontSize: 13, color: '#ef4444', marginTop: -4 },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
