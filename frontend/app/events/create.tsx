import { useState } from 'react';

import { router, useLocalSearchParams } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { eventsApi } from '@/lib/api';

export default function CreateEventScreen() {
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tempTime, setTempTime] = useState<Date>(new Date()); // Temporary time for picker
  const [dateTime, setDateTime] = useState('');
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showAndroidTimePicker, setShowAndroidTimePicker] = useState(false);
  const [pickerStep, setPickerStep] = useState<'calendar' | 'time'>('calendar');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const formatDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`;
  };

  const formatDisplayDateTime = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return date.toLocaleString('en-US', options);
  };

  const handleDatePickerPress = () => {
    setPickerStep('calendar');
    setShowPickerModal(true);
    // Initialize with current date if we have one, otherwise today
    if (selectedCalendarDate) {
      setSelectedCalendarDate(selectedCalendarDate);
    } else {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      setSelectedCalendarDate(dateStr);
    }
  };

  const handleCalendarDayPress = (day: { dateString: string }) => {
    setSelectedCalendarDate(day.dateString);
    // Initialize tempTime with the selected date and current time
    const [year, month, dayNum] = day.dateString.split('-').map(Number);
    const newDate = new Date(year, month - 1, dayNum);
    newDate.setHours(selectedDate.getHours());
    newDate.setMinutes(selectedDate.getMinutes());
    setTempTime(newDate);

    // On Android, show native time picker (system dialog)
    // On iOS, move to time picker step in modal
    if (Platform.OS === 'android') {
      setShowPickerModal(false); // Hide our modal
      setTimeout(() => {
        setShowAndroidTimePicker(true); // Show native picker
      }, 300); // Small delay for modal close animation
    } else {
      setPickerStep('time');
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      // User cancelled - show calendar modal again
      setShowAndroidTimePicker(false);
      setTimeout(() => {
        setShowPickerModal(true);
        setPickerStep('calendar');
      }, 100);
      return;
    }

    if (date && selectedCalendarDate) {
      const [year, month, dayNum] = selectedCalendarDate.split('-').map(Number);
      const newDate = new Date(year, month - 1, dayNum);
      newDate.setHours(date.getHours());
      newDate.setMinutes(date.getMinutes());
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      setTempTime(newDate);

      // On Android, automatically save and close
      if (Platform.OS === 'android') {
        setSelectedDate(newDate);
        setDateTime(formatDateTime(newDate));
        setShowAndroidTimePicker(false);
        setShowPickerModal(false);
        setPickerStep('calendar');
      } else {
        // iOS: just update tempTime
        setTempTime(newDate);
      }
    }
  };

  const handleTimeConfirm = () => {
    if (selectedCalendarDate && tempTime) {
      const [year, month, dayNum] = selectedCalendarDate.split('-').map(Number);
      const newDate = new Date(year, month - 1, dayNum);
      newDate.setHours(tempTime.getHours());
      newDate.setMinutes(tempTime.getMinutes());
      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      setSelectedDate(newDate);
      setDateTime(formatDateTime(newDate));
      setShowPickerModal(false);
      setPickerStep('calendar');
    }
  };

  const handlePickerCancel = () => {
    setShowPickerModal(false);
    setPickerStep('calendar');
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }

    if (!dateTime.trim()) {
      Alert.alert('Error', 'Please select a date and time');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    if (!circleId) {
      Alert.alert('Error', 'Circle ID is missing');
      return;
    }

    setLoading(true);
    try {
      const event = await eventsApi.createEvent(circleId, {
        title: title.trim(),
        date_time: dateTime,
        location: location.trim(),
        description: description.trim() || undefined,
      });
      // Navigate to the newly created event's detail page
      router.replace(`/events/${event.id}` as any);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create event');
      setLoading(false);
    }
  };

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
          <Text className="flex-1 text-2xl font-bold text-white">Create Event</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-6">
          {/* Event Title */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">Event Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Summer BBQ Party"
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              maxLength={255}
            />
          </View>

          {/* Date & Time */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">Date & Time *</Text>
            <TouchableOpacity
              onPress={handleDatePickerPress}
              className="flex-row items-center rounded-xl border border-gray-300 bg-white px-4 py-3"
            >
              <MaterialIcons name="event" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                {dateTime ? (
                  <Text className="text-base text-gray-900">
                    {formatDisplayDateTime(selectedDate)}
                  </Text>
                ) : (
                  <Text className="text-base text-gray-400">Select date and time</Text>
                )}
              </View>
              <MaterialIcons name="arrow-forward-ios" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {dateTime && (
              <Text className="mt-1 text-xs text-gray-500">Tap to change date and time</Text>
            )}
          </View>

          {/* Date/Time Picker Modal */}
          <Modal
            visible={showPickerModal}
            transparent
            animationType="slide"
            onRequestClose={handlePickerCancel}
          >
            <View className="flex-1 bg-black/50">
              <View
                className="absolute bottom-0 w-full rounded-t-3xl bg-white pb-6"
                style={{ paddingBottom: Math.max(insets.bottom, 24) }}
              >
                {/* Modal Header */}
                <View className="flex-row items-center justify-between border-b border-gray-200 px-6 py-4">
                  <TouchableOpacity onPress={handlePickerCancel}>
                    <Text className="text-base font-medium text-gray-600">Cancel</Text>
                  </TouchableOpacity>
                  <Text className="text-lg font-semibold text-gray-900">
                    {pickerStep === 'calendar' ? 'Select Date' : 'Select Time'}
                  </Text>
                  {pickerStep === 'time' && (
                    <TouchableOpacity onPress={handleTimeConfirm}>
                      <Text className="text-base font-semibold text-blue-600">Done</Text>
                    </TouchableOpacity>
                  )}
                  {pickerStep === 'calendar' && <View className="w-12" />}
                </View>

                {/* Calendar View */}
                {pickerStep === 'calendar' && (
                  <View className="px-4 pt-4">
                    <Calendar
                      onDayPress={handleCalendarDayPress}
                      markedDates={{
                        [selectedCalendarDate]: {
                          selected: true,
                          selectedColor: '#3B82F6',
                          selectedTextColor: '#FFFFFF',
                        },
                      }}
                      minDate={new Date().toISOString().split('T')[0]}
                      theme={{
                        backgroundColor: '#ffffff',
                        calendarBackground: '#ffffff',
                        textSectionTitleColor: '#6B7280',
                        selectedDayBackgroundColor: '#3B82F6',
                        selectedDayTextColor: '#ffffff',
                        todayTextColor: '#3B82F6',
                        dayTextColor: '#1F2937',
                        textDisabledColor: '#D1D5DB',
                        dotColor: '#3B82F6',
                        selectedDotColor: '#ffffff',
                        arrowColor: '#3B82F6',
                        monthTextColor: '#1F2937',
                        indicatorColor: '#3B82F6',
                        textDayFontWeight: '500',
                        textMonthFontWeight: '600',
                        textDayHeaderFontWeight: '600',
                        textDayFontSize: 16,
                        textMonthFontSize: 18,
                        textDayHeaderFontSize: 14,
                      }}
                    />
                  </View>
                )}

                {/* Time Picker View - iOS only (Android uses native dialog) */}
                {pickerStep === 'time' && Platform.OS === 'ios' && (
                  <View className="items-center px-6 py-8">
                    <DateTimePicker
                      value={tempTime}
                      mode="time"
                      is24Hour={false}
                      display="spinner"
                      onChange={handleTimeChange}
                      textColor="#1F2937"
                    />
                    <View className="mt-4 w-full flex-row justify-end gap-3">
                      <TouchableOpacity
                        onPress={() => setPickerStep('calendar')}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2"
                      >
                        <Text className="text-base font-medium text-gray-700">Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleTimeConfirm}
                        className="rounded-lg bg-blue-600 px-4 py-2"
                      >
                        <Text className="text-base font-semibold text-white">Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          {/* Android Time Picker - Shows as system dialog outside modal */}
          {showAndroidTimePicker && Platform.OS === 'android' && (
            <DateTimePicker
              value={tempTime}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleTimeChange}
            />
          )}

          {/* Location */}
          <View className="mb-6">
            <Text className="mb-2 text-base font-semibold text-gray-700">Location *</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Central Park, New York"
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              maxLength={500}
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
              placeholder="Add event details..."
              placeholderTextColor="#9CA3AF"
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          {/* Create Button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading || !title.trim() || !dateTime.trim() || !location.trim()}
            className="flex-row items-center justify-center rounded-xl bg-blue-600 py-4 shadow-sm"
            style={{
              opacity: loading || !title.trim() || !dateTime.trim() || !location.trim() ? 0.6 : 1,
            }}
          >
            {loading ? (
              <Text className="text-base font-semibold text-white">Creating...</Text>
            ) : (
              <>
                <MaterialIcons name="check" size={24} color="#FFFFFF" />
                <Text className="ml-2 text-base font-semibold text-white">Create Event</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
