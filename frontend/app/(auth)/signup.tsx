import { useState } from 'react';

import { Link, useRouter } from 'expo-router';

import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';

export default function SignupScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    if (!firstName || !lastName || !displayName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error, session } = await signUp(email, password, displayName, firstName, lastName);
    setLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message);
    } else if (session) {
      // User is automatically signed in (email confirmation disabled)
      // Redirect to main app
      router.replace('/(tabs)');
    } else {
      // Email confirmation is required
      Alert.alert('Success', 'Account created! Please check your email to verify your account.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(auth)/login'),
        },
      ]);
    }
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <View className="mb-8">
        <Text className="mb-2 text-3xl font-bold text-gray-900">
          Create Account
        </Text>
        <Text className="text-gray-600">Sign up to get started</Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="mb-2 text-sm font-medium text-gray-700">
            First Name
          </Text>
          <TextInput
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
            placeholder="Enter your first name"
            placeholderTextColor="#9CA3AF"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
          />
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium text-gray-700">
            Last Name
          </Text>
          <TextInput
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
            placeholder="Enter your last name"
            placeholderTextColor="#9CA3AF"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
          />
        </View>

        <View>
          <Text className="mb-2 text-sm font-medium text-gray-700">
            Display Name
          </Text>
          <TextInput
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
            placeholder="Enter your display name"
            placeholderTextColor="#9CA3AF"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoComplete="name"
          />
        </View>

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
            placeholder="Enter your password (min 6 characters)"
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
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-lg font-semibold text-white">Sign Up</Text>
          )}
        </TouchableOpacity>

        <View className="mt-4 flex-row justify-center">
          <Text className="text-gray-600">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="font-semibold text-blue-600">Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}
