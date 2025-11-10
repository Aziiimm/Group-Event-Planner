import { useState } from 'react';

import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export default function ChangeEmailScreen() {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const currentEmail = user?.email || '';

  const handleSave = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to change email.');
      } else {
        Alert.alert(
          'Success',
          'Email change requested. Please check your new email for a confirmation link.',
        );
        setNewEmail('');
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-6">
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">Current Email</Text>
            <View className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3">
              <Text className="text-gray-900">{currentEmail}</Text>
            </View>
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">New Email</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Enter new email"
              placeholderTextColor="#9CA3AF"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <TouchableOpacity
            className="mt-4 w-full rounded-lg bg-blue-600 py-3"
            onPress={handleSave}
          >
            <Text className="text-center text-lg font-semibold text-white">Change Email</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

