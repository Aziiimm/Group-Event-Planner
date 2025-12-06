import { useCallback, useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { availabilityApi } from '@/lib/api';

interface AvailabilityBlock {
  id: string;
  date: string;
  hour_block: number;
  is_available: boolean;
}

export default function AvailabilityManagementScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [selectedHourBlocks, setSelectedHourBlocks] = useState<Set<number>>(new Set());
  const [availabilityData, setAvailabilityData] = useState<AvailabilityBlock[]>([]);
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  // Fetch existing availability for the current month
  const fetchAvailability = useCallback(async () => {
    if (!circleId) return;

    try {
      setLoading(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const data = await availabilityApi.getCircleAvailability(circleId, startDate, endDate);
      
      // Filter to only current user's availability
      const userAvailability = (data || []).filter(
        (item: any) => item.user?.id === user?.id || item.user_id === user?.id,
      );

      setAvailabilityData(userAvailability);

      // Build marked dates for calendar
      const marked: Record<string, any> = {};
      userAvailability.forEach((item: AvailabilityBlock) => {
        if (item.is_available) {
          if (!marked[item.date]) {
            marked[item.date] = { marked: true, dotColor: '#10B981' };
          }
        }
      });
      setMarkedDates(marked);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  }, [circleId, user?.id]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useFocusEffect(
    useCallback(() => {
      fetchAvailability();
    }, [fetchAvailability]),
  );

  // Load hour blocks for selected date
  useEffect(() => {
    if (!selectedDate) return;

    const dateAvailability = availabilityData.filter(
      (item) => item.date === selectedDate && item.is_available,
    );
    const hourBlocks = new Set(dateAvailability.map((item) => item.hour_block));
    setSelectedHourBlocks(hourBlocks);
  }, [selectedDate, availabilityData]);

  const toggleHourBlock = (hour: number) => {
    const newSet = new Set(selectedHourBlocks);
    if (newSet.has(hour)) {
      newSet.delete(hour);
    } else {
      newSet.add(hour);
    }
    setSelectedHourBlocks(newSet);
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const handleSave = async () => {
    if (!circleId || !selectedDate) return;

    try {
      setSaving(true);

      // Get existing availability blocks for this date to update/delete
      const existingBlocks = availabilityData.filter(
        (item) => item.date === selectedDate && item.user_id === user?.id,
      );

      // If no hours are selected, delete all availability for this date
      if (selectedHourBlocks.size === 0) {
        // Delete all existing blocks for this date
        for (const block of existingBlocks) {
          try {
            await availabilityApi.deleteAvailabilityBlock(block.id);
          } catch (error) {
            // Continue even if delete fails
          }
        }
        Alert.alert('Success', 'Availability removed for this date');
        await fetchAvailability();
        setSaving(false);
        return;
      }

      // Delete blocks that are no longer selected
      const blocksToDelete = existingBlocks.filter(
        (item) => !selectedHourBlocks.has(item.hour_block),
      );
      for (const block of blocksToDelete) {
        try {
          await availabilityApi.deleteAvailabilityBlock(block.id);
        } catch (error) {
          // Continue even if delete fails
        }
      }

      // Update blocks that changed from unavailable to available
      const blocksToUpdate = existingBlocks.filter(
        (item) => selectedHourBlocks.has(item.hour_block) && !item.is_available,
      );
      for (const block of blocksToUpdate) {
        try {
          await availabilityApi.updateAvailabilityBlock(block.id, true);
        } catch (error) {
          // Continue even if update fails
        }
      }

      // Create new blocks for selected hours that don't exist
      const existingHourBlocks = new Set(
        existingBlocks.filter((item) => item.is_available).map((item) => item.hour_block),
      );
      const newHourBlocks = Array.from(selectedHourBlocks).filter(
        (hour) => !existingHourBlocks.has(hour),
      );

      if (newHourBlocks.length > 0) {
        await availabilityApi.setAvailability(circleId, {
          start_date: selectedDate,
          end_date: selectedDate,
          hour_blocks: newHourBlocks,
          is_available: true,
        });
      }

      Alert.alert('Success', 'Availability updated successfully');
      await fetchAvailability();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSet = () => {
    if (selectedHourBlocks.size === 0) {
      Alert.alert('Error', 'Please select at least one time block first');
      return;
    }

    Alert.alert(
      'Bulk Set Availability',
      'This will set the selected hours for the entire current month. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Set for Month',
          onPress: async () => {
            if (!circleId) return;

            try {
              setSaving(true);
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();
              const startDate = new Date(year, month, 1).toISOString().split('T')[0];
              const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

              await availabilityApi.setAvailability(circleId, {
                start_date: startDate,
                end_date: endDate,
                hour_blocks: Array.from(selectedHourBlocks),
                is_available: true,
              });
              Alert.alert('Success', 'Availability set for the entire month');
              await fetchAvailability();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to set availability');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-blue-600 pb-6">
        <View className="flex-row items-center px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Manage Availability</Text>
            <Text className="mt-1 text-sm text-white/90">Set your available times</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View className="mx-6 mt-6 rounded-xl bg-white p-4 shadow-sm">
          <Calendar
            current={selectedDate}
            onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
            markedDates={{
              ...markedDates,
              [selectedDate]: {
                ...markedDates[selectedDate],
                selected: true,
                selectedColor: '#3B82F6',
              },
            }}
            theme={{
              selectedDayBackgroundColor: '#3B82F6',
              todayTextColor: '#3B82F6',
              arrowColor: '#3B82F6',
              monthTextColor: '#1F2937',
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
            }}
          />
        </View>

        {/* Selected Date Info */}
        <View className="mx-6 mt-6 rounded-xl bg-white p-4 shadow-sm">
          <Text className="mb-3 text-lg font-semibold text-gray-900">
            {new Date(selectedDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          {/* Hour Blocks Grid */}
          <View className="mb-4">
            <Text className="mb-3 text-sm font-medium text-gray-700">
              Select Available Hours (24-hour format)
            </Text>
            <View className="flex-row flex-wrap">
              {Array.from({ length: 24 }, (_, i) => i).map((hour) => {
                const isSelected = selectedHourBlocks.has(hour);
                return (
                  <TouchableOpacity
                    key={hour}
                    onPress={() => toggleHourBlock(hour)}
                    className={`mb-2 mr-2 rounded-lg border-2 p-3 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected ? 'text-blue-600' : 'text-gray-700'
                      }`}
                    >
                      {formatHour(hour)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-1 flex-row items-center justify-center rounded-xl bg-blue-600 py-3"
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons
                    name={selectedHourBlocks.size === 0 ? 'delete' : 'save'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text className="ml-2 text-base font-semibold text-white">
                    {selectedHourBlocks.size === 0 ? 'Remove All' : 'Save Day'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleBulkSet}
              disabled={saving || selectedHourBlocks.size === 0}
              className="flex-1 flex-row items-center justify-center rounded-xl border-2 border-blue-600 bg-white py-3"
              style={{ opacity: saving || selectedHourBlocks.size === 0 ? 0.6 : 1 }}
            >
              <MaterialIcons name="date-range" size={20} color="#3B82F6" />
              <Text className="ml-2 text-base font-semibold text-blue-600">Bulk Set</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Section */}
        <View className="mx-6 mb-6 mt-4 rounded-xl bg-blue-50 p-4">
          <View className="flex-row items-start">
            <MaterialIcons name="info" size={20} color="#3B82F6" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-blue-900">Tips</Text>
              <Text className="mt-1 text-xs text-blue-800">
                • Select hours to mark yourself as available{'\n'}
                • Deselect all hours and save to remove availability for a date{'\n'}
                • Use "Save Day" to update the selected date{'\n'}
                • Use "Bulk Set" to apply selected hours to a date range
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

