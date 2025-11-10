import { useRouter } from 'expo-router';

import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const displayName = user?.user_metadata?.display_name || 'User';
  const email = user?.email || '';

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          // Explicitly navigate to login after logout
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-6 pt-16">
        <Text className="mb-8 text-3xl font-bold text-gray-900 dark:text-white">Settings</Text>

        {/* User Info Section */}
        <View className="mb-8">
          <Text className="mb-4 text-sm font-medium text-gray-500 dark:text-gray-400">ACCOUNT</Text>
          <View className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
            <View className="mb-3">
              <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">Display Name</Text>
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {displayName}
              </Text>
            </View>
            <View>
              <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">Email</Text>
              <Text className="text-base font-semibold text-gray-900 dark:text-white">{email}</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity className="mt-6 rounded-lg bg-red-600 py-4" onPress={handleLogout}>
          <Text className="text-center text-lg font-semibold text-white">Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
