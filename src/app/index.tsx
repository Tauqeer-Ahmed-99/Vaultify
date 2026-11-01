import { Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { accountsRoute } from '../../navigation/routes';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user) {
    return <Redirect href={accountsRoute} />;
  }
  return <Redirect href="/(auth)/login" />;
}
