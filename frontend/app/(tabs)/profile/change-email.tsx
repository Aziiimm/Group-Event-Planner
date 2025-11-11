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

    if (!user?.id) return;

    try {
      // Update auth.users email (this will send confirmation email)
      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (authError) {
        Alert.alert('Error', authError.message || 'Failed to change email.');
        return;
      }

      // Also update public.users email to keep them in sync
      // Note: This updates immediately, even before email confirmation
      // If you want to wait for confirmation, you can use a database trigger
      // or handle it after email confirmation
      const { error: dbError } = await supabase
        .from('users')
        .update({ email: newEmail })
        .eq('id', user.id);

      if (dbError) {
        // If public.users update fails, log it but don't fail the whole operation
        // since auth.users was updated successfully
        console.warn('Failed to update public.users email:', dbError);
      }

      Alert.alert(
        'Success',
        'Email change requested. Please check your new email for a confirmation link.',
      );
      setNewEmail('');
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

