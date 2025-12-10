import { useCallback, useEffect, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/use-auth';
import { circlesApi, eventsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
}

interface Statistics {
  circles: number;
  events: number;
  photos: number;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [statistics, setStatistics] = useState<Statistics>({ circles: 0, events: 0, photos: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStatistics = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Fetch circles count
      const circles = await circlesApi.getUserCircles();
      const circlesCount = circles?.length || 0;

      // Fetch events count - get all upcoming events from all user's circles
      let eventsCount = 0;
      if (circlesCount > 0) {
        const eventsPromises = circles.map(
          (circle: { id: string }) => eventsApi.getCircleEvents(circle.id).catch(() => []), // Don't fail if one circle's events fail
        );
        const eventsArrays = await Promise.all(eventsPromises);
        const allEvents = eventsArrays.flat();
        
        // Deduplicate events by ID (in case of any edge cases)
        const uniqueEvents = Array.from(
          new Map(allEvents.map((event: { id: string }) => [event.id, event])).values()
        );
        
        // Filter to only count upcoming events (exclude completed)
        const upcomingEvents = uniqueEvents.filter(
          (event: { status: string }) => event.status === 'upcoming'
        );
        
        eventsCount = upcomingEvents?.length || 0;
      }

      // Fetch photos count - query photos table (may not exist yet)
      let photosCount = 0;
      try {
        // Get all circle IDs the user is a member of
        const circleIds = (circles || []).map((circle: { id: string }) => circle.id);

        if (circleIds.length > 0) {
          const { count, error } = await supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .in('circle_id', circleIds);

          if (!error && count !== null) {
            photosCount = count;
          }
        }
      } catch (photoError) {
        // Photos table may not exist yet, so count will be 0
        console.log('Photos table not available yet:', photoError);
      }

      setStatistics({
        circles: circlesCount,
        events: eventsCount,
        photos: photosCount,
      });
    } catch (err) {
      console.error('Error fetching statistics:', err);
      // Keep default values (0, 0, 0) on error
    }
  }, [user?.id]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;

      try {
        // Fetch user profile from database
        const { data, error } = await supabase
          .from('users')
          .select('first_name, last_name, display_name, email')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          // Fallback to auth user metadata
          setProfile({
            first_name: user.user_metadata?.first_name || null,
            last_name: user.user_metadata?.last_name || null,
            display_name: user.user_metadata?.display_name || null,
            email: user.email || null,
          });
        } else {
          setProfile(data);
        }

        // Fetch statistics from database
        await fetchStatistics();
      } catch (err) {
        console.error('Error in fetchProfile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, fetchStatistics]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile?.display_name) {
      return profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  const getFullName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return profile?.display_name || 'User';
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
        {/* Blue-Purple Gradient Header */}
        <LinearGradient
          colors={['#3B82F6', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ paddingTop: insets.top + 16 }}
          className="pb-12"
        >
          <View className="items-center">
            {/* Avatar */}
            <View className="mb-4 h-24 w-24 items-center justify-center rounded-full border-2 border-white bg-white">
              <Text className="text-3xl font-bold text-blue-700">{getInitials()}</Text>
            </View>

            {/* Name */}
            <Text className="mb-1 text-2xl font-semibold text-white">{getFullName()}</Text>

            {/* Display Name */}
            {profile?.display_name && (
              <Text className="mb-1 text-lg text-white/80">{profile.display_name}</Text>
            )}

            {/* Email */}
            <Text className="text-base text-white/90">{profile?.email || user?.email || ''}</Text>
          </View>
        </LinearGradient>

        {/* Statistics Card */}
        <View className="mx-4 -mt-6 rounded-2xl bg-white shadow-lg">
          <View className="flex-row divide-x divide-gray-200">
            <View className="flex-1 items-center py-6">
              <Text className="mb-1 text-2xl font-bold text-gray-900">{statistics.circles}</Text>
              <Text className="text-sm text-gray-600">Circles</Text>
            </View>
            <View className="flex-1 items-center py-6">
              <Text className="mb-1 text-2xl font-bold text-gray-900">{statistics.events}</Text>
              <Text className="text-sm text-gray-600">Events</Text>
            </View>
            <View className="flex-1 items-center py-6">
              <Text className="mb-1 text-2xl font-bold text-gray-900">{statistics.photos}</Text>
              <Text className="text-sm text-gray-600">Photos</Text>
            </View>
          </View>
        </View>

        {/* Navigation List */}
        <View className="mt-6 px-4">
          {/* Settings */}
          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm"
            onPress={() => router.push('/(tabs)/profile/settings')}
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MaterialIcons name="settings" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 flex-1 text-base text-gray-900">Settings</Text>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MaterialIcons name="notifications" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 flex-1 text-base text-gray-900">Notifications</Text>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm">
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MaterialIcons name="help-outline" size={24} color="#2563EB" />
            </View>
            <Text className="ml-3 flex-1 text-base text-gray-900">Help & Support</Text>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Sign Out */}
          <TouchableOpacity
            className="mb-2 flex-row items-center rounded-xl bg-white px-4 py-4 shadow-sm"
            onPress={handleSignOut}
          >
            <View className="h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <MaterialIcons name="exit-to-app" size={24} color="#EF4444" />
            </View>
            <Text className="ml-3 flex-1 text-base text-red-600">Sign Out</Text>
            <MaterialIcons name="chevron-right" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* App Version Info */}
        <View className="mb-12 mt-8 items-center">
          <Text className="mb-1 text-sm text-gray-400">HuddleUp v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
