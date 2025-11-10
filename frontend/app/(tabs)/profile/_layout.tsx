import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#111827',
        headerTitleStyle: {
          fontWeight: '600',
          color: '#111827',
        },
        headerShadowVisible: false,
        presentation: 'card',
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerBackTitle: 'Profile',
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          title: 'Edit Profile',
          headerBackTitle: 'Settings',
        }}
      />
      <Stack.Screen
        name="change-password"
        options={{
          title: 'Change Password',
          headerBackTitle: 'Settings',
        }}
      />
      <Stack.Screen
        name="change-email"
        options={{
          title: 'Change Email',
          headerBackTitle: 'Settings',
        }}
      />
    </Stack>
  );
}

