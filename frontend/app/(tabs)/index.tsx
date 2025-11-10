import { Text, View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';

export default function HomeScreen() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.display_name || 'there';

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="mb-4 text-4xl font-bold text-blue-600">HuddleUp</Text>
      <Text className="text-xl text-gray-700">Hello {displayName}!</Text>
    </View>
  );
}
