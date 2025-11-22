import { useEffect, useState } from 'react';

import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('first_name, last_name, display_name')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setDisplayName(data.display_name || '');
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const capitalizeFirstLetter = (str: string): string => {
    if (!str || str.length === 0) {
      return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      // Format fields before storing
      const formattedDisplayName = displayName.toLowerCase().trim();
      const formattedFirstName = capitalizeFirstLetter(firstName.trim());
      const formattedLastName = capitalizeFirstLetter(lastName.trim());

      // Check if display_name already exists (excluding current user)
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('id, display_name')
        .neq('id', user.id);

      if (!checkError && existingUsers) {
        const duplicateExists = existingUsers.some(
          (u) => u.display_name?.toLowerCase() === formattedDisplayName,
        );

        if (duplicateExists) {
          Alert.alert(
            'Error',
            'This display name is already taken. Please choose a different name.',
          );
          return;
        }
      }

      // Update public.users table
      const { error: dbError } = await supabase
        .from('users')
        .update({
          first_name: formattedFirstName,
          last_name: formattedLastName,
          display_name: formattedDisplayName,
        })
        .eq('id', user.id);

      if (dbError) {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
        return;
      }

      // Also update auth.users metadata to keep them in sync
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: formattedFirstName,
          last_name: formattedLastName,
          display_name: formattedDisplayName,
        },
      });

      if (authError) {
        // If auth update fails, still show success since public.users was updated
        console.warn('Failed to update auth metadata:', authError);
      }

      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-6">
          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">First Name</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Enter first name"
              placeholderTextColor="#9CA3AF"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">Last Name</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Enter last name"
              placeholderTextColor="#9CA3AF"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-6">
            <Text className="mb-2 text-sm font-medium text-gray-700">Display Name</Text>
            <TextInput
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
              placeholder="Enter display name"
              placeholderTextColor="#9CA3AF"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          </View>

          <TouchableOpacity
            className="mt-4 w-full rounded-lg bg-blue-600 py-3"
            onPress={handleSave}
          >
            <Text className="text-center text-lg font-semibold text-white">Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

