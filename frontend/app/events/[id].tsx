import { useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { eventsApi } from '@/lib/api';

interface EventHost {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
}

interface Event {
  id: string;
  title: string;
  date_time: string;
  location: string;
  description: string | null;
  status: 'upcoming' | 'completed';
  host_id: string;
  host: EventHost;
  circle_id: string;
  created_at: string;
}

interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'going' | 'not_going';
  created_at: string;
  user: {
    id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<EventRSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [userRsvp, setUserRsvp] = useState<'going' | 'not_going' | null>(null);

  useEffect(() => {
    if (id) {
      fetchEventData();
    }
  }, [id]);

  const fetchEventData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [eventData, rsvpsData] = await Promise.all([
        eventsApi.getEvent(id),
        eventsApi.getEventRSVPs(id).catch(() => []), // Don't fail if RSVPs fail
      ]);

      setEvent(eventData);
      setRsvps(rsvpsData || []);

      // Find user's RSVP
      const userRsvpData = (rsvpsData || []).find((rsvp: EventRSVP) => rsvp.user_id === user?.id);
      setUserRsvp(userRsvpData?.status || null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load event data');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (status: 'going' | 'not_going') => {
    if (!id || !user?.id) return;

    try {
      setRsvpLoading(true);
      await eventsApi.rsvpToEvent(id, status);
      setUserRsvp(status);
      // Refresh RSVPs
      const rsvpsData = await eventsApi.getEventRSVPs(id);
      setRsvps(rsvpsData || []);
      Alert.alert(
        'Success',
        `You've marked yourself as ${status === 'going' ? 'going' : 'not going'}`,
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateTimeString;
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null, displayName: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (displayName) {
      return displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  const getDisplayName = (user: {
    first_name: string | null;
    last_name: string | null;
    display_name: string;
  }) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.display_name || 'Unknown User';
  };

  const goingRsvps = rsvps.filter((rsvp) => rsvp.status === 'going');
  const notGoingRsvps = rsvps.filter((rsvp) => rsvp.status === 'not_going');

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-600">Event not found</Text>
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
            <Text className="text-2xl font-bold text-white">{event.title}</Text>
            {event.status === 'completed' && (
              <View className="mt-1 self-start rounded bg-white/20 px-2 py-1">
                <Text className="text-xs font-semibold text-white">Completed</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Event Details */}
        <View className="px-6 pt-6">
          <View className="rounded-xl bg-white p-5 shadow-sm">
            {/* Date & Time */}
            <View className="mb-4 flex-row items-start">
              <MaterialIcons name="event" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-500">Date & Time</Text>
                <Text className="mt-1 text-base text-gray-900">
                  {formatDateTime(event.date_time)}
                </Text>
              </View>
            </View>

            {/* Location */}
            <View className="mb-4 flex-row items-start">
              <MaterialIcons name="location-on" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-500">Location</Text>
                <Text className="mt-1 text-base text-gray-900">{event.location}</Text>
              </View>
            </View>

            {/* Host */}
            <View className="flex-row items-start">
              <MaterialIcons name="person" size={24} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-gray-500">Host</Text>
                <Text className="mt-1 text-base text-gray-900">{getDisplayName(event.host)}</Text>
              </View>
            </View>

            {/* Description */}
            {event.description && (
              <View className="mt-4 border-t border-gray-200 pt-4">
                <Text className="mb-2 text-sm font-semibold text-gray-500">Description</Text>
                <Text className="text-base text-gray-900">{event.description}</Text>
              </View>
            )}
          </View>
        </View>

        {/* RSVP Section */}
        <View className="px-6 pt-6">
          <Text className="mb-4 text-xl font-bold text-gray-900">RSVP</Text>

          {/* RSVP Buttons */}
          <View className="mb-6 flex-row space-x-3">
            <TouchableOpacity
              onPress={() => handleRSVP('going')}
              disabled={rsvpLoading || userRsvp === 'going'}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                userRsvp === 'going' ? 'bg-green-600' : 'bg-green-100'
              }`}
              style={{ opacity: rsvpLoading || userRsvp === 'going' ? 1 : 0.8 }}
            >
              {rsvpLoading && userRsvp !== 'going' ? (
                <ActivityIndicator size="small" color="#16A34A" />
              ) : (
                <>
                  <MaterialIcons
                    name="check-circle"
                    size={20}
                    color={userRsvp === 'going' ? '#FFFFFF' : '#16A34A'}
                  />
                  <Text
                    className={`ml-2 text-base font-semibold ${userRsvp === 'going' ? 'text-white' : 'text-green-700'}`}
                  >
                    Going
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleRSVP('not_going')}
              disabled={rsvpLoading || userRsvp === 'not_going'}
              className={`flex-1 flex-row items-center justify-center rounded-xl py-3 ${
                userRsvp === 'not_going' ? 'bg-red-600' : 'bg-red-100'
              }`}
              style={{ opacity: rsvpLoading || userRsvp === 'not_going' ? 1 : 0.8 }}
            >
              {rsvpLoading && userRsvp !== 'not_going' ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <>
                  <MaterialIcons
                    name="cancel"
                    size={20}
                    color={userRsvp === 'not_going' ? '#FFFFFF' : '#DC2626'}
                  />
                  <Text
                    className={`ml-2 text-base font-semibold ${userRsvp === 'not_going' ? 'text-white' : 'text-red-700'}`}
                  >
                    Not Going
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Going List */}
          {goingRsvps.length > 0 && (
            <View className="mb-6">
              <Text className="mb-3 text-base font-semibold text-gray-700">
                Going ({goingRsvps.length})
              </Text>
              {goingRsvps.map((rsvp, index) => (
                <View
                  key={rsvp.id}
                  className={`mb-3 flex-row items-center rounded-xl bg-white p-4 shadow-sm ${index === 0 ? '' : ''}`}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-10 w-10 items-center justify-center rounded-xl"
                  >
                    <Text className="text-sm font-bold text-white">
                      {getInitials(
                        rsvp.user.first_name,
                        rsvp.user.last_name,
                        rsvp.user.display_name,
                      )}
                    </Text>
                  </LinearGradient>
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {getDisplayName(rsvp.user)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Not Going List */}
          {notGoingRsvps.length > 0 && (
            <View className="mb-6">
              <Text className="mb-3 text-base font-semibold text-gray-700">
                Not Going ({notGoingRsvps.length})
              </Text>
              {notGoingRsvps.map((rsvp, index) => (
                <View
                  key={rsvp.id}
                  className={`mb-3 flex-row items-center rounded-xl bg-white p-4 opacity-75 shadow-sm ${index === 0 ? '' : ''}`}
                >
                  <LinearGradient
                    colors={['#9CA3AF', '#6B7280']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-10 w-10 items-center justify-center rounded-xl"
                  >
                    <Text className="text-sm font-bold text-white">
                      {getInitials(
                        rsvp.user.first_name,
                        rsvp.user.last_name,
                        rsvp.user.display_name,
                      )}
                    </Text>
                  </LinearGradient>
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-gray-900">
                      {getDisplayName(rsvp.user)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {goingRsvps.length === 0 && notGoingRsvps.length === 0 && (
            <View className="items-center py-8">
              <MaterialIcons name="people-outline" size={48} color="#9CA3AF" />
              <Text className="mt-4 text-gray-600">No RSVPs yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
