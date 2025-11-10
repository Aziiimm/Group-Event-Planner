import { useState } from 'react';

import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSave = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to change password.');
      } else {
        Alert.alert('Success', 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
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
            <Text className="mb-2 text-sm font-medium text-gray-700">Current Password</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Enter current password"
              placeholderTextColor="#9CA3AF"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">New Password</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Enter new password"
              placeholderTextColor="#9CA3AF"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">Confirm New Password</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Confirm new password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="mt-4 w-full rounded-lg bg-blue-600 py-3"
            onPress={handleSave}
          >
            <Text className="text-center text-lg font-semibold text-white">Change Password</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

