import { useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-6">
          {/* Edit Profile */}
          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm"
            onPress={() => router.push('/(tabs)/profile/edit-profile')}
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MaterialIcons name="person" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 flex-1 text-base text-gray-900">Edit Profile</Text>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Change Password */}
          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm"
            onPress={() => router.push('/(tabs)/profile/change-password')}
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MaterialIcons name="lock" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 flex-1 text-base text-gray-900">Change Password</Text>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Change Email */}
          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm"
            onPress={() => router.push('/(tabs)/profile/change-email')}
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MaterialIcons name="email" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 flex-1 text-base text-gray-900">Change Email</Text>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
