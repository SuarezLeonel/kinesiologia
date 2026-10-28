import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme/ThemeContext';
import { typography, spacing } from '../theme/tokens';
import { LoadingState } from '../components/FeedbackStates';

import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { ClinicalRecordsScreen } from '../screens/ClinicalRecordsScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { theme } = useAppTheme();
  const { isReceptionist, isKinesiologist } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarPosition: 'top',
        tabBarShowIcon: true,
        tabBarShowLabel: true,
        tabBarIcon: ({ color }) => {
          let iconName: React.ComponentProps<typeof MaterialIcons>['name'] = 'space-dashboard';
          if (route.name === 'Dashboard') iconName = 'space-dashboard';
          else if (route.name === 'Appointments') iconName = 'event';
          else if (route.name === 'Patients') iconName = 'people-outline';
          else if (route.name === 'ClinicalRecords') iconName = 'medical-services';
          else if (route.name === 'Exercises') iconName = 'fitness-center';
          else if (route.name === 'Payments') iconName = 'payments';
          else if (route.name === 'Settings') iconName = 'tune';

          return <MaterialIcons name={iconName} size={20} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          borderBottomWidth: 1,
          borderTopWidth: 0,
          height: 62,
          paddingTop: 4,
          paddingBottom: 4
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: {
          fontSize: typography.fontSize.tiny,
          fontWeight: typography.fontWeight.semibold,
          letterSpacing: 0.2
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Agenda' }} />
      <Tab.Screen name="Patients" component={PatientsScreen} options={{ title: 'Pacientes' }} />
      {/* Historias clínicas solo para kinesiólogos y administradores */}
      {!isReceptionist && (
        <Tab.Screen name="ClinicalRecords" component={ClinicalRecordsScreen} options={{ title: 'Historias' }} />
      )}
      <Tab.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Ejercicios' }} />
      {/* Pagos administrativos visibles para Admin y Recepcionista */}
      {!isKinesiologist && (
        <Tab.Screen name="Payments" component={PaymentsScreen} options={{ title: 'Pagos' }} />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  const { theme } = useAppTheme();

  if (isLoading) {
    return <LoadingState message="Iniciando sistema..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background }
        }}
      >
        {user ? (
          <Stack.Screen name="MainApp" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
