import { useState } from 'react';

import { router } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { circlesApi } from '@/lib/api';

export default function CreateCircleScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a circle name');
      return;
    }

    setLoading(true);
    try {
      const circle = await circlesApi.createCircle(name.trim(), description.trim() || undefined);
      // Navigate to the newly created circle's detail page
      router.replace(`/circle/${circle.id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create circle');
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-blue-600 pb-6"
      >
        <View className="flex-row items-center px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text className="flex-1 text-2xl font-bold text-white">Create Circle</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6">
          {/* Circle Name */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Circle Name *
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Weekend Warriors"
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              maxLength={255}
            />
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">
              Description (Optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What's this circle about?"
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>

          {/* Create Button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading || !name.trim()}
            className="flex-row items-center justify-center rounded-xl bg-blue-600 py-4 shadow-sm"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            {loading ? (
              <Text className="text-base font-semibold text-white">Creating...</Text>
            ) : (
              <>
                <MaterialIcons name="check" size={24} color="#FFFFFF" />
                <Text className="ml-2 text-base font-semibold text-white">
                  Create Circle
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

