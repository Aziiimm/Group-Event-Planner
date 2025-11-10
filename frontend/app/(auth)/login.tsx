import { useState } from 'react';

import { Link, useRouter } from 'expo-router';

import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        console.error('Login error:', error);
        Alert.alert('Login Failed', error.message || 'An error occurred during login');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Login exception:', err);
      Alert.alert(
        'Login Failed',
        err?.message || 'Network request failed. Please check your connection.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <View className="mb-8">
        <Text className="mb-2 text-3xl font-bold text-gray-900">Welcome Back</Text>
        <Text className="text-gray-600">Sign in to continue</Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="mb-2 text-sm font-medium text-gray-700">Email</Text>
          <TextInput
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium text-gray-700">
            Password
          </Text>
          <TextInput
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
          />
        </View>

        <TouchableOpacity
          className="mt-6 w-full rounded-lg bg-blue-600 py-3"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-lg font-semibold text-white">Sign In</Text>
          )}
        </TouchableOpacity>

        <View className="mt-4 flex-row justify-center">
          <Text className="text-gray-600">Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="font-semibold text-blue-600">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}
