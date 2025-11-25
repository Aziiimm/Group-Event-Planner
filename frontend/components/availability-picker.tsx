import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { availabilityApi, AvailabilitySlot } from '@/lib/api';

interface AvailabilityPickerProps {
  circleId: string;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

/**
 * AvailabilityPicker component lets users select available time slots
 * by day and hour. Displays a 7-day x 24-hour grid.
 */
export function AvailabilityPicker({
  circleId,
  onClose,
  onSubmitSuccess,
}: AvailabilityPickerProps) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHours, setSelectedHours] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Generate 7 days starting from today
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }, []);

  const isSelectedDate = (date: Date) => {
    return (
      date.toDateString() === selectedDate.toDateString()
    );
  };

  const toggleHour = (hour: number) => {
    const newSet = new Set(selectedHours);
    if (newSet.has(hour)) {
      newSet.delete(hour);
    } else {
      newSet.add(hour);
    }
    setSelectedHours(newSet);
  };

  const selectAllHours = () => {
    if (selectedHours.size === 24) {
      setSelectedHours(new Set());
    } else {
      const allHours = new Set<number>();
      for (let i = 0; i < 24; i++) {
        allHours.add(i);
      }
      setSelectedHours(allHours);
    }
  };

  const handleSubmit = async () => {
    if (selectedHours.size === 0) {
      Alert.alert('Error', 'Please select at least one hour');
      return;
    }

    try {
      setSubmitting(true);

      // Convert selected hours to ISO time slots
      const slots: AvailabilitySlot[] = Array.from(selectedHours)
        .sort((a, b) => a - b)
        .map((hour) => {
          const startTime = new Date(selectedDate);
          startTime.setHours(hour, 0, 0, 0);

          const endTime = new Date(startTime);
          endTime.setHours(endTime.getHours() + 1);

          return {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          };
        });

      await availabilityApi.submitAvailability(circleId, slots);

      Alert.alert('Success', `${selectedHours.size} time slot(s) submitted`, [
        {
          text: 'OK',
          onPress: () => {
            onSubmitSuccess?.();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit availability');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-blue-600 pb-4">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-2xl font-bold text-white">Share Availability</Text>
          <TouchableOpacity onPress={onClose}>
            <MaterialIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1 px-4 py-6" showsVerticalScrollIndicator={false}>
        {/* Date Selector */}
        <Text className="mb-3 text-lg font-semibold text-gray-900">Select Day</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6 flex-row"
        >
          {weekDays.map((date, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setSelectedDate(date);
                setSelectedHours(new Set());
              }}
              className={`mr-3 items-center rounded-lg px-4 py-3 ${
                isSelectedDate(date) ? 'bg-blue-600' : 'bg-white'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isSelectedDate(date) ? 'text-white' : 'text-gray-700'
                }`}
              >
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text
                className={`text-lg font-bold ${
                  isSelectedDate(date) ? 'text-white' : 'text-gray-900'
                }`}
              >
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Selected Date Info */}
        <View className="mb-6 rounded-lg bg-blue-50 p-4">
          <Text className="text-sm font-semibold text-blue-900">
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          <Text className="mt-1 text-xs text-blue-700">
            Selected: {selectedHours.size} hour(s)
          </Text>
        </View>

        {/* Hour Grid */}
        <View className="mb-6">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-gray-900">Select Hours (24h)</Text>
            <TouchableOpacity
              onPress={selectAllHours}
              className="rounded bg-gray-200 px-3 py-1"
            >
              <Text className="text-xs font-semibold text-gray-700">
                {selectedHours.size === 24 ? 'Clear All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 4-column grid of hours */}
          <View className="flex-wrap flex-row">
            {Array.from({ length: 24 }, (_, i) => i).map((hour) => {
              const isSelected = selectedHours.has(hour);
              const timeStr = `${String(hour).padStart(2, '0')}:00`;

              return (
                <TouchableOpacity
                  key={hour}
                  onPress={() => toggleHour(hour)}
                  className={`mb-2 mr-2 w-1/4 rounded-lg p-3 ${
                    isSelected ? 'bg-blue-600' : 'bg-white border border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      isSelected ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {timeStr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Info */}
        <View className="mb-6 rounded-lg bg-amber-50 p-4">
          <View className="flex-row">
            <MaterialIcons name="info" size={20} color="#B45309" />
            <Text className="ml-3 flex-1 text-sm text-amber-800">
              Share when you&apos;re available. Select one or more hours. The heatmap will show
              when the group can meet.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={{ paddingBottom: insets.bottom }} className="border-t border-gray-200 bg-white px-4 py-4">
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || selectedHours.size === 0}
          className="flex-row items-center justify-center rounded-lg bg-blue-600 py-4"
          style={{ opacity: submitting || selectedHours.size === 0 ? 0.6 : 1 }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text className="ml-2 text-lg font-semibold text-white">
                Submit ({selectedHours.size} hours)
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
